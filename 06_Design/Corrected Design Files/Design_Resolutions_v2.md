# Design Resolutions v2 — Engineering Decision Record

**Project:** A Blockchain-Enabled IoT System for Produce Traceability and Cold Chain Monitoring for Kenya's Horticultural Export Industry
**Student:** Murithi Caleb (C026-01-0762/2023)
**Date:** 2 October 2026
**Baseline affected:** Requirements v2.0 (Revised Baseline), UML/ERD/Flowchart set of 29–30 Sep 2026
**Status:** Proposed — to be approved by supervisor before implementation of Objective 2

## 1. Purpose

Cross-checking the Use Case, Sequence, Activity, DFD Level 1, ERD and Flowchart artefacts showed that they disagree on several points. Per the *Change Control Procedure* in `Requirements_Change_Log.md` (§6), each resolution below records the reason, affected objective, impact and decision, so that implementation proceeds against a single consistent baseline.

## 2. Summary

| ID | Conflict | Decision | Objective |
|----|----------|----------|-----------|
| DR-01 | Threshold evaluation: ESP32 (Activity) vs backend (Sequence, DFD 2.5, Flowchart) | Backend evaluates thresholds | 1 |
| DR-02 | Activity diagram anchors every stored reading on-chain | Events only; never raw readings | 2 |
| DR-03 | Alerts → blockchain: Flowchart yes, Sequence no | Yes, once per excursion (open and close) | 1, 2 |
| DR-04 | "Consortium nodes" vs planned Polygon Amoy | Public testnet; hashes and opaque IDs only on-chain | 2 |
| DR-05 | `Login «include» Store & Verify Blockchain Records` | Re-attach the include to the record-creating use cases | 2 |
| DR-06 | Activity diagram: swapped Yes/No labels, mislabelled start nodes | Corrected in `Activity_Diagram_v2.puml` | — |
| DR-07 | ERD lacks ALERT, THRESHOLD_PROFILE, DEVICE_ASSIGNMENT; cannot anchor movements | ERD v2 | 1, 2, 3 |

Two further consistency fixes arise from these decisions: the Sequence Diagram must stop sending a Batch ID from the device (DR-07), and the data model gains a few attributes (see §10).

---

## DR-01 — Threshold evaluation runs in the backend

**Conflict.** The Activity Diagram has the ESP32 test "Temperature/Humidity > Threshold?" and trigger the alert. The Sequence Diagram (step 9), DFD process 2.5 and the Monitoring Flowchart all place evaluation in the backend.

**Decision.** The backend is the single authority for threshold evaluation. The device samples, timestamps and transmits. It may perform *sensor sanity filtering* (discard NaN / DHT22 error values) and buffer readings while offline, but it holds no threshold logic.

**Rationale.**
- Thresholds are configured per produce type by the Admin (DFD flow 1.0 → 2.5). A device-side copy would go stale.
- Alert state (open/closed, hysteresis) requires history that a stateless microcontroller loop does not keep.
- Evaluating in one place makes the behaviour testable (Acceptance A5) and keeps the firmware simple.

**Impact.** Activity Diagram corrected. Firmware requirement HW/FR-007 is unchanged (periodic transmission).

---

## DR-02 — Only discrete events are anchored; never raw readings

**Conflict.** The Activity Diagram creates a hashed blockchain transaction after every "Store Data in Off-Chain Database", which contradicts CON-005, Assumption 8, the Data Storage Principle and the Change Log §5.

**Decision.** The following are the only anchorable record types:

| `record_type` | Trigger |
|---|---|
| `BATCH_REGISTERED` | Operator registers a batch |
| `MOVEMENT` | Operator records a movement |
| `COLD_CHAIN_EVENT` | Operator records a cold-chain event |
| `EXCURSION_OPENED` | Alert opens (DR-03) |
| `EXCURSION_CLOSED` | Alert closes (DR-03), including summary statistics |
| `BATCH_CLOSED` *(Should-have)* | Batch delivered; payload includes a Merkle root of the batch's readings so off-chain telemetry can be proven unaltered without storing it on-chain |

**Rationale.** Meets the cost/latency constraint (CON-005) while preserving verifiability. The Merkle root is the mechanism that links raw off-chain readings to an on-chain commitment.

---

## DR-03 — One alert (and one pair of anchored events) per excursion

**Conflict.** The Monitoring Flowchart sends threshold violations to the blockchain; the Sequence Diagram does not. At a 10-second interval, anchoring every breaching reading would produce hundreds of transactions for one fault.

**Decision.** Model an *excursion* as a state machine per (batch, parameter):

```
IN_RANGE --(N consecutive breaches)--> OPEN --(M consecutive in-range)--> CLOSED
```

