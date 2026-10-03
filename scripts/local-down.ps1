# local-down.ps1 — Detiene la pila local de Aurora Noctua.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\local-down.ps1 [-KeepDb] [-StopFloci]
#   -KeepDb    deja MySQL local corriendo (util si solo reinicias backend/dashboard)
#   -StopFloci ademas detiene el contenedor Floci (si Docker responde)
param(
    [switch]$KeepDb,
    [switch]$StopFloci
)

$Root = Split-Path -Parent $PSScriptRoot
$PidDir = Join-Path $Root ".runtime\pids"
$MysqlBase = "C:\Program Files\MySQL\MySQL Server 8.0"

function Stop-Tracked([string]$Name) {
    $pidFile = Join-Path $PidDir "$Name.pid"
    if (-not (Test-Path $pidFile)) { Write-Host "  [$Name] sin PID registrado."; return }
    $trackedPid = Get-Content $pidFile
    try {
        & taskkill /PID $trackedPid /T /F 2>$null | Out-Null
        Write-Host "  [$Name] detenido (PID $trackedPid)."
    } catch { Write-Host "  [$Name] ya no corria." }
    Remove-Item $pidFile -Force -Confirm:$false -ErrorAction SilentlyContinue
}

Write-Host "=== Deteniendo pila local ===" -ForegroundColor Cyan
Stop-Tracked "floci-simulator"
Stop-Tracked "dashboard"
Stop-Tracked "backend"

if ($KeepDb) {
    Write-Host "  MySQL se mantiene activo (-KeepDb)."
} else {
    # Apagado limpio de MySQL (sirve para mysqld propio o arrancado por Codex)
    $portInUse = $false
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect("127.0.0.1", 7001, $null, $null)
        if ($async.AsyncWaitHandle.WaitOne(1500, $false) -and $client.Connected) { $portInUse = $true }
        $client.Close()
    } catch {}
    if ($portInUse) {
        & cmd /c "`"$MysqlBase\bin\mysqladmin.exe`" --no-defaults -h 127.0.0.1 -P 7001 -u root -paerogeniot shutdown 2>nul"
        Write-Host "  MySQL local (7001): shutdown solicitado."
    } else {
        Write-Host "  MySQL local (7001) no estaba activo."
    }
    Remove-Item (Join-Path $PidDir "mysql.pid") -Force -Confirm:$false -ErrorAction SilentlyContinue
}

if ($StopFloci) {
    try {
        $null = & docker info --format "{{.ServerVersion}}" 2>$null
        if ($LASTEXITCODE -eq 0) {
            & docker compose -f (Join-Path $Root "docker-compose.floci.yml") stop
            Write-Host "  Floci detenido."
        } else { Write-Host "  Docker no responde; Floci no se toco." }
    } catch { Write-Host "  Docker no responde; Floci no se toco." }
}

Write-Host "=== Listo ===" -ForegroundColor Cyan
