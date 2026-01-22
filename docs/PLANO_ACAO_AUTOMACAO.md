# CONTTA Financeiro - Plano de Ação para Automação

## Sumário Executivo

Este documento detalha o plano de implementação das melhorias de automação identificadas na análise do sistema CONTTA Financeiro. O plano está organizado em **4 Sprints de 2 semanas cada**, totalizando **8 semanas** para os itens críticos e importantes.

---

## Visão Geral do Cronograma

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CRONOGRAMA DE IMPLEMENTAÇÃO                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SPRINT 1 (Sem 1-2)     SPRINT 2 (Sem 3-4)     SPRINT 3 (Sem 5-6)          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ FUNDAÇÃO        │    │ INTELIGÊNCIA    │    │ AUTOMAÇÃO       │         │
│  │                 │    │                 │    │                 │         │
│  │ • Auto-criação  │    │ • Identificação │    │ • Pipeline      │         │
│  │   de contas     │    │   de pagadores  │    │   completo      │         │
│  │ • Extração de   │    │ • Aprendizado   │    │ • Dashboard     │         │
│  │   metadados     │    │   contínuo      │    │   monitoramento │         │
│  │ • Alertas       │    │ • QSA matching  │    │ • Agentes v1    │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│         ↓                      ↓                      ↓                    │
│    [ENTREGA 1]           [ENTREGA 2]           [ENTREGA 3]                 │
│    Contas automáticas    Conciliação 80%       Piloto automático           │
│                                                                             │
│  SPRINT 4 (Sem 7-8)                                                        │
│  ┌─────────────────┐                                                       │
│  │ OTIMIZAÇÃO      │                                                       │
│  │                 │                                                       │
│  │ • Fechamento    │                                                       │
│  │   automático    │                                                       │
│  │ • Relatórios    │                                                       │
│  │ • Refinamentos  │                                                       │
│  └─────────────────┘                                                       │
│         ↓                                                                  │
│    [ENTREGA 4]                                                             │
│    Sistema completo                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Sprint 1: Fundação (Semanas 1-2)

### Objetivo
Criar a base sólida para automação: garantir que toda entidade tenha sua representação contábil automática.

### Tarefas Detalhadas

#### 1.1 Auto-criação de Conta Contábil para Clientes
**Prioridade:** 🔴 Crítica | **Esforço:** 3 dias | **Responsável:** Backend

**Contexto:**
Atualmente, clientes novos não têm conta em `1.1.2.01.xxx`, o que trava a conciliação automática.

**Implementação:**

```sql
-- Arquivo: supabase/migrations/20260122000000_auto_create_client_account.sql

-- 1. Função que cria conta contábil para cliente
CREATE OR REPLACE FUNCTION fn_auto_create_client_account()
RETURNS TRIGGER AS $$
DECLARE
  v_next_code TEXT;
  v_parent_id UUID;
  v_new_account_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Só executar se cliente ainda não tem conta
  IF NEW.accounting_account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_tenant_id := NEW.tenant_id;

  -- Buscar conta pai (1.1.2.01 - Clientes a Receber)
  SELECT id INTO v_parent_id
  FROM chart_of_accounts
  WHERE code = '1.1.2.01'
    AND tenant_id = v_tenant_id;

  IF v_parent_id IS NULL THEN
    -- Criar estrutura base se não existir
    PERFORM ensure_base_chart_of_accounts(v_tenant_id);

    SELECT id INTO v_parent_id
    FROM chart_of_accounts
    WHERE code = '1.1.2.01'
      AND tenant_id = v_tenant_id;
  END IF;

  -- Gerar próximo código disponível
  SELECT '1.1.2.01.' || LPAD((COALESCE(MAX(SUBSTRING(code FROM '1\.1\.2\.01\.(\d+)')::INT), 0) + 1)::TEXT, 3, '0')
  INTO v_next_code
  FROM chart_of_accounts
  WHERE code LIKE '1.1.2.01.%'
    AND tenant_id = v_tenant_id;

  -- Criar conta contábil
  INSERT INTO chart_of_accounts (
    code,
    name,
    account_type,
    nature,
    parent_id,
    level,
    is_analytical,
    is_synthetic,
    accepts_entries,
    description,
    tenant_id
  ) VALUES (
    v_next_code,
    LEFT(COALESCE(NEW.name, NEW.razao_social, 'Cliente ' || v_next_code), 200),
    'ativo_circulante',
    'DEVEDORA',
    v_parent_id,
    5,
    true,
    false,
    true,
    'Conta criada automaticamente para cliente: ' || COALESCE(NEW.cnpj, NEW.cpf, 'N/A'),
    v_tenant_id
  )
  RETURNING id INTO v_new_account_id;

  -- Atualizar cliente com a nova conta
  NEW.accounting_account_id := v_new_account_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger no INSERT de clientes
DROP TRIGGER IF EXISTS trg_auto_create_client_account ON clients;
CREATE TRIGGER trg_auto_create_client_account
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_client_account();

-- 3. Trigger no UPDATE (caso accounting_account_id seja removido)
CREATE OR REPLACE FUNCTION fn_ensure_client_account_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.accounting_account_id IS NULL AND OLD.accounting_account_id IS NOT NULL THEN
    -- Não permitir remoção da conta
    NEW.accounting_account_id := OLD.accounting_account_id;
  ELSIF NEW.accounting_account_id IS NULL THEN
    -- Criar conta se não existir
    NEW := fn_auto_create_client_account();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Migration: Criar contas para clientes existentes sem conta
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, name, razao_social, cnpj, cpf, tenant_id
    FROM clients
    WHERE accounting_account_id IS NULL
      AND is_active = true
  LOOP
    -- Simular INSERT para disparar o trigger
    UPDATE clients
    SET updated_at = NOW()
    WHERE id = r.id;
  END LOOP;
END;
$$;
```

**Critérios de Aceite:**
- [ ] Todo cliente novo recebe conta contábil automaticamente
- [ ] Clientes existentes sem conta são migrados
- [ ] Código da conta segue padrão sequencial (1.1.2.01.001, 002, 003...)
- [ ] Conta é vinculada ao `accounting_account_id` do cliente

---

#### 1.2 Extração de Metadados de Transações Bancárias
**Prioridade:** 🔴 Crítica | **Esforço:** 2 dias | **Responsável:** Backend

**Contexto:**
Transações OFX contêm informações valiosas (CNPJ, CPF, COB) que não são extraídas sistematicamente.

**Implementação:**

