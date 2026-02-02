-- ═══════════════════════════════════════════════════════════════════════════════
-- CONTTA | Matriz de Regras de Classificação
-- Data: 02/02/2026
-- Autor: Dr. Cícero (Sistema Contta)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- EXECUTE ESTE SQL NO SUPABASE DASHBOARD (SQL Editor) APÓS A MIGRATION
-- 
-- PRIORIDADES:
--   10-29: Bloqueios obrigatórios (requer aprovação)
--   30-49: Regras específicas (nomes de sócios, transferências)
--   50-69: Regras de receita (recebimentos)
--   70-89: Regras de despesa (pagamentos)
--   90-99: Regras genéricas (catch-all)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Limpar regras antigas (opcional - descomente se quiser recomeçar)
-- DELETE FROM classification_rules WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421';

-- ═══════════════════════════════════════════════════════════════════════════════
-- TENANT ID
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_tenant UUID := 'a53a4957-fe97-4856-b3ca-70045157b421';
  
  -- CONTAS CONTÁBEIS (IDs)
  -- Receitas
  v_receita_honorarios UUID := '3273fd5b-a16f-4a10-944e-55c8cb27f363';    -- 3.1.1.01 Honorários Contábeis
  v_clientes_receber UUID := '12cb93f6-daef-4e2d-bfa9-db9850fdc781';      -- 1.1.2.01 Clientes a Receber
  
  -- Despesas
  v_despesas_bancarias UUID := '03f80478-9632-4ff6-8893-b0633b4d579e';    -- 4.1.10 Despesas Bancárias
  v_tarifas UUID := 'c5abd23e-bb66-4499-a8f8-7282c74463a7';               -- 4.1.11 Tarifas e Taxas
  v_salarios UUID := '3ac8f548-9487-4ac1-8f01-49597b18afbc';              -- 4.1.1.01 Salários e Ordenados
  v_encargos_sociais UUID := 'e0e7b67d-e7df-4834-bea5-694f46ebf2ab';      -- 4.1.1.02 Encargos Sociais
  v_energia UUID := 'f85ab464-2851-4f9d-a5a2-1fc2a46ba3b5';               -- 4.1.2.02 Energia Elétrica
  v_telefone UUID := 'b17cc315-c9d3-4188-9322-b77fbda7ba16';              -- 4.1.2.03 Telefone e Internet
  v_internet UUID := '81e15db0-3356-4a35-93ae-77b9d731ef0a';              -- 4.1.2.05 Internet
  v_agua UUID := 'ddd41cda-b2c0-4a89-94c1-8bd1efba665f';                  -- 4.1.2.07 Água Mineral
  v_aluguel UUID := '7054c1bb-961c-4db3-af7c-cce5bfb3dbd4';               -- 4.1.2.01 Aluguel
  v_software UUID := '241b0a47-d34e-46aa-b2d1-9923ebb3ae89';              -- 4.1.2.12 Software e Sistemas
  v_material_limpeza UUID := '5036cd60-037c-44d3-afa7-3f07f13d4515';      -- 4.1.2.08 Material de Limpeza
  v_copa UUID := '724a8fc9-e1d1-4718-a9b4-55f1023b7696';                  -- 4.1.2.09 Copa e Cozinha
  v_despesa_conciliar UUID := '74add67b-bafb-40d0-9c56-644828621a45';     -- 4.1.1.99 Despesa a Conciliar
  v_vr_va UUID := 'b5797663-abac-45d4-88f2-26739bcb7209';                 -- 4.1.1.10 Vale Refeição/Alimentação
  v_vt UUID := '352b93b8-8d6e-4b64-9ecb-6a0a49f1c303';                    -- 4.1.1.09 Vale Transporte
  v_plano_saude UUID := 'd68b32b1-98fc-48ff-aab7-72073f0c2c9c';           -- 4.1.1.11 Plano de Saúde
  v_outras_admin UUID := '620e4802-2e6d-4318-9e27-5b7453e8df33';          -- 4.1.12 Outras Despesas Admin
  
  -- Passivos
  v_fornecedores UUID := '0fce710f-5bb5-433f-bd64-56ab99465a54';          -- 2.1.1.01 Fornecedores Nacionais
  v_emprestimos_socios UUID := '815bd89d-c13b-4538-8e6c-289162b2e464';    -- 2.1.4.03 Empréstimos de Sócios
  v_simples_nacional UUID := 'e8d4a540-4f50-4bca-b246-4f895a90e6a1';      -- 2.1.3.06 Simples Nacional
  v_inss_recolher UUID := 'ebcfcb58-1475-4c9b-97a8-ade8f4c43637';         -- 2.1.2.03 INSS a Recolher
  v_fgts_recolher UUID := '82bd81fc-c2fa-4bf3-ab2c-c0b49d03959f';         -- 2.1.2.02 FGTS a Recolher
  v_salarios_pagar UUID := 'd5c04379-4919-4859-a84a-fb292a5bb047';        -- 2.1.2.01 Salários a Pagar
  v_contas_pagar UUID := '03c8a6c3-d2f6-4aa8-bb3b-d8e2bc39a8cd';          -- 2.1.4.01 Contas a Pagar
  
  -- Ativos
  v_banco_sicredi UUID := '10d5892d-a843-4034-8d62-9fec95b8fd56';         -- 1.1.1.05 Banco Sicredi
  
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════════
  -- BLOCO 1: BLOQUEIOS OBRIGATÓRIOS (requires_approval = TRUE)
  -- PIX de sócios, transferências internas, empréstimos
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- PIX de sócio (ENTRADA) - NUNCA é receita
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, credit_account_id, requires_approval, notes)
  VALUES 
    (v_tenant, 10, 'BLOQUEIO: PIX Sócio Sérgio', 'ilike', '%SERGIO%CARNEIRO%', 'credit', NULL, TRUE, 
     'PIX recebido de sócio Sérgio Carneiro. NUNCA classificar como receita. Verificar: aporte, empréstimo ou erro.'),
    (v_tenant, 10, 'BLOQUEIO: PIX Sócio Sérgio (inverso)', 'ilike', '%CARNEIRO%SERGIO%', 'credit', NULL, TRUE, 
     'PIX recebido de sócio Sérgio Carneiro. NUNCA classificar como receita.'),
    (v_tenant, 11, 'BLOQUEIO: PIX Sócio Patrícia', 'ilike', '%PATRICIA%', 'credit', NULL, TRUE, 
     'Verificar se é sócio ou cliente. Requer aprovação Dr. Cícero.'),
    (v_tenant, 12, 'BLOQUEIO: Aporte de Capital', 'ilike', '%APORTE%', 'credit', NULL, TRUE, 
     'Possível aporte de capital. Verificar documentação societária.'),
    (v_tenant, 13, 'BLOQUEIO: Empréstimo', 'ilike', '%EMPRESTIMO%', 'any', NULL, TRUE, 
     'Movimentação de empréstimo requer análise documental.')
  ON CONFLICT DO NOTHING;
  
  -- Transferências para empresas do grupo - BLOQUEIO
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, debit_account_id, credit_account_id, requires_approval, notes)
  VALUES 
    (v_tenant, 15, 'BLOQUEIO: Transferência I.A Empreendimentos', 'ilike', '%I.A%EMPREEND%', 'any', NULL, NULL, TRUE, 
     'Transferência para empresa do grupo I.A Empreendimentos. Verificar natureza: mútuo, rateio, pagamento.'),
    (v_tenant, 15, 'BLOQUEIO: Transferência IA Empreendimentos', 'ilike', '%IA EMPREEND%', 'any', NULL, NULL, TRUE, 
     'Transferência para empresa do grupo. Verificar natureza.'),
    (v_tenant, 16, 'BLOQUEIO: Transferência Ampla', 'ilike', '%AMPLA%CONTABIL%', 'any', NULL, NULL, TRUE, 
     'Transferência interna Ampla Contabilidade. Verificar se é para outra conta da mesma empresa.')
  ON CONFLICT DO NOTHING;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- BLOCO 2: REGRAS ESPECÍFICAS (30-49)
  -- Pró-labore, salários específicos
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- Pró-labore do sócio (SAÍDA)
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, debit_account_id, requires_approval, notes)
  VALUES 
    (v_tenant, 30, 'Pró-labore Sérgio Carneiro', 'ilike', '%SERGIO%CARNEIRO%', 'debit', v_salarios_pagar, FALSE, 
     'Pagamento de pró-labore para sócio Sérgio Carneiro. D: Salários a Pagar'),
    (v_tenant, 30, 'Pró-labore Sérgio (inverso)', 'ilike', '%CARNEIRO%SERGIO%', 'debit', v_salarios_pagar, FALSE, 
     'Pagamento de pró-labore para sócio.')
  ON CONFLICT DO NOTHING;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- BLOCO 3: REGRAS DE RECEITA - ENTRADAS (50-69)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- Recebimentos PIX de clientes
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, credit_account_id, notes)
  VALUES 
    (v_tenant, 50, 'Recebimento PIX', 'ilike', '%RECEBIMENTO PIX%', 'credit', v_clientes_receber, 
     'Recebimento via PIX. Baixa em Clientes a Receber (1.1.2.01).'),
    (v_tenant, 51, 'PIX Crédito', 'ilike', '%PIX_CRED%', 'credit', v_clientes_receber, 
     'PIX creditado. Baixa em Clientes a Receber.'),
    (v_tenant, 52, 'Recebimento PIX Sicredi', 'ilike', '%RECEBIMENTO PIX SICREDI%', 'credit', v_clientes_receber, 
     'Recebimento PIX via Sicredi. Baixa em Clientes.')
  ON CONFLICT DO NOTHING;
  
  -- Recebimentos via Boleto/Cobrança
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, credit_account_id, notes)
  VALUES 
    (v_tenant, 55, 'Liquidação Cobrança Simples', 'ilike', '%LIQ.COBRANCA SIMPLES%', 'credit', v_clientes_receber, 
     'Liquidação de boleto bancário. Baixa em Clientes a Receber.'),
    (v_tenant, 55, 'Liquidação Cobrança', 'ilike', '%LIQUIDACAO COBRANCA%', 'credit', v_clientes_receber, 
     'Liquidação de cobrança. Baixa em Clientes.'),
    (v_tenant, 56, 'Cobrança COB', 'regex', 'COB0*[0-9]+', 'credit', v_clientes_receber, 
     'Recebimento de boleto de cobrança.')
  ON CONFLICT DO NOTHING;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- BLOCO 4: REGRAS DE DESPESA - SAÍDAS (70-89)
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- Tarifas bancárias
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, debit_account_id, notes)
  VALUES 
    (v_tenant, 70, 'Tarifa Bancária - Liquidação', 'ilike', '%TARIFA COM R LIQUIDACAO%', 'debit', v_despesas_bancarias, 
     'Tarifa de liquidação de cobrança. D: Despesas Bancárias (4.1.10).'),
    (v_tenant, 70, 'Tarifa Bancária - Genérico', 'ilike', '%TARIFA%', 'debit', v_despesas_bancarias, 
     'Tarifa bancária genérica.'),
    (v_tenant, 71, 'Taxa Bancária', 'ilike', '%TAXA%', 'debit', v_tarifas, 
     'Taxa bancária. D: Tarifas e Taxas (4.1.11).'),
    (v_tenant, 72, 'IOF', 'ilike', '%IOF%', 'debit', v_despesas_bancarias, 
     'IOF sobre operação financeira.'),
    (v_tenant, 73, 'Manutenção de Títulos', 'ilike', '%MANUTENCAO DE TITULOS%', 'debit', v_despesas_bancarias, 
     'Taxa de manutenção de títulos em cobrança.'),
    (v_tenant, 74, 'Cesta de Relacionamento', 'ilike', '%CESTA DE RELACIONAMENTO%', 'debit', v_despesas_bancarias, 
     'Pacote de serviços bancários.')
  ON CONFLICT DO NOTHING;
  
  -- Pagamentos via PIX genéricos
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, debit_account_id, notes)
  VALUES 
    (v_tenant, 75, 'Pagamento PIX Genérico', 'ilike', '%PAGAMENTO PIX%', 'debit', v_fornecedores, 
     'Pagamento via PIX. D: Fornecedores (2.1.1.01). Pode precisar reclassificação.'),
    (v_tenant, 75, 'PIX Débito Genérico', 'ilike', '%PIX_DEB%', 'debit', v_fornecedores, 
     'PIX debitado. D: Fornecedores.')
  ON CONFLICT DO NOTHING;
  
  -- Liquidação de boletos
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, debit_account_id, notes)
  VALUES 
    (v_tenant, 76, 'Liquidação Boleto', 'ilike', '%LIQUIDACAO BOLETO%', 'debit', v_fornecedores, 
     'Pagamento de boleto. D: Fornecedores.'),
    (v_tenant, 77, 'Débito Convênios', 'ilike', '%DEBITO CONVENIOS%', 'debit', v_simples_nacional, 
     'Pagamento via convênio (DARF, DAS, FGTS). D: Simples Nacional.'),
    (v_tenant, 78, 'Pagamento DAS', 'ilike', '%DAS%SIMPLES%', 'debit', v_simples_nacional, 
     'DAS - Simples Nacional.'),
    (v_tenant, 79, 'Pagamento FGTS', 'ilike', '%FGTS%', 'debit', v_fgts_recolher, 
     'Recolhimento FGTS. D: FGTS a Recolher (2.1.2.02).'),
    (v_tenant, 79, 'Pagamento INSS', 'ilike', '%INSS%', 'debit', v_inss_recolher, 
     'Recolhimento INSS. D: INSS a Recolher (2.1.2.03).')
  ON CONFLICT DO NOTHING;
  
  -- Despesas específicas
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, debit_account_id, notes)
  VALUES 
    (v_tenant, 80, 'Energia Elétrica - Enel', 'ilike', '%ENEL%', 'debit', v_energia, 
     'Conta de luz ENEL. D: Energia Elétrica (4.1.2.02).'),
    (v_tenant, 80, 'Energia Elétrica', 'ilike', '%ENERGIA%', 'debit', v_energia, 
     'Conta de energia elétrica.'),
    (v_tenant, 81, 'Telefone Vivo', 'ilike', '%VIVO%', 'debit', v_telefone, 
     'Conta telefone/internet Vivo. D: Telefone e Internet (4.1.2.03).'),
    (v_tenant, 81, 'Telefone Claro', 'ilike', '%CLARO%', 'debit', v_telefone, 
     'Conta telefone/internet Claro.'),
    (v_tenant, 81, 'Telefone Tim', 'ilike', '%TIM%', 'debit', v_telefone, 
     'Conta telefone Tim.'),
    (v_tenant, 82, 'Internet', 'ilike', '%INTERNET%', 'debit', v_internet, 
     'Serviço de internet. D: Internet (4.1.2.05).'),
    (v_tenant, 83, 'Software/Sistema', 'ilike', '%SOFTWARE%', 'debit', v_software, 
     'Licença de software. D: Software e Sistemas (4.1.2.12).'),
    (v_tenant, 83, 'Domínio Registro', 'ilike', '%REGISTRO%', 'debit', v_software, 
     'Registro de domínio.'),
    (v_tenant, 84, 'Aluguel', 'ilike', '%ALUGUEL%', 'debit', v_aluguel, 
     'Pagamento de aluguel. D: Aluguel (4.1.2.01).'),
    (v_tenant, 85, 'Vale Transporte', 'ilike', '%VALE TRANSPORTE%', 'debit', v_vt, 
     'Vale transporte funcionários. D: Vale Transporte (4.1.1.09).'),
    (v_tenant, 85, 'VT Funcionário', 'ilike', '%VT %', 'debit', v_vt, 
     'Vale transporte.'),
    (v_tenant, 86, 'Vale Refeição', 'ilike', '%VALE REFEICAO%', 'debit', v_vr_va, 
     'Vale refeição funcionários. D: VR/VA (4.1.1.10).'),
    (v_tenant, 86, 'Vale Alimentação', 'ilike', '%VALE ALIMENTACAO%', 'debit', v_vr_va, 
     'Vale alimentação funcionários.'),
    (v_tenant, 86, 'VR Funcionário', 'ilike', '%VR %', 'debit', v_vr_va, 
     'Vale refeição.'),
    (v_tenant, 87, 'Plano de Saúde', 'ilike', '%PLANO SAUDE%', 'debit', v_plano_saude, 
     'Plano de saúde. D: Plano de Saúde (4.1.1.11).'),
    (v_tenant, 87, 'Unimed', 'ilike', '%UNIMED%', 'debit', v_plano_saude, 
     'Plano Unimed.'),
    (v_tenant, 88, 'Água Mineral', 'ilike', '%AGUA%MINERAL%', 'debit', v_agua, 
     'Água mineral escritório. D: Água Mineral (4.1.2.07).'),
    (v_tenant, 88, 'Indaiá', 'ilike', '%INDAIA%', 'debit', v_agua, 
     'Água Indaiá.')
  ON CONFLICT DO NOTHING;
  
  -- Fornecedores específicos
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, debit_account_id, notes)
  VALUES 
    (v_tenant, 85, 'Atacadão', 'ilike', '%ATACADAO%', 'debit', v_copa, 
     'Compras Atacadão. D: Copa e Cozinha (4.1.2.09).'),
    (v_tenant, 85, 'Bretas', 'ilike', '%BRETAS%', 'debit', v_copa, 
     'Compras Bretas.'),
    (v_tenant, 86, 'Kalunga', 'ilike', '%KALUNGA%', 'debit', v_outras_admin, 
     'Material escritório Kalunga. D: Outras Despesas Admin (4.1.12).')
  ON CONFLICT DO NOTHING;
  
  -- ═══════════════════════════════════════════════════════════════════════════
  -- BLOCO 5: REGRAS GENÉRICAS / CATCH-ALL (90-99)
  -- Menor prioridade - só aplicam se nenhuma outra regra casou
  -- ═══════════════════════════════════════════════════════════════════════════
  
  INSERT INTO classification_rules (tenant_id, priority, rule_name, match_type, match_value, direction, debit_account_id, credit_account_id, requires_approval, notes)
  VALUES 
    (v_tenant, 95, 'Pagamento Genérico PIX Sicredi', 'ilike', '%PAGAMENTO PIX SICREDI%', 'debit', v_fornecedores, NULL, FALSE, 
     'Pagamento PIX Sicredi não identificado. D: Fornecedores. Revisar posteriormente.'),
    (v_tenant, 99, 'Entrada não classificada', 'contains', '', 'credit', NULL, v_despesa_conciliar, TRUE, 
     'Entrada sem regra específica. Requer análise manual do Dr. Cícero.'),
    (v_tenant, 99, 'Saída não classificada', 'contains', '', 'debit', v_despesa_conciliar, NULL, TRUE, 
     'Saída sem regra específica. Requer análise manual.')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '═════════════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Regras de classificação inseridas com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'Total de regras criadas: ~50';
  RAISE NOTICE '';
  RAISE NOTICE 'Blocos:';
  RAISE NOTICE '  10-29: Bloqueios (PIX sócio, transferências grupo)';
  RAISE NOTICE '  30-49: Específicos (pró-labore)';
  RAISE NOTICE '  50-69: Receitas (PIX, boletos)';
  RAISE NOTICE '  70-89: Despesas (tarifas, fornecedores, utilidades)';
  RAISE NOTICE '  90-99: Genéricos (catch-all)';
  RAISE NOTICE '═════════════════════════════════════════════════════════════════════';
END $$;

-- Verificar regras inseridas
SELECT 
  priority,
  rule_name,
  match_type,
  direction,
  requires_approval,
  LEFT(notes, 50) as notas
FROM classification_rules
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
ORDER BY priority, rule_name;
