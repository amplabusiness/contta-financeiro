-- ==========================================
-- EXECUTE NO BANCO ANTIGO (LOVABLE)
-- ==========================================

-- Exportar lista de CNPJs com dados básicos
SELECT 
  cnpj,
  name,
  email,
  phone,
  monthly_fee,
  fee_due_day,
  is_active
FROM clients
WHERE cnpj IS NOT NULL
ORDER BY name;

-- Copie o resultado e me envie
-- Ou clique em "Download as CSV"
