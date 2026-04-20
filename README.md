# Aurora Noctua

Aurora Noctua is a Huawei Cloud based wind-turbine monitoring and operational intelligence project that connects edge sensing, cloud telemetry ingestion, a public web dashboard, and a farmer-facing mobile app. In the current implemented repository, the system covers telemetry ingestion from ESP32 and Raspberry Pi 4B edge flows, cloud storage and API access through MySQL-backed services, live visualization, alerting, maintenance support, and operational AI outputs for fault prediction, power forecasting, and yaw recommendation.

## Problem

Small and distributed wind-energy deployments need a practical way to observe turbine behavior, detect abnormal conditions early, and communicate useful information to both technical operators and non-technical end users. Without a unified platform, telemetry stays fragmented across local devices, cloud dashboards, and ad hoc maintenance workflows.

## Solution Summary

Aurora Noctua consolidates the wind-turbine stack into one operational flow:

- ESP32 performs sensing and sends data toward the gateway layer.
- Raspberry Pi 4B acts as the edge or gateway path when the physical deployment is used.
- Huawei IoTDA ingests device telemetry in the cloud.
- Huawei MySQL RDS stores normalized telemetry and operational AI results.
- A NestJS backend exposes telemetry, alerts, and AI operational endpoints.
- A public web dashboard provides the control-center view.
- A mobile app provides simplified status access for farmers and other non-technical users.

## Implemented Architecture Summary

Implemented production architecture:

Sensors -> ESP32 -> Raspberry Pi 4B -> Huawei IoTDA -> Huawei MySQL RDS -> Backend on Huawei ECS -> Nginx/PM2 -> Web dashboard and mobile app

Operational AI fits into the flow through MySQL-backed prediction tables consumed by the backend and exposed through the production API. The repository contains the inference-side integration and UI consumption of those outputs. Training exports, model weights, and training logs are not versioned in this repository and are documented as missing submission artifacts in [docs/submission/09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md](docs/submission/09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md).

## Real Huawei Cloud Services Used

- Huawei IoTDA
- Huawei MySQL RDS
- Huawei ModelArts
- Huawei ECS
- Huawei Cloud DNS
- HTTPS-enabled public deployment behind Nginx
- PM2 process supervision on the application server

## Repository Structure

```text
.
|-- app/
|   |-- backend/     # NestJS API, telemetry ingestion, alerts, operational AI endpoint
|   |-- dashboard/   # React/Vite web dashboard for the control center
|   `-- mobile/      # Expo/React Native mobile app for end users
|-- tools/
|   |-- node-red-ae01-flow.json
|   `-- simulate-ae01.mjs
|-- iotda_motorbase.py   # hybrid telemetry publisher and simulator core
|-- iotdaPC.py           # PC profile: UDP + simulation fallback
|-- iotdaRasberry.py     # Raspberry Pi profile: RF + UDP + simulation fallback
|-- pc_hybrid_telemetry_log.csv
|-- pc_simulated_hybrid_telemetry_log.csv
`-- docs/submission/     # competition-ready documentation package
```

## Running the Backend Locally

1. Start from `app/backend/.env.example` for local development, or from `app/backend/.env.huawei.mysql.example` for Huawei Cloud style configuration.
2. Make sure MySQL is available. A local Docker Compose file is included under `app/backend/docker-compose.yml`.
3. Run:

```bash
cd app/backend
cp .env.example .env
npm ci
npm run prisma:generate
npm run prisma:push
npm run start:dev
```

The backend starts on `http://localhost:3000`, serves the REST API under `/api/v1`, exposes Swagger under `/docs`, and exposes Socket.IO realtime traffic under `/realtime`.

## Running the Dashboard Locally

1. Start from `app/dashboard/.env.example` or `app/dashboard/.env.huawei.example`.
2. Run:

```bash
cd app/dashboard
cp .env.example .env.local
npm ci
npm run dev
```

The dashboard expects the backend origin in `VITE_API_BASE`. REST calls are made through `/api/v1`, and realtime updates use `/realtime`.

## Running the Mobile App Locally

1. Start from `app/mobile/.env.example` or `app/mobile/.env.huawei.example`.
2. Run:

```bash
cd app/mobile
cp .env.example .env
npm ci
npm run start
```

For Android release packaging, the repo already includes the `apk:release` script:

```bash
cd app/mobile
npm run apk:release
```

## Optional Edge and Telemetry Reproduction

The repository also includes local hybrid telemetry scripts for the edge-to-cloud demonstration:

- `iotda_motorbase.py`: shared hybrid publisher core
- `iotdaPC.py`: laptop profile, focused on UDP input from ESP32 over the same network
- `iotdaRasberry.py`: Raspberry Pi profile, intended for RF plus UDP reception
- `tools/simulate-ae01.mjs`: simple HTTP ingest simulator for backend testing
- `tools/node-red-ae01-flow.json`: local Node-RED scenario generator

