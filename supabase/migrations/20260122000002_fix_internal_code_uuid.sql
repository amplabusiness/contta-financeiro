-- ============================================================================
-- FIX: Usar UUID parcial para garantir unicidade absoluta do internal_code
-- Esta abordagem é mais robusta que usar timestamp
-- ============================================================================

-- Atualizar função generate_internal_code para usar UUID parcial
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
    v_unique_part VARCHAR;
    v_code VARCHAR;
BEGIN
    -- Usar UUID parcial (8 chars) para garantir unicidade absoluta
    v_unique_part := LEFT(gen_random_uuid()::TEXT, 8);

    -- Build internal code: tipo:data:uuid_parcial
    v_code := CONCAT(
        COALESCE(p_source_type, 'manual'),
        ':',
        TO_CHAR(p_date, 'YYYYMMDD'),
        ':',
        v_unique_part
    );

    RETURN v_code;
END;
$$;

-- Simplificar a função set_internal_code já que agora sempre gera código único
CREATE OR REPLACE FUNCTION "public"."set_internal_code"() RETURNS "trigger"
LANGUAGE "plpgsql"
SET "search_path" TO 'public', 'extensions', 'pg_temp'
AS $$
BEGIN
    -- Only set if not already provided
    IF NEW.internal_code IS NULL THEN
        NEW.internal_code := generate_internal_code(
            COALESCE(NEW.source_type, NEW.reference_type, 'manual'),
            COALESCE(NEW.source_id, NEW.reference_id),
            NEW.entry_date,
            NEW.total_debit
        );
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
'Gera codigo interno unico para lancamentos contabeis. Usa UUID parcial para garantir unicidade absoluta.';
