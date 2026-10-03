# local-status.ps1 — Estado de la pila local de Aurora Noctua.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\local-status.ps1

$Root = Split-Path -Parent $PSScriptRoot
$results = @()

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

function Add-Check([string]$Name, [bool]$Ok, [string]$Detail) {
    $script:results += [pscustomobject]@{
        Componente = $Name
        Estado     = if ($Ok) { "OK" } else { "CAIDO" }
        Detalle    = $Detail
    }
}

# Docker / Floci
$dockerOk = $false
try { $null = & docker info --format "x" 2>$null; if ($LASTEXITCODE -eq 0) { $dockerOk = $true } } catch {}
Add-Check "Docker engine" $dockerOk $(if ($dockerOk) { "pipe dockerDesktopLinuxEngine activo" } else { "ver docs\local-floci-runbook.md (reparacion WSL/Docker)" })

$flociOk = $false
try {
    $h = Invoke-RestMethod -Uri "http://localhost:4566/_localstack/health" -TimeoutSec 3
    if ($h) { $flociOk = $true }
} catch {}
Add-Check "Floci (4566)" $flociOk $(if ($flociOk) { "health responde" } else { "no responde (modo fallback local)" })

# MySQL
$mysqlOk = Test-Port "127.0.0.1" 7001
Add-Check "MySQL (7001)" $mysqlOk $(if ($mysqlOk) { "root/aerogeniot DB aerogeniot" } else { "ejecutar scripts\local-up.ps1" })

# Backend + datos reales
$backendOk = $false; $latestDetail = ""
try {
    $h = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/health" -TimeoutSec 5
    $backendOk = ($h.status -eq "ok")
} catch {}
Add-Check "Backend (3000)" $backendOk $(if ($backendOk) { "health ok — docs protegidos si ENABLE_SWAGGER no esta activo" } else { "sin respuesta" })

if ($backendOk) {
    try {
        $latest = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/readings/latest?deviceId=AE-01" -TimeoutSec 5
        $ts = [datetime]$latest.ts
        $age = [int]((Get-Date).ToUniversalTime() - $ts.ToUniversalTime()).TotalSeconds
        $fresh = $age -lt 60
        Add-Check "Telemetria AE-01" $fresh "ultima lectura hace ${age}s (viento $($latest.wind_speed_mps) m/s, SOC $($latest.battery_soc_pct)%)"
    } catch { Add-Check "Telemetria AE-01" $false "sin lecturas (simulador caido?)" }
}

# Dashboard
$dashOk = Test-Port "127.0.0.1" 5173
Add-Check "Dashboard (5173)" $dashOk $(if ($dashOk) { "http://localhost:5173/ y /twin-3d" } else { "sin respuesta" })

# Simulador (PID registrado o proceso node con simulate-ae01)
$simOk = $false
$simPidFile = Join-Path $Root ".runtime\pids\floci-simulator.pid"
if (Test-Path $simPidFile) {
    try { $null = Get-Process -Id (Get-Content $simPidFile) -ErrorAction Stop; $simOk = $true } catch {}
}
if (-not $simOk) {
    $sim = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match "simulate-ae01" }
    if ($sim) { $simOk = $true }
}
Add-Check "Simulador AE-01" $simOk $(if ($simOk) { "enviando cada 5s -> logs\floci-simulator.log" } else { "no corre" })

$results | Format-Table -AutoSize

$down = @($results | Where-Object { $_.Estado -eq "CAIDO" })
if ($down.Count -eq 0) {
    Write-Host "Todo arriba. Pila 100% local sin nube." -ForegroundColor Green
} elseif (-not $dockerOk -and $mysqlOk -and $backendOk -and $dashOk) {
    Write-Host "Operativo en modo FALLBACK local (sin Floci). Para Floci: reparar Docker segun docs\local-floci-runbook.md" -ForegroundColor Yellow
} else {
    Write-Host "Hay componentes caidos: ejecutar scripts\local-up.ps1" -ForegroundColor Red
}
