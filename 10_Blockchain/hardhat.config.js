require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

const { AMOY_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // "paris" avoids opcodes (e.g. PUSH0) that some EVM chains/testnets lack.
      evmVersion: 'paris'
    }
  },
  networks: {
    // `npx hardhat node` in a separate terminal; uses that node's funded test accounts.
    localhost: { url: 'http://127.0.0.1:8545' },
    // Polygon Amoy testnet (chain ID 80002). Needs a funded deployer wallet.
    amoy: {
      url: AMOY_RPC_URL || 'https://polygon-amoy.drpc.org',
      chainId: 80002,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : []
    }
  }
};
