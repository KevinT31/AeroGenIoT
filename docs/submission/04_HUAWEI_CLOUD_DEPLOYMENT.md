# 04 Huawei Cloud Deployment

## Scope of This Document

This document describes the real deployed cloud pattern used by Aurora Noctua according to the implemented project reality provided for the regional submission. It deliberately distinguishes between:

- what is deployed in production
- what is versioned in the repository
- what still needs to be exported before the final ZIP submission

## Production Summary

Aurora Noctua is deployed publicly with:

- Huawei ECS for the application server
- Huawei MySQL RDS for operational storage
- Huawei IoTDA for telemetry ingestion
- Nginx as public reverse proxy
- PM2 as Node.js process manager
- Huawei Cloud DNS for the public domain
- HTTPS enabled for the public site

Public domain:

- `https://auroranoctua2026.lat`

## ECS Creation Summary

The production backend is hosted on a Huawei ECS instance running Ubuntu Linux. The repository does not include an infrastructure template for ECS creation, so the server provisioning parameters must be documented by the deployment owner outside the codebase if judges require exact machine sizing.

Minimum deployment roles performed on ECS:

- clone or update repository from GitHub
- install Node.js and npm
- install PM2
- install Nginx
- build backend
- build dashboard
- serve the backend and dashboard behind Nginx

## Ubuntu Server Setup

Typical required packages on the ECS host:

- `git`
- `curl`
- `nginx`
- Node.js runtime
- npm
- PM2

The exact package installation log is not stored in the repository. This should be captured manually if the final ZIP needs operator runbooks or host setup transcripts.

## Security Group Ports

Recommended and actually relevant ports for the described production pattern:

| Port | Purpose | Exposure |
| --- | --- | --- |
| 22 | SSH administration | Restricted to administrators |
| 80 | HTTP redirect or temporary validation | Public, usually redirected to 443 |
| 443 | Public HTTPS for dashboard, API, Swagger, and realtime | Public |
| 3000 | Backend application port during setup and local binding | Prefer internal-only, behind Nginx |

The repository does not contain the exact Huawei security group export. Add that screenshot or export separately if required by the judges.

## Node.js, Nginx, and PM2 Installation

The repository assumes a Node-based backend and frontend build process. The actual runtime deployment on ECS uses PM2 to keep the backend alive and Nginx to proxy or serve the public application.

Representative backend runtime flow:

```bash
cd /opt/aurora-noctua/app/backend
npm ci
npm run prisma:generate
npm run build
pm2 start dist/main.js --name aurora-backend
pm2 save
```

Representative dashboard build flow:

```bash
cd /opt/aurora-noctua/app/dashboard
npm ci
npm run build
```

The repository does not include a checked-in PM2 ecosystem file. That is a missing operational artifact.

## MySQL RDS Connectivity

The backend uses a MySQL connection string through `DATABASE_URL`.

Sanitized example:

```env
DATABASE_URL=mysql://<AURORA_APP_USER>:<AURORA_DB_PASSWORD>@<AURORA_MYSQL_HOST>:3306/aurora_iot
```

Implemented backend modes relevant to Aurora Noctua:

- `READINGS_SOURCE=telemetry_table`
- `TELEMETRY_TABLE_NAME=app_telemetry_compat`
- `AI_FAULT_TABLE_NAME=ai_fault_predictions`
- `AI_POWER_TABLE_NAME=ai_power_forecast`
- `AI_YAW_TABLE_NAME=ai_yaw_recommendations`

The repository includes sanitized Huawei-oriented examples in:

- `app/backend/.env.huawei.mysql.example`
- `app/dashboard/.env.huawei.example`
- `app/mobile/.env.huawei.example`

## Backend Service Account

The repository suggests an application-level MySQL user but does not expose a real secret. Use placeholders only:

- MySQL user: `<AURORA_APP_USER>`
- MySQL password: `<AURORA_DB_PASSWORD>`
- JWT secret: `<JWT_SECRET>`
- ingest API key: `<INGEST_API_KEY>`
- IoTDA bridge token: `<IOTDA_HTTP_PUSH_TOKEN>`

## Nginx Reverse Proxy Role

Nginx is responsible for:

- terminating HTTPS
- serving the public dashboard build
- proxying `/api/v1` to the backend
- proxying `/docs` to Swagger
- proxying `/realtime` for Socket.IO

Representative Nginx routing responsibilities:

- `/` -> dashboard static build
- `/api/v1/` -> `http://127.0.0.1:3000/api/v1/`
- `/docs` -> backend Swagger
- `/realtime` -> backend Socket.IO namespace

The exact production Nginx config is not versioned in this repository and should be exported before the final submission if configuration evidence is needed.

## Cloud DNS Domain Routing

The public domain is:

- `auroranoctua2026.lat`

Huawei Cloud DNS routes that domain to the production deployment. The repository does not contain DNS zone exports or screenshots, so those remain separate operational evidence items.

## HTTPS Setup

HTTPS is already active in production. The repository does not record the exact certificate issuance or renewal process. Therefore, this document only states the implemented outcome:

- public HTTPS is enabled
- the dashboard is publicly reachable
- the backend is publicly exposed behind Nginx

Missing detail that should be added outside the repository if required:

- certificate provider
- renewal process
- certificate management procedure

## Dashboard Static Deployment

The dashboard is a Vite application. The deployed flow is:

1. configure production environment values
2. run `npm run build`
3. publish the generated `dist/` folder through Nginx

This repository contains the source and build scripts, but it does not contain the actual server-side Nginx site file used in production.

## Backend Deployment Flow

The production backend flow is:

1. configure environment variables for RDS, IoTDA, and AI table names
2. install backend dependencies
3. generate Prisma client
4. build NestJS output
5. run under PM2
6. expose through Nginx

Relevant repository files:

- `app/backend/package.json`
- `app/backend/prisma/schema.prisma`
- `app/backend/src/main.ts`
- `app/backend/src/modules/readings/readings.controller.ts`
- `app/backend/src/modules/ai/ai.controller.ts`

## Mobile App Connection to the Cloud Backend

The mobile app points to the same backend through:

- `EXPO_PUBLIC_API_BASE`
- `EXPO_PUBLIC_REALTIME_ENABLED`
- `EXPO_PUBLIC_USE_MOCK`

The mobile app is not deployed on ECS; it is distributed as a mobile client that consumes the deployed HTTPS backend.

## Update Workflow From GitHub to Cloud

The repository is open-sourced on GitHub and the cloud deployment is updated from that source.

Recommended operator workflow:

```bash
cd /opt/aurora-noctua
git pull origin main

cd app/backend
npm ci
npm run prisma:generate
npm run build
pm2 restart aurora-backend

cd ../dashboard
npm ci
npm run build
sudo systemctl reload nginx
```

This reflects the implemented deployment pattern, but the repository does not contain a single automated deploy script for ECS.

## Repository Reality vs Historical Files

The file `app/backend/apprunner.yaml` still exists in the repository. For the regional submission, it should be treated as a historical or legacy deployment file rather than the authoritative description of the current Huawei ECS deployment.
