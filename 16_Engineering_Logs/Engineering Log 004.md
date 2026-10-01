Engineering Session Report: Cold Chain Monitoring System Implementation
Date: October 1, 2026

Project: IoT and Blockchain-Based Cold Chain Monitoring and Produce Traceability System for Kenya's Horticultural Export Industry

Author: Murithi Caleb (C026-01-0762/2023)

1. Executive Summary
During today’s engineering session, we transitioned the project from the system analysis and design phase into active prototype implementation. Operating within your established single-monorepo structure, we successfully established the foundational data pipeline, initialized the off-chain database, built a custom hardware simulation script, and deployed a fully functional React frontend featuring live charting and dynamic QR code generation.

This work directly satisfies core elements of Objective 1 (Real-time IoT Environmental Monitoring) and Objective 3 (QR-Code-Based Traceability), providing a demonstrable, working prototype ahead of your upcoming progress presentation.

2. Summary of Work Done & Step-by-Step Breakdown
Phase A: Proposal Architecture Refinement (Section 3.4 Update)
Action Taken: Transformed the preliminary system design section of your proposal document into a rigorous, academically defensible architectural blueprint.

Implementation: Mapped out the system's six-layer architecture—explicitly separating high-frequency, continuous IoT monitoring from discrete, tamper-evident blockchain record-keeping to prevent network congestion and excessive transaction costs. Integrated structural anchors for your System Context Diagram, Data Flow Diagrams (DFD Level 0 and Level 1), UML Use Case/Activity/Sequence diagrams, procedural flowcharts, and Chen-notation Entity-Relationship models.

Phase B: Backend and Database Initialization (07_Backend)
Action Taken: Initialized the Node.js Express server and connected it to the Firebase Realtime Database to serve as the off-chain data layer.

Step-by-Step Execution:

Created a Node.js project environment inside the 07_Backend directory, installing express, cors, firebase-admin, and dotenv.

Configured a secure connection to the Firebase Realtime Database using a generated service account credentials file (serviceAccountKey.json) and environment variables.

Developed the POST /api/batches endpoint to register new produce batches, programmatically generating unique timestamped traceability IDs (e.g., BATCH-123456789).

Developed the POST /api/sensor-data endpoint to receive, validate, and store incoming temperature and humidity arrays nested under their respective batch identifiers.

Phase C: Hardware Simulation Loop (mockSensor.js)
Action Taken: Developed a custom Node.js sensor simulation script to bypass temporary hardware acquisition constraints.

Step-by-Step Execution:

Created mockSensor.js to replicate the operational behavior of an ESP32 microcontroller paired with a DHT22 sensor.

Configured the script to generate realistic horticultural cold chain parameters (temperatures between 2.0°C–6.0°C and humidity levels between 85%–95%).

Automated an interval loop to dispatch HTTP POST payloads to the backend every 10 seconds, successfully populating the Firebase database with live data streams.

Phase D: Frontend Dashboard & QR Generation (08_Frontend)
Action Taken: Initialized a modern React application using Vite and implemented the operator control panel.

Step-by-Step Execution:

Initialized the Vite React template inside the 08_Frontend directory and installed dependencies including firebase, recharts, qrcode.react, and axios.

Configured frontend Firebase hooks to listen directly to the Realtime Database.

Built the user interface (App.jsx) featuring two primary modules:

Live Environmental Monitoring Module: Utilizes Recharts to render a dynamic, real-time line graph plotting temperature and humidity updates as they arrive from the sensor stream.

Produce Batch Registration & Traceability Module: Provides a form to register produce details through the backend API and instantly renders a scannable QRCodeSVG linked to the unique batch identifier.

3. Summary of Accomplishments
By the end of today's session, the following milestones have been fully achieved and verified:

Working Data Pipeline: Sensor payloads flow seamlessly from a simulation client through an Express backend into a cloud-hosted Firebase database in real time.

Live Visual Analytics: The React frontend successfully charts live temperature and humidity metrics without requiring manual page refreshes.

Traceability Mechanism: The system programmatically generates unique, standards-compliant QR codes upon batch registration.

Monorepo Hygiene: All code and documentation remain neatly organized within your structured GitHub repository framework.

4. Next Steps (Upcoming Session)
As mapped out in our architectural roadmap, our next session will focus on Objective 2 (Blockchain Integration):

Initializing Hardhat inside the 10_Blockchain directory.

Writing a lightweight Solidity smart contract (ColdChainTrace.sol) to anchor critical supply chain event hashes.

Deploying and testing the contract on the Polygon Amoy testnet using ethers.js.