# Backend

The API uses Firebase Authentication for user credentials and Firebase Realtime Database for application records. Passwords are handled by Firebase Authentication and are not stored in the Realtime Database.

## Configuration

Set `FIREBASE_DATABASE_URL` to the project's Realtime Database URL. Authenticate the Firebase Admin SDK using either:

- `FIREBASE_SERVICE_ACCOUNT_PATH`, pointing to a local service-account JSON file; or
- Application Default Credentials, for example with `GOOGLE_APPLICATION_CREDENTIALS` set in a local development environment.

The default service-account path is `07_Backend/serviceAccountKey.json`. Keep service-account files and `.env` files out of version control. `PORT` is optional and defaults to `5000`.

Enable the Email/Password sign-in provider in Firebase Authentication. Create the first user in Firebase Authentication, then grant that existing account the initial administrator role by running:

```powershell
npm run bootstrap-admin -- <firebase-auth-uid>
```

Run this command from `07_Backend`. It uses the configured Admin SDK credentials, preserves other custom claims, and does not expose an endpoint for unauthenticated administrator promotion.

## Authentication and roles

Clients sign users in and out with the Firebase client SDK. For protected API calls, send the resulting Firebase ID token as:

```text
Authorization: Bearer <firebase-id-token>
```

The API verifies token revocation and disabled-account status. User roles are held in Firebase Authentication custom claims:

- `system_admin`
- `supply_chain_operator`
- `authorized_traceability_user`

Role changes revoke the affected user's refresh tokens, and every protected request checks revocation. The user must sign in again to obtain a token with the new role. The backend does not accept role values from an unverified request or trust role fields in request bodies for authorization.

## System administrator API

