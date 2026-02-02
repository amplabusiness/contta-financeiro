/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CONTTA | Runner Governança Fevereiro/2025 - COM GRUPOS ECONÔMICOS
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este script executa o fluxo completo de fechamento mensal:
 * 
 * 1. Status inicial do mês
 * 2. Verificar matriz de regras
 * 3. Processar pagamentos de GRUPOS ECONÔMICOS (novo!)
 * 4. Classificar transações restantes
 * 5. Listar não classificadas
 * 6. Validar transitórias
 * 7. Fechar mês (opcional)
 * 
 * Uso:
 *   node run_fev2025_grupos.mjs              # Executa sem fechar
 *   node run_fev2025_grupos.mjs --close      # Executa e fecha o mês
 *   node run_fev2025_grupos.mjs --grupos     # Só processa grupos econômicos
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Configurações
const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const START_DATE = '2025-02-01';
const END_DATE = '2025-02-28';
const COMPETENCE_JAN = '2025-01-01';

// Argumentos
const args = process.argv.slice(2);
const SHOULD_CLOSE = args.includes('--close');
const ONLY_GROUPS = args.includes('--grupos');

// Helpers
function printHeader(title) {
  console.log('\n' + '═'.repeat(80));
  console.log(`📊 ${title}`);
  console.log('═'.repeat(80));
}

function printSuccess(msg) {
  console.log(`✅ ${msg}`);
}

function printWarning(msg) {
  console.log(`⚠️  ${msg}`);
}

function printError(msg) {
  console.log(`❌ ${msg}`);
}

