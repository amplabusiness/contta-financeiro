# Configuração de CI/CD - Ampla Contabilidade

## Fluxo de Deploy Automático

```
┌─────────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
│   Commit    │───▶│  GitHub  │───▶│ Actions  │───▶│  Deploy │
│   Local     │    │   Push   │    │   CI/CD  │    │  Prod   │
└─────────────┘    └──────────┘    └──────────┘    └─────────┘
                                         │
                   ┌─────────────────────┼─────────────────────┐
                   │                     │                     │
                   ▼                     ▼                     ▼
            ┌──────────┐          ┌──────────┐          ┌──────────┐
            │ Supabase │          │  Vercel  │          │ Notifica │
            │Migrations│          │ Frontend │          │  Status  │
            └──────────┘          └──────────┘          └──────────┘
```

## Secrets Necessários no GitHub

### 1. Configurar no GitHub Repository Settings

Vá para: `Settings > Secrets and variables > Actions > New repository secret`

| Secret | Descrição | Onde obter |
|--------|-----------|------------|
| `SUPABASE_ACCESS_TOKEN` | Token de acesso Supabase | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `VERCEL_TOKEN` | Token de API Vercel | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | ID da organização Vercel | Arquivo `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | ID do projeto Vercel | Arquivo `.vercel/project.json` |

### 2. Obter Token Supabase

1. Acesse [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Clique em "Generate new token"
3. Nome: `GitHub Actions Ampla`
4. Copie e salve como `SUPABASE_ACCESS_TOKEN`

### 3. Obter Token Vercel

1. Acesse [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Clique em "Create"
3. Nome: `GitHub Actions Ampla`
4. Scope: Full Account
5. Copie e salve como `VERCEL_TOKEN`

### 4. Obter IDs Vercel

Execute no terminal:
```bash
npx vercel link
```

Depois leia o arquivo `.vercel/project.json`:
```json
{
  "orgId": "SEU_ORG_ID",
  "projectId": "SEU_PROJECT_ID"
}
```

## Como Funciona

### Deploy Automático (push para main)

1. **Commit local** → `git push origin main`
2. **GitHub Actions** dispara automaticamente
3. **Supabase**: Aplica todas as migrations pendentes
4. **Edge Functions**: Deploy de todas as funções
5. **Vercel**: Build e deploy do frontend
6. **Notificação**: Resumo no GitHub Actions

### Sistema de Evolução Contínua

1. **Funcionário solicita** → `request_improvement()`
2. **IA analisa** → `analyze_feature_request()`
3. **Gerente aprova** → Status muda para `approved`
4. **GitHub Action** → Disparo manual do workflow `feature-implementation`
5. **Cria branch** → `feature/{feature_id}`
6. **Gera migration** → Arquivo SQL base
7. **Desenvolve** → IA ou humano implementa
8. **Pull Request** → Review e merge
9. **Deploy automático** → Vai para produção

## Comandos Úteis

### Aplicar migrations manualmente
```bash
npx supabase db push --linked
```

### Deploy de uma Edge Function
```bash
npx supabase functions deploy nome-da-funcao --project-ref xdtlhzysrpoinqtsglmr
```

### Ver status das migrations
```bash
npx supabase migration list --linked
```

### Criar nova migration
```bash
npx supabase migration new nome_da_migration
```

## Verificação de Saúde

Após o deploy, verifique:

1. **Frontend**: Acesse a URL do Vercel
2. **Backend**: Teste uma query no Supabase
3. **Edge Functions**: Teste um endpoint

## Troubleshooting

### Migration falhou
- Verifique o log no GitHub Actions
- Rode manualmente: `npx supabase db push --linked`

### Vercel não atualizou
- Verifique se os secrets estão corretos
- Rode: `npx vercel --prod`

### Edge Function não atualizou
- Verifique o log no Supabase Dashboard
- Rode: `npx supabase functions deploy --all`

## Contatos

- **Projeto**: Ampla Contabilidade
- **Supabase Project ID**: `xdtlhzysrpoinqtsglmr`
- **Repositório**: GitHub main branch
