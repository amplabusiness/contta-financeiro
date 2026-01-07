# Documentação do Sistema de Fluxo de Caixa (Fase 7)

## Visão Geral
O sistema de Fluxo de Caixa foi implementado para fornecer uma visão projetada das finanças da empresa para os próximos 30 dias. Ele combina dados reais (saldos bancários, contas a receber) com dados projetados (folha de pagamento, pro-labore, pagamentos PJ) para estimar o saldo futuro.

## Componentes

### 1. Banco de Dados (Supabase)
Foram criadas Views SQL que calculam automaticamente as obrigações futuras com base na tabela de funcionários atual:

*   **`v_projections_payroll` (Folha CLT)**
    *   **Dia 15:** Adiantamento Salarial (40%).
    *   **Dia 30:** Salário Base (60%) + VA/VR + Transporte.
*   **`v_projections_contractors` (Prestadores PJ)**
    *   **Dia 10:** Pagamento integral dos contratos ativos.

### 2. Frontend (React/TypeScript)

*   **`src/services/CashFlowService.ts`**
    *   Serviço responsável por agregar os dados.
    *   Busca Saldo Atual do Dashboard.
    *   Busca Contas a Receber (Faturas Pendentes).
    *   Busca Projeções das Views SQL.
    *   Ordena tudo cronologicamente e calcula o saldo acumulado dia a dia.

*   **`src/components/dashboard/CashFlowWidget.tsx`**
    *   Widget visual integrado ao Dashboard principal.
    *   Exibe o **Saldo Projetado** (para daqui a 30 dias).
    *   Lista os **próximos 5 lançamentos** previstos (entradas ou saídas).
    *   Usa indicadores visuais (Seta Verde/Vermelha) para facilitar a leitura.

### 3. Integração
O widget foi adicionado ao layout do Dashboard (`src/pages/Dashboard.tsx`) em uma nova coluna lateral, otimizando o espaço de tela sem perder as métricas principais.

## Como Manter
O sistema é "Zero-Touch". As projeções são baseadas nos cadastros ativos:
*   Para ajustar a projeção da folha, basta atualizar o salário do funcionário na tabela `employees`.
*   Para ajustar a projeção de PJ, basta atualizar o valor do contrato na tabela `contractors`.
*   Novos funcionários adicionados ao sistema entram automaticamente na projeção.

## Próximos Passos (Sugestões)
*   Incluir impostos recorrentes (DAS, DARF) nas projeções.
*   Criar gráfico de linha mostrando a evolução do saldo nos 30 dias.
