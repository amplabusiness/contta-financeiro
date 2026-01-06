/**
 * DR. CÍCERO - VERIFICAR ADIANTAMENTOS E SALDOS DE ABERTURA
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
  console.log('DR. CÍCERO - VERIFICAÇÃO COMPLETA DOS SALDOS');
  console.log('='.repeat(80));

  // 1. Verificar todas as contas de adiantamento
  console.log('\n1. ADIANTAMENTOS A SÓCIOS:\n');

  const { data: contasAdiant } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.3.%')
    .eq('is_active', true);

  let totalAdiantamentos = 0;
  for (const conta of contasAdiant || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let d = 0, c = 0;
    for (const l of linhas || []) {
      d += parseFloat(l.debit || 0);
      c += parseFloat(l.credit || 0);
    }
    const saldo = d - c;
    if (saldo !== 0) {
      totalAdiantamentos += saldo;
      console.log(`   ${conta.code.padEnd(15)} R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${conta.name}`);
    }
  }
  console.log(`   ${'TOTAL'.padEnd(15)} R$ ${totalAdiantamentos.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);

  // 2. Verificar se há contrapartida para os adiantamentos no PL
  console.log('\n2. SALDOS DE ABERTURA (Contrapartidas no PL):\n');

  const { data: contasPL } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '2.3.%')
    .eq('is_active', true);

  let totalPL = 0;
  for (const conta of contasPL || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    let d = 0, c = 0;
    for (const l of linhas || []) {
      d += parseFloat(l.debit || 0);
      c += parseFloat(l.credit || 0);
    }
    const saldo = c - d; // PL é credor
    if (saldo !== 0) {
      totalPL += saldo;
      console.log(`   ${conta.code.padEnd(15)} R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${conta.name}`);
    }
  }
  console.log(`   ${'TOTAL'.padEnd(15)} R$ ${totalPL.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);

  // 3. Análise: Os adiantamentos deveriam ter contrapartida?
  console.log(`
  ANÁLISE DR. CÍCERO:

  Os adiantamentos a sócios de R$ ${totalAdiantamentos.toLocaleString('pt-BR', {minimumFractionDigits: 2})} foram
  pagos do banco (saíram do Sicredi).

  Se saíram do banco:
  D: 1.1.3.xx (Adiantamento)      R$ xxx
  C: 1.1.1.05 (Banco Sicredi)     R$ xxx

  Isso NÃO afeta o PL diretamente, é apenas uma troca de ativo.

  Os saldos de abertura no PL totalizam R$ ${totalPL.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
  e representam:
  - Saldo inicial do banco: R$  90.725,06
  - Saldo inicial de clientes: R$ 298.527,29
  - TOTAL: R$ 389.252,35

  VERIFICAÇÃO DA EQUAÇÃO:

  ATIVO = Banco + Clientes + Adiantamentos
        = 18.553,54 + 136.821,59 + ${totalAdiantamentos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
        = R$ ${(18553.54 + 136821.59 + totalAdiantamentos).toLocaleString('pt-BR', {minimumFractionDigits: 2})}

  PL = Saldos Abertura + Resultado
     = ${totalPL.toLocaleString('pt-BR', {minimumFractionDigits: 2})} + 3.601,87
     = R$ ${(totalPL + 3601.87).toLocaleString('pt-BR', {minimumFractionDigits: 2})}

  DIFERENÇA = R$ ${((18553.54 + 136821.59 + totalAdiantamentos) - (totalPL + 3601.87)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
  `);

  // 4. Verificar se os adiantamentos têm contrapartida em alguma conta do PL
  console.log('\n3. VERIFICANDO CONTRAPARTIDA DOS ADIANTAMENTOS:\n');

  // Buscar primeiro lançamento de cada conta de adiantamento
  for (const conta of contasAdiant || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select(`
        debit, credit, entry_id,
        entry:accounting_entries(entry_date, description)
      `)
      .eq('account_id', conta.id)
      .order('entry(entry_date)')
      .limit(1);

    if (!linhas?.length) continue;

    const linha = linhas[0];
    const d = parseFloat(linha.debit || 0);
    if (d === 0) continue;

    // Buscar contrapartida
    const { data: contrapartidas } = await supabase
      .from('accounting_entry_lines')
      .select(`
        debit, credit,
        account:chart_of_accounts(code, name)
      `)
      .eq('entry_id', linha.entry_id)
      .neq('account_id', conta.id);

    console.log(`   ${conta.code}: ${linha.entry?.description?.substring(0, 40)}`);
    for (const cp of contrapartidas || []) {
      const c = parseFloat(cp.credit || 0);
      if (c > 0) {
        console.log(`   -> C: ${cp.account?.code} (${cp.account?.name?.substring(0, 30)}) R$ ${c.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
}

verificar().catch(console.error);
