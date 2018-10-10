import * as fs from 'fs';
import * as URL from 'url';
import * as mime from 'mime';
import * as path from 'path';
import * as async from 'async';

import osTmpdir = require('os-tmpdir');
import {Stream} from 'stream';
import uniqueFilename = require('unique-filename');

import {
  ObjectID, ObjectId, Db, MongoClient, MongoClientOptions,
  GridFSBucket, GridFSBucketReadStream
} from 'mongodb';

import {
  IOptions, IMongoQuery, IDownloadOptions, IParams, IDirectory,
  IGridFSWriteOption, IGridFSObject
} from './interfaces';

const defaultOptions: IOptions = {
  hosts: [
    {host: 'localhost', port: 27017}
  ],
  database: 'default'
};

export default class GridStore {
  connection: Db;
  private opts: IOptions = defaultOptions;

  private _queue = async.queue(({action, item}, done) => {
  }, 1);

  constructor(opts: IOptions, readonly bucketName: string = 'fs') {
    if (Object.keys(opts).length > 0) {
      this.opts = Object.assign({}, defaultOptions, opts);
    }
  }

  public get bucket(): GridFSBucket {
    return new GridFSBucket(this.connection, {bucketName: this.bucketName});
  }

  private _addQueue(action: string, item: object): void {
    this._queue.push({action, item});
  }

  /**
   * https://docs.mongodb.com/manual/reference/connection-string/
   */
  async connect() {
    const hosts = (this.opts.hosts || defaultOptions.hosts).map(({host, port}) => {
      host = host || 'localhost';
      port = port || 27017;
      return [host, port].join(':');
    }).join(',');

    const query: IMongoQuery = {};

    if (this.opts.replicaSet) {
      query.replicaSet = this.opts.replicaSet;
    }

    if (this.opts.authSource) {
      query.authSource = this.opts.authSource;
    }

    const uri = URL.format({
      protocol: 'mongodb',
      slashes: true,
      host: hosts,
      pathname: this.opts.database,
      query
    });

    let mongoOpts: MongoClientOptions = {
      reconnectTries: Number.MAX_VALUE,
      reconnectInterval: 500,
      autoReconnect: true,
      poolSize: 1e6,
      keepAlive: true,
      bufferMaxEntries: 0,
      useNewUrlParser: true
    };

    if (this.opts.mongoClientOptions && Object.keys(this.opts.mongoClientOptions).length > 0) {
      mongoOpts = Object.assign({}, mongoOpts, this.opts.mongoClientOptions);
    }

    await MongoClient.connect(uri, mongoOpts).then(client => {
      this.connection = client.db(this.opts.database);
      return client;
    }).catch(async (e) => {
      await this.connect();
    });
  }

  public static getDownloadPath(object: IGridFSObject, options: IDownloadOptions = {filename: false}) {
    let finalPath = '';
    if (!options.targetDir) {
      if (typeof options.filename === 'string') {
        finalPath = `${osTmpdir()}/${options.filename}`;
      } else {
        if (options.filename === true) {
          finalPath = `${osTmpdir()}/${object._id}`;
        } else {
          finalPath = uniqueFilename(osTmpdir());
        }
      }
    } else {
      if (typeof options.filename === 'string') {
        finalPath = `${options.targetDir}/${options.filename}`;
      } else {
        if (options.filename === true) {
          finalPath = object.filename;
        } else {
          finalPath = uniqueFilename(options.targetDir);
        }
      }
    }
    return finalPath;
  }

  /**
   * Returns a stream of a file from the GridFS.
   * @param {string} id
   * @return {Promise<GridFSBucketReadStream>}
   */
  public async readFileStream(id: string): Promise<GridFSBucketReadStream> {
    const object = await this.findById(id);
    return this.bucket.openDownloadStream(object._id);
  }

