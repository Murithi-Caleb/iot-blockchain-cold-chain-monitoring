# 10_Blockchain: integrity anchoring for cold-chain records

This folder holds the `ColdChainRegistry` smart contract (Solidity, Hardhat) that supports **Objective 2**: secure, tamper-resistant storage of critical cold-chain records. The backend (`07_Backend/blockchain/`) and the traceability page (`08_Frontend`) use it.

## Design in one page

**Off-chain/on-chain split.** Detailed data stays in Firebase. Only a 32-byte SHA-256 fingerprint of each selected record goes on the blockchain.

| Stays in Firebase (off-chain) | Anchored on the blockchain (fingerprint only) |
|---|---|
| Batch details; every temperature/humidity reading | One hash per batch registration |
| Anchoring status and transaction hash (`BLOCKCHAIN_RECORD/...`) | One hash per digest of many sensor readings |
| | (Reserved: cold-chain events, movement events) |

**Anchor:** record -> canonical JSON (sorted keys) -> SHA-256 -> `anchorRecord(recordId, batchKey, type, hash)`.
**Verify:** read the record from Firebase *now* -> hash it again -> read the anchored hash from the chain -> equal means **Verified**, different means **Integrity check failed**.

Why this is tamper-resistant: the contract has no update or delete function and refuses to overwrite a record ID. Someone who edits Firebase later cannot make the old fingerprint match, and cannot change the chain.

**Design decisions to cite in your report**
- *Hashes, not data:* raw readings arrive every few seconds; on-chain storage is slow and costly, and data on a public chain is public. Fingerprints keep cost constant and expose nothing.
- *Immutable fields only:* the batch fingerprint covers `batch_id, produce_type, quantity, source_location, registration_date` but not `status`, which changes legitimately in transit.
- *Digest of readings:* one hash covers an ordered range of readings, so editing, deleting, inserting or reordering any reading is detected. (A Merkle tree would additionally allow proving a single reading; listed as future work.)
- *Opaque IDs:* record IDs and batch keys are hashes, so batch IDs are not readable on-chain.
- *Authorised writers:* only wallets approved by the contract owner (the backend) can anchor; anyone can read.
- *Background anchoring:* a blockchain write takes seconds, so registration returns immediately and the record moves pending -> confirmed/failed. A ledger outage never blocks registering produce.

**Honest limitations (also good for the evaluation chapter)**
- The chain proves a record was **not changed after anchoring** and *when* it was anchored. It cannot prove a sensor reported the truth in the first place (garbage-in, garbage-out).
- The backend wallet is a trusted writer. Readings are only protected from the moment a digest is anchored.
- `POST /api/sensor-data` is still unauthenticated (device authentication is a planned follow-up).
- Public testnet, test funds only; not a production deployment.
- Someone with Firebase admin access could delete the `BLOCKCHAIN_RECORD` index. Verification would then report "not anchored", while the chain's `RecordAnchored` events still hold the evidence.

## Prerequisites

- Node.js 20 or 22 (LTS). Check with `node --version`.
- VS Code, ideally with the **Solidity** extension by Nomic Foundation (syntax highlighting and errors).
- For the public testnet only: MetaMask (or any wallet) to create a throwaway test account.

> Tooling note: this project uses **Hardhat 2** (pinned in `package.json`), which has reached end of life; Hardhat 3 is now the current major version. The contract is plain Solidity and the backend does not depend on Hardhat, so moving to Hardhat 3 later only means rewriting `hardhat.config.js`, the deploy script and the tests.

## Step-by-step in VS Code

Open the **project root** (the folder containing `07_Backend`, `08_Frontend`, `10_Blockchain`) in VS Code, then use **Terminal > New Terminal** (use the `+` button for extra terminals).

### 1. Install, compile and test the contract
```powershell
cd 10_Blockchain
npm install
npx hardhat compile
npx hardhat test
```
Expected: `ColdChainRegistry` shows 8 passing tests, followed by a gas table (useful numbers for your evaluation: gas per `anchorRecord`).

### 2. Run a local blockchain and deploy to it (no accounts, no internet needed)
Terminal A (leave running):
```powershell
cd 10_Blockchain
npx hardhat node
```
It prints 20 test accounts with private keys. These are public test keys; never use them anywhere real.

Terminal B:
```powershell
cd 10_Blockchain
npm run deploy:local
```
Note the printed `BLOCKCHAIN_CONTRACT_ADDRESS`.

