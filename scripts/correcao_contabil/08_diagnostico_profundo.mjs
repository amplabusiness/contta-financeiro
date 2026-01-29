// scripts/correcao_contabil/08_diagnostico_profundo.mjs
// Diagnóstico profundo para identificar TODAS as anomalias contábeis

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatMoney(valor) {
  const num = parseFloat(valor) || 0;
  const sinal = num < 0 ? '-' : '';
  return `${sinal}R$ ${Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function diagnosticoProfundo() {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 DIAGNÓSTICO PROFUNDO - IDENTIFICANDO TODAS AS ANOMALIAS');
  console.log('='.repeat(80));

  // ============================================
  // 1. BUSCAR TODOS OS DADOS
  // ============================================
  console.log('\n📍 Carregando dados...');

  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, source_type, reference_type');

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id, account_id, debit, credit, description');

  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, nature');

  console.log(`   Entries: ${entries.length}`);
  console.log(`   Linhas: ${linhas.length}`);
  console.log(`   Contas: ${contas.length}`);

  const entriesById = new Map(entries.map(e => [e.id, e]));
  const contasById = new Map(contas.map(c => [c.id, c]));

  // ============================================
  // 2. LINHAS ÓRFÃS (sem entry correspondente)
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('🔴 1. LINHAS ÓRFÃS (sem entry correspondente)');
  console.log('-'.repeat(80));

  const linhasOrfas = linhas.filter(l => !entriesById.has(l.entry_id));

  let totalDebitosOrfaos = 0;
  let totalCreditosOrfaos = 0;

  for (const l of linhasOrfas) {
    totalDebitosOrfaos += parseFloat(l.debit) || 0;
    totalCreditosOrfaos += parseFloat(l.credit) || 0;
  }

  console.log(`   Quantidade: ${linhasOrfas.length}`);
  console.log(`   Débitos órfãos: ${formatMoney(totalDebitosOrfaos)}`);
  console.log(`   Créditos órfãos: ${formatMoney(totalCreditosOrfaos)}`);
  console.log(`   Impacto na equação: ${formatMoney(totalDebitosOrfaos - totalCreditosOrfaos)}`);

  if (linhasOrfas.length > 0) {
    const orfasPorConta = {};
    for (const l of linhasOrfas) {
      const conta = contasById.get(l.account_id);
      const key = conta ? `${conta.code} - ${conta.name}` : 'CONTA_DESCONHECIDA';
      if (!orfasPorConta[key]) {
        orfasPorConta[key] = { qtd: 0, debitos: 0, creditos: 0 };
      }
      orfasPorConta[key].qtd++;
      orfasPorConta[key].debitos += parseFloat(l.debit) || 0;
      orfasPorConta[key].creditos += parseFloat(l.credit) || 0;
    }

    console.log('\n   Por conta (top 15):');
    const ordenado = Object.entries(orfasPorConta)
      .sort((a, b) => b[1].qtd - a[1].qtd)
      .slice(0, 15);

    for (const [conta, dados] of ordenado) {
      const saldo = dados.debitos - dados.creditos;
      console.log(`   ${conta.substring(0, 45).padEnd(45)} ${String(dados.qtd).padStart(5)} linhas  Saldo: ${formatMoney(saldo)}`);
    }

    console.log('\n   ⚠️ AÇÃO NECESSÁRIA: Deletar linhas órfãs');
  }

  // ============================================
  // 3. ENTRIES DESBALANCEADOS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('🔴 2. ENTRIES DESBALANCEADOS (débito ≠ crédito)');
  console.log('-'.repeat(80));

  const linhasPorEntry = {};
  for (const l of linhas) {
    if (!entriesById.has(l.entry_id)) continue;
    if (!linhasPorEntry[l.entry_id]) {
      linhasPorEntry[l.entry_id] = { debitos: 0, creditos: 0, linhas: [] };
    }
    linhasPorEntry[l.entry_id].debitos += parseFloat(l.debit) || 0;
    linhasPorEntry[l.entry_id].creditos += parseFloat(l.credit) || 0;
    linhasPorEntry[l.entry_id].linhas.push(l);
  }

  const entriesDesbalanceados = [];
  let totalDesbalanceamento = 0;

  for (const [entryId, dados] of Object.entries(linhasPorEntry)) {
    const diff = dados.debitos - dados.creditos;
    if (Math.abs(diff) > 0.01) {
      const entry = entriesById.get(entryId);
      entriesDesbalanceados.push({
        id: entryId,
        ...entry,
        debitos: dados.debitos,
        creditos: dados.creditos,
        diferenca: diff,
        numLinhas: dados.linhas.length
      });
      totalDesbalanceamento += diff;
    }
  }

  console.log(`   Quantidade: ${entriesDesbalanceados.length}`);
  console.log(`   Total desbalanceamento: ${formatMoney(totalDesbalanceamento)}`);

  if (entriesDesbalanceados.length > 0) {
    const porSource = {};
    for (const e of entriesDesbalanceados) {
      const source = e.source_type || 'null';
      if (!porSource[source]) {
        porSource[source] = { qtd: 0, diferenca: 0 };
      }
      porSource[source].qtd++;
      porSource[source].diferenca += e.diferenca;
    }

    console.log('\n   Por source_type:');
    for (const [source, dados] of Object.entries(porSource).sort((a, b) => Math.abs(b[1].diferenca) - Math.abs(a[1].diferenca))) {
      console.log(`   ${source.padEnd(25)} ${String(dados.qtd).padStart(6)} entries  ${formatMoney(dados.diferenca).padStart(20)}`);
    }

    const umaLinha = entriesDesbalanceados.filter(e => e.numLinhas === 1);
    if (umaLinha.length > 0) {
      console.log(`\n   ⚠️ Entries com apenas 1 linha (incompletos): ${umaLinha.length}`);
    }

    console.log('\n   ⚠️ AÇÃO NECESSÁRIA: Deletar entries desbalanceados e suas linhas');
  }

  // ============================================
  // 4. ENTRIES SEM LINHAS
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('🟡 3. ENTRIES SEM LINHAS (vazios)');
  console.log('-'.repeat(80));

  const entriesSemLinhas = entries.filter(e => !linhasPorEntry[e.id]);

  console.log(`   Quantidade: ${entriesSemLinhas.length}`);

  if (entriesSemLinhas.length > 0) {
    const porSource = {};
    for (const e of entriesSemLinhas) {
      const source = e.source_type || 'null';
      if (!porSource[source]) porSource[source] = 0;
      porSource[source]++;
    }

    console.log('\n   Por source_type:');
    for (const [source, qtd] of Object.entries(porSource).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${source.padEnd(25)} ${qtd} entries`);
    }

    console.log('\n   ℹ️ Esses entries não afetam a equação, mas são lixo a limpar');
  }

  // ============================================
  // 5. ANÁLISE DO BANCO SICREDI
  // ============================================
  console.log('\n' + '-'.repeat(80));
  console.log('🔴 4. ANÁLISE DO BANCO SICREDI (1.1.1.05)');
  console.log('-'.repeat(80));

  const contaBanco = contas.find(c => c.code === '1.1.1.05');

  if (contaBanco) {
    const linhasBanco = linhas.filter(l => l.account_id === contaBanco.id);

    let debitosBanco = 0;
    let creditosBanco = 0;
    let linhasOrfasBanco = 0;

    for (const l of linhasBanco) {
      if (!entriesById.has(l.entry_id)) {
        linhasOrfasBanco++;
      }
      debitosBanco += parseFloat(l.debit) || 0;
      creditosBanco += parseFloat(l.credit) || 0;
    }

    const saldoBanco = debitosBanco - creditosBanco;

    console.log(`   Total linhas no banco: ${linhasBanco.length}`);
    console.log(`   Linhas órfãs no banco: ${linhasOrfasBanco}`);
    console.log(`   Débitos (entradas): ${formatMoney(debitosBanco)}`);
    console.log(`   Créditos (saídas): ${formatMoney(creditosBanco)}`);
    console.log(`   Saldo: ${formatMoney(saldoBanco)}`);

    if (saldoBanco < 0) {
      console.log('\n   ⚠️ SALDO NEGATIVO! Possíveis causas:');
      console.log('      - Linhas de crédito sem contrapartida de débito');
      console.log('      - Entries incompletos (só a saída, sem a entrada)');
    }

    const bancoLinhasValidas = linhasBanco.filter(l => entriesById.has(l.entry_id));
    const bancoPorSource = {};

    for (const l of bancoLinhasValidas) {
      const entry = entriesById.get(l.entry_id);
      const source = entry?.source_type || 'null';
      if (!bancoPorSource[source]) {
        bancoPorSource[source] = { qtd: 0, debitos: 0, creditos: 0 };
      }
      bancoPorSource[source].qtd++;
      bancoPorSource[source].debitos += parseFloat(l.debit) || 0;
      bancoPorSource[source].creditos += parseFloat(l.credit) || 0;
    }

    console.log('\n   Por source_type no banco:');
    for (const [source, dados] of Object.entries(bancoPorSource).sort((a, b) => b[1].qtd - a[1].qtd)) {
      const saldo = dados.debitos - dados.creditos;
      console.log(`   ${source.padEnd(20)} ${String(dados.qtd).padStart(5)} linhas  D: ${formatMoney(dados.debitos).padStart(15)}  C: ${formatMoney(dados.creditos).padStart(15)}  S: ${formatMoney(saldo).padStart(15)}`);
    }
  }

  // ============================================
  // 6. RESUMO E RECOMENDAÇÕES
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMO E PLANO DE AÇÃO');
  console.log('='.repeat(80));

  const problemas = [];

  if (linhasOrfas.length > 0) {
    problemas.push({
      prioridade: 1,
      problema: `${linhasOrfas.length} linhas órfãs`,
      impacto: formatMoney(totalDebitosOrfaos - totalCreditosOrfaos),
      acao: 'Deletar linhas órfãs (script 09)'
    });
  }

  if (entriesDesbalanceados.length > 0) {
    problemas.push({
      prioridade: 2,
      problema: `${entriesDesbalanceados.length} entries desbalanceados`,
      impacto: formatMoney(totalDesbalanceamento),
      acao: 'Deletar entries e suas linhas (script 09)'
    });
  }

  if (entriesSemLinhas.length > 0) {
    problemas.push({
      prioridade: 3,
      problema: `${entriesSemLinhas.length} entries vazios`,
      impacto: 'R$ 0,00 (lixo)',
      acao: 'Deletar entries vazios (script 09)'
    });
  }

  if (problemas.length === 0) {
    console.log('\n✅ Nenhum problema estrutural encontrado!');
    console.log('   Se a equação ainda não fecha, o problema está nos dados originais.');
  } else {
    console.log('\n   Prioridade | Problema                           | Impacto              | Ação');
    console.log('   ' + '-'.repeat(95));

    for (const p of problemas) {
      console.log(`   ${String(p.prioridade).padEnd(10)} | ${p.problema.padEnd(34)} | ${p.impacto.padStart(20)} | ${p.acao}`);
    }

    console.log('\n🚀 Execute o script 09 para corrigir automaticamente:');
    console.log('   node scripts/correcao_contabil/09_limpar_anomalias.mjs           # Simular');
    console.log('   node scripts/correcao_contabil/09_limpar_anomalias.mjs --executar # Executar');
  }

  console.log('\n' + '='.repeat(80));

  return {
    linhasOrfas: linhasOrfas.length,
    entriesDesbalanceados: entriesDesbalanceados.length,
    entriesSemLinhas: entriesSemLinhas.length,
    impactoLinhasOrfas: totalDebitosOrfaos - totalCreditosOrfaos,
    impactoDesbalanceados: totalDesbalanceamento
  };
}

diagnosticoProfundo().catch(console.error);
