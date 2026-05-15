const { Readable } = require('stream');

const createStream = () => {
  return new Readable({
    read(size) {
      if (this.bytesRead === undefined) this.bytesRead = 0;
      this.bytesRead += 1;
      this.push(Buffer.from('x'.repeat(1024 * 1024))); // 1MB
      if (this.bytesRead > 100) {
        this.push(null);
      }
    }
  });
};

const stream = createStream();

let isStreamed = false;
let pipelineStarted = false;
const initialChunks = [];

const onData = (chunk) => {
  initialChunks.push(chunk);
  const downloadedMB = initialChunks.length;
  if (!isStreamed && downloadedMB > 50) {
    isStreamed = true;
    pipelineStarted = true;
    stream.removeListener('data', onData);
    
    stream.pause(); // Add pause!

    startStreamingPipeline();
  }
};

const startStreamingPipeline = async () => {
  console.log('startStreamingPipeline');
  const combinedStream = Readable.from((async function* () {
    while (initialChunks.length > 0) {
      yield initialChunks.shift();
    }
    console.log('yielding from stream');
    let count = 0;
    for await (const chunk of stream) {
      count++;
    }
    console.log('stream yielded', count, 'chunks');
  })());

  for await (const data of combinedStream) {
    // do nothing
  }
  console.log('done pipeline');
};

stream.on('data', onData);
stream.on('end', () => console.log('end listener'));
