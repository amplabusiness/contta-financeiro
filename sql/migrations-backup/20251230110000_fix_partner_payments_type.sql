-- Corrigir entry_type de lançamentos pessoais do sócio e filhos
-- Esses são adiantamentos a sócios, não despesas da Ampla
-- Não devem aparecer no DRE de despesas

-- Centros de custo pessoais do Sergio e família:
-- 40d9d6ae-6b72-4744-a400-a29dc3b71b55 = 3. SERGIO
-- 9f4a0624-88df-4650-9056-2364f40bd5ad = 3.1.1 NAYARA
-- 2f4d4958-7f65-43d4-94f7-9e94a63d3091 = 3.1.2 VICTOR
-- 5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d = 3.1.3 SERGIO AUGUSTO
-- f8a40a16-7555-4e0e-a67f-8736fb7ef21e = 3.2.1 CASA DO LAGO
-- 49b9cc90-9d24-479a-a770-06b669b961a1 = 3.2.4 GALERIA NACIONAL
-- ad2ac6be-1936-44ff-a7f0-02183daa640a = 3.2.2 VILA ABAJA
-- bb8086b3-7980-4c53-bd30-499a63e39c39 = 3.2.3 BALNEARIO MEIA PONTE

UPDATE accounting_entries
SET entry_type = 'adiantamento_socio'
WHERE entry_type IN ('despesa', 'pagamento_despesa')
AND cost_center_id IN (
  '40d9d6ae-6b72-4744-a400-a29dc3b71b55',
  '9f4a0624-88df-4650-9056-2364f40bd5ad',
  '2f4d4958-7f65-43d4-94f7-9e94a63d3091',
  '5b8a1d97-8d14-4fff-8b2e-d28ed06e8e3d',
  'f8a40a16-7555-4e0e-a67f-8736fb7ef21e',
  '49b9cc90-9d24-479a-a770-06b669b961a1',
  'ad2ac6be-1936-44ff-a7f0-02183daa640a',
  'bb8086b3-7980-4c53-bd30-499a63e39c39'
);

COMMENT ON TABLE accounting_entries IS 'Lançamentos contábeis. Tipos: despesa/pagamento_despesa = DRE, adiantamento_socio = Ativo, transferencia_interna = não aparece, passivo_obrigacao = Passivo';