```sql
-- Arquivo: supabase/migrations/20260122000001_extract_transaction_metadata.sql

-- 1. Adicionar colunas de metadados se não existirem
ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS extracted_cnpj VARCHAR(18),
ADD COLUMN IF NOT EXISTS extracted_cpf VARCHAR(14),
ADD COLUMN IF NOT EXISTS extracted_cob VARCHAR(20),
ADD COLUMN IF NOT EXISTS extracted_name TEXT,
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(30), -- pix, ted, doc, boleto, tarifa, outros
ADD COLUMN IF NOT EXISTS payer_type VARCHAR(20), -- pj, pf, interno, desconhecido
ADD COLUMN IF NOT EXISTS metadata_extracted_at TIMESTAMPTZ;

-- 2. Função de extração de metadados
CREATE OR REPLACE FUNCTION fn_extract_transaction_metadata()
RETURNS TRIGGER AS $$
DECLARE
  v_desc TEXT;
  v_cnpj TEXT;
  v_cpf TEXT;
  v_cob TEXT;
  v_name TEXT;
  v_type TEXT;
BEGIN
  v_desc := UPPER(COALESCE(NEW.description, ''));

  -- Detectar tipo de transação
  v_type := CASE
    WHEN v_desc LIKE '%PIX%' THEN 'pix'
    WHEN v_desc LIKE '%TED%' THEN 'ted'
    WHEN v_desc LIKE '%DOC%' THEN 'doc'
    WHEN v_desc LIKE '%LIQ.COBRANCA%' OR v_desc LIKE '%COB%' THEN 'boleto'
    WHEN v_desc LIKE '%TARIFA%' OR v_desc LIKE '%TAR %' OR v_desc LIKE '%PACOTE%' THEN 'tarifa'
    WHEN v_desc LIKE '%TRANSF%' THEN 'transferencia'
    WHEN v_desc LIKE '%SAQUE%' THEN 'saque'
    WHEN v_desc LIKE '%DEPOSITO%' THEN 'deposito'
    ELSE 'outros'
  END;

  -- Extrair CNPJ (XX.XXX.XXX/XXXX-XX ou XXXXXXXXXXXXXXXX)
  v_cnpj := (
    SELECT (regexp_matches(v_desc, '(\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\/\s]?\d{4}[\-\s]?\d{2})', 'g'))[1]
    LIMIT 1
  );
  -- Limpar e formatar
  IF v_cnpj IS NOT NULL THEN
    v_cnpj := regexp_replace(v_cnpj, '[^\d]', '', 'g');
    IF LENGTH(v_cnpj) = 14 THEN
      v_cnpj := SUBSTRING(v_cnpj, 1, 2) || '.' ||
                SUBSTRING(v_cnpj, 3, 3) || '.' ||
                SUBSTRING(v_cnpj, 6, 3) || '/' ||
                SUBSTRING(v_cnpj, 9, 4) || '-' ||
                SUBSTRING(v_cnpj, 13, 2);
    ELSE
      v_cnpj := NULL;
    END IF;
  END IF;

  -- Extrair CPF (XXX.XXX.XXX-XX) se não achou CNPJ
  IF v_cnpj IS NULL THEN
    v_cpf := (
      SELECT (regexp_matches(v_desc, '(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\-\s]?\d{2})', 'g'))[1]
      LIMIT 1
    );
    IF v_cpf IS NOT NULL THEN
      v_cpf := regexp_replace(v_cpf, '[^\d]', '', 'g');
      IF LENGTH(v_cpf) = 11 THEN
        v_cpf := SUBSTRING(v_cpf, 1, 3) || '.' ||
                 SUBSTRING(v_cpf, 4, 3) || '.' ||
                 SUBSTRING(v_cpf, 7, 3) || '-' ||
                 SUBSTRING(v_cpf, 10, 2);
      ELSE
        v_cpf := NULL;
      END IF;
    END IF;
  END IF;

  -- Extrair código COB (boletos)
  v_cob := (
    SELECT (regexp_matches(v_desc, '(COB\d{6,10})', 'gi'))[1]
    LIMIT 1
  );
  IF v_cob IS NULL THEN
    v_cob := (
      SELECT 'COB' || (regexp_matches(v_desc, 'OB(\d{6,10})', 'gi'))[1]
      LIMIT 1
    );
  END IF;

  -- Extrair nome (após "- " ou após tipo de transação)
  v_name := (
    SELECT (regexp_matches(v_desc, '(?:PIX|TED|DOC|TRANSF)[^\-]*\-\s*([A-Z][A-Z\s]{3,50})', 'i'))[1]
    LIMIT 1
  );
  IF v_name IS NOT NULL THEN
    v_name := TRIM(regexp_replace(v_name, '\s+', ' ', 'g'));
  END IF;

  -- Atualizar registro
  NEW.extracted_cnpj := v_cnpj;
  NEW.extracted_cpf := v_cpf;
  NEW.extracted_cob := UPPER(v_cob);
  NEW.extracted_name := v_name;
  NEW.transaction_type := v_type;
  NEW.payer_type := CASE
    WHEN v_cnpj IS NOT NULL THEN 'pj'
    WHEN v_cpf IS NOT NULL THEN 'pf'
    ELSE 'desconhecido'
  END;
  NEW.metadata_extracted_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_extract_transaction_metadata ON bank_transactions;
CREATE TRIGGER trg_extract_transaction_metadata
  BEFORE INSERT OR UPDATE OF description ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_extract_transaction_metadata();

-- 4. Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_bank_transactions_extracted_cnpj
  ON bank_transactions(extracted_cnpj) WHERE extracted_cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_transactions_extracted_cpf
  ON bank_transactions(extracted_cpf) WHERE extracted_cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_transactions_extracted_cob
  ON bank_transactions(extracted_cob) WHERE extracted_cob IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_transactions_type
  ON bank_transactions(transaction_type);

-- 5. Reprocessar transações existentes
UPDATE bank_transactions
SET metadata_extracted_at = NULL
WHERE metadata_extracted_at IS NULL;
-- O trigger vai extrair os metadados
```

**Critérios de Aceite:**
- [ ] CNPJ extraído de 95%+ das transações PJ
- [ ] CPF extraído de 90%+ das transações PF
- [ ] COB extraído de 100% das transações de boleto
- [ ] Tipo de transação classificado automaticamente

---

#### 1.3 Sistema de Alertas Diários
**Prioridade:** 🟠 Importante | **Esforço:** 2 dias | **Responsável:** Backend

**Implementação:**

