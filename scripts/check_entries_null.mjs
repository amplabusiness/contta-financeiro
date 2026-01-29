import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('📊 INVESTIGANDO LINHAS COM SOURCE_TYPE NULL\n');

  // Buscar todas as linhas
  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id, account_id, debit, credit, description');

  // Buscar todos os entries
  const { data: todosEntries } = await supabase
    .from('accounting_entries')
    .select('id, source_type, entry_date, description');

  const mapEntries = {};
  todosEntries?.forEach(e => mapEntries[e.id] = e);

  console.log(`Total de entries: ${todosEntries?.length}`);
  console.log(`Total de linhas: ${todasLinhas?.length}`);

  // Contar entries por source_type
  const entriesPorTipo = {};
  todosEntries?.forEach(e => {
    const tipo = e.source_type || 'null';
    entriesPorTipo[tipo] = (entriesPorTipo[tipo] || 0) + 1;
  });

  console.log('\nEntries por source_type:');
  Object.entries(entriesPorTipo).forEach(([tipo, qtd]) => {
    console.log(`   ${tipo}: ${qtd}`);
  });

  // Verificar linhas órfãs (sem entry correspondente)
  const linhasOrfas = todasLinhas?.filter(l => !mapEntries[l.entry_id]) || [];
  console.log(`\nLinhas órfãs (sem entry): ${linhasOrfas.length}`);

  if (linhasOrfas.length > 0) {
    console.log('\nExemplos de linhas órfãs:');
    linhasOrfas.slice(0, 5).forEach(l => {
      console.log(`   entry_id: ${l.entry_id} | D: ${l.debit} C: ${l.credit} | ${l.description?.substring(0, 40)}`);
    });

    // Buscar os entry_ids órfãos
    const idsOrfaos = [...new Set(linhasOrfas.map(l => l.entry_id))];
    console.log(`\nEntry IDs órfãos únicos: ${idsOrfaos.length}`);
    console.log('IDs:', idsOrfaos.slice(0, 5));
  }

  // Buscar contas
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name');

  const mapContas = {};
  contas?.forEach(c => mapContas[c.id] = `${c.code} ${c.name}`);

  // Mostrar linhas órfãs com nome da conta
  if (linhasOrfas.length > 0) {
    console.log('\nLinhas órfãs com detalhes:');
    linhasOrfas.slice(0, 10).forEach(l => {
      const conta = mapContas[l.account_id] || 'Conta não encontrada';
      console.log(`   ${conta}`);
      console.log(`      D: ${l.debit} C: ${l.credit} | ${l.description?.substring(0, 50)}`);
    });
  }

  // Verificar se há entries com source_type null
  const entriesNull = todosEntries?.filter(e => !e.source_type) || [];
  console.log(`\n\nEntries com source_type NULL: ${entriesNull.length}`);

  if (entriesNull.length > 0) {
    console.log('\nExemplos de entries NULL:');
    entriesNull.slice(0, 10).forEach(e => {
      console.log(`   ${e.entry_date} | ${e.description?.substring(0, 60)}`);
    });
  }

  // RESUMO FINAL - quantas linhas estão em cada conta
  console.log('\n\n📊 DISTRIBUIÇÃO DE LINHAS POR CONTA:');
  console.log('='.repeat(80));

  const porConta = {};
  todasLinhas?.forEach(l => {
    const conta = mapContas[l.account_id] || l.account_id;
    if (!porConta[conta]) porConta[conta] = { linhas: 0, d: 0, c: 0 };
    porConta[conta].linhas++;
    porConta[conta].d += parseFloat(l.debit) || 0;
    porConta[conta].c += parseFloat(l.credit) || 0;
  });

  Object.entries(porConta)
    .sort((a, b) => b[1].linhas - a[1].linhas)
    .slice(0, 20)
    .forEach(([conta, vals]) => {
      const saldo = vals.c - vals.d;
      console.log(`${vals.linhas.toString().padStart(4)} | ${conta.substring(0, 45).padEnd(47)} | Saldo: R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);
    });
}

check().catch(console.error);
