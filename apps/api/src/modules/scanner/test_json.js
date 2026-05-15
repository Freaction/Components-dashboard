const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const { pick } = require('stream-json/filters/pick.js');
const { streamObject } = require('stream-json/streamers/stream-object.js');
const { Readable } = require('stream');

const testStream = Readable.from(['{"nodes": {"1": {}']);

const pipeline = chain([
  testStream,
  parser(),
  pick({ filter: 'nodes' }),
  streamObject()
]);

pipeline.on('data', data => console.log('data', data));
pipeline.on('error', err => console.log('error', err.message));
pipeline.on('end', () => console.log('end'));
