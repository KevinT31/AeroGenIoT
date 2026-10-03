# Runbook: Aurora Noctua 100% local (Windows)

Objetivo: correr **todo** el sistema (backend, base de datos, storage, dashboard, twin 3D y
simulador) en esta máquina, **sin Huawei Cloud, sin AWS real y sin ningún servicio remoto**.

## Arquitectura local

```
simulador AE-01 (tools/simulate-ae01.mjs, cada 5 s)
        │  POST /api/v1/readings  (x-api-key: dev-ingest-key)
        ▼
backend NestJS  http://localhost:3000   (Swagger: /docs)
        │  Prisma
        ▼
MySQL  127.0.0.1:7001  root/aerogeniot  DB aerogeniot
   ├─ ideal:    Floci RDS (contenedor Floci publica el proxy RDS en 7001)
   └─ fallback: mysqld local aislado (datadir .runtime/mysql-floci-data)

storage S3:  Floci S3 en http://localhost:4566 (bucket aerogeniot-uploads)
dashboard:   Vite  http://localhost:5173  (2D: /digital-twin · 3D: /twin-3d)
```

Ambos modos de base de datos usan el **mismo endpoint** (`127.0.0.1:7001`), por eso el
backend no necesita cambios de configuración al pasar de fallback a Floci.

## Comandos de un paso

```powershell
# Levantar todo (detecta Floci; si Docker no responde usa el fallback local):
powershell -ExecutionPolicy Bypass -File scripts\local-up.ps1

# Ver estado:
powershell -ExecutionPolicy Bypass -File scripts\local-status.ps1

# Apagar todo:
powershell -ExecutionPolicy Bypass -File scripts\local-down.ps1
```

Flags útiles: `local-up.ps1 -Rebuild` (recompila backend y regenera Prisma),
`local-up.ps1 -SkipSimulator`, `local-down.ps1 -KeepDb`, `local-down.ps1 -StopFloci`.

Logs: `logs\backend.log`, `logs\dashboard.log`, `logs\floci-simulator.log`,
`.runtime\mysql-floci-run\mysqld.log`.

Si necesitas levantar solo el backend contra la DB local/Floci:

```powershell
cd app\backend
npm run start:local
```

Ese comando carga `.env.floci` si existe, sincroniza Prisma y deja la API en
`http://localhost:3000`.

## Ruta Floci (ideal)

Floci corre como contenedor Docker y emula AWS (RDS, S3, …) en `http://localhost:4566`.
`docker-compose.floci.yml` ya está configurado: proxy RDS en 7001-7099, red `aerogeniot_floci`.

`scripts\local-up.ps1` hace automáticamente cuando Docker funciona:

1. `docker compose -f docker-compose.floci.yml up -d`
2. Espera `http://localhost:4566/_localstack/health`
3. Crea (si no existe) el RDS `aerogeniot-mysql` → endpoint `localhost:7001`, root/aerogeniot, DB `aerogeniot`
4. Crea (si no existe) el bucket S3 `aerogeniot-uploads`
5. `prisma db push` contra `mysql://root:aerogeniot@127.0.0.1:7001/aerogeniot`

### Estado actual de Docker en esta máquina (2026-06-12)

Diagnóstico realizado:

- `wsl.exe -l -v --all` **se cuelga indefinidamente** (también `wsl --shutdown`): el
  servicio `wslservice` está bloqueado con la VM `vmmemWSL` zombi.
- Docker Desktop 4.59.0 queda en estado `starting` para siempre y registra en
  `%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log`:
  `DockerDesktop/Wsl/CommandTimedOut: c:\windows\system32\wsl.exe -l -v --all`.
- El pipe `\\.\pipe\dockerDesktopLinuxEngine` no existe → `docker ps` falla.
- Reiniciar `wslservice` requiere privilegios de administrador (esta sesión no los tiene).

**Reparación (una sola vez, como Administrador):**

