# Sistema de Projeções de Fluxo de Caixa

## Visão Geral

O sistema de Projeções de Fluxo de Caixa permite criar e gerenciar projeções personalizadas de receitas e despesas que são automaticamente integradas ao fluxo de caixa da empresa.

## Arquitetura do Sistema

### Componentes Principais

1. **Banco de Dados** (`cash_flow_projections`)
   - Tabela para armazenar projeções personalizadas
   - Suporta projeções únicas e recorrentes
   - Migration: `supabase/migrations/20260119000000_cash_flow_projections_crud.sql`

2. **View Unificada** (`v_cash_flow_daily`)
   - Consolida dados de múltiplas fontes:
     - ✅ Receitas (Invoices pendentes)
     - ✅ Folha de Pagamento (`v_projections_payroll`)
     - ✅ Prestadores PJ (`v_projections_contractors`)
     - ✅ Impostos (`v_projections_taxes`)
     - ✅ Despesas Recorrentes (`recurring_expenses`)
     - ✅ **Projeções Customizadas** (`cash_flow_projections`) - NOVO!

3. **Frontend**
   - Página de Gerenciamento: `src/pages/CashFlowProjections.tsx`
   - Widget do Dashboard: `src/components/dashboard/CashFlowWidget.tsx`
   - Serviço: `src/services/CashFlowService.ts`

4. **Roteamento**
   - Rota: `/cash-flow-projections`
   - Menu: Principal > Projeções

## Estrutura da Tabela

