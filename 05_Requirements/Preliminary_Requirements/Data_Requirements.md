# Data Requirements

## 1. Purpose

This document defines the major data categories required by the system and their relationships.

## 2. Core Data Entities

### DR-001: User
Minimum conceptual fields:
- user ID;
- name/identifier;
- role;
- authentication information/reference;
- account status;
- timestamps.

### DR-002: Produce Batch
Minimum conceptual fields:
- batch ID;
- produce type;
- variety/grade where applicable;
- quantity;
- harvest/production date;
- origin;
- destination;
- registration date;
- status.

### DR-003: IoT Device
Minimum conceptual fields:
- device ID;
- sensor type;
- status;
- monitoring location;
- transportation/storage unit where applicable;
- installation date;
- last communication time.

### DR-004: Environmental Reading
Minimum conceptual fields:
- reading ID;
- temperature;
- humidity;
- timestamp;
- device ID;
- location/unit;
- batch association where applicable.

### DR-005: Supply Chain Event
Minimum conceptual fields:
- event ID;
- batch ID;
- event type;
- previous location;
- new/current location;
- timestamp;
- operator/handler where applicable;
- transportation unit where applicable.

### DR-006: QR Code
Minimum conceptual fields:
- QR identifier;
- batch ID/reference;
- creation timestamp;
- status.

### DR-007: Blockchain Record
Minimum conceptual fields:
- application record/event ID;
- record/hash reference;
- transaction hash/identifier;
- Blockchain network;
- contract/reference information where applicable;
- timestamp;
- verification status.

### DR-008: Alert
Minimum conceptual fields:
- alert ID;
- parameter;
- measured value;
- configured threshold/range;
- timestamp;
- device;
- location;
- batch where applicable;
- status.

## 3. Data Relationships

Conceptually:

`Produce Batch → Supply Chain Events`

`Produce Batch → QR Code`

`Produce Batch → Environmental Records (where applicable)`

`IoT Device → Environmental Records`

`Critical Event/Record → Integrity Hash/Blockchain Reference`

## 4. Data Storage Principle

High-volume operational and sensor data should remain in the primary database. Selected critical records or integrity proofs may be anchored on Blockchain.

## 5. Data Integrity

Critical records shall have mechanisms that allow later verification of whether the relevant data has been altered.

## 6. Timestamps

Time-sensitive readings and events shall contain timestamps using a consistent system time convention.

## 7. Data Validation

Incoming data should be validated for:
- required fields;
- valid numeric ranges;
- valid timestamps;
- known device identifiers;
- valid batch references;
- valid event types.

## 8. Retention

The retention period for prototype data shall be determined by project needs and available storage. Data required for final evaluation shall be preserved until evaluation and documentation are complete.
