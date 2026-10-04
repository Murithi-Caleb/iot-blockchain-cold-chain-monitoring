// Deploys ColdChainRegistry to the selected network and records the address.
//   npx hardhat run scripts/deploy.js --network localhost
//   npx hardhat run scripts/deploy.js --network amoy
//
// The deployer becomes the owner and is automatically an authorised writer. If the
// backend uses a different wallet, set BACKEND_WRITER_ADDRESS (public address only)
// and this script authorises it.
const fs = require('node:fs');
const path = require('node:path');
const hre = require('hardhat');

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployer account. Set DEPLOYER_PRIVATE_KEY in 10_Blockchain/.env for this network.');
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)}`);
  if (balance === 0n) {
    throw new Error('Deployer balance is 0. Fund the wallet with test POL from a faucet first.');
  }

  const factory = await ethers.getContractFactory('ColdChainRegistry');
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  const deploymentTx = registry.deploymentTransaction();
  console.log(`ColdChainRegistry deployed to ${address}`);

  const writer = process.env.BACKEND_WRITER_ADDRESS;
  if (writer && ethers.isAddress(writer) && writer.toLowerCase() !== deployer.address.toLowerCase()) {
    const tx = await registry.setWriter(writer, true);
    await tx.wait();
    console.log(`Authorised backend writer ${writer}`);
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const outputPath = path.join(__dirname, '..', 'deployments', `${network.name}.json`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        network: network.name,
        chainId,
        contract: 'ColdChainRegistry',
        address,
        deployer: deployer.address,
        deploymentTxHash: deploymentTx ? deploymentTx.hash : null,
        deployedAt: new Date().toISOString()
      },
      null,
      2
    ) + '\n'
  );
  console.log(`Saved ${path.relative(process.cwd(), outputPath)}`);

  console.log('\nAdd these to 07_Backend/.env:');
  console.log(`BLOCKCHAIN_CONTRACT_ADDRESS=${address}`);
  console.log(`BLOCKCHAIN_CHAIN_ID=${chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
