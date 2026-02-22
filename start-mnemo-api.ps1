# Mnemo API Server Auto-Start Script
# 로그인 시 자동 실행 — Windows Task Scheduler 등록됨

$env:MNEMO_VAULT_PATH   = "C:\Users\jini9\OneDrive\Documents\JINI_SYNC"
$env:MNEMO_MEMORY_PATH  = "C:\MAIBOT\memory"
$env:MNEMO_PROJECT_ROOT = "C:\TEST\MAISECONDBRAIN"
$env:PYTHONIOENCODING   = "utf-8"

$logFile = "C:\TEST\MAISECONDBRAIN\logs\mnemo-api.log"
New-Item -ItemType Directory -Force -Path "C:\TEST\MAISECONDBRAIN\logs" | Out-Null

# 이미 실행 중이면 스킵
$running = netstat -ano 2>$null | Select-String ":8000"
if ($running) {
    Add-Content $logFile "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [SKIP] Mnemo API already running on port 8000"
    exit 0
}

Add-Content $logFile "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [START] Launching Mnemo API server..."

Start-Process `
    -FilePath "C:\Python313\python.exe" `
    -ArgumentList "-m", "uvicorn", "mnemo.api:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory "C:\TEST\MAISECONDBRAIN\src" `
    -WindowStyle Hidden `
    -RedirectStandardOutput "C:\TEST\MAISECONDBRAIN\logs\mnemo-api-stdout.log" `
    -RedirectStandardError  "C:\TEST\MAISECONDBRAIN\logs\mnemo-api-stderr.log"

Add-Content $logFile "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [OK] Mnemo API server started"
