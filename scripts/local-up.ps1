# local-up.ps1 — Levanta la pila completa de Aurora Noctua 100% local (sin nube).
# Orden: base de datos (Floci RDS si Docker funciona; si no, MySQL local aislado)
#        -> Prisma db push -> backend NestJS -> dashboard Vite -> simulador AE-01.
# Uso:   powershell -ExecutionPolicy Bypass -File scripts\local-up.ps1 [-Rebuild] [-SkipSimulator]
param(
    [switch]$Rebuild,
    [switch]$SkipSimulator
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $Root "app\backend"
$DashboardDir = Join-Path $Root "app\dashboard"
$BackendEnvFile = Join-Path $BackendDir ".env.floci"
$RuntimeDir = Join-Path $Root ".runtime"
$PidDir = Join-Path $RuntimeDir "pids"
$LogDir = Join-Path $Root "logs"
$MysqlBase = "C:\Program Files\MySQL\MySQL Server 8.0"
$MysqlData = Join-Path $RuntimeDir "mysql-floci-data"
$MysqlRun = Join-Path $RuntimeDir "mysql-floci-run"
$DbUrl = "mysql://root:aerogeniot@127.0.0.1:7001/aerogeniot"
$FlociEndpoint = "http://localhost:4566"

New-Item -ItemType Directory -Force -Path $PidDir, $LogDir, $MysqlRun | Out-Null

function Read-EnvFile([string]$Path) {
    $vars = @{}
    if (-not (Test-Path $Path)) { return $vars }
    Get-Content -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $idx = $line.IndexOf("=")
            if ($idx -gt 0) {
                $key = $line.Substring(0, $idx).Trim()
                $value = $line.Substring($idx + 1).Trim()
                if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                    $value = $value.Substring(1, $value.Length - 2)
                }
                $vars[$key] = $value
            }
        }
    }
    return $vars
}

$BackendEnv = Read-EnvFile $BackendEnvFile
if ($BackendEnv.Count -eq 0) {
    $BackendEnv = Read-EnvFile (Join-Path $BackendDir ".env")
}
if ($BackendEnv.Count -eq 0) {
    $BackendEnv = Read-EnvFile (Join-Path $BackendDir ".env.example")
}
$BackendEnv["DATABASE_URL"] = $DbUrl
$BackendEnv["PORT"] = "3000"
if (-not $BackendEnv["INGEST_API_KEY"] -or $BackendEnv["INGEST_API_KEY"] -eq "dev-ingest-key") {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $BackendEnv["INGEST_API_KEY"] = [Convert]::ToBase64String($bytes).TrimEnd("=")
    Write-Host "  INGEST_API_KEY runtime generado para esta sesion." -ForegroundColor Yellow
}
if (-not $BackendEnv["JWT_SECRET"] -or $BackendEnv["JWT_SECRET"] -eq "dev-secret") {
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $BackendEnv["JWT_SECRET"] = [Convert]::ToBase64String($bytes).TrimEnd("=")
    Write-Host "  JWT_SECRET runtime generado para esta sesion." -ForegroundColor Yellow
}

function Test-Port([string]$TargetHost, [int]$Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
        $ok = $async.AsyncWaitHandle.WaitOne(1500, $false)
        if ($ok -and $client.Connected) { $client.Close(); return $true }
        $client.Close(); return $false
    } catch { return $false }
}

function Wait-Port([string]$TargetHost, [int]$Port, [int]$TimeoutSec, [string]$Label) {
    Write-Host "  Esperando $Label ($TargetHost`:$Port)..." -NoNewline
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $TargetHost $Port) { Write-Host " OK"; return $true }
        Start-Sleep -Milliseconds 1500
    }
    Write-Host " TIMEOUT"
    return $false
}

