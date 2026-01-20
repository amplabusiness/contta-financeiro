-- =====================================================
-- CORREÇÃO COMPLETA DA TABELA BANK_ACCOUNTS
-- E CADASTRO DA CONTA SICREDI
-- =====================================================

-- Adicionar todas as colunas necessárias se não existirem
DO $$
BEGIN
  -- Coluna name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'name'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN name TEXT;
    UPDATE bank_accounts SET name = COALESCE(bank_name, 'Conta Bancária') WHERE name IS NULL;
  END IF;

  -- Coluna current_balance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'current_balance'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN current_balance DECIMAL(15,2) DEFAULT 0;
  END IF;

  -- Coluna initial_balance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'initial_balance'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN initial_balance DECIMAL(15,2) DEFAULT 0;
  END IF;

  -- Coluna is_active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- Coluna notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'notes'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN notes TEXT;
  END IF;

  -- Coluna created_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN created_by UUID;
  END IF;

  -- Coluna updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bank_accounts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Agora cadastrar a conta Sicredi
DO $$
DECLARE
  v_user_id UUID;
  v_existing_id UUID;
BEGIN
  -- Verificar se já existe a conta Sicredi por bank_code + account_number
  SELECT id INTO v_existing_id
  FROM bank_accounts
  WHERE bank_code = '748'
    AND account_number = '39500000000278068';

  IF v_existing_id IS NOT NULL THEN
    -- Atualizar dados existentes
    UPDATE bank_accounts
    SET
      name = 'Sicredi - Conta Principal',
      current_balance = 90725.10,
      initial_balance = 90725.10,
      notes = 'Conta principal da empresa. Agência 0395, Código Banco 748 (Sicredi). Saldo de abertura registrado em 31/12/2024.',
      updated_at = now()
    WHERE id = v_existing_id;

    RAISE NOTICE 'Conta bancária Sicredi atualizada com saldo R$ 90.725,10';
  ELSE
    -- Buscar primeiro usuário disponível
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;

    -- Inserir a conta bancária
    INSERT INTO bank_accounts (
      name,
      bank_code,
      bank_name,
      agency,
      account_number,
      account_type,
      current_balance,
      initial_balance,
      is_active,
      notes,
      created_by
    ) VALUES (
      'Sicredi - Conta Principal',
      '748',
      'Sicredi',
      '0395',
      '39500000000278068',
      'checking',
      90725.10,
      90725.10,
      true,
      'Conta principal da empresa. Agência 0395, Código Banco 748 (Sicredi). Saldo de abertura registrado em 31/12/2024.',
      v_user_id
    );

    RAISE NOTICE 'Conta bancária Sicredi cadastrada com saldo de abertura R$ 90.725,10 em 31/12/2024';
  END IF;
END $$;
