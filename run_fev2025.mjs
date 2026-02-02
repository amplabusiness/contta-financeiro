/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONTTA | Governança Mensal | Runner Fevereiro/2025
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este script executa o fluxo completo de governança para Fevereiro/2025:
 * 
 * 1. STATUS INICIAL - Diagnóstico do mês
 * 2. CLASSIFICAÇÃO EM LOTE - Aplica regras da matriz
 * 3. VALIDAÇÃO TRANSITÓRIAS - Verifica se estão zeradas
 * 4. LISTA NÃO CLASSIFICADAS - Mostra transações sem regra
 * 5. FECHAMENTO (opcional) - Fecha o mês se tudo OK
 * 
 * Uso:
 *   node run_fev2025.mjs
 *   node run_fev2025.mjs --close  (para fechar o mês ao final)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════
const TENANT_ID = "a53a4957-fe97-4856-b3ca-70045157b421";

// Fevereiro/2025
const YEAR = 2025;
const MONTH = 2;
const START_DATE = "2025-02-01";
const END_DATE = "2025-02-28";

// Competência Janeiro/2025 (para gerar honorários que vencem em Fev)
const COMPETENCE_JAN = "2025-01-01";

// Opções
const SHOULD_CLOSE = process.argv.includes("--close");
const DRY_RUN = process.argv.includes("--dry-run");

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function log(title, obj = null) {
  console.log("\n" + "═".repeat(80));
  console.log(`📊 ${title}`);
  console.log("═".repeat(80));
  if (obj) {
    console.log(JSON.stringify(obj, null, 2));
  }
}

