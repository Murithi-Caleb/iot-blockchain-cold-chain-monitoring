# User and Actor Requirements

## 1. Purpose

This document defines the primary actors and the capabilities they require from the system.

## 2. Actors

### 2.1 System Administrator
Needs to:
- authenticate securely;
- manage users and roles;
- register batches;
- register IoT devices;
- associate devices with locations/units;
- view monitoring records;
- manage QR codes;
- view alerts;
- inspect Blockchain status;
- manage system configuration.

### 2.2 Supply Chain Operator
Needs to:
- authenticate;
- view environmental conditions;
- record movement and handling events;
- scan QR codes;
- retrieve batch history;
- view historical monitoring information;
- receive environmental warnings.

### 2.3 IoT Device
Needs to:
- collect temperature and humidity;
- identify itself;
- timestamp readings;
- transmit measurements;
- communicate device status where possible.

### 2.4 Authorized Traceability User
Needs to:
- scan a valid QR code;
- identify the corresponding batch;
- retrieve relevant traceability information;
- view chronological supply-chain history according to access permissions.

## 3. Access Principle

The final authorization model shall be implemented according to least privilege: users should receive only the permissions necessary for their role.

## 4. Actor-to-Objective Relationship

| Actor | Main Objectives Supported |
|---|---|
| Administrator | 1, 2, 3 |
| Supply Chain Operator | 1, 3 |
| IoT Device | 1 |
| Authorized Traceability User | 3 |
| Evaluator/Project Team | 4 |
