Requirements Engineering

**Project:** A Blockchain-Enabled IoT System for Produce Traceability and Cold Chain Monitoring for Kenya's Horticultural Export Industry

**Mission:** #002 — Requirements Engineering

**Date:** 2026-09-12

**Status:** In Progress

---

## 1. Mission Objective

To translate the four approved project objectives into a structured requirements baseline that will guide system analysis, design, implementation, testing, evaluation, and documentation.

---

## 2. Starting Point

Mission #001 established the project's Objective-to-System Traceability Matrix.

The four approved specific objectives are:

1. Web-based dashboard for real-time visualization of environmental conditions collected by IoT sensors.
2. Blockchain implementation for secure and tamper-resistant cold-chain records.
3. QR-code-based produce traceability.
4. Evaluation of the effectiveness of the proposed system.

### Important Objective Decision

The IoT component is **not treated as a separate specific objective**.

IoT sensing is an enabling component supporting Objective 1.

This decision was made following supervisor/lecturer guidance that the IoT objective substantially repeated the general objective and that the project should have a maximum of four clearly demonstrable specific objectives.

---

## 3. Work Completed

### 3.1 Functional Requirements

Initial functional requirements were derived for:

- IoT temperature and humidity capture.
- Sensor data transmission.
- Sensor data storage.
- Dashboard visualization.
- Historical environmental data.
- Threshold-breach detection.
- Critical cold-chain events.
- Hash generation.
- Blockchain recording.
- Blockchain verification.
- Tamper detection.
- Produce batch creation.
- Unique batch identification.
- QR-code generation.
- QR-code scanning.
- Batch retrieval.
- Supply-chain checkpoints.
- Traceability history.
- Linking environmental records to batches.
- Linking blockchain records to batches.
- System evaluation.

### 3.2 Non-Functional Requirements

Initial requirements were identified for:

- Performance.
- Security.
- Usability.
- Reliability.
- Maintainability.
- Scalability.

These will be documented separately from the mission log.

### 3.3 Data Requirements

Initial data categories were identified:

- Sensor data.
- Produce batch data.
- Supply-chain event data.
- Blockchain data.
- QR/batch identification data.

### 3.4 Hardware and Software Requirements

The preliminary technology baseline includes:

- ESP32.
- DHT22.
- Arduino/ESP32 development environment.
- Firebase/off-chain storage.
- Web dashboard.
- Solidity.
- Hardhat.
- ethers.js.
- Polygon Amoy.
- QR-code generation library.
- Git/GitHub.

These remain subject to validation and final design decisions.

---

## 4. Key Engineering Decisions

### Decision 1 — Four Specific Objectives

The project will proceed using four specific objectives.

The IoT component remains part of the system architecture but is not a fifth specific objective.

### Decision 2 — Off-Chain Sensor Data + Blockchain Anchoring

High-frequency sensor telemetry will not be stored directly on the blockchain.

The intended architecture is:

Sensor Data
→ Off-Chain Database
→ Critical Event/Record
→ Hash
→ Blockchain

This reduces unnecessary blockchain transactions while preserving integrity verification for important records.

### Decision 3 — QR as a Traceability Identifier

The QR code will primarily identify or provide access to a produce batch.

It will not contain the entire sensor history or all blockchain information.

### Decision 4 — Prototype Scope

The system will remain a prototype rather than attempting nationwide deployment or full commercial logistics integration.

---

## 5. Requirements Engineering Principle

The project will maintain the following engineering chain:

Objective
→ Requirement
→ Design
→ Implementation
→ Test
→ Evidence
→ Documentation

Every major feature should therefore:

1. Support an approved objective.
2. Satisfy a defined requirement.
3. Have a design representation.
4. Be implemented.
5. Be tested.
6. Produce evidence.
7. Be documented.

---

## 6. Requirements Still Requiring Validation

The current requirements are a **draft engineering baseline**, not yet the final validated requirements specification.

The following require stakeholder/supervisor validation:

- Exact environmental thresholds.
- Representative produce type.
- Supply-chain checkpoints.
- User roles.
- Existing/manual monitoring practices.
- Traceability information currently required.
- Dashboard technology.
- Sensor sampling interval.
- Blockchain record structure.
- QR payload/design.

---

## 7. Evidence Strategy

Each major requirement must have demonstrable evidence.

Examples include:

- Sensor readings.
- Serial-monitor output.
- Database records.
- Dashboard screenshots.
- Dashboard latency measurements.
- Blockchain transactions.
- Hash comparisons.
- Tamper-detection results.
- QR codes.
- QR scanning demonstrations.
- Traceability records.
- Usability results.
- Accuracy measurements.

The project will follow:

> **Build → Test → Capture Evidence → Document → Commit**

---

## 8. Outputs From Mission #002

The mission produced the initial requirements-engineering baseline.

Detailed requirements will be maintained in separate files under:

`05_Requirements/`

Planned files include:

- `Requirements_Overview.md`
- `Functional_Requirements.md`
- `Non_Functional_Requirements.md`
- `Data_Requirements.md`
- `Hardware_and_Software_Requirements.md`
- `Security_Requirements.md`
- `Requirements_Traceability_Matrix.md`

---

## 9. Current Status

**Requirements Engineering:** 🟨 In Progress

The initial requirements baseline has been established.

Requirements are **not yet frozen** because stakeholder validation and detailed system analysis are still required.

---

## 10. Mission #002 Completion Criteria

Mission #002 will be considered fully complete when:

- [x] Four approved objectives are reflected.
- [x] Initial functional requirements are defined.
- [x] Initial non-functional requirements are identified.
- [x] Initial data requirements are identified.
- [x] Hardware/software requirements are identified.
- [x] Security requirements are identified.
- [x] Requirements are linked to project objectives.
- [x] Testing/evidence considerations are identified.
- [ ] Stakeholder requirements are validated.
- [ ] Supervisor feedback is incorporated.
- [ ] Final requirements baseline is approved.

---

## 11. Next Mission

# Mission #003 — System Analysis and Architecture

The next mission will transform the validated requirements into the system's structural and behavioral design.

Expected outputs include:

- System context diagram.
- System architecture.
- Functional decomposition.
- DFD.
- UML use-case diagram.
- Use-case descriptions.
- Activity diagrams.
- Sequence diagrams.
- Class/domain model.
- Database/ERD design.
- IoT architecture.
- Blockchain architecture.
- QR traceability workflow.
- Integrated system data flow.

The next engineering chain is:

Requirements
→ System Analysis
→ Architecture
→ Detailed Design
→ Implementation

---

## 12. Engineering Log Entry

**Mission:** #002

**Primary Activity:** Requirements Engineering

**Result:** Initial requirements baseline established.

**Current Blocker:** Requirements require stakeholder/supervisor validation before being frozen.

**Next Action:** Complete requirements validation and proceed to system analysis and architecture.

**Status:** 🟨 IN PROGRESS
