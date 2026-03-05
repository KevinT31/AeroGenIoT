# AeroGenIoT Monorepo

Monorepo con:
- `app/backend`: API NestJS + Prisma + Socket.IO para ingest IoT.
- `app/mobile`: app Expo (Android APK) con dashboard moderno.
- `tools/simulate-ae01.mjs`: simulador CLI Node 22.
- `tools/node-red-ae01-flow.json`: flujo Node-RED para enviar lecturas cada 5s.

## Flujo completo

Laptop (CLI o Node-RED) -> `POST /api/v1/readings/ingest` -> App Runner -> Postgres + Socket.IO -> App movil

## Inicio rapido

### 1) Backend local

```bash
cd app/backend
npm ci
npm run prisma:generate
npx prisma migrate dev
npm run start:dev
```

### 2) Simulador CLI

```bash
cd c:/AeroGenIoT
set API_BASE=http://localhost:3000
set INGEST_API_KEY=dev-ingest-key
node tools/simulate-ae01.mjs --mode=auto --interval=5000
```

### 3) Mobile Expo

```bash
cd app/mobile
copy .env.example .env
npm install
npm run start
```

### 4) APK release (EAS)

```bash
cd app/mobile
npx eas login
npm run apk:release
```

## Node-RED

Importa `tools/node-red-ae01-flow.json` y configura variables de entorno del runtime:
- `API_BASE`
- `INGEST_API_KEY`
- `DEVICE_ID` (opcional)
- `FARM_ID` (opcional)
- `PLOT_ID` (opcional)
