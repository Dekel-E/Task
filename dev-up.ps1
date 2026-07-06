<#
  dev-up.ps1 — start the WhatsApp+ dev stack (Supabase + FastAPI + Next.js).

  Starts each service in its own background window and records PIDs to
  .devpids.json so dev-down.ps1 can stop them. Run from the project root:

      ./dev-up.ps1

  Services:
    - Supabase (Postgres/Auth/Realtime)  — Docker, ports 54321/54322/54323
    - FastAPI backend                    — http://localhost:8080
    - Next.js frontend                   — http://localhost:3000
#>

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$pidFile = Join-Path $root ".devpids.json"

Write-Host "==> Starting WhatsApp+ dev stack..." -ForegroundColor Cyan

# --- 1. Supabase (has its own lifecycle; no PID to track) -------------------
Write-Host "==> supabase start (Docker)..." -ForegroundColor Cyan
try {
    supabase start
} catch {
    Write-Warning "supabase start failed — is Docker running? Continuing anyway."
}

# --- 2. FastAPI backend on :8080 -------------------------------------------
$uvicorn = Join-Path $root "backend\.venv\Scripts\uvicorn.exe"
if (-not (Test-Path $uvicorn)) {
    throw "uvicorn not found at $uvicorn — run 'python3 setup.py' first."
}
Write-Host "==> Starting FastAPI backend on :8080..." -ForegroundColor Cyan
$backend = Start-Process -FilePath $uvicorn `
    -ArgumentList "main:app", "--reload", "--port", "8080" `
    -WorkingDirectory (Join-Path $root "backend") `
    -PassThru

# --- 3. Next.js frontend on :3000 ------------------------------------------
Write-Host "==> Starting Next.js frontend on :3000..." -ForegroundColor Cyan
$frontend = Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory (Join-Path $root "frontend") `
    -PassThru

# --- Record PIDs for dev-down.ps1 ------------------------------------------
@{
    backend  = $backend.Id
    frontend = $frontend.Id
} | ConvertTo-Json | Out-File -FilePath $pidFile -Encoding utf8

Write-Host ""
Write-Host "All services launched." -ForegroundColor Green
Write-Host "  Frontend : http://localhost:3000"
Write-Host "  Backend  : http://localhost:8080/docs"
Write-Host "  Backend PID $($backend.Id), Frontend PID $($frontend.Id) (saved to .devpids.json)"
Write-Host ""
Write-Host "Stop everything with:  ./dev-down.ps1" -ForegroundColor Yellow
