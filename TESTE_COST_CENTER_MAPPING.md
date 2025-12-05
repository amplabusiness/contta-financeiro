# 🧪 Teste: Workflow Centro de Custo ↔ Plano de Contas

**Objetivo:** Validar que despesas fluem corretamente de frontend → banco → lançamentos contábeis

**Pré-requisitos:**
- ✅ Migrations `20251204000000` e `20251204010000` aplicadas
- ✅ Script `map_expenses_to_cost_centers.py --apply` executado
- ✅ Aplicação frontend rodando

---

## 📋 Caso de Teste 1: Criar Despesa do Sérgio com Mapeamento Automático

### Passos:

1. **Abrir página Despesas**
   - URL: `/expenses`
   - Clicar em "Novo"

2. **Preencher formulário:**
   - **Descrição:** "IPTU Condomínio Marista"
   - **Valor:** 850.00
   - **Vencimento:** 15/01/2025
   - **Status:** Pendente
   - **Centro de Custo:** "SERGIO.IMOVEIS - Imóveis"
   - **Plano de Contas:** (deixar vazio - deve mapear automaticamente)

3. **Submeter formulário**
   - Clicar "Salvar"

### Validações esperadas:

**Frontend:**
- ✅ Formulário aceita submissão
- ✅ Mensagem: "Despesa cadastrada com lançamento contábil!"

**Banco de dados (validar no Supabase Dashboard → SQL Editor):**

```sql
-- 1. Despesa foi criada com cost_center_id e account_id
SELECT id, description, cost_center_id, account_id, amount, competence
FROM expenses
WHERE description LIKE '%IPTU%Marista%'
ORDER BY created_at DESC
LIMIT 1;

-- Resultado esperado:
-- id: [UUID]
-- description: "IPTU Condomínio Marista"
-- cost_center_id: [UUID do SERGIO.IMOVEIS]
-- account_id: [UUID do 1.1.3.04.01]
-- amount: 850.00
-- competence: "01/2025"

-- 2. Verificar lançamento contábil
SELECT ae.id, ae.reference_id, ae.reference_type, ae.entry_date
FROM accounting_entries ae
WHERE ae.reference_id IN (
  SELECT id FROM expenses WHERE description LIKE '%IPTU%Marista%'
)
ORDER BY ae.created_at DESC
LIMIT 1;

-- 3. Verificar linhas do lançamento
SELECT ael.entry_id, ael.account_id, coa.code, coa.name, ael.debit, ael.credit
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE ael.entry_id = [ID do passo 2]
ORDER BY ael.debit DESC;

-- Resultado esperado (duas linhas):
-- D: 1.1.3.04.01 - Adiantamentos - Sergio Carneiro Leão, debit: 850.00
-- C: 1.1.1.02 - Banco (ou conta apropriada), credit: 850.00
```

---

## 📋 Caso de Teste 2: Criar Despesa com Todas as Informações Preenchidas

### Passos:

1. **Abrir Despesas → Novo**

2. **Preencher:**
   - **Descrição:** "Plano de Saúde Anuidade"
   - **Valor:** 1200.00
   - **Vencimento:** 20/01/2025
   - **Centro de Custo:** "SERGIO.PESSOAL - Despesas Pessoais"
   - **Plano de Contas:** "1.1.3.04.01 - Adiantamentos - Sergio Carneiro Leão"

3. **Salvar**

### Validações:

```sql
-- Despesa com account_id manualmente preenchido
SELECT id, description, account_id, cost_center_id, amount
FROM expenses
WHERE description LIKE '%Plano de Saúde%'
ORDER BY created_at DESC LIMIT 1;

-- Validar que lançamento foi criado
SELECT * FROM vw_expenses_with_accounts
WHERE id = [UUID da despesa acima];
```

---

## 📋 Caso de Teste 3: Tentar Salvar sem Centro de Custo (deve falhar)

### Passos:

1. **Abrir Despesas → Novo**

2. **Preencher:**
   - Descrição: "Teste Validação"
   - Valor: 100.00
   - Vencimento: 01/01/2025
   - Centro de Custo: (deixar em branco)

3. **Salvar**

### Validações esperadas:

- ✅ Mensagem de erro: "Centro de custo é obrigatório"
- ✅ Formulário não é submetido
- ✅ Nenhum registro criado no banco

---

## 📋 Caso de Teste 4: Visualizar CostCenterAnalysis

### Passos:

1. **Abrir URL:** `/cost-center-analysis`

2. **Validar dados:**
   - Gráfico de pizza exibe centros de custo com código e nome
   - Ex: "SERGIO.IMOVEIS - Imóveis"
   - Valores correspondem à soma de despesas por centro

### Validação no SQL:

```sql
-- Comparar dados da view com dashboard
SELECT 
  cc.code,
  cc.name,
  SUM(e.amount) as total
FROM expenses e
JOIN cost_centers cc ON e.cost_center_id = cc.id
WHERE e.status = 'paid'
GROUP BY cc.code, cc.name
ORDER BY total DESC;

-- Valores devem corresponder ao dashboard
```

