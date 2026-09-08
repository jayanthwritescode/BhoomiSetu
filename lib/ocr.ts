import type { Worker } from 'tesseract.js';

// A bounded worker lifetime; aborts cannot overwrite a subsequent review flow.
export async function recognizeScan(
  image: Blob,
  language: string,
  signal: AbortSignal,
  onProgress: (value: number) => void,
) {
  let worker: Worker | undefined;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(new Error('OCR_CANCELLED'));
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), 90000);
    if (signal.aborted) abort();
  });
  const work = async () => {
    const { createWorker } = await import('tesseract.js');
    if (finished || signal.aborted) throw new Error('OCR_CANCELLED');
    worker = await createWorker(language, 1, {
      logger: (message) => {
        if (
          !finished &&
          !signal.aborted &&
          message.status === 'recognizing text'
        )
          onProgress(message.progress);
      },
    });
    if (finished || signal.aborted) {
      await worker.terminate();
      throw new Error('OCR_CANCELLED');
    }
    const result = await worker.recognize(image);
    return result.data;
  };
  try {
    return await Promise.race([work(), interrupted]);
  } finally {
    finished = true;
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    if (worker) void worker.terminate().catch(() => undefined);
  }
}
