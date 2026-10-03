# Aurora Noctua Mobile (Expo 54)

Aplicacion movil para monitoreo de aerogenerador con pantallas principales:
- Inicio/Estado
- Alertas
- Produccion
- Detalles tecnicos
- Cuenta, perfil, dispositivo activo, contacto, terminos y privacidad

Desde `1.1.0` la app incluye login propio por correo/clave, persistencia segura de
tokens con `expo-secure-store`, perfil local sincronizado con el backend, selector de
dispositivo y eventos basicos de diagnostico.

## 1) Variables de entorno

Crea `.env` y completa:

```bash
EXPO_PUBLIC_API_BASE=http://localhost:3000
EXPO_PUBLIC_DEVICE_ID=AE-01
EXPO_PUBLIC_DEVICE_LABEL=Aurora-01
EXPO_PUBLIC_POLL_MS=5000
EXPO_PUBLIC_REQUEST_TIMEOUT_MS=12000
EXPO_PUBLIC_STALE_AFTER_MS=90000
EXPO_PUBLIC_SUPPORT_PHONE=+573000000000
EXPO_PUBLIC_BATTERY_KWH=3
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_REALTIME_ENABLED=true
EXPO_PUBLIC_CLOUD_PROFILE=local
```

Variables nuevas:
- `EXPO_PUBLIC_REQUEST_TIMEOUT_MS`: timeout comun para llamadas HTTP.
- `EXPO_PUBLIC_STALE_AFTER_MS`: define cuando una lectura se considera atrasada.
- `EXPO_PUBLIC_USE_MOCK`: permite ejecutar la UI con datos simulados sin tocar pantallas.
- `EXPO_PUBLIC_REALTIME_ENABLED`: habilita o deshabilita Socket.IO sin romper el polling REST.
- `EXPO_PUBLIC_CLOUD_PROFILE`: etiqueta liviana para distinguir el backend local, tunnel o perfiles historicos.

## 2) Backend local

```bash
cd C:\AuroraNoctua_Local\AeroGenIoT
powershell -ExecutionPolicy Bypass -File scripts\local-up.ps1
```

Esto levanta el backend en `http://localhost:3000`, MySQL local/Floci, dashboard y
simulador AE-01. Para un telefono fisico en la misma red, cambia
`EXPO_PUBLIC_API_BASE` por `http://IP_DE_ESTA_PC:3000`. Para Android emulator usa
`http://10.0.2.2:3000`.

## 3) Desarrollo local de la app

```bash
cd app/mobile
npm install
npm run start
```

## 4) Validacion

```bash
npm run typecheck
```

## 5) APK release (EAS)

El perfil `release-apk` ya no apunta a App Runner ni a la IP antigua. Apunta a
`https://auroranoctua2026.lat`, que debe estar publicado desde esta PC con:

```powershell
cd C:\AuroraNoctua_Local\AeroGenIoT
powershell -ExecutionPolicy Bypass -File scripts\domain-up.ps1
```

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

## 6) Realtime/REST usados

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/readings/latest?deviceId=AE-01`
- `GET /api/v1/alerts/recent?deviceId=AE-01`
- `POST /api/v1/alerts/:alertId/ack` con JWT
- `GET /api/v1/devices` con JWT
- `PUT /api/v1/users/preferences` con JWT
- `POST /api/v1/app-events` con JWT
- Socket.IO namespace `/realtime`:
  - `reading.new`
  - `alert.new`
  - `alert.updated`
