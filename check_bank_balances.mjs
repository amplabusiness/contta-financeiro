import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  'https://xdtlhzysrpoinqtsglmr.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tenantId = 'a53a4957-fe97-4856-b3ca-70045157b421';

// Valores do extrato bancário
const EXTRATO = {
  '2024-12-31': 90725.06,
  '2025-01-01': 90725.06,
  '2025-01-31': 18553.54
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICAÇÃO DE SALDOS BANCÁRIOS - EXTRATO vs SISTEMA      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 1. Verificar saldo na tabela bank_accounts
  console.log('═══ 1. SALDO EM BANK_ACCOUNTS ═══');
  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('id, name, bank_name, current_balance, opening_balance')
    .eq('tenant_id', tenantId);

  if (bankAccounts?.length > 0) {
    bankAccounts.forEach(acc => {
      console.log(`📊 ${acc.name} (${acc.bank_name})`);
      console.log(`   Saldo Abertura: R$ ${(acc.opening_balance || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      console.log(`   Saldo Atual: R$ ${(acc.current_balance || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    });
  } else {
    console.log('⚠️  Nenhuma conta bancária encontrada');
  }

  // 2. Verificar plano de contas - contas de caixa/banco
  console.log('\n═══ 2. CONTAS CONTÁBEIS CAIXA/BANCO (1.1.1 e 1.1.3) ═══');
  const { data: cashAccounts } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .eq('tenant_id', tenantId)
    .or('code.like.1.1.1%,code.like.1.1.3%')
    .order('code');

  console.log(`Contas encontradas: ${cashAccounts?.length || 0}`);
  if (cashAccounts) {
    for (const acc of cashAccounts) {
      console.log(`   ${acc.code} - ${acc.name}`);
    }
  }

  // 3. Calcular saldo contábil das contas de caixa/banco
  console.log('\n═══ 3. SALDO CONTÁBIL POR DATA ═══');
  
  // Saldo até 31/12/2024
  const { data: lines2024 } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, account_code, accounting_entries!inner(entry_date, tenant_id)')
    .eq('accounting_entries.tenant_id', tenantId)
    .like('account_code', '1.1.1%')
    .lte('accounting_entries.entry_date', '2024-12-31');

  const saldo2024 = (lines2024 || []).reduce((sum, l) => {
    return sum + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
  }, 0);

  // Saldo até 31/01/2025
  const { data: lines2025 } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, account_code, accounting_entries!inner(entry_date, tenant_id)')
    .eq('accounting_entries.tenant_id', tenantId)
    .like('account_code', '1.1.1%')
    .lte('accounting_entries.entry_date', '2025-01-31');

  const saldo2025 = (lines2025 || []).reduce((sum, l) => {
    return sum + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
  }, 0);

  console.log(`\n📅 Saldo Contábil 31/12/2024: R$ ${saldo2024.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`📅 Saldo Extrato  31/12/2024: R$ ${EXTRATO['2024-12-31'].toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Diferença: R$ ${(saldo2024 - EXTRATO['2024-12-31']).toLocaleString('pt-BR', {minimumFractionDigits: 2})} ${Math.abs(saldo2024 - EXTRATO['2024-12-31']) < 0.01 ? '✅' : '❌'}`);

  console.log(`\n📅 Saldo Contábil 31/01/2025: R$ ${saldo2025.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`📅 Saldo Extrato  31/01/2025: R$ ${EXTRATO['2025-01-31'].toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Diferença: R$ ${(saldo2025 - EXTRATO['2025-01-31']).toLocaleString('pt-BR', {minimumFractionDigits: 2})} ${Math.abs(saldo2025 - EXTRATO['2025-01-31']) < 0.01 ? '✅' : '❌'}`);

  // 4. Verificar transações bancárias de janeiro/2025
  console.log('\n═══ 4. TRANSAÇÕES BANCÁRIAS JAN/2025 ═══');
  const { data: txns } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  if (txns && txns.length > 0) {
    let totalEntradas = 0;
    let totalSaidas = 0;
    
    txns.forEach(t => {
      const amount = parseFloat(t.amount) || 0;
      if (t.type === 'credit' || amount > 0) {
        totalEntradas += Math.abs(amount);
      } else {
        totalSaidas += Math.abs(amount);
      }
    });
    
    console.log(`Total transações: ${txns.length}`);
    console.log(`Entradas: R$ ${totalEntradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`Saídas: R$ ${totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`Movimento líquido: R$ ${(totalEntradas - totalSaidas).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  } else {
    console.log('⚠️  Nenhuma transação bancária em Janeiro/2025');
  }

  // 5. Verificar opening_balance na tabela específica
  console.log('\n═══ 5. CLIENT_OPENING_BALANCE (se existir) ═══');
  const { data: openingBalances } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(5);

  console.log(`Registros encontrados: ${openingBalances?.length || 0}`);

  // 6. Movimento esperado
  console.log('\n═══ 6. VERIFICAÇÃO FINAL ═══');
  const movimentoEsperado = EXTRATO['2024-12-31'] - EXTRATO['2025-01-31'];
  console.log(`Saldo Inicial (01/01/2025): R$ ${EXTRATO['2025-01-01'].toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`Saldo Final (31/01/2025):   R$ ${EXTRATO['2025-01-31'].toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`Movimento Líquido Jan/2025: R$ ${movimentoEsperado.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (saída líquida)`);

  // 7. Verificar se existe lançamento de abertura para banco
  console.log('\n═══ 7. LANÇAMENTO DE ABERTURA BANCO ═══');
  const { data: aberturaEntries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .eq('tenant_id', tenantId)
    .eq('entry_date', '2025-01-01')
    .or('entry_type.eq.ABERTURA,description.ilike.%abertura%,description.ilike.%saldo inicial%')
    .limit(10);

  if (aberturaEntries?.length > 0) {
    console.log(`Encontrados ${aberturaEntries.length} lançamentos de abertura:`);
    for (const entry of aberturaEntries.slice(0, 5)) {
      console.log(`   ${entry.id.slice(0,8)}... | ${entry.entry_date} | ${entry.entry_type} | ${entry.description?.slice(0, 50)}`);
    }
  } else {
    console.log('⚠️  Nenhum lançamento de abertura encontrado');
  }
}

main().catch(console.error);
