# 🎯 Implementação: Mapeamento Centro de Custo ↔ Plano de Contas

**Data:** 04/12/2025  
**Status:** ✅ Implementação completa - Aguardando aplicação de migrations  
**Responsável:** Sérgio Carneiro Leão

---

## 📋 Resumo das Mudanças

Este documento detalha todas as mudanças implementadas para vincular centros de custo do Sérgio (incluindo Filhos e Casa de Campo) ao plano de contas obrigatoriamente.

### Filosofia da solução

1. **Todas as operações dependem do plano de contas** - Nenhuma despesa ou transação pode ser registrada sem:
   - `cost_center_id` (referência ao centro de custo)
   - `account_id` (referência à conta no plano de contas)

2. **Mapeamento automático quando possível** - O sistema tenta deduzir a conta correta baseado na descrição e centro de custo

3. **Rastreabilidade completa** - Cada centro de custo carrega sua conta padrão, facilitando auditoria

4. **Estrutura hierárquica clara** - SERGIO → FILHOS (Nayara, Victor, S.Augusto) + CASA_CAMPO + demais categorias

---

## 🗄️ Migrations Criadas

### 1. `20251204000000_cost_center_chart_account_mapping.sql`

**Responsabilidade:** Vincular centros de custo ao plano de contas

**Mudanças:**
- ✅ Adiciona coluna `default_chart_account_id` (UUID FK) à tabela `cost_centers`
- ✅ Cria novos centros: `SERGIO.FILHOS`, `SERGIO.FILHOS.NAYARA`, `SERGIO.FILHOS.VICTOR`, `SERGIO.FILHOS.SERGIO_AUGUSTO`
- ✅ Cria novo centro: `SERGIO.CASA_CAMPO` (Lago das Brisas)
- ✅ Atualiza todos os centros `SERGIO*` com `default_chart_account_id = 1.1.3.04.01` (Adiantamentos - Sergio)
- ✅ Cria view `vw_expenses_with_accounts` - despesas com centro + conta contábil lado a lado
- ✅ Cria view `vw_sergio_advances_balance` - saldo de adiantamentos por centro para reconciliação
- ✅ Adiciona índices para performance

**Impacto:** Base de dados

---

### 2. `20251204010000_migrate_cost_center_to_uuid.sql`

**Responsabilidade:** Converter coluna `cost_center` (texto) → `cost_center_id` (UUID FK)

**Mudanças:**
- ✅ Cria coluna nova `cost_center_id` (UUID FK para `cost_centers`)
- ✅ Migra dados históricos: valores textuais → IDs dos centros correspondentes
- ✅ Torna `cost_center_id` NOT NULL (garantindo preenchimento obrigatório)
- ✅ Mapeia despesas do Sérgio para a conta `1.1.3.04.01`
- ✅ Deixa coluna antiga `cost_center` para referência histórica (pode ser removida depois)

**Impacto:** Estrutura de dados da tabela `expenses`

---

## 💻 Mudanças de Frontend

### Arquivo: `src/pages/Expenses.tsx`

**Mudanças:**

1. **Estado:**
   - Adiciona `costCenters` (array carregado do banco)
   - Muda `formData.cost_center` → `formData.cost_center_id` (UUID)

2. **Carregamento de dados:**
   - Adiciona função `loadCostCenters()` - busca centros do banco em tempo real
   - Chama função no `useEffect` de inicialização

3. **Validação:**
   - Torna `cost_center_id` obrigatório em `handleSubmit`
   - Se `account_id` não está preenchido, tenta mapear automaticamente via `CostCenterMappingService`
   - Bloqueia salvamento sem ambas as informações

4. **Formulário:**
   - Substitui `Input` estático por `Select` dinamicamente preenchido
   - Exibe `{code} - {name}` para cada centro (ex: "SERGIO - Sergio Carneiro Leão")
   - Marca campo como obrigatório (*)

5. **Edição:**
   - Atualiza `handleEdit` para usar `cost_center_id` em vez de `cost_center`
   - Atualiza geração automática de despesas recorrentes para preservar `cost_center_id`

---

### Arquivo: `src/services/CostCenterMappingService.ts` (NOVO)

**Responsabilidade:** Lógica centralizada de mapeamento centro de custo → conta contábil

**Principais métodos:**

