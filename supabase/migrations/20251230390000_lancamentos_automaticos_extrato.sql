-- Lancamentos automaticos identificados no extrato OFX
-- Total: 69 lancamentos, R$ 45.891,75

-- Criar centros de custo faltantes

-- 1.22 AMPLA.FINANCEIRO.FACTORING
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.22', 'AMPLA.FINANCEIRO.FACTORING', 'Factoring e Antecipacao de Recebiveis',
        (SELECT id FROM cost_centers WHERE code = '1.6 AMPLA.FINANCEIRO'), true, 'expenses')
ON CONFLICT (code) DO NOTHING;

-- 1.24 AMPLA.SEGUROS
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.24', 'AMPLA.SEGUROS', 'Seguros Diversos',
        (SELECT id FROM cost_centers WHERE code = '1. AMPLA'), true, 'expenses')
ON CONFLICT (code) DO NOTHING;

-- 3.4 SERGIO.EMPRESTIMOS
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('3.4', 'SERGIO.EMPRESTIMOS', 'Emprestimos Concedidos',
        (SELECT id FROM cost_centers WHERE code = '3. SERGIO'), true, 'assets')
ON CONFLICT (code) DO NOTHING;

-- Lancamentos automaticos identificados no extrato
INSERT INTO accounting_entries (entry_date, competence_date, description, entry_type, total_debit, total_credit, cost_center_id)
VALUES
('2025-01-02', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 9.45, 9.45, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-03', '2025-01-01', 'Adiantamento Victor Hugo', 'adiantamento_socio', 328.0, 328.0, (SELECT id FROM cost_centers WHERE code = '3.1.2 SERGIO.FILHOS.VICTOR')),
('2025-01-03', '2025-01-01', 'Obras - Outsider Construtora', 'pagamento_despesa', 11000.0, 11000.0, (SELECT id FROM cost_centers WHERE code = '1.9')),
('2025-01-03', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 13.23, 13.23, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-06', '2025-01-01', 'Adiantamento Sergio Augusto', 'adiantamento_socio', 266.0, 266.0, (SELECT id FROM cost_centers WHERE code = '3. SERGIO')),
('2025-01-06', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 1.89, 1.89, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-06', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 39.69, 39.69, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-07', '2025-01-01', 'Adiantamento Sergio Augusto', 'adiantamento_socio', 55.0, 55.0, (SELECT id FROM cost_centers WHERE code = '3. SERGIO')),
('2025-01-07', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 1.89, 1.89, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-08', '2025-01-01', 'Manutencao Titulos - Sicredi', 'pagamento_despesa', 1.89, 1.89, (SELECT id FROM cost_centers WHERE code = '1.13.2')),
('2025-01-09', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 5.67, 5.67, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-10', '2025-01-01', 'Manutencao Titulos - Sicredi', 'pagamento_despesa', 11.34, 11.34, (SELECT id FROM cost_centers WHERE code = '1.13.2')),
('2025-01-10', '2025-01-01', 'Adiantamento Victor Hugo', 'adiantamento_socio', 402.88, 402.88, (SELECT id FROM cost_centers WHERE code = '3.1.2 SERGIO.FILHOS.VICTOR')),
('2025-01-10', '2025-01-01', 'Personal Antonio Leandro - Sergio', 'adiantamento_socio', 800.0, 800.0, (SELECT id FROM cost_centers WHERE code = '3. SERGIO')),
('2025-01-10', '2025-01-01', 'Condominio Mundi - Sergio', 'adiantamento_socio', 1575.72, 1575.72, (SELECT id FROM cost_centers WHERE code = '3.2.1 SERGIO.CASA_CAMPO')),
('2025-01-10', '2025-01-01', 'Objetiva Edicoes (Publicacoes)', 'pagamento_despesa', 423.6, 423.6, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-10', '2025-01-01', 'Sistema Dominio - Thomson Reuters', 'pagamento_despesa', 2278.8, 2278.8, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-10', '2025-01-01', 'Sistema Clicksign', 'pagamento_despesa', 69.0, 69.0, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-10', '2025-01-01', 'Manutencao Elevador - ADV System', 'pagamento_despesa', 200.0, 200.0, (SELECT id FROM cost_centers WHERE code = '1.12')),
('2025-01-10', '2025-01-01', 'Sistema PJBank', 'pagamento_despesa', 370.0, 370.0, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-10', '2025-01-01', 'Telefone Celular TIM', 'pagamento_despesa', 39.99, 39.99, (SELECT id FROM cost_centers WHERE code = '1.12')),
('2025-01-10', '2025-01-01', 'Telefone Celular TIM', 'pagamento_despesa', 39.99, 39.99, (SELECT id FROM cost_centers WHERE code = '1.12')),
('2025-01-10', '2025-01-01', 'Adiantamento Sergio Augusto', 'adiantamento_socio', 6000.0, 6000.0, (SELECT id FROM cost_centers WHERE code = '3. SERGIO')),
('2025-01-10', '2025-01-01', 'Adiantamento Victor Hugo', 'adiantamento_socio', 6000.0, 6000.0, (SELECT id FROM cost_centers WHERE code = '3.1.2 SERGIO.FILHOS.VICTOR')),
('2025-01-10', '2025-01-01', 'Telefone Celular TIM', 'pagamento_despesa', 50.99, 50.99, (SELECT id FROM cost_centers WHERE code = '1.12')),
('2025-01-10', '2025-01-01', 'Telefone Celular TIM', 'pagamento_despesa', 50.99, 50.99, (SELECT id FROM cost_centers WHERE code = '1.12')),
('2025-01-10', '2025-01-01', 'Factoring - L Argent', 'pagamento_despesa', 765.39, 765.39, (SELECT id FROM cost_centers WHERE code = '1.22')),
('2025-01-10', '2025-01-01', 'Condominio Mundi - Sergio', 'adiantamento_socio', 1471.41, 1471.41, (SELECT id FROM cost_centers WHERE code = '3.2.1 SERGIO.CASA_CAMPO')),
('2025-01-10', '2025-01-01', 'Adiantamento Victor Hugo', 'adiantamento_socio', 200.5, 200.5, (SELECT id FROM cost_centers WHERE code = '3.1.2 SERGIO.FILHOS.VICTOR')),
('2025-01-10', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 1.89, 1.89, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-10', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 54.81, 54.81, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-13', '2025-01-01', 'Agua Mineral - Agua Pura', 'pagamento_despesa', 187.0, 187.0, (SELECT id FROM cost_centers WHERE code = '1.14.1')),
('2025-01-13', '2025-01-01', 'Telefone Fixo VIVO', 'pagamento_despesa', 137.68, 137.68, (SELECT id FROM cost_centers WHERE code = '1.12')),
('2025-01-13', '2025-01-01', 'Material - Ampla Saude Ocupacional', 'pagamento_despesa', 21.0, 21.0, (SELECT id FROM cost_centers WHERE code = '1.21')),
('2025-01-14', '2025-01-01', 'Adiantamento Sergio Augusto', 'adiantamento_socio', 90.0, 90.0, (SELECT id FROM cost_centers WHERE code = '3. SERGIO')),
('2025-01-15', '2025-01-01', 'Manutencao Titulos - Sicredi', 'pagamento_despesa', 7.56, 7.56, (SELECT id FROM cost_centers WHERE code = '1.13.2')),
('2025-01-15', '2025-01-01', 'Telefone Celular TIM', 'pagamento_despesa', 132.17, 132.17, (SELECT id FROM cost_centers WHERE code = '1.12')),
('2025-01-15', '2025-01-01', 'Sistema PJBank', 'pagamento_despesa', 99.9, 99.9, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-15', '2025-01-01', 'Energia Eletrica - Equatorial', 'pagamento_despesa', 1569.23, 1569.23, (SELECT id FROM cost_centers WHERE code = '1.7')),
('2025-01-15', '2025-01-01', 'Sistema Veri Solucoes', 'pagamento_despesa', 418.0, 418.0, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-15', '2025-01-01', 'Sistema SITTAX', 'pagamento_despesa', 865.86, 865.86, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-15', '2025-01-01', 'Sistema AutMais', 'pagamento_despesa', 222.0, 222.0, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-15', '2025-01-01', 'Seguro - Algarte', 'pagamento_despesa', 193.92, 193.92, (SELECT id FROM cost_centers WHERE code = '1.24')),
('2025-01-15', '2025-01-01', 'Sistema NB Technology', 'pagamento_despesa', 314.55, 314.55, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-15', '2025-01-01', 'Sistema DATAUNIQUE', 'pagamento_despesa', 1410.0, 1410.0, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-15', '2025-01-01', 'Sistema Contus', 'pagamento_despesa', 777.75, 777.75, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-15', '2025-01-01', 'Energia Eletrica - Equatorial', 'pagamento_despesa', 106.23, 106.23, (SELECT id FROM cost_centers WHERE code = '1.7')),
('2025-01-15', '2025-01-01', 'Sistema CR Sistema', 'pagamento_despesa', 733.96, 733.96, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-15', '2025-01-01', 'Obras - Outsider Construtora', 'pagamento_despesa', 1500.0, 1500.0, (SELECT id FROM cost_centers WHERE code = '1.9')),
('2025-01-15', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 13.23, 13.23, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-17', '2025-01-01', 'Adiantamento Victor Hugo', 'adiantamento_socio', 311.63, 311.63, (SELECT id FROM cost_centers WHERE code = '3.1.2 SERGIO.FILHOS.VICTOR')),
('2025-01-17', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 7.56, 7.56, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-20', '2025-01-01', 'Manutencao Titulos - Sicredi', 'pagamento_despesa', 37.8, 37.8, (SELECT id FROM cost_centers WHERE code = '1.13.2')),
('2025-01-21', '2025-01-01', 'Adiantamento Nayara', 'adiantamento_socio', 411.64, 411.64, (SELECT id FROM cost_centers WHERE code = '3.1.1 SERGIO.FILHOS.NAYARA')),
('2025-01-23', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 7.56, 7.56, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-24', '2025-01-01', 'Adiantamento Nayara', 'adiantamento_socio', 311.86, 311.86, (SELECT id FROM cost_centers WHERE code = '3.1.1 SERGIO.FILHOS.NAYARA')),
('2025-01-24', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 1.89, 1.89, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-28', '2025-01-01', 'Manutencao Titulos - Sicredi', 'pagamento_despesa', 1.89, 1.89, (SELECT id FROM cost_centers WHERE code = '1.13.2')),
('2025-01-29', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 1.89, 1.89, (SELECT id FROM cost_centers WHERE code = '1.13.1')),
('2025-01-30', '2025-01-01', 'Manutencao Titulos - Sicredi', 'pagamento_despesa', 1.89, 1.89, (SELECT id FROM cost_centers WHERE code = '1.13.2')),
('2025-01-30', '2025-01-01', 'Sistema Catho (RH)', 'pagamento_despesa', 178.0, 178.0, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-30', '2025-01-01', 'Sistema Dominio - Thomson Reuters', 'pagamento_despesa', 435.45, 435.45, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-30', '2025-01-01', 'Condominio Galeria Nacional - Ampla', 'pagamento_despesa', 346.07, 346.07, (SELECT id FROM cost_centers WHERE code = '1.11')),
('2025-01-30', '2025-01-01', 'Condominio Galeria Nacional - Ampla', 'pagamento_despesa', 346.07, 346.07, (SELECT id FROM cost_centers WHERE code = '1.11')),
('2025-01-30', '2025-01-01', 'Emprestimo - Scala Contabilidade', 'adiantamento_socio', 1000.0, 1000.0, (SELECT id FROM cost_centers WHERE code = '3.4')),
('2025-01-31', '2025-01-01', 'Material Eletrico - Center Luzz', 'pagamento_despesa', 421.5, 421.5, (SELECT id FROM cost_centers WHERE code = '1.21')),
('2025-01-31', '2025-01-01', 'Anuidade CRC', 'pagamento_despesa', 597.0, 597.0, (SELECT id FROM cost_centers WHERE code = '1.18')),
('2025-01-31', '2025-01-01', 'Sistema Oneflow', 'pagamento_despesa', 138.22, 138.22, (SELECT id FROM cost_centers WHERE code = '2.1')),
('2025-01-31', '2025-01-01', 'Tarifa Boleto - Sicredi', 'pagamento_despesa', 3.78, 3.78, (SELECT id FROM cost_centers WHERE code = '1.13.1'))
ON CONFLICT DO NOTHING;

COMMENT ON TABLE accounting_entries IS 'Lancamentos Jan/2025 - 69 lancamentos automaticos do extrato.';
