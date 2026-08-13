# Functional Requirements Specification

## IoT and Blockchain-Based Cold Chain Monitoring and Produce Traceability System for Kenya's Horticultural Export Industry

**Project:** Final Year Project
**Student:** Caleb Murithi
**Programme:** Bachelor of Science in Computer Science
**University:** Dedan Kimathi University of Technology
**Document:** Functional Requirements Specification
**Version:** 1.0
**Date:** 28 July 2026
**Status:** Initial Draft

---

## 1. Introduction

This document defines the functional requirements of the proposed IoT and Blockchain-Based Cold Chain Monitoring and Produce Traceability System for Kenya's horticultural export industry.

The system is intended to address challenges associated with monitoring environmental conditions during the storage and transportation of horticultural produce and maintaining reliable traceability records throughout the supply chain.

The proposed system will combine Internet of Things (IoT) sensors, a web-based monitoring dashboard, Blockchain technology, a database, and QR-code-based traceability.

The functional requirements defined in this document will provide the foundation for the system architecture, database design, API development, IoT implementation, Blockchain integration, user interface development, and system testing.

---

# 2. System Purpose

The primary purpose of the system is to provide a digital mechanism for monitoring and recording environmental conditions affecting horticultural produce while also providing secure and traceable records of produce movement throughout the supply chain.

The system will collect environmental data such as temperature and humidity from IoT sensors, transmit the collected data to the application server, store relevant information in the database, provide real-time visualization through a web dashboard, and maintain selected cold-chain records using Blockchain technology.

Each produce batch will also be associated with a unique QR code that can be used to retrieve relevant traceability information.

---

# 3. System Users and Actors

The proposed system will involve the following primary actors.

## 3.1 System Administrator

The administrator will be responsible for managing the system and maintaining system-level information.

The administrator shall be able to:

* Authenticate into the system.
* Register and manage users.
* Register produce batches.
* Register storage or transportation units.
* Register IoT devices.
* Associate IoT devices with relevant monitoring locations or transportation units.
* View environmental monitoring records.
* View traceability information.
* Generate or assign QR codes to produce batches.
* Monitor system alerts.
* View Blockchain transaction or record status.
* Manage relevant system configuration.

---

## 3.2 Supply Chain Operator

A supply chain operator represents a user involved in handling, storing, or transporting horticultural produce.

The operator shall be able to:

* Authenticate into the system.
* Register or update relevant produce-handling events.
* View environmental conditions associated with assigned produce.
* View produce movement information.
* Scan or use QR codes to retrieve batch information.
* View historical monitoring records.
* Receive notifications or warnings when configured environmental thresholds are exceeded.

---

## 3.3 System/IoT Device

The IoT device acts as an automated data source rather than a human user.

The IoT subsystem shall:

* Measure temperature.
* Measure relative humidity.
* Associate measurements with a sensor/device identifier.
* Record the measurement timestamp.
* Transmit sensor readings to the backend system.
* Continue collecting measurements at configured intervals.
* Indicate communication or device failure where technically possible.

---

## 3.4 Authorized Traceability User

An authorized user shall be able to use a QR code associated with a produce batch to retrieve relevant traceability information.

Depending on the final access-control design, this may include supply-chain personnel, administrators, or other authorized stakeholders.

---

# 4. Functional Requirements

## FR-001: User Authentication

The system shall provide a secure authentication mechanism for authorized users.

The system shall:

* Allow registered users to log in using valid credentials.
* Validate submitted credentials.
* Reject invalid credentials.
* Maintain authenticated sessions.
* Prevent unauthorized access to protected system functions.
* Allow authorized users to log out.

**Related objective:** Supports the overall operation and security of the proposed system.

---

## FR-002: User Role Management

The system shall support role-based access to system functionality.

The system shall:

* Assign appropriate roles to registered users.
* Restrict functionality according to user roles.
* Prevent unauthorized users from accessing administrative functionality.
* Maintain user account information.

---

## FR-003: Produce Batch Registration

The system shall allow an authorized user to register a horticultural produce batch.

A produce batch shall have a unique identifier.

The system shall capture relevant information including, where applicable:

* Batch ID.
* Produce type.
* Variety or grade.
* Quantity.
* Production or harvest date.
* Origin/location.
* Destination.
* Registration date.
* Current status.

---

## FR-004: IoT Device Registration

The system shall allow an administrator to register IoT monitoring devices.

For each device, the system should maintain information such as:

* Device ID.
* Sensor type.
* Device status.
* Assigned monitoring location.
* Assigned storage or transportation unit.
* Installation date.
* Last communication time.

---

## FR-005: Temperature Data Collection

The IoT subsystem shall collect temperature measurements from the connected temperature sensor.

Each temperature record shall contain, at minimum:

