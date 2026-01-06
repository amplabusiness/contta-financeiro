import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarDRE() {
  console.log('='.repeat(70));
  console.log('VERIFICAÇÃO DO DRE - JANEIRO/2025');
  console.log('Após correção do saldo de abertura (Dr. Cícero)');
  console.log('='.repeat(70));

  // Buscar lançamentos de janeiro/2025
  const { data: linhas, error } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit, credit,
      chart_of_accounts!inner(code, name, account_type, nature),
      accounting_entries!inner(competence_date)
    `)
    .gte('accounting_entries.competence_date', '2025-01-01')
    .lte('accounting_entries.competence_date', '2025-01-31');

  if (error) {
    console.log('Erro:', error.message);
    return;
  }

  console.log('\nTotal de linhas em Janeiro/2025:', linhas?.length || 0);

  // Agrupar por tipo de conta
  let receitas = 0;       // Grupo 3
  let despesas = 0;       // Grupo 4
  let saldoAbertura = 0;  // Grupo 5 (não deveria ter mais!)
  let patrimonioLiquido = 0; // Grupo 2.3

  const detalhes = {
    receitas: [],
    despesas: [],
    grupo5: [],
    grupo23: []
  };

  for (const l of linhas || []) {
    const code = l.chart_of_accounts?.code || '';
    const name = l.chart_of_accounts?.name || '';
    const debit = Number(l.debit) || 0;
    const credit = Number(l.credit) || 0;

    if (code.startsWith('3.')) {
      // Receitas = crédito - débito (natureza credora)
      receitas += credit - debit;
      if (credit > 0 || debit > 0) {
        detalhes.receitas.push({ code, name, debit, credit });
      }
    } else if (code.startsWith('4.')) {
      // Despesas = débito - crédito (natureza devedora)
      despesas += debit - credit;
      if (debit > 0 || credit > 0) {
        detalhes.despesas.push({ code, name, debit, credit });
      }
    } else if (code.startsWith('5.')) {
      // Grupo 5 - NÃO deveria ter mais lançamentos de saldo de abertura
      saldoAbertura += credit - debit;
      if (credit > 0 || debit > 0) {
        detalhes.grupo5.push({ code, name, debit, credit });
      }
    } else if (code.startsWith('2.3')) {
      // Patrimônio Líquido - onde estão os saldos de abertura agora
      patrimonioLiquido += credit - debit;
      if (credit > 0 || debit > 0) {
        detalhes.grupo23.push({ code, name, debit, credit });
      }
    }
  }

  // Exibir DRE
  console.log('\n' + '='.repeat(70));
  console.log('DRE - DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO');
  console.log('Período: Janeiro/2025');
  console.log('='.repeat(70));

  console.log('\n📈 RECEITAS (Grupo 3):');
  const receitasAgrupadas = new Map();
  for (const r of detalhes.receitas) {
    const key = r.code;
    if (!receitasAgrupadas.has(key)) {
      receitasAgrupadas.set(key, { code: r.code, name: r.name, valor: 0 });
    }
    receitasAgrupadas.get(key).valor += r.credit - r.debit;
  }
  for (const [, r] of receitasAgrupadas) {
    if (r.valor !== 0) {
      console.log('  ', r.code.padEnd(15), r.name.substring(0, 35).padEnd(35), 'R$', r.valor.toFixed(2).padStart(12));
    }
  }
  console.log('  ' + '-'.repeat(65));
  console.log('  TOTAL RECEITAS'.padEnd(52), 'R$', receitas.toFixed(2).padStart(12));

  console.log('\n📉 DESPESAS (Grupo 4):');
  const despesasAgrupadas = new Map();
  for (const d of detalhes.despesas) {
    const key = d.code;
    if (!despesasAgrupadas.has(key)) {
      despesasAgrupadas.set(key, { code: d.code, name: d.name, valor: 0 });
    }
    despesasAgrupadas.get(key).valor += d.debit - d.credit;
  }
  for (const [, d] of despesasAgrupadas) {
    if (d.valor !== 0) {
      console.log('  ', d.code.padEnd(15), d.name.substring(0, 35).padEnd(35), 'R$', d.valor.toFixed(2).padStart(12));
    }
  }
  console.log('  ' + '-'.repeat(65));
  console.log('  TOTAL DESPESAS'.padEnd(52), 'R$', despesas.toFixed(2).padStart(12));

  // Resultado
  const resultado = receitas - despesas;
  console.log('\n' + '='.repeat(70));
  console.log('RESULTADO DO EXERCÍCIO'.padEnd(52), 'R$', resultado.toFixed(2).padStart(12));
  console.log('='.repeat(70));

  // Verificar se grupo 5 tem valores indevidos
  console.log('\n\n📊 VERIFICAÇÃO DE CONTAS GRUPO 5 (NÃO deve afetar DRE):');
  if (detalhes.grupo5.length === 0) {
    console.log('  ✅ Nenhum lançamento no grupo 5 afetando o DRE!');
  } else {
    console.log('  ⚠️ ATENÇÃO: Ainda existem lançamentos no grupo 5:');
    for (const g of detalhes.grupo5) {
      console.log('    ', g.code, g.name, 'D:', g.debit, 'C:', g.credit);
    }
    console.log('  Total grupo 5:', saldoAbertura.toFixed(2));
  }

  console.log('\n📊 VERIFICAÇÃO DE PATRIMÔNIO LÍQUIDO (Grupo 2.3):');
  console.log('  Saldos de abertura agora estão aqui (correto):');
  const pl23Agrupado = new Map();
  for (const p of detalhes.grupo23) {
    const key = p.code;
    if (!pl23Agrupado.has(key)) {
      pl23Agrupado.set(key, { code: p.code, name: p.name, valor: 0 });
    }
    pl23Agrupado.get(key).valor += p.credit - p.debit;
  }
  for (const [, p] of pl23Agrupado) {
    if (p.valor !== 0) {
      console.log('  ', p.code.padEnd(15), p.name.substring(0, 35).padEnd(35), 'R$', p.valor.toFixed(2).padStart(12));
    }
  }
  console.log('  Total PL (2.3): R$', patrimonioLiquido.toFixed(2));

  console.log('\n✅ VERIFICAÇÃO CONCLUÍDA!');
}

verificarDRE().catch(console.error);
