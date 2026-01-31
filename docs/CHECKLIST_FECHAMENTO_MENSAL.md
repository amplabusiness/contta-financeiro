# 📋 CHECKLIST DE FECHAMENTO MENSAL — DR. CÍCERO

**Sistema:** Contta Financeiro — Ampla Contabilidade  
**Versão:** 1.0  
**Data:** 31/01/2026

---

## 🎯 Objetivo

Este checklist padroniza o processo de fechamento mensal, garantindo:
- Integridade contábil
- Rastreabilidade
- Governança
- Compliance

---

## ✅ CHECKLIST PRÉ-FECHAMENTO

### 1. Importação de Dados

| # | Verificação | Critério | Status |
|---|-------------|----------|--------|
| 1.1 | Extratos OFX importados | Todos os bancos do período | ☐ |
| 1.2 | Notas fiscais importadas | XMLs de entrada e saída | ☐ |
| 1.3 | Honorários cadastrados | Por competência, não por recebimento | ☐ |
| 1.4 | Despesas lançadas | Todas as despesas do período | ☐ |

### 2. Conciliação Bancária

| # | Verificação | Critério | Status |
|---|-------------|----------|--------|
| 2.1 | Transações sem lançamento | = 0 | ☐ |
| 2.2 | Saldo contábil = Saldo extrato | Para cada banco | ☐ |
| 2.3 | Classificação de PIX | Não é receita (transitória ou baixa) | ☐ |
| 2.4 | Transferências entre contas | Não afetam resultado | ☐ |

### 3. Integridade Contábil

| # | Verificação | Critério | Status |
|---|-------------|----------|--------|
| 3.1 | Partidas Dobradas | ∑ Débitos = ∑ Créditos | ☐ |
| 3.2 | Lançamentos desbalanceados | = 0 | ☐ |
| 3.3 | Lançamentos sem internal_code | = 0 | ☐ |
| 3.4 | Lançamentos sem source_type | = 0 | ☐ |

### 4. Contas Transitórias

| # | Verificação | Critério | Status |
|---|-------------|----------|--------|
| 4.1 | 1.1.9.01 Transitória Débitos | Saldo justificado ou zero | ☐ |
| 4.2 | 2.1.9.01 Transitória Créditos | Saldo justificado ou zero | ☐ |
| 4.3 | Pendências identificadas | Lista de itens a classificar | ☐ |

### 5. DRE (Demonstração do Resultado)

| # | Verificação | Critério | Status |
|---|-------------|----------|--------|
| 5.1 | Receitas de honorários | Por competência | ☐ |
| 5.2 | PIX como receita | = 0 (não deve aparecer) | ☐ |
| 5.3 | Despesas classificadas | Todas com conta de resultado | ☐ |
| 5.4 | Resultado do período | Coerente com expectativa | ☐ |

### 6. Balanço Patrimonial

| # | Verificação | Critério | Status |
|---|-------------|----------|--------|
| 6.1 | Ativo = Passivo + PL | Equação fundamental | ☐ |
| 6.2 | Saldo de bancos | Conferido com extratos | ☐ |
| 6.3 | Clientes a receber | Conferido com contratos | ☐ |
| 6.4 | Fornecedores a pagar | Conferido com notas | ☐ |

---

## 🔧 QUERY DE VERIFICAÇÃO AUTOMÁTICA

Execute no Supabase Dashboard para validar automaticamente:

