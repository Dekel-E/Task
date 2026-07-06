<#
  dev-down.ps1 — stop the WhatsApp+ dev stack started by dev-up.ps1.

  Kills the backend and frontend process trees (by recorded PID, with a
  port-based fallback) and stops Supabase. Run from the project root:

      ./dev-down.ps1
#>

$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
$pidFile = Join-Path $root ".devpids.json"

Write-Host "==> Stopping WhatsApp+ dev stack..." -ForegroundColor Cyan

# Kill a process and its children (npm/uvicorn spawn child processes).
function Stop-Tree($processId, $label) {
    if (-not $processId) { return }
    Write-Host "==> Killing $label (PID $processId) and children..."
    taskkill /PID $processId /T /F 2>$null | Out-Null
}

# Kill whatever is listening on a port — fallback if PIDs are stale/missing.
function Stop-Port($port, $label) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        Write-Host "==> Freeing port $port ($label, PID $($c.OwningProcess))..."
        taskkill /PID $c.OwningProcess /T /F 2>$null | Out-Null
    }
}

# --- 1. Stop backend + frontend by recorded PID ----------------------------
if (Test-Path $pidFile) {
    $pids = Get-Content $pidFile -Raw | ConvertFrom-Json
    Stop-Tree $pids.backend  "FastAPI backend"
    Stop-Tree $pids.frontend "Next.js frontend"
    Remove-Item $pidFile -Force
} else {
    Write-Warning ".devpids.json not found — falling back to port-based cleanup."
}

# --- 2. Port-based fallback (covers stale PIDs / manual starts) -------------
Stop-Port 8080 "backend"
Stop-Port 3000 "frontend"

# --- 3. Stop Supabase ------------------------------------------------------
Write-Host "==> supabase stop..." -ForegroundColor Cyan
try {
    supabase stop
} catch {
    Write-Warning "supabase stop failed (maybe it wasn't running)."
}

Write-Host ""
Write-Host "Dev stack stopped." -ForegroundColor Green
