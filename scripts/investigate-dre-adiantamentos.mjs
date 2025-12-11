// Script para investigar lançamentos em 4.1.2.99 (Outras Despesas Administrativas)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function investigate() {
  console.log('=== INVESTIGANDO LANÇAMENTOS EM 4.1.2.99 ===\n');

  // 1. Buscar a conta 4.1.2.99
  const { data: conta, error: contaErr } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('code', '4.1.2.99')
    .single();

  if (contaErr || !conta) {
    console.log('❌ Conta 4.1.2.99 não encontrada:', contaErr?.message);
    return;
  }

  console.log('Conta encontrada:', conta.name);
  console.log('ID:', conta.id, '\n');

  // 2. Buscar todos os lançamentos nessa conta
  const { data: lines, error: linesErr } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      debit,
      credit,
      description,
      entry_id (
        id,
        description,
        entry_date,
        transaction_id
      )
    `)
    .eq('account_id', conta.id);

  if (linesErr) {
    console.log('❌ Erro ao buscar linhas:', linesErr.message);
    return;
  }

  console.log(`Total de linhas em 4.1.2.99: ${lines?.length || 0}\n`);

  // Somar valores
  let totalDebito = 0;
  let totalCredito = 0;

  // Agrupar por descrição para entender os padrões
  const padroes = {};

  for (const line of lines || []) {
    totalDebito += line.debit || 0;
    totalCredito += line.credit || 0;

    const desc = line.entry_id?.description || 'SEM DESCRIÇÃO';
    if (!padroes[desc]) {
      padroes[desc] = { count: 0, total: 0, sample_entry_id: line.entry_id?.id };
    }
    padroes[desc].count++;
    padroes[desc].total += (line.debit || 0) - (line.credit || 0);
  }

  console.log('=== TOTAIS ===');
  console.log(`Débito: R$ ${totalDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Crédito: R$ ${totalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Saldo: R$ ${(totalDebito - totalCredito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`);

  console.log('=== PADRÕES DE DESCRIÇÃO ===');
  const sortedPadroes = Object.entries(padroes).sort((a, b) => b[1].total - a[1].total);

  for (const [desc, info] of sortedPadroes.slice(0, 20)) {
    console.log(`\n${desc}`);
    console.log(`  Qtd: ${info.count} | Total: R$ ${info.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  // 3. Buscar transações bancárias associadas
  console.log('\n\n=== TRANSAÇÕES BANCÁRIAS ASSOCIADAS ===\n');

  const entryIds = lines?.map(l => l.entry_id?.id).filter(Boolean) || [];
  const uniqueEntryIds = [...new Set(entryIds)];

  const { data: entries, error: entriesErr } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      description,
      transaction_id
    `)
    .in('id', uniqueEntryIds.slice(0, 50));

  const txIds = entries?.map(e => e.transaction_id).filter(Boolean) || [];

  if (txIds.length > 0) {
    const { data: txs, error: txErr } = await supabase
      .from('bank_transactions')
      .select('id, description, amount, transaction_date, type')
      .in('id', txIds);

    console.log('Transações bancárias encontradas:', txs?.length || 0);

    // Padrões de transações
    const txPadroes = {};
    for (const tx of txs || []) {
      // Extrair padrão principal da descrição
      let padrao = tx.description?.split('-')[0]?.trim() || tx.description || 'DESCONHECIDO';
      padrao = padrao.substring(0, 50);

      if (!txPadroes[padrao]) {
        txPadroes[padrao] = { count: 0, total: 0 };
      }
      txPadroes[padrao].count++;
      txPadroes[padrao].total += Math.abs(tx.amount || 0);
    }

    console.log('\nPadrões de transações:');
    const sortedTxPadroes = Object.entries(txPadroes).sort((a, b) => b[1].total - a[1].total);
    for (const [padrao, info] of sortedTxPadroes.slice(0, 15)) {
      console.log(`  ${padrao}: ${info.count}x | R$ ${info.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
  }

  // 4. Verificar contas de adiantamento existentes
  console.log('\n\n=== CONTAS DE ADIANTAMENTO EXISTENTES ===\n');

  const { data: contasAdiant, error: adiantErr } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .like('code', '1.1.3%');

  if (contasAdiant?.length > 0) {
    for (const c of contasAdiant) {
      console.log(`${c.code} - ${c.name}`);
    }
  } else {
    console.log('⚠️ Nenhuma conta de adiantamento 1.1.3.xx encontrada!');
  }
}

investigate().catch(console.error);
