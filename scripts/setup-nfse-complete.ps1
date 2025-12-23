#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Setup e teste completo de NFS-e para Ampla (certificado + Supabase + dev server)
.DESCRIPTION
  - Solicita path do PFX, credenciais Supabase (de forma segura)
  - Valida o certificado
  - Configura variáveis de ambiente
  - Sobe o dev server Vite + /api
  - Abre a tela de NFS-e no navegador
#>

param(
  [string]$PfxPath = "",
  [string]$SupabaseUrl = "",
  [string]$SupabaseServiceRoleKey = ""
)

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
  Write-Host "║  $($Title.PadRight(52))║" -ForegroundColor Cyan
  Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host ""
}

function Write-Success {
  param([string]$Message)
  Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
  param([string]$Message)
  Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
  param([string]$Message)
  Write-Host "⚠ $Message" -ForegroundColor Yellow
}

Write-Section "NFS-e Setup - Ampla Contabilidade"

# 1. PATH DO PFX
if (-not $PfxPath) {
  Write-Host "📁 Localizando arquivo PFX..." -ForegroundColor Cyan
  
  # Procura em locais comuns
  $possiblePaths = @(
    "C:\certificado\ampla.pfx",
    "$env:USERPROFILE\Desktop\ampla.pfx",
    "$env:USERPROFILE\Downloads\ampla.pfx",
    "$env:USERPROFILE\Documents\ampla.pfx",
    ".\certificado\ampla.pfx"
  )
  
  $foundPfx = $null
  foreach ($path in $possiblePaths) {
    if (Test-Path -LiteralPath $path) {
      $foundPfx = $path
      Write-Success "Certificado encontrado: $path"
      break
    }
  }
  
  if (-not $foundPfx) {
    Write-Host "Informe o caminho completo do arquivo PFX:" -ForegroundColor Yellow
    $PfxPath = Read-Host "  Caminho"
  } else {
    Write-Host "Usar este certificado? (S/N)" -ForegroundColor Yellow
    $use = Read-Host "  "
    if ($use -eq "S" -or $use -eq "s") {
      $PfxPath = $foundPfx
    } else {
      $PfxPath = Read-Host "  Informe o caminho correto"
    }
  }
}

if (-not (Test-Path -LiteralPath $PfxPath)) {
  Write-Error-Custom "Arquivo PFX não encontrado: $PfxPath"
  exit 1
}

Write-Success "PFX carregado: $PfxPath"

# 2. SUPABASE URL
if (-not $SupabaseUrl) {
  Write-Host "🔗 URL do Supabase:" -ForegroundColor Yellow
  $SupabaseUrl = Read-Host "  (ex: https://xdtlhzysrpoinqtsglmr.supabase.co)"
}

if (-not $SupabaseUrl.StartsWith("https://")) {
  Write-Error-Custom "URL inválida (deve começar com https://)"
  exit 1
}

Write-Success "Supabase URL: $SupabaseUrl"

# 3. SUPABASE SERVICE ROLE KEY
if (-not $SupabaseServiceRoleKey) {
  Write-Host "🔑 Service Role Key do Supabase:" -ForegroundColor Yellow
  Write-Host "  (Do Supabase Dashboard > Project Settings > API Keys)" -ForegroundColor DarkGray
  $SupabaseServiceRoleKey = Read-Host "  Cole a chave (será oculta)"
}

if ($SupabaseServiceRoleKey.Length -lt 20) {
  Write-Error-Custom "Service Role Key parece inválida (muito curta)"
  exit 1
}

Write-Success "Service Role Key: $(($SupabaseServiceRoleKey.Substring(0, 20)) + '...')"

# 4. SENHA DO PFX
Write-Host "🔐 Senha do PFX:" -ForegroundColor Yellow
$securePass = Read-Host "  " -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if (-not $password) {
  Write-Error-Custom "Senha não pode estar vazia"
  exit 1
}

Write-Success "Senha carregada"

# 5. CONFIGURAR ENV VARS
Write-Section "Configurando Variáveis de Ambiente"

