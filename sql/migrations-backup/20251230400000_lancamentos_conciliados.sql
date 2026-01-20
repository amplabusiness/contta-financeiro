-- Lancamentos conciliados com usuario
-- Total: 13 lancamentos, R$ 53.413,08

-- Criar centro de custo para Sergio Augusto (filho que faz medicina)
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('3.1.3', 'SERGIO.FILHOS.SERGIO_AUGUSTO', 'Sergio Augusto (Filho - Medicina Itumbiara)',
        (SELECT id FROM cost_centers WHERE code = '3.1 SERGIO.FILHOS'), true, 'assets')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Lancamentos conciliados
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
-- Faculdade Medicina Itumbiara - Sergio Augusto (filho)
('2025-01-03', '2025-01-01', 'Faculdade Medicina Itumbiara - Sergio Augusto', 'adiantamento_socio', 10836.96, 10836.96,
 (SELECT id FROM cost_centers WHERE code = '3.1.3 SERGIO.FILHOS.SERGIO_AUGUSTO')),

-- Alexssandra - DP Terceira
('2025-01-10', '2025-01-01', 'Dep. Pessoal: Alexssandra Ferreira (Terceira)', 'pagamento_despesa', 3773.00, 3773.00,
 (SELECT id FROM cost_centers WHERE code = '1.1.2')),

-- Daniel Rodrigues - Fiscal Terceiro (3 pagamentos)
('2025-01-10', '2025-01-01', 'Dep. Fiscal: Daniel Rodrigues (Terceiro)', 'pagamento_despesa', 875.59, 875.59,
 (SELECT id FROM cost_centers WHERE code = '1.2.2')),
('2025-01-22', '2025-01-01', 'Dep. Fiscal: Daniel Rodrigues (Terceiro)', 'pagamento_despesa', 934.52, 934.52,
 (SELECT id FROM cost_centers WHERE code = '1.2.2')),
('2025-01-27', '2025-01-01', 'Dep. Fiscal: Daniel Rodrigues (Terceiro)', 'pagamento_despesa', 370.75, 370.75,
 (SELECT id FROM cost_centers WHERE code = '1.2.2')),

-- Maria Aparecida Gomes - Diarista Lago das Brisas (adiantamento socio)
('2025-01-13', '2025-01-01', 'Diarista Lago das Brisas - Maria Aparecida', 'adiantamento_socio', 160.00, 160.00,
 (SELECT id FROM cost_centers WHERE code = '3.2.1 SERGIO.CASA_CAMPO')),

-- Taylane - Financeiro CLT (adiantamento + final)
('2025-01-15', '2025-01-01', 'Salario: Taylane Belle (Financeiro CLT) - Adiantamento', 'pagamento_despesa', 1320.00, 1320.00,
 (SELECT id FROM cost_centers WHERE code = '1.6 AMPLA.FINANCEIRO')),
('2025-01-30', '2025-01-01', 'Salario: Taylane Belle (Financeiro CLT) - Final', 'pagamento_despesa', 2180.00, 2180.00,
 (SELECT id FROM cost_centers WHERE code = '1.6 AMPLA.FINANCEIRO')),

-- Fabiana - Baba da Nayara (CLT, adiantamento socio)
('2025-01-15', '2025-01-01', 'Baba Nayara: Fabiana Maria (CLT) - Adiantamento', 'adiantamento_socio', 920.00, 920.00,
 (SELECT id FROM cost_centers WHERE code = '3.1.1 SERGIO.FILHOS.NAYARA')),
('2025-01-30', '2025-01-01', 'Baba Nayara: Fabiana Maria (CLT) - Final', 'adiantamento_socio', 1194.77, 1194.77,
 (SELECT id FROM cost_centers WHERE code = '3.1.1 SERGIO.FILHOS.NAYARA')),

-- Transferencia entre contas - Ampla Contabilidade
('2025-01-27', '2025-01-01', 'Transferencia entre contas - Ampla Contabilidade', 'transferencia_interna', 29289.39, 29289.39,
 (SELECT id FROM cost_centers WHERE code = '3. SERGIO')),

-- Nova Visao Imports - VERIFICAR (colocando como material por enquanto)
('2025-01-28', '2025-01-01', 'Nova Visao Imports - Compra', 'pagamento_despesa', 1302.30, 1302.30,
 (SELECT id FROM cost_centers WHERE code = '1.21')),

-- PIX Marketplace - VERIFICAR (colocando como tarifa por enquanto)
('2025-01-28', '2025-01-01', 'PIX Marketplace - Taxa', 'pagamento_despesa', 255.80, 255.80,
 (SELECT id FROM cost_centers WHERE code = '1.13.1'))

ON CONFLICT DO NOTHING;

COMMENT ON TABLE accounting_entries IS 'Lancamentos Jan/2025 - Conciliacao completa com extrato.';
