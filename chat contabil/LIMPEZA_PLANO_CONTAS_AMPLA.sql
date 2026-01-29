-- ============================================================================
-- 🔧 DIAGNÓSTICO E LIMPEZA DO PLANO DE CONTAS - AMPLA CONTABILIDADE
-- ============================================================================
-- Autor: Dr. Cícero (Claude AI)
-- Data: 11/01/2025
-- Objetivo: Identificar e corrigir duplicações no Plano de Contas
-- ============================================================================

-- ============================================================================
-- PARTE 1: DIAGNÓSTICO - IDENTIFICAR TODOS OS PROBLEMAS
-- ============================================================================

-- 1.1 Contas de Clientes duplicadas (Normal + [CONSOLIDADO])
-- ---------------------------------------------------------------------------
SELECT 
    '🔴 DUPLICATA CONSOLIDADO' as problema,
    c1.codigo as codigo_original,
    c1.nome as nome_original,
    c2.codigo as codigo_consolidado,
    c2.nome as nome_consolidado,
    c1.saldo_atual as saldo_original,
    c2.saldo_atual as saldo_consolidado
FROM plano_contas c1
JOIN plano_contas c2 ON c2.nome LIKE '[CONSOLIDADO] ' || c1.nome || '%'
WHERE c1.codigo LIKE '1.1.2.01.%'
  AND c1.nome NOT LIKE '[CONSOLIDADO]%'
ORDER BY c1.codigo;

-- 1.2 Contas com mesmo nome (duplicatas exatas)
-- ---------------------------------------------------------------------------
SELECT 
    '🟠 NOME DUPLICADO' as problema,
    nome,
    COUNT(*) as quantidade,
    STRING_AGG(codigo, ', ' ORDER BY codigo) as codigos,
    SUM(saldo_atual) as saldo_total
FROM plano_contas
WHERE codigo LIKE '1.1.2.01.%'
GROUP BY nome
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 1.3 Contas OBSOLETAS ainda ativas
-- ---------------------------------------------------------------------------
SELECT 
    '⚪ CONTA OBSOLETA' as problema,
    codigo,
    nome,
    saldo_atual,
    CASE WHEN saldo_atual != 0 THEN '⚠️ TEM SALDO!' ELSE '✅ Zerada' END as status
FROM plano_contas
WHERE nome LIKE '%OBSOLETO%'
   OR nome LIKE '%(OBSOLETO)%'
ORDER BY codigo;

-- 1.4 Contas Dr. Cicero mal posicionadas
-- ---------------------------------------------------------------------------
SELECT 
    '🔵 DR.CICERO MAL POSICIONADA' as problema,
    codigo,
    nome,
    CASE 
        WHEN codigo LIKE '1.%' THEN 'Ativo (deveria ser Despesa?)'
        WHEN codigo LIKE '5.%' THEN 'PL (deveria ser Despesa?)'
        ELSE 'OK'
    END as observacao
FROM plano_contas
WHERE nome LIKE '%Dr. Cicero%'
   OR nome LIKE '%Dr.Cicero%'
ORDER BY codigo;

-- 1.5 Contas com nomes truncados
-- ---------------------------------------------------------------------------
SELECT 
    '🟡 NOME TRUNCADO' as problema,
    codigo,
    nome,
    LENGTH(nome) as tamanho
FROM plano_contas
WHERE codigo LIKE '1.1.2.01.%'
  AND (
    nome LIKE '%LTDA' AND nome NOT LIKE '%LTDA%ME%' AND nome NOT LIKE '%LTDA %'
    OR nome LIKE '% LTD'
    OR nome LIKE '%EIRELI'
    OR RIGHT(nome, 1) NOT IN ('A', 'O', 'E', 'S', '.', ')', 'I', 'L', 'D', 'R', 'N', 'M', 'Z', 'X', 'C', 'K', 'T', 'G', 'P', 'B', 'F', 'V', 'J', 'H', 'W', 'Y', 'U', 'Q')
  )
  AND LENGTH(nome) >= 40
ORDER BY codigo;

