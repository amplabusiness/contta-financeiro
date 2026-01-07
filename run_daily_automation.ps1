# Run AI Automation Routines
# This script executes the daily AI agents for Cash Flow and Accounting Audit.

Write-Host "🚀 Starting AI Automation Routines..." -ForegroundColor Cyan

# Check if Node is available
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed or not in PATH."
    exit 1
}

# 1. Run AI Guardian (Cash Flow)
Write-Host "`n🤖 Executing AI Guardian (Cash Flow)..." -ForegroundColor Yellow
node scripts/ai_guardian_cash_flow.mjs

# 2. Run Dr. Cicero (Auditor)
Write-Host "`n🧐 Executing Dr. Cicero (Auditor)..." -ForegroundColor Yellow
node scripts/dr_cicero_auditor.mjs

Write-Host "`n✅ Automation Completed. Check REPORTS folder for details." -ForegroundColor Green
Pause
