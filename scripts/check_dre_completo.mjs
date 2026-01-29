import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('🔍 ANÁLISE COMPLETA DO DRE\n');

  // 1. Total de lançamentos por source_type
  const { data: allEntries } = await supabase
    .from('accounting_entries')
    .select('id, source_type, entry_date');

  console.log(`Total de lançamentos no banco: ${allEntries?.length || 0}`);

  const porTipo = {};
  allEntries?.forEach(e => {
    const tipo = e.source_type || 'null';
    porTipo[tipo] = (porTipo[tipo] || 0) + 1;
  });

  console.log('\nLançamentos por source_type:');
  Object.entries(porTipo).sort((a, b) => b[1] - a[1]).forEach(([tipo, qtd]) => {
    console.log(`   ${tipo.padEnd(25)}: ${qtd}`);
  });

  // 2. Total de linhas
  const { count: totalLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal de linhas: ${totalLinhas}`);

  // 3. Verificar contas mais usadas
  const { data: linhasPorConta } = await supabase
    .from('accounting_entry_lines')
    .select('account_id');

  const contasUsadas = {};
  linhasPorConta?.forEach(l => {
    contasUsadas[l.account_id] = (contasUsadas[l.account_id] || 0) + 1;
  });

  // Buscar nomes das contas
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name');

  const mapContas = {};
  contas?.forEach(c => mapContas[c.id] = `${c.code} - ${c.name}`);

  console.log('\nTop 15 contas mais usadas:');
  Object.entries(contasUsadas)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([id, qtd]) => {
      console.log(`   ${(mapContas[id] || id).substring(0, 50).padEnd(52)}: ${qtd} linhas`);
    });

  // 4. Verificar saldos das contas de receita (grupo 3)
  console.log('\n\n📊 SALDOS DAS CONTAS DE RECEITA (Grupo 3):');
  console.log('-'.repeat(90));

  const contasGrupo3 = contas?.filter(c => c.code.startsWith('3.')) || [];

  for (const conta of contasGrupo3) {
    const { data: linhasConta } = await supabase
      .from('accounting_entry_lines')
      .select('credit, debit')
      .eq('account_id', conta.id);

    let totalC = 0, totalD = 0;
    linhasConta?.forEach(l => {
      totalC += parseFloat(l.credit) || 0;
      totalD += parseFloat(l.debit) || 0;
    });

    if (linhasConta && linhasConta.length > 0) {
      const saldo = totalC - totalD;
      console.log(`${conta.code.padEnd(15)} ${conta.name.substring(0, 35).padEnd(37)} | ${linhasConta.length.toString().padStart(5)} linhas | Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}`);
    }
  }

  // 5. Verificar contas de despesa (grupo 4)
  console.log('\n\n📊 SALDOS DAS CONTAS DE DESPESA (Grupo 4):');
  console.log('-'.repeat(90));

  const contasGrupo4 = contas?.filter(c => c.code.startsWith('4.')) || [];

  let totalDespesas = 0;
  for (const conta of contasGrupo4) {
    const { data: linhasConta } = await supabase
      .from('accounting_entry_lines')
      .select('credit, debit')
      .eq('account_id', conta.id);

    let totalC = 0, totalD = 0;
    linhasConta?.forEach(l => {
      totalC += parseFloat(l.credit) || 0;
      totalD += parseFloat(l.debit) || 0;
    });

    if (linhasConta && linhasConta.length > 0) {
      const saldo = totalD - totalC; // Despesas são devedoras
      totalDespesas += saldo;
      if (Math.abs(saldo) > 100) { // Só mostrar contas com saldo > 100
        console.log(`${conta.code.padEnd(15)} ${conta.name.substring(0, 35).padEnd(37)} | ${linhasConta.length.toString().padStart(5)} linhas | Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}`);
      }
    }
  }

  console.log('-'.repeat(90));
  console.log(`TOTAL DESPESAS: R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // 6. Verificar o que o DRE está mostrando
  console.log('\n\n🎯 SIMULANDO DRE JANEIRO/2025:');

  // Buscar entries de Janeiro
  const { data: entriesJan } = await supabase
    .from('accounting_entries')
    .select('id')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const idsJan = entriesJan?.map(e => e.id) || [];
  console.log(`Lançamentos em Janeiro/2025: ${idsJan.length}`);

  // Buscar linhas desses lançamentos
  let receitasJan = 0, despesasJan = 0;

  // Em lotes de 100
  for (let i = 0; i < idsJan.length; i += 100) {
    const lote = idsJan.slice(i, i + 100);
    const { data: linhasLote } = await supabase
      .from('accounting_entry_lines')
      .select('account_id, credit, debit')
      .in('entry_id', lote);

    linhasLote?.forEach(l => {
      const conta = mapContas[l.account_id] || '';
      if (conta.startsWith('3.')) {
        receitasJan += (parseFloat(l.credit) || 0) - (parseFloat(l.debit) || 0);
      } else if (conta.startsWith('4.')) {
        despesasJan += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
      }
    });
  }

  console.log(`Receitas Janeiro: R$ ${receitasJan.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Despesas Janeiro: R$ ${despesasJan.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Resultado Janeiro: R$ ${(receitasJan - despesasJan).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

check().catch(console.error);
