<div align="center">

# Aurora Noctua

### Wind-Turbine Monitoring · IoT · Cloud · Operational AI

**1st Place — Huawei ICT Competition, National Stage**

[Public deployment](https://auroranoctua2026.lat) · [System architecture](./docs/submission/02_SYSTEM_ARCHITECTURE.md) · [Reproducibility guide](./docs/submission/03_REPRODUCIBILITY_GUIDE.md)

</div>

---

## Overview

**Aurora Noctua** is a wind-turbine monitoring and operational-intelligence platform built around edge sensing, Huawei Cloud telemetry, a backend API, a web control center and a mobile application.

The implemented system connects:

- ESP32-oriented sensing
- Raspberry Pi 4B edge/gateway flows
- Huawei IoTDA telemetry ingestion
- Huawei MySQL RDS
- NestJS backend services
- React/Vite operational dashboard
- Expo/React Native mobile application
- operational AI outputs for fault, power and yaw insights

## Problem

Small and distributed wind-energy deployments need a practical way to:

- observe turbine behavior
- detect abnormal conditions
- centralize telemetry
- support maintenance
- communicate useful information to both technical and non-technical users

Without an integrated platform, sensor data, cloud dashboards and maintenance decisions remain fragmented.

## Architecture

~~~mermaid
flowchart LR
    Sensors[Sensors] --> ESP32[ESP32]
    ESP32 --> Pi[Raspberry Pi 4B]
    Pi --> IoTDA[Huawei IoTDA]

    IoTDA --> RDS[(Huawei MySQL RDS)]
    RDS --> API[NestJS Backend on ECS]

    API --> Web[React Dashboard]
    API --> Mobile[Expo / React Native]

    AI[Operational AI Results] --> RDS
    API --> Realtime[Socket.IO Realtime]
~~~

## Huawei Cloud Services

The implemented cloud architecture uses:

- **Huawei IoTDA**
- **Huawei MySQL RDS**
- **Huawei ECS**
- **Huawei Cloud DNS**
- **Huawei ModelArts integration/training context**
- **Nginx + HTTPS**
- **PM2** for backend process supervision

## Product Surfaces

### Operations Dashboard

The web dashboard provides the control-center experience for:

- telemetry
- alerts
- fleet/device status
- maintenance-oriented views
- operational AI outputs

### Mobile App

The mobile application exposes a simplified view of the same backend for non-technical/end users.

### Backend

The NestJS API provides:

- REST endpoints under **/api/v1**
- Swagger documentation
- realtime traffic through Socket.IO
- telemetry and alert services
- operational AI normalization

## Operational AI Path

The repository implements the **inference-side integration** for three operational outputs:

- fault predictions
- power forecasts
- yaw recommendations

~~~text
Telemetry
   ↓
MySQL-backed operational data
   ↓
AI result tables
   ↓
NestJS normalization endpoint
   ↓
Dashboard / Mobile
   ↓
Maintenance and operational insights
~~~

The repository does **not** claim to include every training artifact. Complete ModelArts training exports, model weights and training logs are tracked separately in the submission documentation.

## Repository Structure

~~~text
.
├── app/
│   ├── backend/       NestJS API
│   ├── dashboard/     React/Vite operations dashboard
│   └── mobile/        Expo/React Native application
├── tools/
│   ├── node-red-ae01-flow.json
│   └── simulate-ae01.mjs
├── iotda_motorbase.py
├── iotdaPC.py
├── iotdaRasberry.py
└── docs/submission/   architecture, deployment and reproducibility docs
~~~

## Run Locally

### Backend

~~~bash
cd app/backend
cp .env.example .env
npm ci
npm run prisma:generate
npm run prisma:push
npm run start:dev
~~~

Local API:

~~~text
http://localhost:3000/api/v1
~~~

Swagger:

~~~text
http://localhost:3000/docs
~~~

### Dashboard

~~~bash
cd app/dashboard
cp .env.example .env.local
npm ci
npm run dev
~~~

### Mobile

~~~bash
cd app/mobile
cp .env.example .env
npm ci
npm run start
~~~

## Edge / Telemetry Reproduction

The repository includes supporting tools for edge-to-cloud demonstration:

- **iotda_motorbase.py** — shared hybrid telemetry publisher
- **iotdaPC.py** — PC profile
- **iotdaRasberry.py** — Raspberry Pi profile
- **tools/simulate-ae01.mjs** — backend ingest simulator
- **tools/node-red-ae01-flow.json** — local telemetry scenario

These tools support development/reproduction and are not substitutes for the Huawei Cloud production path.

## Implementation Status

### Present in the repository/deployment

- hybrid edge telemetry path
- Huawei IoTDA integration
- MySQL-backed API
- public dashboard
- mobile app
- operational AI API integration
- maintenance-oriented views
- HTTPS deployment architecture

### Tracked as missing submission artifacts

- exported ModelArts training source/notebooks
- saved model weights
- training logs
- inference execution logs
- sanitized AI dataset samples
- final competition slide-deck artifacts

This distinction is intentional: the repository separates **implemented operational integration** from **training/submission evidence that is not versioned here**.

## Technical Documentation

- [Project overview](./docs/submission/01_PROJECT_OVERVIEW.md)
- [System architecture](./docs/submission/02_SYSTEM_ARCHITECTURE.md)
- [Reproducibility guide](./docs/submission/03_REPRODUCIBILITY_GUIDE.md)
- [Huawei Cloud deployment](./docs/submission/04_HUAWEI_CLOUD_DEPLOYMENT.md)
- [Model implementation / training / inference](./docs/submission/05_MODEL_IMPLEMENTATION_TRAINING_AND_INFERENCE.md)
- [Datasets and artifacts](./docs/submission/06_DATASETS_AND_ARTIFACTS.md)
- [Open-source evidence](./docs/submission/07_OPEN_SOURCE_EVIDENCE.md)
- [Submission checklist](./docs/submission/08_SUBMISSION_CHECKLIST.md)
- [Missing items and generation notes](./docs/submission/09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md)

---

### What this project demonstrates

**IoT · edge/cloud architecture · Huawei Cloud · backend/mobile/web integration · realtime telemetry · operational AI · deployment engineering**
