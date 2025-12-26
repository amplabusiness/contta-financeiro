# Solução: Remover Despesa Órfã da DRE

## Problema Identificado
Uma despesa foi deletada do menu de **Despesas**, mas seus lançamentos contábeis permaneceram na DRE:
- **Código da Conta**: 4.1.2.13.02 - Dep. Contábil (Terceirizado)
- **Data**: 09/01/2025
- **Valor**: R$ 11.338,04
- **Descrição**: Despesa: Dep. Contábil - Ampla

## Causa Raiz
Quando uma despesa é deletada via menu **Expenses**, apenas o registro na tabela `expenses` é removido. Os lançamentos contábeis associados (`accounting_entries` e `accounting_entry_lines`) permanecem órfãos e continuam aparecendo na DRE.

## Solução Implementada

### 1️⃣ Código Corrigido (Expenses.tsx)
A função `handleDelete` foi atualizada para:
1. Encontrar todas as entradas contábeis vinculadas à despesa
2. Deletar os lançamentos contábeis (`accounting_entry_lines`)
3. Deletar as entradas contábeis (`accounting_entries`)
4. Por fim, deletar o registro da despesa

**Arquivo modificado**: `src/pages/Expenses.tsx` (função `handleDelete`)

**Benefício**: A partir de agora, quando uma despesa for deletada, seus lançamentos contábeis também serão removidos automaticamente.

### 2️⃣ Remover o Lançamento Órfão Existente

Execute os comandos SQL a seguir no **Supabase SQL Editor**:

#### Passo 1: Identificar o lançamento
```sql
SELECT 
  ae.id as entry_id,
  ae.entry_date,
  ae.description,
  ael.debit,
  ael.credit,
  coa.code,
  coa.name
FROM accounting_entries ae
JOIN accounting_entry_lines ael ON ae.id = ael.entry_id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE DATE(ae.entry_date) = '2025-01-09'
  AND ael.debit = 11338.04
  AND coa.code = '4.1.2.13.02'
  AND ae.reference_type = 'expense'
  AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = ae.reference_id);
```

#### Passo 2: Deletar o lançamento (após confirmar na Step 1)
```sql
-- Primeiro, delete as linhas contábeis
DELETE FROM accounting_entry_lines 
WHERE entry_id IN (
  SELECT ae.id FROM accounting_entries ae
  WHERE DATE(ae.entry_date) = '2025-01-09'
    AND ae.reference_type = 'expense'
    AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = ae.reference_id)
);

-- Depois, delete as entradas contábeis
DELETE FROM accounting_entries 
WHERE DATE(entry_date) = '2025-01-09'
  AND reference_type = 'expense'
  AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = reference_id);
```

## Verificação
Após executar os comandos acima:
1. Acesse a página **DRE**
2. Filtre para **Janeiro de 2025**
3. Verifique se a conta **4.1.2.13.02** não mais aparece ou se o valor desapareceu

## Arquivos de Referência
- `src/pages/Expenses.tsx` - Código corrigido
- `remove_orphan_dep_contabil.sql` - Script SQL para remover o lançamento órfão
