import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/pick.js';
import { streamObject } from 'stream-json/streamers/stream-object.js';
import { Readable, PassThrough } from 'stream';

const STREAM_THRESHOLD_MB = 20;

export async function parseFigmaStream(
  stream: any, 
  logPrefix: string = '', 
  onNode?: (id: string, data: any) => Promise<void>
): Promise<any> {
  return new Promise((resolve, reject) => {
    let downloadedBytes = 0;
    const initialChunks: any[] = [];
    let isStreamed = false;
    let pipelineStarted = false;
    
    const intermediate = new PassThrough();
    stream.pipe(intermediate);

    const handleStreamStrategy = async () => {
      if (isStreamed && onNode && !pipelineStarted) {
        pipelineStarted = true;
        intermediate.removeListener('data', onData);
        
        try {
          const combinedStream = Readable.from((async function* () {
            for (const chunk of initialChunks) yield chunk;
            for await (const chunk of intermediate) yield chunk;
          })());

          const pipeline = chain([
            combinedStream,
            parser(),
            pick({ filter: 'nodes' }),
            streamObject()
          ]);

          pipeline.on('data', async (data: any) => {
            await onNode(data.key, data.value);
          });

          pipeline.on('end', () => resolve({ streamed: true }));
          pipeline.on('error', reject);
        } catch (e) {
          reject(e);
        }
      }
    };

    const onData = (chunk: any) => {
      downloadedBytes += chunk.length;
      const downloadedMB = downloadedBytes / (1024 * 1024);
      
      if (!isStreamed && downloadedMB > STREAM_THRESHOLD_MB) {
        isStreamed = true;
        handleStreamStrategy();
      }

      if (!isStreamed) {
        initialChunks.push(chunk);
      }

      const status = isStreamed ? '🛡️ STREAM' : '⚡ FAST';
      process.stdout.write(`\r[Parser] ${logPrefix.padEnd(15)} | ${status} | ${downloadedMB.toFixed(1)}MB`.padEnd(50));
    };

    intermediate.on('data', onData);

    stream.on('end', async () => {
      process.stdout.write(`\n`);
      
      if (!isStreamed) {
        try {
          const fullBuffer = Buffer.concat(initialChunks);
          resolve(JSON.parse(fullBuffer.toString()));
        } catch (e) {
          reject(e);
        }
      } else if (!pipelineStarted) {
        handleStreamStrategy();
      }
    });

    stream.on('error', (err: any) => reject(err));
  });
}

