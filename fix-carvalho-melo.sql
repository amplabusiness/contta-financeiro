-- Corrigir CARVALHO E MELO ADM. E PARTIPA AO EIRELI
-- De Pro-Bono para Cliente Pago com honorários

UPDATE clients
SET 
  is_pro_bono = false,
  monthly_fee = 301.41,
  payment_day = 10,
  pro_bono_start_date = NULL,
  pro_bono_end_date = NULL,
  pro_bono_reason = NULL,
  updated_at = NOW()
WHERE name ILIKE '%CARVALHO%MELO%'
  AND is_pro_bono = true;

-- Verificar a atualização
SELECT 
  id,
  name,
  is_pro_bono,
  monthly_fee,
  payment_day,
  status
FROM clients
WHERE name ILIKE '%CARVALHO%MELO%';