```sql
-- Arquivo: supabase/migrations/20260122000002_daily_alerts_system.sql

-- 1. Tabela de alertas
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL, -- 'reconciliation', 'payment_due', 'client_missing_account', 'anomaly'
  severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'critical'
  title TEXT NOT NULL,
  description TEXT,
  entity_type VARCHAR(50), -- 'bank_transaction', 'client', 'invoice'
  entity_id UUID,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  tenant_id UUID NOT NULL
);

-- 2. Função para gerar alertas diários
CREATE OR REPLACE FUNCTION fn_generate_daily_alerts()
RETURNS TABLE(alerts_created INTEGER) AS $$
DECLARE
  v_count INTEGER := 0;
  v_tenant RECORD;
BEGIN
  -- Para cada tenant ativo
  FOR v_tenant IN SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
  LOOP
    -- Alerta: Transações não conciliadas > 3 dias
    INSERT INTO system_alerts (alert_type, severity, title, description, entity_type, entity_id, action_url, tenant_id)
    SELECT
      'reconciliation',
      CASE WHEN AGE(NOW(), bt.transaction_date) > INTERVAL '7 days' THEN 'critical' ELSE 'warning' END,
      'Transação não conciliada: R$ ' || bt.amount,
      bt.description || ' - ' || bt.transaction_date::DATE,
      'bank_transaction',
      bt.id,
      '/bank-reconciliation?id=' || bt.id,
      v_tenant.tenant_id
    FROM bank_transactions bt
    WHERE bt.tenant_id = v_tenant.tenant_id
      AND bt.matched = false
      AND bt.amount > 0 -- Apenas créditos
      AND bt.transaction_date < NOW() - INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM system_alerts sa
        WHERE sa.entity_id = bt.id
          AND sa.alert_type = 'reconciliation'
          AND sa.is_resolved = false
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Alerta: Clientes sem conta contábil
    INSERT INTO system_alerts (alert_type, severity, title, description, entity_type, entity_id, action_url, tenant_id)
    SELECT
      'client_missing_account',
      'warning',
      'Cliente sem conta contábil: ' || c.name,
      'CNPJ: ' || COALESCE(c.cnpj, 'N/A'),
      'client',
      c.id,
      '/clients?id=' || c.id,
      v_tenant.tenant_id
    FROM clients c
    WHERE c.tenant_id = v_tenant.tenant_id
      AND c.accounting_account_id IS NULL
      AND c.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM system_alerts sa
        WHERE sa.entity_id = c.id
          AND sa.alert_type = 'client_missing_account'
          AND sa.is_resolved = false
      );

    -- Alerta: Faturas vencidas não pagas
    INSERT INTO system_alerts (alert_type, severity, title, description, entity_type, entity_id, action_url, tenant_id)
    SELECT
      'payment_due',
      CASE
        WHEN AGE(NOW(), i.due_date) > INTERVAL '30 days' THEN 'critical'
        WHEN AGE(NOW(), i.due_date) > INTERVAL '7 days' THEN 'warning'
        ELSE 'info'
      END,
      'Fatura vencida: ' || cl.name || ' - R$ ' || i.amount,
      'Vencimento: ' || i.due_date || ' (' || EXTRACT(DAY FROM AGE(NOW(), i.due_date))::INT || ' dias)',
      'invoice',
      i.id,
      '/invoices?id=' || i.id,
      v_tenant.tenant_id
    FROM invoices i
    JOIN clients cl ON cl.id = i.client_id
    WHERE i.tenant_id = v_tenant.tenant_id
      AND i.status IN ('pending', 'overdue')
      AND i.due_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM system_alerts sa
        WHERE sa.entity_id = i.id
          AND sa.alert_type = 'payment_due'
          AND sa.is_resolved = false
          AND sa.created_at > NOW() - INTERVAL '7 days' -- Não duplicar alerta em 7 dias
      );

  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Agendar execução diária (6h da manhã)
SELECT cron.schedule(
  'daily_alerts_generation',
  '0 6 * * *',
  'SELECT fn_generate_daily_alerts();'
);

-- 4. View para dashboard de alertas
CREATE OR REPLACE VIEW v_alerts_dashboard AS
SELECT
  tenant_id,
  alert_type,
  severity,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE NOT is_read) as unread_count
FROM system_alerts
WHERE NOT is_resolved
GROUP BY tenant_id, alert_type, severity;
```

**Critérios de Aceite:**
- [ ] Alertas gerados automaticamente às 6h
- [ ] 3 tipos de alerta funcionando
- [ ] Dashboard exibe alertas não lidos
- [ ] Alertas podem ser marcados como resolvidos

---

### Entregáveis Sprint 1

| Item | Arquivo | Status |
|------|---------|--------|
| Auto-criação conta cliente | `20260122000000_auto_create_client_account.sql` | ⬜ |
| Extração de metadados | `20260122000001_extract_transaction_metadata.sql` | ⬜ |
| Sistema de alertas | `20260122000002_daily_alerts_system.sql` | ⬜ |
| Testes unitários | `tests/automation/sprint1.test.ts` | ⬜ |
| Documentação | `docs/SPRINT1_RELEASE_NOTES.md` | ⬜ |

---

## Sprint 2: Inteligência (Semanas 3-4)

### Objetivo
Implementar identificação automática de pagadores e sistema de aprendizado contínuo.

### Tarefas Detalhadas

#### 2.1 Identificação Automática de Pagadores
**Prioridade:** 🔴 Crítica | **Esforço:** 5 dias | **Responsável:** Backend + IA

**Implementação:**

