#!/usr/bin/env pwsh
<#
  Script para carregar .env e iniciar servidores de desenvolvimento
#>

Write-Host "🚀 Carregando variáveis de ambiente..." -ForegroundColor Cyan

# Carregar .env
$envFile = Join-Path (Get-Location) ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Arquivo .env não encontrado em $(Get-Location)" -ForegroundColor Red
    exit 1
}

# Parse .env
$envContent = Get-Content $envFile -Raw
$envVars = @{}

foreach ($line in $envContent -split "`n") {
    $line = $line.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $key, $value = $line -split "=", 2
        if ($key -and $value) {
            $envVars[$key.Trim()] = $value.Trim()
        }
    }
}

# Carregar no PowerShell
foreach ($key in $envVars.Keys) {
    [Environment]::SetEnvironmentVariable($key, $envVars[$key], "Process")
    Write-Host "  ✅ $key carregado" -ForegroundColor Green
}

Write-Host ""
Write-Host "📦 Iniciando servidores..." -ForegroundColor Cyan

# Terminal 1: API Server
Write-Host "🔌 API Server (porta 8082)..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$(Get-Location)'; node ./dev-server.cjs" -NoNewWindow

Start-Sleep -Seconds 3

# Terminal 2: Vite
Write-Host "📦 Vite (porta 8080)..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$(Get-Location)'; npm run dev" -NoNewWindow

Write-Host ""
Write-Host "✅ Servidores iniciados!" -ForegroundColor Green
Write-Host "  🌐 Frontend: http://localhost:8080/nfse" -ForegroundColor Cyan
Write-Host "  🔌 API: http://localhost:8082" -ForegroundColor Cyan