* Temperature value.
* Device ID.
* Timestamp.
* Monitoring location or associated unit.
* Relevant produce batch identifier where applicable.

The system shall transmit collected measurements to the backend system.

---

## FR-006: Humidity Data Collection

The IoT subsystem shall collect relative humidity measurements from the connected humidity sensor.

Each humidity record shall contain, at minimum:

* Humidity value.
* Device ID.
* Timestamp.
* Monitoring location or associated unit.
* Relevant produce batch identifier where applicable.

The system shall transmit collected measurements to the backend system.

---

## FR-007: Periodic Sensor Data Transmission

The IoT device shall transmit collected environmental measurements to the backend system at a configurable interval.

The system shall:

* Collect sensor readings.
* Prepare the readings for transmission.
* Establish communication with the backend.
* Transmit the measurements.
* Handle unsuccessful transmission attempts where technically feasible.

The initial sampling interval shall be configurable during implementation and testing.

---

## FR-008: Environmental Data Storage

The backend system shall receive and store environmental measurements.

The system shall maintain historical records containing:

* Temperature.
* Humidity.
* Timestamp.
* Sensor/device identifier.
* Monitoring location.
* Associated produce batch or transportation unit where applicable.

Historical records shall be retrievable for monitoring and analysis.

---

## FR-009: Real-Time Environmental Monitoring

The system shall provide real-time or near-real-time visualization of environmental conditions through the web dashboard.

The dashboard shall display current:

* Temperature.
* Humidity.
* Sensor/device status.
* Monitoring location.
* Associated produce batch where applicable.

The dashboard shall update as new sensor measurements are received.

**Related objective:** Specific Objective II.

---

## FR-010: Historical Environmental Data Visualization

The system shall allow authorized users to view historical environmental measurements.

The system should provide suitable visualizations such as:

* Temperature trends.
* Humidity trends.
* Time-based measurements.
* Historical readings for a selected batch.
* Historical readings for a selected monitoring device.

The exact visualization mechanisms will be finalized during the user-interface design phase.

---

## FR-011: Environmental Threshold Monitoring

The system shall support configurable acceptable ranges for environmental conditions.

The system shall compare incoming sensor measurements against configured thresholds.

For example:

* Minimum acceptable temperature.
* Maximum acceptable temperature.
* Minimum acceptable humidity.
* Maximum acceptable humidity.

The exact threshold values will be determined from the horticultural produce requirements selected for the prototype.

---

## FR-012: Environmental Alerts

The system shall generate an alert when an environmental measurement exceeds a configured threshold.

The alert shall identify, where applicable:

* The affected parameter.
* Measured value.
* Expected/acceptable range.
* Date and time.
* Sensor/device.
* Monitoring location.
* Associated produce batch.

The system shall display active alerts to authorized users through the dashboard.

---

## FR-013: Cold Chain Event Recording

The system shall record significant cold-chain events.

Examples of events include:

* Produce batch registered.
* Produce moved to storage.
* Produce removed from storage.
* Produce loaded for transportation.
* Produce received at destination.
* Environmental threshold violation.
* Monitoring device assigned.
* Monitoring device disconnected.

Each event shall have an identifiable timestamp and relevant associated entities.

---

## FR-014: Produce Movement Recording

The system shall allow authorized users to record movement of produce batches through relevant stages of the supply chain.

The system shall maintain information about:

* Produce batch.
* Previous location.
* New location.
* Movement date/time.
* Handler/operator where applicable.
* Transportation unit where applicable.
* Relevant event information.

This information will contribute to the traceability history of the produce.

---

## FR-015: QR Code Generation

The system shall generate a unique QR code for a registered produce batch.

Each QR code shall be associated with a unique batch identifier.

The QR code shall provide a mechanism for retrieving the traceability information associated with the relevant batch.

---

## FR-016: QR Code Scanning and Traceability

The system shall allow a user to scan a produce batch QR code using an appropriate device.

Following a successful scan, the system shall retrieve the associated traceability information.

The information may include:

* Batch identification.
* Produce type.
* Origin.
* Current or previous locations.
* Storage events.
* Transportation events.
* Relevant environmental monitoring information.
* Timestamped traceability events.

---

## FR-017: Produce Traceability History

The system shall provide a chronological history of relevant events associated with a produce batch.

The traceability history shall allow an authorized user to determine:

1. Where the produce originated.
2. When the batch was registered.
3. Where it has been stored.
4. When it was transported.
5. Relevant movement events.
6. Relevant environmental monitoring events.
7. The current or final recorded destination.

**Related objective:** Specific Objective IV.

---

## FR-018: Blockchain Record Creation

The system shall record selected critical cold-chain and traceability records on a Blockchain network.

