const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_service_role
);

async function main() {
  console.log('=== RAZÃO COMPLETO: CLIENTES A RECEBER (1.1.2.01) ===\n');

  // Buscar conta
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('code', '1.1.2.01')
    .single();

  if (!conta) {
    console.log('Conta não encontrada');
    return;
  }

  // Buscar TODOS os lançamentos
  const { data: linhas, error } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit,
      credit,
      accounting_entries!inner (
        entry_date,
        description,
        entry_type
      )
    `)
    .eq('account_id', conta.id);

  if (error) {
    console.log('Erro:', error.message);
    return;
  }

  // Ordenar por data
  linhas.sort((a, b) => {
    const dateA = a.accounting_entries?.entry_date || '';
    const dateB = b.accounting_entries?.entry_date || '';
    return dateA.localeCompare(dateB);
  });

  let saldoInicial = 0;
  let totalDebitosJan = 0;
  let totalCreditosJan = 0;

  console.log('DATA       | TIPO | VALOR         | DESCRIÇÃO');
  console.log('-'.repeat(80));

  linhas.forEach(l => {
    const d = Number(l.debit) || 0;
    const c = Number(l.credit) || 0;
    const data = l.accounting_entries?.entry_date || '';
    const desc = (l.accounting_entries?.description || '').substring(0, 45);
    const tipo = d > 0 ? 'D' : 'C';
    const valor = (d > 0 ? d : c).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    // Separar saldo inicial (antes de 2025) e movimentos de janeiro
    if (data <= '2024-12-31') {
      saldoInicial += (d - c);
      console.log(data + ' | [SI] | R$ ' + valor.padStart(12) + ' | ' + desc);
    } else if (data >= '2025-01-01' && data <= '2025-01-31') {
      totalDebitosJan += d;
      totalCreditosJan += c;
      console.log(data + ' | ' + tipo + '    | R$ ' + valor.padStart(12) + ' | ' + desc);
    }
  });

  console.log('-'.repeat(80));
  console.log('\n=== RESUMO DO RAZÃO (FORMATO NBC TG 26) ===\n');
  console.log('Saldo Inicial (31/12/2024).... R$', saldoInicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('(+) Débitos Janeiro/2025...... R$', totalDebitosJan.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('(-) Créditos Janeiro/2025..... R$', totalCreditosJan.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('                                  ' + '-'.repeat(15));
  console.log('(=) Saldo Final (31/01/2025).. R$', (saldoInicial + totalDebitosJan - totalCreditosJan).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

  // Também verificar lançamentos a débito (faturamento)
  console.log('\n=== LANÇAMENTOS A DÉBITO (Faturamento) EM JAN/2025 ===');
  const debitosJan = linhas.filter(l => {
    const d = Number(l.debit) || 0;
    const data = l.accounting_entries?.entry_date || '';
    return d > 0 && data >= '2025-01-01' && data <= '2025-01-31';
  });

  if (debitosJan.length === 0) {
    console.log('Nenhum lançamento a débito encontrado em Janeiro/2025');
    console.log('ATENÇÃO: Isto significa que não houve faturamento (emissão de NFs) em Janeiro!');
  } else {
    debitosJan.forEach(l => {
      const d = Number(l.debit);
      const data = l.accounting_entries?.entry_date;
      const desc = l.accounting_entries?.description;
      console.log(data + ' | R$ ' + d.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' | ' + desc);
    });
  }
}

main();