function Start-Tracked([string]$Name, [string]$Exe, [string]$Arguments, [string]$WorkDir, [hashtable]$EnvVars) {
    $pidFile = Join-Path $PidDir "$Name.pid"
    if (Test-Path $pidFile) {
        $oldPid = Get-Content $pidFile
        $proc = $null
        try { $proc = Get-Process -Id $oldPid -ErrorAction Stop } catch {}
        if ($proc) { Write-Host "  [$Name] ya corre (PID $oldPid), no se reinicia."; return }
    }
    foreach ($key in $EnvVars.Keys) { Set-Item -Path "env:$key" -Value $EnvVars[$key] }
    $out = Join-Path $LogDir "$Name.log"
    $err = Join-Path $LogDir "$Name.err.log"
    $p = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $WorkDir `
        -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
    Set-Content -Path $pidFile -Value $p.Id
    Write-Host "  [$Name] iniciado (PID $($p.Id)) -> log: logs\$Name.log"
}

Write-Host "=== Aurora Noctua / AeroGenIoT — arranque local ===" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1) Base de datos: Floci RDS (ideal) o MySQL local aislado (fallback)
# ---------------------------------------------------------------------------
$dbMode = "fallback-mysql-local"
$dockerOk = $false
try {
    $null = & docker info --format "{{.ServerVersion}}" 2>$null
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch {}

if ($dockerOk) {
    Write-Host "[1/5] Docker activo: levantando Floci..." -ForegroundColor Green
    & docker compose -f (Join-Path $Root "docker-compose.floci.yml") up -d
    $flociReady = $false
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-RestMethod -Uri "$FlociEndpoint/_localstack/health" -TimeoutSec 3
            if ($health) { $flociReady = $true; break }
        } catch { Start-Sleep -Seconds 3 }
    }
    if ($flociReady) {
        Write-Host "  Floci healthy en $FlociEndpoint"
        $env:AWS_ACCESS_KEY_ID = "test"; $env:AWS_SECRET_ACCESS_KEY = "test"; $env:AWS_DEFAULT_REGION = "us-east-1"
        # RDS MySQL (el proxy publica el puerto 7001 segun docker-compose.floci.yml)
        $rds = & aws --endpoint-url $FlociEndpoint rds describe-db-instances --db-instance-identifier aerogeniot-mysql 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Creando RDS aerogeniot-mysql..."
            & aws --endpoint-url $FlociEndpoint rds create-db-instance `
                --db-instance-identifier aerogeniot-mysql --db-instance-class db.t3.micro `
                --engine mysql --master-username root --master-user-password aerogeniot `
                --db-name aerogeniot --allocated-storage 20 | Out-Null
        }
        # S3 bucket de uploads
        & aws --endpoint-url $FlociEndpoint s3api head-bucket --bucket aerogeniot-uploads 2>$null
        if ($LASTEXITCODE -ne 0) {
            & aws --endpoint-url $FlociEndpoint s3api create-bucket --bucket aerogeniot-uploads | Out-Null
            Write-Host "  Bucket S3 aerogeniot-uploads creado."
        }
        if (Wait-Port "127.0.0.1" 7001 120 "Floci RDS MySQL") { $dbMode = "floci-rds" }
        else { Write-Host "  RDS no expuso 7001; usando fallback MySQL local." -ForegroundColor Yellow }
    } else {
        Write-Host "  Floci no respondio health; usando fallback MySQL local." -ForegroundColor Yellow
    }
} else {
    Write-Host "[1/5] Docker NO disponible (ver docs\local-floci-runbook.md para repararlo). Usando MySQL local aislado." -ForegroundColor Yellow
}

if ($dbMode -eq "fallback-mysql-local") {
    if (Test-Port "127.0.0.1" 7001) {
        Write-Host "  MySQL ya escucha en 7001."
    } else {
        if (-not (Test-Path (Join-Path $MysqlData "mysql"))) {
            Write-Host "  Inicializando datadir MySQL en .runtime\mysql-floci-data..."
            & "$MysqlBase\bin\mysqld.exe" --no-defaults --basedir="$MysqlBase" --datadir="$MysqlData" --initialize-insecure
            if ($LASTEXITCODE -ne 0) { throw "mysqld --initialize-insecure fallo" }
            $freshInit = $true
        }
        Write-Host "  Arrancando mysqld local en 127.0.0.1:7001..."
        $mysqldArgs = "--no-defaults --basedir=`"$MysqlBase`" --datadir=`"$MysqlData`" --bind-address=127.0.0.1 --port=7001 " +
                "--log-error=`"$MysqlRun\mysqld.log`" --pid-file=`"$MysqlRun\mysqld.pid`" --mysqlx=0"
        $p = Start-Process -FilePath "$MysqlBase\bin\mysqld.exe" -ArgumentList $mysqldArgs -WindowStyle Hidden -PassThru
        Set-Content -Path (Join-Path $PidDir "mysql.pid") -Value $p.Id
        if (-not (Wait-Port "127.0.0.1" 7001 60 "MySQL local")) { throw "MySQL no levanto en 7001 (ver .runtime\mysql-floci-run\mysqld.log)" }
        if ($freshInit) {
            & cmd /c "`"$MysqlBase\bin\mysql.exe`" --no-defaults -h 127.0.0.1 -P 7001 -u root --skip-password -e `"ALTER USER 'root'@'localhost' IDENTIFIED BY 'aerogeniot'; CREATE DATABASE IF NOT EXISTS aerogeniot;`" 2>nul"
        }
    }
    # Asegurar que la DB exista (idempotente). cmd /c evita que el warning de mysql en stderr
    # se convierta en error terminante de PowerShell 5.1.
    & cmd /c "`"$MysqlBase\bin\mysql.exe`" --no-defaults -h 127.0.0.1 -P 7001 -u root -paerogeniot -e `"CREATE DATABASE IF NOT EXISTS aerogeniot;`" 2>nul" | Out-Null
}
Write-Host "  Modo DB: $dbMode" -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 2) Prisma: sincronizar esquema y cliente
# ---------------------------------------------------------------------------
Write-Host "[2/5] Prisma db push..." -ForegroundColor Green
foreach ($key in $BackendEnv.Keys) { Set-Item -Path "env:$key" -Value $BackendEnv[$key] }
Push-Location $BackendDir
& npx.cmd prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "prisma db push fallo" }
if ($Rebuild -or -not (Test-Path (Join-Path $BackendDir "node_modules\.prisma\client"))) {
    & npx.cmd prisma generate
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "prisma generate fallo" }
}
Pop-Location

