import {ObjectID, MongoClientOptions} from 'mongodb';

interface IHost {
  host: string;
  port: number | string;
}

interface IOptions {
  hosts?: IHost[];
  database?: string;
  replicaSet?: string;
  authSource?: string;
  mongoClientOptions?: MongoClientOptions;
}

interface IMongoQuery {
  replicaSet?: string;
  authSource?: string;
}

interface IParams {
  filename?: string;
  md5?: string;
}

interface IGridFSObject {
  _id: ObjectID;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  md5: string;
  filename: string;
  contentType: string;
  metadata: object;
}

interface IGridFSWriteOption {
  filename: string;
  chunkSizeBytes?: number;
  metadata?: any;
  contentType?: string;
  aliases?: string[];
}

interface IDownloadOptions {
  filename: boolean | string;
  targetDir?: string;
}

export {
  IHost,
  IOptions,
  IParams,
  IMongoQuery,
  IGridFSObject,
  IGridFSWriteOption,
  IDownloadOptions
};