```typescript
// Arquivo: supabase/functions/ai-payer-identifier/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface IdentificationResult {
  transactionId: string;
  confidence: number;
  method: 'cnpj_match' | 'cpf_match' | 'qsa_match' | 'name_similarity' | 'pattern_learned' | 'invoice_match';
  clientId?: string;
  clientName?: string;
  accountCode?: string;
  invoiceId?: string;
  reasoning: string;
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { transaction_id } = await req.json()

  // Buscar transação
  const { data: tx } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', transaction_id)
    .single()

  if (!tx) {
    return new Response(JSON.stringify({ error: 'Transaction not found' }), { status: 404 })
  }

  const result: IdentificationResult = {
    transactionId: transaction_id,
    confidence: 0,
    method: 'name_similarity',
    reasoning: ''
  }

  // ESTRATÉGIA 1: Match por CNPJ extraído
  if (tx.extracted_cnpj) {
    const { data: clientByCnpj } = await supabase
      .from('clients')
      .select('id, name, accounting_account_id, chart_of_accounts(code)')
      .eq('cnpj', tx.extracted_cnpj)
      .eq('tenant_id', tx.tenant_id)
      .single()

    if (clientByCnpj) {
      result.confidence = 100
      result.method = 'cnpj_match'
      result.clientId = clientByCnpj.id
      result.clientName = clientByCnpj.name
      result.accountCode = clientByCnpj.chart_of_accounts?.code
      result.reasoning = `CNPJ ${tx.extracted_cnpj} encontrado no cadastro de clientes`

      await updateTransactionMatch(supabase, tx.id, result)
      return new Response(JSON.stringify(result))
    }
  }

  // ESTRATÉGIA 2: Match por CPF no QSA (sócios)
  if (tx.extracted_cpf) {
    const { data: clientsByQsa } = await supabase
      .from('clients')
      .select('id, name, qsa, accounting_account_id, chart_of_accounts(code)')
      .eq('tenant_id', tx.tenant_id)
      .not('qsa', 'is', null)

    for (const client of clientsByQsa || []) {
      const qsa = client.qsa as any[]
      if (qsa?.some(socio =>
        socio.cpf_cnpj?.replace(/\D/g, '') === tx.extracted_cpf.replace(/\D/g, '')
      )) {
        result.confidence = 95
        result.method = 'qsa_match'
        result.clientId = client.id
        result.clientName = client.name
        result.accountCode = client.chart_of_accounts?.code
        result.reasoning = `CPF ${tx.extracted_cpf} é sócio da empresa ${client.name}`

        await updateTransactionMatch(supabase, tx.id, result)
        return new Response(JSON.stringify(result))
      }
    }
  }

  // ESTRATÉGIA 3: Match por valor + data com faturas pendentes
  if (tx.amount > 0) {
    const txDate = new Date(tx.transaction_date)
    const startDate = new Date(txDate.getTime() - 3 * 24 * 60 * 60 * 1000) // -3 dias
    const endDate = new Date(txDate.getTime() + 1 * 24 * 60 * 60 * 1000)   // +1 dia

    const { data: matchingInvoices } = await supabase
      .from('invoices')
      .select('id, client_id, amount, clients(id, name, accounting_account_id, chart_of_accounts(code))')
      .eq('tenant_id', tx.tenant_id)
      .eq('status', 'pending')
      .eq('amount', tx.amount)
      .gte('due_date', startDate.toISOString().split('T')[0])
      .lte('due_date', endDate.toISOString().split('T')[0])

    if (matchingInvoices?.length === 1) {
      const invoice = matchingInvoices[0]
      const client = invoice.clients as any

      result.confidence = 85
      result.method = 'invoice_match'
      result.clientId = client.id
      result.clientName = client.name
      result.accountCode = client.chart_of_accounts?.code
      result.invoiceId = invoice.id
      result.reasoning = `Valor R$ ${tx.amount} coincide com fatura única pendente do cliente`

      await updateTransactionMatch(supabase, tx.id, result)
      return new Response(JSON.stringify(result))
    }
  }

  // ESTRATÉGIA 4: Match por nome similar
  if (tx.extracted_name) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, razao_social, accounting_account_id, chart_of_accounts(code)')
      .eq('tenant_id', tx.tenant_id)
      .eq('is_active', true)

    let bestMatch = { client: null as any, score: 0 }

    for (const client of clients || []) {
      const namesToCheck = [client.name, client.razao_social].filter(Boolean)
      for (const name of namesToCheck) {
        const score = calculateSimilarity(tx.extracted_name.toLowerCase(), name.toLowerCase())
        if (score > bestMatch.score) {
          bestMatch = { client, score }
        }
      }
    }

    if (bestMatch.score >= 0.7) {
      result.confidence = Math.round(bestMatch.score * 100)
      result.method = 'name_similarity'
      result.clientId = bestMatch.client.id
      result.clientName = bestMatch.client.name
      result.accountCode = bestMatch.client.chart_of_accounts?.code
      result.reasoning = `Nome "${tx.extracted_name}" similar a "${bestMatch.client.name}" (${result.confidence}%)`

      await updateTransactionMatch(supabase, tx.id, result)
      return new Response(JSON.stringify(result))
    }
  }

  // ESTRATÉGIA 5: Padrões aprendidos
  const { data: patterns } = await supabase
    .from('ai_classification_patterns')
    .select('*')
    .eq('tenant_id', tx.tenant_id)
    .eq('target_type', 'client')
    .gt('effectiveness', 0.7)
    .order('effectiveness', { ascending: false })

  for (const pattern of patterns || []) {
    if (tx.description.toUpperCase().includes(pattern.pattern_value.text?.toUpperCase())) {
      result.confidence = Math.round((pattern.effectiveness || 0.8) * 100)
      result.method = 'pattern_learned'
      result.clientId = pattern.target_value.client_id
      result.clientName = pattern.target_value.client_name
      result.accountCode = pattern.target_value.account_code
      result.reasoning = `Padrão aprendido: "${pattern.pattern_value.text}" → ${pattern.target_value.client_name}`

      // Incrementar uso do padrão
      await supabase.rpc('increment_pattern_usage', { pattern_id: pattern.id })

      await updateTransactionMatch(supabase, tx.id, result)
      return new Response(JSON.stringify(result))
    }
  }

  // Não identificado
  result.confidence = 0
  result.reasoning = 'Não foi possível identificar o pagador automaticamente'

  return new Response(JSON.stringify(result))
})

function calculateSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/))
  const setB = new Set(b.split(/\s+/))
  const intersection = [...setA].filter(x => setB.has(x)).length
  return intersection / Math.max(setA.size, setB.size)
}

async function updateTransactionMatch(supabase: any, txId: string, result: IdentificationResult) {
  if (result.confidence >= 90) {
    // Auto-conciliar
    await supabase
      .from('bank_transactions')
      .update({
        suggested_client_id: result.clientId,
        suggested_account_code: result.accountCode,
        identification_confidence: result.confidence,
        identification_method: result.method,
        identification_reasoning: result.reasoning,
        auto_matched: true,
        matched: true
      })
      .eq('id', txId)
  } else if (result.confidence >= 70) {
    // Sugerir mas não auto-conciliar
    await supabase
      .from('bank_transactions')
      .update({
        suggested_client_id: result.clientId,
        suggested_account_code: result.accountCode,
        identification_confidence: result.confidence,
        identification_method: result.method,
        identification_reasoning: result.reasoning,
        auto_matched: false,
        needs_review: true
      })
      .eq('id', txId)
  }
}
```