```typescript
// Mapear uma descrição para o centro de custo apropriado
mapDescriptionToCostCenter(description: string): { code: string; found: boolean }

// Mapear despesa completa: descrição → centro → conta
async mapExpenseToAccounting(description: string, costCenterCode?: string): Promise<CostCenterMapping>

// Validar se expense tem campos obrigatórios
validateExpense(expense: any): { valid: boolean; errors: string[] }

// Obter saldo de adiantamentos do Sérgio por centro
async getSergiAdvancesBalance(): Promise<...>
```

**Integração:**
- Usado em `Expenses.tsx` para auto-completar `account_id`
- Usado em Edge Functions para processamento de bank transactions
- Pode ser estendido para usar em importadores de arquivo

---

### Arquivo: `src/pages/CostCenterAnalysis.tsx`

**Mudanças:**

1. **Queries:**
   - Muda de `expenses` → `vw_expenses_with_accounts` (view com joins)
   - Agora obtém `cost_center_code`, `cost_center_name`, `account_code` lado a lado

2. **Agrupamento:**
   - Agrupa por `{code} - {name}` em vez de apenas texto vago
   - Inclui código da conta para auditoria

3. **Relatórios:**
   - Dashboard agora mostra plano de contas junto com centro de custo
   - Comparação mensal usa código + nome para clareza

---

## 📊 Scripts Python (Dados históricos)

### `scripts/map_expenses_to_cost_centers.py`

**Uso:**

```bash
# Modo simulação (sem alterar banco)
python scripts/map_expenses_to_cost_centers.py --dry-run

# Modo aplicação (altera banco de dados)
python scripts/map_expenses_to_cost_centers.py --apply
```

**Funcionalidade:**
- Lê todas as despesas sem `cost_center_id` preenchido
- Mapeia baseado em palavras-chave (ex: "LAGO BRISAS" → SERGIO.CASA_CAMPO)
- Exibe resumo de mapeamentos antes de aplicar
- Permite validar antes de commits ao banco

---

## 🚀 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Aplicar Migrations (⏳ PENDENTE)

- [ ] **Conectar ao Supabase Dashboard**
  - URL: https://supabase.com
  - Projeto ID: xdtlhzysrpoinqtsglmr

- [ ] **Executar primeira migration**
  ```bash
  # Via Supabase CLI (se instalado)
  supabase migration up 20251204000000_cost_center_chart_account_mapping.sql

  # Ou: Copiar e colar SQL diretamente em Supabase Dashboard → SQL Editor
  ```

- [ ] **Executar segunda migration**
  ```bash
  supabase migration up 20251204010000_migrate_cost_center_to_uuid.sql
  ```

- [ ] **Validar estrutura:**
  ```sql
  -- No Supabase Dashboard → SQL Editor:
  SELECT * FROM cost_centers WHERE code LIKE 'SERGIO%' ORDER BY code;
  SELECT COUNT(*) FROM expenses WHERE cost_center_id IS NULL;
  ```

---

### Fase 2: Validar Dados Históricos

- [ ] **Executar script de mapeamento (dry-run)**
  ```bash
  python scripts/map_expenses_to_cost_centers.py --dry-run
  ```

- [ ] **Revisar mapeamentos sugeridos**
  - Procurar por qualquer despesa que foi atribuída a "SERGIO" em vez de subcategoria específica
  - Ajustar palavras-chave no `CostCenterMappingService` se necessário

- [ ] **Aplicar mapeamento**
  ```bash
  python scripts/map_expenses_to_cost_centers.py --apply
  ```

- [ ] **Validar resultado:**
  ```sql
  -- Contar despesas com cost_center_id preenchido
  SELECT cost_center_id, COUNT(*) as total
  FROM expenses
  GROUP BY cost_center_id
  ORDER BY total DESC;
  ```

---

### Fase 3: Testar Frontend

- [ ] **Abrir página Despesas**
  - Clicar em "Nova Despesa"
  - Verificar se campo "Centro de Custo" carrega dinamicamente
  - Tentar salvar sem preencher → deve dar erro

- [ ] **Testar mapeamento automático**
  - Preencher descrição: "IPTU Marista Condomínio"
  - Deixar centro de custo vazio
  - Salvar → deve mapear para SERGIO.IMOVEIS e conta 1.1.3.04.01

