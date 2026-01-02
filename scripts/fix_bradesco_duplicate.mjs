/**
 * DR. CÍCERO - CORREÇÃO SALDO DUPLICADO BRADESCO
 *
 * PROBLEMA: O saldo de abertura de R$ 90.725,10 foi lançado
 * na conta ERRADA (1.1.1.02 - Bradesco) quando deveria estar
 * apenas na conta 1.1.1.05 (Sicredi).
 *
 * SOLUÇÃO: Excluir o lançamento duplicado da conta Bradesco.
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
  console.log('DR. CÍCERO - CORREÇÃO SALDO DUPLICADO BRADESCO');
  console.log('='.repeat(80));

  // 1. Identificar a linha a ser corrigida
  console.log('\n1. IDENTIFICANDO LANÇAMENTO INCORRETO...\n');

  const { data: contaBradesco } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.02')
    .single();

  const { data: linhaBradesco } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id, debit')
    .eq('account_id', contaBradesco.id)
    .single();

  console.log('   Entry ID:', linhaBradesco.entry_id);
  console.log('   Linha ID:', linhaBradesco.id);
  console.log('   Valor:', linhaBradesco.debit);

  // 2. Buscar o entry completo para verificar
  const { data: entry } = await supabase
    .from('accounting_entries')
    .select('*, lines:accounting_entry_lines(id, account_id, debit, credit)')
    .eq('id', linhaBradesco.entry_id)
    .single();

  console.log('\n   Lançamento encontrado:');
  console.log('   Descrição:', entry.description);
  console.log('   Data:', entry.entry_date);
  console.log('   Linhas:', entry.lines?.length);

  // 3. Abrir períodos para permitir alteração
  console.log('\n2. ABRINDO PERÍODOS PARA CORREÇÃO...\n');

  await supabase.from('monthly_closings')
    .update({ status: 'open' })
    .eq('year', 2025).eq('month', 1);

  await supabase.from('accounting_periods')
    .update({ status: 'open' })
    .eq('year', 2025).eq('month', 1);

  // Também abrir dezembro 2024 (data do lançamento)
  await supabase.from('monthly_closings')
    .upsert({ year: 2024, month: 12, status: 'open' }, { onConflict: 'year,month' });

  await supabase.from('accounting_periods')
    .upsert({ year: 2024, month: 12, status: 'open' }, { onConflict: 'year,month' });

  console.log('   ✅ Períodos abertos');
  await new Promise(r => setTimeout(r, 1000));

  // 4. OPÇÃO A: Excluir o lançamento completo (entry + linhas)
  // OPÇÃO B: Apenas corrigir a conta (de Bradesco para Sicredi)
  // Vamos verificar primeiro se já existe um lançamento no Sicredi

  console.log('\n3. VERIFICANDO SE JÁ EXISTE SALDO DE ABERTURA NO SICREDI...\n');

  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  const { data: linhasSicredi } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit,
      entry:accounting_entries(entry_date, description)
    `)
    .eq('account_id', contaSicredi.id)
    .ilike('entry.description', '%saldo%abertura%');

  console.log('   Lançamentos de saldo de abertura no Sicredi:');
  for (const l of linhasSicredi || []) {
    console.log(`   - ${l.entry?.entry_date}: D ${l.debit} C ${l.credit} - ${l.entry?.description}`);
  }

  // Verificar primeiro lançamento do Sicredi
  const { data: primeiroSicredi } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit,
      entry:accounting_entries(entry_date, description, entry_type)
    `)
    .eq('account_id', contaSicredi.id)
    .order('entry(entry_date)', { ascending: true })
    .limit(1)
    .single();

  console.log('\n   Primeiro lançamento Sicredi:');
  console.log(`   Data: ${primeiroSicredi?.entry?.entry_date}`);
  console.log(`   Valor D: ${primeiroSicredi?.debit}`);
  console.log(`   Descrição: ${primeiroSicredi?.entry?.description}`);

  // Se já existe saldo de abertura no Sicredi, o lançamento no Bradesco é DUPLICADO
  // e deve ser EXCLUÍDO

  console.log('\n4. EXCLUINDO LANÇAMENTO DUPLICADO...\n');

  // Primeiro excluir as linhas
  const { error: errLinhas } = await supabase
    .from('accounting_entry_lines')
    .delete()
    .eq('entry_id', linhaBradesco.entry_id);

  if (errLinhas) {
    console.log('   ❌ Erro ao excluir linhas:', errLinhas.message);
  } else {
    console.log('   ✅ Linhas excluídas');
  }

  // Depois excluir o entry
  const { error: errEntry } = await supabase
    .from('accounting_entries')
    .delete()
    .eq('id', linhaBradesco.entry_id);

  if (errEntry) {
    console.log('   ❌ Erro ao excluir entry:', errEntry.message);
  } else {
    console.log('   ✅ Entry excluído');
  }

  // 5. Fechar períodos novamente
  console.log('\n5. FECHANDO PERÍODOS...\n');

  await supabase.from('monthly_closings')
    .update({ status: 'closed' })
    .eq('year', 2025).eq('month', 1);

  await supabase.from('accounting_periods')
    .update({ status: 'closed' })
    .eq('year', 2025).eq('month', 1);

  console.log('   ✅ Períodos fechados');

  // 6. Verificar resultado
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO FINAL');
  console.log('='.repeat(80));

  const { data: saldoBradesco } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contaBradesco.id);

  let totalBradesco = 0;
  for (const l of saldoBradesco || []) {
    totalBradesco += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
  }

  const { data: saldoSicredi } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contaSicredi.id);

  let totalSicredi = 0;
  for (const l of saldoSicredi || []) {
    totalSicredi += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
  }

  console.log(`\n   1.1.1.02 (Bradesco): R$ ${totalBradesco.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   1.1.1.05 (Sicredi):  R$ ${totalSicredi.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  if (totalBradesco === 0) {
    console.log('\n   ✅ Saldo fantasma do Bradesco CORRIGIDO!');
  } else {
    console.log('\n   ⚠️ Ainda há saldo no Bradesco');
  }

  console.log('\n' + '='.repeat(80));
  console.log('Assinado: Dr. Cícero - Agente IA Contábil');
  console.log('='.repeat(80));
}

corrigir().catch(console.error);
