# Backend AeroGenIoT

API NestJS 10 + Prisma 5 + PostgreSQL + Socket.IO 4.7 para telemetria de aerogenerador.

## Endpoints clave

- `POST /api/v1/readings/ingest` (protegido con header `x-api-key`)
- `GET /api/v1/readings/latest?deviceId=AE-01`
- `GET /api/v1/alerts/recent?deviceId=AE-01`

## Variables requeridas

- `DATABASE_URL`
- `INGEST_API_KEY`
- `DEFAULT_LOAD_W` (fallback cuando no llega `loadPowerW`)

Umbrales de alerta:
- `ALERT_WIND_DANGEROUS_MS` (default 20)
- `ALERT_GEN_TEMP_HIGH_C` (default 80)
- `ALERT_VIBRATION_HIGH_RMS` (default 6)
- `ALERT_BATTERY_LOW_PCT` (default 20)

## Ejecucion local

```bash
cd app/backend
npm ci
npm run prisma:generate
npx prisma migrate dev
npm run start:dev
```

## App Runner

`apprunner.yaml` ya esta configurado para:
- build: `npm ci`, `npm run prisma:generate`, `npm run build`
- run: `node scripts/apprunner-start.js`

El script `scripts/apprunner-start.js` ejecuta `prisma migrate deploy` antes de iniciar `dist/main.js`.

## Simulador CLI (Node 22)

```bash
cd c:/AeroGenIoT
set API_BASE=https://TU-APP-RUNNER
set INGEST_API_KEY=TU_API_KEY
node tools/simulate-ae01.mjs --mode=auto --interval=5000
```
