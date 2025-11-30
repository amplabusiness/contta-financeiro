# Contexto da Sessão Atual

## Última Atualização
2025-11-30 (Sessão 8 - Preparação para Produção + Sistemas Avançados)

## ✅ Trabalho Concluído Nesta Sessão

### 1. Integração OpenAI Sora 2 para Vídeos
- [x] Criada migration `20251130130000_openai_sora2_video_generation.sql`:
  - Atualização de `ai_providers` com modelos OpenAI (GPT-5.1, Sora 2, TTS)
  - Tabelas: `sora_video_projects`, `sora_video_templates`, `sora_generation_queue`
  - Playlist por TV: `tv_video_playlist`
  - Configuração de branding: `video_branding_config`
  - Funções: `generate_sora_video()`, `generate_video_narration()`
  - Templates prontos: VIDEO_INDICACAO, VIDEO_TREINAMENTO_VENDAS, VIDEO_INSTITUCIONAL, etc.

### 2. Sistema de Evolução Contínua (Lovable.dev Interno)
- [x] Criada migration `20251130140000_continuous_improvement_system.sql`:
  - Tabela `feature_requests` para solicitações de funcionários
  - Tabela `feature_templates` com 6 templates prontos
  - Tabela `feature_analysis_history` para análises da IA
  - Tabelas `economic_groups` e `economic_group_members`
  - Funções: `request_improvement()`, `analyze_feature_request()`, `create_economic_group()`
  - View: `vw_evolution_metrics`

### 3. CI/CD GitHub Actions
- [x] Criado `.github/workflows/deploy.yml`:
  - Job quality: lint/build TypeScript
  - Job supabase: migrations + Edge Functions
  - Job vercel: deploy frontend
  - Job notify: resumo do deploy
- [x] Criado `.github/workflows/feature-implementation.yml`:
  - Workflow manual para feature requests aprovadas
  - Cria branch, migration, e atualiza status
- [x] Criado `.github/SETUP_CI_CD.md` com documentação

### 4. Script de Configuração Automática
- [x] Criado `scripts/setup-cicd.ps1`:
  - Verifica gh CLI e autenticação
  - Detecta repositório automaticamente
  - Lê `.vercel/project.json` se existir
  - Configura secrets: SUPABASE_ACCESS_TOKEN, VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

### 5. Análise de Segurança do Frontend
- [x] Verificado: nenhum secret exposto
- [x] Apenas variáveis VITE_* (públicas) usadas
- [x] .env incluído no .gitignore
- [x] Atualizado .gitignore com regras adicionais

### 6. Atualização da Documentação
- [x] INSTRUCAO_VSCODE.md atualizado com:
  - Status de produção (segunda-feira)
  - Resultado da análise de segurança
  - Informações do CI/CD
  - Script de configuração
  - Tarefas pendentes organizadas

## Filosofia Estabelecida

### "Lovable.dev Interno"
Funcionários podem solicitar melhorias, IA analisa e orienta implementação:
```
Funcionário → request_improvement() → IA analisa → Gerente aprova → Implementação
```

### "Nada sem IA"
Cada tela tem um agente responsável. Cada decisão é orientada por IA especializada.

## Arquivos Criados/Modificados Nesta Sessão

### Migrations
- `supabase/migrations/20251130130000_openai_sora2_video_generation.sql` (criado)
- `supabase/migrations/20251130140000_continuous_improvement_system.sql` (criado)

### CI/CD
- `.github/workflows/deploy.yml` (criado)
- `.github/workflows/feature-implementation.yml` (criado)
- `.github/SETUP_CI_CD.md` (criado)
- `scripts/setup-cicd.ps1` (criado)

### Configuração
- `.gitignore` (atualizado - regras de segurança)
- `vercel.json` (lido - confirmado seguro)

### Documentação
- `.claude/INSTRUCAO_VSCODE.md` (atualizado)
- `.claude/CONTEXT.md` (atualizado)

## Secrets Configurados

### Supabase (já configurados)
- `OPENAI_API_KEY` - API OpenAI (GPT-5.1, Sora 2, TTS)
- `GEMINI_API_KEY` - API do Google Gemini
- `CNPJA_API_KEY` - API CNPJA
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço
- `SUPABASE_URL` - URL do projeto

### GitHub Actions (pendente configurar)
- `SUPABASE_ACCESS_TOKEN` - Token para deploy migrations
- `VERCEL_TOKEN` - Token para deploy frontend
- `VERCEL_ORG_ID` - ID da organização Vercel
- `VERCEL_PROJECT_ID` - ID do projeto Vercel

## Próximas Tarefas

### Prioridade Imediata (Segunda-feira)
1. Executar `scripts/setup-cicd.ps1` para configurar secrets do GitHub
2. Fazer push para main e testar CI/CD
3. Verificar deploy no Vercel (ampla.app.br)

### Interfaces Pendentes
1. Tela para funcionário preencher entidades pendentes
2. Interface de Configurações com cadastros
3. Interface de Estoque/Compras para Lilian
4. Interface de Folha de Pagamento com comparativo
5. Interface de Consultoria Trabalhista
6. Interface de Vídeos e TVs com player
7. Interface de Incentivos e PLR
8. Interface de Feature Requests

### Edge Functions Pendentes
1. Edge Function para Sora 2 (geração de vídeos)
2. Edge Function para análise de feature requests

## Equipe Ampla (para referência)

### Funcionários
| Nome | Área | Função |
|------|------|--------|
| Rose | DP | Departamento Pessoal |
| Josimar | Contábil | Contador Gerente |
| Lilian | Administrativo | Faxineira/Estoque |

### Terceiros
| Nome | Área | Tipo |
|------|------|------|
| Sr. Daniel | Fiscal | MEI (modelo ideal) |

### Sócios
| Nome | Cargo |
|------|-------|
| Sergio Carneiro Leão | Sócio Principal |
| Carla | Sócia |

### Família (Reuniões Mensais)
- Nayara, Victor Hugo, Sergio Augusto

## Comandos Úteis

```bash
# Rodar local
npm run dev

# Aplicar migrations
npx supabase db push --linked

# Deploy Edge Functions
npx supabase functions deploy --all --project-ref xdtlhzysrpoinqtsglmr

# Configurar CI/CD (PowerShell)
.\scripts\setup-cicd.ps1

# Git
git add . && git commit -m "mensagem" && git push origin main
```

## Links

- **Produção:** https://ampla.app.br
- **Supabase:** https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr
- **GitHub Actions:** https://github.com/amplabusiness/data-bling-sheets-3122699b/actions
- **Site Ampla:** https://www.amplabusiness.com.br
- **Instagram:** https://instagram.com/amplacontabilidade