These scripts help demonstrate telemetry ingestion, CSV logging, and IoTDA publication, but they are not substitutes for the Huawei Cloud backend.

## Understanding the AI Pipeline

The implemented repository contains the operational AI integration path:

1. Telemetry is stored in MySQL-backed tables.
2. AI outputs are expected in three MySQL tables:
   - `ai_fault_predictions`
   - `ai_power_forecast`
   - `ai_yaw_recommendations`
3. The backend normalizes those tables through `GET /api/v1/ai/operational`.
4. The dashboard and mobile app consume that endpoint and render fault, power, and yaw insights.
5. Predictive maintenance views derive field-visit suggestions from those AI outputs.

The repository does not currently include complete ModelArts training source exports, saved model weights, or training logs. See:

- [docs/submission/05_MODEL_IMPLEMENTATION_TRAINING_AND_INFERENCE.md](docs/submission/05_MODEL_IMPLEMENTATION_TRAINING_AND_INFERENCE.md)
- [docs/submission/06_DATASETS_AND_ARTIFACTS.md](docs/submission/06_DATASETS_AND_ARTIFACTS.md)
- [docs/submission/09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md](docs/submission/09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md)

## High-Level Cloud Reproduction

At a high level, the production deployment is reproduced as follows:

1. Provision Huawei Cloud ECS.
2. Provision Huawei MySQL RDS.
3. Configure Huawei IoTDA telemetry ingestion.
4. Deploy the backend on ECS and manage it with PM2.
5. Place Nginx in front of the backend for HTTPS, `/docs`, `/api/v1`, and `/realtime`.
6. Build and deploy the dashboard as a public web frontend.
7. Point the mobile app to the same production backend.
8. Publish the domain through Huawei Cloud DNS and enable HTTPS.

Detailed deployment notes are documented in [docs/submission/04_HUAWEI_CLOUD_DEPLOYMENT.md](docs/submission/04_HUAWEI_CLOUD_DEPLOYMENT.md).

## Public Deployment

Public web domain:

- `https://auroranoctua2026.lat`

The dashboard is publicly deployed there, and the backend and Swagger are also exposed through the production HTTPS stack behind Nginx.

## Implemented Status vs. Future Work

Implemented in the repository and deployment reality:

- Hybrid edge telemetry flow with ESP32 and Raspberry Pi oriented scripts
- Huawei IoTDA ingestion path
- MySQL-backed backend API
- Public dashboard
- Mobile app connected to the same backend
- Operational AI API integration for fault prediction, power forecasting, and yaw recommendation
- Predictive, preventive, and corrective maintenance views derived from telemetry and AI outputs

Still required before a fully complete regional submission ZIP:

- Exported ModelArts training code or notebooks
- Saved model weights or serialized artifacts
- Training logs
- Inference execution logs
- Sanitized dataset samples exported from production MySQL AI tables
- Open-source repository screenshot
- Final competition slide deck

## Open-Source Evidence

Repository URL identified from the Git remote:

- `https://github.com/KevinT31/AeroGenIoT`

See the dedicated evidence note:

- [docs/submission/07_OPEN_SOURCE_EVIDENCE.md](docs/submission/07_OPEN_SOURCE_EVIDENCE.md)

## Submission Documentation

Competition-ready documentation is grouped under:

- [docs/submission/01_PROJECT_OVERVIEW.md](docs/submission/01_PROJECT_OVERVIEW.md)
- [docs/submission/02_SYSTEM_ARCHITECTURE.md](docs/submission/02_SYSTEM_ARCHITECTURE.md)
- [docs/submission/03_REPRODUCIBILITY_GUIDE.md](docs/submission/03_REPRODUCIBILITY_GUIDE.md)
- [docs/submission/04_HUAWEI_CLOUD_DEPLOYMENT.md](docs/submission/04_HUAWEI_CLOUD_DEPLOYMENT.md)
- [docs/submission/05_MODEL_IMPLEMENTATION_TRAINING_AND_INFERENCE.md](docs/submission/05_MODEL_IMPLEMENTATION_TRAINING_AND_INFERENCE.md)
- [docs/submission/06_DATASETS_AND_ARTIFACTS.md](docs/submission/06_DATASETS_AND_ARTIFACTS.md)
- [docs/submission/07_OPEN_SOURCE_EVIDENCE.md](docs/submission/07_OPEN_SOURCE_EVIDENCE.md)
- [docs/submission/08_SUBMISSION_CHECKLIST.md](docs/submission/08_SUBMISSION_CHECKLIST.md)
- [docs/submission/09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md](docs/submission/09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md)
- [docs/submission/submission_manifest.json](docs/submission/submission_manifest.json)
