/**
 * ANÁLISE COMPLETA DOS DADOS CONTÁBEIS
 * Paginação para buscar todos os registros
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function buscarTodos(tabela, campos = '*') {
  const todos = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tabela)
      .select(campos)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.log(`Erro ao buscar ${tabela}:`, error.message);
      break;
    }

    if (!data || data.length === 0) break;
    todos.push(...data);

    if (data.length < pageSize) break;
    page++;
  }

  return todos;
}

async function main() {
  console.log('📊 ANÁLISE COMPLETA DOS DADOS CONTÁBEIS\n');
  console.log('Buscando todos os registros (com paginação)...\n');

  // 1. Buscar todas as entries
  const todosEntries = await buscarTodos('accounting_entries', 'id, entry_date, source_type, description');
  console.log(`Total de ENTRIES: ${todosEntries.length}`);

  // 2. Buscar todas as linhas
  const todasLinhas = await buscarTodos('accounting_entry_lines', 'id, entry_id, account_id, debit, credit');
  console.log(`Total de LINHAS: ${todasLinhas.length}`);

  // 3. Buscar contas
  const contas = await buscarTodos('chart_of_accounts', 'id, code, name');
  const mapContas = {};
  contas.forEach(c => mapContas[c.id] = { code: c.code, name: c.name });
  console.log(`Total de CONTAS: ${contas.length}`);

  // 4. Entries por source_type
  console.log('\n\n📋 ENTRIES POR SOURCE_TYPE:');
  console.log('='.repeat(60));

  const porTipo = {};
  todosEntries.forEach(e => {
    const tipo = e.source_type || 'null';
    porTipo[tipo] = (porTipo[tipo] || 0) + 1;
  });

  Object.entries(porTipo).sort((a, b) => b[1] - a[1]).forEach(([tipo, qtd]) => {
    console.log(`   ${tipo.padEnd(35)}: ${qtd}`);
  });

  // 5. Verificar integridade
  const entryIds = new Set(todosEntries.map(e => e.id));

  const linhasValidas = todasLinhas.filter(l => entryIds.has(l.entry_id));
  const linhasOrfas = todasLinhas.filter(l => !entryIds.has(l.entry_id));

  console.log(`\n\n📊 INTEGRIDADE:`);
  console.log('='.repeat(60));
  console.log(`   Linhas válidas: ${linhasValidas.length}`);
  console.log(`   Linhas órfãs: ${linhasOrfas.length}`);

  // Entries com linhas
  const entryIdsComLinhas = new Set(linhasValidas.map(l => l.entry_id));
  const entriesComLinhas = todosEntries.filter(e => entryIdsComLinhas.has(e.id));
  const entriesSemLinhas = todosEntries.filter(e => !entryIdsComLinhas.has(e.id));

  console.log(`   Entries com linhas: ${entriesComLinhas.length}`);
  console.log(`   Entries sem linhas: ${entriesSemLinhas.length}`);

  // 6. Distribuição de linhas por grupo de conta
  console.log('\n\n📊 LINHAS POR GRUPO DE CONTA:');
  console.log('='.repeat(70));

  const porGrupo = {};
  linhasValidas.forEach(l => {
    const conta = mapContas[l.account_id];
    if (!conta) return;
    const grupo = conta.code.charAt(0);
    if (!porGrupo[grupo]) porGrupo[grupo] = { linhas: 0, d: 0, c: 0 };
    porGrupo[grupo].linhas++;
    porGrupo[grupo].d += parseFloat(l.debit) || 0;
    porGrupo[grupo].c += parseFloat(l.credit) || 0;
  });

  const grupoNomes = {
    '1': 'ATIVO',
    '2': 'PASSIVO',
    '3': 'RECEITAS',
    '4': 'DESPESAS',
    '5': 'PATRIMÔNIO LÍQUIDO'
  };

  Object.entries(porGrupo).sort().forEach(([grupo, vals]) => {
    const saldo = vals.c - vals.d;
    console.log(`\nGrupo ${grupo} - ${grupoNomes[grupo] || 'OUTRO'}:`);
    console.log(`   ${vals.linhas} linhas`);
    console.log(`   Débitos: R$ ${vals.d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Créditos: R$ ${vals.c.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Saldo (C-D): R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  });

  // 7. Resumo para DRE
  console.log('\n\n📊 RESUMO PARA DRE (linhas válidas):');
  console.log('='.repeat(70));

  let totalReceitas = 0;
  let totalDespesas = 0;

  linhasValidas.forEach(l => {
    const conta = mapContas[l.account_id];
    if (!conta) return;

    if (conta.code.startsWith('3.')) {
      // Receitas: saldo credor
      totalReceitas += (parseFloat(l.credit) || 0) - (parseFloat(l.debit) || 0);
    } else if (conta.code.startsWith('4.')) {
      // Despesas: saldo devedor
      totalDespesas += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
    }
  });

  console.log(`   Total Receitas (Grupo 3): R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Total Despesas (Grupo 4): R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Resultado: R$ ${(totalReceitas - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // 8. Detalhamento de receitas por conta
  console.log('\n\n📋 DETALHAMENTO RECEITAS (Grupo 3):');
  console.log('='.repeat(80));

  const receitasPorConta = {};
  linhasValidas.forEach(l => {
    const conta = mapContas[l.account_id];
    if (!conta || !conta.code.startsWith('3.')) return;

    const key = `${conta.code} ${conta.name}`;
    if (!receitasPorConta[key]) receitasPorConta[key] = { linhas: 0, d: 0, c: 0 };
    receitasPorConta[key].linhas++;
    receitasPorConta[key].d += parseFloat(l.debit) || 0;
    receitasPorConta[key].c += parseFloat(l.credit) || 0;
  });

  Object.entries(receitasPorConta)
    .sort((a, b) => (b[1].c - b[1].d) - (a[1].c - a[1].d))
    .forEach(([conta, vals]) => {
      const saldo = vals.c - vals.d;
      console.log(`${conta.substring(0, 50).padEnd(52)} | ${vals.linhas.toString().padStart(4)} linhas | Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}`);
    });

  // 9. Detalhamento de despesas por conta
  console.log('\n\n📋 DETALHAMENTO DESPESAS (Grupo 4) - Top 20:');
  console.log('='.repeat(80));

  const despesasPorConta = {};
  linhasValidas.forEach(l => {
    const conta = mapContas[l.account_id];
    if (!conta || !conta.code.startsWith('4.')) return;

    const key = `${conta.code} ${conta.name}`;
    if (!despesasPorConta[key]) despesasPorConta[key] = { linhas: 0, d: 0, c: 0 };
    despesasPorConta[key].linhas++;
    despesasPorConta[key].d += parseFloat(l.debit) || 0;
    despesasPorConta[key].c += parseFloat(l.credit) || 0;
  });

  Object.entries(despesasPorConta)
    .sort((a, b) => (b[1].d - b[1].c) - (a[1].d - a[1].c))
    .slice(0, 20)
    .forEach(([conta, vals]) => {
      const saldo = vals.d - vals.c;
      console.log(`${conta.substring(0, 50).padEnd(52)} | ${vals.linhas.toString().padStart(4)} linhas | Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}`);
    });
}

main().catch(console.error);
