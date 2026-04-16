# Aurora Noctua Dashboard

Technical web dashboard for AeroGenIoT. This app is designed for the control center and specialized operators, not for the end-user mobile experience.

## What it includes

- Mission-control overview with KPI cards, connectivity, health score, active alarms, maintenance summary, and recent behavior.
- Premium 2D digital twin of the wind turbine with animated rotor, component overlays, status colors, and live state reactions.
- Detailed telemetry module with time-range filters and charts for wind, power, energy, temperature, vibration, voltage, current, and load.
- Alarm center with severity, status, type, and recent-event filtering.
- Intelligent maintenance module split into corrective, preventive, and predictive lanes.
- Device technical view with latest reading, operating context, timestamps, power source, mode, and technical summary.

## Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Framer Motion
- Socket.IO client

## Run locally

```bash
cd app/dashboard
copy .env.example .env
npm install
npm run dev
```

The app starts in Vite dev mode. By default it expects the backend at `http://localhost:3000`.

## Environment variables

`VITE_API_BASE`
Backend origin. Example: `http://localhost:3000`. The client app appends `/api/v1` internally for REST and uses `/realtime` for Socket.IO.

`VITE_DEVICE_ID`
Primary device shown in the dashboard.

`VITE_FARM_ID`, `VITE_PLOT_ID`
Optional scope fields for protected history endpoints.

`VITE_REQUEST_TIMEOUT_MS`
HTTP timeout for REST calls.

`VITE_POLL_MS`
Polling interval for snapshot refresh.

`VITE_STALE_AFTER_MS`
Threshold used to mark data as stale.

`VITE_REALTIME_ENABLED`
Enables Socket.IO subscription to `/realtime`.

`VITE_USE_MOCK`
Forces the dashboard into demo mode with synthetic data and derived alarms.

`VITE_ACCESS_TOKEN`
Optional bearer token. When present, the dashboard can consume protected backend endpoints such as `/api/v1/readings`.

`VITE_CLOUD_PROFILE`
Reserved selector for future Huawei Cloud profiles or other backend topologies.

`VITE_DEFAULT_THEME`
Initial theme mode. Current values: `dark` or `light`.

## Current backend compatibility

Today the dashboard works with the existing AeroGenIoT backend through adapters and service modules:

- `GET /api/v1/readings/latest?deviceId=...`
- `GET /api/v1/alerts/recent?deviceId=...`
- `POST /api/v1/alerts/:alertId/ack`
- `GET /api/v1/readings` when `VITE_ACCESS_TOKEN` is provided
- Socket.IO namespace or path at `/realtime` with `reading.new`, `alert.new`, and `alert.updated`

If historical series are not available, the dashboard falls back to synthetic trends seeded from the latest reading so the demo remains coherent without backend changes.

## Frontend architecture

### App shell

- `src/app/layout/DashboardLayout.tsx` provides the sidebar, top header, theme controls, refresh action, and responsive shell.
- `src/routes/*` contains page-level modules for Overview, Digital Twin, Telemetry, Alarms, Maintenance, and Device.

### State and orchestration

- `src/hooks/useDashboardData.tsx` is the dashboard state provider.
- It coordinates polling, realtime updates, range selection, refresh behavior, alarm acknowledge actions, and theme persistence.

### Clean models

- `src/types/dashboard.ts` defines frontend-first models such as `TelemetryPoint`, `AlarmItem`, `MaintenanceItem`, `SystemHealthSnapshot`, and `DigitalTwinState`.

### Services and adapters

- `src/services/apiClient.ts` wraps REST access and optional bearer auth.
- `src/services/adapters/aerogenAdapter.ts` normalizes backend payloads into stable UI models.
- `src/services/telemetryService.ts` loads latest and historical telemetry.
- `src/services/alertsService.ts` loads and acknowledges alerts.
- `src/services/deviceStatusService.ts` derives health score, connectivity, and overall status.
- `src/services/maintenanceService.ts` builds corrective, preventive, and predictive recommendations from rules.
- `src/services/digitalTwinService.ts` maps telemetry and alerts into component states for the 2D twin.
- `src/services/realtimeService.ts` handles Socket.IO subscription and live event updates.
- `src/services/mockData.ts` provides demo-safe mock datasets and synthetic history.

## Huawei Cloud readiness

The dashboard is intentionally decoupled from the current backend:

- UI screens read normalized models instead of raw API payloads.
- REST and realtime concerns are isolated in service modules.
- Backend-specific mapping lives in adapters, not in components.
- Mock mode and cloud profile config allow switching data sources without rewriting the UI.
- The current service boundaries can later target Huawei APIG, FunctionGraph, or a time-series backend by replacing service internals while preserving the same frontend contracts.

## Known limitations and debt

- Historical charts use a synthetic fallback when a protected time-series endpoint is unavailable.
- Maintenance intelligence is rule-based for now. It is prepared for future ML or expert-system enrichment.
- There is no dedicated auth flow UI yet; protected access is enabled through `VITE_ACCESS_TOKEN`.
- No unit or integration test suite has been added for adapters, derivation rules, or dashboard state orchestration.
