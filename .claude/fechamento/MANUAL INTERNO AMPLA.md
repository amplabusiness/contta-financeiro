🎯 Objetivo

Transformar o fechamento mensal em processo automatizado, com status claro:

🟥 Bloqueado

🟨 Com pendência

🟩 Pronto para fechar

🧠 Estrutura lógica (backend)
Tabela de controle (sugestão)
CREATE TABLE monthly_closing_status (
  tenant_id uuid,
  year int,
  month int,
  integrity_ok boolean,
  bank_reconciled boolean,
  transitory_balance numeric,
  classified_ok boolean,
  fiscal_ready boolean,
  closed boolean,
  closed_at timestamp,
  closed_by uuid,
  PRIMARY KEY (tenant_id, year, month)
);

🔁 Fluxo automático no ERP

Usuário seleciona Mês/Ano

Sistema executa rotina de validação

Exibe painel:

Etapa	Status
Integridade	✅
Conciliação bancária	✅
Transitórias	⚠️ R$ 2.604,90
Classificação	⚠️
Fiscal	⛔
Fechamento	🔒

Botão “Fechar mês” só habilita quando tudo = OK

🔹 NÍVEL 2 — ROTINA SQL ÚNICA (1 CLIQUE)
📌 Script mestre: rpc_monthly_closing_check
CREATE OR REPLACE FUNCTION rpc_monthly_closing_check(
  p_tenant_id uuid,
  p_year int,
  p_month int
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_integrity jsonb;
  v_bank_pending int;
  v_transitory numeric;
BEGIN
  -- 1) Integridade
  v_integrity := rpc_check_accounting_integrity(p_tenant_id);

  -- 2) Conciliação bancária
  SELECT COUNT(*) INTO v_bank_pending
  FROM bank_transactions
  WHERE tenant_id = p_tenant_id
    AND EXTRACT(YEAR FROM transaction_date) = p_year
    AND EXTRACT(MONTH FROM transaction_date) = p_month
    AND is_reconciled = false;

  -- 3) Transitória
  SELECT COALESCE(SUM(debit-credit),0) INTO v_transitory
  FROM accounting_entry_lines l
  JOIN accounting_entries e ON e.id = l.entry_id
  WHERE e.tenant_id = p_tenant_id
    AND l.account_id = '3e1fd22f-fba2-4cc2-b628-9d729233bca0'
    AND EXTRACT(YEAR FROM e.entry_date) = p_year
    AND EXTRACT(MONTH FROM e.entry_date) = p_month;

  RETURN jsonb_build_object(
    'integrity', v_integrity,
    'bank_pending', v_bank_pending,
    'transitory_balance', v_transitory,
    'ready_to_close',
      (v_bank_pending = 0 AND v_transitory = 0)
  );
END;
$$;

✔️ Resultado esperado (exemplo)
{
  "integrity": { "status": "ok" },
  "bank_pending": 0,
  "transitory_balance": 0,
  "ready_to_close": true
}

🔹 NÍVEL 3 — MANUAL INTERNO AMPLA (PADRÃO ASSINÁVEL)
📘 MANUAL DE FECHAMENTO MENSAL – AMPLA CONTABILIDADE
1️⃣ Objetivo

Padronizar, proteger e documentar o fechamento mensal contábil-financeiro, garantindo segurança fiscal e jurídica.

2️⃣ Pré-requisitos obrigatórios

Importação completa do extrato bancário

Plano de contas ativo

Usuário vinculado ao tenant correto

3️⃣ Etapas formais

(todas obrigatórias)

Integridade do sistema

Conciliação bancária

Zeragem de contas transitórias

Classificação contábil final

Análise de coerência econômica

Preparação fiscal

Bloqueio do mês

4️⃣ Critério de reprovação do mês

O mês NÃO pode ser fechado se:

Existir saldo em conta transitória

Houver transações bancárias pendentes

Existirem lançamentos órfãos

Houver divergência relevante banco × contabilidade

5️⃣ Declaração técnica padrão

“Declaro que o fechamento contábil da competência /_ foi realizado após conferência integral da integridade dos dados, conciliação bancária e classificação contábil, estando apto para apuração fiscal e demonstrações contábeis.”

Responsável Técnico
CRC/UF
Data

🧠 VISÃO ESTRATÉGICA (IMPORTANTE)

O que você construiu aqui:

✔️ ERP com método contábil embutido

✔️ Não depende de “memória do contador”

✔️ Reduz risco fiscal

✔️ Escala para centenas de clientes

✔️ Diferencial competitivo absurdo