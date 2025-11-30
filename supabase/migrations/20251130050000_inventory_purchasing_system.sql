-- =====================================================
-- SISTEMA DE CONTROLE DE ESTOQUE E COMPRAS
-- Para material de limpeza, café, escritório, etc.
-- =====================================================

-- =====================================================
-- 1. PRODUTOS DO ESCRITÓRIO
-- =====================================================

CREATE TABLE IF NOT EXISTS office_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  code TEXT UNIQUE, -- Código interno (ex: LIMP001)
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT, -- Marca preferida

  -- Categoria
  category TEXT NOT NULL, -- limpeza, alimentacao, escritorio, higiene
  subcategory TEXT, -- detergente, café, papel, etc.

  -- Unidade e quantidade
  unit TEXT NOT NULL, -- unidade, litro, kg, pacote, caixa, rolo
  package_size DECIMAL(10,2), -- Tamanho da embalagem (ex: 500ml, 1kg)

  -- Estoque
  minimum_stock DECIMAL(10,2) DEFAULT 1, -- Estoque mínimo para alerta
  ideal_stock DECIMAL(10,2) DEFAULT 3, -- Estoque ideal
  current_stock DECIMAL(10,2) DEFAULT 0,

  -- Consumo
  average_weekly_consumption DECIMAL(10,2), -- Consumo médio semanal
  average_monthly_consumption DECIMAL(10,2), -- Consumo médio mensal

  -- Preço
  last_price DECIMAL(15,2), -- Último preço pago
  last_price_date DATE, -- Data do último preço
  average_price DECIMAL(15,2), -- Preço médio

  -- Fornecedor preferencial
  preferred_supplier TEXT, -- Nome do fornecedor (ex: Atacadão, Bretas)

  -- Observações
  notes TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE office_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage office_products" ON office_products;
CREATE POLICY "Users can manage office_products" ON office_products
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 2. HISTÓRICO DE COMPRAS
-- =====================================================

CREATE TABLE IF NOT EXISTS product_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES office_products(id) ON DELETE CASCADE,

  -- Compra
  purchase_date DATE NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,

  -- Fornecedor
  supplier TEXT,

  -- Nota fiscal
  invoice_number TEXT,
  invoice_file_url TEXT,

  -- Quem comprou
  purchased_by TEXT,

  -- Observações
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage product_purchases" ON product_purchases;
CREATE POLICY "Users can manage product_purchases" ON product_purchases
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 3. CONSUMO/BAIXA DE ESTOQUE
-- =====================================================

CREATE TABLE IF NOT EXISTS product_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES office_products(id) ON DELETE CASCADE,

  consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity DECIMAL(10,2) NOT NULL,

  -- Quem registrou
  registered_by TEXT,

  -- Motivo (uso normal, perda, vencimento)
  reason TEXT DEFAULT 'uso_normal',

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_consumption ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage product_consumption" ON product_consumption;
CREATE POLICY "Users can manage product_consumption" ON product_consumption
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 4. LISTA DE COMPRAS (ORÇAMENTO)
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  list_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,

  -- Datas
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  needed_by_date DATE, -- Data limite para compra

  -- Status
  status TEXT DEFAULT 'draft', -- draft, pending_quote, quoted, approved, purchased, cancelled

  -- Responsáveis
  created_by TEXT,
  assigned_to TEXT, -- Quem vai fazer a cotação
  approved_by TEXT,

  -- Valores
  estimated_total DECIMAL(15,2),
  quoted_total DECIMAL(15,2),
  actual_total DECIMAL(15,2),

  -- Observações
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchase_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage purchase_lists" ON purchase_lists;
CREATE POLICY "Users can manage purchase_lists" ON purchase_lists
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 5. ITENS DA LISTA DE COMPRAS
-- =====================================================

