'use strict';

// Shared in-memory fakes for the blockchain tests: a Realtime Database stand-in and a
// ledger stand-in. They let the anchoring/verification logic and the API routes be
// tested without Firebase or a blockchain.

// Minimal Realtime Database fake: `set` stores a subtree value; `once` returns the exact
// value, or an object assembled from direct child paths (like a real parent read).
function createFakeDb() {
  const store = new Map();
  const read = (path) => {
    if (store.has(path)) return structuredClone(store.get(path));
    const children = [...store.entries()].filter(([key]) =>
      key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'));
    if (children.length === 0) return null;
    return Object.fromEntries(children.map(([key, value]) => [key.slice(path.length + 1), structuredClone(value)]));
  };
  return {
    store,
    ref: (path) => ({
      async set(value) {
        for (const key of [...store.keys()]) if (key === path) store.delete(key);
        store.set(path, structuredClone(value));
      },
      async once() { return { val: () => read(path) }; }
    })
  };
}

function createFakeLedger() {
  const chain = new Map();
  let txCounter = 0;
  return {
    enabled: true,
    chain,
    anchorCalls: 0,
    failNext: false,
    readFails: false,
    async anchor({ recordId, batchKey, recordType, dataHash }) {
      this.anchorCalls += 1;
      if (this.failNext) {
        this.failNext = false;
        const error = new Error('internal detail https://rpc.example/key=SECRET');
        error.shortMessage = 'execution reverted';
        throw error;
      }
      chain.set(recordId, { dataHash, batchKey, recordType });
      txCounter += 1;
      return { txHash: `0x${txCounter.toString(16).padStart(64, '0')}`, blockNumber: 100 + txCounter };
    },
    async getOnChain(recordId) {
      if (this.readFails) throw new Error('rpc down');
      const record = chain.get(recordId);
      return record
        ? { exists: true, dataHash: record.dataHash, timestamp: 1700000000, submitter: '0xabc' }
        : { exists: false, dataHash: null, timestamp: 0, submitter: null };
    },
    explorerUrl: (txHash) => `https://explorer.test/tx/${txHash}`
  };
}


module.exports = { createFakeDb, createFakeLedger };
