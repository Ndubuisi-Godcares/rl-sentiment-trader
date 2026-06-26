# Kill anything on ports 8000 (backend) and 5173 (frontend)
foreach ($port in @(8000, 5173)) {
    $pids = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
    foreach ($p in $pids) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        Write-Host "Killed process $p on port $port"
    }
}

Start-Sleep -Milliseconds 500

# Start backend
Start-Process pwsh -ArgumentList "-NoExit", "-Command",
    "Set-Location '$PSScriptRoot\backend'; Write-Host 'Backend starting...' -ForegroundColor Cyan; python -m uvicorn app.main:app --port 8000 --reload"

# Start frontend
Start-Process pwsh -ArgumentList "-NoExit", "-Command",
    "Set-Location '$PSScriptRoot\frontend'; Write-Host 'Frontend starting...' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "Backend  -> http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend -> http://localhost:5173" -ForegroundColor Green