-- 1.6 Códigos com padrão inconsistente
-- ---------------------------------------------------------------------------
SELECT 
    '🟣 CÓDIGO FORA DO PADRÃO' as problema,
    codigo,
    nome,
    LENGTH(SPLIT_PART(codigo, '.', 5)) as digitos_ultimo_nivel,
    CASE 
        WHEN LENGTH(SPLIT_PART(codigo, '.', 5)) = 4 THEN '✅ Padrão'
        WHEN LENGTH(SPLIT_PART(codigo, '.', 5)) = 3 THEN '⚠️ 3 dígitos'
        WHEN LENGTH(SPLIT_PART(codigo, '.', 5)) = 5 THEN '⚠️ 5 dígitos'
        ELSE '❓ Outro'
    END as status
FROM plano_contas
WHERE codigo LIKE '1.1.2.01.%'
  AND LENGTH(SPLIT_PART(codigo, '.', 5)) != 4
ORDER BY codigo;

-- 1.7 Resumo Geral do Diagnóstico
-- ---------------------------------------------------------------------------
SELECT 'RESUMO DO DIAGNÓSTICO' as titulo, '' as valor
UNION ALL
SELECT '─────────────────────────', ''
UNION ALL
SELECT 'Total de contas no plano', COUNT(*)::TEXT FROM plano_contas
UNION ALL
SELECT 'Contas de clientes (1.1.2.01)', COUNT(*)::TEXT FROM plano_contas WHERE codigo LIKE '1.1.2.01.%'
UNION ALL
SELECT 'Contas [CONSOLIDADO]', COUNT(*)::TEXT FROM plano_contas WHERE nome LIKE '[CONSOLIDADO]%'
UNION ALL
SELECT 'Contas OBSOLETAS', COUNT(*)::TEXT FROM plano_contas WHERE nome LIKE '%OBSOLETO%'
UNION ALL
SELECT 'Contas Dr.Cicero', COUNT(*)::TEXT FROM plano_contas WHERE nome LIKE '%Dr. Cicero%'
UNION ALL
SELECT 'Contas com saldo > 0', COUNT(*)::TEXT FROM plano_contas WHERE saldo_atual > 0
UNION ALL
SELECT 'Contas zeradas', COUNT(*)::TEXT FROM plano_contas WHERE saldo_atual = 0;

-- ============================================================================
-- PARTE 2: ANÁLISE DE SIMILARIDADE (Encontrar duplicatas por nome similar)
-- ============================================================================

-- 2.1 Clientes com nomes muito similares (possíveis duplicatas)
-- ---------------------------------------------------------------------------
WITH clientes AS (
    SELECT 
        id,
        codigo,
        nome,
        -- Normaliza o nome para comparação
        UPPER(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(nome, '\[CONSOLIDADO\]\s*', '', 'gi'),
                        '(LTDA|EIRELI|ME|EPP|S/?S|S/A|LTDA-ME|LTDA ME)', '', 'gi'
                    ),
                    '\s+', ' ', 'g'
                ),
                '[^A-Z0-9 ]', '', 'g'
            )
        ) as nome_normalizado
    FROM plano_contas
    WHERE codigo LIKE '1.1.2.01.%'
)
SELECT 
    c1.codigo as codigo_1,
    c1.nome as nome_1,
    c2.codigo as codigo_2,
    c2.nome as nome_2,
    c1.nome_normalizado
FROM clientes c1
JOIN clientes c2 ON c1.nome_normalizado = c2.nome_normalizado
                AND c1.codigo < c2.codigo
ORDER BY c1.nome_normalizado, c1.codigo;

-- ============================================================================
-- PARTE 3: LIMPEZA - SCRIPTS DE CORREÇÃO
-- ============================================================================
-- ⚠️ ATENÇÃO: Execute estes scripts APENAS após backup do banco!
-- ============================================================================

-- 3.1 Backup antes de qualquer alteração
-- ---------------------------------------------------------------------------
/*
-- Criar tabela de backup
CREATE TABLE IF NOT EXISTS plano_contas_backup_20250111 AS 
SELECT * FROM plano_contas;

-- Verificar backup
SELECT COUNT(*) as registros_backup FROM plano_contas_backup_20250111;
*/

-- 3.2 Desativar contas OBSOLETAS (marcar como inativas, não deletar)
-- ---------------------------------------------------------------------------
/*
UPDATE plano_contas
SET 
    ativo = false,
    updated_at = NOW()
WHERE nome LIKE '%OBSOLETO%'
  AND saldo_atual = 0;
*/

