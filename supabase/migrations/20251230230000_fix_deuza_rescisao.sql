-- Deuza Resende saiu em 24/01/2025
-- O valor de R$ 5.901,92 é rescisão de contrato, não salário

-- Criar centro de custo para Rescisões se não existir
INSERT INTO cost_centers (code, name, description, parent_id, is_active, center_type)
VALUES ('1.20', 'AMPLA.RESCISOES', 'Rescisões de Contrato CLT', '00bd6bcc-d0fc-4b21-8bd7-f2044ddd3c94', true, 'expenses')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Mover pagamento da Deuza para Rescisões
UPDATE accounting_entries
SET
  cost_center_id = (SELECT id FROM cost_centers WHERE code = '1.20'),
  description = 'Rescisão: DEUZA RESENDE DE JESUS - Saída 24/01/2025'
WHERE description ILIKE '%deuza%';
