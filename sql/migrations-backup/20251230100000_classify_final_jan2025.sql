-- Classificação final de lançamentos Janeiro/2025
-- Baseado nas informações do usuário

-- 1. FATURA MENSAL (Cartão de crédito do Sergio) - Adiantamento sócio
UPDATE accounting_entries
SET
  cost_center_id = '40d9d6ae-6b72-4744-a400-a29dc3b71b55',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%fatura mensal%'
AND cost_center_id IS NULL;

-- 2. FABRICIO SOARES BOMFIM - Adiantamento sócio (compra medicamentos)
UPDATE accounting_entries
SET
  cost_center_id = '40d9d6ae-6b72-4744-a400-a29dc3b71b55',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%fabricio soares bomfim%'
AND cost_center_id IS NULL;

-- 3. Empréstimos Scala - Adiantamento sócio
UPDATE accounting_entries
SET
  cost_center_id = '40d9d6ae-6b72-4744-a400-a29dc3b71b55',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%empréstimos%scala%'
OR description ILIKE '%emprestimos%scala%';

-- 4. Vonoria Amélia - Adiantamento sócio (passadeira de roupas)
UPDATE accounting_entries
SET
  cost_center_id = '40d9d6ae-6b72-4744-a400-a29dc3b71b55',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%vonoria%'
AND cost_center_id IS NULL;

-- 5. Condomínio Galeria Nacional - já classificado na migration anterior, mas garantir
UPDATE accounting_entries
SET
  cost_center_id = '49b9cc90-9d24-479a-a770-06b669b961a1',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%galeria nacional%'
AND cost_center_id IS NULL;

-- 6. Dep. Psicologia - Ampla (terceira psicóloga para funcionários)
-- Criar centro de custo para RH/Psicologia
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.8', 'AMPLA.RH', 'Recursos Humanos e Psicologia Organizacional', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.8')
WHERE description ILIKE '%dep. psicologia%ampla%'
AND cost_center_id IS NULL;

-- 7. ANDREA LEONE BASTOS - verificar na folha, provisoriamente em DP
UPDATE accounting_entries
SET cost_center_id = 'dff8e3e6-9f67-4908-a715-aeafe7715458'
WHERE description ILIKE '%andrea leone bastos%'
AND cost_center_id IS NULL;

-- 8. A F DE OLIVEIRA - FRANCA LOCACOES EIRELI - Locação para Ampla (verificado no extrato: DEBIT)
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%a f de oliveira%'
AND cost_center_id IS NULL;

-- 9. MIGUEL CARVALHO DE OLIVEIRA - verificar quem é (provisoriamente administrativo)
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%miguel carvalho%'
AND cost_center_id IS NULL;

-- 10. ANDREIA - verificar quem é (provisoriamente administrativo)
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE 'pagamento:%andreia%'
AND description NOT ILIKE '%andrea%'
AND cost_center_id IS NULL;

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis Jan/2025 classificados por centro de custo.';
