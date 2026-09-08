import test from 'node:test';
import assert from 'node:assert/strict';
import { amoyRpc, waitForReceipt } from '../lib/polygon.ts';

test('RPC preserves pending null instead of inventing a receipt', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(JSON.parse(options.body).method, 'eth_getTransactionReceipt');
    return Response.json({ result: null });
  });
  assert.equal(await amoyRpc('eth_getTransactionReceipt', ['0xtest']), null);
});
test('RPC HTTP failure is propagated', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 503 }),
  );
  await assert.rejects(
    amoyRpc('eth_getTransactionReceipt', []),
    /RPC_UNAVAILABLE/,
  );
});
test('RPC error is propagated', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: { message: 'rate limit' } }),
  );
  await assert.rejects(amoyRpc('eth_getTransactionReceipt', []), /rate limit/);
});
test('receipt polling returns a real receipt unchanged', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ result: { status: '0x1', blockNumber: '0x123' } }),
  );
  assert.deepEqual(await waitForReceipt('0xtest'), {
    status: '0x1',
    blockNumber: '0x123',
  });
});
test('reverted receipt is not promoted to success', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ result: { status: '0x0', blockNumber: '0x123' } }),
  );
  assert.equal((await waitForReceipt('0xtest')).status, '0x0');
});
