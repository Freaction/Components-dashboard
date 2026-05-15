const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { pick } = require('stream-json/filters/pick.js');
const { streamObject } = require('stream-json/streamers/stream-object.js');
const { Readable } = require('stream');

const start = async () => {
  const testStream = Readable.from(['{"nodes": {"1": {}']);

  const pipeline = chain([
    testStream,
    parser(),
    pick({ filter: 'nodes' }),
    streamObject()
  ]);

  try {
    for await (const data of pipeline) {
      console.log('data', data);
    }
  } catch (e) {
    console.log('caught error in for await', e.message);
  }
};

start();
