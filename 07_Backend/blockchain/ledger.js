'use strict';

// Thin adapter between the application and the ColdChainRegistry contract.
// The contract object is injected, so tests use a fake and never need a blockchain.

function createLedger({ contract, explorerTxUrl = '', getOverrides = null }) {
  // Transactions from one wallet must be sent one at a time, otherwise two anchors
  // started together can reuse the same nonce and one will be rejected.
  let queue = Promise.resolve();
  const enqueue = (task) => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  return {
    enabled: true,

    // Sends the transaction and waits for it to be mined.
    anchor({ recordId, batchKey, recordType, dataHash }) {
      return enqueue(async () => {
        const overrides = getOverrides ? await getOverrides() : {};
        const tx = await contract.anchorRecord(recordId, batchKey, recordType, dataHash, overrides);
        const receipt = await tx.wait();
        return { txHash: tx.hash, blockNumber: Number(receipt.blockNumber) };
      });
    },

    // Reads a record from the chain (free; no transaction).
    async getOnChain(recordId) {
      const record = await contract.getRecord(recordId);
      if (!record.exists) {
        return { exists: false, dataHash: null, timestamp: 0, submitter: null };
      }
      return {
        exists: true,
        dataHash: record.dataHash,
        timestamp: Number(record.timestamp),
        submitter: record.submitter
      };
    },

    explorerUrl(txHash) {
      if (!explorerTxUrl || !txHash) return null;
      return `${explorerTxUrl.replace(/\/+$/, '')}/${txHash}`;
    }
  };
}

// Builds a live ledger from environment variables, or returns null when blockchain
// support is not configured (the rest of the backend then works exactly as before).
function createLedgerFromEnv(env = process.env) {
  const {
    BLOCKCHAIN_RPC_URL: rpcUrl,
    BLOCKCHAIN_PRIVATE_KEY: privateKey,
    BLOCKCHAIN_CONTRACT_ADDRESS: contractAddress
  } = env;

  if (!rpcUrl || !privateKey || !contractAddress) {
    return null;
  }

  // ethers is required lazily so tests and unconfigured deployments never load it.
  const { Contract, JsonRpcProvider, Network, Wallet, parseUnits } = require('ethers');
  const abi = require('./abi');

  const chainId = env.BLOCKCHAIN_CHAIN_ID ? Number(env.BLOCKCHAIN_CHAIN_ID) : null;
  const providerOptions = { batchMaxCount: 1 }; // public RPCs often limit batched calls
  if (chainId) {
    providerOptions.staticNetwork = Network.from(chainId); // skip repeated network detection
  }
  const provider = new JsonRpcProvider(rpcUrl, chainId || undefined, providerOptions);
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(contractAddress, abi, wallet);

  // Optional: some networks (Polygon Amoy) enforce a minimum priority fee ("gas tip").
  // If transactions fail with a "gas tip cap below minimum" error, set
  // BLOCKCHAIN_MIN_PRIORITY_FEE_GWEI (e.g. 30).
  let getOverrides = null;
  if (env.BLOCKCHAIN_MIN_PRIORITY_FEE_GWEI) {
    const minTip = parseUnits(env.BLOCKCHAIN_MIN_PRIORITY_FEE_GWEI, 'gwei');
    getOverrides = async () => {
      const fees = await provider.getFeeData();
      const tip = fees.maxPriorityFeePerGas && fees.maxPriorityFeePerGas > minTip
        ? fees.maxPriorityFeePerGas
        : minTip;
      const maxFee = fees.maxFeePerGas && fees.maxFeePerGas > tip * 2n ? fees.maxFeePerGas : tip * 2n;
      return { maxPriorityFeePerGas: tip, maxFeePerGas: maxFee };
    };
  }

  return createLedger({
    contract,
    explorerTxUrl: env.BLOCKCHAIN_EXPLORER_TX_URL || '',
    getOverrides
  });
}

module.exports = { createLedger, createLedgerFromEnv };
