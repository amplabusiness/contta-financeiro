-- Corrigir lançamentos que NÃO são despesas da Ampla
-- Problema: Transferências entre contas, retenções e despesas pessoais estavam como "despesa"

-- 0. Criar centro de custo para Energia (monitoramento separado)
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.7', 'AMPLA.ENERGIA', 'Energia elétrica - monitoramento mensal', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 1. Transferências entre contas da própria Ampla - NÃO É DESPESA
-- "AMPLA CONTABILIDADE" são transferências internas, devem ser removidas do DRE
UPDATE accounting_entries
SET entry_type = 'transferencia_interna'
WHERE description ILIKE '%AMPLA CONTABILIDADE%'
AND entry_type IN ('despesa', 'pagamento_despesa')
AND description NOT ILIKE '%honorario%';

-- 2. INSS e IRRF - São retenções a recolher, NÃO despesas
-- O valor é retido do funcionário e repassado ao governo
UPDATE accounting_entries
SET entry_type = 'passivo_obrigacao'
WHERE description ILIKE '%INSS%IRRF%Ampla%'
OR description ILIKE '%INSS%Ampla%'
OR description ILIKE '%IRRF%Ampla%';

-- 3. Despesas pessoais do Sergio que estavam como despesa da Ampla
-- Condomínio Lago, Obras Lago = Casa do Lago (3.2.1 SERGIO.CASA_CAMPO)
UPDATE accounting_entries
SET
  cost_center_id = 'f8a40a16-7555-4e0e-a67f-8736fb7ef21e',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%condomínio lago%'
OR description ILIKE '%condominio lago%'
OR description ILIKE '%obras lago%'
OR description ILIKE '%casa lago%';

-- Condomínio Mundi = Vila Abaja? ou outro imóvel do Sergio
UPDATE accounting_entries
SET
  cost_center_id = 'ad2ac6be-1936-44ff-a7f0-02183daa640a',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%condomínio mundi%'
OR description ILIKE '%condominio mundi%';

-- 4. Outsider Construtora - Ampla - precisa verificar se é despesa real ou obra pessoal
-- Por enquanto classificar como AMPLA.ADMINISTRATIVO
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%outsider construtora%ampla%'
AND cost_center_id IS NULL;

-- 5. Obras Ampla - Despesa administrativa da Ampla
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%obras ampla%'
AND cost_center_id IS NULL;

-- 6. IPTU 2018 - Ampla - Despesa administrativa
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%IPTU%Ampla%'
AND cost_center_id IS NULL;

-- 7. Dep. Limpeza - Ampla - Despesa administrativa
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%dep. limpeza%ampla%'
OR description ILIKE '%limpeza%ampla%';

-- 8. Energia - Ampla - Centro de custo específico para monitoramento
UPDATE accounting_entries
SET cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.7')
WHERE description ILIKE '%energia%ampla%'
AND cost_center_id IS NULL;

-- 9. Anuidade CRC - Ampla e funcionários
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%anuidade crc%ampla%'
OR description ILIKE '%anuidade crc%carla%';

-- 10. Comissão - Ampla - Comercial/Administrativo
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%comissão%ampla%'
AND cost_center_id IS NULL;

-- 11. FATURA MENSAL (cartão?) - precisa identificar de quem é
-- Por enquanto deixar sem centro de custo para revisão manual

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis classificados. entry_type: transferencia_interna e passivo_obrigacao NÃO entram no DRE de despesas.';