---

## 📋 Caso de Teste 5: Rastreabilidade Completa (Despesa → Lançamento → Balancete)

### Passos:

1. **Criar despesa:**
   - Descrição: "Casa Lago Brisas - Condomínio"
   - Valor: 2500.00
   - Centro: "SERGIO.CASA_CAMPO - Casa de Campo"
   - Vencimento: 10/01/2025

2. **Abrir Livro Diário**
   - Procurar lançamento da despesa
   - Validar que mostra:
     - D: 1.1.3.04.01 / C: 1.1.1.02

3. **Abrir Balancete**
   - Procurar conta 1.1.3.04.01
   - Saldo deve incluir 2500.00

4. **Abrir vw_sergio_advances_balance**
   ```sql
   SELECT * FROM vw_sergio_advances_balance
   WHERE cost_center_code = 'SERGIO.CASA_CAMPO';
   ```
   - Resultado esperado: linha com saldo = 2500.00

---

## 📋 Caso de Teste 6: Editar Despesa Existente

### Passos:

1. **Abrir Despesas**

2. **Clicar lápis em qualquer despesa**

3. **Modificar:**
   - Descrição: "[original] - EDITADO"
   - Centro de Custo: mudar para outro
   - Plano de Contas: validar que carregou o anterior

4. **Salvar**

### Validações:

- ✅ Campo `cost_center_id` carregou corretamente
- ✅ Campo `account_id` carregou corretamente
- ✅ Alterações refletem no banco

---

## 📋 Caso de Teste 7: Mapear Despesas Históricas

### Passos (após aplicar migrations):

1. **Executar script em dry-run:**
   ```bash
   python scripts/map_expenses_to_cost_centers.py --dry-run
   ```

2. **Revisar sugestões:**
   - Despesas com palavras-chave "LAGO BRISAS" → SERGIO.CASA_CAMPO?
   - Despesas com "BMW" → SERGIO.VEICULOS?
   - Despesas com "ESCOLA" ou "BABA" → SERGIO.FILHOS.NAYARA?

3. **Se satisfeito, aplicar:**
   ```bash
   python scripts/map_expenses_to_cost_centers.py --apply
   ```

4. **Validar no banco:**
   ```sql
   SELECT COUNT(*) as total_mapeadas
   FROM expenses
   WHERE cost_center_id IS NOT NULL;
   
   SELECT COUNT(*) as total_sem_mapear
   FROM expenses
   WHERE cost_center_id IS NULL;
   ```

---

## 📊 Relatório de Teste

### Checklist Final:

- [ ] **Teste 1:** Criar com mapeamento automático ✓
- [ ] **Teste 2:** Criar com dados completos ✓
- [ ] **Teste 3:** Validação de obrigatoriedade ✓
- [ ] **Teste 4:** Dashboard CostCenterAnalysis ✓
- [ ] **Teste 5:** Rastreabilidade Despesa→Contábil ✓
- [ ] **Teste 6:** Edição mantém referências ✓
- [ ] **Teste 7:** Mapeamento histórico ✓

### Status Geral:

**Workflow validado:** ☐ SIM ☐ NÃO

**Problemas encontrados:**
```
(listar aqui)
```

**Data do teste:** ___/___/_____  
**Responsável:** ________________  
**Assinatura:** ________________

---

## 🔧 Troubleshooting Durante Testes

### Erro: "Centro de Custo é obrigatório"
Mas eu preenchimento o campo!

**Solução:**
1. Verificar se campo está realmente preenchido (não vazio)
2. Abrir DevTools → Console (F12)
3. Procurar por mensagens de erro
4. Verificar se `formData.cost_center_id` tem valor

---

### Lançamento contábil não foi criado

**Solução:**
1. Verificar `accounting_entries` no banco:
   ```sql
   SELECT * FROM accounting_entries
   WHERE reference_id = [UUID da despesa]
   LIMIT 1;
   ```
2. Se vazio, verificar se `registrarDespesa` foi chamado
3. Procurar logs em Supabase → Logs → Edge Functions

---

### CostCenterAnalysis mostra "Não Classificado"

**Solução:**
1. Verificar se view `vw_expenses_with_accounts` existe:
   ```sql
   SELECT * FROM vw_expenses_with_accounts LIMIT 1;
   ```
2. Se erro, migrations não foram aplicadas
3. Se vazio, despesas não têm `cost_center_id`

---

## 📞 Próximos Passos Após Validação

✅ Após todos os testes passarem:

1. Marcar migrations como "testadas em produção"
2. Documentar em VERIFICACAO_IMPLEMENTACAO.md
3. Preparar treinamento para usuários
4. Planejar limpeza de coluna `cost_center` antiga (migration de cleanup)

---

**Guia de teste:** Centro de Custo ↔ Plano de Contas  
**Versão:** 1.0  
**Última atualização:** 04/12/2025
