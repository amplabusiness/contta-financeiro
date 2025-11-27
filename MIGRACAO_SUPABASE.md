# 🔄 MIGRAÇÃO PARA SEU PRÓPRIO SUPABASE

## ✅ STATUS: Configuração Preparada!

Você está migrando do Lovable.dev para seu próprio projeto Supabase: **xdtlhzysrpoinqtsglmr**

---

## 📋 PASSO A PASSO

### 1️⃣ OBTER CREDENCIAIS DO SUPABASE (5 minutos)

1. **Acesse o Dashboard:**
   - URL: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/settings/api

2. **Copie as seguintes informações:**
   - ✅ **Project URL:** `https://xdtlhzysrpoinqtsglmr.supabase.co`
   - ✅ **anon public (publishable key):** Comece com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - ✅ **service_role (secret key):** Comece com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. **⚠️ IMPORTANTE:** 
   - A `service_role` key é SECRETA - nunca compartilhe!
   - Não faça commit dela no Git

---

### 2️⃣ ATUALIZAR ARQUIVO .ENV (2 minutos)

Abra o arquivo `.env` na raiz do projeto e substitua pelos valores reais:

```env
VITE_SUPABASE_PROJECT_ID="xdtlhzysrpoinqtsglmr"
VITE_SUPABASE_PUBLISHABLE_KEY="COLE_SUA_ANON_KEY_AQUI"
VITE_SUPABASE_URL="https://xdtlhzysrpoinqtsglmr.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="COLE_SUA_SERVICE_ROLE_KEY_AQUI"
```

**Substitua:**
- `COLE_SUA_ANON_KEY_AQUI` → pela anon/public key
- `COLE_SUA_SERVICE_ROLE_KEY_AQUI` → pela service_role key

---

### 3️⃣ INSTALAR SUPABASE CLI (se ainda não tiver)

```powershell
# Instalar via npm (recomendado)
npm install -g supabase

# OU via scoop (Windows)
scoop install supabase
```

**Verificar instalação:**
```powershell
supabase --version
```

---

### 4️⃣ FAZER LOGIN NO SUPABASE CLI

```powershell
supabase login
```

Isso vai abrir o navegador para você autorizar o CLI.

---

### 5️⃣ VINCULAR PROJETO LOCAL AO SUPABASE REMOTO

```powershell
cd C:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b

supabase link --project-ref xdtlhzysrpoinqtsglmr
```

**Quando perguntar o database password:**
- Acesse: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/settings/database
- Copie o password (ou resete se necessário)

---

### 6️⃣ APLICAR TODAS AS MIGRATIONS (O MAIS IMPORTANTE!)

```powershell
# Ver migrations pendentes
supabase db diff

# Aplicar TODAS as migrations no banco remoto
supabase db push
```

Isso vai:
- ✅ Criar todas as tabelas (clients, invoices, bank_accounts, etc)
- ✅ Criar views e functions
- ✅ Configurar RLS (Row Level Security)
- ✅ Aplicar a nova migration de opening_balance
- ✅ Configurar conta SICREDI

**Total de migrations:** 55 arquivos SQL na pasta `supabase/migrations/`

---

### 7️⃣ VERIFICAR SE DEU CERTO

1. **Via CLI:**
```powershell
supabase db ls
```

2. **Via Dashboard:**
   - Acesse: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/editor
   - Você deve ver as tabelas:
     - clients
     - invoices
     - bank_accounts
     - bank_transactions
     - client_opening_balance
     - (e muitas outras...)

3. **Testar no App:**
```powershell
npm run dev
```
   - Acesse: http://localhost:5173
   - Tente fazer login
   - Navegue pelas páginas

---

### 8️⃣ DEPLOY DAS EDGE FUNCTIONS (Opcional - só se usar)

```powershell
# Deploy de TODAS as functions de uma vez
supabase functions deploy

# OU deploy individual
supabase functions deploy process-bank-excel-report
supabase functions deploy parse-ofx-statement
# ... etc
```

**Total de Edge Functions:** 42 functions na pasta `supabase/functions/`

---

## 🔧 COMANDOS ÚTEIS DO SUPABASE CLI

```powershell
# Ver status do projeto
supabase status

# Ver migrations pendentes
supabase db diff

# Aplicar migrations
supabase db push

# Criar nova migration
supabase migration new nome_da_migration

# Resetar banco local (CUIDADO!)
supabase db reset

# Ver logs das functions
supabase functions logs process-bank-excel-report

# Testar function localmente
supabase functions serve

# Ver tabelas
supabase db ls
```

---

## ⚠️ SOLUÇÃO DE PROBLEMAS

### Erro: "Project ref not found"
**Solução:** Verifique se fez o `supabase link` corretamente

### Erro: "Invalid API key"
**Solução:** Atualize o `.env` com as chaves corretas

### Erro: "Permission denied"
**Solução:** Faça login: `supabase login`

### Erro: "Migration conflict"
**Solução:** 
```powershell
# Ver diferenças
supabase db diff

# Forçar push (CUIDADO!)
supabase db push --dry-run  # ver o que vai fazer
supabase db push --force    # forçar aplicação
```

### Migrations não aparecem no Dashboard
**Solução:** Elas foram aplicadas! Verifique:
```sql
SELECT * FROM supabase_migrations.schema_migrations;
```

---

## 📊 O QUE SERÁ CRIADO NO BANCO

### Tabelas Principais (50+)
- `clients` - Clientes
- `invoices` - Faturas/Honorários
- `client_opening_balance` - **NOVO!** Saldo abertura 2024
- `bank_accounts` - Contas bancárias
- `bank_transactions` - Transações bancárias
- `chart_of_accounts` - Plano de contas
- `accounting_entries` - Lançamentos contábeis
- `expenses` - Despesas
- `financial_groups` - Grupos econômicos
- `barter_clients` - Clientes permuta
- `collection_orders` - Ordens de cobrança
- ... e muitas outras

### Views
- `v_client_opening_balance_summary` - Resumo de saldos
- Outras views analíticas

### Functions (PostgreSQL)
- `update_client_opening_balance()` - Auto-atualizar saldos
- Triggers automáticos
- RLS policies

### Edge Functions (Deno)
- `process-bank-excel-report` - **NOVO!** Processar Excel do banco
- `parse-ofx-statement` - Processar OFX
- `ai-accountant-agent` - Agente IA contador
- ... 42 functions no total

---

## 🎯 CHECKLIST DE MIGRAÇÃO

- [ ] Obtive credenciais do Supabase (anon + service_role)
- [ ] Atualizei o arquivo `.env`
- [ ] Instalei Supabase CLI (`supabase --version`)
- [ ] Fiz login (`supabase login`)
- [ ] Vinculei o projeto (`supabase link`)
- [ ] Apliquei migrations (`supabase db push`)
- [ ] Verifiquei tabelas no Dashboard
- [ ] Testei o app localmente (`npm run dev`)
- [ ] (Opcional) Deploy das Edge Functions

---

## 🚀 DEPOIS DA MIGRAÇÃO

Siga o **GUIA_INICIO_RAPIDO.md** para:
1. Cadastrar saldos de abertura
2. Importar extratos bancários
3. Configurar conciliação automática

---

## 📞 DÚVIDAS?

Se algo der errado, me avise e vou te ajudar! 

**Principais logs para verificar:**
- Terminal onde rodou `supabase db push`
- Dashboard do Supabase → Logs
- Console do navegador (F12) ao testar o app

---

**Boa migração! 🎉**
