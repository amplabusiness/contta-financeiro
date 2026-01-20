-- Classificar lançamentos restantes de Janeiro/2025

-- 1. Condomínio Galeria Nacional - Imóvel do Sergio (3.2.4)
UPDATE accounting_entries
SET
  cost_center_id = '49b9cc90-9d24-479a-a770-06b669b961a1',
  entry_type = 'adiantamento_socio'
WHERE description ILIKE '%condomínio galeria nacional%'
OR description ILIKE '%condominio galeria nacional%';

-- 2. Despesas administrativas da Ampla
-- Vale Alimentação, Internet, Água, Telefone, Vale Transporte, Papelaria, Pão de queijo, Tarifas
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE cost_center_id IS NULL
AND (
  description ILIKE '%vale alimentação%ampla%'
  OR description ILIKE '%vale transporte%ampla%'
  OR description ILIKE '%internet%ampla%'
  OR description ILIKE '%água mineral%ampla%'
  OR description ILIKE '%telefone%ampla%'
  OR description ILIKE '%papelaria%ampla%'
  OR description ILIKE '%pao de queijo%ampla%'
  OR description ILIKE '%pão de queijo%ampla%'
  OR description ILIKE '%tarifa boleto%'
  OR description ILIKE '%manutenção de títulos%'
  OR description ILIKE '%manutenção conta%'
  OR description ILIKE '%caixa economica federal%'
);

-- 3. Dep. Psicologia - Ampla - novo departamento? Por enquanto administrativo
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%dep. psicologia%ampla%'
AND cost_center_id IS NULL;

-- 4. Vonoria Amélia - provável serviço de limpeza terceirizado
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%vonoria amélia%'
OR description ILIKE '%vonoria amelia%';

-- 5. LUIZ ALVES TAVEIRA - verificar depois (provisório administrativo)
UPDATE accounting_entries
SET cost_center_id = '9ebaef20-e25d-40b3-97bf-f44b1499a3e4'
WHERE description ILIKE '%luiz alves taveira%'
AND cost_center_id IS NULL;

-- Os seguintes precisam de confirmação manual:
-- ANDREA LEONE BASTOS (R$ 6.000) - quem é?
-- FATURA MENSAL-096541455 (R$ 5.756,25) - cartão de quem?
-- FABRICIO SOARES BOMFIM (R$ 3.800) - quem é?
-- A F DE OLIVEIRA (R$ 1.709,40) - quem é?
-- ANDREIA (R$ 1.500) - quem é?
-- Empréstimos - Scala (R$ 1.000) - para quem?
-- MIGUEL CARVALHO (R$ 220) - quem é?

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis. Alguns lançamentos precisam de revisão manual para identificar o centro de custo correto.';
