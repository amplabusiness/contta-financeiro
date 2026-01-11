/**
 * DIAGNÓSTICO COMPLETO - Conforme especificação MCP Financeiro v2.0
 * Valida todas as regras do Dr. Cícero
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function buscarTodos(tabela, campos = '*', filtros = {}) {
  let todos = [];
  let page = 0;
  while (true) {
    let query = supabase.from(tabela).select(campos).range(page * 1000, (page + 1) * 1000 - 1);
    for (const [key, value] of Object.entries(filtros)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query;
    if (error) {
      console.log(`Erro ao buscar ${tabela}:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return todos;
}

async function diagnosticoCompleto() {
  console.log('='.repeat(80));
  console.log('🤖 DR. CÍCERO - DIAGNÓSTICO COMPLETO DO SISTEMA CONTÁBIL');
  console.log('   Conforme especificação MCP Financeiro v2.0');
  console.log('='.repeat(80));

  const resultado = {
    equacao_contabil: { balanceada: false, diferenca: 0 },
    conta_sintetica: { lancamentos_diretos: 0 },
    conta_transitoria: { saldo: 0, status: '' },
    linhas_orfas: 0,
    entries_desbalanceados: 0,
    recomendacoes: []
  };

  // 1. EQUAÇÃO CONTÁBIL
  console.log('\n' + '-'.repeat(80));
  console.log('📊 1. EQUAÇÃO CONTÁBIL GERAL (Débitos = Créditos)');
  console.log('-'.repeat(80));

  const linhas = await buscarTodos('accounting_entry_lines', 'debit, credit, entry_id');
  const totalD = linhas.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalC = linhas.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  resultado.equacao_contabil.diferenca = totalD - totalC;
  resultado.equacao_contabil.balanceada = Math.abs(totalD - totalC) < 0.01;

  console.log(`   Total Débitos:  R$ ${totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Total Créditos: R$ ${totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Diferença:      R$ ${(totalD - totalC).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Status:         ${resultado.equacao_contabil.balanceada ? '✅ BALANCEADA' : '❌ DESBALANCEADA'}`);

  // 2. CONTA SINTÉTICA 1.1.2.01
  console.log('\n' + '-'.repeat(80));
  console.log('📊 2. CONTA SINTÉTICA 1.1.2.01 (Clientes a Receber)');
  console.log('   REGRA: NÃO deve ter lançamentos diretos (apenas as analíticas)');
  console.log('-'.repeat(80));

  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, is_synthetic')
    .eq('code', '1.1.2.01')
    .single();

  if (contaSintetica) {
    const { count } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', contaSintetica.id);

    resultado.conta_sintetica.lancamentos_diretos = count || 0;

    console.log(`   Conta: ${contaSintetica.code} - ${contaSintetica.name}`);
    console.log(`   is_synthetic: ${contaSintetica.is_synthetic}`);
    console.log(`   Lançamentos diretos: ${count || 0}`);
    console.log(`   Status: ${count === 0 ? '✅ CORRETO' : '❌ VIOLAÇÃO NBC TG 26'}`);

    if (count > 0) {
      resultado.recomendacoes.push('Mover lançamentos da conta 1.1.2.01 para contas analíticas');
    }
  } else {
    console.log('   ⚠️ Conta 1.1.2.01 não encontrada!');
  }

  // 3. CONTA TRANSITÓRIA 1.1.9.01
  console.log('\n' + '-'.repeat(80));
  console.log('📊 3. CONTA TRANSITÓRIA 1.1.9.01 (Recebimentos a Conciliar)');
  console.log('   REGRA: Deve estar zerada após conciliação completa');
  console.log('-'.repeat(80));

  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.9.01')
    .single();

  if (contaTransitoria) {
    const { data: linhasTransitoria } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', contaTransitoria.id);

    const saldo = (linhasTransitoria || []).reduce(
      (acc, l) => acc + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0),
      0
    );

    resultado.conta_transitoria.saldo = saldo;
    resultado.conta_transitoria.status = Math.abs(saldo) < 0.01 ? 'zerada' : 'pendente_conciliacao';

    console.log(`   Conta: ${contaTransitoria.code} - ${contaTransitoria.name}`);
    console.log(`   Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Status: ${Math.abs(saldo) < 0.01 ? '✅ ZERADA' : '⚠️ PENDENTE CONCILIAÇÃO'}`);

    if (Math.abs(saldo) >= 0.01) {
      resultado.recomendacoes.push(`Conciliar R$ ${saldo.toFixed(2)} pendentes na conta transitória`);
    }
  } else {
    console.log('   ❌ Conta 1.1.9.01 não encontrada!');
    resultado.recomendacoes.push('Criar conta transitória 1.1.9.01 (Recebimentos a Conciliar)');
  }

  // 4. LINHAS ÓRFÃS
  console.log('\n' + '-'.repeat(80));
  console.log('📊 4. LINHAS ÓRFÃS (sem entry correspondente)');
  console.log('-'.repeat(80));

  const entries = await buscarTodos('accounting_entries', 'id');
  const entryIds = new Set(entries.map(e => e.id));
  const linhasOrfas = linhas.filter(l => !entryIds.has(l.entry_id));
  resultado.linhas_orfas = linhasOrfas.length;

  console.log(`   Total de linhas órfãs: ${linhasOrfas.length}`);
  console.log(`   Status: ${linhasOrfas.length === 0 ? '✅ NENHUMA' : '❌ PROBLEMA'}`);

  if (linhasOrfas.length > 0) {
    resultado.recomendacoes.push(`Deletar ${linhasOrfas.length} linhas órfãs`);
  }

  // 5. ENTRIES DESBALANCEADOS
  console.log('\n' + '-'.repeat(80));
  console.log('📊 5. ENTRIES DESBALANCEADOS (Débito ≠ Crédito)');
  console.log('-'.repeat(80));

  const linhasPorEntry = {};
  for (const l of linhas) {
    if (!linhasPorEntry[l.entry_id]) linhasPorEntry[l.entry_id] = { d: 0, c: 0 };
    linhasPorEntry[l.entry_id].d += parseFloat(l.debit) || 0;
    linhasPorEntry[l.entry_id].c += parseFloat(l.credit) || 0;
  }

  let desbalanceados = 0;
  for (const [entryId, dados] of Object.entries(linhasPorEntry)) {
    if (Math.abs(dados.d - dados.c) > 0.01) {
      desbalanceados++;
    }
  }
  resultado.entries_desbalanceados = desbalanceados;

  console.log(`   Entries desbalanceados: ${desbalanceados}`);
  console.log(`   Status: ${desbalanceados === 0 ? '✅ TODOS BALANCEADOS' : '❌ PROBLEMA'}`);

  if (desbalanceados > 0) {
    resultado.recomendacoes.push(`Corrigir ${desbalanceados} entries desbalanceados`);
  }

  // 6. CONTAS ANALÍTICAS DE CLIENTES
  console.log('\n' + '-'.repeat(80));
  console.log('📊 6. CONTAS ANALÍTICAS DE CLIENTES (1.1.2.01.xxxx)');
  console.log('-'.repeat(80));

  const { data: contasAnaliticas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .eq('is_analytical', true);

  console.log(`   Total de contas analíticas: ${contasAnaliticas?.length || 0}`);

  // Top 10 por saldo
  if (contasAnaliticas && contasAnaliticas.length > 0) {
    const saldos = [];
    for (const conta of contasAnaliticas.slice(0, 50)) { // Limitar para performance
      const { data: linhasConta } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('account_id', conta.id);

      if (linhasConta && linhasConta.length > 0) {
        const saldo = linhasConta.reduce((s, l) => s + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0), 0);
        saldos.push({ ...conta, saldo });
      }
    }

    console.log('\n   Top 5 por saldo:');
    saldos.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)).slice(0, 5).forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.code} ${c.name.substring(0, 35).padEnd(35)} R$ ${c.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    });
  }

  // 7. RESUMO FINAL
  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMO DO DIAGNÓSTICO');
  console.log('='.repeat(80));

  const erros = [];
  if (!resultado.equacao_contabil.balanceada) erros.push('Equação contábil desbalanceada');
  if (resultado.conta_sintetica.lancamentos_diretos > 0) erros.push('Lançamentos na conta sintética');
  if (resultado.linhas_orfas > 0) erros.push('Linhas órfãs encontradas');
  if (resultado.entries_desbalanceados > 0) erros.push('Entries desbalanceados');

  console.log(`\n   ✅ Acertos: ${4 - erros.length}`);
  console.log(`   ❌ Erros: ${erros.length}`);

  if (erros.length > 0) {
    console.log('\n   Problemas encontrados:');
    erros.forEach(e => console.log(`   - ${e}`));
  }

  if (resultado.recomendacoes.length > 0) {
    console.log('\n   Recomendações:');
    resultado.recomendacoes.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
  }

  console.log('\n' + '='.repeat(80));
  console.log('🤖 Dr. Cícero: "Partidas dobradas sempre, duplicações nunca!"');
  console.log('='.repeat(80));

  return resultado;
}

diagnosticoCompleto();
