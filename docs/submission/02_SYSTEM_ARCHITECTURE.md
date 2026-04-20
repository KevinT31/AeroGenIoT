# 02 System Architecture

## End-to-End Architecture

Aurora Noctua is implemented as a hybrid edge and cloud system centered on Huawei Cloud services and a shared backend for web and mobile clients.

Text diagram:

```text
Sensors
  -> ESP32
  -> Raspberry Pi 4B
  -> Huawei IoTDA
  -> Huawei MySQL RDS
  -> Backend on Huawei ECS
  -> Nginx + PM2 + HTTPS + Cloud DNS
  -> Web Dashboard / Mobile App
```

Operational AI fit:

```text
Telemetry in MySQL RDS
  -> ModelArts training workflow (production reality)
  -> AI result tables in MySQL RDS
  -> /api/v1/ai/operational
  -> Dashboard and Mobile App
  -> Predictive maintenance decisions
```

## Component-by-Component Description

### 1. ESP32

The ESP32 is the sensing node. In the implemented local flow, it acquires physical measurements and sends data toward the gateway layer. The repository documents compatible reception through RF and UDP oriented scripts.

### 2. Raspberry Pi 4B

The Raspberry Pi 4B acts as the edge or gateway device in the physical deployment. It is the local bridge between sensor-side acquisition and the cloud ingestion flow, and it is represented in the repository through the Raspberry Pi telemetry profile.

### 3. Huawei IoTDA

Huawei IoTDA is the cloud telemetry ingestion service used by Aurora Noctua. The Python gateway scripts are structured to publish turbine telemetry through IoTDA-compatible MQTT property reports. The backend also supports an IoTDA HTTP property-push bridge endpoint.

### 4. Huawei MySQL RDS

MySQL RDS is the operational data layer for:

- normalized telemetry access
- AI operational outputs
- backend query surfaces for dashboard and mobile

The backend can read telemetry from a compatibility table or view and can read AI outputs from the three operational AI tables.

### 5. Huawei ModelArts

ModelArts is part of the real cloud workflow used for the project AI lifecycle. In the repository, the visible implemented path is the inference-side integration through MySQL tables and the operational API. The training jobs, exported notebooks, and weights are not currently versioned here and are listed as missing submission artifacts.

### 6. Backend on Huawei ECS

The backend is a NestJS service. It exposes:

- telemetry endpoints
- alert endpoints
- operational AI endpoint
- realtime Socket.IO namespace
- Swagger documentation

It is the integration layer between MySQL, cloud telemetry ingestion, and the two frontend clients.

### 7. Nginx and PM2

Nginx provides the public reverse proxy layer, HTTPS termination, and routing for static frontend delivery and backend endpoints. PM2 supervises the backend runtime on ECS.

### 8. Web Dashboard

The dashboard is the control-center interface. It presents:

- mission overview
- telemetry charts
- digital twin
- alarms
- maintenance
- device detail
- AI operational outputs

### 9. Mobile App

The mobile app connects to the same backend but serves a simpler audience. It is intended for farmers and non-technical users who need a direct view of the turbine state without the full technical dashboard complexity.

### 10. Huawei Cloud DNS and HTTPS

Cloud DNS routes the public domain to the production deployment, and HTTPS secures the public experience for the dashboard and backend exposure.

## Production-Oriented Data Paths

### Telemetry Path

1. Sensors are sampled by the ESP32.
2. Data reaches the Raspberry Pi 4B or a compatible local gateway path.
3. Telemetry is published to Huawei IoTDA.
4. Data is normalized into MySQL-backed operational storage.
5. The backend exposes latest and historical readings.
6. Dashboard and mobile consume those readings.

### AI Path

1. Telemetry history is used in the cloud training workflow.
2. Model outputs are materialized into MySQL AI tables.
3. The backend reads the latest AI rows per device.
4. The frontend surfaces fault, power, and yaw insights.
5. Predictive maintenance logic derives visit planning suggestions.

## Repository-Specific Notes

- `app/backend/apprunner.yaml` is retained in the repository as a historical deployment file and is not the authoritative description of the Huawei ECS production deployment.
- The repository includes optional local tools such as `tools/simulate-ae01.mjs` and `tools/node-red-ae01-flow.json` for demonstration and testing.
- The root Python scripts are part of the telemetry demonstration path and preserve the cloud payload format used by the rest of the system.
