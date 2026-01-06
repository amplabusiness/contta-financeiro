const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

async function main() {
  // Buscar todos os lançamentos em Clientes a Receber
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('entry_date, description, debit_account, credit_account, amount')
    .or('debit_account.like.1.1.2%,credit_account.like.1.1.2%')
    .order('entry_date')
    .order('id')
    .limit(200);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Lançamentos em Clientes a Receber (1.1.2.x):');
  console.log('=========================================');

  let totalDebito = 0;
  let totalCredito = 0;

  data.forEach(e => {
    const isDebito = e.debit_account && e.debit_account.startsWith('1.1.2');
    const isCredito = e.credit_account && e.credit_account.startsWith('1.1.2');

    if (isDebito) totalDebito += Number(e.amount);
    if (isCredito) totalCredito += Number(e.amount);

    const tipo = isDebito ? 'D' : 'C';
    const valor = Number(e.amount).toLocaleString('pt-BR', {minimumFractionDigits: 2});
    const desc = e.description ? e.description.substring(0, 60) : '';

    console.log(e.entry_date + ' | ' + tipo + ' | R$ ' + valor + ' | ' + desc);
  });

  console.log('');
  console.log('TOTAIS:');
  console.log('Total Débitos: R$', totalDebito.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('Total Créditos: R$', totalCredito.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('Saldo (D-C): R$', (totalDebito - totalCredito).toLocaleString('pt-BR', {minimumFractionDigits: 2}));
}

main();
