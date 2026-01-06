import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('=== ANÁLISE DE INADIMPLÊNCIA - FINAL DE JANEIRO/2025 ===\n');

  // 1. Saldo de Abertura em 31/12/2024 (clientes já em aberto antes de 2025)
  const { data: saldoAbertura, error: saErr } = await supabase
    .from('accounting_entries')
    .select(`
      id, entry_date, competence_date, description,
      accounting_entry_lines(
        debit, credit,
        chart_of_accounts!inner(code, name)
      )
    `)
    .eq('entry_type', 'saldo_abertura')
    .lte('competence_date', '2024-12-31');

  if (saErr) {
    console.log('Erro saldo abertura:', saErr.message);
    return;
  }

  // Calcular saldo de abertura de clientes (conta 1.1.2.01)
  let saldoAberturaClientes = 0;
  for (const e of saldoAbertura || []) {
    for (const l of e.accounting_entry_lines || []) {
      if (l.chart_of_accounts?.code?.startsWith('1.1.2.01')) {
        saldoAberturaClientes += (Number(l.debit) || 0) - (Number(l.credit) || 0);
      }
    }
  }

  console.log('1. SALDO DE ABERTURA (31/12/2024)');
  console.log('   Clientes em aberto antes de 2025: R$', saldoAberturaClientes.toFixed(2));
  console.log('   (Estes valores já eram INADIMPLÊNCIA acumulada)');

  // 2. Faturamento de Janeiro/2025 (novas faturas)
  const { data: faturamento, error: fatErr } = await supabase
    .from('accounting_entries')
    .select(`
      id, competence_date, description,
      accounting_entry_lines(
        debit, credit,
        chart_of_accounts!inner(code, name)
      )
    `)
    .eq('entry_type', 'receita_honorarios')
    .gte('competence_date', '2025-01-01')
    .lte('competence_date', '2025-01-31');

  if (fatErr) {
    console.log('Erro faturamento:', fatErr.message);
    return;
  }

  let faturamentoJaneiro = 0;
  for (const e of faturamento || []) {
    for (const l of e.accounting_entry_lines || []) {
      if (l.chart_of_accounts?.code?.startsWith('1.1.2.01')) {
        faturamentoJaneiro += Number(l.debit) || 0;
      }
    }
  }

  console.log('\n2. FATURAMENTO JANEIRO/2025');
  console.log('   Novas faturas emitidas: R$', faturamentoJaneiro.toFixed(2));
  console.log('   (Competência janeiro, vencimento em fevereiro)');

  // 3. Recebimentos em Janeiro/2025
  const { data: recebimentos, error: recErr } = await supabase
    .from('accounting_entries')
    .select(`
      id, competence_date, description,
      accounting_entry_lines(
        debit, credit,
        chart_of_accounts!inner(code, name)
      )
    `)
    .eq('entry_type', 'recebimento')
    .gte('competence_date', '2025-01-01')
    .lte('competence_date', '2025-01-31');

  if (recErr) {
    console.log('Erro recebimentos:', recErr.message);
    return;
  }

  let recebimentosJaneiro = 0;
  for (const e of recebimentos || []) {
    for (const l of e.accounting_entry_lines || []) {
      if (l.chart_of_accounts?.code?.startsWith('1.1.2.01')) {
        recebimentosJaneiro += Number(l.credit) || 0;
      }
    }
  }

  console.log('\n3. RECEBIMENTOS JANEIRO/2025');
  console.log('   Pagamentos recebidos: R$', recebimentosJaneiro.toFixed(2));
  console.log('   (Baixa de faturas anteriores + algumas de janeiro)');

  // 4. Cálculo da Inadimplência
  const saldoFinalClientes = saldoAberturaClientes + faturamentoJaneiro - recebimentosJaneiro;

  console.log('\n' + '='.repeat(60));
  console.log('CÁLCULO DO SALDO A RECEBER (31/01/2025)');
  console.log('='.repeat(60));
  console.log('Saldo Abertura (31/12/2024):     R$', saldoAberturaClientes.toFixed(2).padStart(12));
  console.log('+ Faturamento Janeiro:           R$', faturamentoJaneiro.toFixed(2).padStart(12));
  console.log('- Recebimentos Janeiro:          R$', recebimentosJaneiro.toFixed(2).padStart(12));
  console.log('-'.repeat(60));
  console.log('= SALDO A RECEBER (31/01/2025):  R$', saldoFinalClientes.toFixed(2).padStart(12));

  // 5. Análise da Inadimplência
  console.log('\n' + '='.repeat(60));
  console.log('ANÁLISE DE INADIMPLÊNCIA');
  console.log('='.repeat(60));

  // Faturas de janeiro vencem em fevereiro, então NÃO são inadimplentes em 31/01
  // Inadimplência = Saldo de abertura que ainda não foi pago
  const inadimplenciaReal = saldoAberturaClientes - recebimentosJaneiro;

  // Se recebemos mais do que o saldo de abertura, não há inadimplência histórica
  const inadimplenciaHistorica = Math.max(0, inadimplenciaReal);

  console.log('\nFaturas de Janeiro/2025 (vencimento Fev/2025):');
  console.log('   R$', faturamentoJaneiro.toFixed(2), '- NÃO são inadimplentes ainda');

  console.log('\nFaturas de períodos anteriores (já vencidas):');
  console.log('   Saldo abertura:       R$', saldoAberturaClientes.toFixed(2));
  console.log('   Recebido em janeiro:  R$', recebimentosJaneiro.toFixed(2));

  if (recebimentosJaneiro > saldoAberturaClientes) {
    console.log('\n   ✅ TODO o saldo anterior foi quitado!');
    console.log('   O excedente de R$', (recebimentosJaneiro - saldoAberturaClientes).toFixed(2));
    console.log('   são antecipações de faturas de janeiro.');
  } else {
    console.log('\n   ⚠️ INADIMPLÊNCIA (faturas vencidas não pagas):');
    console.log('   R$', inadimplenciaHistorica.toFixed(2));
  }

  // 6. Resumo Final
  console.log('\n' + '='.repeat(60));
  console.log('RESUMO FINAL - 31/01/2025');
  console.log('='.repeat(60));
  console.log('Total a Receber:              R$', saldoFinalClientes.toFixed(2).padStart(12));
  console.log('  - Faturas Jan (não vencidas): R$', faturamentoJaneiro.toFixed(2).padStart(12));
  console.log('  - Inadimplência (vencidas):   R$', inadimplenciaHistorica.toFixed(2).padStart(12));

  // Calcular percentual de inadimplência
  if (saldoAberturaClientes > 0) {
    const percInadimplencia = (inadimplenciaHistorica / saldoAberturaClientes) * 100;
    console.log('\nTaxa de Inadimplência Histórica:', percInadimplencia.toFixed(1) + '%');
    console.log('(Quanto do saldo anterior não foi recebido)');
  }
}

check().catch(console.error);
