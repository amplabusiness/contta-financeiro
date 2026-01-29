// scripts/correcao_contabil/02_limpar_duplicatas_banco_sicredi.mjs
// Remove lançamentos duplicados (boleto_sicredi) que inflam o saldo do banco

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuração
const BANCO_SICREDI_CODE = '1.1.1.05';
const SALDO_OFX_ESPERADO = 18553.54; // Saldo correto do OFX Jan/2025
const PERIODO_INICIO = '2025-01-01';
const PERIODO_FIM = '2025-01-31';

// Modo de execução
const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

function formatMoney(valor) {
  return `R$ ${(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function limparDuplicatas() {
  console.log('\n' + '='.repeat(70));
  console.log(`🔍 LIMPEZA DE DUPLICATAS - BANCO SICREDI | MODO: ${MODO}`);
  console.log('='.repeat(70));

  // 1. Buscar conta do Banco Sicredi
  console.log('\n📍 Buscando conta do Banco Sicredi...');

  const { data: contaBanco, error: errBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', BANCO_SICREDI_CODE)
    .single();

  if (errBanco || !contaBanco) {
    console.error(`❌ Conta ${BANCO_SICREDI_CODE} não encontrada!`);
    return { success: false, error: 'Conta não encontrada' };
  }

  console.log(`   ✅ ${contaBanco.code} - ${contaBanco.name}`);
  console.log(`   ID: ${contaBanco.id}`);

  // 2. Buscar todas as linhas do banco no período
  console.log(`\n📊 Buscando lançamentos de ${PERIODO_INICIO} a ${PERIODO_FIM}...`);

  const { data: linhas, error: errLinhas } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      entry_id,
      debit,
      credit,
      description,
      accounting_entries!inner (
        id,
        entry_date,
        description,
        reference_type,
        reference_id,
        source_type
      )
    `)
    .eq('account_id', contaBanco.id)
    .gte('accounting_entries.entry_date', PERIODO_INICIO)
    .lte('accounting_entries.entry_date', PERIODO_FIM);

  if (errLinhas) {
    console.error('❌ Erro ao buscar linhas:', errLinhas);
    return { success: false, error: errLinhas };
  }

  console.log(`   Total de linhas: ${linhas.length}`);

  // 3. Agrupar por source_type
  const porSourceType = {};
  for (const linha of linhas) {
    const sourceType = linha.accounting_entries?.source_type || 'null';
    if (!porSourceType[sourceType]) {
      porSourceType[sourceType] = {
        linhas: [],
        entryIds: new Set(),
        debitos: 0,
        creditos: 0
      };
    }
    porSourceType[sourceType].linhas.push(linha);
    porSourceType[sourceType].entryIds.add(linha.entry_id);
    porSourceType[sourceType].debitos += linha.debit || 0;
    porSourceType[sourceType].creditos += linha.credit || 0;
  }

  // 4. Mostrar resumo
  console.log('\n' + '-'.repeat(90));
  console.log('SOURCE_TYPE'.padEnd(25) + 'LINHAS'.padStart(8) + 'ENTRIES'.padStart(10) + 'DÉBITOS'.padStart(22) + 'CRÉDITOS'.padStart(22));
  console.log('-'.repeat(90));

  let totalDebitos = 0;
  let totalCreditos = 0;

  for (const [tipo, dados] of Object.entries(porSourceType).sort((a, b) => b[1].linhas.length - a[1].linhas.length)) {
    console.log(
      tipo.padEnd(25) +
      String(dados.linhas.length).padStart(8) +
      String(dados.entryIds.size).padStart(10) +
      formatMoney(dados.debitos).padStart(22) +
      formatMoney(dados.creditos).padStart(22)
    );
    totalDebitos += dados.debitos;
    totalCreditos += dados.creditos;
  }

  console.log('-'.repeat(90));
  console.log(
    'TOTAL'.padEnd(25) +
    String(linhas.length).padStart(8) +
    ''.padStart(10) +
    formatMoney(totalDebitos).padStart(22) +
    formatMoney(totalCreditos).padStart(22)
  );

  const saldoAtual = totalDebitos - totalCreditos;
  console.log('\n📊 ANÁLISE DO SALDO:');
  console.log(`   Saldo atual no sistema: ${formatMoney(saldoAtual)}`);
  console.log(`   Saldo esperado (OFX):   ${formatMoney(SALDO_OFX_ESPERADO)}`);
  console.log(`   Diferença:              ${formatMoney(saldoAtual - SALDO_OFX_ESPERADO)}`);

  // 5. Identificar duplicatas
  const duplicatas = porSourceType['boleto_sicredi'];

  if (!duplicatas || duplicatas.linhas.length === 0) {
    console.log('\n✅ Nenhuma duplicata boleto_sicredi encontrada!');

    // Verificar se há outros tipos que podem ser duplicatas
    const outrosTipos = ['sicredi_boleto', 'boleto_payment'];
    for (const tipo of outrosTipos) {
      if (porSourceType[tipo]?.linhas.length > 0) {
        console.log(`\n⚠️ Encontrado source_type '${tipo}' com ${porSourceType[tipo].linhas.length} linhas`);
        console.log('   Verifique se não são duplicatas também.');
      }
    }
    return { success: true, message: 'Nenhuma duplicata encontrada' };
  }

  console.log('\n🔴 DUPLICATAS IDENTIFICADAS:');
  console.log(`   Source type: boleto_sicredi`);
  console.log(`   Linhas: ${duplicatas.linhas.length}`);
  console.log(`   Entries: ${duplicatas.entryIds.size}`);
  console.log(`   Débitos: ${formatMoney(duplicatas.debitos)}`);
  console.log(`   Créditos: ${formatMoney(duplicatas.creditos)}`);

  const saldoAposLimpeza = saldoAtual - duplicatas.debitos + duplicatas.creditos;
  console.log(`\n📈 PROJEÇÃO APÓS LIMPEZA:`);
  console.log(`   Saldo projetado: ${formatMoney(saldoAposLimpeza)}`);
  console.log(`   Saldo OFX:       ${formatMoney(SALDO_OFX_ESPERADO)}`);
  console.log(`   Diferença:       ${formatMoney(saldoAposLimpeza - SALDO_OFX_ESPERADO)}`);

  // Coletar IDs para deletar
  const entryIdsParaDeletar = [...duplicatas.entryIds];

  if (MODO === 'SIMULACAO') {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  MODO SIMULAÇÃO - NENHUMA ALTERAÇÃO FOI FEITA');
    console.log('='.repeat(70));

    console.log('\n📝 Amostra dos primeiros 15 lançamentos a deletar:');
    console.log('-'.repeat(90));

    const amostra = duplicatas.linhas.slice(0, 15);
    for (const linha of amostra) {
      const data = linha.accounting_entries?.entry_date?.substring(0, 10) || '';
      const desc = (linha.description || linha.accounting_entries?.description || '').substring(0, 45);
      const valor = linha.debit ? `D ${formatMoney(linha.debit)}` : `C ${formatMoney(linha.credit)}`;
      console.log(`   ${data} | ${desc.padEnd(45)} | ${valor}`);
    }

    if (duplicatas.linhas.length > 15) {
      console.log(`   ... e mais ${duplicatas.linhas.length - 15} linhas`);
    }

    console.log('\n🚀 Para executar a limpeza, rode:');
    console.log('   node scripts/correcao_contabil/02_limpar_duplicatas_banco_sicredi.mjs --executar');

    return { success: true, modo: 'SIMULACAO', entries_a_deletar: entryIdsParaDeletar.length };
  }

  // 6. EXECUÇÃO: Deletar
  console.log('\n' + '='.repeat(70));
  console.log('🗑️  EXECUTANDO LIMPEZA...');
  console.log('='.repeat(70));

  // 6.1 Deletar linhas primeiro
  console.log('\n📍 Deletando linhas de lançamento...');

  const { error: errDelLinhas, count: countLinhas } = await supabase
    .from('accounting_entry_lines')
    .delete({ count: 'exact' })
    .in('entry_id', entryIdsParaDeletar);

  if (errDelLinhas) {
    console.error('❌ Erro ao deletar linhas:', errDelLinhas);
    return { success: false, error: errDelLinhas };
  }

  console.log(`   ✅ ${countLinhas} linhas deletadas`);

  // 6.2 Deletar entries
  console.log('\n📍 Deletando lançamentos principais...');

  const { error: errDelEntries, count: countEntries } = await supabase
    .from('accounting_entries')
    .delete({ count: 'exact' })
    .in('id', entryIdsParaDeletar);

  if (errDelEntries) {
    console.error('❌ Erro ao deletar entries:', errDelEntries);
    return { success: false, error: errDelEntries };
  }

  console.log(`   ✅ ${countEntries} entries deletados`);

  // 7. Verificar saldo após limpeza
  console.log('\n📊 VERIFICAÇÃO FINAL:');

  const { data: linhasApos } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contaBanco.id);

  const saldoFinal = linhasApos.reduce((acc, l) => acc + (l.debit || 0) - (l.credit || 0), 0);
  const diferencaFinal = Math.abs(saldoFinal - SALDO_OFX_ESPERADO);

  console.log(`   Saldo final: ${formatMoney(saldoFinal)}`);
  console.log(`   Saldo OFX:   ${formatMoney(SALDO_OFX_ESPERADO)}`);
  console.log(`   Diferença:   ${formatMoney(diferencaFinal)}`);

  if (diferencaFinal < 1) {
    console.log('\n✅ SALDO CONFERE COM O OFX!');
  } else {
    console.log('\n⚠️ Ainda há diferença. Verifique outros source_types ou lançamentos manuais.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ LIMPEZA CONCLUÍDA!');
  console.log('='.repeat(70));
  console.log('\nPróximo passo: Execute o script 03_reclassificar_sintetica_para_analiticas.mjs');

  return {
    success: true,
    linhas_deletadas: countLinhas,
    entries_deletados: countEntries,
    saldo_final: saldoFinal
  };
}

limparDuplicatas().catch(console.error);
