#!/usr/bin/env powershell
# Quick Commands - NFS-e System
# Copie e cole estes comandos diretamente no PowerShell

# ====================================
# 1️⃣ EMITIR UMA NOVA NFS-e
# ====================================
cd "$env:USERPROFILE\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1"
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
node scripts/emitir-real.js


# ====================================
# 2️⃣ CONSULTAR STATUS (UMA VEZ)
# ====================================
cd "$env:USERPROFILE\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1"
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
node scripts/consultar-status.js


# ====================================
# 3️⃣ MONITORAR CONTINUAMENTE (5 em 5 min)
# ====================================
cd "$env:USERPROFILE\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1"
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
npm run nfse:polling


# ====================================
# 4️⃣ VER ESTADO DO BANCO (DEBUG)
# ====================================
cd "$env:USERPROFILE\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1"
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
node -e "
import('node-fetch').then(async (m) => {
  const fetch = m.default;
  const url = process.env.SUPABASE_URL + '/rest/v1/nfse?select=rps_number,status,protocolo,numero_nfse';
  const res = await fetch(url, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
  console.log(JSON.stringify(await res.json(), null, 2));
});
"


# ====================================
# 5️⃣ TESTE RÁPIDO (Emitir + Consultar)
# ====================================
cd "$env:USERPROFILE\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1"
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
Write-Host "📤 Emitindo..." -ForegroundColor Cyan
node scripts/emitir-real.js
Write-Host ""
Write-Host "⏳ Aguardando 10 segundos..." -ForegroundColor Yellow
Start-Sleep 10
Write-Host ""
Write-Host "📋 Consultando..." -ForegroundColor Cyan
node scripts/consultar-status.js


# ====================================
# 6️⃣ LIMPAR VARIÁVEIS DE AMBIENTE
# ====================================
# Se tiver problema, feche e reabra o PowerShell
# Ou execute:
Remove-Item env:SUPABASE_URL
Remove-Item env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item env:NFSE_CERT_PFX_B64
Remove-Item env:NFSE_CERT_PASSWORD
Remove-Item env:NFSE_PRESTADOR_CNPJ
Remove-Item env:NFSE_INSCRICAO_MUNICIPAL
