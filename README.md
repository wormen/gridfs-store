# gridfs-store

This is a simple wrapper for the new [MongoDB GridFSBucket API](http://mongodb.github.io/node-mongodb-native/3.0/tutorials/gridfs/streaming/).


## How to install

That is simple

`npm install --save gridfs-store`

OR

`yarn add gridfs-store`

## Usage

```ecmascript 6
import Store from 'gridfs-store';

(async () => {
  await store.connect();
  
  const filename = 'testDir/test.txt';
  
  let item = await store.uploadFile(path.resolve(__dirname, 'test.txt'), {filename}).then(() => {
    console.log('saved!');
  });
  
  await store.exists(filename).then((isExists) => {
    console.log('exists', isExists);
  });
    
  await store.delete(String(item._id)).then(() => {
    console.log('removed!');
  });
    
  process.exit(0);
})();

```


## Methods

### findById

By this method you will simple get the meta-object from the MongoDB as a Promise-Object.
If nothing found at the Database, then it will reject and the catch-block will be executed.

```js
gridFS.findById("59e085f272882d728e2fa4c2").then((item) => {
    console.log(item);
}).catch((err) => {
    console.error(err);
});
```

### downloadFile

You will get the file simple written to the filesystem directly from the Database.
If nothing found at the Database, then it will reject and the catch-block will be executed.

```js
gridFS.downloadFile("59e085f272882d728e2fa4c2", {
    filename: "test.gif",
    targetDir: "/tmp"
}).then((downloadedFilePath) => {
    console.log(downloadedFilePath);
}).catch((err) => {
    console.error(err);
});
```

### readFileStream

You will get a GridFSBucketReadStream as Promise.
If nothing found at the Database, then it will reject and the catch-block will be executed.

This method is very useful, to stream the content directly to the user.

For example with express:
```js
return gridFS.readFileStream(req.params.id).then((item) => {
    item
    .once("error", () => {
        return res.status(400).end();
    }).pipe(res);
}).catch(() => res.status(500));
```

