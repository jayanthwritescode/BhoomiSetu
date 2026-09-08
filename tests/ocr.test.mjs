import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizeScan } from '../lib/ocr.ts';

test('already-cancelled OCR does not start recognition or emit progress', async () => {
  const controller = new AbortController();
  controller.abort();
  let progressCalls = 0;
  await assert.rejects(
    recognizeScan(new Blob(), 'eng', controller.signal, () => progressCalls++),
    /OCR_CANCELLED/,
  );
  assert.equal(progressCalls, 0);
});