### 3. Connect the backend
```powershell
cd 07_Backend
npm install ethers
```
Add to `07_Backend/.env` (see `.env.example` there):
```
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_CHAIN_ID=31337
BLOCKCHAIN_PRIVATE_KEY=<Account #0 private key printed by "hardhat node">
BLOCKCHAIN_CONTRACT_ADDRESS=<address from the deploy step>
```
Run the backend tests (`npm test`), then `npm start`. The log should say **Blockchain ledger enabled.** (If you restart `hardhat node`, the chain resets: redeploy, update the address, and use new batches.)

### 4. Try the full flow
1. Start the frontend (`cd 08_Frontend; npm run dev`) and sign in as an **operator**. Register a batch.
2. Sign in as a traceability user (or stay as operator) and open the batch (Operator > Produce Batches > **Monitor**). Under **Blockchain verification** the registration shows *Pending*, then **Verified**.
3. Generate readings: edit `07_Backend/mockSensor.js` so `BATCH_ID` is your batch ID, run `node mockSensor.js` for a minute, stop it.
4. As the operator, click **Anchor sensor readings**. A *Sensor readings digest* row appears and turns **Verified**.
5. **Tamper test:** in the Firebase console (Realtime Database), change a value under `ENVIRONMENTAL_READING/<batchId>/...` (e.g. a temperature) or `PRODUCE_BATCH/<batchId>/quantity`. Click **Re-verify**: the page shows **Integrity check failed**. Restore the value and it returns to **Verified**. This is your demonstration for Research Question 2.

### 5. Optional: deploy to the Polygon Amoy testnet
1. Create a **new throwaway** account in MetaMask. Never use a wallet that holds real money.
2. Add the Amoy network: chain ID `80002`, currency `POL`, RPC `https://polygon-amoy.drpc.org`, explorer `https://amoy.polygonscan.com`.
3. Get free test POL from the [Polygon faucet](https://faucet.polygon.technology/) (faucet rules change; if it is unavailable, search for another current Amoy faucet).
4. Copy `10_Blockchain/.env.example` to `10_Blockchain/.env` and fill in `DEPLOYER_PRIVATE_KEY` (0x-prefixed key exported from the throwaway account). `.env` is git-ignored; never commit it or paste the key anywhere.
5. Deploy: `npm run deploy:amoy`. Copy the printed address.
6. In `07_Backend/.env` set `BLOCKCHAIN_RPC_URL=https://polygon-amoy.drpc.org`, `BLOCKCHAIN_CHAIN_ID=80002`, `BLOCKCHAIN_CONTRACT_ADDRESS=<address>`, `BLOCKCHAIN_PRIVATE_KEY=<the same throwaway key>`, and `BLOCKCHAIN_EXPLORER_TX_URL=https://amoy.polygonscan.com/tx`.
7. Restart the backend. Transaction links in the verification table now open the block explorer. Search the contract address on the explorer to see your `RecordAnchored` events.

For a cleaner separation you can use a different wallet for the backend: put its **public** address in `BACKEND_WRITER_ADDRESS` before deploying and the script authorises it.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `npm install` peer-dependency errors | Send me the full message. Hardhat 2 plugin versions may have drifted. |
| `HH...` error about Node version | Use Node 20 or 22 LTS. |
| Deploy: "Deployer balance is 0" | Fund the wallet from the faucet and wait a minute. |
| Backend log "Blockchain ledger disabled" | One of the three `BLOCKCHAIN_*` variables is missing from `07_Backend/.env`. |
| Record shows **Failed** | Hover or read the message under the badge; usual causes are an unfunded wallet, wrong address, or a wallet that is not an authorised writer. Fix, then click **Anchor ...** again. |
| Amoy: "gas tip cap below minimum" | Set `BLOCKCHAIN_MIN_PRIORITY_FEE_GWEI=30` in `07_Backend/.env`. |
| Everything shows **Integrity check failed** after restarting `hardhat node` | The local chain was reset. Redeploy, update the address, and clear `BLOCKCHAIN_RECORD` in Firebase (or use new batches). |
| Verification says **Ledger unavailable** | Backend has no ledger configured or the RPC is unreachable. |

## Files

- `contracts/ColdChainRegistry.sol`: the registry (anchor, read, verify; owner and writers).
- `test/ColdChainRegistry.test.js`: contract tests.
- `scripts/deploy.js`: deploys and saves `deployments/<network>.json`.
- `hardhat.config.js`, `package.json`, `.env.example`, `.gitignore`.
