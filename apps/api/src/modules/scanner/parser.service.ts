import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/pick.js';
import { streamObject } from 'stream-json/streamers/stream-object.js';
import { Readable, PassThrough } from 'stream';

const STREAM_THRESHOLD_MB = 50; // Increased to 50MB for better performance on medium files

export async function parseFigmaStream(
  stream: any, 
  logPrefix: string = '', 
  onNode?: (id: string, data: any) => Promise<void>
): Promise<any> {
  return new Promise((resolve, reject) => {
    let downloadedBytes = 0;
    const initialChunks: Buffer[] = [];
    let isStreamed = false;
    let pipelineStarted = false;
    let lastLoggedMB = -1;

    const logProgress = (bytes: number) => {
      downloadedBytes += bytes;
      const downloadedMB = downloadedBytes / (1024 * 1024);
      
      if (Math.floor(downloadedMB / 5) > lastLoggedMB || (isStreamed && lastLoggedMB < 0)) {
        const status = isStreamed ? '🛡️ STREAM' : '⚡ FAST';
        process.stdout.write(`\r[Parser] ${logPrefix.padEnd(15)} | ${status} | ${downloadedMB.toFixed(1)}MB`.padEnd(50));
        lastLoggedMB = Math.floor(downloadedMB / 5);
      }
    };
    
    const onData = (chunk: Buffer) => {
      initialChunks.push(chunk); 
      logProgress(chunk.length);
      
      const downloadedMB = downloadedBytes / (1024 * 1024);
      
      if (!isStreamed && downloadedMB > STREAM_THRESHOLD_MB) {
        isStreamed = true;
        
        if (onNode && !pipelineStarted) {
          pipelineStarted = true;
          stream.removeListener('data', onData);
          startStreamingPipeline();
        }
      }
    };

    const startStreamingPipeline = async () => {
      try {
        const combinedStream = Readable.from((async function* () {
          while (initialChunks.length > 0) {
            yield initialChunks.shift();
          }
          for await (const chunk of stream) {
            logProgress(chunk.length);
            yield chunk;
          }
        })());

        const pipeline = chain([
          combinedStream,
          parser(),
          pick({ filter: 'nodes' }),
          streamObject()
        ]);

        // Sequential processing of nodes from the stream
        for await (const data of pipeline) {
          if (onNode) {
            try {
              await onNode(data.key, data.value);
            } catch (e) {
              console.error(`\n[Parser] Error in onNode handler:`, e);
            }
          }
        }

        resolve({ streamed: true });
      } catch (e) {
        console.error(`\n[Parser] Pipeline error:`, e);
        reject(e);
      }
    };

    stream.on('data', onData);

    stream.on('end', async () => {
      process.stdout.write(`\n`);
      
      if (!isStreamed) {
        try {
          const fullBuffer = Buffer.concat(initialChunks);
          if (fullBuffer.length === 0) {
            resolve({});
            return;
          }
          resolve(JSON.parse(fullBuffer.toString()));
        } catch (e) {
          console.error(`\n[Parser] JSON Parse Error:`, e);
          reject(e);
        }
      } else if (!pipelineStarted && onNode) {
        pipelineStarted = true;
        startStreamingPipeline();
      } else if (isStreamed && !onNode) {
        resolve({ streamed: true });
      }
    });

    stream.on('error', (err: any) => reject(err));
  });
}

