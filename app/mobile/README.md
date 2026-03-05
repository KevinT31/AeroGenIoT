# AeroGenIoT Mobile (Expo 54)

Aplicacion movil para monitoreo de aerogenerador con 4 pantallas:
- Inicio/Estado
- Alertas
- Produccion
- Detalles tecnicos

## 1) Variables de entorno

Copia `.env.example` a `.env` y completa:

```bash
EXPO_PUBLIC_API_BASE=https://tu-app-runner
EXPO_PUBLIC_DEVICE_ID=AE-01
EXPO_PUBLIC_POLL_MS=5000
EXPO_PUBLIC_SUPPORT_PHONE=+573000000000
EXPO_PUBLIC_BATTERY_KWH=3
```

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
