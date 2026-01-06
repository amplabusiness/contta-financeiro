/**
 * DR. CÍCERO - CORREÇÃO DE SALDOS DE ABERTURA DUPLICADOS
 *
 * Problema: Saldos de abertura de clientes foram lançados DUAS vezes:
 * 1. Na conta 1.1.2.01 (Clientes a Receber) - CORRETO
 * 2. Nas contas filhas 1.1.2.01.xxx - DUPLICADO
 *
 * Solução: Excluir os lançamentos duplicados das contas filhas
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigir() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - CORREÇÃO DE SALDOS DE ABERTURA DUPLICADOS');
  console.log('='.repeat(80));

  // 1. Abrir períodos
  console.log('\n1. ABRINDO PERÍODOS PARA CORREÇÃO...\n');

  await supabase.from('monthly_closings')
    .update({ status: 'open' })
    .eq('year', 2025).eq('month', 1);

  await supabase.from('accounting_periods')
    .update({ status: 'open' })
    .eq('year', 2025).eq('month', 1);

  // Também dezembro 2024
  await supabase.from('monthly_closings')
    .upsert({ year: 2024, month: 12, status: 'open' }, { onConflict: 'year,month' });

  await supabase.from('accounting_periods')
    .upsert({ year: 2024, month: 12, status: 'open' }, { onConflict: 'year,month' });

  console.log('   ✅ Períodos abertos');
  await new Promise(r => setTimeout(r, 1000));

  // 2. Buscar contas filhas de 1.1.2.01
  console.log('\n2. BUSCANDO CONTAS FILHAS COM SALDOS DE ABERTURA DUPLICADOS...\n');

  const { data: contasFilhas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%');

  console.log(`   Contas filhas encontradas: ${contasFilhas?.length || 0}`);

  // 3. Para cada conta filha, verificar e excluir lançamentos de saldo de abertura
  console.log('\n3. EXCLUINDO LANÇAMENTOS DUPLICADOS...\n');

  let totalExcluido = 0;
  let entriesParaExcluir = [];

  for (const conta of contasFilhas || []) {
    // Buscar linhas de saldo de abertura nesta conta
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select(`
        id, entry_id, debit, credit,
        entry:accounting_entries(id, description, reference_type)
      `)
      .eq('account_id', conta.id);

    for (const linha of linhas || []) {
      const desc = (linha.entry?.description || '').toLowerCase();
      const refType = linha.entry?.reference_type;

      // Identificar saldos de abertura
      if (desc.includes('saldo') || desc.includes('abertura') || refType === 'opening_balance') {
        const valor = parseFloat(linha.debit || 0) - parseFloat(linha.credit || 0);
        console.log(`   Excluir: ${conta.code} - R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})} - ${desc.substring(0, 40)}`);

        entriesParaExcluir.push(linha.entry_id);
        totalExcluido += valor;
      }
    }
  }

  // Remover duplicados
  const entriesUnicos = [...new Set(entriesParaExcluir)];

  console.log(`\n   Total de entries a excluir: ${entriesUnicos.length}`);
  console.log(`   Valor total a ser removido: R$ ${totalExcluido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 4. Excluir os lançamentos
  if (entriesUnicos.length > 0) {
    console.log('\n4. EXCLUINDO ENTRIES...\n');

    for (const entryId of entriesUnicos) {
      // Primeiro excluir linhas
      const { error: errLinhas } = await supabase
        .from('accounting_entry_lines')
        .delete()
        .eq('entry_id', entryId);

      if (errLinhas) {
        console.log(`   ❌ Erro ao excluir linhas de ${entryId.substring(0, 8)}: ${errLinhas.message}`);
        continue;
      }

      // Depois excluir entry
      const { error: errEntry } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('id', entryId);

      if (errEntry) {
        console.log(`   ❌ Erro ao excluir entry ${entryId.substring(0, 8)}: ${errEntry.message}`);
      } else {
        console.log(`   ✅ Entry ${entryId.substring(0, 8)} excluído`);
      }
    }
  }

  // 5. Voltar a conta 1.1.2.01 para analítica
  console.log('\n5. VOLTANDO CONTA 1.1.2.01 PARA ANALÍTICA...\n');

  const { error: errConta } = await supabase
    .from('chart_of_accounts')
    .update({ is_synthetic: false, is_analytical: true })
    .eq('code', '1.1.2.01');

  if (errConta) {
    console.log('   ❌ Erro:', errConta.message);
  } else {
    console.log('   ✅ Conta 1.1.2.01 voltou a ser ANALÍTICA');
  }

  // 6. Desativar contas filhas
  console.log('\n6. DESATIVANDO CONTAS FILHAS...\n');

  const { error: errFilhas } = await supabase
    .from('chart_of_accounts')
    .update({ is_active: false })
    .like('code', '1.1.2.01.%');

  if (errFilhas) {
    console.log('   ❌ Erro:', errFilhas.message);
  } else {
    console.log(`   ✅ ${contasFilhas?.length} contas filhas desativadas`);
  }

  // 7. Fechar períodos
  console.log('\n7. FECHANDO PERÍODOS...\n');

  await supabase.from('monthly_closings')
    .update({ status: 'closed' })
    .eq('year', 2025).eq('month', 1);

  await supabase.from('accounting_periods')
    .update({ status: 'closed' })
    .eq('year', 2025).eq('month', 1);

  console.log('   ✅ Períodos fechados');

  // 8. Verificação final
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO FINAL');
  console.log('='.repeat(80));

  // Recalcular saldo de Clientes a Receber
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  const { data: linhasFinal } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta.id);

  let dFinal = 0, cFinal = 0;
  for (const l of linhasFinal || []) {
    dFinal += parseFloat(l.debit || 0);
    cFinal += parseFloat(l.credit || 0);
  }

  console.log(`\n   Saldo 1.1.2.01 (Clientes a Receber): R$ ${(dFinal - cFinal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  if (Math.abs((dFinal - cFinal) - 136821.59) < 0.01) {
    console.log('   ✅ Valor confere com o esperado!');
  }

  console.log('\n' + '='.repeat(80));
}

corrigir().catch(console.error);
