# Backend AeroGenIoT

API NestJS 10 + Prisma 5 + MySQL + Socket.IO 4.7 para telemetria de aerogenerador.

## Endpoints clave

- `POST /api/v1/readings/ingest` (protegido con header `x-api-key`)
- `POST /api/v1/readings/iotda/property-push` (push HTTP directo desde Huawei IoTDA)
- `GET /api/v1/readings/latest?deviceId=AE-01`
- `GET /api/v1/alerts/recent?deviceId=AE-01`
- `GET /api/v1/ai/operational?deviceId=AE-01`

## Variables requeridas

- `DATABASE_URL`
- `JWT_SECRET` (usar valor largo y aleatorio; `local-up.ps1` genera uno de runtime si detecta el default)
- `PRISMA_DB_SYNC_MODE` (`push` recomendado en MySQL mientras no exista un historial nuevo de migraciones Prisma)
- `READINGS_SOURCE` (`prisma` o `telemetry_table`)
- `INGEST_API_KEY` (usar valor largo y aleatorio; `local-up.ps1` genera uno de runtime si detecta el default)
- `IOTDA_HTTP_PUSH_TOKEN` (recomendado para validar `timestamp`, `nonce` y `signature` del push)
- `DEFAULT_LOAD_W` (fallback cuando no llega `house_power_consumption_w`)
- `CORS_ORIGINS` (por defecto permite localhost y `https://auroranoctua2026.lat`)
- `ENABLE_SWAGGER=false` para mantener `/docs` cerrado en el dominio publico
- `ENABLE_PUBLIC_METRICS=false` para mantener `/metrics` cerrado
- `TRUST_PROXY=loopback,linklocal,uniquelocal` para rate limiting correcto detras de proxy local/Nginx
- `AI_LOCAL_INFERENCE_ENABLED=true` para calcular IA operativa desde telemetria cuando no existan tablas externas de IA
- `AI_MODEL_INFERENCE_ENABLED=true` para usar el artefacto entrenado cuando exista
- `AI_MODEL_PATH=models/operational-ai/operational-ai-models.json`
- `AI_TELEMETRY_WINDOW` cantidad de lecturas recientes usadas por la IA local (default 60)
- `AI_FORECAST_HORIZON_MINUTES` horizonte del pronostico de potencia (default 15)
- `AI_MAX_POWER_W` limite superior del pronostico local (default 5000)
- `AI_TRAINING_MAX_DB_ROWS` cantidad maxima de lecturas MySQL usadas al entrenar (default 6000)

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

## Ruta principal local/Floci

La ruta actual ya no es App Runner. Para levantar backend, MySQL local/Floci,
dashboard y simulador desde esta maquina:

```powershell
cd C:\AuroraNoctua_Local\AeroGenIoT
powershell -ExecutionPolicy Bypass -File scripts\local-up.ps1
```

El backend queda en `http://localhost:3000`, Swagger en `http://localhost:3000/docs`
y Prisma usa `mysql://root:aerogeniot@127.0.0.1:7001/aerogeniot`.

Si solo quieres levantar el backend, primero asegurate de tener MySQL/Floci escuchando
en `127.0.0.1:7001` y luego ejecuta:

```bash
cd app/backend
npm ci
npm run start:local
```

`npm run start:local` carga `.env.floci` si existe; si no, usa `.env` y luego
`.env.example`. Tambien ejecuta `prisma db push` cuando `PRISMA_DB_SYNC_MODE=push`.

## Sincronizacion del schema en MySQL

Las migraciones SQL actuales del directorio `prisma/migrations` fueron generadas para PostgreSQL.

Para MySQL, la ruta limpia e inmediata es:

- usar `npm run prisma:push` en desarrollo
- usar `PRISMA_DB_SYNC_MODE=push` en arranque productivo

El script `scripts/local-start.js` soporta:

- `PRISMA_DB_SYNC_MODE=push`
- `PRISMA_DB_SYNC_MODE=migrate`
- `PRISMA_DB_SYNC_MODE=none`

Si `DATABASE_URL` empieza por `mysql://`, el modo por defecto pasa a `push`.

## App Runner historico

`apprunner.yaml` queda como referencia de despliegue antiguo. No participa en el
arranque local y no debe ser la ruta normal para demos o desarrollo. La ruta actual es
`scripts/local-up.ps1` o `npm run start:local`.

## Seguridad publica actual

- `/docs` solo se monta cuando `ENABLE_SWAGGER=true`.
- `/metrics` devuelve 404 salvo `ENABLE_PUBLIC_METRICS=true`.
- `POST /api/v1/alerts/:alertId/ack` requiere JWT.
- `POST /api/v1/app-events` requiere JWT y limita payloads a 4 KB.
- CORS no usa comodin por defecto.

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
- `GET /api/v1/ai/operational` puede calcular las tres IA locales desde la misma telemetria si faltan tablas `ai_*`

Esto sirve para conectar app y dashboard a la misma tabla operacional cuando exista una
tabla `telemetry` local o importada.

## IA operativa local

El endpoint `GET /api/v1/ai/operational` conserva el contrato para web y app:

- `faultPrediction`: predice riesgo operativo inmediato usando temperatura, vibracion, bateria, consumo, corriente, voltaje, RPM y banderas de falla.
- `powerForecast`: estima potencia de corto plazo mezclando potencia reciente, viento, tendencia y variabilidad.
- `yawRecommendation`: recomienda orientacion objetivo a partir de direccion de viento reciente y estabilidad de la ventana.

Si existen filas en `ai_fault_predictions`, `ai_power_forecast` o `ai_yaw_recommendations`, el backend las usa primero. Si una de esas salidas no existe, la rellena con inferencia local desde `SensorReading` o desde `telemetry` cuando `READINGS_SOURCE=telemetry_table`.

### Entrenar las tres IA operativas

Desde `app/backend`:

```bash
npm run ai:datasets
npm run ai:train
```

`ai:datasets` genera CSV reproducibles en `artifacts/operational-ai/datasets`.
`ai:train` genera esos datasets y entrena un artefacto JSON en
`app/backend/models/operational-ai/operational-ai-models.json`.

El artefacto contiene:

- clasificador softmax para `faultPrediction`
- regresion ridge para `powerForecast`
- regresion circular para `yawRecommendation`

El backend carga ese JSON cuando `AI_MODEL_INFERENCE_ENABLED=true`. Si el archivo no existe
o no valida, vuelve automaticamente a la inferencia heuristica local.

## Simulador CLI (Node 22)

```bash
cd c:/AeroGenIoT
set API_BASE=http://localhost:3000
set INGEST_API_KEY=dev-ingest-key
node tools/simulate-ae01.mjs --mode=auto --interval=5000
```
