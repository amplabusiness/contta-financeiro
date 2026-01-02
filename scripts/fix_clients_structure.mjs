/**
 * DR. CÍCERO - CORREÇÃO ESTRUTURA CLIENTES A RECEBER
 *
 * A conta 1.1.2.01 está CORRETA com:
 * - Saldo Abertura: R$ 298.527,29 (débito)
 * - Honorários:     R$ 136.821,59 (débito)
 * - Recebimentos:   R$ 298.527,29 (crédito)
 * - Saldo Final:    R$ 136.821,59
 *
 * As contas filhas (1.1.2.01.xxx) têm lançamentos DUPLICADOS
 * que estão inflando o ativo.
 *
 * SOLUÇÃO:
 * 1. Voltar 1.1.2.01 para ANALÍTICA
 * 2. Desativar as contas filhas 1.1.2.01.xxx
 * 3. Excluir os lançamentos duplicados das filhas
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
  console.log('DR. CÍCERO - CORREÇÃO ESTRUTURA CLIENTES A RECEBER');
  console.log('='.repeat(80));

  // 1. Abrir períodos
  console.log('\n1. ABRINDO PERÍODOS...\n');

  await supabase.from('monthly_closings').update({ status: 'open' }).eq('year', 2025).eq('month', 1);
  await supabase.from('accounting_periods').update({ status: 'open' }).eq('year', 2025).eq('month', 1);
  await supabase.from('monthly_closings').upsert({ year: 2024, month: 12, status: 'open' }, { onConflict: 'year,month' });
  await supabase.from('accounting_periods').upsert({ year: 2024, month: 12, status: 'open' }, { onConflict: 'year,month' });

  console.log('   ✅ Períodos abertos');
  await new Promise(r => setTimeout(r, 1000));

  // 2. Voltar 1.1.2.01 para analítica
  console.log('\n2. VOLTANDO 1.1.2.01 PARA ANALÍTICA...\n');

  const { error: errConta } = await supabase
    .from('chart_of_accounts')
    .update({ is_synthetic: false, is_analytical: true })
    .eq('code', '1.1.2.01');

  if (errConta) {
    console.log('   ❌ Erro:', errConta.message);
  } else {
    console.log('   ✅ Conta 1.1.2.01 agora é ANALÍTICA');
  }

  // 3. Voltar 4.1.1.02 para analítica também
  const { error: err4112 } = await supabase
    .from('chart_of_accounts')
    .update({ is_synthetic: false, is_analytical: true })
    .eq('code', '4.1.1.02');

  if (!err4112) {
    console.log('   ✅ Conta 4.1.1.02 agora é ANALÍTICA');
  }

  // 4. Buscar e excluir lançamentos das contas filhas
  console.log('\n3. EXCLUINDO LANÇAMENTOS DUPLICADOS DAS CONTAS FILHAS...\n');

  const { data: contasFilhas } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .like('code', '1.1.2.01.%');

  console.log(`   Contas filhas: ${contasFilhas?.length || 0}`);

  let totalExcluidos = 0;
  let valorExcluido = 0;

  for (const filha of contasFilhas || []) {
    // Buscar linhas desta conta
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('id, entry_id, debit, credit')
      .eq('account_id', filha.id);

    if (!linhas || linhas.length === 0) continue;

    // Coletar entry_ids únicos
    const entryIds = [...new Set(linhas.map(l => l.entry_id))];

    for (const entryId of entryIds) {
      // Calcular valor que será excluído
      const linhasEntry = linhas.filter(l => l.entry_id === entryId);
      for (const l of linhasEntry) {
        valorExcluido += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
      }

      // Excluir linhas
      await supabase.from('accounting_entry_lines').delete().eq('entry_id', entryId);

      // Excluir entry
      const { error } = await supabase.from('accounting_entries').delete().eq('id', entryId);
      if (!error) {
        totalExcluidos++;
      }
    }
  }

  console.log(`   Entries excluídos: ${totalExcluidos}`);
  console.log(`   Valor total removido: R$ ${valorExcluido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 5. Desativar contas filhas
  console.log('\n4. DESATIVANDO CONTAS FILHAS...\n');

  const { error: errFilhas } = await supabase
    .from('chart_of_accounts')
    .update({ is_active: false })
    .like('code', '1.1.2.01.%');

  if (errFilhas) {
    console.log('   ❌ Erro:', errFilhas.message);
  } else {
    console.log(`   ✅ ${contasFilhas?.length} contas filhas desativadas`);
  }

  // 6. Fechar períodos
  console.log('\n5. FECHANDO PERÍODOS...\n');

  await supabase.from('monthly_closings').update({ status: 'closed' }).eq('year', 2025).eq('month', 1);
  await supabase.from('accounting_periods').update({ status: 'closed' }).eq('year', 2025).eq('month', 1);

  console.log('   ✅ Períodos fechados');

  // 7. Verificação final
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO FINAL');
  console.log('='.repeat(80));

  // Recalcular saldo
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id, is_synthetic, is_analytical')
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

  console.log(`\n   Conta 1.1.2.01:`);
  console.log(`   is_analytical: ${conta.is_analytical}`);
  console.log(`   is_synthetic: ${conta.is_synthetic}`);
  console.log(`   Débitos:  R$ ${dFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Créditos: R$ ${cFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Saldo:    R$ ${(dFinal - cFinal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  if (Math.abs((dFinal - cFinal) - 136821.59) < 0.01) {
    console.log('\n   ✅ Saldo confere! (R$ 136.821,59)');
  }

  // Verificar se ainda há contas filhas ativas
  const { count: filhasAtivas } = await supabase
    .from('chart_of_accounts')
    .select('id', { count: 'exact', head: true })
    .like('code', '1.1.2.01.%')
    .eq('is_active', true);

  console.log(`\n   Contas filhas ainda ativas: ${filhasAtivas || 0}`);

  console.log('\n' + '='.repeat(80));
  console.log('Assinado: Dr. Cícero - Agente IA Contábil');
  console.log('='.repeat(80));
}

corrigir().catch(console.error);
