# Acceptance and Evaluation Criteria

## 1. Purpose

This document defines how the project will determine whether the implemented system satisfies its requirements and supports Objective 4.

## 2. Objective 1 — Dashboard Evaluation

### A1: Sensor Data Availability
**Criterion:** Valid temperature and humidity readings are received by the backend.

### A2: Dashboard Display
**Criterion:** The latest valid readings are displayed correctly.

### A3: Near-Real-Time Update
**Criterion:** New readings appear within the defined prototype update target.

### A4: Historical Monitoring
**Criterion:** Previously stored readings can be retrieved and visualized.

### A5: Alert Function
**Criterion:** A configured environmental threshold breach produces the expected alert.

## 3. Objective 2 — Blockchain Evaluation

### A6: Record Creation
**Criterion:** A selected critical event produces a verifiable Blockchain transaction/reference.

### A7: Record Linking
**Criterion:** The application can associate the Blockchain reference with the corresponding application record.

### A8: Integrity Verification
**Criterion:** The system can verify the integrity of a protected record.

### A9: Tamper Detection
**Criterion:** A deliberately modified protected record is detected as inconsistent with its original integrity reference.

## 4. Objective 3 — Traceability Evaluation

### A10: Batch Registration
**Criterion:** A batch receives a unique identifier.

### A11: QR Generation
**Criterion:** A valid QR code is generated for the correct batch.

### A12: QR Retrieval
**Criterion:** Scanning the QR code retrieves the correct batch.

### A13: Movement History
**Criterion:** Recorded movement events appear in chronological order.

### A14: Traceability Completeness
**Criterion:** The user can determine the recorded origin, relevant movement/storage/transport events and current/final recorded destination.

## 5. Objective 4 — Overall Evaluation

Evaluation should include:
- correctness;
- reliability;
- response time;
- data transmission performance;
- dashboard responsiveness;
- Blockchain integrity;
- QR traceability accuracy;
- requirement compliance.

## 6. Evidence

Acceptable evidence may include:
- screenshots;
- test logs;
- database records;
- API responses;
- sensor output;
- Blockchain transaction hashes;
- verification results;
- QR scans;
- performance measurements;
- evaluation forms/results.

## 7. Final Acceptance Principle

A feature should not be considered successfully implemented merely because it exists in source code. It must be demonstrated through an appropriate test and recorded evidence.
