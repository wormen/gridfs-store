import {ObjectID, MongoClientOptions} from 'mongodb';

export interface IHost {
  host: string;
  port: number | string;
}

export interface IOptions {
  hosts?: IHost[];
  database?: string;
  replicaSet?: string;
  authSource?: string;
  mongoClientOptions?: MongoClientOptions;
}

export interface IMongoQuery {
  replicaSet?: string;
  authSource?: string;
}

export interface IParams {
  filename?: string;
  md5?: string;
}

export interface IGridFSObject {
  _id: ObjectID;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  md5: string;
  filename: string;
  contentType: string;
  metadata: object;
}

export interface IGridFSWriteOption {
  filename: string;
  chunkSizeBytes?: number;
  metadata?: any;
  contentType?: string;
  aliases?: string[];
}

export interface IDownloadOptions {
  filename: boolean | string;
  targetDir?: string;
}

export interface IDirectory {
  _id?: ObjectID;
  parentId?: null | ObjectID;
  created?: Date;
  name: string;
  path: string;
}