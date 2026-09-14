# Non-Functional Requirements

**Project:** IoT and Blockchain-Based Cold Chain Monitoring and Produce Traceability System  
**Version:** 1.0  
**Status:** Draft for validation

## 1. Purpose

Non-functional requirements define the quality attributes and operational characteristics expected from the system. They complement the functional requirements and provide measurable targets where practical.

## 2. Performance

### NFR-001: Dashboard Response
Normal dashboard requests should return within an agreed prototype target under the test environment.

**Initial target:** 3 seconds or less for ordinary data retrieval requests.

### NFR-002: Near-Real-Time Updates
New sensor readings should become available on the dashboard within the configured update interval plus normal network/application processing delay.

### NFR-003: API Response
Normal API operations should return within an agreed prototype target.

**Initial target:** 3 seconds or less for ordinary operations under controlled testing.

### NFR-004: Sensor Transmission
The system should process sensor readings at the configured sampling interval without systematically falling behind during normal prototype operation.

## 3. Reliability

### NFR-005: Data Persistence
Successfully received sensor and event records shall be persisted without unintended loss.

### NFR-006: Communication Failure Handling
Temporary communication failures shall not cause silent data corruption. Where technically feasible, the system should report or retry failed transmissions.

### NFR-007: Error Recovery
The system should provide recoverable error handling for database, API, sensor and Blockchain failures.

## 4. Availability

### NFR-008: Prototype Availability
The system should remain operational for the duration of planned demonstrations and evaluation sessions.

### NFR-009: Device Status
The system should distinguish unavailable/offline devices from normal environmental readings where technically feasible.

## 5. Usability

### NFR-010: Dashboard Clarity
Environmental values, alerts and monitoring status shall be understandable without requiring users to inspect raw database records.

### NFR-011: Traceability Simplicity
A user should be able to scan a valid QR code and reach the associated batch traceability information through a straightforward workflow.

### NFR-012: Feedback
The interface should provide clear feedback for successful actions, invalid input and errors.

## 6. Security

### NFR-013: Authentication Protection
Protected functions shall require authentication.

### NFR-014: Authorization
Users shall only access functions permitted by their roles.

### NFR-015: Credential Protection
Passwords and authentication secrets shall not be stored in plaintext.

### NFR-016: Integrity
Selected critical records shall have integrity protection through Blockchain and/or cryptographic references as defined by the architecture.

## 7. Maintainability

### NFR-017: Modular Design
The system should separate major concerns such as IoT ingestion, API/backend logic, database access, dashboard presentation, Blockchain interaction and QR functionality.

### NFR-018: Documentation
Major configuration, APIs and deployment procedures should be documented sufficiently for another developer to understand and maintain the prototype.

### NFR-019: Logging
Important failures and technical events should be logged to support diagnosis.

## 8. Scalability

### NFR-020: Sensor Growth
The architecture should permit additional sensors/devices without requiring a complete redesign.

### NFR-021: Data Growth
The database design should support growth in sensor and traceability records without requiring Blockchain storage of all raw telemetry.

## 9. Interoperability

### NFR-022: API Communication
System components shall communicate through defined interfaces and data formats.

### NFR-023: QR Compatibility
Generated QR codes should be readable by standard QR-capable devices/applications.

## 10. Testability

### NFR-024: Measurability
Major non-functional requirements should have measurable or observable verification methods.

## 11. Important Note

Quantitative targets marked as initial targets must be validated against the actual prototype environment before being frozen as final acceptance thresholds.