- [ ] **Editar despesa existente**
  - Clicar em lápis em qualquer despesa
  - Verificar se `cost_center_id` carrega corretamente no Select

- [ ] **Visualizar CostCenterAnalysis**
  - Dados devem exibir "CODIGO - Nome do Centro"
  - Gráficos mostram saldo por centro de custo

---

### Fase 4: Validar Contabilidade

- [ ] **Abrir Livro Diário**
  - Procurar despesas do Sérgio
  - Verificar que tem partidas:
    - D: 1.1.3.04.01 (Adiantamentos - Sergio)
    - C: 1.1.1.02 (Banco)

- [ ] **Abrir DRE**
  - Procurar despesas por centro de custo
  - Validar que totalizações estão corretas

- [ ] **Abrir Balancete**
  - Procurar conta 1.1.3.04.01
  - Saldo deve corresponder ao total de adiantamentos registrados

---

## 📈 Mapping de Palavras-chave

Para referência (definido em `CostCenterMappingService`):

| Centro | Palavras-chave |
| --- | --- |
| SERGIO | PIX SERGIO, PAGAMENTO SERGIO, CARNEIRO LEAO |
| SERGIO.FILHOS.NAYARA | BABA, ESCOLA, NAYARA, CRECHE, INFANTIL |
| SERGIO.FILHOS.VICTOR | VICTOR, LEGALIZACAO, VICTOR HUGO DE OLIVEIRA |
| SERGIO.FILHOS.SERGIO_AUGUSTO | CLINICA AMPLA, MEDICINA, SERGIO AUGUSTO |
| SERGIO.CASA_CAMPO | LAGO BRISAS, BURITI ALEGRE, CONDOMINIO LAGO |
| SERGIO.IMOVEIS | IPTU, CONDOMINIO, MARISTA, APTO, SALA, 301, 302, 303, VILA ABAJA |
| SERGIO.VEICULOS | IPVA, BMW, MOTO, BIZ, CG, CARRETINHA, DETRAN, COMBUSTIVEL, MECANICO |
| SERGIO.PESSOAL | PLANO SAUDE, PERSONAL, CRC, ANUIDADE, MEDICO, DENTISTA |
| SERGIO.TELEFONE | CLARO, VIVO, TIM, TELEFONE, PLANO |

---

## 🔐 Segurança & Conformidade

✅ **Constraints de Integridade:**
- `cost_center_id` NOT NULL em `expenses` (banco força preenchimento)
- FK para `cost_centers` (impossível criar despesa com centro inválido)
- FK para `chart_of_accounts` (impossível criar lançamento com conta inválida)

✅ **Auditoria:**
- `vw_expenses_with_accounts` permite rastrear conta de cada despesa
- Histórico preservado (coluna `cost_center` antiga mantida)

✅ **Conformidade Contábil:**
- Todas as despesas agora mapeiam obrigatoriamente para o plano de contas
- Partidas dobradas garantidas (débito em 1.1.3.04.01 quando empresa paga)
- NBC/CFC conformes

---

## 🆘 Troubleshooting

### Erro: "Centro de custo é obrigatório"
- **Causa:** Tentou salvar despesa sem selecionar centro
- **Solução:** Selecionar um centro na dropdown

### Erro: "Conta contábil é obrigatória"
- **Causa:** Sistema não conseguiu mapear automaticamente
- **Solução:** 
  1. Verificar descrição da despesa (tem palavras-chave?)
  2. Selecionar manualmente a conta no campo "Plano de Contas"

### Despesas históricas não aparecem no CostCenterAnalysis
- **Causa:** `cost_center_id` ainda NULL
- **Solução:** Executar migration `20251204010000` e script `map_expenses_to_cost_centers.py --apply`

### View `vw_expenses_with_accounts` não existe
- **Causa:** Migration `20251204000000` não foi aplicada
- **Solução:** Executar migration completa

---

## 📞 Próximos Passos

1. **Hoje:** Aplicar migrations ao Supabase
2. **Amanhã:** Validar dados históricos com script Python
3. **Próxima semana:** Testar fluxo completo com usuários
4. **Futuro:** Estender para outros sócios/centros conforme necessário

---

**Documento:** Implementação Centro de Custo ↔ Plano de Contas  
**Versão:** 1.0  
**Última atualização:** 04/12/2025
