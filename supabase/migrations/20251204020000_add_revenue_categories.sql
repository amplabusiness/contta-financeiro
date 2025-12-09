-- =====================================================
-- ADD MISSING COLUMNS TO expense_categories
-- =====================================================

ALTER TABLE expense_categories 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6',
ADD COLUMN IF NOT EXISTS icon TEXT,
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- =====================================================
-- CREATE revenue_categories TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS revenue_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#10B981',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE revenue_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for revenue_categories
DROP POLICY IF EXISTS "Users can manage revenue_categories" ON revenue_categories;
CREATE POLICY "Users can manage revenue_categories" ON revenue_categories
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_revenue_categories_display_order 
ON revenue_categories(display_order);

CREATE INDEX IF NOT EXISTS idx_expense_categories_display_order 
ON expense_categories(display_order);

-- =====================================================
-- INSERT DEFAULT REVENUE CATEGORIES
-- =====================================================

INSERT INTO revenue_categories (code, name, description, color, icon, display_order, is_active)
VALUES
  ('REV_SERVICES', 'Serviços Profissionais', 'Receita de serviços de contabilidade e consultoria', '#10B981', 'Briefcase', 1, true),
  ('REV_PRODUCTS', 'Venda de Produtos', 'Receita de venda de produtos', '#06B6D4', 'ShoppingCart', 2, true),
  ('REV_CONSULTING', 'Consultoria', 'Receita de consultoria especializada', '#F59E0B', 'Lightbulb', 3, true),
  ('REV_TRAINING', 'Treinamento', 'Receita de treinamento e cursos', '#8B5CF6', 'BookOpen', 4, true),
  ('REV_OTHER', 'Outras Receitas', 'Outras receitas diversas', '#6B7280', 'DollarSign', 5, true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- LOGGING
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ REVENUE_CATEGORIES E EXPENSE_CATEGORIES ATUALIZADOS';
  RAISE NOTICE '';
  RAISE NOTICE 'Mudanças aplicadas:';
  RAISE NOTICE '  1. Coluna color adicionada a expense_categories';
  RAISE NOTICE '  2. Coluna icon adicionada a expense_categories';
  RAISE NOTICE '  3. Coluna display_order adicionada a expense_categories';
  RAISE NOTICE '  4. Tabela revenue_categories criada';
  RAISE NOTICE '  5. Categorias de receita padrão inseridas';
  RAISE NOTICE '';
  RAISE NOTICE 'Categorias de Receita criadas:';
  RAISE NOTICE '  • Serviços Profissionais (#10B981)';
  RAISE NOTICE '  • Venda de Produtos (#06B6D4)';
  RAISE NOTICE '  • Consultoria (#F59E0B)';
  RAISE NOTICE '  • Treinamento (#8B5CF6)';
  RAISE NOTICE '  • Outras Receitas (#6B7280)';
  RAISE NOTICE '';
END $$;
