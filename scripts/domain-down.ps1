# domain-down.ps1 — Detiene la publicacion del dominio (Caddy + Cloudflare Tunnel).
# No toca la pila local (backend/dashboard/MySQL siguen corriendo).
$Root = Split-Path -Parent $PSScriptRoot
$PidDir = Join-Path $Root ".runtime\pids"

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

Write-Host "=== Despublicando dominio ===" -ForegroundColor Cyan
Stop-Tracked "cloudflared"
Stop-Tracked "caddy"
Write-Host "=== Listo (la pila local sigue activa) ===" -ForegroundColor Cyan
