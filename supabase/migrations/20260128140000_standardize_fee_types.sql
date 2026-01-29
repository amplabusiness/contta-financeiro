-- ============================================================================
-- PADRONIZAÇÃO DE TIPOS DE HONORÁRIOS (Seção 7)
-- Conforme especificação: mensal, SM, 13º, %, legalização, holding, permuta
-- ============================================================================

-- 1. Adicionar coluna fee_type na tabela invoices (se não existir)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fee_type VARCHAR(50);

-- 2. Criar constraint para validar tipos permitidos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoices_fee_type_check'
    ) THEN
        ALTER TABLE invoices ADD CONSTRAINT invoices_fee_type_check
        CHECK (fee_type IS NULL OR fee_type IN (
            'mensal',           -- Honorário fixo mensal
            'salario_minimo',   -- Indexado ao salário mínimo
            '13o',              -- 13º honorário
            'percentual',       -- % sobre faturamento
            'legalizacao',      -- Abertura, baixa, alteração
            'holding',          -- Holding / consultoria
            'permuta',          -- Permuta
            'avulso'            -- Honorário avulso/pontual
        ));
    END IF;
END $$;

-- 3. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_invoices_fee_type ON invoices(fee_type);

-- 4. Atualizar invoices existentes com base em informações disponíveis
UPDATE invoices SET fee_type = 'mensal'
WHERE fee_type IS NULL
  AND (type = 'honorario_mensal' OR description ILIKE '%mensal%');

UPDATE invoices SET fee_type = 'salario_minimo'
WHERE fee_type IS NULL
  AND description ILIKE '%salário mínimo%';

UPDATE invoices SET fee_type = '13o'
WHERE fee_type IS NULL
  AND (description ILIKE '%13%' OR description ILIKE '%décimo terceiro%');

UPDATE invoices SET fee_type = 'legalizacao'
WHERE fee_type IS NULL
  AND (description ILIKE '%abertura%' OR description ILIKE '%baixa%' OR description ILIKE '%alteração%');

-- 5. Adicionar coluna fee_type em client_opening_balance também
ALTER TABLE client_opening_balance ADD COLUMN IF NOT EXISTS fee_type_standard VARCHAR(50);

-- 6. View consolidada de todos os tipos de honorários
CREATE OR REPLACE VIEW vw_honorarios_por_tipo AS
SELECT
    fee_type,
    COUNT(*) AS quantidade,
    SUM(amount) AS valor_total,
    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS valor_recebido,
    SUM(CASE WHEN status IN ('pending', 'overdue') THEN amount ELSE 0 END) AS valor_pendente
FROM invoices
WHERE fee_type IS NOT NULL
GROUP BY fee_type
ORDER BY valor_total DESC;

COMMENT ON VIEW vw_honorarios_por_tipo IS
'Resumo de honorários por tipo conforme Seção 7:
mensal, salario_minimo, 13o, percentual, legalizacao, holding, permuta, avulso';

-- 7. Log de execução
DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '[Dr. Cícero] TIPOS DE HONORÁRIOS PADRONIZADOS (Seção 7)';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tipos suportados:';
    RAISE NOTICE '  - mensal: Honorário fixo mensal';
    RAISE NOTICE '  - salario_minimo: Indexado ao SM';
    RAISE NOTICE '  - 13o: Décimo terceiro honorário';
    RAISE NOTICE '  - percentual: Sobre faturamento';
    RAISE NOTICE '  - legalizacao: Abertura/baixa/alteração';
    RAISE NOTICE '  - holding: Holding/consultoria';
    RAISE NOTICE '  - permuta: Permuta';
    RAISE NOTICE '  - avulso: Honorário pontual';
    RAISE NOTICE '============================================================================';
END $$;
