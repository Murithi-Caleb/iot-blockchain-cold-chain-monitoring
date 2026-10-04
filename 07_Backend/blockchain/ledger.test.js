'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createLedger } = require('./ledger');

function fakeContract() {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const store = new Map();
  return {
    calls,
    get maxConcurrent() { return maxActive; },
    async anchorRecord(recordId, batchKey, recordType, dataHash, overrides) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      calls.push({ recordId, batchKey, recordType, dataHash, overrides });
      const hash = `0x${String(calls.length).padStart(64, '0')}`;
      store.set(recordId, dataHash);
      return {
        hash,
        wait: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
          return { blockNumber: 100n + BigInt(calls.length) };
        }
      };
    },
    async getRecord(recordId) {
      return store.has(recordId)
        ? { exists: true, dataHash: store.get(recordId), timestamp: 1700000000n, submitter: '0xabc' }
        : { exists: false, dataHash: `0x${'0'.repeat(64)}`, timestamp: 0n, submitter: '0x0' };
    }
  };
}

describe('ledger adapter', () => {
  it('anchors, then reads the record back', async () => {
    const contract = fakeContract();
    const ledger = createLedger({ contract, explorerTxUrl: 'https://scan.test/tx/' });
    const result = await ledger.anchor({ recordId: '0x01', batchKey: '0x02', recordType: 0, dataHash: '0x03' });
    assert.equal(result.blockNumber, 101);
    assert.match(result.txHash, /^0x/);
    assert.deepEqual(
      await ledger.getOnChain('0x01'),
      { exists: true, dataHash: '0x03', timestamp: 1700000000, submitter: '0xabc' }
    );
    assert.deepEqual(await ledger.getOnChain('0xmissing'), { exists: false, dataHash: null, timestamp: 0, submitter: null });
    assert.equal(ledger.explorerUrl('0xabc'), 'https://scan.test/tx/0xabc');
  });

  it('sends transactions one at a time to avoid nonce clashes', async () => {
    const contract = fakeContract();
    const ledger = createLedger({ contract });
    await Promise.all([1, 2, 3, 4].map((n) =>
      ledger.anchor({ recordId: `0x0${n}`, batchKey: '0x00', recordType: 1, dataHash: '0x09' })));
    assert.equal(contract.calls.length, 4);
    assert.equal(contract.maxConcurrent, 1);
  });

  it('keeps working after a failed transaction', async () => {
    const contract = fakeContract();
    const original = contract.anchorRecord.bind(contract);
    let first = true;
    contract.anchorRecord = async (...args) => {
      if (first) { first = false; throw new Error('rejected'); }
      return original(...args);
    };
    const ledger = createLedger({ contract });
    await assert.rejects(ledger.anchor({ recordId: '0x01', batchKey: '0x00', recordType: 0, dataHash: '0x01' }));
    const ok = await ledger.anchor({ recordId: '0x02', batchKey: '0x00', recordType: 0, dataHash: '0x02' });
    assert.ok(ok.txHash);
  });

  it('applies fee overrides when configured and returns null explorer URL otherwise', async () => {
    const contract = fakeContract();
    const ledger = createLedger({ contract, getOverrides: async () => ({ maxPriorityFeePerGas: 30n }) });
    await ledger.anchor({ recordId: '0x01', batchKey: '0x00', recordType: 0, dataHash: '0x01' });
    assert.deepEqual(contract.calls[0].overrides, { maxPriorityFeePerGas: 30n });
    assert.equal(ledger.explorerUrl('0xabc'), null);
  });
});