function logError(title, error) {
  console.log("\n" + "❌".repeat(40));
  console.log(`ERRO: ${title}`);
  console.log(error);
  console.log("❌".repeat(40));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 1: STATUS INICIAL
// ═══════════════════════════════════════════════════════════════════════════════
async function getMonthStatus() {
  log("ETAPA 1: STATUS INICIAL - FEVEREIRO/2025");

  const { data, error } = await supabase.rpc("get_month_status", {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE,
  });

  if (error) {
    logError("get_month_status", error);
    return null;
  }

  console.log("\n📈 Resumo do Mês:");
  console.log(`   Total de transações:        ${data.total_transactions}`);
  console.log(`   Pendentes (sem OFX entry):  ${data.pending_transactions}`);
  console.log(`   Reconciliadas (OFX OK):     ${data.reconciled_transactions}`);
  console.log(`   Classificadas:              ${data.classified_transactions}`);
  console.log(`   Entries de classificação:   ${data.classification_entries}`);
  console.log("");
  console.log(`   💰 Transitória Débitos:     ${formatCurrency(data.transitory_debits_balance)}`);
  console.log(`   💰 Transitória Créditos:    ${formatCurrency(data.transitory_credits_balance)}`);
  console.log(`   ✅ Zeradas:                 ${data.transitories_zero ? "SIM ✓" : "NÃO ✗"}`);

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 2: VERIFICAR REGRAS EXISTENTES
// ═══════════════════════════════════════════════════════════════════════════════
async function checkRules() {
  log("ETAPA 2: VERIFICANDO MATRIZ DE REGRAS");

  const { data, error } = await supabase
    .from("classification_rules")
    .select("id, rule_name, match_type, match_value, direction, requires_approval, priority")
    .eq("tenant_id", TENANT_ID)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) {
    logError("Erro ao buscar regras", error);
    return [];
  }

  if (data.length === 0) {
    console.log("\n⚠️  NENHUMA REGRA CADASTRADA!");
    console.log("   Execute o script de carga de regras primeiro.");
    console.log("   Arquivo: insert_classification_rules.sql");
    return [];
  }

  console.log(`\n📋 Regras ativas: ${data.length}`);
  console.log("\n   Prior │ Tipo     │ Direção │ Aprovação │ Nome");
  console.log("   ──────┼──────────┼─────────┼───────────┼────────────────────────────");
  
  data.slice(0, 20).forEach((r) => {
    const prior = String(r.priority).padStart(5);
    const tipo = r.match_type.padEnd(8);
    const dir = r.direction.padEnd(7);
    const aprov = r.requires_approval ? "SIM" : "---";
    console.log(`   ${prior} │ ${tipo} │ ${dir} │ ${aprov.padEnd(9)} │ ${r.rule_name.substring(0, 30)}`);
  });

  if (data.length > 20) {
    console.log(`   ... e mais ${data.length - 20} regras`);
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 3: CLASSIFICAR EM LOTE
// ═══════════════════════════════════════════════════════════════════════════════
async function classifyMonth() {
  log("ETAPA 3: CLASSIFICAÇÃO EM LOTE");

  if (DRY_RUN) {
    console.log("🔍 Modo DRY-RUN: apenas simulação, nada será gravado.");
    return { created_classifications: 0, skipped_no_rule: 0, sent_to_approval: 0 };
  }

  const { data, error } = await supabase.rpc("classify_month_from_rules", {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE,
  });

  if (error) {
    logError("classify_month_from_rules", error);
    return null;
  }

  console.log("\n📊 Resultado da Classificação:");
  console.log(`   ✅ Classificadas com sucesso:   ${data.created_classifications}`);
  console.log(`   ⏳ Sem regra aplicável:         ${data.skipped_no_rule}`);
  console.log(`   ⚠️  Enviadas para aprovação:    ${data.sent_to_approval}`);
  console.log(`\n   📝 ${data.message}`);

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 4: LISTAR NÃO CLASSIFICADAS
// ═══════════════════════════════════════════════════════════════════════════════
async function listUnclassified() {
  log("ETAPA 4: TRANSAÇÕES SEM CLASSIFICAÇÃO");

  const { data, error } = await supabase.rpc("list_unclassified_transactions", {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE,
    p_limit: 50,
  });

  if (error) {
    logError("list_unclassified_transactions", error);
    return [];
  }

  if (data.length === 0) {
    console.log("\n✅ Todas as transações estão classificadas!");
    return [];
  }

  console.log(`\n⚠️  ${data.length} transações sem regra aplicável:\n`);
  console.log("   Data       │ Direção │ Valor          │ Descrição");
  console.log("   ───────────┼─────────┼────────────────┼──────────────────────────────────────");

  data.forEach((tx) => {
    const date = tx.transaction_date;
    const dir = tx.direction === "credit" ? "ENTRADA" : "SAÍDA ";
    const val = formatCurrency(Math.abs(tx.amount)).padStart(14);
    const desc = (tx.description || "").substring(0, 40);
    console.log(`   ${date} │ ${dir}  │ ${val} │ ${desc}`);
  });

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 5: VALIDAR TRANSITÓRIAS
// ═══════════════════════════════════════════════════════════════════════════════
async function validateTransitories() {
  log("ETAPA 5: VALIDAÇÃO DAS TRANSITÓRIAS");

  const { data, error } = await supabase.rpc("validate_transitory_zero", {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE,
  });

  if (error) {
    logError("validate_transitory_zero", error);
    return null;
  }

  if (data.ok) {
    console.log("\n✅ TRANSITÓRIAS ZERADAS!");
    console.log("   O mês pode ser fechado.");
  } else {
    console.log("\n❌ TRANSITÓRIAS COM SALDO:");
    console.log(`   Débitos:  ${formatCurrency(data.transitory_debits_balance)}`);
    console.log(`   Créditos: ${formatCurrency(data.transitory_credits_balance)}`);
    console.log("\n   ⚠️  Não é possível fechar o mês.");
    console.log("   Complete a classificação das transações pendentes.");
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 6: FECHAMENTO DO MÊS
// ═══════════════════════════════════════════════════════════════════════════════
async function closeMonth() {
  log("ETAPA 6: FECHAMENTO DO MÊS");

  if (!SHOULD_CLOSE) {
    console.log("\n⏭️  Fechamento não solicitado.");
    console.log("   Para fechar o mês, execute: node run_fev2025.mjs --close");
    return null;
  }

  if (DRY_RUN) {
    console.log("🔍 Modo DRY-RUN: fechamento simulado.");
    return { ok: true, simulated: true };
  }

  const { data, error } = await supabase.rpc("close_month_guarded", {
    p_tenant: TENANT_ID,
    p_year: YEAR,
    p_month: MONTH,
    p_notes: "Fechamento via script run_fev2025.mjs",
  });

  if (error) {
    logError("close_month_guarded", error);
    return null;
  }

  if (data.ok) {
    console.log("\n✅ MÊS FECHADO COM SUCESSO!");
    console.log(`   ID do fechamento: ${data.closing_id}`);
    console.log(`   Referência: ${data.reference_month}`);
    console.log(`   ${data.message}`);
  } else {
    console.log("\n❌ FECHAMENTO BLOQUEADO:");
    console.log(`   Motivo: ${data.blocked_by}`);
    console.log(`   ${data.message}`);
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("\n" + "╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(20) + "CONTTA | GOVERNANÇA FEVEREIRO/2025" + " ".repeat(23) + "║");
  console.log("║" + " ".repeat(20) + "Dr. Cícero - Contador Responsável" + " ".repeat(24) + "║");
  console.log("╚" + "═".repeat(78) + "╝");

  if (DRY_RUN) {
    console.log("\n🔍 MODO DRY-RUN ATIVO - Nenhuma alteração será feita");
  }

  try {
    // 1. Status inicial
    const status1 = await getMonthStatus();
    if (!status1) return;

    // 2. Verificar regras
    const rules = await checkRules();
    if (rules.length === 0) {
      console.log("\n⛔ Processo interrompido: Cadastre regras primeiro.");
      process.exit(1);
    }

    // 3. Classificar
    const classResult = await classifyMonth();

    // 4. Listar não classificadas
    const unclassified = await listUnclassified();

    // 5. Validar transitórias
    const validation = await validateTransitories();

    // 6. Fechamento (se solicitado e possível)
    if (validation?.ok) {
      await closeMonth();
    } else if (SHOULD_CLOSE) {
      console.log("\n⛔ Fechamento não possível: transitórias não zeradas.");
    }

    // Resumo final
    log("RESUMO FINAL");
    const status2 = await getMonthStatus();

    console.log("\n" + "═".repeat(80));
    console.log("✅ Script concluído!");
    console.log("═".repeat(80));

  } catch (err) {
    logError("Erro fatal", err);
    process.exit(1);
  }
}

main();
