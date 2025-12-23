#!/usr/bin/env pwsh
<#
  Script para iniciar os dois servidores de desenvolvimento:
  - Vite (porta 8080) - frontend
  - API Express (porta 8082) - backend
#>

Write-Host "🚀 Iniciando servidores de desenvolvimento..." -ForegroundColor Cyan

# Parar servidores anteriores
Write-Host "⏹️  Parando processos node anteriores..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "📁 Diretório: $scriptDir" -ForegroundColor Blue

# Terminal 1: Vite
Write-Host "📦 Iniciando Vite (porta 8080)..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; npm run dev" -NoNewWindow

Start-Sleep -Seconds 5

# Terminal 2: API Server
Write-Host "🔌 Iniciando API Server (porta 8082)..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; node ./dev-server.cjs" -NoNewWindow

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ Servidores iniciados!" -ForegroundColor Green
Write-Host "  🌐 Frontend: http://localhost:8080/nfse" -ForegroundColor Green
Write-Host "  🔌 API: http://localhost:8082/health" -ForegroundColor Green
Write-Host ""