  /**
   * Save the File from the GridFs to the filesystem and get the Path back
   * @param {string} id
   * @param {IDownloadOptions} options
   * @return {Promise<string>}
   */
  public async downloadFile(id: string, options?: IDownloadOptions): Promise<string> {
    const object = await this.findById(id);
    const downloadPath = GridStore.getDownloadPath(object, options);
    return new Promise<string>(async (resolve, reject) => {
      this.bucket.openDownloadStream(object._id)
        .once('error', async (error) => {
          reject(error);
        })
        .once('end', async () => {
          resolve(downloadPath);
        })
        .pipe(fs.createWriteStream(downloadPath, {}));
    });
  }

  /**
   * Find a single object by id
   * @param {string} id
   * @return {Promise<IGridFSObject>}
   */
  public async findById(id: string): Promise<IGridFSObject> {
    return await this.findOne({_id: new ObjectID(id)});
  }

  /**
   * Find a single object by condition
   * @param filter
   * @return {Promise<IGridFSObject>}
   */
  public async findOne(filter: any): Promise<IGridFSObject> {
    const result = await this.find(filter);
    if (result.length === 0) {
      throw new Error('No Object found');
    }
    return result[0];
  }

  /**
   * Find a list of object by condition
   * @param filter
   * @return {Promise<IGridFSObject[]>}
   */
  public async find(filter: any): Promise<IGridFSObject[]> {
    return await this.bucket.find(filter).toArray();
  }

  /**
   * Find objects by condition
   * @param stream
   * @param options
   */
  public writeFileStream(stream: Stream, options: IGridFSWriteOption): Promise<IGridFSObject> {
    return new Promise(async (resolve, reject) => {

      let fileOpts = {
        aliases: options.aliases,
        chunkSizeBytes: options.chunkSizeBytes,
        contentType: options.contentType,
        metadata: options.metadata,
      };

      await this.directory.create(path.dirname(options.filename));
      await this.directory.getPath(path.dirname(options.filename)).then(doc => {
        fileOpts.metadata = Object.assign({}, fileOpts.metadata, {
          directoryId: doc._id
        });
      });

      stream
        .pipe(this.bucket.openUploadStream(options.filename, fileOpts))
        .on('error', async (err) => {
          reject(err);
        })
        .on('finish', async (item: IGridFSObject) => {
          resolve(item);
        })
    });
  }

  /**
   * Upload a file directly from a fs Path
   * @param {string} uploadFilePath
   * @param {IGridFSWriteOption} options
   * @param {boolean} deleteFile
   * @return {Promise<IGridFSObject>}
   */
  public async uploadFile(
    uploadFilePath: string,
    options: IGridFSWriteOption,
    deleteFile: boolean = true
  ): Promise<IGridFSObject> {
    if (!fs.existsSync(uploadFilePath)) {
      throw new Error('File not found');
    }
    const tryDeleteFile = (obj?: any): any => {
      if (fs.existsSync(uploadFilePath) && deleteFile === true) {
        fs.unlinkSync(uploadFilePath);
      }
      return obj;
    };

    options.contentType = options.contentType || mime.getType(uploadFilePath);

    await this.directory.create(path.dirname(options.filename));

    return await this.writeFileStream(fs.createReadStream(uploadFilePath), options)
      .then(tryDeleteFile)
      .catch((err) => {
        tryDeleteFile();
        throw err;
      });
  }

  /**
   * Delete an File from the GridFS
   * @param {string} id
   * @return {Promise<boolean>}
   */
  public delete(id: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.bucket.delete(new ObjectID(id), (async (err) => {
        if (err) {
          reject(err);
        }
        resolve(true);
      }));
    });
  }

  /**
   * Check exists file from the GridFS
   * @param filename
   * @param md5
   */
  exists(filename: string, md5?: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const params: IParams = {filename, md5};

      if (!md5) {
        delete params.md5;
      }

      const doc = await this.findOne(params);
      resolve(!(doc === null));
    });
  }

  get directory() {
    return new Directory(this.opts, this.bucketName);
  }
}

class Directory extends GridStore {
  constructor(opts: IOptions, readonly bucketName: string = 'fs') {
    super(opts, bucketName);
  }

