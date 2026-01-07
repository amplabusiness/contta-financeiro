-- ==========================================
-- VIEW: v_projections_payroll
-- Projeção de pagamentos CLT (Adiantamento e Salário)
-- ==========================================

DROP VIEW IF EXISTS v_projections_payroll;

CREATE OR REPLACE VIEW v_projections_payroll AS
WITH active_clt AS (
    SELECT 
        id as employee_id,
        name,
        official_salary,
        entry_number -- Just placeholder if useful later
    FROM employees
    WHERE is_active = true 
      AND contract_type = 'CLT'
      AND official_salary > 0
),
current_dates AS (
    SELECT 
        make_date(extract(year from current_date)::int, extract(month from current_date)::int, 15) as adiantamento_date,
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
WHERE d.adiantamento_date >= current_date -- Show only future or today

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
-- VIEW: v_projections_contractors
-- Projeção de pagamentos PJ (Tudo dia 10)
-- ==========================================

DROP VIEW IF EXISTS v_projections_contractors;

CREATE OR REPLACE VIEW v_projections_contractors AS
WITH active_pj AS (
    SELECT 
        id as employee_id,
        name,
        COALESCE(unofficial_salary, 0) + COALESCE(official_salary, 0) as contract_value
    FROM employees
    WHERE is_active = true 
      AND contract_type = 'PJ'
      AND (COALESCE(unofficial_salary, 0) + COALESCE(official_salary, 0)) > 0
),
next_payment_date AS (
    SELECT 
        CASE 
            WHEN extract(day from current_date) <= 10 THEN 
                make_date(extract(year from current_date)::int, extract(month from current_date)::int, 10)
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
