# 🔧 CORREÇÃO DEFINITIVA DO SISTEMA CONTÁBIL

## Diagnóstico Realizado em 29/01/2026

### Problemas Identificados

| # | Problema | Evidência | Impacto |
|---|----------|-----------|---------|
| 1 | **cleanup_orphans automático** | `useAccountingHealth.ts` linha 98 | Deleta entries quando lines falham |
| 2 | **Schema drift** | `entry_lines` (1270) vs `entry_items` (1598) | Código confuso sobre qual tabela usar |
| 3 | **539 entries órfãos** | Diagnóstico SQL | Perda de dados a cada startup |
| 4 | **225 entries sem internal_code** | Diagnóstico SQL | Sem rastreabilidade |
| 5 | **183 tx reconciliadas** | Mas só 25 têm `journal_entry_id` | Inconsistência |

### Causa Raiz

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│  Frontend cria  │────►│ Lines falham      │────►│ Entry fica      │
│  Entry          │     │ (RLS/Schema/etc)  │     │ órfão           │
└─────────────────┘     └───────────────────┘     └────────┬────────┘
                                                           │
                        ┌───────────────────┐              │
                        │ cleanup_orphans   │◄─────────────┘
                        │ DELETA tudo       │
                        └───────────────────┘
```

---

## Solução Implementada

### 1. Desabilitar cleanup_orphans Automático

**Arquivo:** `src/hooks/useAccountingHealth.ts`

A função `cleanupOrphans()` foi **comentada** para não executar mais automaticamente.

```typescript
async function cleanupOrphans() {
  // DESABILITADO POR DR. CÍCERO - 29/01/2026
  console.log('[AccountingHealth] cleanup_orphans DESABILITADO');
  return;
  // ... código original comentado
}
```

### 2. Criar RPC Transacional

**Arquivo:** `supabase/migrations/20260129_fix_accounting_system_dr_cicero.sql`

Nova função `rpc_create_accounting_entry()` que:
- ✅ Valida internal_code único
- ✅ Valida partidas dobradas (∑D = ∑C)
- ✅ Valida mínimo 2 linhas
- ✅ Grava entry + lines em TRANSAÇÃO ÚNICA
- ✅ Rollback automático em caso de erro

```sql
SELECT rpc_create_accounting_entry(
    'tenant-id',
    '2025-01-29',
    'Descrição',
    'CODIGO_UNICO',
    'manual',
    'MOVIMENTO',
    NULL, NULL,
    '[{"account_id":"uuid","debit":100,"credit":0},{"account_id":"uuid","debit":0,"credit":100}]'::jsonb
);
```

### 3. Criar RPC de Classificação Bancária

Nova função `rpc_classify_bank_transaction()` que:
- Cria lançamento de IMPORTAÇÃO (banco ↔ transitória)
- Cria lançamento de CLASSIFICAÇÃO (transitória ↔ conta destino)
- Atualiza `bank_transactions.is_reconciled`
- Tudo em TRANSAÇÃO ÚNICA

### 4. Serviço TypeScript do Dr. Cícero

**Arquivo:** `src/services/DrCiceroService.ts`

```typescript
import { DrCiceroService } from '@/services/DrCiceroService';

// Criar lançamento com validação
const result = await DrCiceroService.createEntry({
    entry_date: '2025-01-29',
    description: 'Pagamento fornecedor',
    internal_code: 'MANUAL_123456_abc123',
    source_type: 'manual',
    lines: [
        { account_id: 'uuid-despesa', debit: 1000, credit: 0 },
        { account_id: 'uuid-banco', debit: 0, credit: 1000 }
    ]
});

// Classificar transação bancária
const classResult = await DrCiceroService.classifyBankTransaction({
    bank_transaction_id: 'uuid-da-transacao',
    destination_account_id: 'uuid-conta-destino',
    description: 'Pagamento de honorários - Cliente X'
});
```

### 5. View de Monitoramento das Transitórias

```sql
SELECT * FROM vw_transitory_balances;

-- Resultado esperado (sistema saudável):
-- code      | name                | balance | status
-- 1.1.9.01  | Transitória Débitos | 0.00    | ✅ ZERADA
-- 2.1.9.01  | Transitória Créditos| 0.00    | ✅ ZERADA
```

### 6. Trigger de Validação Obrigatória

```sql
CREATE TRIGGER trg_validate_accounting_entry
    BEFORE INSERT OR UPDATE ON accounting_entries
    FOR EACH ROW
    EXECUTE FUNCTION fn_validate_accounting_entry();
```

Valida:
- `internal_code` obrigatório
- `source_type` obrigatório

---

## Como Aplicar

### Passo 1: Executar Migração SQL

```bash
# No Supabase Dashboard > SQL Editor:
# Cole e execute o conteúdo de:
supabase/migrations/20260129_fix_accounting_system_dr_cicero.sql
```

### Passo 2: Deploy do Frontend

```bash
npm run build
# Deploy para produção
```

### Passo 3: Verificar Integridade

```sql
SELECT rpc_check_accounting_integrity('a53a4957-fe97-4856-b3ca-70045157b421');
```

---

## Arquivos Modificados/Criados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useAccountingHealth.ts` | MODIFICADO | Desabilitado cleanup_orphans |
| `src/services/DrCiceroService.ts` | CRIADO | Serviço gatekeeper |
| `supabase/migrations/20260129_fix_accounting_system_dr_cicero.sql` | CRIADO | RPCs + triggers |
| `diagnose_accounting_schema.mjs` | CRIADO | Script de diagnóstico |
| `CORRECAO_SISTEMA_CONTABIL.md` | CRIADO | Esta documentação |

---

## Regra de Ouro

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   TODA operação contábil DEVE passar pelo DrCiceroService         ║
║                                                                    ║
║   NUNCA inserir diretamente em accounting_entries                 ║
║   NUNCA inserir diretamente em accounting_entry_lines             ║
║                                                                    ║
║   SEMPRE usar:                                                    ║
║   - DrCiceroService.createEntry()                                 ║
║   - DrCiceroService.classifyBankTransaction()                     ║
║   - rpc_create_accounting_entry()                                 ║
║   - rpc_classify_bank_transaction()                               ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## Próximos Passos Recomendados

1. **Limpar dados inconsistentes** - Depois de aplicar a migração, executar limpeza manual dos 539 órfãos existentes

2. **Unificar tabelas** - Decidir entre `entry_lines` e `entry_items` e depreciar a outra

3. **Corrigir Janeiro/2025** - Reprocessar as 183 transações usando o novo fluxo

4. **Multi-tenant completo** - Aplicar RLS em todas as tabelas

5. **Data Lake / RAG** - Implementar para cobrança e sugestão de classificação

---

**Autor:** Dr. Cícero - Contador Responsável  
**Data:** 29/01/2026  
**Versão:** 1.0
