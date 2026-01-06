/**
 * DR. CÍCERO - INVESTIGAÇÃO DETALHADA SALDO BRADESCO
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigar() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - INVESTIGAÇÃO DETALHADA SALDO BRADESCO');
  console.log('='.repeat(80));

  // 1. Buscar o lançamento específico
  console.log('\n1. LANÇAMENTO NA CONTA BRADESCO (1.1.1.02):\n');

  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.02')
    .single();

  const { data: linha } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      debit,
      credit,
      description,
      entry_id
    `)
    .eq('account_id', conta.id)
    .single();

  console.log('   Linha ID:', linha.id);
  console.log('   Entry ID:', linha.entry_id);
  console.log('   Débito:', linha.debit);
  console.log('   Crédito:', linha.credit);
  console.log('   Descrição:', linha.description);

  // 2. Buscar o entry completo
  console.log('\n2. LANÇAMENTO CONTÁBIL COMPLETO:\n');

  const { data: entry } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('id', linha.entry_id)
    .single();

  console.log('   ID:', entry.id);
  console.log('   Data:', entry.entry_date);
  console.log('   Competência:', entry.competence_date);
  console.log('   Descrição:', entry.description);
  console.log('   Tipo:', entry.entry_type);
  console.log('   Reference Type:', entry.reference_type);
  console.log('   Reference ID:', entry.reference_id);
  console.log('   Source Type:', entry.source_type);
  console.log('   Internal Code:', entry.internal_code);

  // 3. Buscar TODAS as linhas deste lançamento (contrapartida)
  console.log('\n3. CONTRAPARTIDA DO LANÇAMENTO:\n');

  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      debit,
      credit,
      description,
      account:chart_of_accounts(code, name)
    `)
    .eq('entry_id', linha.entry_id);

  for (const l of todasLinhas || []) {
    const tipo = parseFloat(l.debit || 0) > 0 ? 'D' : 'C';
    const valor = parseFloat(l.debit || 0) || parseFloat(l.credit || 0);
    console.log(`   ${tipo}: ${l.account?.code} - ${l.account?.name}`);
    console.log(`      Valor: R$ ${valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }

  // 4. Verificar se o valor está correto
  console.log('\n4. ANÁLISE DR. CÍCERO:\n');

  // Buscar saldo inicial do Sicredi para comparar
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  const { data: linhasSicredi } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, entry:accounting_entries(entry_date, description)')
    .eq('account_id', contaSicredi.id)
    .order('entry(entry_date)', { ascending: true })
    .limit(5);

  console.log('   Primeiros lançamentos Sicredi (1.1.1.05):');
  for (const l of linhasSicredi || []) {
    const d = parseFloat(l.debit || 0);
    const c = parseFloat(l.credit || 0);
    console.log(`   ${l.entry?.entry_date} | D: ${d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C: ${c.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);
  }

  // 5. PERGUNTA CRUCIAL: O saldo de R$ 90.725,10 deveria estar no Bradesco ou no Sicredi?
  console.log('\n5. QUESTÃO CRUCIAL:\n');
  console.log('   O valor R$ 90.725,10 corresponde ao saldo de abertura de 01/01/2025.');
  console.log('   Este valor foi lançado na conta 1.1.1.02 (Bradesco).');
  console.log('');
  console.log('   ⚠️ PORÉM, conforme memory.md:');
  console.log('   "Saldo Banco Sicredi: R$ 18.553,54" (em 31/01/2025)');
  console.log('   "Saldo inicial: R$ 90.725,06" (extrato Janeiro)');
  console.log('');
  console.log('   Se o saldo inicial de R$ 90.725,06 era do SICREDI,');
  console.log('   então este lançamento está na CONTA ERRADA!');

  // 6. Verificar banco de dados de contas bancárias
  console.log('\n6. CONTAS BANCÁRIAS CADASTRADAS:\n');

  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('id, name, bank_code, current_balance, is_active')
    .order('name');

  for (const ba of bankAccounts || []) {
    console.log(`   ${ba.is_active ? '✓' : '✗'} ${ba.name} (${ba.bank_code || 'N/A'}) - Saldo: R$ ${ba.current_balance?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}`);
  }

  // 7. Sugestão de correção
  console.log('\n' + '='.repeat(80));
  console.log('PARECER DR. CÍCERO');
  console.log('='.repeat(80));
  console.log('\n');
  console.log('   O lançamento de saldo de abertura de R$ 90.725,10 está na');
  console.log('   conta ERRADA (1.1.1.02 - Bradesco) quando deveria estar na');
  console.log('   conta 1.1.1.05 (Sicredi), que é a conta bancária principal.');
  console.log('');
  console.log('   AÇÃO NECESSÁRIA:');
  console.log('   Reclassificar o lançamento de 1.1.1.02 para 1.1.1.05');
  console.log('');
}

investigar().catch(console.error);
