# =====================================================
# AMPLA CONTABILIDADE - Script de Configuração CI/CD
# Execute este script para configurar GitHub Actions
# =====================================================

Write-Host "=========================================="
Write-Host "AMPLA CONTABILIDADE - Setup CI/CD"
Write-Host "=========================================="
Write-Host ""

# Verificar se gh CLI está instalado
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "[ERRO] GitHub CLI (gh) não está instalado!" -ForegroundColor Red
    Write-Host "Instale em: https://cli.github.com/" -ForegroundColor Yellow
    exit 1
}

# Verificar se está logado no gh
$ghAuth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Você não está logado no GitHub CLI" -ForegroundColor Red
    Write-Host "Execute: gh auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] GitHub CLI autenticado" -ForegroundColor Green

# Verificar se Supabase CLI está instalado
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    Write-Host "[AVISO] Supabase CLI não está instalado" -ForegroundColor Yellow
    Write-Host "Instale com: npm install -g supabase" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================="
Write-Host "CONFIGURAÇÃO DE SECRETS"
Write-Host "=========================================="
Write-Host ""

# Obter nome do repositório
$repoUrl = git config --get remote.origin.url
if ($repoUrl -match "github.com[:/](.+?)(\.git)?$") {
    $repo = $matches[1]
    Write-Host "[INFO] Repositório: $repo" -ForegroundColor Cyan
} else {
    Write-Host "[ERRO] Não foi possível detectar o repositório" -ForegroundColor Red
    $repo = Read-Host "Digite o repositório (formato: owner/repo)"
}

Write-Host ""
Write-Host "Vou configurar os seguintes secrets:" -ForegroundColor Yellow
Write-Host "1. SUPABASE_ACCESS_TOKEN - Para deploy de migrations"
Write-Host "2. VERCEL_TOKEN - Para deploy do frontend"
Write-Host "3. VERCEL_ORG_ID - ID da organização Vercel"
Write-Host "4. VERCEL_PROJECT_ID - ID do projeto Vercel"
Write-Host ""

# Secret 1: Supabase Access Token
Write-Host "=========================================="
Write-Host "1. SUPABASE ACCESS TOKEN"
Write-Host "=========================================="
Write-Host "Obtenha em: https://supabase.com/dashboard/account/tokens" -ForegroundColor Cyan
$supabaseToken = Read-Host "Cole o SUPABASE_ACCESS_TOKEN"
if ($supabaseToken) {
    Write-Host $supabaseToken | gh secret set SUPABASE_ACCESS_TOKEN --repo $repo
    Write-Host "[OK] SUPABASE_ACCESS_TOKEN configurado!" -ForegroundColor Green
}

# Secret 2: Vercel Token
Write-Host ""
Write-Host "=========================================="
Write-Host "2. VERCEL TOKEN"
Write-Host "=========================================="
Write-Host "Obtenha em: https://vercel.com/account/tokens" -ForegroundColor Cyan
$vercelToken = Read-Host "Cole o VERCEL_TOKEN"
if ($vercelToken) {
    Write-Host $vercelToken | gh secret set VERCEL_TOKEN --repo $repo
    Write-Host "[OK] VERCEL_TOKEN configurado!" -ForegroundColor Green
}

# Verificar se existe .vercel/project.json
$vercelProjectFile = ".vercel/project.json"
if (Test-Path $vercelProjectFile) {
    Write-Host ""
    Write-Host "[INFO] Encontrado .vercel/project.json - lendo IDs..." -ForegroundColor Cyan
    $vercelConfig = Get-Content $vercelProjectFile | ConvertFrom-Json
    $orgId = $vercelConfig.orgId
    $projectId = $vercelConfig.projectId

    if ($orgId -and $projectId) {
        Write-Host "  VERCEL_ORG_ID: $orgId"
        Write-Host "  VERCEL_PROJECT_ID: $projectId"

        Write-Host $orgId | gh secret set VERCEL_ORG_ID --repo $repo
        Write-Host $projectId | gh secret set VERCEL_PROJECT_ID --repo $repo
        Write-Host "[OK] IDs do Vercel configurados automaticamente!" -ForegroundColor Green
    }
} else {
    # Secret 3: Vercel Org ID
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "3. VERCEL ORG ID"
    Write-Host "=========================================="
    Write-Host "Execute 'npx vercel link' e veja .vercel/project.json" -ForegroundColor Cyan
    $vercelOrgId = Read-Host "Cole o VERCEL_ORG_ID"
    if ($vercelOrgId) {
        Write-Host $vercelOrgId | gh secret set VERCEL_ORG_ID --repo $repo
        Write-Host "[OK] VERCEL_ORG_ID configurado!" -ForegroundColor Green
    }

    # Secret 4: Vercel Project ID
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "4. VERCEL PROJECT ID"
    Write-Host "=========================================="
    $vercelProjectId = Read-Host "Cole o VERCEL_PROJECT_ID"
    if ($vercelProjectId) {
        Write-Host $vercelProjectId | gh secret set VERCEL_PROJECT_ID --repo $repo
        Write-Host "[OK] VERCEL_PROJECT_ID configurado!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=========================================="
Write-Host "CONFIGURAÇÃO CONCLUÍDA!"
Write-Host "=========================================="
Write-Host ""
Write-Host "Secrets configurados no GitHub!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Faça commit das alterações: git add . && git commit -m 'Setup CI/CD'"
Write-Host "2. Push para main: git push origin main"
Write-Host "3. O GitHub Actions vai rodar automaticamente!"
Write-Host ""
Write-Host "Verifique os workflows em:" -ForegroundColor Cyan
Write-Host "https://github.com/$repo/actions"
Write-Host ""