**Trigger para chamar a Edge Function:**

```sql
-- Arquivo: supabase/migrations/20260122100000_payer_identification_trigger.sql

-- Adicionar colunas necessárias
ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS suggested_client_id UUID REFERENCES clients(id),
ADD COLUMN IF NOT EXISTS suggested_account_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS identification_confidence NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS identification_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS identification_reasoning TEXT,
ADD COLUMN IF NOT EXISTS auto_matched BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;

-- Função que chama a Edge Function
CREATE OR REPLACE FUNCTION fn_trigger_payer_identification()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas para créditos (recebimentos) não conciliados
  IF NEW.amount > 0 AND NEW.matched = false THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/ai-payer-identifier',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object('transaction_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger assíncrono
DROP TRIGGER IF EXISTS trg_identify_payer ON bank_transactions;
CREATE TRIGGER trg_identify_payer
  AFTER INSERT ON bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_trigger_payer_identification();
```

**Critérios de Aceite:**
- [ ] CNPJ match retorna 100% confiança
- [ ] QSA match retorna 95% confiança
- [ ] Valor+data match retorna 85% confiança
- [ ] Confiança >= 90% auto-concilia
- [ ] Confiança 70-89% marca para revisão
- [ ] Métricas de identificação disponíveis

---

#### 2.2 Sistema de Aprendizado Contínuo
**Prioridade:** 🟠 Importante | **Esforço:** 4 dias | **Responsável:** Backend

```sql
-- Arquivo: supabase/migrations/20260122100001_learning_system.sql

-- 1. Tabela de padrões aprendidos (já parcialmente existe)
CREATE TABLE IF NOT EXISTS ai_classification_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type VARCHAR(50) NOT NULL, -- 'description', 'value_range', 'combination'
  pattern_value JSONB NOT NULL,
  target_type VARCHAR(50) NOT NULL, -- 'client', 'account', 'category'
  target_value JSONB NOT NULL,
  confidence_base NUMERIC(3,2) DEFAULT 0.80,
  usage_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  effectiveness NUMERIC(5,4) GENERATED ALWAYS AS (
    CASE WHEN usage_count > 0
    THEN success_count::NUMERIC / usage_count
    ELSE 0.80 END
  ) STORED,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  tenant_id UUID NOT NULL
);

-- 2. Tabela de feedback do usuário
CREATE TABLE IF NOT EXISTS ai_classification_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL, -- 'bank_transaction'
  entity_id UUID NOT NULL,
  original_suggestion JSONB, -- O que a IA sugeriu
  user_correction JSONB,     -- O que o usuário corrigiu
  feedback_type VARCHAR(20), -- 'confirmed', 'corrected', 'rejected'
  pattern_id UUID REFERENCES ai_classification_patterns(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  tenant_id UUID NOT NULL
);

-- 3. Função para aprender com correções
CREATE OR REPLACE FUNCTION fn_learn_from_correction()
RETURNS TRIGGER AS $$
DECLARE
  v_pattern_text TEXT;
  v_existing_pattern UUID;
BEGIN
  -- Só aprender se foi correção
  IF NEW.feedback_type != 'corrected' THEN
    RETURN NEW;
  END IF;

  -- Extrair padrão da descrição original
  SELECT description INTO v_pattern_text
  FROM bank_transactions
  WHERE id = NEW.entity_id;

  -- Simplificar padrão (remover números, manter palavras-chave)
  v_pattern_text := regexp_replace(v_pattern_text, '\d+', '', 'g');
  v_pattern_text := regexp_replace(v_pattern_text, '\s+', ' ', 'g');
  v_pattern_text := TRIM(UPPER(v_pattern_text));

  -- Verificar se padrão já existe
  SELECT id INTO v_existing_pattern
  FROM ai_classification_patterns
  WHERE tenant_id = NEW.tenant_id
    AND pattern_type = 'description'
    AND pattern_value->>'text' = v_pattern_text;

  IF v_existing_pattern IS NOT NULL THEN
    -- Atualizar padrão existente
    UPDATE ai_classification_patterns
    SET
      target_value = NEW.user_correction,
      failure_count = failure_count + 1,
      last_used_at = NOW()
    WHERE id = v_existing_pattern;
  ELSE
    -- Criar novo padrão
    INSERT INTO ai_classification_patterns (
      pattern_type,
      pattern_value,
      target_type,
      target_value,
      tenant_id,
      created_by
    ) VALUES (
      'description',
      jsonb_build_object('text', v_pattern_text),
      'client',
      NEW.user_correction,
      NEW.tenant_id,
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_learn_from_correction
  AFTER INSERT ON ai_classification_feedback
  FOR EACH ROW
  EXECUTE FUNCTION fn_learn_from_correction();

-- 4. Função para registrar confirmação de sugestão
CREATE OR REPLACE FUNCTION fn_confirm_suggestion(
  p_transaction_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_tx RECORD;
BEGIN
  SELECT * INTO v_tx FROM bank_transactions WHERE id = p_transaction_id;

  -- Registrar feedback positivo
  INSERT INTO ai_classification_feedback (
    entity_type,
    entity_id,
    original_suggestion,
    feedback_type,
    created_by,
    tenant_id
  ) VALUES (
    'bank_transaction',
    p_transaction_id,
    jsonb_build_object(
      'client_id', v_tx.suggested_client_id,
      'account_code', v_tx.suggested_account_code,
      'confidence', v_tx.identification_confidence,
      'method', v_tx.identification_method
    ),
    'confirmed',
    p_user_id,
    v_tx.tenant_id
  );

  -- Incrementar sucesso nos padrões usados
  IF v_tx.identification_method = 'pattern_learned' THEN
    UPDATE ai_classification_patterns
    SET success_count = success_count + 1,
        last_used_at = NOW()
    WHERE pattern_value->>'text' ILIKE '%' ||
          (SELECT UPPER(regexp_replace(description, '\d+', '', 'g')) FROM bank_transactions WHERE id = p_transaction_id) || '%'
      AND tenant_id = v_tx.tenant_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. View de efetividade dos padrões
CREATE OR REPLACE VIEW v_pattern_effectiveness AS
SELECT
  tenant_id,
  pattern_type,
  target_type,
  COUNT(*) as total_patterns,
  AVG(effectiveness) as avg_effectiveness,
  SUM(usage_count) as total_uses,
  SUM(success_count) as total_successes,
  SUM(failure_count) as total_failures
FROM ai_classification_patterns
GROUP BY tenant_id, pattern_type, target_type;
```

