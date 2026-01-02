/**
 * DR. CÍCERO - AUDITORIA COMPLETA DO BALANÇO PATRIMONIAL
 *
 * Verifica todos os saldos das contas e identifica possíveis problemas.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditarBalanco() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - AUDITORIA COMPLETA DO BALANÇO PATRIMONIAL');
  console.log('='.repeat(80));
  console.log('\nData:', new Date().toLocaleString('pt-BR'));

  // 1. Buscar todas as contas analíticas ativas
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, nature, type')
    .eq('is_analytical', true)
    .eq('is_active', true)
    .order('code');

  console.log(`\nTotal de contas analíticas ativas: ${contas?.length || 0}\n`);

  // 2. Calcular saldo de cada conta
  let totalAtivo = 0;
  let totalPassivo = 0;
  let totalReceitas = 0;
  let totalDespesas = 0;
  let totalPL = 0;

  const contasComSaldo = [];

  for (const conta of contas || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let totalD = 0, totalC = 0;
    for (const l of linhas || []) {
      totalD += parseFloat(l.debit || 0);
      totalC += parseFloat(l.credit || 0);
    }

    // Calcular saldo baseado na natureza da conta
    let saldo;
    if (conta.nature === 'DEVEDORA') {
      saldo = totalD - totalC;
    } else {
      saldo = totalC - totalD;
    }

    if (saldo !== 0 || linhas?.length > 0) {
      contasComSaldo.push({
        ...conta,
        debitos: totalD,
        creditos: totalC,
        saldo: saldo,
        lancamentos: linhas?.length || 0
      });
    }

    // Acumular por tipo
    if (conta.code.startsWith('1.')) {
      totalAtivo += (totalD - totalC); // Ativo é devedor
    } else if (conta.code.startsWith('2.')) {
      totalPassivo += (totalC - totalD); // Passivo é credor
    } else if (conta.code.startsWith('3.')) {
      totalReceitas += (totalC - totalD); // Receitas são credoras
    } else if (conta.code.startsWith('4.')) {
      totalDespesas += (totalD - totalC); // Despesas são devedoras
    } else if (conta.code.startsWith('5.')) {
      totalPL += (totalC - totalD); // PL é credor
    }
  }

  // 3. Exibir contas com saldo
  console.log('='.repeat(80));
  console.log('CONTAS COM SALDO');
  console.log('='.repeat(80));

  const grupos = {
    '1': { nome: 'ATIVO', contas: [] },
    '2': { nome: 'PASSIVO', contas: [] },
    '3': { nome: 'RECEITAS', contas: [] },
    '4': { nome: 'DESPESAS', contas: [] },
    '5': { nome: 'PATRIMÔNIO LÍQUIDO', contas: [] },
  };

  for (const conta of contasComSaldo) {
    const grupo = conta.code.charAt(0);
    if (grupos[grupo]) {
      grupos[grupo].contas.push(conta);
    }
  }

  for (const [grupo, data] of Object.entries(grupos)) {
    if (data.contas.length > 0) {
      console.log(`\n${data.nome} (${grupo}.x):`);
      console.log('-'.repeat(80));

      let subtotal = 0;
      for (const conta of data.contas) {
        const saldoStr = conta.saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        console.log(`   ${conta.code.padEnd(12)} ${conta.name.substring(0, 35).padEnd(35)} R$ ${saldoStr.padStart(15)} (${conta.lancamentos} lanç)`);
        subtotal += conta.saldo;
      }

      console.log('-'.repeat(80));
      console.log(`   ${'SUBTOTAL'.padEnd(12)} ${''.padEnd(35)} R$ ${subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);
    }
  }

  // 4. Resumo do Balanço
  console.log('\n' + '='.repeat(80));
  console.log('RESUMO DO BALANÇO');
  console.log('='.repeat(80));

  console.log(`\n   ATIVO TOTAL:                  R$ ${totalAtivo.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);
  console.log(`   PASSIVO TOTAL:                R$ ${totalPassivo.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);
  console.log(`   PATRIMÔNIO LÍQUIDO:           R$ ${totalPL.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);
  console.log(`   RECEITAS (DRE):               R$ ${totalReceitas.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);
  console.log(`   DESPESAS (DRE):               R$ ${totalDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);

  const resultado = totalReceitas - totalDespesas;
  console.log(`   RESULTADO (Receitas-Despesas): R$ ${resultado.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);

  // 5. Verificar equação patrimonial
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO DA EQUAÇÃO PATRIMONIAL');
  console.log('='.repeat(80));

  const passivoMaisPL = totalPassivo + totalPL + resultado;
  console.log(`\n   ATIVO:           R$ ${totalAtivo.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);
  console.log(`   PASSIVO + PL:    R$ ${passivoMaisPL.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);

  const diferenca = totalAtivo - passivoMaisPL;
  if (Math.abs(diferenca) < 0.01) {
    console.log('\n   ✅ EQUAÇÃO PATRIMONIAL EQUILIBRADA!');
  } else {
    console.log(`\n   ❌ DIFERENÇA: R$ ${diferenca.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log('   ⚠️ O balanço NÃO está equilibrado!');
  }

  // 6. Verificar partidas dobradas
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO DE PARTIDAS DOBRADAS');
  console.log('='.repeat(80));

  const { data: totaisGerais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  let totalDebitosGeral = 0, totalCreditosGeral = 0;
  for (const l of totaisGerais || []) {
    totalDebitosGeral += parseFloat(l.debit || 0);
    totalCreditosGeral += parseFloat(l.credit || 0);
  }

  console.log(`\n   Total Débitos:    R$ ${totalDebitosGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);
  console.log(`   Total Créditos:   R$ ${totalCreditosGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);

  const difPartidasDobradas = totalDebitosGeral - totalCreditosGeral;
  if (Math.abs(difPartidasDobradas) < 0.01) {
    console.log('\n   ✅ PARTIDAS DOBRADAS EQUILIBRADAS!');
  } else {
    console.log(`\n   ❌ DIFERENÇA: R$ ${difPartidasDobradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }

  // 7. Verificar valores esperados (conforme memory.md)
  console.log('\n' + '='.repeat(80));
  console.log('COMPARAÇÃO COM VALORES ESPERADOS (memory.md)');
  console.log('='.repeat(80));

  // Buscar saldo Sicredi
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  const { data: linhasSicredi } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contaSicredi.id);

  let saldoSicredi = 0;
  for (const l of linhasSicredi || []) {
    saldoSicredi += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
  }

  // Buscar Clientes a Receber
  const { data: contaClientes } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  const { data: linhasClientes } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contaClientes?.id);

  let saldoClientes = 0;
  for (const l of linhasClientes || []) {
    saldoClientes += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
  }

  console.log('\n   Valores Esperados (Janeiro/2025):');
  console.log('   Banco Sicredi:       R$ 18.553,54');
  console.log('   Clientes a Receber:  R$ 136.821,59');

  console.log('\n   Valores Calculados:');
  console.log(`   Banco Sicredi:       R$ ${saldoSicredi.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Clientes a Receber:  R$ ${saldoClientes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  if (Math.abs(saldoSicredi - 18553.54) < 0.01) {
    console.log('\n   ✅ Saldo Sicredi CONFERE!');
  } else {
    console.log(`\n   ❌ Saldo Sicredi DIVERGE em R$ ${(saldoSicredi - 18553.54).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }

  if (Math.abs(saldoClientes - 136821.59) < 0.01) {
    console.log('   ✅ Clientes a Receber CONFERE!');
  } else {
    console.log(`   ❌ Clientes a Receber DIVERGE em R$ ${(saldoClientes - 136821.59).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Assinado: Dr. Cícero - Agente IA Contábil');
  console.log('Fundamentação: NBC TG 26, ITG 2000');
  console.log('='.repeat(80));
}

auditarBalanco().catch(console.error);
