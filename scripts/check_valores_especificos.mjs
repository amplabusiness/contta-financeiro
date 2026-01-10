import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Verificar lançamentos na conta sintética 1.1.2.01
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  console.log('ID da conta 1.1.2.01:', conta.id);

  // Buscar linhas de lançamento nessa conta
  const { data: linhas, count } = await supabase
    .from('accounting_entry_lines')
    .select('*, accounting_entries(entry_date, description, entry_type)', { count: 'exact' })
    .eq('account_id', conta.id)
    .limit(50);

  console.log('Total de linhas na conta 1.1.2.01:', count);

  if (linhas && linhas.length > 0) {
    console.log('\nPrimeiras linhas:');
    linhas.forEach(l => {
      const date = l.accounting_entries?.entry_date || 'N/A';
      const desc = l.accounting_entries?.description?.substring(0, 50) || 'N/A';
      console.log(`  ${date} - Déb: R$ ${(l.debit || 0).toFixed(2)} Créd: R$ ${(l.credit || 0).toFixed(2)} - ${desc}`);
    });
  }

  // Verificar valores específicos R$ 18.127,95 e R$ 1.051,46
  console.log('\n=== PROCURANDO VALORES ESPECÍFICOS ===');
  
  const { data: valorAbertura } = await supabase
    .from('accounting_entry_lines')
    .select('*, accounting_entries(entry_date, description, entry_type), chart_of_accounts(code, name)')
    .or('debit.eq.18127.95,credit.eq.18127.95')
    .limit(10);
  
  console.log('\nValor R$ 18.127,95:', valorAbertura?.length || 0, 'registros');
  valorAbertura?.forEach(l => {
    console.log(`  Conta: ${l.chart_of_accounts?.code} - ${l.accounting_entries?.entry_date} - Déb: ${l.debit} Créd: ${l.credit}`);
  });

  const { data: valorDebito } = await supabase
    .from('accounting_entry_lines')
    .select('*, accounting_entries(entry_date, description, entry_type), chart_of_accounts(code, name)')
    .or('debit.eq.1051.46,credit.eq.1051.46')
    .limit(10);
  
  console.log('\nValor R$ 1.051,46:', valorDebito?.length || 0, 'registros');
  valorDebito?.forEach(l => {
    console.log(`  Conta: ${l.chart_of_accounts?.code} - ${l.accounting_entries?.entry_date} - Déb: ${l.debit} Créd: ${l.credit}`);
  });

  // Verificar se esses valores podem ser soma de outros
  console.log('\n=== VERIFICANDO SOMAS ===');
  
  // Buscar todas as linhas da conta 1.1.2.01 (sintética)
  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, accounting_entries(entry_date, entry_type)')
    .eq('account_id', conta.id);
  
  // Agrupar por tipo e período
  const abertura = todasLinhas?.filter(l => l.accounting_entries?.entry_type === 'saldo_abertura');
  const movimento = todasLinhas?.filter(l => l.accounting_entries?.entry_type !== 'saldo_abertura');
  
  const somaAberturaD = abertura?.reduce((s, l) => s + (l.debit || 0), 0) || 0;
  const somaAberturaC = abertura?.reduce((s, l) => s + (l.credit || 0), 0) || 0;
  const somaMovimentoD = movimento?.reduce((s, l) => s + (l.debit || 0), 0) || 0;
  const somaMovimentoC = movimento?.reduce((s, l) => s + (l.credit || 0), 0) || 0;

  console.log(`Abertura: Débito R$ ${somaAberturaD.toFixed(2)} | Crédito R$ ${somaAberturaC.toFixed(2)}`);
  console.log(`Movimento: Débito R$ ${somaMovimentoD.toFixed(2)} | Crédito R$ ${somaMovimentoC.toFixed(2)}`);
  console.log(`Total: Débito R$ ${(somaAberturaD + somaMovimentoD).toFixed(2)} | Crédito R$ ${(somaAberturaC + somaMovimentoC).toFixed(2)}`);
}

check();
