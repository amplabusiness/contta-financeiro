import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('=== VERIFICANDO SALDOS DA CONTA 1.1.2.01 EM DIFERENTES PERÍODOS ===\n');
  
  // Verificar diferentes períodos para encontrar R$ 18.127,95
  const periodos = [
    { start: '2024-01-01', end: '2024-01-31', label: 'Jan/2024' },
    { start: '2024-12-01', end: '2024-12-31', label: 'Dez/2024' },
    { start: '2025-01-01', end: '2025-01-31', label: 'Jan/2025' },
    { start: '2025-12-01', end: '2025-12-31', label: 'Dez/2025' },
    { start: '2026-01-01', end: '2026-01-09', label: 'Jan/2026' }
  ];

  for (const p of periodos) {
    const { data, error } = await supabase.rpc('get_account_balances', {
      p_period_start: p.start,
      p_period_end: p.end
    });

    if (error) {
      console.log(`Erro ${p.label}: ${error.message}`);
      continue;
    }

    const conta = data?.find(s => s.account_code === '1.1.2.01');
    if (conta) {
      const abertura = Number(conta.opening_balance);
      const debitos = Number(conta.total_debits);
      const creditos = Number(conta.total_credits);
      const final = Number(conta.closing_balance);
      
      console.log(`${p.label}:`);
      console.log(`  Abertura: R$ ${abertura.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      console.log(`  Débitos:  R$ ${debitos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      console.log(`  Créditos: R$ ${creditos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      console.log(`  Final:    R$ ${final.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      
      // Checar se encontramos o valor
      if (Math.abs(abertura - 18127.95) < 1) {
        console.log('  *** ENCONTRADO: Abertura ~18127.95 ***');
      }
      if (Math.abs(debitos - 1051.46) < 1) {
        console.log('  *** ENCONTRADO: Débitos ~1051.46 ***');
      }
      console.log('');
    }
  }

  // Verificar a tabela de origem dos valores
  console.log('=== FONTE DOS DADOS ===');
  console.log('Os valores vêm da função get_account_balances() que calcula:');
  console.log('1. ABERTURA: Soma de lançamentos ANTERIORES ao período');
  console.log('            + lançamentos de saldo_abertura DENTRO do período');
  console.log('2. DÉBITOS: Soma de débitos do período (exceto saldo_abertura)');
  console.log('3. CRÉDITOS: Soma de créditos do período (exceto saldo_abertura)');
  console.log('4. FINAL: Abertura + Débitos - Créditos (para contas devedoras)');
  console.log('');
  console.log('Tabelas envolvidas:');
  console.log('- chart_of_accounts: Plano de Contas');
  console.log('- accounting_entries: Lançamentos contábeis');
  console.log('- accounting_entry_lines: Linhas dos lançamentos (débito/crédito)');
}

check();
