-- ==========================================
-- IMPORTAÇÃO EM MASSA DE CLIENTES
-- ==========================================

-- INSTRUÇÕES:
-- 1. Edite os dados abaixo com seus clientes reais
-- 2. Execute no SQL Editor: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new

-- TEMPLATE DE INSERÇÃO:
INSERT INTO clients (name, cnpj, email, phone, monthly_fee, fee_due_day, is_active, opening_balance)
VALUES
  -- Exemplo 1
  ('Empresa Exemplo 1', '12.345.678/0001-90', 'contato@exemplo1.com', '(11) 98765-4321', 1500.00, 10, true, 0),
  
  -- Exemplo 2
  ('Empresa Exemplo 2', '98.765.432/0001-10', 'contato@exemplo2.com', '(11) 98765-4322', 2000.00, 5, true, 0),
  
  -- Adicione mais clientes aqui...
  -- ('Nome do Cliente', 'CNPJ', 'email@cliente.com', 'telefone', honorário_mensal, dia_vencimento, ativo, saldo_abertura),
  
  ('Cliente Teste', NULL, 'teste@email.com', NULL, 0, 10, true, 0);

-- Após inserir, verifique:
SELECT id, name, cnpj, monthly_fee FROM clients ORDER BY name;
