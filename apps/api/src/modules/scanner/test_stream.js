const { Readable } = require('stream');

const createStream = () => {
  return new Readable({
    read(size) {
      this.push(Buffer.from('x'.repeat(1024 * 1024))); // 1MB
      if (this.bytesRead === undefined) this.bytesRead = 0;
      this.bytesRead += 1;
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
  console.log('onData', downloadedMB);
  if (!isStreamed && downloadedMB > 50) {
    isStreamed = true;
    pipelineStarted = true;
    stream.removeListener('data', onData);
    
    // Test if we need stream.pause()
    // stream.pause();

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
    for await (const chunk of stream) {
      console.log('for await chunk');
      yield chunk;
    }
    console.log('stream ended in generator');
  })());

  for await (const data of combinedStream) {
    // do nothing
  }
  console.log('done pipeline');
};

stream.on('data', onData);
stream.on('end', () => console.log('end listener'));