function formatMoney(value) {
  return `R$ ${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 0: Verificar se RPCs existem
// ═══════════════════════════════════════════════════════════════════════════════
async function checkRPCs() {
  const rpcs = [
    'get_month_status',
    'validate_transitory_zero', 
    'classify_month_from_rules',
    'list_unclassified_transactions',
    'close_month_guarded',
    'identify_economic_group',
    'reconcile_group_payment',
    'list_group_payment_candidates'
  ];
  
  const missing = [];
  
  for (const rpc of rpcs) {
    const { error } = await supabase.rpc(rpc, { p_tenant: TENANT_ID, p_start: START_DATE, p_end: END_DATE });
    // Se o erro for "function not found", está faltando
    if (error && error.message.includes('Could not find the function')) {
      missing.push(rpc);
    }
  }
  
  return missing;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 1: Status do mês
// ═══════════════════════════════════════════════════════════════════════════════
async function getMonthStatus() {
  printHeader('ETAPA 1: STATUS INICIAL - FEVEREIRO/2025');
  
  const { data, error } = await supabase.rpc('get_month_status', {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE
  });
  
  if (error) {
    printError(`Erro ao buscar status: ${error.message}`);
    return null;
  }
  
  console.log(`
📈 Resumo do Mês:
   Total de transações:        ${data.total_transactions}
   Pendentes (sem OFX entry):  ${data.pending_transactions}
   Reconciliadas (OFX OK):     ${data.total_transactions - data.pending_transactions}
   Classificadas:              ${data.classification_entries || 0}
   Entries de classificação:   ${data.classification_entries || 0}
   
   💰 Transitória Débitos:     ${formatMoney(data.transitory_debits_balance)}
   💰 Transitória Créditos:    ${formatMoney(data.transitory_credits_balance)}
   ✅ Zeradas:                 ${Math.abs(data.transitory_debits_balance) < 0.01 && Math.abs(data.transitory_credits_balance) < 0.01 ? 'SIM ✓' : 'NÃO ✗'}
`);
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 2: Verificar regras
// ═══════════════════════════════════════════════════════════════════════════════
async function checkRules() {
  printHeader('ETAPA 2: VERIFICANDO MATRIZ DE REGRAS');
  
  const { data, error } = await supabase
    .from('classification_rules')
    .select('priority, rule_name, match_type, direction, requires_approval, destination_account_id')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('priority', { ascending: true })
    .limit(30);
  
  if (error) {
    printError(`Erro ao buscar regras: ${error.message}`);
    return [];
  }
  
  console.log(`📋 Regras ativas: ${data.length}`);
  console.log('');
  console.log('   Prior │ Tipo      │ Direção │ Tipo        │ Nome');
  console.log('   ──────┼───────────┼─────────┼─────────────┼────────────────────────────');
  
  for (const r of data) {
    const tipo = r.destination_account_id === null 
      ? (r.priority <= 10 ? '🔄 GRUPO' : '⛔ BLOQUEIO')
      : '✅ Auto';
    console.log(`   ${String(r.priority).padStart(5)} │ ${r.match_type.padEnd(9)} │ ${r.direction.padEnd(7)} │ ${tipo.padEnd(11)} │ ${r.rule_name.substring(0, 35)}`);
  }
  
  if (data.length >= 30) {
    console.log(`   ... e mais regras`);
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 3: NOVA - Processar pagamentos de grupos econômicos
// ═══════════════════════════════════════════════════════════════════════════════
async function processGroupPayments() {
  printHeader('ETAPA 3: PROCESSANDO PAGAMENTOS DE GRUPOS ECONÔMICOS');
  
  // 3.1 Buscar candidatos a pagamento de grupo
  const { data: candidates, error: candError } = await supabase.rpc('list_group_payment_candidates', {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE
  });
  
  if (candError) {
    // RPC pode não existir ainda
    if (candError.message.includes('Could not find the function')) {
      printWarning('RPC list_group_payment_candidates não encontrada.');
      printWarning('Execute a migration 20260202_GRUPOS_ECONOMICOS.sql primeiro.');
      return { processed: 0, skipped: 0 };
    }
    printError(`Erro ao buscar candidatos: ${candError.message}`);
    return { processed: 0, skipped: 0 };
  }
  
  if (!candidates || candidates.length === 0) {
    console.log('📭 Nenhuma transação identificada como pagamento de grupo econômico.');
    return { processed: 0, skipped: 0 };
  }
  
  console.log(`📋 ${candidates.length} transações identificadas como pagamento de grupo:`);
  console.log('');
  console.log('   Data       │ Valor          │ Grupo                  │ Empresas │ Pendente');
  console.log('   ───────────┼────────────────┼────────────────────────┼──────────┼─────────────');
  
  for (const c of candidates) {
    console.log(`   ${c.transaction_date} │ ${formatMoney(c.amount).padStart(14)} │ ${(c.group_name || '').substring(0, 22).padEnd(22)} │ ${String(c.member_count).padStart(8)} │ ${formatMoney(c.pending_total)}`);
  }
  
  // 3.2 Processar cada candidato
  console.log('');
  console.log('🔄 Processando baixas automáticas...');
  console.log('');
  
  let processed = 0;
  let skipped = 0;
  
  for (const c of candidates) {
    const { data: result, error: recError } = await supabase.rpc('reconcile_group_payment', {
      p_tenant: TENANT_ID,
      p_bank_transaction_id: c.transaction_id,
      p_created_by: 'dr-cicero-runner'
    });
    
    if (recError) {
      printWarning(`Erro ao processar ${c.transaction_id}: ${recError.message}`);
      skipped++;
      continue;
    }
    
    if (result.ok) {
      printSuccess(`${c.group_name}: ${formatMoney(result.applied_amount)} aplicado em ${result.invoices_paid} faturas`);
      if (result.remaining_credit > 0) {
        printWarning(`   Crédito restante: ${formatMoney(result.remaining_credit)}`);
      }
      processed++;
    } else {
      printWarning(`${c.group_name}: ${result.reason}`);
      skipped++;
    }
  }
  
  console.log('');
  console.log(`📊 Resultado: ${processed} processados, ${skipped} ignorados`);
  
  return { processed, skipped };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 4: Classificação em lote
// ═══════════════════════════════════════════════════════════════════════════════
async function classifyMonth() {
  printHeader('ETAPA 4: CLASSIFICAÇÃO EM LOTE');
  
  const { data, error } = await supabase.rpc('classify_month_from_rules', {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE
  });
  
  if (error) {
    printError(`Erro na classificação: ${error.message}`);
    return null;
  }
  
  console.log(`
📊 Resultado da Classificação:
   ✅ Classificadas com sucesso:   ${data.created_classifications || 0}
   ⏳ Sem regra aplicável:         ${data.skipped_no_rule || 0}
   ⚠️  Enviadas para aprovação:    ${data.sent_to_approval || 0}
`);
  
  if ((data.created_classifications || 0) === 0 && (data.skipped_no_rule || 0) === 0) {
    console.log('   📝 Todas as transações já foram classificadas.');
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 5: Listar não classificadas
// ═══════════════════════════════════════════════════════════════════════════════
async function listUnclassified() {
  printHeader('ETAPA 5: TRANSAÇÕES SEM CLASSIFICAÇÃO');
  
  const { data, error } = await supabase.rpc('list_unclassified_transactions', {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE,
    p_limit: 20
  });
  
  if (error) {
    printError(`Erro ao listar: ${error.message}`);
    return [];
  }
  
  if (!data || data.length === 0) {
    printSuccess('Todas as transações estão classificadas!');
    return [];
  }
  
  console.log(`⚠️  ${data.length} transações pendentes de classificação:`);
  console.log('');
  console.log('   Data       │ Valor          │ Descrição');
  console.log('   ───────────┼────────────────┼──────────────────────────────────────────');
  
  for (const t of data) {
    const valor = t.amount > 0 ? `+${formatMoney(t.amount)}` : formatMoney(t.amount);
    console.log(`   ${t.transaction_date} │ ${valor.padStart(14)} │ ${(t.description || '').substring(0, 45)}`);
  }
  
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 6: Validar transitórias
// ═══════════════════════════════════════════════════════════════════════════════
async function validateTransitory() {
  printHeader('ETAPA 6: VALIDAÇÃO DAS TRANSITÓRIAS');
  
  const { data, error } = await supabase.rpc('validate_transitory_zero', {
    p_tenant: TENANT_ID,
    p_start: START_DATE,
    p_end: END_DATE
  });
  
  if (error) {
    printError(`Erro na validação: ${error.message}`);
    return false;
  }
  
  if (data.ok) {
    printSuccess('Transitórias zeradas! Mês pode ser fechado.');
    return true;
  } else {
    console.log(`
❌ TRANSITÓRIAS COM SALDO:
   Débitos:  ${formatMoney(data.trans_debit)}
   Créditos: ${formatMoney(data.trans_credit)}
   
   ⚠️  Não é possível fechar o mês.
   Complete a classificação das transações pendentes.
`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETAPA 7: Fechar mês
// ═══════════════════════════════════════════════════════════════════════════════
async function closeMonth() {
  printHeader('ETAPA 7: FECHAMENTO FORMAL DO MÊS');
  
  const { data, error } = await supabase.rpc('close_month_guarded', {
    p_tenant: TENANT_ID,
    p_year: 2025,
    p_month: 2,
    p_user_id: null,
    p_notes: 'Fechamento via runner governança - Dr. Cícero'
  });
  
  if (error) {
    printError(`Erro no fechamento: ${error.message}`);
    return false;
  }
  
  if (data.ok) {
    printSuccess(`Mês FECHADO com sucesso!`);
    console.log(`   Referência: ${data.closed_reference_month}`);
    return true;
  } else {
    printError(`Fechamento bloqueado: ${JSON.stringify(data.blocked_by)}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                  CONTTA | GOVERNANÇA FEVEREIRO/2025                          ║
║                  Dr. Cícero - Contador Responsável                           ║
║                  + GRUPOS ECONÔMICOS                                         ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  // Verificar RPCs básicas
  const missingRpcs = await checkRPCs();
  if (missingRpcs.length > 0 && missingRpcs.includes('get_month_status')) {
    printError('RPCs de governança não encontradas!');
    console.log('');
    console.log('Execute as migrations no Supabase Dashboard:');
    console.log('  1. 20260202_GOVERNANCA_FECHAMENTO_FEV2025.sql');
    console.log('  2. 20260202_GRUPOS_ECONOMICOS.sql');
    console.log('  3. SQL_FIX_AND_INSERT_RULES.sql');
    console.log('  4. 20260202_INSERT_GRUPOS_ECONOMICOS.sql');
    console.log('  5. 20260202_REGRAS_GRUPOS_ECONOMICOS.sql');
    process.exit(1);
  }

  if (ONLY_GROUPS) {
    // Só processar grupos
    await processGroupPayments();
    console.log('\n✅ Processamento de grupos concluído!');
    process.exit(0);
  }

  // Fluxo completo
  const status1 = await getMonthStatus();
  await checkRules();
  
  // NOVO: Processar grupos econômicos primeiro
  const groupResult = await processGroupPayments();
  
  // Classificar restante
  await classifyMonth();
  
  // Listar pendentes
  await listUnclassified();
  
  // Validar transitórias
  const isValid = await validateTransitory();
  
  // Fechar se solicitado e válido
  if (SHOULD_CLOSE) {
    if (isValid) {
      await closeMonth();
    } else {
      printWarning('Fechamento não executado - transitórias não zeradas.');
    }
  } else {
    console.log('\n💡 Para fechar o mês, execute: node run_fev2025_grupos.mjs --close');
  }
  
  // Resumo final
  printHeader('RESUMO FINAL');
  await getMonthStatus();
  
  console.log('✅ Script concluído!');
  console.log('═'.repeat(80));
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