CREATE TABLE IF NOT EXISTS purchase_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES purchase_lists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES office_products(id),

  -- Item (pode ser produto cadastrado ou item avulso)
  product_name TEXT NOT NULL,
  brand TEXT, -- Marca sugerida

  -- Quantidade
  quantity DECIMAL(10,2) NOT NULL,
  unit TEXT,

  -- Preços
  last_price DECIMAL(15,2), -- Último preço pago (referência)
  estimated_price DECIMAL(15,2), -- Preço estimado
  quoted_price DECIMAL(15,2), -- Preço cotado
  actual_price DECIMAL(15,2), -- Preço final pago

  -- Fornecedor
  suggested_supplier TEXT, -- Fornecedor sugerido
  quoted_supplier TEXT, -- Fornecedor da cotação

  -- Status do item
  status TEXT DEFAULT 'pending', -- pending, quoted, purchased, unavailable

  -- Prioridade
  priority TEXT DEFAULT 'normal', -- urgent, high, normal, low

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE purchase_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage purchase_list_items" ON purchase_list_items;
CREATE POLICY "Users can manage purchase_list_items" ON purchase_list_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 6. FORNECEDORES
-- =====================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  trading_name TEXT, -- Nome fantasia
  cnpj TEXT,

  -- Contato
  phone TEXT,
  email TEXT,
  contact_person TEXT,

  -- Endereço
  address TEXT,
  city TEXT,

  -- Categorias que fornece
  categories TEXT[], -- ['limpeza', 'alimentacao', 'escritorio']

  -- Avaliação
  rating INTEGER, -- 1-5 estrelas
  notes TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage suppliers" ON suppliers;
CREATE POLICY "Users can manage suppliers" ON suppliers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- POPULAR PRODUTOS DE LIMPEZA E ESCRITÓRIO
-- =====================================================

