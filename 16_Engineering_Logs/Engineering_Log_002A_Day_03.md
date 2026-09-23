# Engineering Log #002A — Day 03

## Mission
**Mission:** #002A — Industry Fact-Finding & Requirements Validation  
**Date:** 23 September 2026  
**Activity:** Stakeholder evidence analysis and preliminary requirements validation  
**Status:** In Progress

## 1. Mission Context

Mission #002A was introduced to obtain primary stakeholder evidence before freezing the requirements baseline and proceeding to system analysis and architecture.

Engineering sequence:

> Fact Finding → Stakeholder Data → Analysis → Requirements Validation → Final Requirements → System Analysis → Architecture

## 2. Evidence Available

- **P01:** Technical Manager, Equinox Horticulture Ltd. — semi-structured interview.
- **P02:** General Manager, AAA Growers Ltd. — questionnaire.
- **P03:** Technical Manager, organization to be confirmed — questionnaire.
- **P04:** ICT Analyst, Flamingo Horticulture Kenya Ltd. — questionnaire.

## 3. Key Findings

### 3.1 Digital monitoring already exists in represented operations
The evidence indicates that some represented horticultural operations already use digital environmental monitoring and traceability systems. The project therefore should not claim that horticultural exporters generally lack digital systems.

### 3.2 Environmental monitoring is strongly validated
Temperature monitoring was reported by all four participants. Humidity was reported by P01, P02 and P04. Continuous/automatic monitoring was also consistently reported.

### 3.3 Alerts are supported
P01 described threshold-based alarms and notifications. P02 and P03 identified environmental alerts as useful capabilities.

### 3.4 Transportation is an important monitoring stage
P01 described monitoring during refrigerated transport and risks associated with interruptions in cooling. Questionnaire respondents also identified transportation among monitored stages.

### 3.5 Data integrity is strongly supported
P01 described cross-checking physical and digital records. P02 and P03 rated historical integrity extremely important, while P04 rated it very important.

### 3.6 Equipment and acquisition reliability are emerging concerns
P02, P03 and P04 identified equipment/instrument limitations or concerns about device accuracy.

### 3.7 Connectivity and continuity are relevant
P01 described local capture and later synchronization as desirable during connectivity loss. P04 also identified connectivity limitations.

### 3.8 Information integration and duplicate records require attention
P02 identified information distributed across records/systems as a challenge. P04 reported duplicate records.

### 3.9 QR and Blockchain are not stakeholder-requested technologies
No participant specifically requested Blockchain or QR codes. The underlying needs are nevertheless supported: trustworthy historical records and batch traceability. QR and Blockchain remain project-specified mechanisms under the approved objectives and must not be presented as stakeholder-requested technologies.

## 4. Requirements Validation Outcome

The preliminary 28 requirements have now been reviewed against the available stakeholder evidence. The detailed matrix classifies them as validated, refined, partially validated, objective-derived/technical-design, or not stakeholder-evidenced.

## 5. Candidate Requirements Identified

The analysis produced candidates concerning:
- sensor/data acquisition reliability;
- sensor placement;
- location-associated environmental events;
- offline capture and synchronization;
- timely information sharing;
- duplicate/inconsistent record detection;
- automatic/long-term backup;
- multi-stage monitoring configuration.

These candidates require reconciliation against project scope, feasibility and approved objectives.

## 6. Engineering Decision

Mission #003 remains dependent on completion of requirements reconciliation.

The working engineering chain is:

> **Actual Practice → Evidence → Need → Requirement → Technical Solution**

## 7. Evidence Produced

- Stakeholder interview transcript — P01
- Questionnaire response dataset — P02, P03 and P04
- Respondent Identification Register
- Fact-Finding → Requirement Validation Matrix
- Cross-stakeholder analysis

## 8. Outstanding Activities

1. Confirm P03's organization where appropriate.
2. Complete Mission #002B — Requirements Reconciliation.
3. Decide the disposition of all 28 preliminary requirements.
4. Incorporate justified candidate requirements.
5. Freeze the final requirements baseline.
6. Update the master requirements traceability matrix.
7. Proceed to Mission #003 — System Analysis and Architecture.

## 9. Current Mission Assessment

**Mission #002A remains In Progress.**

Stakeholder evidence collection and initial analysis have progressed sufficiently to begin formal requirements reconciliation, but the requirements baseline should not yet be marked final.

## 10. Engineering Reflection

A major lesson from the fact-finding stage is that the project should not assume the absence of existing digital systems in the horticultural sector. The collected evidence shows that monitoring and traceability capabilities already exist in some represented operations. The project's contribution should therefore be framed around validated needs, integration opportunities, reliability considerations, integrity requirements and the defined prototype scope.