  get collection(): any {
    return this.connection.collection([this.bucketName, 'directory'].join('.'))
  }

  private async _checkConnect() {
    if (!this.connection) {
      await this.connect();

      this.collection.createIndex({name: 1});
      this.collection.createIndex({path: 1});
      this.collection.createIndex({name: 1, path: 1}, {unique: 1});
    }
  }

  exists(path: string): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      await this._checkConnect();

      this.collection.findOne({path}, (error, raw) => {
        if (error) {
          return reject(error);
        }
        resolve(raw !== null && typeof raw === 'object' && raw.hasOwnProperty('_id'));
      });
    });
  }

  create(directoryPath: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await this._checkConnect();

      let obj: IDirectory = {
        path: directoryPath,
        name: '',
        parentId: null,
        created: new Date()
      };

      if (directoryPath !== '/') {
        obj.name = path.basename(directoryPath);
      }

      const names: IDirectory[] = directoryPath.split('/')
        .filter((item, idx) => {
          if (idx > 0 && item === '') {
            return false;
          }
          return true;
        })
        .reduce((arr, name) => {
          arr.push({
            path: arr.length === 0 ? '/' : path.resolve(arr[arr.length - 1].path, name),
            created: new Date(),
            name
          });
          return arr;
        }, []);

      const save = (data: IDirectory, cb?: (error, raw) => void): Promise<any> => {
        return new Promise((resolve, reject) => {
          this.collection.insertOne(data, (err, raw) => {
            if (cb) {
              cb(err, raw);
            } else {
              if (err) {
                if (String(err.message).includes('duplicate key')) {
                  return resolve();
                }
                return reject(err);
              }
              resolve();
            }
          });
        });
      };

      if (names.length === 1 && ['', '/'].includes(names[0].path)) {
        save(obj, (err) => {
          if (err) {
            return reject(err);
          }
          resolve();
        });
      } else {
        let pid = null;
        for (let item of names) {
          if (item.path !== '/') {
            item.parentId = pid;
          }

          if (!item.parentId && item.path !== '/') {
            await this.getPath(path.dirname(item.path)).then(doc => {
              item.parentId = doc._id;
            });
          }

          await save(item).then(raw => {
            if (raw && raw.insertedId) {
              pid = raw.insertedId;
            }
          });
        }

        resolve();
      }

    });
  }

  getPath(path: string): Promise<IDirectory> {
    return new Promise(async (resolve, reject) => {
      await this._checkConnect();
      this.collection.findOne({path}, (err, doc) => {
        if (err) {
          return reject(err);
        }
        resolve(doc);
      });
    });
  }

  private _getChildrens(parentId): Promise<IDirectory[]> {
    return new Promise((resolve, reject) => {
      this.collection.find({parentId}).toArray((err, list) => {
        if (err) {
          return reject(err);
        }
        resolve(list);
      });
    });
  }

  listByPath(path: string) {
    return new Promise(async (resolve, reject) => {
      await this._checkConnect();

      await this.getPath(path)
        .then(doc => {
          if (doc && doc._id) {
            this._getChildrens(doc._id).then(list => resolve(list)).catch(reject);
          } else {
            resolve([]);
          }
        })
        .catch(reject);
    });
  }

  listById(id: string) {
    return new Promise(async (resolve, reject) => {
      await this._checkConnect();

      this._getChildrens(new ObjectID(id)).then(resolve).catch(reject);
    });
  }

  // move(oldPath, newPath): Promise<void> {
  //   return new Promise(async (resolve, reject) => {
  //     await this._checkConnect();
  //
  //   });
  // }

  remove(path: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await this._checkConnect();
      // todo remove children folders and files
      this.collection.deleteMany({path}, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  removeById(id: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      await this._checkConnect();
      // todo remove children folders and files
      this.collection.deleteOne({_id: new ObjectID(id)}, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }
}

export {
  ObjectID,
  ObjectId
};
