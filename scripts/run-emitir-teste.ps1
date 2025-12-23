# Carrega variáveis do .env e executa o script de emissão de teste
$envFile = Join-Path $PSScriptRoot "..\\.env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Executa o script
Set-Location (Join-Path $PSScriptRoot "..")
node --experimental-specifier-resolution=node scripts/emitir-teste-1real.js