```powershell
# PowerShell COMO ADMINISTRADOR:
powershell -ExecutionPolicy Bypass -File C:\AuroraNoctua_Local\AeroGenIoT\scripts\fix-docker-wsl-admin.ps1
```

El script: cierra Docker Desktop → mata `wsl.exe` colgados → `Restart-Service wslservice`
→ `wsl --shutdown` (y si sigue colgado, reinicia `vmcompute`) → verifica WSL → relanza
Docker Desktop. **No borra** `docker-desktop-data` ni volúmenes. Si aún así WSL no
responde, reiniciar Windows y volver a correrlo.

Después de la reparación, basta `scripts\local-up.ps1` (sin admin): detectará Docker y
pasará solo del fallback a Floci.

## Ruta fallback (operativa hoy)

Mientras Docker/WSL siga roto, `local-up.ps1` usa un **MySQL local aislado** que imita el
endpoint del RDS de Floci:

- Binario: `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe`
- Datadir propio del proyecto: `.runtime\mysql-floci-data` (gitignorado, no toca otras
  instalaciones MySQL de la máquina)
- `--bind-address=127.0.0.1 --port=7001 --mysqlx=0`
- Si el datadir no existe, el script lo inicializa (`--initialize-insecure`), fija el
  password `aerogeniot` y crea la DB `aerogeniot`.

Limitación del fallback: no hay S3 local, así que los **uploads** de archivos quedan sin
backend de storage (el resto de la app no lo necesita). Con Floci activo, los uploads van
al bucket `aerogeniot-uploads` vía `S3_ENDPOINT=http://localhost:4566` con
`forcePathStyle` (ya soportado en `uploads.service.ts`).

## Independencia de la nube — qué se neutralizó

| Dependencia antigua | Estado |
| --- | --- |
| `app/backend/.env` con `DATABASE_URL` → `192.168.0.221:3306` (MySQL remoto/LAN antiguo) | Reemplazado por `127.0.0.1:7001`. Backup en `.env.backup-cloud-20260612` |
| App movil/dashboard con API antigua de App Runner | Apuntan a `http://localhost:3000` en desarrollo local |
| `app/mobile/.env` → `http://124.81.5.106` y deviceId de Huawei IoTDA | Apunta a `http://localhost:3000`, `AE-01`. Backup `.env.backup-cloud-20260612` |
| `S3_PUBLIC_BASE_URL` → `*.s3.amazonaws.com` | `http://localhost:4566/aerogeniot-uploads` (Floci) |
| Dashboard `VITE_API_BASE` | Ya apuntaba a `http://localhost:3000` (`.env.local`) |
| Huawei IoTDA HTTP push (`/api/v1/readings/iotda/property-push`) | Sigue disponible pero **opcional**: nada lo requiere; la ingesta local usa el simulador |
| `apprunner.yaml`, `docs/submission/*`, scripts `iotda*.py` | Solo documentación/deploy histórico; no participan en la ejecución local |

Reglas para no recaer en la nube:

- La URL del API del dashboard **solo** sale de `VITE_API_BASE` (`app/dashboard/.env.local`).
- El backend **solo** lee `DATABASE_URL`/`S3_ENDPOINT` de `.env` (local) o variables de entorno.
- No hay dominios remotos hardcodeados en `app/dashboard/src` ni en `app/backend/src`
  (verificado por grep; `auroranoctua2026.lat` solo aparece en docs).

## Volver a publicarlo en el dominio original (sin nube)

Implementado: ver **[docs/domain-runbook.md](domain-runbook.md)**. Resumen:
`scripts\domain-up.ps1` publica el sitio vía Caddy (origen local :8080) + Cloudflare
Tunnel (necesario porque la conexión tiene CG-NAT). Mientras el dominio no esté
re-delegado a Cloudflare, el script levanta un túnel temporal `*.trycloudflare.com`
para demos. Nada de esto usa compute en la nube: el servidor es esta PC.
