import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/pick.js';
import { streamObject } from 'stream-json/streamers/stream-object.js';
import { Readable } from 'stream';

import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/pick.js';
import { streamObject } from 'stream-json/streamers/stream-object.js';
import { Readable } from 'stream';
import { renderer } from './internal/progress.renderer';

const STREAM_THRESHOLD_MB = 50;

export async function parseFigmaStream(
  stream: any,
  logPrefix: string = '',
  onNode?: (id: string, data: any) => Promise<void>,
  totalBytes: number = 0
): Promise<any> {
  const taskKey = `download:${logPrefix}`;
  renderer.update(taskKey, logPrefix, 0, totalBytes, 'bytes');

  return new Promise((resolve, reject) => {
    let downloadedBytes = 0;
    const initialChunks: Buffer[] = [];
    let isStreamed = false;
    let pipelineStarted = false;

    const logProgress = (bytes: number) => {
      downloadedBytes += bytes;
      renderer.update(taskKey, logPrefix, downloadedBytes, totalBytes, 'bytes');
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
          if (typeof stream.pause === 'function') {
            stream.pause();
          }
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

        for await (const data of pipeline) {
          if (onNode) {
            try {
              await onNode(data.key, data.value);
            } catch (e) {
              renderer.log(`\n[Parser] Error in onNode handler: ${e}`);
            }
          }
        }

        renderer.remove(taskKey);
        resolve({ streamed: true });
      } catch (e) {
        renderer.remove(taskKey);
        renderer.log(`\n[Parser] Pipeline error: ${e}`);
        reject(e);
      }
    };

    stream.on('data', onData);

    stream.on('end', async () => {
      if (!isStreamed) {
        try {
          const fullBuffer = Buffer.concat(initialChunks);
          renderer.remove(taskKey);
          if (fullBuffer.length === 0) {
            resolve({});
            return;
          }
          resolve(JSON.parse(fullBuffer.toString()));
        } catch (e) {
          renderer.remove(taskKey);
          renderer.log(`\n[Parser] JSON Parse Error: ${e}`);
          reject(e);
        }
      } else if (!pipelineStarted && onNode) {
        pipelineStarted = true;
        startStreamingPipeline();
      } else if (isStreamed && !onNode) {
        renderer.remove(taskKey);
        resolve({ streamed: true });
      }
    });

    stream.on('error', (err: any) => {
      renderer.remove(taskKey);
      reject(err);
    });
  });
}

