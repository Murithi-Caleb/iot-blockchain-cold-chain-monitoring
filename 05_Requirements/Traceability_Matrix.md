# Mission #001 — Objective-to-System Traceability Matrix

**Project:** A Blockchain-Enabled IoT System for Produce Traceability and Cold Chain Monitoring for Kenya's Horticultural Export Industry

**Purpose:** Project control document for maintaining traceability between the approved project objectives, system requirements, implementation, testing, evidence, and final documentation.

**Status:** Active  
**Mission:** #001  
**Last Updated:** 2026-09-12

---

# 1. Purpose of This Document

This document establishes the traceability chain for the entire project.

The purpose is to ensure that every major development activity can be traced back to an approved project objective and that every objective has demonstrable evidence showing that it has been achieved.

The fundamental project control principle is:

> **Objective → Requirement → Design → Implementation → Test → Evidence → Documentation**

This matrix will be used throughout the project to:

- Guide system development.
- Prevent unnecessary features from entering the project scope.
- Ensure every objective is implemented.
- Ensure every implemented feature can be tested.
- Ensure every objective has measurable evidence.
- Guide the design diagrams and architecture.
- Guide the final report.
- Prepare for progress and final presentations.
- Demonstrate objectively that the project objectives have been achieved.

---

# 2. Approved Specific Objectives

The project will use **four specific objectives**.

## Objective 1 — Web-Based Dashboard

> **To develop a web-based dashboard for real-time visualization of environmental conditions collected by IoT sensors.**

IoT sensing is an enabling component of this objective. It is **not a separate specific objective**.

The IoT subsystem provides the environmental data that the dashboard visualizes.

---

## Objective 2 — Blockchain

> **To implement Blockchain technology for secure and tamper-resistant storage of cold chain records.**

The blockchain component will be responsible for protecting critical cold-chain records against unauthorized modification and providing verifiable records.

High-frequency sensor telemetry should not be stored directly on the blockchain. Sensor data can remain in the off-chain database while critical events or records are anchored on-chain.

---

## Objective 3 — QR-Code Traceability

> **To develop a QR-code-based produce traceability mechanism for tracking produce movement throughout the supply chain.**

The QR code will act as an identifier/access mechanism for a produce batch.

Scanning the QR code should allow the user to retrieve relevant traceability information associated with that batch.

---

## Objective 4 — System Evaluation

> **To evaluate the effectiveness of the proposed system in improving cold chain monitoring and produce traceability.**

This objective will evaluate the completed system using measurable criteria rather than simply stating that the system works.

Evaluation should include appropriate measures such as:

- Sensor accuracy.
- Dashboard/system latency.
- Blockchain confirmation latency.
- Data integrity/tamper detection.
- Usability.
- Effectiveness of monitoring and traceability.
- Comparison with relevant manual processes where practical.

---

# 3. Objective-to-System Traceability Matrix

| Objective | Research Question | Main System Component | Key Requirements | Data Required | Implementation | Test / Evidence | Final Report Section |
|---|---|---|---|---|---|---|---|
| **O1: Web-Based Dashboard** | How can a web-based dashboard be developed to provide real-time visualization of environmental conditions collected by IoT sensors? | IoT sensing + Backend/Database + Web Dashboard | Capture temperature and humidity; transmit readings; store readings; display current readings; display historical data; identify threshold breaches | Temperature, humidity, timestamp, sensor/device ID, threshold values | ESP32 + DHT22 → data transmission → Firebase/off-chain storage → web dashboard | Physical sensor setup; serial readings; database records; dashboard screenshots/demo; latency measurements | System Analysis; System Design; Implementation; Testing; Results |
| **O2: Blockchain** | How can Blockchain technology be implemented to provide secure and tamper-resistant storage of critical cold chain records? | Smart Contract + Blockchain + Verification | Create critical event records; generate/record hashes; submit blockchain transactions; retrieve records; verify integrity; detect alteration | Batch ID, event/checkpoint, timestamp, event data/hash, blockchain transaction information | Solidity + Hardhat + ethers.js + Polygon Amoy | Blockchain transaction evidence; original-record hash; modified-record hash; verification result; tamper-detection demonstration | System Design; Implementation; Security Testing; Results |
| **O3: QR Traceability** | How can a QR-code-based produce traceability mechanism be developed to track the movement of horticultural produce throughout the supply chain? | Batch Management + QR Code + Traceability Interface | Create produce batch; assign unique batch ID; generate QR code; scan QR code; retrieve batch information; display movement/checkpoint history | Batch ID, produce type, origin, destination, timestamps, checkpoints, status | QR-code generation + database + traceability interface | Create batch → generate QR → scan QR → retrieve batch → display traceability history | System Analysis; System Design; Implementation; Testing; Results |
| **O4: Evaluation** | To what extent does the proposed system improve cold chain monitoring and produce traceability? | Evaluation and Testing Framework | Measure system performance, integrity, usability and effectiveness | Reference measurements, sensor readings, response times, blockchain confirmation times, usability responses, detection times | Structured experiments + system testing + user evaluation + data analysis | Accuracy results; latency results; integrity test; usability score; detection-time comparison; charts/tables | Testing; Results; Discussion; Conclusion; Recommendations |

---

# 4. Detailed Objective Breakdown

## 4.1 Objective 1 — Web-Based Dashboard

### Objective

> To develop a web-based dashboard for real-time visualization of environmental conditions collected by IoT sensors.

### Supporting Technology

- ESP32
- DHT22 temperature/humidity sensor
- Wi-Fi/network connectivity
- Firebase Realtime Database or equivalent off-chain storage
- Web frontend
- React or HTML/CSS/JavaScript, depending on the finalized implementation

### Functional Flow

```text
DHT22 Sensor
     ↓
   ESP32
     ↓
Temperature/Humidity Reading
     ↓
Network Transmission
     ↓
Backend / Firebase
     ↓
Web Dashboard
     ↓
Real-Time Visualization
     ↓
Historical Data / Threshold Breach Information