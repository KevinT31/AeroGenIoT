# 03 Reproducibility Guide

## Purpose

This guide explains how to reproduce the currently implemented repository behavior as accurately as possible from source code. It is intentionally honest: where training exports or infrastructure details are not versioned in the repository, the guide marks them clearly instead of guessing.

## Prerequisites

Required for the main repository:

- Node.js 20 or 22
- npm
- MySQL 8 compatible database
- Git

Recommended for local backend support:

- Docker and Docker Compose

Required for mobile development:

- Expo CLI workflow through `npm run start`
- Android Studio or a physical Android device for APK testing

Required for optional edge script reproduction:

- Python 3.10 or newer
- `paho-mqtt`

Optional and Raspberry Pi specific:

- an RF24-compatible Python binding such as `rf24_py`
- compatible nRF24L01 hardware and system libraries

Important limitation:

The repository does not include a pinned Python dependency file for the edge scripts. See [09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md](09_MISSING_ITEMS_AND_HOW_TO_GENERATE_THEM.md) for the required packaging action before the final ZIP submission.

## Local Setup

Clone the repository:

```bash
git clone https://github.com/KevinT31/AeroGenIoT.git
cd AeroGenIoT
```

## Backend

### 1. Prepare Environment Variables

Choose one of these starting points:

- `app/backend/.env.example` for local development
- `app/backend/.env.huawei.mysql.example` for Huawei-style MySQL deployment

Create `app/backend/.env` and fill in sanitized values such as:

- `DATABASE_URL`
- `JWT_SECRET`
- `INGEST_API_KEY`
- `IOTDA_HTTP_PUSH_TOKEN`
- `READINGS_SOURCE`
- `TELEMETRY_TABLE_NAME`
- `AI_FAULT_TABLE_NAME`
- `AI_POWER_TABLE_NAME`
- `AI_YAW_TABLE_NAME`

### 2. Optional Local MySQL and MinIO

The repository includes `app/backend/docker-compose.yml`.

```bash
cd app/backend
docker compose up -d
```

### 3. Install and Start

```bash
cd app/backend
npm ci
npm run prisma:generate
npm run prisma:push
npm run start:dev
```

Expected local behavior:

- API base at `http://localhost:3000/api/v1`
- Swagger at `http://localhost:3000/docs`
- Socket.IO namespace at `http://localhost:3000/realtime`

### 4. Key Endpoints Used by Aurora Noctua

- `GET /api/v1/readings/latest?deviceId=<DEVICE_ID>`
- `GET /api/v1/readings?deviceId=<DEVICE_ID>`
- `POST /api/v1/readings/ingest`
- `POST /api/v1/readings/iotda/property-push`
- `GET /api/v1/alerts/recent?deviceId=<DEVICE_ID>`
- `GET /api/v1/ai/operational?deviceId=<DEVICE_ID>`

## Dashboard

### 1. Prepare Environment Variables

Choose one of:

- `app/dashboard/.env.example`
- `app/dashboard/.env.huawei.example`

Create `app/dashboard/.env.local`.

Minimum values:

```env
VITE_API_BASE=http://localhost:3000
VITE_DEVICE_ID=AE-01
VITE_REALTIME_ENABLED=true
VITE_USE_MOCK=false
```

### 2. Install and Run

```bash
cd app/dashboard
npm ci
npm run dev
```

### 3. Build Validation

```bash
cd app/dashboard
npm run typecheck
npm run build
```

## Mobile

### 1. Prepare Environment Variables

Choose one of:

- `app/mobile/.env.example`
- `app/mobile/.env.huawei.example`

Create `app/mobile/.env`.

Minimum values:

```env
EXPO_PUBLIC_API_BASE=http://localhost:3000
EXPO_PUBLIC_DEVICE_ID=AE-01
EXPO_PUBLIC_REALTIME_ENABLED=true
EXPO_PUBLIC_USE_MOCK=false
```

### 2. Install and Run

```bash
cd app/mobile
npm ci
npm run start
```

### 3. Type Validation

```bash
cd app/mobile
npm run typecheck
```

### 4. Android APK Build

```bash
cd app/mobile
npm run apk:release
```

## Optional Edge Reproduction

These scripts are useful for demonstrating the telemetry path even when the full hardware deployment is unavailable.

### Backend HTTP Ingest Simulator

```bash
cd C:/AeroGenIoT
set API_BASE=http://localhost:3000
set INGEST_API_KEY=dev-ingest-key
node tools/simulate-ae01.mjs --mode=auto --interval=5000
```

### PC Telemetry Profile

Install Python dependencies manually:

```bash
pip install paho-mqtt
```

Then run:

```bash
python iotdaPC.py
```

This profile is designed for laptop testing with UDP telemetry reception when the ESP32 points to the laptop IP, with simulation fallback preserved.

### Raspberry Pi Telemetry Profile

Required:

- Python with `paho-mqtt`
- RF24-compatible binding if RF reception is needed

Run:

```bash
python iotdaRasberry.py
```

This profile keeps RF and UDP enabled, with simulation as the final fallback.

## AI Training

### What Is Reproducible From the Repository

The repository reproduces the inference-side integration of operational AI, not the full cloud training workflow.

Present in the repository:

- backend normalization of AI tables
- API endpoint `GET /api/v1/ai/operational`
- dashboard and mobile UI consumption of AI outputs
- predictive maintenance derivation based on AI outputs

### What Is Missing

The following training materials are not versioned here:

- ModelArts training source code or notebooks
- exported training datasets
- serialized model weights
- training logs

Until those artifacts are added, full model retraining cannot be reproduced only from this repository.

## AI Inference

### Repository-Side Inference Integration

The backend expects three MySQL tables:

- `ai_fault_predictions`
- `ai_power_forecast`
- `ai_yaw_recommendations`

Configure the backend environment and ensure those tables exist in MySQL.

Then:

```bash
curl "http://localhost:3000/api/v1/ai/operational?deviceId=AE-01"
```

The backend reads the latest row from each table, normalizes flexible column names, and returns one consolidated operational AI snapshot.

### Frontend Behavior

- When the backend API is available, dashboard and mobile read operational AI from the backend.
- When mock mode is enabled, both clients can derive synthetic AI values from live telemetry for UI demonstration.

## Deployment Notes

### Production Reality

The actual deployed architecture is Huawei ECS + Huawei MySQL RDS + Huawei IoTDA + Nginx + PM2 + Cloud DNS + HTTPS.

### Repository Limitation

The repository does not contain:

- versioned Nginx production config
- PM2 ecosystem files
- infrastructure-as-code for ECS and DNS
- HTTPS certificate automation files

Those missing operational assets should be exported separately for a fully reproducible regional submission package.
