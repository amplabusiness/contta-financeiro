-- ============================================================================
-- CONCILIAÇÃO ENTRADAS JANEIRO/2025
-- Total: R$ 298.527,29 (31 lançamentos)
-- - Boletos: R$ 105.197,58 (104 clientes em 16 COBs)
-- - PIX: R$ 193.329,71 (15 lançamentos)
-- ============================================================================

-- ============================================================================
-- PARTE 1: BAIXAS DE SALDO DE ABERTURA (PIX)
-- ============================================================================

-- 1.1 Paula Milhomem -> Restaurante Iuvaci (amortização parcial 07/2024)
-- PIX 03/01/2025 - R$ 200,00 (saldo 07/2024 = R$ 713,38 -> resta R$ 513,38)
UPDATE client_opening_balance
SET
    paid_amount = COALESCE(paid_amount, 0) + 200.00,
    notes = 'Amortização parcial - PIX Paula Milhomem 03/01/2025',
    updated_at = NOW()
WHERE id = 'db5eb757-71e5-4048-bcec-2878b0d9bec6';  -- IUVACI 07/2024

-- 1.2 Enzo de Aquino -> VERDI 07/2024 (R$ 2.118,07)
-- PIX 28/01/2025 - R$ 4.000,00 + R$ 1.718,81 = R$ 5.718,81
UPDATE client_opening_balance
SET
    status = 'paid',
    paid_amount = amount,
    paid_date = '2025-01-28',
    notes = 'PIX Enzo de Aquino 28/01/2025',
    updated_at = NOW()
WHERE id = 'd3fdb3ba-a6cd-441b-9366-3ce80e0161c9';  -- VERDI 07/2024 R$ 2.118,07

-- 1.3 Enzo de Aquino -> CRYSTAL 01/2025 (R$ 834,88)
UPDATE client_opening_balance
SET
    status = 'paid',
    paid_amount = amount,
    paid_date = '2025-01-28',
    notes = 'PIX Enzo de Aquino 28/01/2025',
    updated_at = NOW()
WHERE id = '84ca5232-ddfa-4083-b47e-4df08845aafd';  -- CRYSTAL 01/2025 R$ 834,88

-- 1.4 Enzo de Aquino -> VERDI 08/2024 (parcial - R$ 2.765,86 do total pago)
-- Total pago Enzo: R$ 5.718,81
-- VERDI 07/2024: R$ 2.118,07 (pago integral)
-- CRYSTAL 01/2025: R$ 834,88 (pago integral)
-- Sobra: R$ 5.718,81 - R$ 2.118,07 - R$ 834,88 = R$ 2.765,86 para VERDI 08/2024
UPDATE client_opening_balance
SET
    status = 'paid',
    paid_amount = amount,
    paid_date = '2025-01-28',
    notes = 'PIX Enzo de Aquino 28/01/2025 (composição múltiplas empresas)',
    updated_at = NOW()
WHERE id = 'bc259458-aac9-4797-804f-59df598ecf51';  -- VERDI 08/2024 R$ 2.118,07

-- 1.5 Ivair Goncalves -> Mineração Serrano (4 competências)
-- PIX 29/01/2025 - R$ 2.826,00
-- 11/2024: R$ 706,00
UPDATE client_opening_balance
SET
    status = 'paid',
    paid_amount = amount,
    paid_date = '2025-01-29',
    notes = 'PIX Ivair Goncalves 29/01/2025',
    updated_at = NOW()
WHERE id = '57c76e57-dd75-4350-ad8e-fe33756f20c1';  -- MINERACAO SERRANO 11/2024

-- 12/2024: R$ 706,00
UPDATE client_opening_balance
SET
    status = 'paid',
    paid_amount = amount,
    paid_date = '2025-01-29',
    notes = 'PIX Ivair Goncalves 29/01/2025',
    updated_at = NOW()
WHERE id = '566f370d-e0b6-4b70-98e9-53513b95a5a5';  -- MINERACAO SERRANO 12/2024

-- 12/2024 (13º): R$ 706,00
UPDATE client_opening_balance
SET
    status = 'paid',
    paid_amount = amount,
    paid_date = '2025-01-29',
    notes = 'PIX Ivair Goncalves 29/01/2025 (13º)',
    updated_at = NOW()
WHERE id = '042b3c50-aef7-4716-ab40-504f9d5286d6';  -- MINERACAO SERRANO 12/2024 (13º)

-- 01/2025: R$ 708,00 (parcial de R$ 759,00 - faltou R$ 51,00)
UPDATE client_opening_balance
SET
    paid_amount = 708.00,
    notes = 'PIX Ivair Goncalves 29/01/2025 - parcial (faltou R$ 51,00)',
    updated_at = NOW()
WHERE id = '25445cbf-df93-4459-8bf2-2e405073cc0b';  -- MINERACAO SERRANO 01/2025

-- ============================================================================
-- PARTE 2: MARCAR TRANSAÇÕES BANCÁRIAS COMO CONCILIADAS
-- ============================================================================

-- Atualizar status das transações bancárias de Janeiro/2025 para conciliado
UPDATE bank_transactions
SET
    is_reconciled = true,
    status = 'reconciled'
WHERE transaction_date >= '2025-01-01'
  AND transaction_date <= '2025-01-31'
  AND amount > 0;

-- ============================================================================
-- COMENTÁRIO FINAL
-- ============================================================================
COMMENT ON TABLE client_opening_balance IS 'Saldo de Abertura - Conciliação Jan/2025 completa. Baixas: Iuvaci (parcial), Verdi (07-08/2024), Crystal (01/2025), Mineração Serrano (11/2024-01/2025)';