# ---------------------------------------------------------------------------
# 3) Backend NestJS (puerto 3000)
# ---------------------------------------------------------------------------
Write-Host "[3/5] Backend..." -ForegroundColor Green
if ($Rebuild -or -not (Test-Path (Join-Path $BackendDir "dist\main.js"))) {
    Push-Location $BackendDir
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "build backend fallo" }
    Pop-Location
}
if (Test-Port "127.0.0.1" 3000) {
    Write-Host "  Backend ya escucha en 3000."
} else {
    Start-Tracked "backend" "node" "--enable-source-maps dist/main.js" $BackendDir $BackendEnv
    if (-not (Wait-Port "127.0.0.1" 3000 60 "backend")) { throw "backend no levanto (ver logs\backend.err.log)" }
}

# ---------------------------------------------------------------------------
# 4) Dashboard Vite (puerto 5173)
# ---------------------------------------------------------------------------
Write-Host "[4/5] Dashboard..." -ForegroundColor Green
if (Test-Port "127.0.0.1" 5173) {
    Write-Host "  Dashboard ya escucha en 5173."
} else {
    Start-Tracked "dashboard" "node" "node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173" $DashboardDir @{}
    Wait-Port "127.0.0.1" 5173 60 "dashboard" | Out-Null
}

# ---------------------------------------------------------------------------
# 5) Simulador AE-01
# ---------------------------------------------------------------------------
if ($SkipSimulator) {
    Write-Host "[5/5] Simulador omitido (-SkipSimulator)." -ForegroundColor Yellow
} else {
    Write-Host "[5/5] Simulador AE-01..." -ForegroundColor Green
    $simEnv = @{ API_BASE = "http://localhost:3000"; INGEST_API_KEY = $BackendEnv["INGEST_API_KEY"] }
    if (-not $simEnv["INGEST_API_KEY"]) { $simEnv["INGEST_API_KEY"] = "dev-ingest-key" }
    Start-Tracked "floci-simulator" "node" "tools/simulate-ae01.mjs --mode=auto --interval=5000" $Root $simEnv
}

# ---------------------------------------------------------------------------
# Verificacion final
# ---------------------------------------------------------------------------
Start-Sleep -Seconds 3
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/health" -TimeoutSec 5
    Write-Host "`nHealth backend: $($health | ConvertTo-Json -Compress)" -ForegroundColor Cyan
} catch { Write-Host "`nWARN: /api/v1/health no respondio aun." -ForegroundColor Yellow }

$SwaggerNote = if ($BackendEnv["ENABLE_SWAGGER"] -eq "true") { "Swagger: http://localhost:3000/docs" } else { "Swagger cerrado (ENABLE_SWAGGER=true para habilitar)" }

Write-Host @"

=== Pila local arriba ===
  Dashboard : http://localhost:5173/        (Twin 3D: http://localhost:5173/twin-3d)
  Backend   : http://localhost:3000  ($SwaggerNote)
  MySQL     : 127.0.0.1:7001  root/aerogeniot  DB aerogeniot  [$dbMode]
  Estado    : powershell -ExecutionPolicy Bypass -File scripts\local-status.ps1
  Apagar    : powershell -ExecutionPolicy Bypass -File scripts\local-down.ps1
"@ -ForegroundColor Cyan