DO $$
BEGIN
  -- PRODUTOS DE LIMPEZA
  INSERT INTO office_products (code, name, brand, category, subcategory, unit, package_size, minimum_stock, ideal_stock, preferred_supplier, notes) VALUES
    -- Limpeza geral
    ('LIMP001', 'Detergente Líquido', 'Ypê', 'limpeza', 'detergente', 'unidade', 500, 2, 6, 'Atacadão', 'Para lavar louças da copa'),
    ('LIMP002', 'Desinfetante', 'Pinho Sol', 'limpeza', 'desinfetante', 'unidade', 500, 2, 4, 'Atacadão', 'Para limpeza de banheiros'),
    ('LIMP003', 'Água Sanitária', 'Qboa', 'limpeza', 'sanitizante', 'unidade', 1000, 1, 3, 'Atacadão', NULL),
    ('LIMP004', 'Sabão em Pó', 'Omo', 'limpeza', 'sabao', 'unidade', 1000, 1, 2, 'Atacadão', 'Para limpeza de panos'),
    ('LIMP005', 'Limpa Vidro', 'Veja', 'limpeza', 'multiuso', 'unidade', 500, 1, 2, 'Atacadão', NULL),
    ('LIMP006', 'Multiuso', 'Veja', 'limpeza', 'multiuso', 'unidade', 500, 2, 4, 'Atacadão', 'Limpeza de mesas e superfícies'),
    ('LIMP007', 'Álcool 70%', 'Tupi', 'limpeza', 'sanitizante', 'unidade', 1000, 2, 6, 'Atacadão', 'Higienização geral'),
    ('LIMP008', 'Lustra Móveis', 'Poliflor', 'limpeza', 'moveis', 'unidade', 200, 1, 2, 'Atacadão', NULL),

    -- Utensílios de limpeza
    ('LIMP010', 'Esponja Dupla Face', 'Scotch-Brite', 'limpeza', 'utensilios', 'pacote', 3, 2, 4, 'Atacadão', 'Pacote com 3 unidades'),
    ('LIMP011', 'Pano de Chão', 'Alklin', 'limpeza', 'utensilios', 'unidade', 1, 2, 4, 'Atacadão', NULL),
    ('LIMP012', 'Pano Multiuso', 'Perfex', 'limpeza', 'utensilios', 'rolo', 50, 1, 2, 'Atacadão', 'Rolo com 50 panos'),
    ('LIMP013', 'Saco de Lixo 50L', 'Dover', 'limpeza', 'descartaveis', 'pacote', 50, 2, 4, 'Atacadão', 'Pacote com 50 sacos'),
    ('LIMP014', 'Saco de Lixo 100L', 'Dover', 'limpeza', 'descartaveis', 'pacote', 50, 1, 2, 'Atacadão', 'Pacote com 50 sacos'),
    ('LIMP015', 'Luva de Limpeza', 'Sanro', 'limpeza', 'utensilios', 'par', 1, 2, 4, 'Atacadão', 'Tamanho M'),

    -- Higiene banheiro
    ('HIG001', 'Papel Higiênico', 'Neve', 'higiene', 'papel', 'pacote', 12, 2, 4, 'Atacadão', 'Pacote com 12 rolos'),
    ('HIG002', 'Papel Toalha', 'Snob', 'higiene', 'papel', 'pacote', 2, 2, 4, 'Atacadão', 'Pacote com 2 rolos'),
    ('HIG003', 'Sabonete Líquido', 'Lux', 'higiene', 'sabonete', 'unidade', 250, 2, 4, 'Atacadão', 'Refil para dispenser'),

    -- Copa/Alimentação
    ('ALIM001', 'Café em Pó', 'Melitta', 'alimentacao', 'cafe', 'unidade', 500, 2, 4, 'Atacadão', 'Tradicional 500g'),
    ('ALIM002', 'Açúcar Refinado', 'União', 'alimentacao', 'acucar', 'kg', 1, 1, 2, 'Atacadão', NULL),
    ('ALIM003', 'Adoçante', 'Zero Cal', 'alimentacao', 'adocante', 'unidade', 100, 1, 2, 'Atacadão', 'Gotas 100ml'),
    ('ALIM004', 'Leite em Pó', 'Ninho', 'alimentacao', 'leite', 'unidade', 400, 1, 2, 'Atacadão', NULL),
    ('ALIM005', 'Bolacha Cream Cracker', 'Bauducco', 'alimentacao', 'bolacha', 'pacote', 400, 2, 4, 'Atacadão', NULL),
    ('ALIM006', 'Bolacha Recheada', 'Oreo', 'alimentacao', 'bolacha', 'pacote', 144, 2, 4, 'Atacadão', NULL),
    ('ALIM007', 'Filtro de Papel p/ Café', 'Melitta', 'alimentacao', 'cafe', 'caixa', 40, 1, 2, 'Atacadão', 'Caixa com 40 filtros'),
    ('ALIM008', 'Copo Descartável 180ml', 'Copoplast', 'alimentacao', 'descartaveis', 'pacote', 100, 2, 4, 'Atacadão', 'Pacote com 100 copos'),
    ('ALIM009', 'Copo Descartável 50ml', 'Copoplast', 'alimentacao', 'descartaveis', 'pacote', 100, 2, 4, 'Atacadão', 'Para café'),
    ('ALIM010', 'Água Mineral', 'Indaiá', 'alimentacao', 'agua', 'galao', 20, 1, 2, 'Disk Água', 'Galão 20L'),

    -- Escritório
    ('ESC001', 'Papel A4', 'Chamex', 'escritorio', 'papel', 'resma', 500, 2, 5, 'Kalunga', 'Resma 500 folhas'),
    ('ESC002', 'Caneta Esferográfica Azul', 'Bic', 'escritorio', 'caneta', 'unidade', 1, 5, 10, 'Kalunga', NULL),
    ('ESC003', 'Caneta Esferográfica Preta', 'Bic', 'escritorio', 'caneta', 'unidade', 1, 5, 10, 'Kalunga', NULL),
    ('ESC004', 'Lápis Preto', 'Faber-Castell', 'escritorio', 'lapis', 'unidade', 1, 5, 10, 'Kalunga', NULL),
    ('ESC005', 'Borracha', 'Faber-Castell', 'escritorio', 'borracha', 'unidade', 1, 3, 5, 'Kalunga', NULL),
    ('ESC006', 'Grampeador', 'Tris', 'escritorio', 'grampeador', 'unidade', 1, 1, 2, 'Kalunga', NULL),
    ('ESC007', 'Grampo 26/6', 'ACC', 'escritorio', 'grampo', 'caixa', 5000, 2, 4, 'Kalunga', 'Caixa com 5000 grampos'),
    ('ESC008', 'Clips', 'ACC', 'escritorio', 'clips', 'caixa', 100, 2, 4, 'Kalunga', 'Caixa com 100 clips');

  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'PRODUTOS CADASTRADOS COM SUCESSO!';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'LIMPEZA: 15 produtos';
  RAISE NOTICE '  - Detergente, Desinfetante, Água Sanitária';
  RAISE NOTICE '  - Multiuso, Álcool 70%%, Lustra Móveis';
  RAISE NOTICE '  - Esponjas, Panos, Sacos de Lixo, Luvas';
  RAISE NOTICE '';
  RAISE NOTICE 'HIGIENE: 3 produtos';
  RAISE NOTICE '  - Papel Higiênico, Papel Toalha, Sabonete';
  RAISE NOTICE '';
  RAISE NOTICE 'ALIMENTAÇÃO: 10 produtos';
  RAISE NOTICE '  - Café, Açúcar, Adoçante, Leite em Pó';
  RAISE NOTICE '  - Bolachas, Filtro de Café';
  RAISE NOTICE '  - Copos Descartáveis, Água Mineral';
  RAISE NOTICE '';
  RAISE NOTICE 'ESCRITÓRIO: 8 produtos';
  RAISE NOTICE '  - Papel A4, Canetas, Lápis, Borracha';
  RAISE NOTICE '  - Grampeador, Grampos, Clips';
  RAISE NOTICE '=====================================================';