All `/api/admin/*` routes require a valid `system_admin` token.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/auth/me` | Return the authenticated user's ID, email, display name, and role. |
| `GET` | `/api/admin/users` | List Firebase Authentication users. Supports the optional `page_token` query parameter. |
| `POST` | `/api/admin/users` | Create a user with `email`, `display_name`, `password`, and `role`. Passwords must be 12–128 characters and are never returned by the API. |
| `PATCH` | `/api/admin/users/:uid` | Update `email`, `display_name`, `role`, and/or `disabled`. |
| `DELETE` | `/api/admin/users/:uid` | Delete a user account. |

The API prevents an administrator from removing their own admin access and prevents disabling, demoting, or deleting the last active administrator. Email changes mark the address unverified. Firebase Authentication validates email addresses and account credentials. Administrative user changes are logged without passwords or email addresses.

## Batch and sensor API

| Method | Route | Required role | Purpose |
|---|---|---|---|
| `POST` | `/api/batches` | `supply_chain_operator` | Register a produce batch (`produce_type`, `quantity`, `source_location`). Returns the generated `traceability_id`. |
| `GET` | `/api/batches` | any application role | List registered batches, newest first (capped at 200). |
| `GET` | `/api/batches/:batchId` | any application role | Look up one batch by traceability ID (`BATCH-<digits>`). Returns 404 if unknown. |
| `GET` | `/api/batches/:batchId/readings` | any application role | Most recent environmental readings for the batch, oldest to newest. Optional `limit` (default 50, max 500). |
| `POST` | `/api/sensor-data` | none (unchanged) | Ingest a `device_id`, `batch_id`, `temperature`, `humidity` reading. |

Batch registration is restricted to supply chain operators; system administrators and traceability users receive `403`. Reading batches is allowed for all three application roles; users with no role receive `403`.

Sensor ingestion remains unauthenticated in this implementation slice; device authentication and device registration are separate follow-up work.

## Blockchain integrity layer

Raw data stays in Firebase. Only SHA-256 fingerprints of selected critical records are written to the `ColdChainRegistry` smart contract (see `10_Blockchain`). Verification re-hashes the current database contents and compares the result with the fingerprint stored on-chain.

Enable it by installing the one extra dependency and setting the variables in `.env.example`:

```powershell
npm install ethers
```

If `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY` and `BLOCKCHAIN_CONTRACT_ADDRESS` are not all set, the server logs "Blockchain ledger disabled" and every other endpoint behaves as before.

| Method | Route | Required role | Purpose |
|---|---|---|---|
| `POST` | `/api/batches/:batchId/anchor` | `supply_chain_operator` | Start (or retry) anchoring the batch registration fingerprint. Returns `202`; anchoring continues in the background. New batches are anchored automatically. |
| `POST` | `/api/batches/:batchId/readings-digest` | `supply_chain_operator` | Anchor one fingerprint covering the batch's recorded sensor readings (latest 1000). Returns `400` if there are none. |
| `GET` | `/api/batches/:batchId/verification` | any application role | Recompute fingerprints and compare with the chain. Returns an overall status and per-record details with transaction links. |

Verification statuses: `verified`, `tampered` (database no longer matches the chain, or the chain record is missing), `partial`, `pending`, `failed`, `not_anchored`, `unavailable` (ledger not configured or unreachable).

Firebase layout added: `BLOCKCHAIN_RECORD/{batchId}/{recordKey}` stores anchoring status, the fingerprint and the transaction hash. It is an index for the UI only; verification never trusts it.

Code map: `blockchain/canonical.js` (deterministic hashing), `blockchain/ledger.js` (ethers adapter), `blockchain/service.js` (anchor/verify logic), `blockchain/abi.js` (contract ABI).

## Cold-chain monitoring: thresholds, events and alerts

Each batch is checked against a **threshold profile** (acceptable temperature and humidity range) chosen by its produce type: a profile whose key is the slug of the produce type (`Avocados` -> `avocados`), else the stored `default` profile, else a built-in 2-6 °C / 85-95 % placeholder. No produce-specific ranges are shipped; an administrator enters them (cite your source in the report).

Every reading posted to `/api/sensor-data` is evaluated in the background after it is stored (a failure here never rejects a reading). An **excursion** is a continuous period outside the range for one metric and direction. It opens an **event** (`COLD_CHAIN_EVENT/{batchId}/{eventId}`), tracks the peak, and resolves after 2 consecutive in-range readings. Severity is `warning` up to 2 °C / 5 % beyond the limit and `critical` beyond it. Resolved events are anchored on the blockchain automatically (record type 2); open events are not, because they are still changing.

| Method | Route | Role | Purpose |
|---|---|---|---|
| `GET` | `/api/thresholds` | any app role | Default and produce profiles. |
| `PUT` | `/api/thresholds/:profileKey` | `system_admin` | Create/update a profile (`default` or a produce slug). Body: `produce_type`, `temperature_min/max`, `humidity_min/max`. |
| `DELETE` | `/api/thresholds/:profileKey` | `system_admin` | Remove a produce profile (the default cannot be deleted). |
| `GET` | `/api/events?status=&limit=` | any app role | Events across batches, newest first. `status`: `all`, `open`, `resolved`, `unacknowledged`, `attention`. |
| `GET` | `/api/batches/:batchId/events` | any app role | Events of one batch. |
| `GET` | `/api/batches/:batchId/thresholds` | any app role | The limits that apply to the batch and where they come from. |
| `POST` | `/api/batches/:batchId/events/:eventId/acknowledge` | `supply_chain_operator` | Acknowledge an alert (optional `note`, 280 chars). |
| `POST` | `/api/batches/:batchId/events/anchor` | `supply_chain_operator` | Anchor/retry all resolved events (needs the ledger). |

Hashed event fields: id, batch, type, direction, severity, start/end, limits, unit, peak value/time, reading count, device. Acknowledgements and notes are not hashed (they change legitimately).

Demo the alerts with the simulator, which now takes the batch ID as an argument:

```powershell
node mockSensor.js BATCH-1790981450938 --spike --interval=3
```

Limitations: a sensor that goes silent mid-excursion leaves its event open (device-offline detection is not built); `/api/sensor-data` is still unauthenticated.

## Admin bootstrap scripts

`bootstrapAdmin.js` (preferred, via `npm run bootstrap-admin`) and `forceAdmin.js` both grant the initial administrator. The backend authorizes on the `role` custom claim, so `forceAdmin.js` now sets `role: 'system_admin'` as well as the legacy boolean `system_admin` flag. `forceAdmin.js` contains a hard-coded UID; edit it before use and never commit service-account files.

## Run and test

```powershell
npm install
npm test
npm start
```

The backend tests use Firebase Auth and database fakes, so they do not require project credentials or write to a live Firebase project.
