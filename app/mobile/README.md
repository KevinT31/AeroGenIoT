# Aurora Noctua Mobile (Expo 54)

Aplicacion movil para monitoreo de aerogenerador con 4 pantallas:
- Inicio/Estado
- Alertas
- Produccion
- Detalles tecnicos

## 1) Variables de entorno

Crea `.env` y completa:

```bash
EXPO_PUBLIC_API_BASE=https://tu-app-runner
EXPO_PUBLIC_DEVICE_ID=AE-01
EXPO_PUBLIC_POLL_MS=5000
EXPO_PUBLIC_REQUEST_TIMEOUT_MS=12000
EXPO_PUBLIC_STALE_AFTER_MS=90000
EXPO_PUBLIC_SUPPORT_PHONE=+573000000000
EXPO_PUBLIC_BATTERY_KWH=3
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_REALTIME_ENABLED=true
EXPO_PUBLIC_CLOUD_PROFILE=current
```

Variables nuevas:
- `EXPO_PUBLIC_REQUEST_TIMEOUT_MS`: timeout comun para llamadas HTTP.
- `EXPO_PUBLIC_STALE_AFTER_MS`: define cuando una lectura se considera atrasada.
- `EXPO_PUBLIC_USE_MOCK`: permite ejecutar la UI con datos simulados sin tocar pantallas.
- `EXPO_PUBLIC_REALTIME_ENABLED`: habilita o deshabilita Socket.IO sin romper el polling REST.
- `EXPO_PUBLIC_CLOUD_PROFILE`: etiqueta liviana para distinguir el backend actual de futuras exposiciones via cloud.

## 2) Desarrollo local

```bash
cd app/mobile
npm install
npm run start
```

## 3) Validacion

```bash
npm run typecheck
```

## 4) APK release (EAS)

Prerequisitos:
- cuenta Expo/EAS autenticada (`npx eas login`)
- proyecto configurado en Expo

Comando:

```bash
npm run apk:release
```

Tambien puedes correr directo:

```bash
npx eas build --platform android --profile release-apk
```

## 5) Realtime/REST usados

- `GET /api/v1/readings/latest?deviceId=AE-01`
- `GET /api/v1/alerts/recent?deviceId=AE-01`
- Socket.IO namespace `/realtime`:
  - `reading.new`
  - `alert.new`
  - `alert.updated`