-- 3.3 Unificar contas [CONSOLIDADO] com contas originais
-- ---------------------------------------------------------------------------
-- Estratégia: Transferir saldos das contas [CONSOLIDADO] para as originais
-- e depois desativar as [CONSOLIDADO]

/*
-- Passo 1: Identificar pares para unificação
WITH pares AS (
    SELECT 
        c1.id as id_original,
        c1.codigo as codigo_original,
        c1.nome as nome_original,
        c2.id as id_consolidado,
        c2.codigo as codigo_consolidado,
        c2.saldo_atual as saldo_consolidado
    FROM plano_contas c1
    JOIN plano_contas c2 ON c2.nome LIKE '[CONSOLIDADO] ' || c1.nome || '%'
    WHERE c1.codigo LIKE '1.1.2.01.%'
      AND c1.nome NOT LIKE '[CONSOLIDADO]%'
)
SELECT * FROM pares WHERE saldo_consolidado != 0;

-- Passo 2: Transferir saldos (se houver)
UPDATE plano_contas pc
SET saldo_atual = pc.saldo_atual + pares.saldo_consolidado
FROM (
    SELECT 
        c1.id as id_original,
        c2.saldo_atual as saldo_consolidado
    FROM plano_contas c1
    JOIN plano_contas c2 ON c2.nome LIKE '[CONSOLIDADO] ' || c1.nome || '%'
    WHERE c1.codigo LIKE '1.1.2.01.%'
      AND c1.nome NOT LIKE '[CONSOLIDADO]%'
      AND c2.saldo_atual != 0
) pares
WHERE pc.id = pares.id_original;

-- Passo 3: Desativar contas [CONSOLIDADO]
UPDATE plano_contas
SET 
    ativo = false,
    updated_at = NOW()
WHERE nome LIKE '[CONSOLIDADO]%'
  AND saldo_atual = 0;
*/

-- 3.4 Mover contas Dr.Cicero para local correto
-- ---------------------------------------------------------------------------
/*
-- Criar contas corretas para Dr.Cicero se não existirem
INSERT INTO plano_contas (codigo, nome, tipo, natureza, nivel, ativo)
VALUES 
    ('4.9.9.10', 'Contas Automáticas Dr.Cicero', 'A', 'D', 4, true),
    ('4.9.9.10.01', 'Dr.Cicero: Despesas Gerais', 'M', 'D', 5, true),
    ('4.9.9.10.02', 'Dr.Cicero: Aluguel', 'M', 'D', 5, true),
    ('4.9.9.10.03', 'Dr.Cicero: Utilidades', 'M', 'D', 5, true),
    ('4.9.9.10.04', 'Dr.Cicero: Alimentação', 'M', 'D', 5, true)
ON CONFLICT (codigo) DO NOTHING;

-- Desativar contas Dr.Cicero mal posicionadas
UPDATE plano_contas
SET ativo = false
WHERE nome LIKE '%Dr. Cicero%'
  AND codigo NOT LIKE '4.%';
*/

-- 3.5 Padronizar códigos de cliente para 4 dígitos
-- ---------------------------------------------------------------------------
/*
-- Corrigir códigos com 3 dígitos (ex: 1.1.2.01.100 → 1.1.2.01.0100)
UPDATE plano_contas
SET codigo = REGEXP_REPLACE(
    codigo, 
    '^(1\.1\.2\.01\.)([0-9]{3})$', 
    '\g<1>0\2'
)
WHERE codigo ~ '^1\.1\.2\.01\.[0-9]{3}$';

-- Corrigir códigos com 5 dígitos (ex: 1.1.2.01.10000 → migrar para novo range)
-- Isso precisa de análise caso a caso
*/

-- ============================================================================
-- PARTE 4: CRIAÇÃO DE PLANO DE CONTAS LIMPO
-- ============================================================================

-- 4.1 View do Plano de Contas Limpo (para visualização)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_plano_contas_limpo AS
SELECT 
    codigo,
    nome,
    tipo,
    natureza,
    saldo_atual,
    ativo