$env:SUPABASE_URL = $SupabaseUrl
$env:SUPABASE_SERVICE_ROLE_KEY = $SupabaseServiceRoleKey
$env:NFSE_CERT_PASSWORD = $password

try {
  $bytes = [IO.File]::ReadAllBytes($PfxPath)
  $env:NFSE_CERT_PFX_B64 = [Convert]::ToBase64String($bytes)
  Write-Success "NFSE_CERT_PFX_B64 configurado"
} catch {
  Write-Error-Custom "Erro ao ler PFX: $_"
  exit 1
}

Write-Success "SUPABASE_URL configurado"
Write-Success "SUPABASE_SERVICE_ROLE_KEY configurado"
Write-Success "NFSE_CERT_PASSWORD configurado"

# 6. VALIDAR CERTIFICADO
Write-Section "Validando Certificado"

try {
  $result = node "$PSScriptRoot\..\scripts\nfse-cert-check.mjs" 2>&1
  $cert = $result | ConvertFrom-Json -ErrorAction Stop
  
  if ($cert.ok) {
    Write-Success "Certificado válido"
    Write-Host "  Emitido para: $($cert.cert.subjectCN)"
    Write-Host "  Emitido por: $($cert.cert.issuerCN)"
    Write-Host "  Válido até: $($cert.cert.notAfter)"
    
    # Verifica se está vencido
    $notAfter = [DateTime]::Parse($cert.cert.notAfter)
    if ($notAfter -lt [DateTime]::Now) {
      Write-Error-Custom "Certificado VENCIDO!"
      exit 1
    }
    
    $daysLeft = ($notAfter - [DateTime]::Now).Days
    if ($daysLeft -lt 30) {
      Write-Warning-Custom "Certificado vence em $daysLeft dias"
    }
  } else {
    Write-Error-Custom "Erro ao validar: $($cert.error)"
    exit 1
  }
} catch {
  Write-Error-Custom "Erro ao executar validação: $_"
  exit 1
}

# 7. SUBIR DEV SERVER
Write-Section "Iniciando Dev Server"

Write-Host "Iniciando Vite + Vercel Functions em localhost..." -ForegroundColor Cyan
Write-Host "(Aguarde ~10 segundos até estar pronto)" -ForegroundColor DarkGray
Write-Host ""

$projectPath = "$PSScriptRoot\.."
Push-Location $projectPath

# Inicia em background
$serverProcess = Start-Process -FilePath "npm" -ArgumentList "run dev:vercel" -NoNewWindow -PassThru

# Aguarda que a porta abra
$maxAttempts = 30
$attempt = 0
$port = 8082
$ready = $false

while ($attempt -lt $maxAttempts) {
  try {
    $test = Invoke-WebRequest -Uri "http://localhost:$port/" -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($test.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {}
  
  Start-Sleep -Milliseconds 500
  $attempt++
}

if (-not $ready) {
  Write-Error-Custom "Dev server não iniciou em tempo"
  $serverProcess | Stop-Process -Force -ErrorAction SilentlyContinue
  Pop-Location
  exit 1
}

Write-Success "Dev server rodando em http://localhost:$port/"

# 8. ABRIR BROWSER
Write-Section "Abrindo Tela de NFS-e"

$nfseUrl = "http://localhost:$port/nfse"
Write-Host "Abrindo: $nfseUrl" -ForegroundColor Cyan
Start-Process $nfseUrl

Write-Host ""
Write-Host "✓ SETUP COMPLETO!" -ForegroundColor Green
Write-Host ""
Write-Host "O que fazer agora:" -ForegroundColor Yellow
Write-Host "  1. Navegador abre na tela de NFS-e"
Write-Host "  2. Filtre por dezembro/2025"
Write-Host "  3. Clique em 'Emissão Rápida' para emitir nota de teste"
Write-Host "  4. Monitore os erros/sucessos no console abaixo"
Write-Host ""
Write-Host "Pressione CTRL+C para encerrar o dev server" -ForegroundColor Yellow
Write-Host ""

# Mantém o terminal aberto mostrando logs do dev server
$serverProcess | Wait-Process

Pop-Location
