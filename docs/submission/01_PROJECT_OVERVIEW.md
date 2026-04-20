# 01 Project Overview

## What Aurora Noctua Is

Aurora Noctua is a wind-turbine monitoring and operational intelligence project built around an edge-to-cloud telemetry pipeline on Huawei Cloud. It combines device telemetry ingestion, backend normalization, live visualization, alerting, maintenance support, and operational AI outputs in one deployable system.

## Target Users

- Control-center and technical operators who need a detailed web dashboard
- Maintenance personnel who need alerts and predictive maintenance context
- Farmers and non-technical end users who need a simplified mobile view of the system state

## Implemented Scope

The implemented repository covers:

- ESP32 and Raspberry Pi oriented telemetry acquisition scripts
- Huawei IoTDA compatible telemetry publication
- MySQL-backed backend services
- Public web dashboard
- Mobile app connected to the same backend
- Operational AI output consumption for:
  - fault prediction
  - power forecasting
  - yaw recommendation
- Corrective, preventive, and predictive maintenance rendering

## What Is Already Working

- Telemetry ingestion into the backend through public APIs and IoTDA property-push mapping
- Historical and latest readings exposed by `deviceId`
- Realtime distribution through Socket.IO
- Public dashboard deployment over HTTPS
- Mobile app integration with the production backend
- Operational AI endpoint backed by MySQL AI tables
- Maintenance recommendations derived from telemetry, alerts, and AI outputs

## Important Repository Reality

This repository still contains broader legacy modules from the original AeroGenIoT monorepo, including generic agriculture, user, and reporting features. For the Huawei ICT Competition regional submission, the authoritative scope is the implemented Aurora Noctua wind-energy flow described in this document set.

## What Remains Future Work or Missing Submission Material

- Exported ModelArts training source code or notebooks
- Saved model weights
- Training and inference logs
- Sanitized sample exports from production AI tables
- Final slide deck for the competition template
- Open-source screenshot and final packaging evidence
