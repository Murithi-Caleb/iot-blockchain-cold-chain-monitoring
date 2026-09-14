# Requirements Traceability Matrix

## 1. Purpose

This matrix connects project objectives to functional/non-functional requirements, implementation areas, verification and evidence.

## 2. Objective-Level Traceability

| Objective | Requirement Areas | Main Components | Verification |
|---|---|---|---|
| O1 Dashboard | FR-004–FR-012, FR-022–FR-025, relevant NFRs | IoT, backend, database, web dashboard | Sensor-to-dashboard test, response/update measurements |
| O2 Blockchain | FR-018–FR-021, security requirements | Backend, smart contract, Blockchain network | Transaction and integrity/tamper tests |
| O3 QR Traceability | FR-003, FR-013–FR-017, FR-023–FR-024 | Backend, database, QR interface, dashboard | QR scan and traceability-history tests |
| O4 Evaluation | Evaluation/acceptance criteria across O1–O3 | Entire system | Defined test cases, metrics and evidence |

## 3. Functional Requirement Traceability

| ID | Requirement | Objective | Verification Method | Evidence |
|---|---|---|---|---|
| FR-004 | IoT device registration | O1 | Register device test | Screenshot/database record |
| FR-005 | Temperature collection | O1 | Sensor test | Sensor output/data record |
| FR-006 | Humidity collection | O1 | Sensor test | Sensor output/data record |
| FR-007 | Data transmission | O1 | Transmission test | API/database evidence |
| FR-008 | Data storage | O1 | Persistence test | Database record |
| FR-009 | Real-time monitoring | O1 | Dashboard update test | Dashboard screenshot/video |
| FR-011 | Threshold monitoring | O1/O4 | Threshold test | Alert/test record |
| FR-012 | Environmental alerts | O1/O4 | Breach simulation | Alert evidence |
| FR-014 | Movement recording | O3 | Movement test | Event records |
| FR-015 | QR generation | O3 | Batch/QR test | Generated QR |
| FR-016 | QR scanning | O3 | Scan test | Scan/result evidence |
| FR-017 | Traceability history | O3/O4 | End-to-end batch test | Traceability timeline |
| FR-018 | Blockchain creation | O2 | Transaction test | Transaction hash |
| FR-019 | Blockchain verification | O2/O4 | Verification test | Verification result |
| FR-020 | DB/Blockchain integration | O2 | Integration test | Linked records |
| FR-021 | Integrity verification | O2/O4 | Tamper test | Detection result |

## 4. Non-Functional Traceability

Non-functional requirements shall be mapped to test cases when final quantitative targets are frozen.

Examples:
- NFR-001 → dashboard response-time test.
- NFR-002 → sensor-to-dashboard latency test.
- NFR-005 → persistence/reliability test.
- NFR-010 → usability evaluation.
- NFR-013–NFR-016 → security tests.
- NFR-020–NFR-021 → architecture/scalability review.

## 5. Evidence Rule

A requirement is considered demonstrated only when the project has recorded evidence showing the defined verification result.
