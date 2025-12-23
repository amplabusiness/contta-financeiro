# Importar XMLs de NFS-e Tomadas de uma pasta
# Uso: .\run-importar-xmls.ps1 <pasta> [-CriarContasPagar] [-DiasVencimento 30]

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Pasta,

    [switch]$CriarContasPagar,

    [int]$DiasVencimento = 30
)

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

$args = @($Pasta)
if ($CriarContasPagar) {
    $args += "--criar-contas-pagar"
}
$args += "--dias-vencimento=$DiasVencimento"

node scripts/importar-xmls-pasta.js @args
