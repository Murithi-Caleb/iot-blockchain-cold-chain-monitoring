# Constraints, Assumptions and Dependencies

## 1. Constraints

### CON-001: Undergraduate Project Scope
The system must remain feasible within available academic time, budget, hardware and development resources.

### CON-002: Prototype Scale
The implementation represents a controlled prototype, not a commercial national deployment.

### CON-003: Network Dependence
IoT transmission and online Blockchain operations depend on network availability.

### CON-004: Hardware Limitations
Sensor accuracy, power availability, device processing capacity and communication range may limit performance.

### CON-005: Blockchain Cost/Throughput
Blockchain transactions may have latency, throughput and cost limitations; therefore, raw high-frequency telemetry should not automatically be written on-chain.

## 2. Assumptions

1. The IoT prototype has suitable power during testing.
2. The IoT device has appropriate network connectivity during transmission tests.
3. Temperature and humidity sensors provide readings at a configurable frequency.
4. Users access the system through a web browser.
5. Blockchain is used at an academic prototype scale.
6. QR codes identify produce batches rather than individual produce items.
7. Environmental thresholds will be finalized for the selected prototype produce/use case.
8. Operational data can be stored in an off-chain database while selected integrity-sensitive records/proofs are anchored on Blockchain.

## 3. Dependencies

- Availability and compatibility of IoT hardware.
- Sensor libraries/drivers.
- Backend runtime and framework.
- Database service.
- Blockchain network availability.
- Smart-contract development/deployment tooling.
- QR-code generation/scanning capability.
- Network connectivity.
- Web browser/device compatibility.

## 4. Validation

Assumptions and dependencies shall be reviewed during implementation and testing. Invalid assumptions must be recorded as requirement/design changes.