The Blockchain component shall be used for records for which integrity and tamper resistance are important.

Potential Blockchain records include:

* Produce batch registration events.
* Produce movement events.
* Cold-chain exception events.
* Selected environmental monitoring records.
* Traceability events.

The final Blockchain data model will be determined during the Blockchain architecture phase.

**Related objective:** Specific Objective III.

---

## FR-019: Blockchain Record Verification

The system shall provide a mechanism for verifying the integrity or existence of Blockchain-recorded events.

The system shall allow authorized system components or users to retrieve relevant Blockchain information for verification.

The implementation shall demonstrate that Blockchain records provide stronger tamper resistance than ordinary mutable application records.

---

## FR-020: Blockchain and Database Integration

The system shall integrate the Blockchain component with the application backend and primary database.

The system shall distinguish between:

* Operational application data stored in the database.
* Critical integrity-sensitive records stored on Blockchain.
* References linking application records to corresponding Blockchain records.

The architecture shall avoid unnecessarily storing large volumes of raw sensor data directly on the Blockchain where such storage would be inefficient.

---

## FR-021: Data Integrity Verification

The system shall provide a mechanism for determining whether selected records have been modified after being recorded.

Where applicable, the system may use cryptographic hashes or Blockchain transaction references to support integrity verification.

A verification test shall be conducted during system evaluation.

---

## FR-022: Dashboard System Overview

The web dashboard shall provide an overview of the monitored cold-chain environment.

The dashboard should provide information such as:

* Active monitoring devices.
* Current temperature.
* Current humidity.
* Environmental alerts.
* Number of monitored batches.
* Recent traceability events.
* Blockchain record status.

---

## FR-023: Search and Filtering

The system shall allow authorized users to search and filter relevant records.

Users should be able to search or filter by criteria such as:

* Batch ID.
* Produce type.
* Sensor ID.
* Date.
* Location.
* Transportation unit.
* Environmental status.

---

## FR-024: Data Retrieval Through APIs

The backend shall expose appropriate application programming interfaces (APIs) for communication between system components.

APIs shall support relevant operations including:

* User authentication.
* Produce batch management.
* Sensor data submission.
* Environmental data retrieval.
* Traceability information retrieval.
* QR-code-related operations.
* Blockchain record interaction.

---

## FR-025: Sensor Device Status Monitoring

The system shall maintain the operational status of registered IoT devices.

Where technically feasible, the system shall identify:

* Online devices.
* Offline devices.
* Last communication time.
* Device identifier.

This will assist in distinguishing missing sensor data from normal environmental conditions.

---

## FR-026: System Logging

The system shall maintain application logs for significant technical events.

Logs may include:

* Authentication events.
* API requests.
* Sensor communication events.
* Blockchain transactions.
* System errors.
* Administrative actions.

Logs shall support debugging, maintenance, and system evaluation.

---

## FR-027: Error Handling

The system shall handle common operational failures.

The system should provide meaningful responses when:

* Invalid credentials are submitted.
* Sensor data is malformed.
* A sensor becomes unavailable.
* The backend cannot be reached.
* A database operation fails.
* A Blockchain transaction fails.
* An invalid QR code is scanned.

Errors shall be recorded where appropriate for troubleshooting and system maintenance.

---

## FR-028: System Data Export

The system should provide an appropriate mechanism for authorized users to export selected monitoring or traceability data for analysis and reporting.

The final export format will be determined during implementation.

---

# 5. Functional Requirement Traceability

Each functional requirement shall ultimately be associated with one or more project objectives.

| Requirement Area                    | Main Project Objective |
| ----------------------------------- | ---------------------- |
| Temperature and humidity collection | Objective I            |
| Environmental data transmission     | Objective I            |
| Real-time dashboard                 | Objective II           |
| Historical monitoring               | Objective II           |
| Blockchain record creation          | Objective III          |
| Blockchain verification             | Objective III          |
| QR code generation                  | Objective IV           |
| QR code scanning                    | Objective IV           |
| Produce movement tracking           | Objective IV           |
| Traceability history                | Objective IV           |
| System evaluation and testing       | Objective V            |

---

# 6. Objective-to-Function Mapping

## Objective I

**To design an IoT-based system for monitoring temperature and humidity during storage and transportation of horticultural produce.**

Required system functions:

* Sensor registration.
* Temperature measurement.
* Humidity measurement.
* Sensor data transmission.
* Environmental data storage.
* Device status monitoring.
* Threshold monitoring.

---

## Objective II

**To develop a web-based dashboard for real-time visualization of environmental conditions.**

Required system functions:

* Real-time data retrieval.
* Current temperature display.
* Current humidity display.
* Historical data visualization.
* Environmental alerts.
* Monitoring status display.

---