- `N = breach_confirmations` (default 2) filters single-sample sensor glitches.
- `M = recovery_confirmations` (default 3) prevents flapping at the boundary.
- While OPEN, further breaching readings update the same `ALERT` (peak value, breach count, last-seen) and **do not** create new events.
- Opening creates an `ALERT` row, a `COLD_CHAIN_EVENT` (type `TEMPERATURE_EXCURSION` / `HUMIDITY_EXCURSION`) and anchors `EXCURSION_OPENED`. Closing anchors `EXCURSION_CLOSED` with duration and peak value.
- The operator can acknowledge an alert (`ACKNOWLEDGED`); acknowledgement is an application action and is not anchored.

**Impact.** `N` and `M` are stored in `THRESHOLD_PROFILE` (DR-07) so they can be tuned and cited in evaluation.

---

## DR-04 — Public testnet, not a consortium chain

**Conflict.** The Activity Diagram shows "Validate Transaction by Consortium Nodes". The Hardware & Software Requirements §4 and the project plan specify Polygon Amoy, a public permissionless test network.

**Decision.** Treat the blockchain as a public testnet. The activity diagram is relabelled; the network's internal steps (validation, adding a block) are replaced by what the *system* observes: submit transaction → await confirmation → record reference or mark failed for retry.

**Consequences to carry forward.**
- Everything on a public chain is world-readable and effectively permanent. Store only hashes, opaque identifiers and event-type codes — never names, contact details, or commercial terms. Use opaque batch IDs (not guessable sequences) and consider a per-record salt in the hashed payload.
- Personal data stays off-chain, which also avoids conflict with erasure expectations under data-protection law (e.g. Kenya's Data Protection Act, 2019).
- Smart-contract write access is restricted to the backend's wallet (SEC-012).
- Record the final network choice in the decision log before deployment (H&S Requirements §4). Keep a local Hardhat network as the fallback.

---

## DR-05 — Correct the `«include»` relationship in the Use Case Diagram

**Conflict.** `Login «include» Store & Verify Blockchain Records` states that every login stores or verifies a blockchain record. That is not the behaviour specified anywhere else.

**Decision.** In `UML Use Case Diagram.mdj` (StarUML):
1. Delete the `«include»` from **Login** to **Store & Verify Blockchain Records**.
2. Add `«include»` from each of **Manage Produce Batches**, **Track Produce Movement** and **Record Cold Chain Events** to **Store & Verify Blockchain Records**.
3. Add an `«extend»` from **Store & Verify Blockchain Records** to **Monitor Environmental Conditions**, with the condition "excursion opened or closed" (anchoring occurs only on that condition).
4. Optionally add `«include» Login` from the protected use cases, or state in the diagram note that all use cases other than IoT submission require authentication.

*(The `.mdj` is a binary-style StarUML model; this edit must be made in StarUML. Re-export `UseCaseDiagram.png` afterwards.)*

---

## DR-06 — Activity Diagram corrections

Corrected in `UML/Activity_Diagram_v2.puml`:

1. "Is Transaction Valid?" had Yes/No on the wrong branches; labels fixed.
2. Threshold evaluation moved from the IoT lane to the System lane (DR-01).
3. Per-reading blockchain transaction removed; replaced with event anchoring (DR-02, DR-03).
4. "Consortium nodes" wording removed (DR-04); blockchain lane now shows submit / confirm / fail-retry.
5. "Attach IoT Device to Batch" now writes a `DEVICE_ASSIGNMENT`; the device no longer needs a batch ID.
6. Stray brackets in action labels (e.g. `[Create Produce Batch]`) removed, since brackets denote guards in UML.
7. The monitoring loop now terminates when the batch is closed or the device is unassigned.

---

## DR-07 — ERD v2: new entities and revised relationships

**Gaps found**

| Gap | Evidence |
|---|---|
| No `ALERT` entity | DR-008 in Data Requirements; Sequence step 10 "Record Alert" |
| No threshold configuration | DFD flow "Configured temperature/humidity thresholds"; Flowchart "Retrieve thresholds for batch" |
| No device↔batch association | Activity "Attach IoT Device to Batch"; DFD 2.3 |
| `BLOCKCHAIN_RECORD` can reference only a traceability record or a cold-chain event, so **movements cannot be anchored** | ERD v1 |
| `password` stored as a plain attribute | SEC-003 / NFR-015 require non-plaintext secrets |
| `IOT_DEVICE` has no key, last-seen or sampling configuration | FR-004, FR-025, DFD "device configuration" |
| `PRODUCE_BATCH` lacks `destination` and variety/grade | DR-002 |

**Decisions**

1. Add **`THRESHOLD_PROFILE`**, **`DEVICE_ASSIGNMENT`**, **`ALERT`**.
2. Generalise **`BLOCKCHAIN_RECORD`** with `record_type` + `record_ref_id` (polymorphic reference, validated in the service layer) instead of two foreign keys.
3. The device sends **no batch ID**. The backend resolves the batch from the device's active `DEVICE_ASSIGNMENT`. Readings from a device with no active assignment are stored with `batch_id = null` (not discarded) and flagged for review.
4. **Prototype constraint:** a device may have **one active assignment at a time** (enforced in the service layer, not the schema). The schema is many-to-many so that a reefer-container-with-multiple-batches model can be added later. Record this as a limitation in the report (Assumption 6, batch-level QR).
5. `USER.password` → `password_hash` (bcrypt/argon2); add `status`.
6. QR images are generated on demand. Persist only an opaque `qr_id` and `qr_status` in `TRACEABILITY_RECORD`.

See `ERD/ERD_v2.puml` for the full model and §10 for attributes.

---

## 10. Data dictionary additions (summary)

| Entity | New / changed attributes |
|---|---|
| `USER` | `password_hash`, `status` (ACTIVE / INACTIVE) |
| `IOT_DEVICE` | `api_key_hash`, `sampling_interval_sec`, `last_seen_at`, `status` (ACTIVE / INACTIVE), `created_by` |
| `PRODUCE_BATCH` | `variety_grade`, `destination`; `status` ∈ REGISTERED / IN_STORAGE / IN_TRANSIT / DELIVERED |
| `ENVIRONMENTAL_READING` | `batch_id` nullable, `assignment_id`, `recorded_at` (device time), `received_at` (server time) |
| `THRESHOLD_PROFILE` | `produce_type` (unique), `min_temperature`, `max_temperature`, `min_humidity`, `max_humidity`, `breach_confirmations`, `recovery_confirmations`, `updated_by`, `updated_at` |
| `DEVICE_ASSIGNMENT` | `device_id`, `batch_id`, `assigned_at`, `unassigned_at` (null = active), `assigned_by` |
| `ALERT` | `batch_id`, `device_id`, `parameter`, `threshold_min`, `threshold_max` (snapshot at open), `peak_value`, `breach_count`, `status` (OPEN / ACKNOWLEDGED / CLOSED), `opened_at`, `closed_at`, `acknowledged_by`, `acknowledged_at`, `event_id` |
| `BLOCKCHAIN_RECORD` | `record_type`, `record_ref_id`, `payload_hash`, `network`, `contract_address`, `transaction_hash`, `status` (PENDING / CONFIRMED / FAILED), `attempts`, `submitted_at`, `confirmed_at`, `verification_status` |

### Firebase RTDB path mapping (relational → tree)

| Entity | Path | Notes |
|---|---|---|
| USER | `USER/{user_id}` | Index `username` via `.indexOn` |
| IOT_DEVICE | `IOT_DEVICE/{device_id}` | Never store the raw key |
| THRESHOLD_PROFILE | `THRESHOLD_PROFILE/{produce_type}` | Key = produce type |
| PRODUCE_BATCH | `PRODUCE_BATCH/{batch_id}` | Opaque UUID-based ID |
| DEVICE_ASSIGNMENT | `DEVICE_ASSIGNMENT/{assignment_id}` + `ACTIVE_ASSIGNMENT/{device_id} → assignment_id` | The second node is a deliberate denormalisation for O(1) ingest lookup |
| ENVIRONMENTAL_READING | `ENVIRONMENTAL_READING/{batch_id}/{push_id}` | `push()` keys; unassigned readings go to `UNASSIGNED_READING/{device_id}/{push_id}` |
| ALERT | `ALERT/{alert_id}` + `OPEN_ALERT/{batch_id}_{parameter}` | Open-alert index supports the excursion state machine |
| COLD_CHAIN_EVENT, PRODUCE_MOVEMENT | `…/{batch_id}/{event_id}` | Per-batch for chronological retrieval |
| BLOCKCHAIN_RECORD | `BLOCKCHAIN_RECORD/{id}` | Index `status` for retry worker |

RTDB rules: **deny all client reads/writes**; the backend (Admin SDK) is the only accessor (IR-010).

---

## 11. Approval and follow-up

| Item | Owner | Status |
|---|---|---|
| Supervisor review of DR-01 → DR-07 | Student / Supervisor | Pending |
| Re-export Activity, Sequence, ERD, Use Case images from the v2 sources | Student | Pending |
| Append summary to `Requirements_Change_Log.md` (v2.1) | Student | Pending |
| Add `ALERT`, `THRESHOLD_PROFILE`, `DEVICE_ASSIGNMENT` to the Requirements Traceability Matrix | Student | Pending |
| Begin implementation (foundation + System Admin flow) | Student / Claude | After sign-off |

### Suggested Change Log entry (v2.1)

> **Version 2.1 — Design consistency resolutions.** Seven inconsistencies between design artefacts were resolved (DR-01 to DR-07; see `Design_Resolutions_v2.md`). Requirements themselves are unchanged; the architecture decisions clarify that threshold evaluation is backend-side, that only discrete events are anchored on a public testnet, and that the data model gains `ALERT`, `THRESHOLD_PROFILE` and `DEVICE_ASSIGNMENT`. Testing impact: Acceptance criteria A5, A6 and A9 now reference the excursion state machine and event-based anchoring.
