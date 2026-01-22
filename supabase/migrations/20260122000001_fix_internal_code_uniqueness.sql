-- ============================================================================
-- FIX: Garantir unicidade do internal_code em accounting_entries
-- Problema: Quando se cria manualmente um lançamento para uma transação
-- que já teve lançamento automático (mesmo deletado), o internal_code
-- gerado é idêntico, violando a constraint unique.
-- ============================================================================

-- Atualizar função generate_internal_code para incluir componente de timestamp
-- que garante unicidade mesmo com os mesmos parâmetros de entrada
CREATE OR REPLACE FUNCTION "public"."generate_internal_code"(
    "p_source_type" character varying,
    "p_source_id" "uuid",
    "p_date" "date",
    "p_amount" numeric
) RETURNS character varying
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
    v_hash VARCHAR;
    v_code VARCHAR;
    v_timestamp VARCHAR;
BEGIN
    -- Incluir timestamp com microsegundos para garantir unicidade
    v_timestamp := TO_CHAR(clock_timestamp(), 'HH24MISSUS');

    -- Generate hash from source data + timestamp
    v_hash := LEFT(MD5(CONCAT(
        COALESCE(p_source_type, 'manual'),
        ':',
        COALESCE(p_source_id::TEXT, gen_random_uuid()::TEXT),
        ':',
        p_date::TEXT,
        ':',
        p_amount::TEXT,
        ':',
        v_timestamp
    )), 12);

    -- Build internal code
    v_code := CONCAT(
        COALESCE(p_source_type, 'manual'),
        ':',
        TO_CHAR(p_date, 'YYYYMMDD'),
        ':',
        v_hash
    );

    RETURN v_code;
END;
$$;

-- Atualizar a função set_internal_code para tratar melhor cenários de reclassificação
CREATE OR REPLACE FUNCTION "public"."set_internal_code"() RETURNS "trigger"
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
    v_existing_code VARCHAR;
    v_new_code VARCHAR;
    v_attempt INT := 0;
BEGIN
    -- Only set if not already provided
    IF NEW.internal_code IS NULL THEN
        -- Gerar código inicial
        v_new_code := generate_internal_code(
            COALESCE(NEW.source_type, NEW.reference_type, 'manual'),
            COALESCE(NEW.source_id, NEW.reference_id),
            NEW.entry_date,
            NEW.total_debit
        );

        -- Verificar se já existe e gerar novo se necessário (até 10 tentativas)
        LOOP
            SELECT internal_code INTO v_existing_code
            FROM accounting_entries
            WHERE internal_code = v_new_code;

            IF v_existing_code IS NULL THEN
                -- Código único encontrado
                NEW.internal_code := v_new_code;
                EXIT;
            END IF;

            v_attempt := v_attempt + 1;
            IF v_attempt > 10 THEN
                -- Fallback: usar UUID como sufixo
                NEW.internal_code := v_new_code || '-' || LEFT(gen_random_uuid()::TEXT, 8);
                EXIT;
            END IF;

            -- Gerar novo código (o timestamp vai mudar)
            PERFORM pg_sleep(0.001); -- 1ms de delay para mudar o timestamp
            v_new_code := generate_internal_code(
                COALESCE(NEW.source_type, NEW.reference_type, 'manual'),
                COALESCE(NEW.source_id, NEW.reference_id),
                NEW.entry_date,
                NEW.total_debit
            );
        END LOOP;
    END IF;

    -- Also set source tracking if using reference fields
    IF NEW.source_type IS NULL AND NEW.reference_type IS NOT NULL THEN
        NEW.source_type := NEW.reference_type;
    END IF;
    IF NEW.source_id IS NULL AND NEW.reference_id IS NOT NULL THEN
        NEW.source_id := NEW.reference_id;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION generate_internal_code(VARCHAR, UUID, DATE, NUMERIC) IS
'Gera codigo interno unico para lancamentos contabeis. Inclui timestamp com microsegundos para garantir unicidade.';

COMMENT ON FUNCTION set_internal_code() IS
'Trigger que define o internal_code automaticamente. Verifica unicidade e regera se necessario.';
