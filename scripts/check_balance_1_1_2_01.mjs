import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Chamar função get_account_balances para Janeiro 2025
  const { data: saldos, error } = await supabase.rpc('get_account_balances', {
    p_period_start: '2025-01-01',
    p_period_end: '2025-01-31'
  });

  if (error) {
    console.log('Erro:', error.message);
    return;
  }

  // Filtrar conta 1.1.2.01 (sintética)
  const conta112 = saldos.find(s => s.account_code === '1.1.2.01');
  console.log('=== CONTA SINTÉTICA 1.1.2.01 ===');
  console.log(conta112 ? conta112 : 'Não encontrada na função');

  // Buscar sub-contas analíticas
  const subContas = saldos.filter(s => s.account_code.startsWith('1.1.2.01.') && s.is_analytical);
  console.log('\n=== SUB-CONTAS ANALÍTICAS DE 1.1.2.01 ===');
  console.log('Total de sub-contas:', subContas.length);
  
  // Mostrar apenas as com movimento
  const comMovimento = subContas.filter(s => 
    Number(s.opening_balance) !== 0 || 
    Number(s.total_debits) !== 0 || 
    Number(s.total_credits) !== 0
  );
  console.log('Com movimento:', comMovimento.length);

  // Somar sub-contas
  const somaAbertura = subContas.reduce((sum, s) => sum + Number(s.opening_balance || 0), 0);
  const somaDebitos = subContas.reduce((sum, s) => sum + Number(s.total_debits || 0), 0);
  const somaCreditos = subContas.reduce((sum, s) => sum + Number(s.total_credits || 0), 0);
  const somaFinal = subContas.reduce((sum, s) => sum + Number(s.closing_balance || 0), 0);

  console.log('\n=== TOTAIS (soma das contas analíticas) ===');
  console.log('Abertura:', somaAbertura.toFixed(2));
  console.log('Débitos:', somaDebitos.toFixed(2));
  console.log('Créditos:', somaCreditos.toFixed(2));
  console.log('Final:', somaFinal.toFixed(2));

  // Mostrar as maiores
  console.log('\n=== MAIORES SALDOS DE ABERTURA ===');
  const ordenadosAbertura = [...comMovimento]
    .sort((a, b) => Math.abs(Number(b.opening_balance)) - Math.abs(Number(a.opening_balance)))
    .slice(0, 10);
  
  ordenadosAbertura.forEach(s => {
    console.log(`${s.account_code} ${s.account_name.substring(0, 30).padEnd(30)} Abert: R$ ${Number(s.opening_balance).toFixed(2).padStart(12)} Déb: R$ ${Number(s.total_debits).toFixed(2).padStart(10)} Créd: R$ ${Number(s.total_credits).toFixed(2).padStart(10)}`);
  });

  // Verificar de onde vem R$ 18.127,95 de abertura
  console.log('\n=== PROCURANDO R$ 18.127,95 ===');
  const procurado = saldos.filter(s => Math.abs(Number(s.opening_balance) - 18127.95) < 0.01);
  if (procurado.length > 0) {
    console.log('Encontrado em:', procurado);
  } else {
    console.log('Não encontrado exatamente. Verificando valores próximos...');
    const proximos = saldos.filter(s => 
      Number(s.opening_balance) > 17000 && Number(s.opening_balance) < 20000
    );
    proximos.forEach(s => console.log(`${s.account_code} ${s.account_name}: R$ ${s.opening_balance}`));
  }

  // Verificar lançamentos de saldo_abertura para a conta 1.1.2.01
  console.log('\n=== VERIFICANDO LANÇAMENTOS DE ABERTURA ===');
  const { data: lancAbertura } = await supabase
    .from('accounting_entries')
    .select(`
      id, entry_date, competence_date, description, entry_type,
      accounting_entry_lines(
        debit, credit, account_id,
        chart_of_accounts(code, name)
      )
    `)
    .eq('entry_type', 'saldo_abertura')
    .limit(50);

  // Filtrar linhas que são da conta 1.1.2.01.xxx
  let totalAberturaClientes = 0;
  lancAbertura?.forEach(entry => {
    entry.accounting_entry_lines?.forEach(line => {
      if (line.chart_of_accounts?.code?.startsWith('1.1.2.01.')) {
        totalAberturaClientes += Number(line.debit || 0) - Number(line.credit || 0);
      }
    });
  });
  console.log('Total de lançamentos saldo_abertura para 1.1.2.01.xxx:', totalAberturaClientes.toFixed(2));
}

check();
