/**
 * ANÁLISE DA CONTA CLIENTES A RECEBER (1.1.2.01)
 * Verificar se lançamentos estão na conta sintética ou analíticas
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('📊 ANÁLISE DA CONTA CLIENTES A RECEBER\n');

  // 1. Buscar estrutura do plano de contas 1.1.2.01.x
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_synthetic, is_analytical, is_active')
    .like('code', '1.1.2.01%')
    .order('code');

  console.log('📋 ESTRUTURA DO PLANO DE CONTAS (1.1.2.01.x):');
  console.log('='.repeat(80));

  const contaSintetica = contas?.find(c => c.code === '1.1.2.01');
  const contasAnaliticas = contas?.filter(c => c.code !== '1.1.2.01' && c.is_active) || [];

  console.log(`\nConta Sintética: ${contaSintetica?.code} - ${contaSintetica?.name}`);
  console.log(`   is_synthetic: ${contaSintetica?.is_synthetic}`);
  console.log(`   is_analytical: ${contaSintetica?.is_analytical}`);
  console.log(`   ID: ${contaSintetica?.id}`);

  console.log(`\nContas Analíticas (ativas): ${contasAnaliticas.length}`);
  contasAnaliticas.slice(0, 10).forEach(c => {
    console.log(`   ${c.code} - ${c.name}`);
  });
  if (contasAnaliticas.length > 10) {
    console.log(`   ... e mais ${contasAnaliticas.length - 10} contas`);
  }

  // 2. Buscar lançamentos na conta SINTÉTICA
  console.log('\n\n📊 LANÇAMENTOS NA CONTA SINTÉTICA (1.1.2.01):');
  console.log('='.repeat(80));

  if (contaSintetica) {
    const { data: linhasSintetica, count } = await supabase
      .from('accounting_entry_lines')
      .select('id, entry_id, debit, credit, description', { count: 'exact' })
      .eq('account_id', contaSintetica.id)
      .limit(20);

    console.log(`Total de linhas na conta sintética: ${count}`);

    if (linhasSintetica && linhasSintetica.length > 0) {
      let totalD = 0, totalC = 0;

      // Buscar entries para ter source_type
      const entryIds = linhasSintetica.map(l => l.entry_id);
      const { data: entries } = await supabase
        .from('accounting_entries')
        .select('id, source_type, entry_date, description')
        .in('id', entryIds);

      const mapEntries = {};
      entries?.forEach(e => mapEntries[e.id] = e);

      console.log('\nExemplos:');
      linhasSintetica.forEach(l => {
        const entry = mapEntries[l.entry_id];
        totalD += parseFloat(l.debit) || 0;
        totalC += parseFloat(l.credit) || 0;
        console.log(`   ${entry?.entry_date} | ${entry?.source_type?.padEnd(20) || 'null'.padEnd(20)} | D: ${l.debit} C: ${l.credit}`);
        console.log(`      ${entry?.description?.substring(0, 60)}`);
      });

      // Buscar total completo
      const { data: allLinhas } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('account_id', contaSintetica.id);

      let totalDebitoSintetica = 0, totalCreditoSintetica = 0;
      allLinhas?.forEach(l => {
        totalDebitoSintetica += parseFloat(l.debit) || 0;
        totalCreditoSintetica += parseFloat(l.credit) || 0;
      });

      console.log(`\nTOTAIS NA CONTA SINTÉTICA:`);
      console.log(`   Débitos: R$ ${totalDebitoSintetica.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`   Créditos: R$ ${totalCreditoSintetica.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`   Saldo: R$ ${(totalDebitoSintetica - totalCreditoSintetica).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
  }

  // 3. Buscar lançamentos nas contas ANALÍTICAS
  console.log('\n\n📊 LANÇAMENTOS NAS CONTAS ANALÍTICAS:');
  console.log('='.repeat(80));

  let totalDebitoAnaliticas = 0, totalCreditoAnaliticas = 0, totalLinhasAnaliticas = 0;

  for (const conta of contasAnaliticas) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    if (linhas && linhas.length > 0) {
      let d = 0, c = 0;
      linhas.forEach(l => {
        d += parseFloat(l.debit) || 0;
        c += parseFloat(l.credit) || 0;
      });

      totalDebitoAnaliticas += d;
      totalCreditoAnaliticas += c;
      totalLinhasAnaliticas += linhas.length;

      if (d > 0 || c > 0) {
        console.log(`${conta.code} ${conta.name.substring(0, 35).padEnd(37)} | ${linhas.length.toString().padStart(4)} linhas | D: R$ ${d.toLocaleString('pt-BR').padStart(10)} | C: R$ ${c.toLocaleString('pt-BR').padStart(10)}`);
      }
    }
  }

  console.log(`\nTOTAIS NAS CONTAS ANALÍTICAS:`);
  console.log(`   Total de linhas: ${totalLinhasAnaliticas}`);
  console.log(`   Débitos: R$ ${totalDebitoAnaliticas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Créditos: R$ ${totalCreditoAnaliticas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Saldo: R$ ${(totalDebitoAnaliticas - totalCreditoAnaliticas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // 4. Agrupar lançamentos sintéticos por source_type
  console.log('\n\n📊 LANÇAMENTOS SINTÉTICOS POR SOURCE_TYPE:');
  console.log('='.repeat(80));

  if (contaSintetica) {
    // Buscar todas as linhas da conta sintética
    const { data: todasLinhas } = await supabase
      .from('accounting_entry_lines')
      .select('entry_id, debit, credit')
      .eq('account_id', contaSintetica.id);

    // Buscar entries em lotes
    const entryIds = [...new Set(todasLinhas?.map(l => l.entry_id) || [])];
    const entries = [];
    for (let i = 0; i < entryIds.length; i += 100) {
      const lote = entryIds.slice(i, i + 100);
      const { data } = await supabase
        .from('accounting_entries')
        .select('id, source_type')
        .in('id', lote);
      if (data) entries.push(...data);
    }

    const mapEntries = {};
    entries.forEach(e => mapEntries[e.id] = e.source_type);

    const porTipo = {};
    todasLinhas?.forEach(l => {
      const tipo = mapEntries[l.entry_id] || 'null';
      if (!porTipo[tipo]) porTipo[tipo] = { linhas: 0, d: 0, c: 0 };
      porTipo[tipo].linhas++;
      porTipo[tipo].d += parseFloat(l.debit) || 0;
      porTipo[tipo].c += parseFloat(l.credit) || 0;
    });

    Object.entries(porTipo).sort((a, b) => b[1].linhas - a[1].linhas).forEach(([tipo, vals]) => {
      console.log(`\n${tipo}:`);
      console.log(`   ${vals.linhas} linhas | D: R$ ${vals.d.toLocaleString('pt-BR')} | C: R$ ${vals.c.toLocaleString('pt-BR')}`);
    });
  }

  // 5. Diagnóstico
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 DIAGNÓSTICO:');
  console.log('='.repeat(80));

  console.log('\n⚠️  PROBLEMA: Lançamentos estão na conta SINTÉTICA ao invés das ANALÍTICAS');
  console.log('\nConforme NBC TG 26 e ITG 2000:');
  console.log('   - Contas sintéticas (grupos) NÃO recebem lançamentos diretos');
  console.log('   - Lançamentos devem ir nas contas analíticas (folhas)');
  console.log('   - O saldo da sintética é a SOMA das analíticas');

  console.log('\nSOLUÇÃO NECESSÁRIA:');
  console.log('   1. Criar contas analíticas por cliente (se não existirem)');
  console.log('   2. Reclassificar lançamentos da sintética para as analíticas');
  console.log('   3. Ou manter 1.1.2.01 como analítica (se não houver subcontas)');
}

main().catch(console.error);
