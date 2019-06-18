/**
 Copyright © Oleg Bogdanov
 Developer: Oleg Bogdanov
 Contacts: https://github.com/wormen
 ---------------------------------------------
 */

import * as fs from 'fs';
import * as path from 'path';
import Store from './src';

(async () => {
  const store = new Store({
    database: 'testDatabase'
  });

  await store.connect();

  // await store.directory.exists('/').then(data => {
  //   console.log('directory exists', data);
  // });

  // await Promise.all([
  //   store.directory.create('/sdfadfsd/sddfdfssdf'),
  //   store.directory.create('/sdfadfsd/sdfgsdfg/sdf')
  // ]).then(data => {
  //   console.log('directory created');
  // });
  //
  // await store.directory.listByPath('/sdfadfsd').then(list => {
  //   console.log('directory listByPath', list);
  // });

  const filename = '/sdfadfsd/test_v1.mp4';
  // const uploadFilePath = path.resolve(__dirname, path.basename(filename));
  //
  // console.log('uploadFilePath:', uploadFilePath);
  //
  // let item = await store.uploadFile(uploadFilePath, {filename}).then(() => {
  //   console.log('saved!');
  // });
  //
  // await store.exists(filename).then((isExists) => {
  //   console.log('exists', isExists);
  // });

  // await store.delete(String(item._id)).then(() => {
  //   console.log('removed!');
  // });

  const content = await store.pathByContent(filename);

  fs.writeFileSync(path.resolve(__dirname, path.basename(filename)), content)

  // console.log(content);

  // process.exit(0);
})();