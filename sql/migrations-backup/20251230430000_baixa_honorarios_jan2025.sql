-- Dar baixa nos honorários recebidos em Janeiro/2025
-- Total: 5 clientes, R$ 3.279,09
-- Fonte: Relatório de títulos Sicredi + Extrato OFX Jan/2025

-- 1. C.R.J MANUTENCAO EM AR CONDICIONADO - Comp 10/2024 - R$ 256,73 - Liq. 23/01/2025
-- 2. HOKMA ELETROMONTAGEM - Comp 04/2024 - R$ 513,46 - Liq. 10/01/2025
-- 3. KORSICA COMERCIO ATACADISTA DE PNEUS - Comp 06/2024 - R$ 647,50 - Liq. 10/01/2025
-- 4. RODRIGO AUGUSTO RODRIGUES - Comp 10/2024 - R$ 256,73 - Liq. 23/01/2025
-- 5. UNICAIXAS DESPACHANTE - Comp 12/2024 - R$ 1.604,67 - Liq. 10/01/2025

UPDATE client_opening_balance
SET
    status = 'paid',
    paid_amount = amount,
    paid_date = '2025-01-31',
    updated_at = NOW()
WHERE id IN (
    'e7bf47a3-fcb8-4600-96ed-40a6cd7697f1',  -- C.R.J MANUTENCAO
    'd38acd83-92d0-4919-bada-4a9035d11dba',  -- HOKMA ELETROMONTAGEM
    'a86599d7-80ca-431a-a651-f4736dc788c1',  -- KORSICA COMERCIO
    'e50e6629-a92d-4d3f-9d8b-9192a504f93a',  -- RODRIGO AUGUSTO
    '2f19cdaf-3d6f-4aff-87a6-ed863d3128a7'   -- UNICAIXAS DESPACHANTE
);

COMMENT ON TABLE client_opening_balance IS 'Saldo de Abertura - 5 honorarios de Jan/2025 baixados (R$ 3.279,09)';
