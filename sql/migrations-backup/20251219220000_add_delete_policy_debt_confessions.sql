-- =====================================================
-- ADICIONAR POLICY DE DELETE PARA DEBT_CONFESSIONS
-- =====================================================

-- Adicionar policy de delete para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'debt_confessions'
    AND policyname = 'Users can delete confessions'
  ) THEN
    CREATE POLICY "Users can delete confessions" ON debt_confessions
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- Também adicionar para as parcelas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'debt_confession_installments'
    AND policyname = 'Users can delete installments'
  ) THEN
    CREATE POLICY "Users can delete installments" ON debt_confession_installments
      FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
