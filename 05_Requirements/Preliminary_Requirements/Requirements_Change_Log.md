# Requirements Change Log

## 1. Purpose

This document records controlled changes to the requirements baseline.

## 2. Baseline History

### Version 1.0 — Initial Requirements Baseline
**Status:** Superseded

The initial requirements were organized around five specific objectives, including a separate IoT objective.

### Version 2.0 — Revised Requirements Baseline
**Status:** Current working baseline

The requirements were revised following supervisor consultation and approval of four specific objectives.

## 3. Major Change

### Change: Five Objectives → Four Objectives

**Previous structure:**
1. IoT-based monitoring.
2. Web dashboard.
3. Blockchain.
4. QR traceability.
5. Evaluation.

**Approved structure:**
1. Web dashboard using environmental conditions collected by IoT sensors.
2. Blockchain for secure and tamper-resistant cold-chain records.
3. QR-code-based produce traceability.
4. System evaluation.

## 4. Impact of the Change

The change does **not** remove IoT functionality.

Instead, IoT sensing is treated as a supporting subsystem for Objective 1.

The following were therefore retained:
- sensor registration;
- temperature collection;
- humidity collection;
- sensor transmission;
- environmental storage;
- device status;
- threshold monitoring.

Objective references were renumbered so that:
- old Objective II → Objective 1;
- old Objective III → Objective 2;
- old Objective IV → Objective 3;
- old Objective V → Objective 4.

## 5. Blockchain Data Strategy Change

The requirements clarify that high-frequency raw sensor data should not automatically be stored directly on Blockchain.

Operational data remains in the primary database while selected integrity-sensitive records/proofs may be anchored on Blockchain.

## 6. Change Control Procedure

Future changes should record:
1. affected requirement;
2. reason;
3. affected objective;
4. implementation impact;
5. testing impact;
6. scope impact;
7. decision;
8. date;
9. approving authority where applicable.
