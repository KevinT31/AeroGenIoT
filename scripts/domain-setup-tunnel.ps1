# domain-setup-tunnel.ps1 — Configuracion UNICA del tunel con nombre para auroranoctua2026.lat.
# Prerrequisito: el dominio ya agregado a tu cuenta Cloudflare y nameservers cambiados
# en el registrador (ver docs\domain-runbook.md, pasos 1-3).
# Este script es interactivo (abre el navegador para autorizar). Ejecutar:
#   powershell -ExecutionPolicy Bypass -File scripts\domain-setup-tunnel.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Cloudflared = Join-Path $Root ".runtime\bin\cloudflared.exe"
$CfDir = Join-Path $env:USERPROFILE ".cloudflared"
$TunnelName = "aurora-noctua"
$Domain = "auroranoctua2026.lat"

if (-not (Test-Path $Cloudflared)) { throw "Falta $Cloudflared" }

Write-Host "[1/4] Autorizando cloudflared con tu cuenta Cloudflare (se abre el navegador)..." -ForegroundColor Cyan
& $Cloudflared tunnel login
if ($LASTEXITCODE -ne 0) { throw "cloudflared tunnel login fallo" }

Write-Host "[2/4] Creando tunel '$TunnelName' (si ya existe, se reutiliza)..." -ForegroundColor Cyan
& $Cloudflared tunnel create $TunnelName 2>$null
$tunnelList = & $Cloudflared tunnel list --output json | ConvertFrom-Json
$tunnel = $tunnelList | Where-Object { $_.name -eq $TunnelName } | Select-Object -First 1
if (-not $tunnel) { throw "No se pudo crear/encontrar el tunel $TunnelName" }
$tunnelId = $tunnel.id
Write-Host "  Tunel ID: $tunnelId"

Write-Host "[3/4] Escribiendo $CfDir\config.yml..." -ForegroundColor Cyan
$config = @"
tunnel: $tunnelId
credentials-file: $CfDir\$tunnelId.json
protocol: http2

ingress:
  - hostname: $Domain
    service: http://localhost:8080
  - hostname: www.$Domain
    service: http://localhost:8080
  - hostname: goaly.$Domain
    service: http://localhost:3100
  - service: http_status:404
"@
Set-Content -Path (Join-Path $CfDir "config.yml") -Value $config -Encoding ascii

Write-Host "[4/4] Creando registros DNS del tunel en Cloudflare..." -ForegroundColor Cyan
& $Cloudflared tunnel route dns $TunnelName $Domain
& $Cloudflared tunnel route dns $TunnelName "www.$Domain"
& $Cloudflared tunnel route dns $TunnelName "goaly.$Domain"

Write-Host @"

Tunel configurado. Ahora publica con:
  powershell -ExecutionPolicy Bypass -File scripts\domain-up.ps1
Y el dashboard quedara en https://$Domain (Twin 3D: https://$Domain/twin-3d)
"@ -ForegroundColor Green
