# 🚀 EDGE FUNCTIONS - SISTEMA CONTÁBIL AMPLA

## 📋 Visão Geral

Este pacote contém 4 Edge Functions que automatizam o fluxo contábil:

| Função | Descrição | Trigger |
|--------|-----------|---------|
| `processar-ofx` | Processa arquivos OFX automaticamente | Upload no Storage |
| `desmembrar-cobranca` | Desmembra cobranças agrupadas | Manual ou arquivo retorno |
| `gerar-honorarios` | Gera honorários mensais | Cron (dia 28) |
| `mcp-guardiao` | Valida TODAS as operações | Chamado por outras funções |

---

## 📁 Estrutura de Arquivos

```
edge-functions/
├── processar-ofx/
│   └── index.ts
├── desmembrar-cobranca/
│   └── index.ts
├── gerar-honorarios/
│   └── index.ts
├── mcp-guardiao/
│   └── index.ts
├── setup-automacao.sql
└── README.md
```

---

## 🛠️ Instruções de Deploy

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Login no Supabase

```bash
supabase login
```

### 3. Linkar ao projeto

```bash
supabase link --project-ref SEU_PROJECT_REF
```

### 4. Deploy das Edge Functions

```bash
# Deploy de todas as funções
supabase functions deploy processar-ofx
supabase functions deploy desmembrar-cobranca
supabase functions deploy gerar-honorarios
supabase functions deploy mcp-guardiao
```

### 5. Executar SQL de configuração

No Supabase Dashboard → SQL Editor:

```sql
-- Copiar e executar o conteúdo de setup-automacao.sql
```

### 6. Configurar variáveis de ambiente

No Supabase Dashboard → Settings → Edge Functions:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx...
```

### 7. Configurar Storage bucket

```sql
-- Criar bucket 'imports' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('imports', 'imports', false)
ON CONFLICT DO NOTHING;

-- Permitir upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'imports');
```

---

## 📖 Como Usar

### Processar OFX

**Automático:** Faça upload de arquivo .ofx no bucket 'imports'

**Manual:**
```bash
curl -X POST 'https://xxx.supabase.co/functions/v1/processar-ofx' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"bucket": "imports", "name": "extrato.ofx"}'
```

### Desmembrar Cobrança

**Com arquivo de retorno:**
```bash
curl -X POST 'https://xxx.supabase.co/functions/v1/desmembrar-cobranca' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "cobrancaId": "COB000027",
    "arquivoRetorno": "CONTEUDO_DO_ARQUIVO_CNAB"
  }'
```

**Com lista manual:**
```bash
curl -X POST 'https://xxx.supabase.co/functions/v1/desmembrar-cobranca' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "cobrancaId": "COB000027",
    "data": "2025-01-15",
    "clientes": [
      {"clienteId": "uuid1", "clienteNome": "ACME LTDA", "valor": 1500.00},
      {"clienteId": "uuid2", "clienteNome": "XYZ CORP", "valor": 2000.00}
    ]
  }'
```

### Gerar Honorários

**Manual (teste):**
```bash
curl -X POST 'https://xxx.supabase.co/functions/v1/gerar-honorarios' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"competencia": "2025-01"}'
```

**Automático:** Cron job executa dia 28 às 08:00

### MCP Guardião

**Validar lançamento:**
```bash
curl -X POST 'https://xxx.supabase.co/functions/v1/mcp-guardiao' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "ferramenta": "validar_lancamento",
    "params": {
      "tipo": "recebimento",
      "linhas": [
        {"contaCode": "1.1.1.05", "debito": 1500, "credito": 0},
        {"contaCode": "1.1.2.01.0001", "debito": 0, "credito": 1500}
      ],
      "referenceType": "bank_transaction",
      "referenceId": "fitid123"
    }
  }'
```

**Diagnóstico completo:**
```bash
curl -X POST 'https://xxx.supabase.co/functions/v1/mcp-guardiao' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"ferramenta": "diagnostico_completo", "params": {}}'
```

**Listar regras (para outras IAs):**
```bash
curl -X POST 'https://xxx.supabase.co/functions/v1/mcp-guardiao' \
  -H 'Authorization: Bearer SEU_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"ferramenta": "listar_regras", "params": {}}'
```

---

## 🔒 Regras do Guardião

O MCP Guardião bloqueia automaticamente:

1. **Conta Sintética** - Lançamento em 1.1.2.01 → BLOQUEADO
2. **Partidas Dobradas** - Débito ≠ Crédito → BLOQUEADO
3. **Idempotência** - Lançamento duplicado → BLOQUEADO
4. **Cobrança Agrupada** - Sem usar transitória → BLOQUEADO

---

## 📊 Verificações Disponíveis

### Via RPC (SQL)

```sql
-- Verificar equação contábil
SELECT * FROM verificar_equacao_contabil();

-- Verificar saldo transitória
SELECT * FROM verificar_saldo_transitoria();

-- Validar lançamento antes de criar
SELECT * FROM validar_lancamento_contabil(
  '[{"contaCode": "1.1.1.05", "debito": 100, "credito": 0}]'::jsonb,
  'teste',
  'ref123'
);

-- Diagnóstico rápido
SELECT * FROM v_diagnostico_contabil;
```

---

## 🐛 Troubleshooting

### Erro: "Conta não encontrada"
- Verifique se a conta existe no plano de contas
- Use `SELECT * FROM chart_of_accounts WHERE code = '1.1.2.01.0001'`

### Erro: "Lançamento duplicado"
- O reference_id já foi usado
- Verifique com `SELECT * FROM accounting_entries WHERE reference_id = 'xxx'`

### OFX não processado automaticamente
- Verifique se o trigger está ativo: `SELECT * FROM pg_trigger WHERE tgname = 'on_ofx_uploaded'`
- Verifique logs: Supabase Dashboard → Edge Functions → Logs

### Cron não executando
- Verifique se pg_cron está habilitado
- Verifique jobs: `SELECT * FROM cron.job`

---

## 📝 Logs

Para ver logs das Edge Functions:

1. Supabase Dashboard → Edge Functions
2. Selecionar função
3. Clicar em "Logs"

Ou via CLI:

```bash
supabase functions logs processar-ofx
```

---

## 📞 Suporte

Em caso de dúvidas, consulte:
- `TREINAMENTO_MCP_CICERO.md` - Documentação completa
- `ARQUITETURA_SISTEMA_AUTOMATIZADO.md` - Visão geral

---

*Versão 1.0 - Janeiro 2026*
