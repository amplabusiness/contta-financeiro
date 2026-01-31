#!/usr/bin/env node
/**
 * corrigir_jan2025_dr_cicero.mjs
 * 
 * SCRIPT DE CORREÇÃO TÉCNICA - JANEIRO/2025
 * Autorizado por: Dr. Cícero (Protocolo AUD-202501-ML1AZROS)
 * 
 * FRENTE 1: Criar lançamentos transitórios para 158 transações sem lançamento
 * FRENTE 2: Estornar e relançar 106 lançamentos desbalanceados
 * 
 * @author Sérgio Carneiro Leão (CRC/GO 008074)
 * @date 30/01/2026
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { randomUUID } from 'crypto';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// Contas importantes
const CONTAS = {
  BANCO_SICREDI: '10d5892d-a843-4034-8d62-9fec95b8fd56',
  TRANSITORIA_DEBITOS: '3e1fd22f-fba2-4cc2-b628-9d729233bca0',
  TRANSITORIA_CREDITOS: '28085461-9e5a-4fb4-847d-c9fc047fe0a1'
};

// ============================================================================
// HELPERS
// ============================================================================

function gerarInternalCode(prefix, transactionId) {
  const timestamp = Date.now();
  const id = transactionId?.substring(0, 8) || randomUUID().substring(0, 8);
  return `${prefix}_${timestamp}_${id}`;
}

// ============================================================================
// FRENTE 1: CRIAR LANÇAMENTOS TRANSITÓRIOS
// ============================================================================

async function frente1_criarLancamentosTransitorios(dryRun = true) {
  console.log('');
  console.log('═'.repeat(80));
  console.log('  FRENTE 1: CRIAR LANÇAMENTOS TRANSITÓRIOS');
  console.log('  ' + (dryRun ? '⚠️  MODO DRY-RUN (simulação)' : '🔴 MODO EXECUÇÃO'));
  console.log('═'.repeat(80));
  
  // Buscar transações sem lançamento
  const { data: transacoes } = await supabase
    .from('bank_transactions')
    .select('id, fitid, amount, transaction_date, description')
    .eq('tenant_id', TENANT_ID)
    .is('journal_entry_id', null)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');
  
  console.log(`\n  Transações sem lançamento: ${transacoes?.length || 0}`);
  
  let criados = 0;
  let erros = 0;
  
  for (const tx of transacoes || []) {
    const amount = Math.abs(Number(tx.amount));
    const isEntrada = Number(tx.amount) > 0;
    const internalCode = gerarInternalCode('OFX_TRANS', tx.fitid);
    
    // Preparar lançamento
    const entry = {
      id: randomUUID(),
      tenant_id: TENANT_ID,
      entry_date: tx.transaction_date,
      competence_date: tx.transaction_date, // Mesmo que entry_date para transitórios
      description: `[TRANSITÓRIO] ${tx.description || 'Sem descrição'}`,
      internal_code: internalCode,
      source_type: 'ofx_transit',
      entry_type: 'MOVIMENTO',
      reference_type: 'bank_transaction',
      reference_id: tx.id
    };
    
    // Preparar linhas
    // ENTRADA: D Banco / C Transitória Créditos
    // SAÍDA:   D Transitória Débitos / C Banco
    const lines = isEntrada 
      ? [
          { account_id: CONTAS.BANCO_SICREDI, debit: amount, credit: 0, description: 'Entrada conforme extrato' },
          { account_id: CONTAS.TRANSITORIA_CREDITOS, debit: 0, credit: amount, description: 'Pendente classificação' }
        ]
      : [
          { account_id: CONTAS.TRANSITORIA_DEBITOS, debit: amount, credit: 0, description: 'Pendente classificação' },
          { account_id: CONTAS.BANCO_SICREDI, debit: 0, credit: amount, description: 'Saída conforme extrato' }
        ];
    
    if (dryRun) {
      console.log(`  [DRY] ${tx.transaction_date} | R$ ${tx.amount} | ${internalCode.substring(0, 30)}`);
      criados++;
    } else {
      // Inserir lançamento
      const { error: entryError } = await supabase
        .from('accounting_entries')
        .insert(entry);
      
      if (entryError) {
        console.error(`  [ERRO] ${tx.fitid}: ${entryError.message}`);
        erros++;
        continue;
      }
      
      // Inserir linhas
      const linesWithIds = lines.map(l => ({
        id: randomUUID(),
        tenant_id: TENANT_ID,
        entry_id: entry.id,
        ...l
      }));
      
      const { error: linesError } = await supabase
        .from('accounting_entry_lines')
        .insert(linesWithIds);
      
      if (linesError) {
        console.error(`  [ERRO LINHAS] ${tx.fitid}: ${linesError.message}`);
        erros++;
        continue;
      }
      
      // Vincular transação ao lançamento
      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({ journal_entry_id: entry.id })
        .eq('id', tx.id);
      
      if (updateError) {
        console.error(`  [ERRO VINCULO] ${tx.fitid}: ${updateError.message}`);
      }
      
      criados++;
      if (criados % 20 === 0) {
        console.log(`  ... ${criados} lançamentos criados`);
      }
    }
  }
  
  console.log('');
  console.log(`  ✅ Lançamentos criados: ${criados}`);
  console.log(`  ❌ Erros: ${erros}`);
  
  return { criados, erros };
}

// ============================================================================
// FRENTE 2: ESTORNAR LANÇAMENTOS DESBALANCEADOS
// ============================================================================

async function frente2_estornarDesbalanceados(dryRun = true) {
  console.log('');
  console.log('═'.repeat(80));
  console.log('  FRENTE 2: ESTORNAR LANÇAMENTOS DESBALANCEADOS');
  console.log('  ' + (dryRun ? '⚠️  MODO DRY-RUN (simulação)' : '🔴 MODO EXECUÇÃO'));
  console.log('═'.repeat(80));
  
  // Buscar lançamentos de janeiro
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, internal_code, description, entry_date, source_type')
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');
  
  const desbalanceados = [];
  
  for (const e of entries || []) {
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('id, debit, credit, account_id, description')
      .eq('entry_id', e.id);
    
    const totalD = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalC = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);
    const diff = totalD - totalC;
    
    if (Math.abs(diff) > 0.01) {
      desbalanceados.push({ ...e, lines, totalD, totalC, diff });
    }
  }
  
  console.log(`\n  Lançamentos desbalanceados: ${desbalanceados.length}`);
  
  let estornados = 0;
  let erros = 0;
  
  for (const entry of desbalanceados) {
    const estornoCode = `ESTORNO_${entry.internal_code || entry.id.substring(0, 8)}`;
    
    // Verificar se já existe estorno
    const { data: existing } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('internal_code', estornoCode);
    
    if (existing?.length > 0) {
      console.log(`  [SKIP] Já existe estorno: ${estornoCode}`);
      continue;
    }
    
    if (dryRun) {
      console.log(`  [DRY] Estorno: ${estornoCode} | D: R$ ${entry.totalD.toFixed(2)} | C: R$ ${entry.totalC.toFixed(2)}`);
      estornados++;
    } else {
      // Criar lançamento de estorno (inverter D/C)
      const estornoEntry = {
        id: randomUUID(),
        tenant_id: TENANT_ID,
        entry_date: entry.entry_date,
        competence_date: entry.entry_date, // Mesmo que entry_date
        description: `[ESTORNO TÉCNICO] ${entry.description || 'Lançamento desbalanceado'}`,
        internal_code: estornoCode,
        source_type: 'reversal',
        entry_type: 'ESTORNO',
        reference_type: 'accounting_entry',
        reference_id: entry.id
      };
      
      const { error: entryError } = await supabase
        .from('accounting_entries')
        .insert(estornoEntry);
      
      if (entryError) {
        console.error(`  [ERRO] ${entry.internal_code}: ${entryError.message}`);
        erros++;
        continue;
      }
      
      // Criar linhas invertidas
      const estornoLines = (entry.lines || []).map(l => ({
        id: randomUUID(),
        tenant_id: TENANT_ID,
        entry_id: estornoEntry.id,
        account_id: l.account_id,
        debit: Number(l.credit || 0),  // Inverte
        credit: Number(l.debit || 0),  // Inverte
        description: `[ESTORNO] ${l.description || ''}`
      }));
      
      const { error: linesError } = await supabase
        .from('accounting_entry_lines')
        .insert(estornoLines);
      
      if (linesError) {
        console.error(`  [ERRO LINHAS] ${entry.internal_code}: ${linesError.message}`);
        erros++;
        continue;
      }
      
      estornados++;
      if (estornados % 20 === 0) {
        console.log(`  ... ${estornados} estornos criados`);
      }
    }
  }
  
  console.log('');
  console.log(`  ✅ Estornos criados: ${estornados}`);
  console.log(`  ❌ Erros: ${erros}`);
  
  return { estornados, erros };
}

// ============================================================================
// FRENTE 3: VERIFICAÇÃO FINAL
// ============================================================================

async function verificacaoFinal() {
  console.log('');
  console.log('═'.repeat(80));
  console.log('  VERIFICAÇÃO FINAL PÓS-CORREÇÃO');
  console.log('═'.repeat(80));
  
  // 1. Transações sem lançamento
  const { count: semLanc } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .is('journal_entry_id', null)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');
  
  console.log(`\n  Transações sem lançamento: ${semLanc} ${semLanc === 0 ? '✅' : '❌'}`);
  
  // 2. Partidas dobradas
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');
  
  let totalD = 0, totalC = 0;
  let desbalanceados = 0;
  
  for (const e of entries || []) {
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('entry_id', e.id);
    
    const d = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
    const c = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);
    
    totalD += d;
    totalC += c;
    
    if (Math.abs(d - c) > 0.01) desbalanceados++;
  }
  
  const diff = Math.abs(totalD - totalC);
  
  console.log(`  Total Débitos:    R$ ${totalD.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`  Total Créditos:   R$ ${totalC.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`  Diferença Global: R$ ${diff.toLocaleString('pt-BR', {minimumFractionDigits: 2})} ${diff < 0.01 ? '✅' : '❌'}`);
  console.log(`  Desbalanceados:   ${desbalanceados} ${desbalanceados === 0 ? '✅' : '❌'}`);
  
  // 3. Transitórias
  const transitoriasOk = await verificarTransitorias();
  
  console.log('');
  console.log('═'.repeat(80));
  
  return {
    semLancamento: semLanc,
    diferenca: diff,
    desbalanceados,
    transitoriasOk
  };
}

async function verificarTransitorias() {
  const contas = [
    { id: CONTAS.TRANSITORIA_DEBITOS, nome: '1.1.9.01 Transitória Débitos' },
    { id: CONTAS.TRANSITORIA_CREDITOS, nome: '2.1.9.01 Transitória Créditos' }
  ];
  
  console.log('\n  SALDO DAS TRANSITÓRIAS:');
  
  let todasZeradas = true;
  
  for (const conta of contas) {
    const { data: entries } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .gte('entry_date', '2025-01-01')
      .lte('entry_date', '2025-01-31');
    
    let totalD = 0, totalC = 0;
    
    if (entries?.length) {
      const entryIds = entries.map(e => e.id);
      const { data: lines } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('account_id', conta.id)
        .in('entry_id', entryIds);
      
      totalD = (lines || []).reduce((s, l) => s + Number(l.debit || 0), 0);
      totalC = (lines || []).reduce((s, l) => s + Number(l.credit || 0), 0);
    }
    
    const saldo = totalD - totalC;
    const zerada = Math.abs(saldo) < 0.01;
    
    console.log(`    ${conta.nome}: R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})} ${zerada ? '✅' : '⚠️'}`);
    
    if (!zerada) todasZeradas = false;
  }
  
  return todasZeradas;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const frente = args.find(a => a.startsWith('--frente='))?.split('=')[1];
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                           ║');
  console.log('║           CORREÇÃO TÉCNICA - JANEIRO/2025 - DR. CÍCERO                   ║');
  console.log('║                                                                           ║');
  console.log('║  Protocolo: AUD-202501-ML1AZROS                                          ║');
  console.log('║  Autorizado por: Dr. Cícero (Auditor Contábil)                           ║');
  console.log('║                                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  
  if (dryRun) {
    console.log('');
    console.log('  ⚠️  MODO DRY-RUN (simulação)');
    console.log('  Para executar de verdade, use: --execute');
    console.log('');
  }
  
  if (!frente || frente === '1' || frente === 'all') {
    await frente1_criarLancamentosTransitorios(dryRun);
  }
  
  if (!frente || frente === '2' || frente === 'all') {
    await frente2_estornarDesbalanceados(dryRun);
  }
  
  if (!dryRun || frente === 'verify') {
    await verificacaoFinal();
  }
  
  console.log('');
}

main().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
