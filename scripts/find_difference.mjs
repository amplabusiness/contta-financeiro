/**
 * DR. CÍCERO - ENCONTRAR DIFERENÇA DE R$ 1.127,59
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function encontrar() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - ENCONTRAR DIFERENÇA DE R$ 1.127,59');
  console.log('='.repeat(80));

  // Valores do último relatório:
  // ATIVO: 391.726,63
  // PASSIVO: 389.252,35
  // RESULTADO: 3.601,87
  // PASSIVO + PL + RESULTADO: 392.854,22
  // DIFERENÇA: -1.127,59

  // 1. Buscar TODAS as contas analíticas ativas com saldo
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, nature')
    .eq('is_analytical', true)
    .eq('is_active', true)
    .order('code');

  console.log('\n1. TODAS AS CONTAS COM SALDO:\n');

  let somaAtivo = 0;
  let somaPassivo = 0;
  let somaPL = 0;
  let somaReceita = 0;
  let somaDespesa = 0;

  for (const conta of contas || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let d = 0, c = 0;
    for (const l of linhas || []) {
      d += parseFloat(l.debit || 0);
      c += parseFloat(l.credit || 0);
    }

    if (d === 0 && c === 0) continue;

    const grupo = conta.code.charAt(0);
    let saldo;

    // Calcular saldo baseado na natureza esperada do grupo
    if (grupo === '1' || grupo === '4') {
      // Ativo e Despesas são devedores
      saldo = d - c;
    } else {
      // Passivo, PL e Receitas são credores
      saldo = c - d;
    }

    if (Math.abs(saldo) < 0.01) continue;

    const saldoStr = saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    console.log(`   ${conta.code.padEnd(15)} ${saldoStr.padStart(15)} | ${conta.name.substring(0, 40)}`);

    // Acumular
    switch(grupo) {
      case '1': somaAtivo += saldo; break;
      case '2': somaPassivo += saldo; break;
      case '3': somaReceita += saldo; break;
      case '4': somaDespesa += saldo; break;
      case '5': somaPL += saldo; break;
    }
  }

  console.log('\n2. TOTAIS POR GRUPO:\n');
  console.log(`   1. ATIVO:       R$ ${somaAtivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   2. PASSIVO:     R$ ${somaPassivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   3. RECEITA:     R$ ${somaReceita.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   4. DESPESA:     R$ ${somaDespesa.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   5. PL:          R$ ${somaPL.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  const resultado = somaReceita - somaDespesa;
  console.log(`\n   Resultado (3-4): R$ ${resultado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  const passivoMaisPL = somaPassivo + somaPL + resultado;
  console.log(`   Passivo + PL + Resultado: R$ ${passivoMaisPL.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  const diferenca = somaAtivo - passivoMaisPL;
  console.log(`\n   DIFERENÇA (Ativo - Passivo+PL): R$ ${diferenca.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 3. Verificar se há contas no grupo 5 ou 2 que deveriam estar no ativo
  console.log('\n3. ANÁLISE DA DIFERENÇA:\n');

  // A diferença de -1.127,59 sugere que há R$ 1.127,59 a MAIS no passivo
  // ou R$ 1.127,59 a MENOS no ativo

  // Verificar contas 2.3.03.99 (Saldos de Abertura - Diversos)
  const { data: conta2399 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '2.3.03.99')
    .single();

  if (conta2399) {
    const { data: linhas2399 } = await supabase
      .from('accounting_entry_lines')
      .select(`
        debit, credit, description,
        entry:accounting_entries(description)
      `)
      .eq('account_id', conta2399.id);

    let soma2399 = 0;
    console.log('   Conteúdo de 2.3.03.99 (Saldos de Abertura - Diversos):');
    for (const l of linhas2399 || []) {
      const valor = parseFloat(l.credit || 0) - parseFloat(l.debit || 0);
      soma2399 += valor;
      // Mostrar apenas os maiores ou com valor próximo a 1127
      if (Math.abs(valor - 1127.59) < 10 || valor > 5000) {
        console.log(`   - R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | ${(l.description || l.entry?.description || '').substring(0, 50)}`);
      }
    }
    console.log(`   Total: R$ ${soma2399.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }

  console.log('\n' + '='.repeat(80));
}

encontrar().catch(console.error);
