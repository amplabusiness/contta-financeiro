-- Enforce unique CNPJ normalized (digits only) without changing nullability
CREATE UNIQUE INDEX IF NOT EXISTS clients_cnpj_normalized_unique
ON public.clients ((regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g')))
WHERE cnpj IS NOT NULL AND length(trim(cnpj)) > 0;