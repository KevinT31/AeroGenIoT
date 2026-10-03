# fix-docker-wsl-admin.ps1 — Repara WSL colgado + Docker Desktop. REQUIERE ADMINISTRADOR.
# Sintoma que corrige: "wsl.exe -l -v --all" se cuelga, Docker Desktop reporta
# "DockerDesktop/Wsl/CommandTimedOut" y el pipe dockerDesktopLinuxEngine no existe.
#
# Ejecutar desde PowerShell COMO ADMINISTRADOR:
#   powershell -ExecutionPolicy Bypass -File C:\AuroraNoctua_Local\AeroGenIoT\scripts\fix-docker-wsl-admin.ps1
#
# NO borra docker-desktop-data ni volumenes: solo reinicia servicios.

$ErrorActionPreference = "Continue"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: este script debe ejecutarse como Administrador." -ForegroundColor Red
    Write-Host "Click derecho en PowerShell -> 'Ejecutar como administrador' y reintentar."
    exit 1
}

Write-Host "[1/6] Cerrando Docker Desktop..." -ForegroundColor Cyan
Get-Process -Name "Docker Desktop", "com.docker.backend", "com.docker.build", "com.docker.dev-envs" -ErrorAction SilentlyContinue |
    Stop-Process -Force -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "[2/6] Matando procesos wsl.exe colgados..." -ForegroundColor Cyan
taskkill /F /IM wsl.exe 2>$null

Write-Host "[3/6] Reiniciando servicio WSL (wslservice)..." -ForegroundColor Cyan
Restart-Service -Name "wslservice" -Force -Confirm:$false
Start-Sleep -Seconds 3

Write-Host "[4/6] wsl --shutdown (apaga la VM colgada vmmemWSL)..." -ForegroundColor Cyan
$p = Start-Process -FilePath "wsl.exe" -ArgumentList "--shutdown" -PassThru -WindowStyle Hidden
if (-not $p.WaitForExit(30000)) {
    Write-Host "  wsl --shutdown sigue colgado; reiniciando tambien vmcompute (Hyper-V host compute)..." -ForegroundColor Yellow
    $p | Stop-Process -Force -Confirm:$false -ErrorAction SilentlyContinue
    Restart-Service -Name "vmcompute" -Force -Confirm:$false
    Restart-Service -Name "wslservice" -Force -Confirm:$false
    Start-Sleep -Seconds 3
}

Write-Host "[5/6] Verificando WSL..." -ForegroundColor Cyan
$check = Start-Process -FilePath "wsl.exe" -ArgumentList "-l -v" -PassThru -WindowStyle Hidden
if ($check.WaitForExit(20000)) {
    Write-Host "  WSL responde de nuevo." -ForegroundColor Green
} else {
    $check | Stop-Process -Force -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "  WSL sigue sin responder. Ultimo recurso: REINICIAR WINDOWS y volver a correr este script." -ForegroundColor Red
    exit 1
}

Write-Host "[6/6] Arrancando Docker Desktop..." -ForegroundColor Cyan
$dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dockerExe) {
    Start-Process -FilePath $dockerExe
    Write-Host @"

Listo. Espera 1-2 minutos a que Docker Desktop diga 'Engine running' y luego ejecuta SIN admin:
  powershell -ExecutionPolicy Bypass -File C:\AuroraNoctua_Local\AeroGenIoT\scripts\local-up.ps1
(local-up detecta Docker, levanta Floci, crea el RDS aerogeniot-mysql y el bucket aerogeniot-uploads)
"@ -ForegroundColor Green
} else {
    Write-Host "  No se encontro Docker Desktop en $dockerExe" -ForegroundColor Yellow
}
