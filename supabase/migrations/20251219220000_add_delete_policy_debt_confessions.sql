-- =====================================================
-- ADICIONAR POLICY DE DELETE PARA DEBT_CONFESSIONS
-- =====================================================

-- Adicionar policy de delete para usuários autenticados
CREATE POLICY IF NOT EXISTS "Users can delete confessions" ON debt_confessions
  FOR DELETE TO authenticated USING (true);

-- Também adicionar para as parcelas
CREATE POLICY IF NOT EXISTS "Users can delete installments" ON debt_confession_installments
  FOR DELETE TO authenticated USING (true);
