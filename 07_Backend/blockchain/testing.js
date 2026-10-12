'use strict';

// Shared in-memory fakes for the blockchain tests: a Realtime Database stand-in and a
// ledger stand-in. They let the anchoring/verification logic and the API routes be
// tested without Firebase or a blockchain.

// Minimal Realtime Database fake. `store` is a flat Map of exact paths to values (tests may
// read and edit it directly to simulate tampering). Reading a path returns its exact value,
// or an object assembled from every deeper path, like a parent read in the real database.
function createFakeDb() {
  const store = new Map();
  const read = (path) => {
    if (store.has(path)) return structuredClone(store.get(path));
    const prefix = `${path}/`;
    const descendants = [...store.entries()].filter(([key]) => key.startsWith(prefix));
    if (descendants.length === 0) return null;
    const result = {};
    for (const [key, value] of descendants) {
      const parts = key.slice(prefix.length).split('/');
      let node = result;
      for (const part of parts.slice(0, -1)) {
        node[part] = node[part] || {};
        node = node[part];
      }
      node[parts[parts.length - 1]] = structuredClone(value);
    }
    return result;
  };
  const clear = (path) => {
    for (const key of [...store.keys()]) {
      if (key === path || key.startsWith(`${path}/`)) store.delete(key);
    }
  };
  return {
    store,
    ref: (path) => ({
      async set(value) {
        clear(path);
        store.set(path, structuredClone(value));
      },
      async remove() { clear(path); },
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
      await new Promise((resolve) => setTimeout(resolve, 1)); // mining takes time
      if (this.failNext) {
        this.failNext = false;
        const error = new Error('internal detail https://rpc.example/key=SECRET');
        error.shortMessage = 'execution reverted';
        throw error;
      }
      // Like the real contract: a record ID can only be anchored once.
      if (chain.has(recordId)) {
        const error = new Error('internal detail');
        error.shortMessage = 'execution reverted: RecordAlreadyExists';
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
