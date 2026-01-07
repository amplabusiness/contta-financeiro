# 🚀 Instruções para Ativação do Fluxo de Caixa

Para ativar o **Motor de Projeção de Fluxo de Caixa** (Fase 6 do Roadmap), precisamos criar as "Views" no banco de dados. Como não tenho permissão de escrita direta no schema (DDL), você precisa executar o código abaixo no Supabase.

## 📋 Passo a Passo

1. Acesse o **SQL Editor** do Supabase: [https://supabase.com/dashboard/project/_SEU_PROJETO_/sql/new](https://supabase.com/dashboard/project/_SEU_PROJETO_/sql/new)
2. Copie e cole o código SQL abaixo.
3. Clique em **RUN**.

---

### 🖥️ Código SQL (Copiar e Colar)

```sql
-- ==========================================
-- 1. PROJEÇÃO DE FOLHA CLT (Regra: 40% dia 15, 60% dia 30)
-- ==========================================
DROP VIEW IF EXISTS v_projections_payroll;

CREATE OR REPLACE VIEW v_projections_payroll AS
WITH active_clt AS (
    SELECT 
        id as employee_id,
        name,
        official_salary
    FROM employees
    WHERE is_active = true 
      AND contract_type = 'CLT'
      AND official_salary > 0
),
current_dates AS (
    SELECT 
        -- Dia 15 do mês corrente
        make_date(extract(year from current_date)::int, extract(month from current_date)::int, 15) as adiantamento_date,
        -- Último dia do mês corrente (Dia 30/31)
        (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date as salario_date
)
SELECT 
    e.employee_id,
    e.name,
    'ADIANTAMENTO' as type,
    d.adiantamento_date as due_date,
    ROUND((e.official_salary * 0.40), 2) as amount,
    'Adiantamento Salarial - ' || e.name as description
FROM active_clt e, current_dates d
WHERE d.adiantamento_date >= current_date -- Mostra apenas se ainda não venceu hoje (ou remover filtro para ver mês todo)

UNION ALL

SELECT 
    e.employee_id,
    e.name,
    'SALARIO' as type,
    d.salario_date as due_date,
    ROUND((e.official_salary * 0.60), 2) as amount,
    'Saldo de Salário - ' || e.name as description
FROM active_clt e, current_dates d
WHERE d.salario_date >= current_date;


-- ==========================================
-- 2. PROJEÇÃO DE CONTRATOS PJ (Regra: 100% dia 10)
-- OBS: Soma Salário Oficial + Salário Não Oficial (Bônus/Fora)
-- ==========================================
DROP VIEW IF EXISTS v_projections_contractors;

CREATE OR REPLACE VIEW v_projections_contractors AS
WITH active_pj AS (
    SELECT 
        id as employee_id,
        name,
        -- Soma os valores para chegar no total do contrato
        (COALESCE(unofficial_salary, 0) + COALESCE(official_salary, 0)) as contract_value
    FROM employees
    WHERE is_active = true 
      AND contract_type = 'PJ'
      AND (COALESCE(unofficial_salary, 0) + COALESCE(official_salary, 0)) > 0
),
next_payment_date AS (
    SELECT 
        CASE 
            -- Se hoje é dia 10 ou antes, o vencimento é dia 10 deste mês
            WHEN extract(day from current_date) <= 10 THEN 
                make_date(extract(year from current_date)::int, extract(month from current_date)::int, 10)
            -- Se já passou do dia 10, o vencimento é dia 10 do próximo mês
            ELSE
                make_date(extract(year from (current_date + interval '1 month'))::int, extract(month from (current_date + interval '1 month'))::int, 10)
        END as pay_date
)
SELECT 
    e.employee_id,
    e.name,
    'PJ' as type,
    d.pay_date as due_date,
    e.contract_value as amount,
    'Honorários PJ - ' || e.name as description
FROM active_pj e, next_payment_date d;
```

---

### ✅ O que isso faz?
*   Cria uma visão dinâmica (`View`) que calcula quanto você tem a pagar de folha e PJ baseado na data de hoje.
*   Se você consultar amanhã, as datas se ajustam automaticamente.
*   Isolamos o valor de PJ usando o campo "Salário Não Oficial" que é onde os valores reais dos contratos PJ estão armazenados.