END $$;

-- Cadastrar fornecedores
INSERT INTO suppliers (name, categories, city, notes) VALUES
  ('Atacadão', ARRAY['limpeza', 'alimentacao', 'higiene'], 'Goiânia', 'Atacado - bom preço para compras em quantidade'),
  ('Bretas', ARRAY['limpeza', 'alimentacao', 'higiene'], 'Goiânia', 'Supermercado - compras de emergência'),
  ('Kalunga', ARRAY['escritorio'], 'Goiânia', 'Papelaria - material de escritório'),
  ('Disk Água Indaiá', ARRAY['alimentacao'], 'Goiânia', 'Entrega de galões de água');

-- =====================================================
-- VIEW PARA PRODUTOS COM ESTOQUE BAIXO
-- =====================================================

CREATE OR REPLACE VIEW vw_low_stock_products AS
SELECT
  p.id,
  p.code,
  p.name,
  p.brand,
  p.category,
  p.current_stock,
  p.minimum_stock,
  p.ideal_stock,
  p.unit,
  p.last_price,
  p.last_price_date,
  p.preferred_supplier,
  -- Quantidade a comprar
  GREATEST(0, p.ideal_stock - p.current_stock) AS quantity_to_buy,
  -- Valor estimado
  ROUND(GREATEST(0, p.ideal_stock - p.current_stock) * COALESCE(p.last_price, 0), 2) AS estimated_value,
  -- Prioridade
  CASE
    WHEN p.current_stock <= 0 THEN 'URGENTE'
    WHEN p.current_stock < p.minimum_stock THEN 'ALTO'
    WHEN p.current_stock < p.ideal_stock THEN 'NORMAL'
    ELSE 'OK'
  END AS priority
FROM office_products p
WHERE p.is_active = true
  AND p.current_stock < p.ideal_stock
ORDER BY
  CASE
    WHEN p.current_stock <= 0 THEN 1
    WHEN p.current_stock < p.minimum_stock THEN 2
    ELSE 3
  END,
  p.category,
  p.name;

COMMENT ON VIEW vw_low_stock_products IS 'Produtos com estoque abaixo do ideal - para gerar lista de compras';

-- =====================================================
-- VIEW PARA HISTÓRICO DE PREÇOS
-- =====================================================

CREATE OR REPLACE VIEW vw_product_price_history AS
SELECT
  p.id AS product_id,
  p.code,
  p.name,
  p.brand,
  pp.purchase_date,
  pp.quantity,
  pp.unit_price,
  pp.supplier,
  -- Variação de preço
  LAG(pp.unit_price) OVER (PARTITION BY p.id ORDER BY pp.purchase_date) AS previous_price,
  ROUND(
    (pp.unit_price - LAG(pp.unit_price) OVER (PARTITION BY p.id ORDER BY pp.purchase_date)) /
    NULLIF(LAG(pp.unit_price) OVER (PARTITION BY p.id ORDER BY pp.purchase_date), 0) * 100, 2
  ) AS price_change_percent
FROM office_products p
JOIN product_purchases pp ON p.id = pp.product_id
ORDER BY p.name, pp.purchase_date DESC;

COMMENT ON VIEW vw_product_price_history IS 'Histórico de preços com variação percentual';

-- =====================================================
-- FUNÇÃO PARA GERAR LISTA DE COMPRAS AUTOMÁTICA
-- =====================================================

CREATE OR REPLACE FUNCTION generate_shopping_list(p_created_by TEXT DEFAULT 'Sistema')
RETURNS UUID AS $$
DECLARE
  v_list_id UUID;
  v_product RECORD;
  v_estimated_total DECIMAL := 0;
