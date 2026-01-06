SELECT 
  ae.description,
  ae.total_debit,
  ae.entry_date,
  ae.entry_type,
  cc.code as cost_center_code,
  cc.name as cost_center_name
FROM accounting_entries ae
LEFT JOIN cost_centers cc ON ae.cost_center_id = cc.id
WHERE ae.description ILIKE ANY(ARRAY[
  '%amanda%', '%jordana%', '%lilian%',
  '%josimar%', '%thaynara%',
  '%deuza%', '%erick%', '%jessyca%', '%luciana%', '%luciane%', '%thaniny%',
  '%claudia%', '%fabiana%', '%raimundo%',
  '%alexssandra%', '%aline%', '%rose%', '%tatiana%',
  '%taylane%', '%sueli%'
])
ORDER BY ae.description;
