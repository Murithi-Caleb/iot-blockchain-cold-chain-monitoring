# Requirements Overview

**Project:** IoT and Blockchain-Based Cold Chain Monitoring and Produce Traceability System for Kenya's Horticultural Export Industry  
**Student:** Caleb Murithi  
**Programme:** Bachelor of Science in Computer Science  
**University:** Dedan Kimathi University of Technology  
**Requirements Baseline:** Version 2.0  
**Status:** Active working baseline

## 1. Purpose

This directory contains the requirements engineering artifacts for the project. Together, these documents define what the system must do, the quality attributes it must satisfy, the data it must manage, the resources and technologies required, its security expectations, and how every major requirement will be traced and evaluated.

The requirements are aligned to the four supervisor-approved specific objectives.

## 2. Approved Specific Objectives

1. To develop a web-based dashboard for real-time visualization of environmental conditions collected by the IoT sensors.
2. To implement Blockchain technology for secure and tamper-resistant storage of cold chain records.
3. To develop a QR-code-based produce traceability mechanism for tracking produce movement throughout the supply chain.
4. To evaluate the effectiveness of the proposed system in improving cold chain monitoring and produce traceability.

## 3. Requirements Document Set

| File | Purpose |
|---|---|
| `Functional_Requirements.md` | Detailed system functions and functional requirements |
| `Non_Functional_Requirements.md` | Performance, usability, reliability, maintainability, scalability and other quality requirements |
| `User_and_Actor_Requirements.md` | Actors, roles, permissions and user needs |
| `System_Scope_and_Boundaries.md` | Included functionality, exclusions and system boundary |
| `Constraints_Assumptions_Dependencies.md` | Project constraints, assumptions and external dependencies |
| `Data_Requirements.md` | Data entities, fields, relationships, retention and integrity expectations |
| `Interface_Requirements.md` | User interface, IoT, API, database, Blockchain and QR interfaces |
| `Hardware_and_Software_Requirements.md` | Prototype hardware, development software and infrastructure requirements |
| `Security_Requirements.md` | Authentication, authorization, integrity, secrets, logging and security controls |
| `Requirements_Traceability_Matrix.md` | Objective-to-requirement-to-test-to-evidence traceability |
| `Requirement_Priorities.md` | Must/Should/Could prioritization and scope protection |
| `Acceptance_and_Evaluation_Criteria.md` | Acceptance criteria and evaluation measures for Objective 4 |
| `Requirements_Change_Log.md` | Controlled record of changes to the requirements baseline |

## 4. IoT Objective Relationship

IoT is a core subsystem but is not a fifth specific objective. It supplies the environmental data required by Objective 1.

`IoT sensors → data transmission → backend → database → dashboard`

## 5. Requirements Engineering Chain

Every major feature should follow:

`Objective → Requirement → Design → Implementation → Test → Evidence`

## 6. Source of Truth

`Functional_Requirements.md` is the primary functional baseline. The other documents complement it and must not introduce features that contradict the approved objectives or system scope.

## 7. Status

Requirements remain a controlled working baseline until supervisor/stakeholder validation and final requirements approval.
