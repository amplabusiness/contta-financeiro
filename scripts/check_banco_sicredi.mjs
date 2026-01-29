/**
 * ANÁLISE DETALHADA DA CONTA BANCO SICREDI (1.1.1.05)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function buscarTodos(tabela, campos = '*', filtros = null) {
  const todos = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase.from(tabela).select(campos).range(page * pageSize, (page + 1) * pageSize - 1);

    if (filtros) {
      for (const [key, value] of Object.entries(filtros)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  return todos;
}

async function main() {
  console.log('📊 ANÁLISE DA CONTA BANCO SICREDI (1.1.1.05)\n');

  // Buscar conta
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.1.05')
    .single();

  if (!conta) {
    console.log('❌ Conta 1.1.1.05 não encontrada');
    return;
  }

  console.log(`Conta: ${conta.code} - ${conta.name}`);
  console.log(`ID: ${conta.id}\n`);

  // Buscar todas as linhas dessa conta
  const linhas = await buscarTodos('accounting_entry_lines', 'id, entry_id, debit, credit, description', { account_id: conta.id });

  console.log(`Total de linhas: ${linhas.length}`);

  // Buscar entries para ter as datas e source_types
  const entryIds = [...new Set(linhas.map(l => l.entry_id))];
  console.log(`Entry IDs únicos: ${entryIds.length}`);

  // Buscar entries em lotes
  const entries = [];
  for (let i = 0; i < entryIds.length; i += 100) {
    const lote = entryIds.slice(i, i + 100);
    const { data } = await supabase
      .from('accounting_entries')
      .select('id, entry_date, source_type, description')
      .in('id', lote);
    if (data) entries.push(...data);
  }

  const mapEntries = {};
  entries.forEach(e => mapEntries[e.id] = e);

  // Calcular totais
  let totalDebitos = 0;
  let totalCreditos = 0;

  // Agrupar por source_type
  const porTipo = {};
  // Agrupar por mês
  const porMes = {};

  linhas.forEach(l => {
    const entry = mapEntries[l.entry_id];
    const tipo = entry?.source_type || 'null';
    const mes = entry?.entry_date?.substring(0, 7) || 'sem_data';

    totalDebitos += parseFloat(l.debit) || 0;
    totalCreditos += parseFloat(l.credit) || 0;

    if (!porTipo[tipo]) porTipo[tipo] = { d: 0, c: 0, linhas: 0 };
    porTipo[tipo].d += parseFloat(l.debit) || 0;
    porTipo[tipo].c += parseFloat(l.credit) || 0;
    porTipo[tipo].linhas++;

    if (!porMes[mes]) porMes[mes] = { d: 0, c: 0, linhas: 0 };
    porMes[mes].d += parseFloat(l.debit) || 0;
    porMes[mes].c += parseFloat(l.credit) || 0;
    porMes[mes].linhas++;
  });

  console.log('\n\n📋 RESUMO POR SOURCE_TYPE:');
  console.log('='.repeat(80));
  Object.entries(porTipo).sort((a, b) => b[1].linhas - a[1].linhas).forEach(([tipo, vals]) => {
    const saldo = vals.d - vals.c;
    console.log(`\n${tipo}:`);
    console.log(`   ${vals.linhas} linhas`);
    console.log(`   Débitos: R$ ${vals.d.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Créditos: R$ ${vals.c.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Saldo (D-C): R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  });

  console.log('\n\n📋 RESUMO POR MÊS:');
  console.log('='.repeat(80));
  Object.entries(porMes).sort().forEach(([mes, vals]) => {
    const saldo = vals.d - vals.c;
    console.log(`${mes}: ${vals.linhas.toString().padStart(4)} linhas | D: R$ ${vals.d.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | C: R$ ${vals.c.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}`);
  });

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TOTAIS:');
  console.log('='.repeat(80));
  console.log(`Total Débitos: R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Total Créditos: R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Saldo (D-C): R$ ${(totalDebitos - totalCreditos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Verificar se há linhas duplicadas (mesmo entry_id, mesma conta)
  console.log('\n\n📋 VERIFICANDO DUPLICATAS:');
  const contagem = {};
  linhas.forEach(l => {
    contagem[l.entry_id] = (contagem[l.entry_id] || 0) + 1;
  });

  const duplicados = Object.entries(contagem).filter(([id, qtd]) => qtd > 1);
  console.log(`Entries com mais de uma linha nesta conta: ${duplicados.length}`);

  if (duplicados.length > 0 && duplicados.length <= 10) {
    console.log('\nExemplos de entries com múltiplas linhas:');
    for (const [entryId, qtd] of duplicados.slice(0, 5)) {
      const entry = mapEntries[entryId];
      const linhasEntry = linhas.filter(l => l.entry_id === entryId);
      console.log(`\n${entry?.entry_date} | ${entry?.source_type} | ${qtd} linhas`);
      console.log(`   ${entry?.description?.substring(0, 60)}`);
      linhasEntry.forEach(l => {
        console.log(`   D: ${l.debit} C: ${l.credit}`);
      });
    }
  }

  // Verificar entries sem linhas nesta conta (mas que deveriam ter)
  console.log('\n\n📋 VERIFICANDO INTEGRIDADE:');

  // Verificar se há linhas órfãs (entry não existe)
  const linhasOrfas = linhas.filter(l => !mapEntries[l.entry_id]);
  console.log(`Linhas órfãs (entry não existe): ${linhasOrfas.length}`);

  if (linhasOrfas.length > 0) {
    let somaOrfas = 0;
    linhasOrfas.forEach(l => {
      somaOrfas += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
    });
    console.log(`Saldo das linhas órfãs: R$ ${somaOrfas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
}

main().catch(console.error);
