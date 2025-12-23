#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Converte um certificado .pfx para Base64 para adicionar ao .env
.DESCRIPTION
    Lê um arquivo .pfx e gera a string Base64 necessária para NFSE_CERT_PFX_B64
#>

$ErrorActionPreference = "Stop"

Write-Host "🔄 Conversor de PFX para Base64" -ForegroundColor Green
Write-Host ""

# Procurar .pfx em locais comuns
$commonPaths = @(
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\Downloads",
    "$env:USERPROFILE\Documents",
    "C:\certificado",
    ".\certificado",
    (Get-Location).Path
)

Write-Host "Procurando arquivos .pfx..." -ForegroundColor Cyan
$pfxFiles = @()
foreach ($path in $commonPaths) {
    if (Test-Path $path) {
        $pfxFiles += @(Get-ChildItem -Path $path -Filter "*.pfx" -ErrorAction SilentlyContinue)
    }
}

if ($pfxFiles.Count -eq 0) {
    Write-Host "❌ Nenhum arquivo .pfx encontrado nos locais padrão" -ForegroundColor Red
    Write-Host ""
    Write-Host "Especifique manualmente o caminho do certificado:" -ForegroundColor Yellow
    $pfxPath = Read-Host "Caminho do certificado"
    if (-not (Test-Path $pfxPath)) {
        Write-Host "❌ Arquivo não encontrado: $pfxPath" -ForegroundColor Red
        exit 1
    }
} elseif ($pfxFiles.Count -eq 1) {
    $pfxPath = $pfxFiles[0].FullName
    Write-Host "✓ Certificado encontrado: $pfxPath" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Múltiplos certificados encontrados:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $pfxFiles.Count; $i++) {
        Write-Host "  [$($i+1)] $($pfxFiles[$i].FullName)"
    }
    Write-Host ""
    $choice = Read-Host "Escolha qual usar (número)"
    $selected = [int]$choice - 1
    if ($selected -lt 0 -or $selected -ge $pfxFiles.Count) {
        Write-Host "❌ Escolha inválida" -ForegroundColor Red
        exit 1
    }
    $pfxPath = $pfxFiles[$selected].FullName
}

Write-Host ""
Write-Host "📄 Lendo certificado: $pfxPath" -ForegroundColor Cyan

try {
    $pfxBytes = [System.IO.File]::ReadAllBytes($pfxPath)
    $pfxBase64 = [System.Convert]::ToBase64String($pfxBytes)
    
    Write-Host "✅ Certificado convertido!" -ForegroundColor Green
    Write-Host ""
    Write-Host "String Base64 (copie e adicione ao .env):" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "NFSE_CERT_PFX_B64=$pfxBase64" -ForegroundColor DarkCyan
    Write-Host ""
    
    # Copiar para clipboard
    $pfxBase64 | Set-Clipboard
    Write-Host "✅ Copiado para clipboard!" -ForegroundColor Green
    
    # Pedir senha
    Write-Host ""
    $password = Read-Host "Digite a senha do certificado (será armazenada em NFSE_CERT_PASSWORD)" -AsSecureString
    $passwordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($password)
    )
    
    Write-Host ""
    Write-Host "Adicione também ao .env:" -ForegroundColor Yellow
    Write-Host "NFSE_CERT_PASSWORD=$passwordPlain" -ForegroundColor DarkCyan
    
} catch {
    Write-Host "❌ Erro ao ler certificado: $_" -ForegroundColor Red
    exit 1
}