```sql
-- ============================================================================
-- VERIFICAÇÃO AUTOMÁTICA DE FECHAMENTO — DR. CÍCERO
-- ============================================================================

WITH params AS (
    SELECT 
        'a53a4957-fe97-4856-b3ca-70045157b421'::UUID as tenant_id,
        '2025-01-01'::DATE as data_inicio,
        '2025-01-31'::DATE as data_fim
),

-- 1. Transações sem lançamento
transacoes_orfas AS (
    SELECT COUNT(*) as qtd
    FROM bank_transactions bt, params p
    WHERE bt.tenant_id = p.tenant_id
      AND bt.transaction_date BETWEEN p.data_inicio AND p.data_fim
      AND bt.journal_entry_id IS NULL
),

-- 2. Partidas dobradas
partidas_dobradas AS (
    SELECT 
        COALESCE(SUM(l.debit), 0) as total_d,
        COALESCE(SUM(l.credit), 0) as total_c
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    JOIN params p ON e.tenant_id = p.tenant_id
    WHERE e.entry_date BETWEEN p.data_inicio AND p.data_fim
),

-- 3. Lançamentos desbalanceados
desbalanceados AS (
    SELECT COUNT(*) as qtd
    FROM accounting_entries e
    JOIN params p ON e.tenant_id = p.tenant_id
    WHERE e.entry_date BETWEEN p.data_inicio AND p.data_fim
      AND EXISTS (
          SELECT 1 FROM accounting_entry_lines l
          WHERE l.entry_id = e.id
          GROUP BY l.entry_id
          HAVING ABS(SUM(COALESCE(l.debit, 0)) - SUM(COALESCE(l.credit, 0))) > 0.01
      )
),

-- 4. Saldo transitórias
transitoria_debitos AS (
    SELECT COALESCE(SUM(l.debit) - SUM(l.credit), 0) as saldo
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    JOIN params p ON e.tenant_id = p.tenant_id
    WHERE l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
      AND e.entry_date BETWEEN p.data_inicio AND p.data_fim
),

transitoria_creditos AS (
    SELECT COALESCE(SUM(l.credit) - SUM(l.debit), 0) as saldo
    FROM accounting_entry_lines l
    JOIN accounting_entries e ON e.id = l.entry_id
    JOIN params p ON e.tenant_id = p.tenant_id
    WHERE l.account_id = '28085461-9e5a-4fb4-847d-c9fc047fe0a1'
      AND e.entry_date BETWEEN p.data_inicio AND p.data_fim
)

SELECT 
    '1. Transações órfãs' as verificacao,
    t.qtd::TEXT as valor,
    CASE WHEN t.qtd = 0 THEN '✅' ELSE '❌' END as status
FROM transacoes_orfas t

UNION ALL

SELECT 
    '2. Partidas Dobradas (Diferença)',
    TO_CHAR(ABS(pd.total_d - pd.total_c), 'FM999G999G999D00'),
    CASE WHEN ABS(pd.total_d - pd.total_c) < 0.01 THEN '✅' ELSE '❌' END
FROM partidas_dobradas pd

UNION ALL

SELECT 
    '3. Lançamentos desbalanceados',
    d.qtd::TEXT,
    CASE WHEN d.qtd = 0 THEN '✅' ELSE '❌' END
FROM desbalanceados d

UNION ALL

SELECT 
    '4. Transitória Débitos (1.1.9.01)',
    TO_CHAR(td.saldo, 'FM999G999G999D00'),
    CASE WHEN ABS(td.saldo) < 0.01 THEN '✅' ELSE '⚠️ Pendente' END
FROM transitoria_debitos td

UNION ALL

SELECT 
    '5. Transitória Créditos (2.1.9.01)',
    TO_CHAR(tc.saldo, 'FM999G999G999D00'),
    CASE WHEN ABS(tc.saldo) < 0.01 THEN '✅' ELSE '⚠️ Pendente' END
FROM transitoria_creditos tc;
```

---

## 📝 REGISTRO DE FECHAMENTO

| Campo | Valor |
|-------|-------|
| **Período** | ____/20__ |
| **Data do Fechamento** | __/__/____ |
| **Responsável** | Dr. Cícero |
| **Protocolo** | AUD-____-________ |

### Observações:
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Assinatura:
```
_________________________________________________________________
Dr. Cícero — Contador Responsável
```

---

## 🔒 PÓS-FECHAMENTO

Após aprovação do checklist:

1. **Bloquear período** — Impedir novos lançamentos
2. **Arquivar parecer** — Salvar documentação
3. **Comunicar stakeholders** — Informar resultado
4. **Iniciar próximo período** — Abrir novo mês

---

*Checklist padrão do Contta Financeiro*  
*Ampla Contabilidade — CRC-GO*