**Critérios de Aceite:**
- [ ] Correções do usuário geram novos padrões
- [ ] Confirmações aumentam score dos padrões
- [ ] Padrões com baixa efetividade são despriorizados
- [ ] Dashboard mostra efetividade do aprendizado

---

### Entregáveis Sprint 2

| Item | Arquivo | Status |
|------|---------|--------|
| Edge Function identificação | `ai-payer-identifier/index.ts` | ⬜ |
| Trigger de identificação | `20260122100000_payer_identification_trigger.sql` | ⬜ |
| Sistema de aprendizado | `20260122100001_learning_system.sql` | ⬜ |
| Testes E2E | `tests/automation/payer-identification.test.ts` | ⬜ |
| Documentação | `docs/SPRINT2_RELEASE_NOTES.md` | ⬜ |

---

## Sprint 3: Automação (Semanas 5-6)

### Objetivo
Criar o pipeline completo de conciliação e dashboard de monitoramento.

### Tarefas Detalhadas

#### 3.1 Pipeline de Conciliação Automática
**Prioridade:** 🔴 Crítica | **Esforço:** 5 dias

```typescript
// Arquivo: src/services/AutoReconciliationPipeline.ts

import { supabase } from '@/integrations/supabase/client';
import { accountingService } from '@/services/AccountingService';

interface ReconciliationStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

interface PipelineResult {
  transactionId: string;
  success: boolean;
  steps: ReconciliationStep[];
  finalStatus: 'reconciled' | 'needs_review' | 'failed';
  accountingEntryId?: string;
}

export class AutoReconciliationPipeline {

  /**
   * Executa o pipeline completo para uma transação
   */
  static async process(transactionId: string): Promise<PipelineResult> {
    const result: PipelineResult = {
      transactionId,
      success: false,
      steps: [],
      finalStatus: 'failed'
    };

    try {
      // STEP 1: Buscar transação
      const step1: ReconciliationStep = { name: 'fetch_transaction', status: 'running' };
      result.steps.push(step1);

      const { data: tx, error: txError } = await supabase
        .from('bank_transactions')
        .select('*, clients(*), chart_of_accounts(*)')
        .eq('id', transactionId)
        .single();

      if (txError || !tx) {
        step1.status = 'failed';
        step1.error = txError?.message || 'Transaction not found';
        return result;
      }
      step1.status = 'completed';
      step1.result = { amount: tx.amount, type: tx.transaction_type };

      // STEP 2: Verificar se já está conciliada
      if (tx.matched) {
        result.success = true;
        result.finalStatus = 'reconciled';
        result.steps.push({ name: 'already_reconciled', status: 'completed' });
        return result;
      }

      // STEP 3: Verificar identificação
      const step3: ReconciliationStep = { name: 'check_identification', status: 'running' };
      result.steps.push(step3);

      if (!tx.suggested_client_id && tx.identification_confidence < 70) {
        step3.status = 'completed';
        step3.result = { confidence: tx.identification_confidence };
        result.finalStatus = 'needs_review';
        result.success = true;
        return result;
      }
      step3.status = 'completed';
      step3.result = {
        clientId: tx.suggested_client_id,
        confidence: tx.identification_confidence
      };

      // STEP 4: Buscar fatura correspondente
      const step4: ReconciliationStep = { name: 'find_invoice', status: 'running' };
      result.steps.push(step4);

      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', tx.suggested_client_id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

      // Encontrar melhor match
      let matchedInvoice = null;

      // Match exato por valor
      matchedInvoice = invoices?.find(inv =>
        Math.abs(Number(inv.amount) - Number(tx.amount)) < 0.01
      );

      // Se não achou exato, pegar mais antiga
      if (!matchedInvoice && invoices?.length) {
        matchedInvoice = invoices[0];
      }

      step4.status = 'completed';
      step4.result = matchedInvoice ? { invoiceId: matchedInvoice.id } : { invoiceId: null };

      // STEP 5: Criar lançamento contábil
      const step5: ReconciliationStep = { name: 'create_accounting_entry', status: 'running' };
      result.steps.push(step5);

      // Buscar conta contábil do cliente
      const { data: clientAccount } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('id', tx.clients?.accounting_account_id)
        .single();

      if (!clientAccount) {
        step5.status = 'failed';
        step5.error = 'Cliente não possui conta contábil vinculada';
        result.finalStatus = 'needs_review';
        return result;
      }

      // Criar lançamento
      const entryResult = await accountingService.registrarRecebimento({
        paymentId: tx.id,
        invoiceId: matchedInvoice?.id || tx.id,
        clientId: tx.suggested_client_id,
        clientName: tx.clients?.name || 'Cliente',
        amount: Number(tx.amount),
        paymentDate: tx.transaction_date,
        bankAccountId: tx.bank_account_id,
        description: `Recebimento automático - ${tx.description}`
      });

      if (!entryResult.success) {
        step5.status = 'failed';
        step5.error = entryResult.error;
        result.finalStatus = 'failed';
        return result;
      }

      step5.status = 'completed';
      step5.result = { entryId: entryResult.entryId };
      result.accountingEntryId = entryResult.entryId;

      // STEP 6: Atualizar transação e fatura
      const step6: ReconciliationStep = { name: 'update_records', status: 'running' };
      result.steps.push(step6);

      // Atualizar transação
      await supabase
        .from('bank_transactions')
        .update({
          matched: true,
          journal_entry_id: entryResult.entryId,
          reconciled_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      // Atualizar fatura se encontrada
      if (matchedInvoice) {
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            paid_date: tx.transaction_date,
            paid_amount: tx.amount
          })
          .eq('id', matchedInvoice.id);
      }

      step6.status = 'completed';
      result.success = true;
      result.finalStatus = 'reconciled';

      // Registrar feedback positivo (para aprendizado)
      await supabase.rpc('fn_confirm_suggestion', {
        p_transaction_id: transactionId,
        p_user_id: null // Sistema
      });

    } catch (error: any) {
      result.steps.push({
        name: 'unexpected_error',
        status: 'failed',
        error: error.message
      });
    }

    return result;
  }

  /**
   * Processa todas as transações pendentes
   */
  static async processAllPending(tenantId: string): Promise<{
    processed: number;
    reconciled: number;
    needsReview: number;
    failed: number;
  }> {
    const stats = { processed: 0, reconciled: 0, needsReview: 0, failed: 0 };

    const { data: pendingTx } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('matched', false)
      .gt('amount', 0) // Apenas créditos
      .gte('identification_confidence', 70)
      .order('transaction_date', { ascending: true })
      .limit(100); // Processar em batches

    for (const tx of pendingTx || []) {
      const result = await this.process(tx.id);
      stats.processed++;

      switch (result.finalStatus) {
        case 'reconciled': stats.reconciled++; break;
        case 'needs_review': stats.needsReview++; break;
        case 'failed': stats.failed++; break;
      }
    }

    return stats;
  }
}
```

