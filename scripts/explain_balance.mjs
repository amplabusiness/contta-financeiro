/**
 * DR. CÍCERO - EXPLICAÇÃO DETALHADA DO BALANÇO
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function explicar() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - EXPLICAÇÃO DO BALANÇO PATRIMONIAL');
  console.log('='.repeat(80));

  console.log(`
  O BALANÇO PATRIMONIAL deve seguir a equação:

  ATIVO = PASSIVO + PATRIMÔNIO LÍQUIDO

  No nosso caso:

  ATIVO:
  - Banco Sicredi:         R$  18.553,54
  - Clientes a Receber:    R$ 136.821,59
  - Adiantamentos Sócios:  R$ 236.351,50
  -----------------------------------------
  TOTAL ATIVO:             R$ 391.726,63

  PASSIVO:
  - (sem passivos operacionais no momento)

  PATRIMÔNIO LÍQUIDO:
  - 2.3.03.01 Saldo Abertura Disponibilidades: R$  90.725,06
  - 2.3.03.02 Saldo Abertura Clientes:         R$ 298.527,29
  - Resultado do Exercício:                    R$   3.601,87
  -----------------------------------------
  TOTAL PL:                                    R$ 392.854,22

  PROBLEMA: O PL está R$ 1.127,59 MAIOR que o Ativo

  Isso significa que:
  1. Ou falta algo no ATIVO
  2. Ou sobra algo no PL
  `);

  // Vamos verificar cada saldo de abertura
  console.log('\nVERIFICANDO SALDOS DE ABERTURA:\n');

  // 1. Saldo Sicredi
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  const { data: linhasSicredi } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, entry:accounting_entries(entry_date, description)')
    .eq('account_id', contaSicredi.id)
    .order('entry(entry_date)')
    .limit(5);

  console.log('   BANCO SICREDI (1.1.1.05) - Primeiros lançamentos:');
  for (const l of linhasSicredi || []) {
    const d = parseFloat(l.debit || 0);
    const c = parseFloat(l.credit || 0);
    console.log(`   ${l.entry?.entry_date} | D: ${d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C: ${c.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${l.entry?.description?.substring(0, 30)}`);
  }

  // 2. Verificar conta 2.3.03.01 (contrapartida do saldo Sicredi)
  console.log('\n   SALDO ABERTURA DISPONIBILIDADES (2.3.03.01):');

  const { data: conta2301 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '2.3.03.01')
    .single();

  const { data: linhas2301 } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, entry:accounting_entries(entry_date, description)')
    .eq('account_id', conta2301?.id);

  for (const l of linhas2301 || []) {
    const d = parseFloat(l.debit || 0);
    const c = parseFloat(l.credit || 0);
    console.log(`   ${l.entry?.entry_date} | D: ${d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C: ${c.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${l.entry?.description?.substring(0, 30)}`);
  }

  // O saldo de abertura do Sicredi deveria ser R$ 90.725,06
  // Mas vimos que havia também R$ 90.725,10 no Bradesco (que excluímos)
  // A diferença é R$ 0,04

  console.log(`

  ANÁLISE DR. CÍCERO:

  O saldo inicial do banco era R$ 90.725,06 (Sicredi)
  Mas havia um lançamento DUPLICADO de R$ 90.725,10 no Bradesco
  que foi EXCLUÍDO.

  Porém, a CONTRAPARTIDA desse lançamento (na conta 2.3.03.01)
  pode ainda estar lá, causando um desequilíbrio.

  Vamos verificar se a conta 2.3.03.01 tem R$ 90.725,06 ou R$ 181.450,16
  `);

  // Calcular saldo de 2.3.03.01
  let saldo2301 = 0;
  for (const l of linhas2301 || []) {
    saldo2301 += parseFloat(l.credit || 0) - parseFloat(l.debit || 0);
  }
  console.log(`   Saldo atual 2.3.03.01: R$ ${saldo2301.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // Verificar saldo do Sicredi
  const { data: todasLinhasSicredi } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contaSicredi.id);

  let saldoSicredi = 0;
  for (const l of todasLinhasSicredi || []) {
    saldoSicredi += parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
  }
  console.log(`   Saldo atual Sicredi:   R$ ${saldoSicredi.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // Se o saldo de abertura no Sicredi é 90.725,06 e a contrapartida é 90.725,06, está certo
  // Verificar se há lançamento de saldo de abertura no Sicredi
  const { data: saldoAbertSicredi } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit, credit,
      entry:accounting_entries(description, reference_type)
    `)
    .eq('account_id', contaSicredi.id)
    .or('entry.description.ilike.%saldo%,entry.description.ilike.%abertura%');

  console.log('\n   Lançamentos de saldo de abertura no Sicredi:');
  let somaSaldoAbertSicredi = 0;
  for (const l of saldoAbertSicredi || []) {
    const d = parseFloat(l.debit || 0);
    somaSaldoAbertSicredi += d;
    console.log(`   D: ${d.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | ${l.entry?.description?.substring(0, 50)}`);
  }
  console.log(`   Total: R$ ${somaSaldoAbertSicredi.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  console.log('\n' + '='.repeat(80));
}

explicar().catch(console.error);
