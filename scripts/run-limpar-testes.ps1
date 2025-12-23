# Limpa NFS-e de teste do banco
$envFile = Join-Path $PSScriptRoot "..\.env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

Set-Location (Join-Path $PSScriptRoot "..")
node scripts/limpar-testes.js
