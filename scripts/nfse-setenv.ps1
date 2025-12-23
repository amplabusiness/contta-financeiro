param(
  [Parameter(Mandatory = $true)]
  [string]$PfxPath,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseServiceRoleKey
)

if (-not (Test-Path -LiteralPath $PfxPath)) {
  throw "Arquivo PFX não encontrado: $PfxPath"
}

$env:SUPABASE_URL = $SupabaseUrl
$env:SUPABASE_SERVICE_ROLE_KEY = $SupabaseServiceRoleKey

# Lê senha sem ecoar; converte para texto para env var (necessário para o runtime)
$secure = Read-Host "Senha do PFX" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $env:NFSE_CERT_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$bytes = [IO.File]::ReadAllBytes($PfxPath)
$env:NFSE_CERT_PFX_B64 = [Convert]::ToBase64String($bytes)

Write-Host "OK: variáveis de ambiente configuradas nesta sessão" -ForegroundColor Green
Write-Host "- SUPABASE_URL: OK"
Write-Host "- SUPABASE_SERVICE_ROLE_KEY: OK"
Write-Host "- NFSE_CERT_PASSWORD: OK"
Write-Host "- NFSE_CERT_PFX_B64: OK"

Write-Host "\nAgora rode:" -ForegroundColor Cyan
Write-Host "  npm --prefix \"$PSScriptRoot\..\" run dev:vercel" -ForegroundColor Cyan
