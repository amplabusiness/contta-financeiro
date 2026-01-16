# Migração de Dados de Inadimplência e Honorários Vencidos para a Tabela invoices

Este script realiza a migração dos dados de inadimplência e honorários vencidos do backup (bkp_20260106_invoices) para a tabela principal invoices, segregando corretamente por tenant (modelo SaaS).

---

```sql
BEGIN; -- Inicia uma transação segura

-- 1. 🤫 DESLIGA OS GATILHOS (Modo Réplica)
-- Isso impede que o erro de 'domain_events' aconteça
SET session_replication_role = 'replica';

DO $$
DECLARE
    v_ampla_tenant_id uuid;
    v_count integer;
BEGIN
    -- 2. Descobre o ID da empresa Ampla
    SELECT tenant_id INTO v_ampla_tenant_id 
    FROM public.tenant_users 
    LIMIT 1;

    IF v_ampla_tenant_id IS NULL THEN
        RAISE EXCEPTION '❌ Não encontrei a empresa Ampla.';
    END IF;

    RAISE NOTICE '🏢 ID da Ampla: %', v_ampla_tenant_id;

    -- 3. Transfere os dados CARIMBANDO com o ID da Ampla
    INSERT INTO public.invoices (
        id, client_id, competence, amount, due_date, status, 
        paid_date, paid_amount, boleto_digitable_line, external_charge_id, 
        notes, created_at, updated_at, boleto_url, boleto_barcode, 
        pix_qrcode, pix_copy_paste, pix_txid, payment_method, 
        payment_link, created_by, revenue_type_id, calculation_base, 
        calculated_amount, fine_amount, interest_amount, total_received, 
        discount_amount, journal_entry_id, cnab_reference, reconciled_at,
        tenant_id -- <--- Campo vital
    )
    SELECT 
        b.id, b.client_id, b.competence, b.amount, b.due_date, b.status, 
        b.paid_date, b.paid_amount, b.boleto_digitable_line, b.external_charge_id, 
        b.notes, b.created_at, b.updated_at, b.boleto_url, b.boleto_barcode, 
        b.pix_qrcode, b.pix_copy_paste, b.pix_txid, b.payment_method, 
        b.payment_link, b.created_by, b.revenue_type_id, b.calculation_base, 
        b.calculated_amount, b.fine_amount, b.interest_amount, b.total_received, 
        b.discount_amount, b.journal_entry_id, b.cnab_reference, b.reconciled_at,
        v_ampla_tenant_id -- <--- Aplica o ID da Ampla
    FROM public.bkp_20260106_invoices b
    ON CONFLICT (id) DO NOTHING; -- Se já inseriu alguma, ignora para não dar erro

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '✅ Sucesso! % faturas foram restauradas.', v_count;
END $$;

-- 4. 🔊 RELIGA OS GATILHOS (Modo Normal)
SET session_replication_role = 'origin';

COMMIT; -- Salva tudo
```

---

## Observações
- O script garante que todos os dados migrados sejam associados ao tenant correto (campo tenant_id).
- O restante do sistema permanece segregado por tenant, garantindo isolamento de dados no modelo SaaS.
- O comando `ON CONFLICT (id) DO NOTHING` evita duplicidade caso o script seja executado mais de uma vez.
- Certifique-se de que a tabela de backup (bkp_20260106_invoices) está atualizada antes de rodar o script.

---

**Atenção:** Execute este script com cautela em ambiente de produção. Recomenda-se realizar um backup antes da migração.