# Backend AeroGenIoT

API NestJS 10 + Prisma 5 + MySQL + Socket.IO 4.7 para telemetria de aerogenerador.

## Endpoints clave

- `POST /api/v1/readings/ingest` (protegido con header `x-api-key`)
- `POST /api/v1/readings/iotda/property-push` (push HTTP directo desde Huawei IoTDA)
- `GET /api/v1/readings/latest?deviceId=AE-01`
- `GET /api/v1/alerts/recent?deviceId=AE-01`

## Variables requeridas

- `DATABASE_URL`
- `PRISMA_DB_SYNC_MODE` (`push` recomendado en MySQL mientras no exista un historial nuevo de migraciones Prisma)
- `READINGS_SOURCE` (`prisma` o `telemetry_table`)
- `INGEST_API_KEY`
- `IOTDA_HTTP_PUSH_TOKEN` (recomendado para validar `timestamp`, `nonce` y `signature` del push)
- `DEFAULT_LOAD_W` (fallback cuando no llega `house_power_consumption_w`)

Umbrales de alerta:
- `ALERT_WIND_DANGEROUS_MS` (default 20)
- `ALERT_GEN_TEMP_HIGH_C` (default 70)
- `ALERT_VIBRATION_HIGH_RMS` (default 6)
- `ALERT_BATTERY_LOW_PCT` (default 20)
- `ALERT_BATTERY_CRITICAL_PCT` (default 10)
- `ALERT_BATTERY_DC_LOW_V` (default 42)
- `ALERT_BATTERY_DC_HIGH_A` (default 24)
- `ALERT_HOUSE_POWER_HIGH_W` (default 2200)
- `ALERT_AC_CURRENT_HIGH_A` (default 12)
- `ALERT_AC_VOLTAGE_LOW_V` (default 190)
- `ALERT_ROTOR_RPM_HIGH` (default 750)

## Ejecucion local

```bash
cd app/backend
npm ci
npm run prisma:generate
npm run prisma:push
npm run start:dev
```

## Sincronizacion del schema en MySQL

Las migraciones SQL actuales del directorio `prisma/migrations` fueron generadas para PostgreSQL.

Para MySQL, la ruta limpia e inmediata es:

- usar `npm run prisma:push` en desarrollo
- usar `PRISMA_DB_SYNC_MODE=push` en arranque productivo

El script `scripts/apprunner-start.js` ahora soporta:

- `PRISMA_DB_SYNC_MODE=push`
- `PRISMA_DB_SYNC_MODE=migrate`
- `PRISMA_DB_SYNC_MODE=none`

Si `DATABASE_URL` empieza por `mysql://`, el modo por defecto pasa a `push`.

## App Runner

`apprunner.yaml` sigue configurado para:
- build: `npm ci`, `npm run prisma:generate`, `npm run build`
- run: `node scripts/apprunner-start.js`

## Huawei IoTDA HTTP Push

Ruta recomendada para Huawei:

- crear una regla con `resource = device.property` y `event = report`
- crear una accion HTTP/HTTPS hacia `https://TU_BACKEND/api/v1/readings/iotda/property-push`
- configurar el mismo token en Huawei y en `IOTDA_HTTP_PUSH_TOKEN`

El backend acepta el sobre oficial de IoTDA con `notify_data.header.device_id` y `notify_data.body.services[*].properties`, lo transforma al contrato interno de telemetria y lo ingiere sin FunctionGraph.

## Nota sobre tu nube MySQL

Cambiar Prisma a MySQL permite que el backend use una instancia MySQL como base principal, pero no significa que reutilice automaticamente tablas externas como `telemetry`, `training_fault_v1` o `training_power_v1`.

El backend sigue esperando su propio schema de aplicacion: `User`, `Farm`, `Plot`, `Device`, `SensorReading`, `Alert`, `Report`, etc.

## Ruta integrada con tabla `telemetry`

Si ya tienes IoTDA escribiendo directamente en MySQL, puedes hacer que el backend lea desde esa tabla sin depender de `SensorReading`.

Activa:

```env
READINGS_SOURCE=telemetry_table
TELEMETRY_TABLE_NAME=telemetry
TELEMETRY_DEFAULT_DEVICE_ID=AE-01
```

Por defecto el backend busca estas columnas reales:

- `device_id`
- `farm_id`
- `plot_id`
- `timestamp`
- `wind_speed_mps`
- `wind_dir_deg`
- `battery_voltage_dc_v`
- `battery_current_dc_a`
- `battery_power_w`
- `battery_soc_pct`
- `battery_autonomy_estimated_h`
- `battery_alert_low`
- `battery_alert_overload`
- `battery_alert_overtemp`
- `inverter_output_voltage_ac_v`
- `inverter_output_current_ac_a`
- `house_power_consumption_w`
- `energy_delivered_wh`
- `inverter_alert_overload`
- `inverter_alert_fault`
- `inverter_alert_supply_cut`
- `inverter_temp_c`
- `motor_vibration`
- `vibration_signal`
- `blade_rpm`

Si tu tabla usa otros nombres, puedes remapearlos con variables `TELEMETRY_COL_*`.

Con este modo:

- `GET /api/v1/readings/latest` lee directo desde `telemetry`
- `GET /api/v1/readings` lee historial desde `telemetry`
- `GET /api/v1/alerts/recent` puede devolver alertas derivadas desde la ultima fila si todavia no existen alertas persistidas

Esto sirve para conectar app y dashboard a la misma tabla operacional que ya usa tu nube MySQL.

## Simulador CLI (Node 22)

```bash
cd c:/AeroGenIoT
set API_BASE=https://TU-APP-RUNNER
set INGEST_API_KEY=TU_API_KEY
node tools/simulate-ae01.mjs --mode=auto --interval=5000
```
