#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Setup simples para NFS-e: apenas inicia dev server com vars do .env existente
.DESCRIPTION
    Se NFSE_CERT_PFX_B64 e NFSE_CERT_PASSWORD já estão no .env, 
    este script apenas carrega-os e inicia `npm run dev:vercel`.
    Se não estão, pede para adicionar manualmente.
#>

$ErrorActionPreference = "Stop"

Write-Host "🔧 NFS-e Setup Simples" -ForegroundColor Green
Write-Host ""

# Carregar .env existente
$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Arquivo .env não encontrado em $(Get-Location)" -ForegroundColor Red
    exit 1
}

Write-Host "📖 Lendo .env..." -ForegroundColor Cyan
$envContent = Get-Content $envFile -Raw

# Verificar variáveis críticas
$hasCert = $envContent -match "NFSE_CERT_PFX_B64"
$hasPassword = $envContent -match "NFSE_CERT_PASSWORD"
$hasSupabaseUrl = $envContent -match "SUPABASE_URL|VITE_SUPABASE_URL"
$hasServiceRole = $envContent -match "SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_service_role"

Write-Host ""
Write-Host "Status das variáveis:" -ForegroundColor Yellow
Write-Host "  NFSE_CERT_PFX_B64       : $(if ($hasCert) { '✓ Configurado' } else { '✗ FALTANDO' })" -ForegroundColor $(if ($hasCert) { 'Green' } else { 'Red' })
Write-Host "  NFSE_CERT_PASSWORD      : $(if ($hasPassword) { '✓ Configurado' } else { '✗ FALTANDO' })" -ForegroundColor $(if ($hasPassword) { 'Green' } else { 'Red' })
Write-Host "  SUPABASE_URL            : $(if ($hasSupabaseUrl) { '✓ Configurado' } else { '✗ FALTANDO' })" -ForegroundColor $(if ($hasSupabaseUrl) { 'Green' } else { 'Red' })
Write-Host "  SUPABASE_SERVICE_ROLE   : $(if ($hasServiceRole) { '✓ Configurado' } else { '✗ FALTANDO' })" -ForegroundColor $(if ($hasServiceRole) { 'Green' } else { 'Red' })
Write-Host ""

# Se falta certificado, instruir usuário
if (-not $hasCert -or -not $hasPassword) {
    Write-Host "⚠️  Certificado não encontrado!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Por favor, adicione estas linhas ao seu .env:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# NFS-e Certificado (A1 em Base64)" -ForegroundColor DarkGray
    Write-Host "NFSE_CERT_PFX_B64=<sua_chave_base64_aqui>" -ForegroundColor DarkGray
    Write-Host "NFSE_CERT_PASSWORD=<senha_certificado>" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Como obter NFSE_CERT_PFX_B64:" -ForegroundColor Cyan
    Write-Host "  1. Localize seu arquivo .pfx"
    Write-Host "  2. Abra PowerShell e execute:"
    Write-Host "     `$pfx = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes('C:\caminho\para\certificado.pfx'))" -ForegroundColor DarkCyan
    Write-Host "     `$pfx | clip" -ForegroundColor DarkCyan
    Write-Host "  3. Cole o resultado no .env como NFSE_CERT_PFX_B64=..."
    Write-Host ""
    Write-Host "Depois de adicionar, execute novamente este script." -ForegroundColor Yellow
    exit 1
}

# Se chegou aqui, temos certificado. Carregar e iniciar
Write-Host "✅ Certificado encontrado!" -ForegroundColor Green
Write-Host ""

Write-Host "📦 Carregando variáveis do .env..." -ForegroundColor Cyan
foreach ($line in $envContent -split [Environment]::NewLine) {
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Length -eq 2) {
            $key = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"')
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

Write-Host "✅ Variáveis carregadas" -ForegroundColor Green
Write-Host ""

# Validar certificado
Write-Host "🔐 Validando certificado..." -ForegroundColor Cyan
$certCheckResult = & node scripts/nfse-cert-check.mjs 2>&1
$certCheck = $certCheckResult | ConvertFrom-Json -ErrorAction SilentlyContinue

if ($certCheck.ok) {
    Write-Host "✅ Certificado válido!" -ForegroundColor Green
    Write-Host "   CN: $($certCheck.cert.subjectCN)" -ForegroundColor DarkGreen
    Write-Host "   Válido até: $($certCheck.cert.notAfter)" -ForegroundColor DarkGreen
} else {
    Write-Host "❌ Erro ao validar certificado:" -ForegroundColor Red
    Write-Host $certCheck.error -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Iniciando dev server..." -ForegroundColor Green
Write-Host ""

# Iniciar dev:vercel
npm run dev:vercel