BEGIN
  -- Criar lista de compras
  INSERT INTO purchase_lists (title, description, status, created_by, needed_by_date)
  VALUES (
    'Lista de Compras ' || TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY'),
    'Lista gerada automaticamente baseada no estoque mínimo',
    'pending_quote',
    p_created_by,
    CURRENT_DATE + INTERVAL '7 days'
  )
  RETURNING id INTO v_list_id;

  -- Adicionar produtos com estoque baixo
  FOR v_product IN
    SELECT * FROM vw_low_stock_products WHERE priority IN ('URGENTE', 'ALTO', 'NORMAL')
  LOOP
    INSERT INTO purchase_list_items (
      list_id, product_id, product_name, brand, quantity, unit,
      last_price, estimated_price, suggested_supplier, priority
    ) VALUES (
      v_list_id,
      v_product.id,
      v_product.name,
      v_product.brand,
      v_product.quantity_to_buy,
      v_product.unit,
      v_product.last_price,
      v_product.last_price,
      v_product.preferred_supplier,
      v_product.priority
    );

    v_estimated_total := v_estimated_total + COALESCE(v_product.estimated_value, 0);
  END LOOP;

  -- Atualizar total estimado
  UPDATE purchase_lists SET estimated_total = v_estimated_total WHERE id = v_list_id;

  RETURN v_list_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_shopping_list IS 'Gera lista de compras automaticamente baseada no estoque';

-- =====================================================
-- TRIGGER PARA ATUALIZAR ESTOQUE E PREÇO
-- =====================================================

-- Trigger para atualizar estoque após compra
CREATE OR REPLACE FUNCTION update_stock_after_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar estoque atual
  UPDATE office_products
  SET
    current_stock = current_stock + NEW.quantity,
    last_price = NEW.unit_price,
    last_price_date = NEW.purchase_date,
    updated_at = now()
  WHERE id = NEW.product_id;

  -- Recalcular preço médio
  UPDATE office_products
  SET average_price = (
    SELECT ROUND(AVG(unit_price), 2)
    FROM product_purchases
    WHERE product_id = NEW.product_id
  )
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock_after_purchase ON product_purchases;
CREATE TRIGGER trg_update_stock_after_purchase
  AFTER INSERT ON product_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_after_purchase();

-- Trigger para atualizar estoque após consumo
CREATE OR REPLACE FUNCTION update_stock_after_consumption()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE office_products
  SET
    current_stock = GREATEST(0, current_stock - NEW.quantity),
    updated_at = now()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock_after_consumption ON product_consumption;
CREATE TRIGGER trg_update_stock_after_consumption
  AFTER INSERT ON product_consumption
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_after_consumption();

-- =====================================================
-- ATUALIZAR FUNCIONÁRIO FAXINEIRA COM NOME CORRETO
-- =====================================================

UPDATE employees
SET
  name = 'Lilian',
  description = 'Faxineira do escritório. Responsável pela limpeza e manutenção das dependências. Controla uso de produtos de limpeza.',
  payment_patterns = 'LILIAN, FAXINEIRA, LIMPEZA'
WHERE name = 'Faxineira'
  AND department = 'Administrativo';

-- Se não existir, inserir
INSERT INTO employees (
  company_id, name, department, role, contract_type,
  description, payment_patterns, labor_risk_notes
)
SELECT
  cp.id,
  'Lilian',
  'Administrativo',
  'Faxineira',
  'Autônomo',
  'Faxineira do escritório. Responsável pela limpeza e manutenção das dependências. Controla uso de produtos de limpeza.',
  'LILIAN, FAXINEIRA, LIMPEZA',
  'Verificar frequência de trabalho. Se for mais de 2x por semana de forma regular, considerar registro CLT.'
FROM company_profile cp
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Lilian')
LIMIT 1;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'SISTEMA DE ESTOQUE E COMPRAS CRIADO!';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  - office_products (36 produtos cadastrados)';
  RAISE NOTICE '  - product_purchases (histórico de compras)';
  RAISE NOTICE '  - product_consumption (registro de uso)';
  RAISE NOTICE '  - purchase_lists (listas de compras)';
  RAISE NOTICE '  - purchase_list_items (itens das listas)';
  RAISE NOTICE '  - suppliers (fornecedores)';
  RAISE NOTICE '';
  RAISE NOTICE 'Views criadas:';
  RAISE NOTICE '  - vw_low_stock_products (estoque baixo)';
  RAISE NOTICE '  - vw_product_price_history (histórico de preços)';
  RAISE NOTICE '';
  RAISE NOTICE 'Funcao para gerar lista automatica:';
  RAISE NOTICE '  SELECT generate_shopping_list(Lilian);';
  RAISE NOTICE '';
  RAISE NOTICE 'Funcionaria atualizada:';
  RAISE NOTICE '  - Lilian (Faxineira)';
  RAISE NOTICE '=====================================================';
END $$;
