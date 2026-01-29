// scripts/04_validar_equacao_contabil.mjs
// Valida a equação contábil e verifica os resultados das correções

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Valores de referência
const SALDO_OFX_BANCO_JAN_2025 = 18553.54;

function formatMoney(valor) {
  return `R$ ${(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function validarEquacaoContabil() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 VALIDAÇÃO DA EQUAÇÃO CONTÁBIL');
  console.log('='.repeat(70));

  let erros = 0;
  let avisos = 0;

  // =========================================
  // 1. EQUAÇÃO CONTÁBIL GERAL
  // =========================================
  console.log('\n' + '-'.repeat(70));
  console.log('1. EQUAÇÃO CONTÁBIL GERAL (Débitos = Créditos)');
  console.log('-'.repeat(70));

  const { data: totais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  const totalDebitos = totais.reduce((acc, l) => acc + (l.debit || 0), 0);
  const totalCreditos = totais.reduce((acc, l) => acc + (l.credit || 0), 0);
  const diferenca = Math.abs(totalDebitos - totalCreditos);

  console.log(`\n   Total Débitos:  ${formatMoney(totalDebitos)}`);
  console.log(`   Total Créditos: ${formatMoney(totalCreditos)}`);
  console.log(`   Diferença:      ${formatMoney(diferenca)}`);

  if (diferenca < 0.01) {
    console.log('\n   ✅ VÁLIDO! Débitos = Créditos');
  } else {
    console.log('\n   ❌ INVÁLIDO! Diferença encontrada');
    erros++;
  }

  // =========================================
  // 2. SALDO DO BANCO SICREDI
  // =========================================
  console.log('\n' + '-'.repeat(70));
  console.log('2. SALDO DO BANCO SICREDI (1.1.1.05)');
  console.log('-'.repeat(70));

  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.1.05')
    .single();

  if (contaBanco) {
    const { data: linhasBanco } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', contaBanco.id);

    const saldoBanco = linhasBanco.reduce((acc, l) => acc + (l.debit || 0) - (l.credit || 0), 0);
    const diferencaOFX = Math.abs(saldoBanco - SALDO_OFX_BANCO_JAN_2025);
    
    console.log(`\n   ${contaBanco.code} - ${contaBanco.name}`);
    console.log(`   Saldo atual:     ${formatMoney(saldoBanco)}`);
    console.log(`   Saldo OFX ref:   ${formatMoney(SALDO_OFX_BANCO_JAN_2025)} (Jan/2025)`);
    console.log(`   Diferença:       ${formatMoney(diferencaOFX)}`);
    
    if (diferencaOFX < 1) {
      console.log('\n   ✅ CONFERE COM OFX!');
    } else if (diferencaOFX < 1000) {
      console.log('\n   ⚠️ Pequena diferença - verificar lançamentos recentes');
      avisos++;
    } else {
      console.log('\n   ❌ DIFERENÇA SIGNIFICATIVA! Verificar duplicatas restantes');
      erros++;
    }
  } else {
    console.log('\n   ❌ Conta 1.1.1.05 não encontrada!');
    erros++;
  }

  // =========================================
  // 3. CONTA SINTÉTICA 1.1.2.01
  // =========================================
  console.log('\n' + '-'.repeat(70));
  console.log('3. CONTA SINTÉTICA 1.1.2.01 (Clientes a Receber)');
  console.log('-'.repeat(70));

  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01')
    .single();

  if (contaSintetica) {
    const { count: countSintetica } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact' })
      .eq('account_id', contaSintetica.id);

    console.log(`\n   ${contaSintetica.code} - ${contaSintetica.name}`);
    console.log(`   Lançamentos diretos: ${countSintetica || 0}`);
    
    if (countSintetica === 0) {
      console.log('\n   ✅ CORRETO! Conta sintética sem lançamentos diretos');
    } else {
      console.log('\n   ❌ VIOLAÇÃO NBC TG 26! Conta sintética com lançamentos diretos');
      erros++;
    }
  }

  // =========================================
  // 4. CONTA TRANSITÓRIA 1.1.9.01
  // =========================================
  console.log('\n' + '-'.repeat(70));
  console.log('4. CONTA TRANSITÓRIA 1.1.9.01 (Recebimentos a Conciliar)');
  console.log('-'.repeat(70));

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

    const saldoTransitoria = (linhasTransitoria || []).reduce(
      (acc, l) => acc + (l.debit || 0) - (l.credit || 0), 
      0
    );

    console.log(`\n   ${contaTransitoria.code} - ${contaTransitoria.name}`);
    console.log(`   Lançamentos: ${linhasTransitoria?.length || 0}`);
    console.log(`   Saldo:       ${formatMoney(saldoTransitoria)}`);
    
    if (Math.abs(saldoTransitoria) < 0.01) {
      console.log('\n   ✅ ZERADA! Todas as conciliações foram feitas');
    } else if (saldoTransitoria > 0) {
      console.log('\n   ⚠️ Há recebimentos pendentes de conciliação');
      avisos++;
    } else {
      console.log('\n   ⚠️ Saldo negativo - verificar estornos');
      avisos++;
    }
  } else {
    console.log('\n   ℹ️ Conta 1.1.9.01 não existe (será criada ao configurar)');
  }

  // =========================================
  // 5. SOURCE_TYPES NO BANCO
  // =========================================
  console.log('\n' + '-'.repeat(70));
  console.log('5. ANÁLISE DE SOURCE_TYPES NO BANCO SICREDI');
  console.log('-'.repeat(70));

  if (contaBanco) {
    const { data: linhasComEntry } = await supabase
      .from('accounting_entry_lines')
      .select(`
        debit,
        credit,
        accounting_entries!inner (source_type)
      `)
      .eq('account_id', contaBanco.id);

    const porSourceType = {};
    for (const linha of linhasComEntry || []) {
      const sourceType = linha.accounting_entries?.source_type || 'null';
      if (!porSourceType[sourceType]) {
        porSourceType[sourceType] = { qtd: 0, debitos: 0, creditos: 0 };
      }
      porSourceType[sourceType].qtd++;
      porSourceType[sourceType].debitos += linha.debit || 0;
      porSourceType[sourceType].creditos += linha.credit || 0;
    }

    console.log('\n   ' + 'Source Type'.padEnd(25) + 'Qtd'.padStart(8) + 'Débitos'.padStart(18) + 'Créditos'.padStart(18));
    console.log('   ' + '-'.repeat(69));

    for (const [tipo, dados] of Object.entries(porSourceType).sort((a, b) => b[1].qtd - a[1].qtd)) {
      console.log(
        '   ' +
        tipo.padEnd(25) +
        String(dados.qtd).padStart(8) +
        formatMoney(dados.debitos).padStart(18) +
        formatMoney(dados.creditos).padStart(18)
      );
    }

    // Verificar se boleto_sicredi ainda existe
    if (porSourceType['boleto_sicredi']) {
      console.log('\n   ❌ Ainda existem lançamentos boleto_sicredi (duplicatas)!');
      erros++;
    } else {
      console.log('\n   ✅ Nenhum lançamento boleto_sicredi (duplicatas removidas)');
    }
  }

  // =========================================
  // 6. CONTAS ANALÍTICAS DE CLIENTES
  // =========================================
  console.log('\n' + '-'.repeat(70));
  console.log('6. CONTAS ANALÍTICAS DE CLIENTES (1.1.2.01.xxxx)');
  console.log('-'.repeat(70));

  const { data: contasAnaliticas, count: countContas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name', { count: 'exact' })
    .ilike('code', '1.1.2.01.%')
    .order('code');

  console.log(`\n   Total de contas analíticas: ${countContas || 0}`);

  if (contasAnaliticas && contasAnaliticas.length > 0) {
    // Calcular saldo total das analíticas
    const contaIds = contasAnaliticas.map(c => c.id);
    
    const { data: linhasAnaliticas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .in('account_id', contaIds);

    const saldoAnaliticas = (linhasAnaliticas || []).reduce(
      (acc, l) => acc + (l.debit || 0) - (l.credit || 0),
      0
    );

    console.log(`   Saldo total:                ${formatMoney(saldoAnaliticas)}`);
    console.log(`   Lançamentos:                ${linhasAnaliticas?.length || 0}`);

    // Mostrar top 10 contas com maior saldo
    console.log('\n   Top 10 contas com maior saldo:');
    
    const saldosPorConta = [];
    for (const conta of contasAnaliticas) {
      const { data: linhasConta } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('account_id', conta.id);
      
      const saldo = (linhasConta || []).reduce(
        (acc, l) => acc + (l.debit || 0) - (l.credit || 0),
        0
      );
      
      if (saldo !== 0) {
        saldosPorConta.push({ conta, saldo });
      }
    }

    saldosPorConta.sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));

    for (const { conta, saldo } of saldosPorConta.slice(0, 10)) {
      console.log(`   ${conta.code} ${conta.name.substring(0, 35).padEnd(35)} ${formatMoney(saldo).padStart(15)}`);
    }
  }

  // =========================================
  // RESUMO FINAL
  // =========================================
  console.log('\n' + '='.repeat(70));
  console.log('📋 RESUMO DA VALIDAÇÃO');
  console.log('='.repeat(70));

  console.log(`\n   ❌ Erros:   ${erros}`);
  console.log(`   ⚠️ Avisos:  ${avisos}`);

  if (erros === 0 && avisos === 0) {
    console.log('\n   🎉 TUDO CORRETO! Sistema contábil validado com sucesso.');
  } else if (erros === 0) {
    console.log('\n   ✅ Sem erros críticos. Verifique os avisos quando possível.');
  } else {
    console.log('\n   ⚠️ Há erros que precisam ser corrigidos!');
    console.log('   Execute os scripts de correção novamente ou investigue manualmente.');
  }

  console.log('\n' + '='.repeat(70));

  return { success: erros === 0, erros, avisos };
}

validarEquacaoContabil().catch(console.error);