```sql
CREATE TABLE cash_flow_projections (
    id UUID PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    projection_date DATE NOT NULL,
    projection_type TEXT NOT NULL,
    frequency TEXT,
    recurrence_end_date DATE,
    category TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### Tipos de Projeção (`projection_type`)

- `RECEITA` - Receitas projetadas
- `DESPESA_FOLHA` - Despesas com folha de pagamento
- `DESPESA_PJ` - Despesas com prestadores PJ
- `DESPESA_IMPOSTO` - Impostos a pagar
- `DESPESA_OUTROS` - Outras despesas
- `DESPESA_RECORRENTE` - Despesas recorrentes (fixas)

### Frequências (`frequency`)

- `once` - Única vez (não recorrente)
- `daily` - Diária
- `weekly` - Semanal
- `monthly` - Mensal
- `yearly` - Anual

## Como Usar

### 1. Acessar a Página de Projeções

Navegue para: **Principal > Projeções** ou acesse diretamente `/cash-flow-projections`

### 2. Criar uma Nova Projeção

1. Clique em **"Nova Projeção"**
2. Preencha os campos:
   - **Descrição**: Nome da projeção (ex: "Aluguel do escritório")
   - **Tipo**: Selecione se é receita ou despesa
   - **Valor**: Valor em reais
   - **Data da Projeção**: Data inicial
   - **Frequência**: Escolha entre única vez ou recorrente
   - **Data Final** (opcional): Para projeções recorrentes, defina quando deve parar
   - **Categoria** (opcional): Para organização
   - **Observações** (opcional): Detalhes adicionais
   - **Projeção Ativa**: Se deve aparecer no fluxo de caixa

3. Clique em **"Criar"**

### 3. Editar uma Projeção

1. Na lista de projeções, clique no ícone de **lápis** (Editar)
2. Modifique os campos desejados
3. Clique em **"Atualizar"**

### 4. Ativar/Desativar Projeção

Use o **switch** na coluna "Status" para ativar ou desativar temporariamente uma projeção sem excluí-la.

### 5. Excluir uma Projeção

1. Clique no ícone de **lixeira** (Excluir)
2. Confirme a exclusão no diálogo

## Exemplos de Uso

### Exemplo 1: Despesa Recorrente Mensal (Aluguel)

```
Descrição: Aluguel do Escritório
Tipo: DESPESA_RECORRENTE
Valor: R$ 2.500,00
Data da Projeção: 05/01/2026
Frequência: Mensal
Data Final: (deixar vazio para sem limite)
Categoria: Fixos
```

**Resultado**: Cria uma despesa de R$ 2.500,00 todo dia 5 de cada mês.

### Exemplo 2: Receita Única (Serviço Especial)

```
Descrição: Consultoria Especial Cliente X
Tipo: RECEITA
Valor: R$ 15.000,00
Data da Projeção: 15/02/2026
Frequência: Única vez
Categoria: Serviços Especiais
```

**Resultado**: Projeção única de receita de R$ 15.000,00 para 15/02/2026.

### Exemplo 3: Despesa Anual (Licença de Software)

```
Descrição: Renovação Adobe Creative Cloud
Tipo: DESPESA_RECORRENTE
Valor: R$ 3.200,00
Data da Projeção: 20/03/2026
Frequência: Anual
Data Final: 20/03/2029
Categoria: Software
```

**Resultado**: Despesa anual de R$ 3.200,00 todo dia 20 de março até 2029.

### Exemplo 4: Despesa Semanal (Prestador Temporário)

```
Descrição: Freelancer Design - Projeto Marketing
Tipo: DESPESA_PJ
Valor: R$ 1.800,00
Data da Projeção: 22/01/2026 (quarta-feira)
Frequência: Semanal
Data Final: 19/03/2026
Categoria: Freelancers
```

**Resultado**: Despesa semanal de R$ 1.800,00 todas as quartas-feiras até 19/03/2026.

## Integração com o Sistema

### Dashboard

As projeções aparecem automaticamente no widget **"Projeção (30 dias)"** no Dashboard principal.

### Fluxo de Caixa

As projeções são incluídas nos cálculos de:
- **Saldo Projetado**
- **Gráfico de Projeção de Saldo**
- **Alertas de Saldo Negativo**

### View `v_cash_flow_daily`

A view unificada já inclui as projeções customizadas através da view `v_projections_custom`, que:
- Expande projeções recorrentes em múltiplas datas
- Aplica o valor correto (positivo para receitas, negativo para despesas)
- Respeita o período de ativação/desativação
- Limita a projeção até a data final definida

## Permissões

Todos os usuários autenticados podem:
- ✅ Visualizar projeções
- ✅ Criar novas projeções
- ✅ Editar projeções existentes
- ✅ Excluir projeções
- ✅ Ativar/desativar projeções

## Manutenção

### Limpeza de Projeções Antigas

Projeções únicas com datas passadas continuam no banco para histórico, mas não aparecem nas views de projeção (filtradas por `projection_date >= CURRENT_DATE`).

Para limpar manualmente:

```sql
DELETE FROM cash_flow_projections
WHERE frequency = 'once'
  AND projection_date < CURRENT_DATE - INTERVAL '1 year'
  AND is_active = FALSE;
```

### Auditoria

Consultar todas as projeções ativas:

```sql
SELECT * FROM cash_flow_projections
WHERE is_active = TRUE
ORDER BY projection_date;
```

Visualizar projeções expandidas (próximos 30 dias):

```sql
SELECT * FROM v_projections_custom
WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY due_date;
```

## Troubleshooting

### Projeção não aparece no Dashboard

1. Verifique se `is_active = TRUE`
2. Confirme que `projection_date` está no futuro
3. Para recorrentes, verifique se `recurrence_end_date` não passou

### Projeção recorrente aparece apenas uma vez

1. Verifique o campo `frequency` (não deve ser `once`)
2. Confirme que a view `v_projections_custom` está expandindo corretamente

### Valor aparece errado no fluxo

1. Receitas devem usar tipo `RECEITA` (valor positivo)
2. Despesas devem usar tipos `DESPESA_*` (valor negativo automaticamente)

## Roadmap Futuro

- [ ] Importação em lote de projeções via CSV
- [ ] Templates de projeções comuns
- [ ] Comparação: Projetado vs Realizado
- [ ] Notificações quando projeção se aproxima da data
- [ ] Integração com IA para sugestões de projeções

## Suporte

Para dúvidas ou problemas, consulte:
- Código-fonte: `src/pages/CashFlowProjections.tsx`
- Migration: `supabase/migrations/20260119000000_cash_flow_projections_crud.sql`
- Service: `src/services/CashFlowService.ts`
