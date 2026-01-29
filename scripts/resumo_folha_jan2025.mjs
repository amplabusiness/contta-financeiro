/**
 * RESUMO DA FOLHA DE PAGAMENTO - JANEIRO/2025
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .in('entry_type', ['PAGAMENTO_SALARIO', 'ADIANTAMENTO_SALARIO'])
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31')
    .order('entry_date');

  const porFuncionario = {};

  for (const entry of entries || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, account:chart_of_accounts(code)')
      .eq('entry_id', entry.id);

    const itemDebito = items?.find(i => parseFloat(i.debit) > 0);
    const valor = parseFloat(itemDebito?.debit) || 0;

    const match = entry.description.match(/^([^-]+)/);
    const nome = match ? match[1].trim() : 'DESCONHECIDO';
    const contaCode = itemDebito?.account?.code || '';
    const tipo = contaCode.startsWith('4.1.1') ? 'CLT' : 'PJ';

    if (!porFuncionario[nome]) {
      porFuncionario[nome] = { tipo, total: 0, lancamentos: [] };
    }
    porFuncionario[nome].total += valor;
    porFuncionario[nome].lancamentos.push({
      data: entry.entry_date,
      valor,
      tipoLanc: entry.entry_type
    });
  }

  console.log('RESUMO POR FUNCIONÁRIO - JANEIRO/2025');
  console.log('═'.repeat(100));

  let totalCLT = 0;
  let totalPJ = 0;

  console.log('');
  console.log('FUNCIONÁRIOS CLT:');
  console.log('-'.repeat(100));
  for (const nome of Object.keys(porFuncionario).sort()) {
    const dados = porFuncionario[nome];
    if (dados.tipo !== 'CLT') continue;

    console.log('');
    console.log(`>> ${nome} - Total: R$ ${dados.total.toFixed(2)}`);
    for (const l of dados.lancamentos) {
      const dia = new Date(l.data).getDate();
      let tipo = l.tipoLanc === 'ADIANTAMENTO_SALARIO' ? 'ADIANT' : 'PAGTO';
      console.log(`   ${l.data} (dia ${String(dia).padStart(2)}) | ${tipo} | R$ ${l.valor.toFixed(2).padStart(10)}`);
    }
    totalCLT += dados.total;
  }
  console.log('');
  console.log('-'.repeat(50));
  console.log(`SUBTOTAL CLT: R$ ${totalCLT.toFixed(2)}`);

  console.log('');
  console.log('TERCEIRIZADOS PJ:');
  console.log('-'.repeat(100));
  for (const nome of Object.keys(porFuncionario).sort()) {
    const dados = porFuncionario[nome];
    if (dados.tipo !== 'PJ') continue;

    console.log('');
    console.log(`>> ${nome} - Total: R$ ${dados.total.toFixed(2)}`);
    for (const l of dados.lancamentos) {
      const dia = new Date(l.data).getDate();
      console.log(`   ${l.data} (dia ${String(dia).padStart(2)}) | R$ ${l.valor.toFixed(2).padStart(10)}`);
    }
    totalPJ += dados.total;
  }
  console.log('');
  console.log('-'.repeat(50));
  console.log(`SUBTOTAL PJ: R$ ${totalPJ.toFixed(2)}`);

  console.log('');
  console.log('═'.repeat(100));
  console.log(`TOTAL GERAL: R$ ${(totalCLT + totalPJ).toFixed(2)}`);
}

main().catch(console.error);
