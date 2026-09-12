
# Engineering Log 002 — Requirements Engineering

**Project:** A Blockchain-Enabled IoT System for Produce Traceability and Cold Chain Monitoring for Kenya's Horticultural Export Industry  
**Student:** Caleb Murithi  
**Programme:** Bachelor of Science in Computer Science  
**University:** Dedan Kimathi University of Technology  
**Mission:** #002 — Requirements Engineering  
**Date:** 10 September 2026  
**Status:** Completed — Requirements Baseline Established  
**Related Mission:** Mission #001 — Objective-to-System Traceability Matrix  
**Next Mission:** Mission #003 — System Analysis and Architecture  

---

## 1. Mission Overview

Mission #002 focused on translating the approved project objectives into a structured and testable set of system requirements.

The purpose of this mission was to establish a clear requirements baseline before proceeding to detailed system analysis, architecture, database design, interface design, IoT implementation, Blockchain integration, and testing.

The requirements engineering process was also used to ensure that every major system feature can be traced back to an approved project objective and eventually to an implementation component, test case, and evidence artifact.

The resulting requirements baseline is documented primarily in:

> **`05_Requirements/Functional_Requirements_Specification.md`**

Additional requirements documents will be developed as the project progresses.

---

# 2. Mission Objectives

The objectives of Mission #002 were to:

1. Translate the four approved project objectives into concrete system functionality.
2. Identify the major actors and their interactions with the system.
3. Identify functional requirements for the proposed system.
4. Identify supporting requirements for IoT sensing, data transmission, storage, monitoring, Blockchain, QR traceability, and evaluation.
5. Establish a preliminary requirements traceability structure.
6. Define requirement priorities to control project scope.
7. Identify assumptions and system boundaries.
8. Define how requirements will eventually be verified through testing.
9. Establish a requirements baseline that can guide the next stages of system development.
10. Ensure that the requirements remain aligned with the four approved specific objectives.

---

# 3. Approved Project Objectives

The requirements baseline was developed around the following four approved specific objectives.

### Objective 1

> **To develop a web-based dashboard for real-time visualization of environmental conditions collected by the IoT sensors.**

### Objective 2

> **To implement Blockchain technology for secure and tamper-resistant storage of cold chain records.**

### Objective 3

> **To develop a QR-code-based produce traceability mechanism for tracking produce movement throughout the supply chain.**

### Objective 4

> **To evaluate the effectiveness of the proposed system in improving cold chain monitoring and produce traceability.**

---

# 4. Key Scope Decision — IoT as a Supporting Subsystem

A major decision established during requirements engineering was the treatment of the IoT subsystem.

IoT remains a core component of the proposed system because the system requires environmental measurements such as temperature and humidity.

However, IoT is **not treated as a separate fifth project objective**.

Instead:

```text
Objective 1
     |
     +---- IoT sensing
     |
     +---- Data transmission
     |
     +---- Data storage
     |
     +---- Environmental monitoring
     |
     +---- Web dashboard