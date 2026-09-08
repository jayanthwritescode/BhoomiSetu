const AMOY_RPC = 'https://polygon-amoy.drpc.org';

export type AmoyReceipt = { status: string; blockNumber: string };
type AmoyTransaction = { input?: string };

export async function amoyRpc<T>(
  method: string,
  params: unknown[],
): Promise<T | null> {
  const response = await fetch(AMOY_RPC, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error('RPC_UNAVAILABLE');
  const payload = (await response.json()) as {
    result?: T | null;
    error?: { message?: string };
  };
  if (payload.error) throw new Error(payload.error.message || 'RPC_ERROR');
  return payload.result ?? null;
}

export async function waitForReceipt(
  transactionHash: string,
): Promise<AmoyReceipt> {
  const deadline = Date.now() + 45000;
  for (let attempt = 0; attempt < 24 && Date.now() < deadline; attempt++) {
    const receipt = await amoyRpc<AmoyReceipt>('eth_getTransactionReceipt', [
      transactionHash,
    ]);
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('CONFIRMATION_TIMEOUT');
}

export async function readAmoyTransaction(
  transactionHash: string,
): Promise<AmoyTransaction | null> {
  return amoyRpc<AmoyTransaction>('eth_getTransactionByHash', [
    transactionHash,
  ]);
}
