# Hardware and Software Requirements

## 1. Purpose

This document records the preliminary hardware, software and infrastructure requirements for implementing the prototype.

## 2. IoT Hardware

### HW-001: Microcontroller
An IoT-capable microcontroller such as an ESP32 shall be used for prototype sensing and communication, subject to final hardware validation.

### HW-002: Temperature/Humidity Sensor
A suitable digital temperature and relative-humidity sensor, such as a DHT22, may be used subject to accuracy and availability validation.

### HW-003: Power
The prototype shall have a stable power source during testing.

### HW-004: Connectivity
The IoT device shall have an appropriate communication mechanism for transmitting measurements to the backend.

## 3. Development Software

The preliminary development stack may include:

- Arduino/ESP32 development environment;
- backend/API framework;
- web frontend framework;
- database platform;
- Solidity for smart contracts;
- Hardhat or equivalent Blockchain development tooling;
- ethers.js or equivalent Blockchain client library;
- QR-code generation/scanning library;
- Git and GitHub.

Specific versions shall be recorded in the project setup/deployment documentation after validation.

## 4. Blockchain Infrastructure

The project may use a suitable test network such as Polygon Amoy or another supervisor-approved test environment.

The final network choice must be recorded as an engineering decision before deployment.

## 5. Browser/Client Requirements

The web interface should support current mainstream browsers available during testing.

## 6. Development Machine

The development environment shall provide sufficient CPU, memory, storage and network connectivity for the selected stack.

## 7. Technology Change Rule

Technology substitutions are permitted when required by compatibility, availability, cost or reliability, but major substitutions must be documented in the engineering decision/change log.
