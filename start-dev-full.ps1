# Inicia o servidor de desenvolvimento completo (API + Frontend)
# Carrega variáveis do .env

$envFile = Join-Path $PSScriptRoot ".env"

Write-Host "`n=== Carregando variaveis de ambiente ===" -ForegroundColor Cyan

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Write-Host "  $name = ***" -ForegroundColor DarkGray
        }
    }
    Write-Host "  Variaveis carregadas!" -ForegroundColor Green
} else {
    Write-Host "  AVISO: Arquivo .env nao encontrado!" -ForegroundColor Yellow
}

Write-Host "`n=== Iniciando servidores ===" -ForegroundColor Cyan
Write-Host "  API: http://localhost:8082" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:8080" -ForegroundColor Yellow
Write-Host "`n  Pressione Ctrl+C para parar`n" -ForegroundColor DarkGray

Set-Location $PSScriptRoot

# Inicia ambos os servidores
Start-Process -NoNewWindow powershell -ArgumentList "-Command", "node dev-server.cjs"
npm run dev
