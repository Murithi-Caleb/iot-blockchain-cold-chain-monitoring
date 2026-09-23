# Fact-Finding → Requirement Validation Matrix

## Mission #002A — Industry Fact-Finding & Requirements Validation

### Status Definitions

- **Validated** — stakeholder evidence directly supports retaining the requirement.
- **Refined** — the underlying need is supported, but wording or scope should be adjusted.
- **Partially validated** — some supporting evidence exists, but additional validation or clearer scope is needed.
- **Retained — Objective Derived** — retained because an approved project objective explicitly requires the capability/mechanism.
- **Not stakeholder-evidenced** — no participant specifically provided evidence for the requirement.

| ID | Preliminary Requirement | Evidence Summary | Status | Action |
|---|---|---|---|---|
| FR-001 | User Authentication | Controlled access across multiple organizations is relevant; P01 described differing access rights. | Refined | Retain; define authentication scope. |
| FR-002 | User Role Management | P01 described different organizations/users having varying access rights. | Validated | Retain and define role/access matrix. |
| FR-003 | Produce Batch Registration | All four participants described batch/consignment identifiers and associated information. | Validated | Retain. |
| FR-004 | IoT Device Registration | Sensors/data loggers were discussed, but device registration was not explicit. | Partially validated | Retain provisionally as implementation support. |
| FR-005 | Temperature Data Collection | Temperature monitoring was reported by all four participants. | Validated | Retain. |
| FR-006 | Humidity Data Collection | P01, P02 and P04 reported humidity monitoring. | Validated | Retain. |
| FR-007 | Periodic Sensor Data Transmission | Continuous/automatic monitoring using sensors/data loggers was reported. | Validated | Retain; refine transmission behaviour. |
| FR-008 | Environmental Data Storage | Cloud, computerized, paper and electronic data-loggers were reported. | Validated | Retain; define prototype storage strategy. |
| FR-009 | Real-Time Environmental Monitoring | Continuous/real-time monitoring was consistently reported; P04 requested real-time collection/visualization. | Validated | Retain. |
| FR-010 | Historical Environmental Data Visualization | Historical information and trend analysis were important, but visualization was not consistently specified. | Refined | Retain; define required historical views. |
| FR-011 | Environmental Threshold Monitoring | P01 described preset/calibrated thresholds; P02/P03 identified threshold-related alerts. | Validated | Retain. |
| FR-012 | Environmental Alerts | P01 described alarms/SMS/email; P02/P03 identified alerts as useful. | Validated | Retain. |
| FR-013 | Cold Chain Event Recording | Stakeholders described monitoring and records across multiple cold-chain stages. | Validated | Retain and refine event structure. |
| FR-014 | Produce Movement Recording | All four described movement/stage information or processes. | Validated | Retain. |
| FR-015 | QR Code Generation | Batch/barcode identifiers were reported, but QR specifically was not. | Retained — Objective Derived | Retain because approved Objective 3 specifies QR; do not call it stakeholder-requested. |
| FR-016 | QR Code Scanning and Traceability | Machine-readable traceability is supported, but QR specifically was not reported. | Retained — Objective Derived | Retain as the specified mechanism; evaluate usability later. |
| FR-017 | Produce Traceability History | All four described batch identifiers and retrieving/reconstructing history. | Validated | Retain. |
| FR-018 | Blockchain Record Creation | No participant specifically requested Blockchain. | Retained — Objective Derived | Retain because approved Objective 2 specifies Blockchain. |
| FR-019 | Blockchain Record Verification | Historical-record integrity is strongly supported, but Blockchain specifically is not. | Retained — Objective Derived | Retain as the proposed mechanism for the validated integrity need. |
| FR-020 | Blockchain and Database Integration | No direct stakeholder evidence for this architecture. | Retained — Objective Derived | Retain as a technical design requirement supporting Objective 2. |
| FR-021 | Data Integrity Verification | P01 described cross-checking; P02/P03 rated integrity extremely important; P04 rated it very important. | Validated | Retain and strengthen verification rules. |
| FR-022 | Dashboard System Overview | P01 described remote monitoring; P04 specifically identified real-time visualization. | Validated | Retain; define dashboard views. |
| FR-023 | Search and Filtering | Computerized retrieval/search was described; P02 reported information spread across records/systems. | Refined | Retain; prioritize batch, time, stage and environmental retrieval. |
| FR-024 | Data Retrieval Through APIs | Data access was described, but APIs were not specifically identified. | Retained — Technical Design | Retain only if required by architecture; not stakeholder-derived. |
| FR-025 | Sensor Device Status Monitoring | Equipment/instrument limitations were reported by P02, P03 and P04. | Refined | Retain; focus on device/data-source health. |
| FR-026 | System Logging | Historical records/accountability matter, but system logging was not explicit. | Partially validated | Retain provisionally; define concrete logging needs. |
| FR-027 | Error Handling | Equipment, connectivity and data-quality issues imply handling needs, but no explicit function was requested. | Refined | Retain as a quality/support requirement. |
| FR-028 | System Data Export | Export/reporting was not specifically identified in collected responses. | Not stakeholder-evidenced | Defer or retain as low-priority subject to scope/time. |

## Candidate Requirements Emerging from Evidence

| ID | Candidate | Evidence | Action |
|---|---|---|---|
| CAND-001 | Reliable environmental data acquisition through appropriate sensing devices | P02, P03, P04 | Add/refine data-quality/NFR requirement. |
| CAND-002 | Appropriate sensor placement at relevant monitoring locations | P02 | Add as deployment/design constraint. |
| CAND-003 | Associate environmental/movement events with location where location data is available | P01 | Consider optional/future capability. |
| CAND-004 | Offline capture and later synchronization during temporary connectivity loss | P01, P04 | Add/refine reliability requirement. |
| CAND-005 | Timely sharing of monitoring information with authorized users | P01, P03, P04 | Add/refine requirement. |
| CAND-006 | Detect duplicate/incomplete/inconsistent records | P04 and multi-system evidence | Add/refine data-quality requirement. |
| CAND-007 | Automatic/long-term backup of historical records | P01, P03 | Add/refine data/reliability requirement. |
| CAND-008 | Configuration of monitoring locations/stages | P01, P03 | Add/refine configuration requirement. |

## Methodological Distinction

Stakeholder evidence establishes operational needs; it does not automatically establish the preferred technical mechanism.

- **Data integrity is stakeholder-validated; Blockchain is the project-specified technical mechanism.**
- **Batch traceability is stakeholder-validated; QR is the project-specified technical mechanism.**
- **Environmental monitoring is stakeholder-validated; IoT is the enabling implementation approach.**