---

#### 3.2 Dashboard de Monitoramento
**Prioridade:** 🟠 Importante | **Esforço:** 4 dias

```typescript
// Arquivo: src/pages/AutomationDashboard.tsx

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  Brain,
  Zap
} from 'lucide-react';

interface DashboardStats {
  today: {
    totalTransactions: number;
    autoReconciled: number;
    needsReview: number;
    failed: number;
  };
  cashFlow: {
    currentBalance: number;
    projected7Days: number;
    pendingReceivables: number;
  };
  collection: {
    onTime: number;
    overdue1to30: number;
    overdue30plus: number;
  };
  aiPerformance: {
    identificationsToday: number;
    accuracy: number;
    patternsLearned: number;
  };
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    actionUrl: string;
  }>;
}

export default function AutomationDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy');

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Atualizar a cada minuto
    return () => clearInterval(interval);
  }, []);

  async function loadDashboardData() {
    setLoading(true);

    // Transações de hoje
    const today = new Date().toISOString().split('T')[0];

    const [
      { data: txToday },
      { data: cashFlowData },
      { data: collectionData },
      { data: aiData },
      { data: alertsData }
    ] = await Promise.all([
      supabase.rpc('get_daily_transaction_stats', { p_date: today }),
      supabase.rpc('get_cash_flow_summary'),
      supabase.rpc('get_collection_summary'),
      supabase.rpc('get_ai_performance_stats', { p_date: today }),
      supabase
        .from('system_alerts')
        .select('id, alert_type, severity, title, action_url')
        .eq('is_resolved', false)
        .order('severity', { ascending: false })
        .limit(10)
    ]);

    const newStats: DashboardStats = {
      today: txToday || { totalTransactions: 0, autoReconciled: 0, needsReview: 0, failed: 0 },
      cashFlow: cashFlowData || { currentBalance: 0, projected7Days: 0, pendingReceivables: 0 },
      collection: collectionData || { onTime: 0, overdue1to30: 0, overdue30plus: 0 },
      aiPerformance: aiData || { identificationsToday: 0, accuracy: 0, patternsLearned: 0 },
      alerts: alertsData || []
    };

    setStats(newStats);

    // Determinar saúde do sistema
    const criticalAlerts = newStats.alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = newStats.alerts.filter(a => a.severity === 'warning').length;

    if (criticalAlerts > 0 || newStats.today.failed > 5) {
      setSystemHealth('critical');
    } else if (warningAlerts > 3 || newStats.today.needsReview > 10) {
      setSystemHealth('warning');
    } else {
      setSystemHealth('healthy');
    }

    setLoading(false);
  }

  if (loading || !stats) {
    return <div className="p-8">Carregando dashboard...</div>;
  }

  const healthColor = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500'
  };

  const healthText = {
    healthy: 'Saudável',
    warning: 'Atenção',
    critical: 'Crítico'
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header com status do sistema */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Painel de Automação</h1>
        <Badge className={`${healthColor[systemHealth]} text-white px-4 py-2`}>
          {systemHealth === 'healthy' ? <CheckCircle className="w-4 h-4 mr-2" /> :
           systemHealth === 'warning' ? <AlertTriangle className="w-4 h-4 mr-2" /> :
           <XCircle className="w-4 h-4 mr-2" />}
          Sistema {healthText[systemHealth]}
        </Badge>
      </div>

      {/* Grid de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Transações Hoje */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Zap className="w-4 h-4 inline mr-2" />
              Transações Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.today.autoReconciled}/{stats.today.totalTransactions}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats.today.autoReconciled / stats.today.totalTransactions) * 100) || 0}% auto-conciliadas
            </p>
            {stats.today.needsReview > 0 && (
              <Badge variant="outline" className="mt-2">
                {stats.today.needsReview} aguardando revisão
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Fluxo de Caixa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Fluxo de Caixa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.cashFlow.currentBalance.toLocaleString('pt-BR')}
            </div>
            <p className={`text-xs ${stats.cashFlow.projected7Days < stats.cashFlow.currentBalance ? 'text-red-500' : 'text-green-500'}`}>
              Projeção 7d: R$ {stats.cashFlow.projected7Days.toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        {/* Cobrança */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Clock className="w-4 h-4 inline mr-2" />
              Cobrança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.collection.onTime}
            </div>
            <p className="text-xs text-muted-foreground">clientes em dia</p>
            <div className="flex gap-2 mt-2">
              {stats.collection.overdue1to30 > 0 && (
                <Badge variant="outline" className="bg-yellow-50">
                  {stats.collection.overdue1to30} (1-30d)
                </Badge>
              )}
              {stats.collection.overdue30plus > 0 && (
                <Badge variant="destructive">
                  {stats.collection.overdue30plus} (30+d)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* IA Performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Brain className="w-4 h-4 inline mr-2" />
              Dr. Cícero (IA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.aiPerformance.accuracy}%
            </div>
            <p className="text-xs text-muted-foreground">precisão hoje</p>
            <p className="text-xs text-muted-foreground">
              {stats.aiPerformance.identificationsToday} identificações |
              {stats.aiPerformance.patternsLearned} padrões
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas que precisam atenção */}
      {stats.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
              Atenção Necessária ({stats.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.alerts.map(alert => (
                <div key={alert.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    {alert.severity === 'critical' ?
                      <XCircle className="w-5 h-5 text-red-500" /> :
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    }
                    <span>{alert.title}</span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={alert.actionUrl}>Resolver</a>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={() => processAllPending()}>
            <Zap className="w-4 h-4 mr-2" />
            Processar Pendentes
          </Button>
          <Button variant="outline" asChild>
            <a href="/bank-reconciliation">Ver Transações</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/reports/reconciliation">Relatório Completo</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  async function processAllPending() {
    const { data: tenantId } = await supabase.rpc('get_my_tenant_id');
    const result = await AutoReconciliationPipeline.processAllPending(tenantId);
    alert(`Processado: ${result.processed}\nConciliados: ${result.reconciled}\nRevisão: ${result.needsReview}`);
    loadDashboardData();
  }
}
```

