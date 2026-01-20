-- Dar baixa no honorário KORSICA recebido em Janeiro/2025
-- Boleto liquidado: 10/01/2025 - R$ 647,50
-- Competência mais antiga pendente: 07/2024
-- Fonte: Relatório de títulos Sicredi Jan/2025

UPDATE client_opening_balance
SET
    status = 'paid',
    paid_amount = amount,
    paid_date = '2025-01-10',
    updated_at = NOW()
WHERE id = '77ba1498-f961-45c4-b3d5-c971f3c2fda4';  -- KORSICA 07/2024

COMMENT ON TABLE client_opening_balance IS 'Saldo de Abertura - KORSICA 07/2024 baixado (R$ 647,50) - Total Jan/2025: R$ 3.926,59';
