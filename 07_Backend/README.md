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

## Admin bootstrap scripts

`bootstrapAdmin.js` (preferred, via `npm run bootstrap-admin`) and `forceAdmin.js` both grant the initial administrator. The backend authorizes on the `role` custom claim, so `forceAdmin.js` now sets `role: 'system_admin'` as well as the legacy boolean `system_admin` flag. `forceAdmin.js` contains a hard-coded UID; edit it before use and never commit service-account files.

## Run and test

```powershell
npm install
npm test
npm start
```

The backend tests use Firebase Auth and database fakes, so they do not require project credentials or write to a live Firebase project.
