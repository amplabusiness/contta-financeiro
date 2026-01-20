-- =====================================================
-- LANÇAMENTO DE SALDO DE ABERTURA - 31/12/2024
-- D - 1.1.1.02 (Banco Sicredi) R$ 90.725,10
-- C - 5.3.02.01 (Saldo de Abertura - Disponibilidades) R$ 90.725,10
-- =====================================================

DO $$
DECLARE
  v_entry_id UUID;
  v_account_banco UUID;
  v_account_saldo_abertura UUID;
  v_user_id UUID;
BEGIN
  -- Buscar IDs das contas contábeis
  SELECT id INTO v_account_banco
  FROM chart_of_accounts
  WHERE code = '1.1.1.02'; -- Banco Sicredi

  SELECT id INTO v_account_saldo_abertura
  FROM chart_of_accounts
  WHERE code = '5.3.02.01'; -- Saldo de Abertura - Disponibilidades

  -- Verificar se as contas existem
  IF v_account_banco IS NULL THEN
    RAISE EXCEPTION 'Conta contábil 1.1.1.02 (Banco Sicredi) não encontrada';
  END IF;

  IF v_account_saldo_abertura IS NULL THEN
    RAISE EXCEPTION 'Conta contábil 5.3.02.01 (Saldo de Abertura - Disponibilidades) não encontrada';
  END IF;

  -- Buscar usuário
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  -- Verificar se já existe lançamento de saldo de abertura
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE entry_date = '2024-12-31'
      AND description LIKE '%Saldo de Abertura%Sicredi%'
  ) THEN
    RAISE NOTICE 'Lançamento de saldo de abertura já existe, ignorando.';
    RETURN;
  END IF;

  -- Criar o lançamento contábil
  INSERT INTO accounting_entries (
    entry_date,
    competence_date,
    description,
    document_number,
    entry_type,
    created_by,
    total_debit,
    total_credit,
    balanced,
    notes
  ) VALUES (
    '2024-12-31',
    '2024-12-31',
    'Saldo de Abertura - Banco Sicredi',
    'ABERTURA-001',
    'MANUAL',
    v_user_id,
    90725.10,
    90725.10,
    true,
    'Lançamento de abertura conforme orientação do Contador IA. Contrapartida em Saldos de Abertura (PL).'
  )
  RETURNING id INTO v_entry_id;

  -- Inserir as linhas do lançamento
  -- DÉBITO em Banco Sicredi (aumenta o ativo)
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_entry_id,
    v_account_banco,
    90725.10,
    0,
    'Saldo de abertura - Disponibilidades em banco'
  );

  -- CRÉDITO em Saldo de Abertura (contrapartida no PL)
  INSERT INTO accounting_entry_lines (
    entry_id,
    account_id,
    debit,
    credit,
    description
  ) VALUES (
    v_entry_id,
    v_account_saldo_abertura,
    0,
    90725.10,
    'Reconhecimento do saldo inicial de disponibilidades'
  );

  RAISE NOTICE 'Lançamento de saldo de abertura criado com sucesso! Entry ID: %', v_entry_id;
END $$;
