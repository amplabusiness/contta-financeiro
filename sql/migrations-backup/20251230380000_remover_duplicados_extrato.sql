-- Remover lancamentos duplicados/fantasmas que nao existem no extrato bancario
-- Auditoria completa: Extrato OFX (fonte da verdade) vs Sistema
-- Total: 60 lancamentos, R$ 349.276,35

DELETE FROM accounting_entries
WHERE id IN (
    '6a09b9f3-f6a5-456b-a1ec-785ca06d6022',  -- 2025-01-01 R$ 21.00 Material: Papelaria - Ampla
    '22538992-f328-4882-b553-cf9e04a62502',  -- 2025-01-01 R$ 2,278.62 Pagamento: Comissao - Ampla
    '855e05e7-fbb0-4684-8927-f96c9b11ce15',  -- 2025-01-02 R$ 5.78 Tarifa: Emissao de Boleto (ajuste extrato)
    'ae544b02-2c85-4ce2-85cf-42864e5931e3',  -- 2025-01-02 R$ 800.00 Pagamento: Antonio Leandro - Personal
    '3b4acf8b-cc27-480a-bc43-fbd68bb1d041',  -- 2025-01-02 R$ 800.00 Adiantamento: Antonio Leandro - Personal - Sergio
    'e8dda6dc-ca4e-49ca-bbe0-2abc5f5971cb',  -- 2025-01-02 R$ 800.00 Pagamento: Antonio Leandro - Personal
    'e0773ef8-643a-44e8-8bba-d6b23dc13dc5',  -- 2025-01-06 R$ 9.45 Tarifa: Emissao de Boleto
    '2abcc958-baa0-45f7-9eb8-61c0cb81eb12',  -- 2025-01-06 R$ 3,800.00 Pagamento: FABRICIO SOARES BOMFIM
    '549f0dc4-8fe1-4599-9a7b-21c753bd1cef',  -- 2025-01-07 R$ 380.00 Pagamento: Vonoria Amelia da Conc
    '19577ef5-0892-4bad-b387-ace25ed07ebb',  -- 2025-01-08 R$ 70,000.00 Pagamento: AMPLA CONTABILIDADE
    '74eb0a87-d5ce-4b51-b42d-299c50c208cc',  -- 2025-01-10 R$ 81.45 Copa: Pao de Queijo e Cha - Ampla
    '8130cc9d-59a0-4fb2-9e7d-d28739aa4a08',  -- 2025-01-10 R$ 121.25 Pagamento: Gas - Sergio
    'df6d57b9-6dc4-4585-a628-71ee4cc245f6',  -- 2025-01-10 R$ 137.68 Pagamento: Telefone Fixo - Ampla
    '75807204-5122-4c76-98cd-c5b449ceda2c',  -- 2025-01-10 R$ 181.96 Pagamento: Telefone Celular - Ampla
    '4babc567-d4e1-410b-bc2e-36a8f944ad41',  -- 2025-01-10 R$ 291.79 Pagamento: Cafe - Ampla
    '2cd8835e-b03e-4c4f-a604-853a74befff8',  -- 2025-01-10 R$ 326.09 Pagamento: Internet - Ampla
    '3964fc4a-90fb-417a-ac77-387a80b1d40b',  -- 2025-01-10 R$ 399.51 Pagamento: Tharson Diego - Reforma Casa
    '5b6badd2-2a6e-4137-b27d-6c078343dbc7',  -- 2025-01-10 R$ 756.23 Pagamento: Material de Limpeza - Ampla
    'c3eb880c-031f-4281-a1a3-2ba8872acd51',  -- 2025-01-10 R$ 1,000.00 Pagamento: Emprestimos - Scala
    'a72425bf-c1b0-41f3-8041-46b39da64181',  -- 2025-01-10 R$ 1,000.00 Pagamento: Emprestimos - Scala
    '110a9f70-c611-40d8-9f2c-dc00b26a24cc',  -- 2025-01-10 R$ 1,000.00 Adiantamento: Emprestimos - Scala
    'aa1c47e6-e531-4f51-a04f-dfb5fcbe6e21',  -- 2025-01-10 R$ 1,127.59 Pagamento: Condominio Galeria Nacional
    '511af2b5-202b-4138-ae11-9a5087a51999',  -- 2025-01-10 R$ 1,127.59 Pagamento: Condominio Galeria Nacional
    'bd55bbcc-bb65-4381-b731-b96ad29f761b',  -- 2025-01-10 R$ 1,723.80 Pagamento: Obras Lago - Sergio
    '74aeb59d-9fa4-4995-bf59-2f5e75169453',  -- 2025-01-10 R$ 1,723.80 Pagamento: Obras Lago - Jan/2025
    '11baca71-c2eb-4183-b16f-5a3ccb5df42c',  -- 2025-01-10 R$ 2,114.77 Adiantamento: Baba - Nayara
    'dc053e74-a9c2-4c82-a37f-498a90b11bfd',  -- 2025-01-10 R$ 2,114.77 Pagamento: Baba - Nayara
    '58f3d1ca-b676-4190-9785-788562435850',  -- 2025-01-10 R$ 2,114.77 Pagamento: Baba - Nayara
    '088af57f-f878-459b-8277-07ec0d8c4651',  -- 2025-01-10 R$ 2,323.28 Pagamento: INSS e IRRF - Ampla
    '2799c090-eb77-4222-a3c1-a5813e2a18f1',  -- 2025-01-10 R$ 3,047.13 Pagamento: Condominio Mundi
    '1ad8cc35-b2a6-4bfd-a7c7-9237d85ecf4d',  -- 2025-01-10 R$ 3,047.13 Pagamento: Condominio Mundi
    '2b15a4c2-6b7c-4c60-913a-78ecfcea83ed',  -- 2025-01-10 R$ 3,931.86 Pagamento: Condominio Lago
    '505a8a81-ebc2-44ed-9522-b2fc73cc172b',  -- 2025-01-10 R$ 3,931.86 Pagamento: Condominio Lago
    '63f195f3-ba44-4484-a548-2481fd31ec14',  -- 2025-01-10 R$ 4,295.62 Pagamento: Plano de Saude - Sergio
    '040e4d3e-6ce0-4542-8373-54a7639648d1',  -- 2025-01-10 R$ 5,731.03 Pagamento: Nayara - Adiantamento
    'ab71e9d5-dda8-46b9-a711-ac09796828c0',  -- 2025-01-10 R$ 5,731.03 Pagamento: Nayara - Adiantamento
    '3e67e669-15b0-4de9-a985-41da1a202238',  -- 2025-01-10 R$ 6,504.53 Pagamento: Victor Hugo - Adiantamento
    'fefa9eb2-8c72-4c30-a302-2b4eb37ea782',  -- 2025-01-10 R$ 6,504.53 Pagamento: Victor Hugo - Adiantamento
    '471a7df4-9720-45f1-b28b-31e9b8c3294d',  -- 2025-01-10 R$ 6,504.53 Adiantamento: Victor Hugo - Adiantamento
    'cdb8c754-9695-4d47-a236-1f6922a683ad',  -- 2025-01-10 R$ 18,257.04 Pagamento: Sergio Augusto - Adiantament
    '838a6847-a152-4645-8257-b75f38fd60b7',  -- 2025-01-10 R$ 18,257.04 Pagamento: Sergio Augusto - Adiantament
    '4c07f150-6f6f-4b81-be19-25b1aeb910f7',  -- 2025-01-10 R$ 18,257.04 Adiantamento: Sergio Augusto - Adiantamento
    '6cf6d0c4-df97-4b9e-8063-627aebb62314',  -- 2025-01-10 R$ 26,000.00 Pagamento: Outsider Construtora - Ampla
    '542d3c29-7669-4b72-a1d9-82c1f288c067',  -- 2025-01-13 R$ 5,756.25 Pagamento: FATURA MENSAL-096541455
    '1169265c-0986-44b3-bbb5-c50b16aaa488',  -- 2025-01-13 R$ 5,756.25 Adiantamento: FATURA MENSAL-096541455
    '83f28d43-619a-4a80-a50d-acc2c68646ac',  -- 2025-01-15 R$ 149.20 Tarifa: Emissao de Boleto
    '32337b98-8260-418c-97e3-32c33dc53b88',  -- 2025-01-15 R$ 1,675.46 Pagamento: Energia - Ampla
    'ba9afc94-fbf7-4162-ae74-4a8b38e0455c',  -- 2025-01-20 R$ 62.37 Tarifa: Manutencao de Titulos em Aberto
    'a7c44158-9531-4683-9365-041aead7dcb5',  -- 2025-01-22 R$ 73,827.26 Pagamento: AMPLA CONTABILIDADE
    '270704b4-853c-4ebb-ba62-ee4bf9ae9bee',  -- 2025-01-24 R$ 868.11 Pagamento: Energia - Sergio
    '914107d0-b583-4c44-9289-6e1417dec38e',  -- 2025-01-29 R$ 210.00 Pagamento: Vonoria Amelia da Conc
    'bdf1a9c2-2657-4465-bcfb-97f38d8490be',  -- 2025-01-30 R$ 311.63 Adiantamento: adiantamento Nayara
    '09ba06fd-114a-48b5-874a-897c48c12f6d',  -- 2025-01-30 R$ 311.86 Adiantamento: adiantamento Nayara
    'e49ab8d8-629d-4d70-929c-56c44dc2981c',  -- 2025-01-30 R$ 328.00 Adiantamento: adiantamento Nayara
    '90c3d2f2-119b-43ad-90aa-1e9baf7f45a8',  -- 2025-01-30 R$ 402.88 Adiantamento: adiantamento Nayara
    '61d65492-fa4b-488b-a9f5-2ed9be0b5d48',  -- 2025-01-30 R$ 411.64 Adiantamento: adiantamento Nayara
    'fa535476-db02-49af-9af1-13f759cbb0b7',  -- 2025-01-30 R$ 1,461.98 Adiantamento: adiantamento Victor
    '35636541-07aa-4c2c-a477-5cd6fc2ce7b0',  -- 2025-01-30 R$ 4,893.00 Adiantamento: adiantamento Nayara
    '24d258be-fae5-42ba-b743-28d00ec24858',  -- 2025-01-30 R$ 10,590.90 Adiantamento: adiantamento Nayara
    '8c35a2ed-61e4-4f8b-b234-7046be6c2843'   -- 2025-01-30 R$ 13,698.01 Adiantamento: adiantamento Sergio
);

COMMENT ON TABLE accounting_entries IS 'Lancamentos Jan/2025 - Auditoria com extrato bancario: 60 duplicados removidos.';