## Objective III

**To implement Blockchain technology for secure and tamper-resistant storage of cold chain records.**

Required system functions:

* Blockchain record creation.
* Blockchain transaction management.
* Blockchain record verification.
* Database–Blockchain integration.
* Data integrity verification.

---

## Objective IV

**To develop a QR-code-based produce traceability mechanism for tracking produce movement throughout the supply chain.**

Required system functions:

* Produce batch registration.
* QR code generation.
* QR code scanning.
* Produce movement recording.
* Traceability history.
* Batch information retrieval.

---

## Objective V

**To evaluate the effectiveness of the proposed system in improving cold chain monitoring and produce traceability.**

Required system functions and evaluation capabilities:

* System testing.
* Sensor accuracy evaluation.
* Dashboard response evaluation.
* Blockchain integrity testing.
* QR-code traceability testing.
* Performance measurement.
* Requirement-to-test traceability.

---

# 7. System Boundary

The proposed system will focus on monitoring and traceability activities occurring after horticultural produce enters the defined cold-chain monitoring process.

The project will include:

* IoT-based environmental monitoring.
* Temperature and humidity collection.
* Data transmission.
* Backend processing.
* Database storage.
* Web-based visualization.
* Environmental alerts.
* Blockchain-based record integrity.
* QR-code-based traceability.
* Produce movement recording.
* System testing and evaluation.

The project will not attempt to implement an entire commercial horticultural supply-chain management platform.

The following areas are outside the initial implementation scope:

* Automated refrigeration control.
* Automated vehicle driving or control.
* Commercial payment processing.
* Full enterprise resource planning.
* Automated customs clearance.
* Commercial-scale fleet management.
* Automated physical handling of produce.

These exclusions will help maintain a realistic undergraduate project scope.

---

# 8. Assumptions

The functional requirements are based on the following initial assumptions:

1. The IoT prototype will have access to an appropriate power source during testing.

2. The IoT device will have access to a suitable communication network during transmission tests.

3. The project will use a controlled prototype environment rather than attempting to deploy a commercial-scale cold-chain network.

4. Temperature and humidity sensors will provide measurements at a frequency appropriate for the prototype.

5. Users will interact with the system through a web browser.

6. The Blockchain component will be implemented at a scale appropriate for academic demonstration and evaluation.

7. QR codes will identify produce batches rather than individual physical produce items.

8. The exact horticultural produce and environmental thresholds used for testing will be finalized during the requirements and hardware research phase.

---

# 9. Requirement Priorities

The following priority classification will be used during development.

### Must Have

The following functions are essential to demonstrating the project's core objectives:

* Temperature monitoring.
* Humidity monitoring.
* IoT data transmission.
* Environmental data storage.
* Real-time dashboard.
* Produce batch registration.
* QR-code generation.
* QR-code traceability.
* Produce movement recording.
* Blockchain record implementation.
* Blockchain integrity verification.

### Should Have

* Environmental alerts.
* Historical graphs.
* Device status monitoring.
* Search and filtering.
* System logging.
* Data export.

### Could Have

* Advanced analytics.
* Additional environmental sensors.
* Advanced notifications.
* Extended reporting features.

Features classified as "Could Have" will only be implemented if sufficient time remains after all core objectives have been successfully demonstrated.

---

# 10. Requirement Validation Strategy

Each functional requirement will eventually be converted into one or more test cases.

For example:

### Requirement

**FR-005: Temperature Data Collection**

### Test

Place the temperature sensor in a controlled environment and observe whether the measured temperature is transmitted to the backend.

### Expected Result

The backend receives and stores the temperature measurement together with the appropriate timestamp and device identifier.

---

### Requirement

**FR-015: QR Code Generation**

### Test

Register a new produce batch and request a QR code.

### Expected Result

The system generates a unique QR code associated with the registered batch.

---

### Requirement

**FR-018: Blockchain Record Creation**

### Test

Create a defined cold-chain event and verify that the corresponding Blockchain record is generated.

### Expected Result

A verifiable Blockchain transaction/reference is associated with the recorded event.

---

# 11. Requirement Traceability Principle

No major system feature will be implemented without identifying:

1. The project objective it supports.
2. The user or system actor that requires it.
3. The data required by the function.
4. The component responsible for implementing it.
5. The test that will verify it.
6. The evidence that will demonstrate successful implementation.

This approach will ensure that the final system remains aligned with the approved project proposal.

---

# 12. Document Status

**Version:** 1.0

**Status:** Initial Requirements Baseline

This document will remain under revision during the requirements analysis phase. Changes arising from supervisor feedback, technical feasibility studies, hardware availability, literature review findings, or project scope decisions shall be recorded in the project's Decision Log and reflected in subsequent versions of this document.
