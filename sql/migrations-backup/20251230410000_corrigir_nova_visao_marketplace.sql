-- Corrigir classificacao Nova Visao e PIX Marketplace
-- Ambos sao material de iluminacao/reforma da Ampla

-- Nova Visao Imports - Material Iluminacao Reforma Ampla
UPDATE accounting_entries
SET description = 'Material Iluminacao (Nova Visao Imports) - Reforma Ampla',
    cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.9')
WHERE entry_date = '2025-01-28'
  AND total_debit = 1302.30
  AND description ILIKE '%Nova Visao%';

-- PIX Marketplace (Mercado Livre) - Material Reforma Ampla
UPDATE accounting_entries
SET description = 'Material Reforma (Mercado Livre) - Ampla',
    cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.9')
WHERE entry_date = '2025-01-28'
  AND total_debit = 255.80
  AND description ILIKE '%PIX Marketplace%';

COMMENT ON TABLE accounting_entries IS 'Lancamentos Jan/2025 - Conciliacao 100% completa com extrato.';
