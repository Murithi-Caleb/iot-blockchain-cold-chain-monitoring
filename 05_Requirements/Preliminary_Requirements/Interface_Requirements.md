# Interface Requirements

## 1. Purpose

This document defines how users and major technical components interact with the system.

## 2. Web Dashboard

### IR-001
The dashboard shall provide authenticated users with access to functions permitted by their role.

### IR-002
The dashboard shall display current temperature and humidity information.

### IR-003
The dashboard shall display device status, monitoring location and relevant batch information where available.

### IR-004
The dashboard shall provide historical environmental views.

### IR-005
The dashboard shall display environmental alerts.

### IR-006
The dashboard shall provide access to relevant traceability information.

## 3. IoT-to-Backend Interface

### IR-007
The IoT device shall transmit sensor readings to a defined backend endpoint/protocol.

A sensor payload should contain at least:
- device ID;
- timestamp;
- temperature;
- humidity;
- relevant association/reference where applicable.

### IR-008
The backend shall validate incoming sensor payloads before persistence.

## 4. Backend API Interface

### IR-009
The API shall provide controlled endpoints for:
- authentication;
- user/role operations;
- batch management;
- sensor submission;
- environmental retrieval;
- traceability retrieval;
- QR operations;
- Blockchain operations.

## 5. Database Interface

### IR-010
The application shall interact with the database through controlled application/data-access logic rather than exposing unrestricted database access to end users.

## 6. Blockchain Interface

### IR-011
The backend shall interact with the selected Blockchain network through the defined smart-contract/application interface.

### IR-012
Blockchain transaction/reference information shall be linked to the corresponding application record.

## 7. QR Interface

### IR-013
The system shall generate QR codes associated with valid batch identifiers.

### IR-014
Scanning a valid QR code shall resolve to the correct batch traceability information.

## 8. Error Feedback

Interfaces shall provide understandable feedback for invalid data, unavailable services, failed transactions and invalid QR codes.