---

### Entregáveis Sprint 3

| Item | Arquivo | Status |
|------|---------|--------|
| Pipeline de conciliação | `AutoReconciliationPipeline.ts` | ⬜ |
| Dashboard de automação | `AutomationDashboard.tsx` | ⬜ |
| RPCs de estatísticas | `20260122200000_dashboard_rpcs.sql` | ⬜ |
| Testes de integração | `tests/automation/pipeline.test.ts` | ⬜ |
| Documentação | `docs/SPRINT3_RELEASE_NOTES.md` | ⬜ |

---

## Sprint 4: Otimização (Semanas 7-8)

### Objetivo
Fechamento automático, refinamentos e preparação para produção.

### Tarefas

#### 4.1 Fechamento Mensal Automático
```sql
-- Arquivo: supabase/migrations/20260122300000_auto_monthly_close.sql

-- Job para verificar e fechar mês automaticamente
SELECT cron.schedule(
  'auto_monthly_close',
  '0 5 5 * *', -- Dia 5 de cada mês, às 5h
  $$
    SELECT fn_auto_close_month();
  $$
);

CREATE OR REPLACE FUNCTION fn_auto_close_month()
RETURNS JSONB AS $$
DECLARE
  v_month TEXT;
  v_pending_count INTEGER;
  v_tenant RECORD;
  v_result JSONB := '[]'::JSONB;
BEGIN
  v_month := to_char(NOW() - INTERVAL '1 month', 'MM/YYYY');

  FOR v_tenant IN SELECT DISTINCT tenant_id FROM profiles WHERE tenant_id IS NOT NULL
  LOOP
    -- Verificar pendências
    SELECT COUNT(*) INTO v_pending_count
    FROM bank_transactions
    WHERE tenant_id = v_tenant.tenant_id
      AND matched = false
      AND amount > 0
      AND transaction_date >= date_trunc('month', NOW() - INTERVAL '1 month')
      AND transaction_date < date_trunc('month', NOW());

    IF v_pending_count > 0 THEN
      -- Criar alerta
      INSERT INTO system_alerts (
        alert_type, severity, title, description, tenant_id
      ) VALUES (
        'monthly_close_blocked',
        'warning',
        'Fechamento ' || v_month || ' bloqueado',
        v_pending_count || ' transações pendentes de conciliação',
        v_tenant.tenant_id
      );

      v_result := v_result || jsonb_build_object(
        'tenant_id', v_tenant.tenant_id,
        'status', 'blocked',
        'pending', v_pending_count
      );
    ELSE
      -- Executar fechamento
      PERFORM close_month(v_month, v_tenant.tenant_id);

      v_result := v_result || jsonb_build_object(
        'tenant_id', v_tenant.tenant_id,
        'status', 'closed',
        'month', v_month
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

#### 4.2 Agentes Autônomos v1
```typescript
// Arquivo: supabase/functions/agent-orchestrator/index.ts

interface AgentTask {
  agent: string;
  task: string;
  params?: Record<string, any>;
}

const DAILY_TASKS: AgentTask[] = [
  { agent: 'dr_cicero', task: 'classify_pending_transactions' },
  { agent: 'dr_cicero', task: 'validate_accounting_entries' },
  { agent: 'prof_milton', task: 'update_cash_flow_projections' },
  { agent: 'prof_milton', task: 'detect_anomalies' },
  { agent: 'dra_helena', task: 'process_collection_queue' },
  { agent: 'dra_helena', task: 'send_payment_reminders' },
];

serve(async (req) => {
  const results = [];

  for (const task of DAILY_TASKS) {
    try {
      const result = await executeAgentTask(task);
      results.push({ ...task, status: 'completed', result });
    } catch (error) {
      results.push({ ...task, status: 'failed', error: error.message });
    }
  }

  // Enviar relatório
  await sendDailyReport(results);

  return new Response(JSON.stringify({ success: true, results }));
});
```

---

### Entregáveis Sprint 4

| Item | Arquivo | Status |
|------|---------|--------|
| Fechamento automático | `20260122300000_auto_monthly_close.sql` | ⬜ |
| Orquestrador de agentes | `agent-orchestrator/index.ts` | ⬜ |
| Relatórios de automação | `AutomationReports.tsx` | ⬜ |
| Documentação final | `docs/AUTOMATION_USER_GUIDE.md` | ⬜ |
| Testes de carga | `tests/load/automation.test.ts` | ⬜ |

---

## Checklist de Validação

### Antes de Cada Sprint
- [ ] Backup do banco de dados
- [ ] Ambiente de staging atualizado
- [ ] Testes de regressão passando

### Após Cada Sprint
- [ ] Testes automatizados passando
- [ ] Documentação atualizada
- [ ] Demo para stakeholders
- [ ] Métricas de performance coletadas

### Critérios de Go-Live
- [ ] Taxa de conciliação automática >= 80%
- [ ] Zero erros críticos em 7 dias de staging
- [ ] Precisão do Dr. Cícero >= 90%
- [ ] Tempo de processamento < 5s por transação
- [ ] Documentação completa
- [ ] Treinamento da equipe realizado

---

## Métricas de Acompanhamento

| Métrica | Baseline | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
|---------|----------|----------|----------|----------|----------|
| % Auto-conciliação | 40% | 50% | 70% | 85% | 90%+ |
| Intervenções/dia | 50+ | 40 | 20 | 10 | 5 |
| Precisão IA | 70% | 75% | 85% | 92% | 95%+ |
| Tempo médio proc. | 5min | 2min | 30s | 10s | 5s |
| Alertas críticos | N/A | Tracking | < 5/dia | < 2/dia | < 1/dia |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Dados inconsistentes na migração | Média | Alto | Backup + rollback automatizado |
| Performance da IA em produção | Baixa | Médio | Cache + rate limiting |
| Resistência do usuário | Média | Médio | Treinamento + dashboard intuitivo |
| Integração Pluggy falhar | Baixa | Alto | Fallback para importação manual |

---

## Contatos e Responsabilidades

| Área | Responsável | Papel |
|------|-------------|-------|
| Backend/IA | TBD | Implementação core |
| Frontend | TBD | Dashboard e UX |
| QA | TBD | Testes e validação |
| DevOps | TBD | Deploy e monitoramento |
| Produto | TBD | Priorização e aceite |

---

*Plano de Ação criado em 21/01/2026*
*Última atualização: 21/01/2026*
*Versão: 1.0*
