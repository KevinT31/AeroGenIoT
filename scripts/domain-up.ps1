# domain-up.ps1 — Publica el dashboard en auroranoctua2026.lat SIN nube de compute:
# Caddy (origen local :8080 = estaticos + proxy API) + Cloudflare Tunnel.
# Si el tunel con nombre aun no esta configurado (ver scripts\domain-setup-tunnel.ps1),
# levanta un tunel rapido temporal *.trycloudflare.com para probar de inmediato.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\domain-up.ps1 [-Rebuild]
param(
    [switch]$Rebuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DashboardDir = Join-Path $Root "app\dashboard"
$BinDir = Join-Path $Root ".runtime\bin"
$PidDir = Join-Path $Root ".runtime\pids"
$LogDir = Join-Path $Root "logs"
$Caddy = Join-Path $BinDir "caddy.exe"
$Cloudflared = Join-Path $BinDir "cloudflared.exe"
$CfConfig = Join-Path $env:USERPROFILE ".cloudflared\config.yml"

New-Item -ItemType Directory -Force -Path $PidDir, $LogDir | Out-Null

function Test-Port([string]$TargetHost, [int]$Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(1500, $false)
        $connected = $ok -and $client.Connected
        $client.Close()
        return $connected
    } catch { return $false }
}

function Start-Tracked([string]$Name, [string]$Exe, [string]$Arguments, [string]$WorkDir) {
    $pidFile = Join-Path $PidDir "$Name.pid"
    if (Test-Path $pidFile) {
        $oldPid = Get-Content $pidFile
        $proc = $null
        try { $proc = Get-Process -Id $oldPid -ErrorAction Stop } catch {}
        if ($proc) { Write-Host "  [$Name] ya corre (PID $oldPid)."; return }
    }
    $out = Join-Path $LogDir "$Name.log"
    $err = Join-Path $LogDir "$Name.err.log"
    $p = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $WorkDir `
        -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
    Set-Content -Path $pidFile -Value $p.Id
    Write-Host "  [$Name] iniciado (PID $($p.Id)) -> log: logs\$Name.log"
}

Write-Host "=== Aurora Noctua — publicacion del dominio (sin nube) ===" -ForegroundColor Cyan

# 0) Requisitos
if (-not (Test-Path $Caddy)) { throw "Falta $Caddy (re-descargar Caddy; ver docs\domain-runbook.md)" }
if (-not (Test-Path $Cloudflared)) { throw "Falta $Cloudflared (re-descargar cloudflared; ver docs\domain-runbook.md)" }
if (-not (Test-Port "127.0.0.1" 3000)) {
    Write-Host "Backend no esta en :3000 — levantando pila local primero..." -ForegroundColor Yellow
    & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "local-up.ps1")
}

# 1) Build de produccion del dashboard (same-origin)
if ($Rebuild -or -not (Test-Path (Join-Path $DashboardDir "dist-domain\index.html"))) {
    Write-Host "[1/3] Compilando dashboard (modo domain, same-origin)..." -ForegroundColor Green
    Push-Location $DashboardDir
    & npx.cmd vite build --mode domain --outDir dist-domain
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "build del dashboard (modo domain) fallo" }
    Pop-Location
} else {
    Write-Host "[1/3] dist-domain ya existe (usa -Rebuild para regenerar)." -ForegroundColor Green
}

# 2) Caddy: origen local en :8080
Write-Host "[2/3] Caddy (origen :8080)..." -ForegroundColor Green
if (Test-Port "127.0.0.1" 8080) {
    Write-Host "  Puerto 8080 ya en uso (Caddy previo u otro proceso)."
} else {
    Start-Tracked "caddy" $Caddy "run --config `"$(Join-Path $Root 'infra\Caddyfile')`"" $Root
    Start-Sleep -Seconds 2
}
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health" -TimeoutSec 8
    Write-Host "  Origen OK: estaticos + proxy API responden ($($health | ConvertTo-Json -Compress))"
} catch { Write-Host "  WARN: el origen :8080 aun no responde /api/v1/health" -ForegroundColor Yellow }

# 3) Tunel Cloudflare
Write-Host "[3/3] Cloudflare Tunnel..." -ForegroundColor Green
if (Test-Path $CfConfig) {
    Start-Tracked "cloudflared" $Cloudflared "tunnel run" $Root
    Write-Host @"

=== Dominio publicado ===
  https://auroranoctua2026.lat  ->  tunel -> Caddy :8080 -> backend :3000 + dashboard
  (si acabas de cambiar los nameservers, la propagacion DNS puede tardar minutos u horas)
  Apagar: scripts\domain-down.ps1
"@ -ForegroundColor Cyan
} else {
    Write-Host "  No hay tunel con nombre configurado todavia ($CfConfig no existe)." -ForegroundColor Yellow
    Write-Host "  Levantando TUNEL RAPIDO temporal (URL aleatoria *.trycloudflare.com)..." -ForegroundColor Yellow
    Start-Tracked "cloudflared" $Cloudflared "tunnel --url http://localhost:8080" $Root
    Write-Host "  Esperando URL del tunel..." -NoNewline
    $tunnelUrl = $null
    $deadline = (Get-Date).AddSeconds(40)
    while ((Get-Date) -lt $deadline -and -not $tunnelUrl) {
        Start-Sleep -Seconds 2
        $errLog = Join-Path $LogDir "cloudflared.err.log"
        if (Test-Path $errLog) {
            $match = Select-String -Path $errLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches |
                Select-Object -Last 1
            if ($match) { $tunnelUrl = $match.Matches[$match.Matches.Count - 1].Value }
        }
    }
    if ($tunnelUrl) {
        Write-Host " OK"
        Write-Host @"

=== Tunel temporal activo (demo) ===
  $tunnelUrl
  Twin 3D: $tunnelUrl/twin-3d
  Para usar https://auroranoctua2026.lat de forma permanente:
  ejecuta scripts\domain-setup-tunnel.ps1 (una sola vez) — ver docs\domain-runbook.md
"@ -ForegroundColor Cyan
    } else {
        Write-Host " TIMEOUT (revisar logs\cloudflared.err.log)" -ForegroundColor Red
    }
}
