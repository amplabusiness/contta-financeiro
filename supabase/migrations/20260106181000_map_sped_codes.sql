-- MAPEAMENTO SPED ECD - PLANO REFERENCIAL (PJ EM GERAL - LUCRO PRESUMIDO)
-- Baseado no Manual do SPED - Tabela Dinâmica do Plano Referencial
-- Autor: Dr. Cicero

BEGIN;

-- =============================================
-- 1. ATIVO (1)
-- =============================================

-- Caixa (1.01.01.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.01.01' WHERE code = '1.1.1.01';

-- Bancos Conta Movimento (1.01.01.02.01)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.01' WHERE code LIKE '1.1.1.02%'; -- Bradesco
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.01' WHERE code LIKE '1.1.1.03%'; -- Itaú
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.01' WHERE code LIKE '1.1.1.04%'; -- BB
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.01' WHERE code LIKE '1.1.1.05%'; -- Sicredi

-- Aplicações Financeiras (1.01.01.02.02)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.01.02.02' WHERE code = '1.1.1.06';

-- Clientes (1.01.02.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.01.00' WHERE code = '1.1.2.01';
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.01.00' WHERE code = '1.1.2.02';

-- Adiantamentos (1.01.02.02.00)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.02.00' WHERE code LIKE '1.1.3.01%'; -- Fornecedores
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.02.00' WHERE code LIKE '1.1.3.02%'; -- Funcionários
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.02.00' WHERE code LIKE '1.1.3.04%'; -- Sócios

-- Impostos a Recuperar (1.01.02.04.00)
UPDATE chart_of_accounts SET sped_referencial_code = '1.01.02.04.00' WHERE code = '1.1.3.03';


-- =============================================
-- 2. PASSIVO (2)
-- =============================================

-- Fornecedores (2.01.01.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.01.01.01.00' WHERE code LIKE '2.1.1%';

-- Salários e Encargos (2.01.01.02.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.01.01.02.00' WHERE code LIKE '2.1.2%';

-- Impostos e Contribuições a Recolher (2.01.01.03.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.01.01.03.00' WHERE code LIKE '2.1.3%';

-- Outras Obrigações (2.01.01.04.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.01.01.04.00' WHERE code LIKE '2.1.4%';

-- Empréstimos Bancários (2.02.01.01.00) - Longo Prazo
UPDATE chart_of_accounts SET sped_referencial_code = '2.02.01.01.00' WHERE code LIKE '2.2.1%';

-- Capital Social (2.03.01.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.03.01.01.01' WHERE code LIKE '5.1%'; -- Adaptado para PL

-- Lucros Acumulados (2.03.04.01.00)
UPDATE chart_of_accounts SET sped_referencial_code = '2.03.04.01.00' WHERE code = '5.3.01.01';


-- =============================================
-- 3. RECEITAS (3)
-- =============================================

-- Receita Bruta de Vendas/Serviços (3.01.01.01.01)
UPDATE chart_of_accounts SET sped_referencial_code = '3.01.01.01.01' WHERE code LIKE '3.1.1%';

-- Receitas Financeiras (3.01.01.05.01)
UPDATE chart_of_accounts SET sped_referencial_code = '3.01.01.05.01' WHERE code LIKE '3.2.1%';


-- =============================================
-- 4. DESPESAS GERAIS E ADMINISTRATIVAS (4)
-- =============================================
-- O SPED para despesas é bem detalhado, usando um código genérico '3.02.01.01.00' para Despesas Operacionais em algumas visões simplificadas ou códigos específicos.
-- Vou mapear para Despesas Gerais (custos indiretos). No plano referencial, Despesas são contas de Resultado Devedoras (Grupo 3 ou 4 do Referencial, dependendo do regime).
-- Para Lucro Presumido, geralmente usamos o grupo 3 (Custos e Despesas) como contrapartida da Receita, mas o Referencial separa.
-- Assumindo Referencial PJ Geral: Despesas Operacionais = 3.11 ou 4.01 dependendo da tabela. Vamos usar mapeamento padrão de Despesas Administrativas.

-- Aluguel (3.01.01.07.01.05 - Exemplo, varia muito. Usaremos um genérico seguro para serviços)
-- Despesas Administrativas e de Vendas
UPDATE chart_of_accounts SET sped_referencial_code = '3.01.01.07.01.01' WHERE code = '4.1.01'; -- Alugueis


COMMIT;
