/**
 * EXECUTOR DE CORREÇÃO SQL - DR. CÍCERO
 * =====================================
 * Executa as correções via SQL direto, contornando RLS
 * 
 * Protocolo: AUD-202501-ML1AZROS
 * Autorizado por: Dr. Cícero (Sérgio Carneiro Leão - CRC/GO 008074)
 * Data: 30/01/2026
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Constantes
const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const BANCO_SICREDI = '10d5892d-a843-4034-8d62-9fec95b8fd56';
const TRANS_DEBITOS = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
const TRANS_CREDITOS = '28085461-9e5a-4fb4-847d-c9fc047fe0a1';

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('  CORREÇÃO TÉCNICA JANEIRO/2025 — DR. CÍCERO');
console.log('  Protocolo: AUD-202501-ML1AZROS');
console.log('═══════════════════════════════════════════════════════════════════════════');

// =============================================================================
// FRENTE 1: Lançamentos Transitórios
// =============================================================================
async function executarFrente1() {
  console.log('\n  FRENTE 1: Buscando transações sem lançamento...');
  
  // Buscar transações órfãs
  const { data: transacoes, error: errBusca } = await supabase
    .from('bank_transactions')
    .select('id, fitid, amount, transaction_date, description')
    .eq('tenant_id', TENANT_ID)
    .is('journal_entry_id', null)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  if (errBusca) {
    console.error('  ❌ Erro ao buscar transações:', errBusca.message);
    return { success: 0, errors: 1 };
  }

  console.log(`  Encontradas: ${transacoes.length} transações`);
  
  let success = 0;
  let errors = 0;
  
  for (const tx of transacoes) {
    const entryId = randomUUID();
    const internalCode = `OFX_TRANS_${Date.now()}_${(tx.fitid || entryId).substring(0, 8)}`;
    const amount = Math.abs(tx.amount);
    
    // 1. Criar cabeçalho do lançamento
    const { error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        id: entryId,
        tenant_id: TENANT_ID,
        entry_date: tx.transaction_date,
        competence_date: tx.transaction_date,
        description: `[TRANSITÓRIO] ${tx.description || 'Sem descrição'}`,
        internal_code: internalCode,
        source_type: 'ofx_transit',
        entry_type: 'MOVIMENTO',
        reference_type: 'bank_transaction',
        reference_id: tx.id
      });

    if (errEntry) {
      console.error(`  ❌ Erro ao criar entry ${tx.id}:`, errEntry.message);
      errors++;
      continue;
    }

    // 2. Criar linhas
    let linhas;
    if (tx.amount > 0) {
      // ENTRADA: D Banco / C Transitória Créditos
      linhas = [
        { id: randomUUID(), tenant_id: TENANT_ID, entry_id: entryId, account_id: BANCO_SICREDI, debit: amount, credit: 0, description: 'Entrada conforme extrato' },
        { id: randomUUID(), tenant_id: TENANT_ID, entry_id: entryId, account_id: TRANS_CREDITOS, debit: 0, credit: amount, description: 'Pendente classificação' }
      ];
    } else {
      // SAÍDA: D Transitória Débitos / C Banco
      linhas = [
        { id: randomUUID(), tenant_id: TENANT_ID, entry_id: entryId, account_id: TRANS_DEBITOS, debit: amount, credit: 0, description: 'Pendente classificação' },
        { id: randomUUID(), tenant_id: TENANT_ID, entry_id: entryId, account_id: BANCO_SICREDI, debit: 0, credit: amount, description: 'Saída conforme extrato' }
      ];
    }

    const { error: errLines } = await supabase
      .from('accounting_entry_lines')
      .insert(linhas);

    if (errLines) {
      console.error(`  ❌ Erro ao criar linhas ${tx.id}:`, errLines.message);
      // Rollback - deletar entry
      await supabase.from('accounting_entries').delete().eq('id', entryId);
      errors++;
      continue;
    }

    // 3. Vincular transação ao lançamento
    const { error: errUpdate } = await supabase
      .from('bank_transactions')
      .update({ journal_entry_id: entryId })
      .eq('id', tx.id);

    if (errUpdate) {
      console.error(`  ❌ Erro ao vincular ${tx.id}:`, errUpdate.message);
      errors++;
      continue;
    }

    success++;
    if (success % 20 === 0) {
      console.log(`    ... ${success} lançamentos criados`);
    }
  }

  console.log(`  ✅ FRENTE 1: ${success} lançamentos criados, ${errors} erros`);
  return { success, errors };
}

// =============================================================================
// FRENTE 2: Estornos de Lançamentos Desbalanceados
// =============================================================================
async function executarFrente2() {
  console.log('\n  FRENTE 2: Buscando lançamentos desbalanceados...');
  
  // Buscar lançamentos desbalanceados
  const { data: entries, error: errBusca } = await supabase
    .from('accounting_entries')
    .select(`
      id, internal_code, description, entry_date,
      accounting_entry_lines (id, account_id, debit, credit, description)
    `)
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  if (errBusca) {
    console.error('  ❌ Erro ao buscar lançamentos:', errBusca.message);
    return { success: 0, errors: 1 };
  }

  // Filtrar desbalanceados
  const desbalanceados = entries.filter(e => {
    const lines = e.accounting_entry_lines || [];
    const totalD = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalC = lines.reduce((s, l) => s + (l.credit || 0), 0);
    return Math.abs(totalD - totalC) > 0.01;
  });

  console.log(`  Encontrados: ${desbalanceados.length} lançamentos desbalanceados`);
  
  let success = 0;
  let errors = 0;
  
  for (const entry of desbalanceados) {
    const estornoCode = `ESTORNO_${entry.internal_code || entry.id.substring(0, 8)}`;
    
    // Verificar se já existe estorno
    const { data: existing } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('internal_code', estornoCode)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`    Estorno já existe para ${entry.internal_code}`);
      continue;
    }

    const entryId = randomUUID();

    // 1. Criar cabeçalho do estorno
    const { error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        id: entryId,
        tenant_id: TENANT_ID,
        entry_date: entry.entry_date,
        competence_date: entry.entry_date,
        description: `[ESTORNO TÉCNICO] ${entry.description || 'Lançamento desbalanceado'}`,
        internal_code: estornoCode,
        source_type: 'reversal',
        entry_type: 'ESTORNO',
        reference_type: 'accounting_entry',
        reference_id: entry.id
      });

    if (errEntry) {
      console.error(`  ❌ Erro ao criar estorno ${entry.id}:`, errEntry.message);
      errors++;
      continue;
    }

    // 2. Criar linhas invertidas
    const linhasEstorno = (entry.accounting_entry_lines || []).map(l => ({
      id: randomUUID(),
      tenant_id: TENANT_ID,
      entry_id: entryId,
      account_id: l.account_id,
      debit: l.credit || 0,    // Inverte: crédito vira débito
      credit: l.debit || 0,    // Inverte: débito vira crédito
      description: `[ESTORNO] ${l.description || ''}`
    }));

    if (linhasEstorno.length === 0) {
      console.log(`    Lançamento ${entry.id} sem linhas, pulando`);
      await supabase.from('accounting_entries').delete().eq('id', entryId);
      continue;
    }

    const { error: errLines } = await supabase
      .from('accounting_entry_lines')
      .insert(linhasEstorno);

    if (errLines) {
      console.error(`  ❌ Erro ao criar linhas estorno ${entry.id}:`, errLines.message);
      await supabase.from('accounting_entries').delete().eq('id', entryId);
      errors++;
      continue;
    }

    success++;
    if (success % 20 === 0) {
      console.log(`    ... ${success} estornos criados`);
    }
  }

  console.log(`  ✅ FRENTE 2: ${success} estornos criados, ${errors} erros`);
  return { success, errors };
}

// =============================================================================
// VERIFICAÇÃO FINAL
// =============================================================================
async function verificacaoFinal() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('  VERIFICAÇÃO FINAL');
  console.log('═══════════════════════════════════════════════════════════════════════════');

  // 1. Transações sem lançamento
  const { count: semLancamento } = await supabase
    .from('bank_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .is('journal_entry_id', null)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  console.log(`  Transações sem lançamento: ${semLancamento} ${semLancamento === 0 ? '✅' : '❌'}`);

  // 2. Totais D/C
  const { data: totais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, accounting_entries!inner(entry_date, tenant_id)')
    .eq('accounting_entries.tenant_id', TENANT_ID)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  const totalD = (totais || []).reduce((s, l) => s + (l.debit || 0), 0);
  const totalC = (totais || []).reduce((s, l) => s + (l.credit || 0), 0);
  const diff = Math.abs(totalD - totalC);

  console.log(`  Total Débitos:    R$ ${totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`  Total Créditos:   R$ ${totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`  Diferença Global: R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${diff < 0.01 ? '✅' : '❌'}`);

  // 3. Saldo transitórias
  const { data: transitorias } = await supabase
    .from('accounting_entry_lines')
    .select('account_id, debit, credit, accounting_entries!inner(entry_date, tenant_id)')
    .eq('accounting_entries.tenant_id', TENANT_ID)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31')
    .in('account_id', [TRANS_DEBITOS, TRANS_CREDITOS]);

  const saldoTransD = (transitorias || [])
    .filter(l => l.account_id === TRANS_DEBITOS)
    .reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0);
  
  const saldoTransC = (transitorias || [])
    .filter(l => l.account_id === TRANS_CREDITOS)
    .reduce((s, l) => s + (l.credit || 0) - (l.debit || 0), 0);

  console.log(`  Transitória Débitos: R$ ${saldoTransD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`  Transitória Créditos: R$ ${saldoTransC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  console.log('\n═══════════════════════════════════════════════════════════════════════════');
}

// =============================================================================
// EXECUÇÃO PRINCIPAL
// =============================================================================
async function main() {
  const args = process.argv.slice(2);
  const frente = args.find(a => a.startsWith('--frente='))?.split('=')[1];
  
  if (!frente) {
    console.log('\nUso: node executar_correcao_sql.mjs --frente=1|2|all');
    console.log('  --frente=1    Executa apenas FRENTE 1 (transitórios)');
    console.log('  --frente=2    Executa apenas FRENTE 2 (estornos)');
    console.log('  --frente=all  Executa ambas as frentes');
    process.exit(1);
  }

  try {
    if (frente === '1' || frente === 'all') {
      await executarFrente1();
    }
    
    if (frente === '2' || frente === 'all') {
      await executarFrente2();
    }
    
    await verificacaoFinal();
    
    console.log('  CORREÇÃO CONCLUÍDA');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    
  } catch (err) {
    console.error('  ❌ Erro fatal:', err);
    process.exit(1);
  }
}

main();
