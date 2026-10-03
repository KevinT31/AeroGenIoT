# Runbook: volver a publicar en https://auroranoctua2026.lat (sin nube de compute)

Estado actualizado el 2026-06-29:

- El dominio ya esta delegado a Cloudflare y el tunel con nombre `aurora-noctua` esta configurado.
- `goaly.auroranoctua2026.lat` comparte el tunel y enruta a la API Goaly en `localhost:3100`.
- El proceso `cloudflared` y cada servicio de origen deben estar activos para evitar respuestas 530/502.

Estado historico verificado el 2026-06-12:

- El dominio **sigue delegado a los nameservers de Huawei Cloud DNS** y todos responden
  `REFUSED` (la zona DNS se eliminó al salir de Huawei). Por eso el dominio no resuelve
  para nadie. Hay que re-delegarlo.
- Tu conexión tiene **CG-NAT** (IP pública compartida `179.6.x.x`, primer salto del ISP
  en `10.x.x.x`). Abrir puertos en el router **no funcionará jamás** — la única ruta
  estable sin compute en la nube es un **túnel de salida** (Cloudflare Tunnel, gratis).
  El túnel solo enruta tráfico: el backend, la DB y el dashboard siguen corriendo en tu PC.

## Arquitectura

```
Internet ──HTTPS──> Cloudflare (DNS + TLS, gratis)
                        │  túnel cifrado saliente (sin abrir puertos)
                        ▼
                cloudflared.exe (esta PC)
                        ▼
                Caddy 127.0.0.1:8080  (infra/Caddyfile)
                ├── /api/*       → backend NestJS :3000
                ├── /socket.io/* → backend NestJS :3000 (telemetría en vivo)
                ├── /docs*       → Swagger :3000
                └── /*           → app/dashboard/dist-domain (build same-origin)
```

Binarios ya descargados en `.runtime\bin\` (caddy.exe, cloudflared.exe).
El build `dist-domain` usa `VITE_API_BASE=same-origin`, así que la misma carpeta sirve
para el dominio real o para un túnel temporal de prueba.

## Ya funciona hoy (túnel temporal de demo)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\domain-up.ps1
```

Sin configurar nada, esto publica una URL temporal `https://<aleatorio>.trycloudflare.com`
(verificado: API, websocket y Twin 3D funcionando a través de ella). La URL cambia en cada
arranque — es solo para probar/demo.

## Pasos para el dominio real (una sola vez, ~15 min + propagación DNS)

1. **Cuenta Cloudflare (gratis):** crea una en <https://dash.cloudflare.com/sign-up>
   (o usa la tuya). Click en **Add a domain** → escribe `auroranoctua2026.lat` →
   plan **Free** → Continue. Cloudflare te mostrará **2 nameservers** (p. ej.
   `ana.ns.cloudflare.com` y `bob.ns.cloudflare.com` — los tuyos serán otros).

2. **Cambiar nameservers en el registrador** (donde compraste el dominio .lat — el
   panel donde lo pagaste; hoy apunta a `*.huaweicloud-dns.*`): busca la sección
   *Nameservers / DNS servers* del dominio y reemplaza los de Huawei por los 2 de
   Cloudflare del paso 1. Guarda.

3. **Esperar activación:** Cloudflare te manda un correo "domain is active" (suele
   tardar minutos; máximo 24-48 h). Puedes verificar con:
   `curl "https://dns.google/resolve?name=auroranoctua2026.lat&type=NS"`

4. **Configurar el túnel con nombre (interactivo, una vez):**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\domain-setup-tunnel.ps1
   ```
   - Abre el navegador para autorizar (`cloudflared tunnel login`) → selecciona el dominio.
   - Crea el túnel `aurora-noctua`, escribe `%USERPROFILE%\.cloudflared\config.yml`
     y crea los registros DNS (`auroranoctua2026.lat` y `www`) apuntando al túnel.

5. **Publicar:**
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\domain-up.ps1
   ```
   Detecta el `config.yml` y corre el túnel con nombre →
   **https://auroranoctua2026.lat** (Twin 3D en `/twin-3d`, Swagger en `/docs`).

6. **Apagar la publicación** (la pila local sigue corriendo):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\domain-down.ps1
   ```

## Operación diaria

- `scripts\local-up.ps1` → pila local (DB, backend, dashboard dev, simulador).
- `scripts\domain-up.ps1` → además publica el dominio (rebuild con `-Rebuild` si
  cambiaste el frontend). `domain-up` levanta la pila local solo si no está.
- Logs: `logs\caddy.log`, `logs\cloudflared.err.log` (cloudflared escribe a stderr).
- La PC debe quedar encendida para que el sitio esté arriba: es tu servidor.

## Notas

- **TLS:** lo termina Cloudflare automáticamente (certificado del plan Free). Caddy
  local solo habla HTTP en 127.0.0.1:8080; nada queda expuesto en tu red.
- **IP dinámica / CG-NAT:** irrelevante con el túnel — la conexión sale de tu PC
  hacia Cloudflare.
- **Alternativa sin Cloudflare** (no recomendada con CG-NAT): pedir IP pública fija al
  ISP, port-forward 80/443 → Caddy con dominio real y TLS automático. Solo viable si
  el ISP te saca del CG-NAT.
- El bloque del túnel rápido (`trycloudflare.com`) queda siempre como fallback de demo.
