/**
 * DR. CÍCERO - VERIFICAR EQUAÇÃO CONTÁBIL
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - VERIFICAR EQUAÇÃO CONTÁBIL');
  console.log('='.repeat(80));

  // 1. Buscar TODOS os lançamentos
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, entry_id');

  let totalDebitos = 0;
  let totalCreditos = 0;

  for (const l of linhas || []) {
    totalDebitos += parseFloat(l.debit || 0);
    totalCreditos += parseFloat(l.credit || 0);
  }

  console.log('\n1. VERIFICAÇÃO GLOBAL DE PARTIDAS DOBRADAS:\n');
  console.log(`   Total Débitos:  R$ ${totalDebitos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Total Créditos: R$ ${totalCreditos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Diferença:      R$ ${(totalDebitos - totalCreditos).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
    console.log('\n   ⚠️  ALERTA: Os lançamentos NÃO estão balanceados!');

    // Buscar lançamentos desbalanceados
    console.log('\n2. BUSCANDO LANÇAMENTOS DESBALANCEADOS:\n');

    const { data: entries } = await supabase
      .from('accounting_entries')
      .select('id, entry_date, description, reference_type');

    let desbalanceados = [];
    for (const e of entries || []) {
      const { data: entryLines } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('entry_id', e.id);

      let d = 0, c = 0;
      for (const l of entryLines || []) {
        d += parseFloat(l.debit || 0);
        c += parseFloat(l.credit || 0);
      }
      if (Math.abs(d - c) > 0.01) {
        desbalanceados.push({
          id: e.id,
          data: e.entry_date,
          desc: e.description,
          tipo: e.reference_type,
          debitos: d,
          creditos: c,
          diff: d - c
        });
      }
    }

    console.log(`   Encontrados ${desbalanceados.length} lançamentos desbalanceados:`);
    desbalanceados.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    let somaDiff = 0;
    for (const e of desbalanceados.slice(0, 20)) {
      somaDiff += e.diff;
      console.log(`   ${e.data} | Diff: R$ ${e.diff.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${(e.desc || '').substring(0, 40)}`);
    }

    console.log(`\n   Soma das diferenças (top 20): R$ ${somaDiff.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   Soma total das diferenças:    R$ ${desbalanceados.reduce((acc, e) => acc + e.diff, 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  } else {
    console.log('\n   ✓ Lançamentos balanceados corretamente.');
  }

  // 3. Calcular saldos corretamente
  console.log('\n3. SALDOS POR GRUPO (MÉTODO CORRETO):\n');

  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, nature')
    .eq('is_analytical', true)
    .eq('is_active', true)
    .order('code');

  // Agrupar por tipo de conta
  let ativo = 0;
  let passivo = 0;
  let pl = 0;
  let receita = 0;
  let despesa = 0;

  for (const conta of contas || []) {
    const { data: linhasConta } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let d = 0, c = 0;
    for (const l of linhasConta || []) {
      d += parseFloat(l.debit || 0);
      c += parseFloat(l.credit || 0);
    }

    if (d === 0 && c === 0) continue;

    const codigo = conta.code;

    // Classificar corretamente
    if (codigo.startsWith('1.')) {
      // ATIVO - natureza devedora (D-C)
      ativo += (d - c);
    } else if (codigo.startsWith('2.1.') || codigo.startsWith('2.2.')) {
      // PASSIVO - natureza credora (C-D)
      passivo += (c - d);
    } else if (codigo.startsWith('2.3.')) {
      // PL - natureza credora (C-D)
      pl += (c - d);
    } else if (codigo.startsWith('3.')) {
      // RECEITA - natureza credora (C-D)
      receita += (c - d);
    } else if (codigo.startsWith('4.')) {
      // DESPESA - natureza devedora (D-C)
      despesa += (d - c);
    }
  }

  console.log(`   1. ATIVO:       R$ ${ativo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   2.1-2.2 PASSIVO: R$ ${passivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   2.3 PL:          R$ ${pl.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   3. RECEITA:      R$ ${receita.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   4. DESPESA:      R$ ${despesa.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  const resultado = receita - despesa;
  console.log(`\n   Resultado do Exercício: R$ ${resultado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  const ladoDireito = passivo + pl + resultado;
  console.log(`\n   EQUAÇÃO CONTÁBIL:`);
  console.log(`   ATIVO = ${ativo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   PASSIVO + PL + RESULTADO = ${passivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})} + ${pl.toLocaleString('pt-BR', {minimumFractionDigits: 2})} + ${resultado.toLocaleString('pt-BR', {minimumFractionDigits: 2})} = ${ladoDireito.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   DIFERENÇA: R$ ${(ativo - ladoDireito).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  console.log('\n' + '='.repeat(80));
}

verificar().catch(console.error);