FROM plano_contas
WHERE ativo = true
  AND nome NOT LIKE '%OBSOLETO%'
  AND nome NOT LIKE '[CONSOLIDADO]%'
  AND (
    codigo NOT LIKE '1.1.2.01.%' 
    OR codigo IN (
        SELECT MIN(codigo)
        FROM plano_contas
        WHERE codigo LIKE '1.1.2.01.%'
          AND nome NOT LIKE '[CONSOLIDADO]%'
        GROUP BY UPPER(REGEXP_REPLACE(nome, '\s*(LTDA|EIRELI|ME|EPP).*$', '', 'gi'))
    )
  )
ORDER BY codigo;

-- 4.2 Estatísticas do Plano Limpo
-- ---------------------------------------------------------------------------
SELECT 
    'COMPARATIVO' as analise,
    'Antes' as situacao,
    COUNT(*) as total_contas
FROM plano_contas
UNION ALL
SELECT 
    'COMPARATIVO',
    'Depois (estimado)',
    COUNT(*)
FROM vw_plano_contas_limpo;

-- ============================================================================
-- PARTE 5: PROCEDURE PARA LIMPEZA AUTOMÁTICA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_limpar_plano_contas(
    p_executar_limpeza BOOLEAN DEFAULT FALSE,
    p_backup_nome TEXT DEFAULT NULL
)
RETURNS TABLE (
    acao TEXT,
    contas_afetadas INTEGER,
    status TEXT
) AS $$
DECLARE
    v_backup_nome TEXT;
    v_count INTEGER;
BEGIN
    -- Nome do backup
    v_backup_nome := COALESCE(p_backup_nome, 'plano_contas_backup_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS'));
    
    -- 1. Criar backup
    IF p_executar_limpeza THEN
        EXECUTE format('CREATE TABLE %I AS SELECT * FROM plano_contas', v_backup_nome);
        acao := '📦 Backup criado';
        SELECT COUNT(*) INTO contas_afetadas FROM plano_contas;
        status := 'Tabela: ' || v_backup_nome;
        RETURN NEXT;
    END IF;
    
    -- 2. Contar OBSOLETAS
    SELECT COUNT(*) INTO v_count 
    FROM plano_contas 
    WHERE nome LIKE '%OBSOLETO%' AND saldo_atual = 0;
    
    acao := '⚪ Contas OBSOLETAS para desativar';
    contas_afetadas := v_count;
    status := CASE WHEN p_executar_limpeza THEN 'EXECUTADO' ELSE 'SIMULAÇÃO' END;
    RETURN NEXT;
    
    IF p_executar_limpeza THEN
        UPDATE plano_contas 
        SET ativo = false, updated_at = NOW()
        WHERE nome LIKE '%OBSOLETO%' AND saldo_atual = 0;
    END IF;
    
    -- 3. Contar [CONSOLIDADO]
    SELECT COUNT(*) INTO v_count 
    FROM plano_contas 
    WHERE nome LIKE '[CONSOLIDADO]%' AND saldo_atual = 0;
    
    acao := '🔴 Contas [CONSOLIDADO] para desativar';
    contas_afetadas := v_count;
    status := CASE WHEN p_executar_limpeza THEN 'EXECUTADO' ELSE 'SIMULAÇÃO' END;
    RETURN NEXT;
    
    IF p_executar_limpeza THEN
        UPDATE plano_contas 
        SET ativo = false, updated_at = NOW()
        WHERE nome LIKE '[CONSOLIDADO]%' AND saldo_atual = 0;
    END IF;
    
    -- 4. Resumo final
    SELECT COUNT(*) INTO v_count FROM plano_contas WHERE ativo = true;
    acao := '✅ Contas ativas após limpeza';
    contas_afetadas := v_count;
    status := 'FINAL';
    RETURN NEXT;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMO USAR:
-- ============================================================================
-- 
-- 1. DIAGNÓSTICO (apenas visualizar):
--    SELECT * FROM fn_limpar_plano_contas(FALSE);
--
-- 2. EXECUTAR LIMPEZA (com backup automático):
--    SELECT * FROM fn_limpar_plano_contas(TRUE);
--
-- 3. REVERTER (se necessário):
--    TRUNCATE plano_contas;
--    INSERT INTO plano_contas SELECT * FROM plano_contas_backup_XXXXXXXX;
--
-- ============================================================================
