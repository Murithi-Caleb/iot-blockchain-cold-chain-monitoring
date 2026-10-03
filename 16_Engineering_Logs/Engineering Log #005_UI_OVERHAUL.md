# UI overhaul: change notes

Extract this zip into the project root (the folder containing `07_Backend` and `08_Frontend`),
overwriting files when asked. `serviceAccountKey.json`, `.env`, `package.json`, `firebase.js`
(frontend) and `Dashboard.jsx` are untouched. No new npm dependencies.

## Suggested branch and commits

    git checkout -b ui-overhaul
    # extract the zip, then commit in groups:
    git add 07_Backend && git commit -m "fix: align batch tests/README/forceAdmin with operator role; add GET batch endpoints"
    git add 08_Frontend/src/index.css 08_Frontend/src/App.css 08_Frontend/src/lib 08_Frontend/src/components/ui 08_Frontend/src/components/layout 08_Frontend/.env.example 08_Frontend/index.html && git commit -m "feat: establish frontend design system"
    git add 08_Frontend/src/App.jsx 08_Frontend/src/components/AuthLayout.jsx 08_Frontend/src/components/Login.jsx 08_Frontend/src/components/Signup.jsx && git commit -m "feat: redesign authentication interface"
    git add 08_Frontend/src/components/AdminDashboard.jsx && git commit -m "feat: redesign admin dashboard"
    git add 08_Frontend/src/components/OperatorDashboard.jsx 08_Frontend/src/components/BatchLabel.jsx && git commit -m "feat: redesign operator dashboard"
    git add 08_Frontend/src/components/TraceabilityDashboard.jsx 08_Frontend/src/components/TelemetryChart.jsx && git commit -m "feat: redesign traceability dashboard"

## Verify

    cd 07_Backend && npm install && npm test        # expect all tests passing
    cd ../08_Frontend && npm install && npm run build && npm run lint
    npm run dev                                      # http://localhost:5173 (backend: npm start in 07_Backend)

## Backend changes

- `POST /api/batches` stays operator-only. Stale tests that expected admin-only were rewritten
  (admin, traceability user and role-less user get 403; operator gets 201).
- New read-only endpoints (any of the three roles): `GET /api/batches`,
  `GET /api/batches/:batchId`, `GET /api/batches/:batchId/readings?limit=`.
  The `readings` endpoint was added so the traceability screen can show real recorded data for a
  batch; it is easy to remove if you prefer to keep scope to the two approved endpoints.
- `forceAdmin.js` now also sets `role: 'system_admin'` (the backend authorizes on `role`).
- README documents the batch/sensor API.

## Frontend changes

- Design system: tokens in `index.css`, components/layout in `App.css`, plain CSS, no new libraries.
- `lib/auth.js` holds the role logic moved out of `App.jsx` (same logic). `getIdToken(true)` in Login is unchanged.
- `lib/api.js`: one axios client. Base URL from `VITE_API_BASE_URL` (default `http://localhost:5000`).
  A 401 clears the session and returns to login with a message.
- QR codes now encode `<origin>/trace/<id>`. For scanning from a phone set `VITE_PUBLIC_BASE_URL`
  (see `.env.example`) to an address the phone can reach.
- New route `/trace/:batchId` (all three roles). Unauthenticated visitors go to login and are returned afterwards.
- Login no longer links to `/signup`; the route still exists.
- Admin: real user table with search, role filter, role change, enable/disable, delete (confirm dialog).
  The create form now enforces the backend's 12-character minimum and sends a real display name.
- Operator: registration form, success panel with ID + QR + **Print label**, batch list with search, reprint and Monitor links.
- Traceability: batch lookup, batch details, recorded readings chart, simulated fallback clearly badged SIMULATED.
  Swap point for live data: `useRecordedReadings` / `useSimulatedTelemetry` in `lib/telemetry.js`.
- Items for later phases appear in the sidebar as disabled "Planned" entries; no fake data is shown.

## Manual regression checklist

- [ ] Login as admin, operator, traceability user: each lands on its own workspace
- [ ] Wrong password shows an error; a user with no role is told so
- [ ] Each role is refused the other workspaces (backend returns 403 for API calls too)
- [ ] Admin: create user (12+ char password), change role, disable/enable, delete
- [ ] Operator: register batch -> ID shown, QR shown, Print label works, batch appears in list
- [ ] Traceability: look up the new batch; with `node mockSensor.js` (set BATCH_ID) readings appear as "Recorded"
- [ ] Traceability with no batch: simulated chart updates every 5 s and is badged SIMULATED
- [ ] Narrow the window to phone width: menu button opens the sidebar; tables scroll inside their panel
