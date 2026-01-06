/**
 * DR. CÍCERO - VERIFICAÇÃO COMPLETA CONTAS A RECEBER
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
  console.log('DR. CÍCERO - VERIFICAÇÃO COMPLETA CONTAS A RECEBER');
  console.log('='.repeat(80));

  // 1. Conta 1.1.2.01 - lançamentos diretos
  console.log('\n1. CONTA 1.1.2.01 (Clientes a Receber) - LANÇAMENTOS DIRETOS:\n');

  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit, credit, description,
      entry:accounting_entries(entry_date, description, reference_type)
    `)
    .eq('account_id', conta.id)
    .order('entry(entry_date)');

  let totalD = 0, totalC = 0;
  let saldosAberturaD = 0, saldosAberturaC = 0;
  let honorariosD = 0, honorariosC = 0;
  let recebimentosD = 0, recebimentosC = 0;
  let outrosD = 0, outrosC = 0;

  for (const l of linhas || []) {
    const d = parseFloat(l.debit || 0);
    const c = parseFloat(l.credit || 0);
    totalD += d;
    totalC += c;

    const desc = (l.description || l.entry?.description || '').toLowerCase();
    const refType = l.entry?.reference_type || '';

    if (desc.includes('saldo') || desc.includes('abertura') || refType === 'opening_balance') {
      saldosAberturaD += d;
      saldosAberturaC += c;
    } else if (desc.includes('honorário') || desc.includes('fatura') || refType === 'invoice') {
      honorariosD += d;
      honorariosC += c;
    } else if (desc.includes('recebimento') || desc.includes('pagamento') || refType === 'payment') {
      recebimentosD += d;
      recebimentosC += c;
    } else {
      outrosD += d;
      outrosC += c;
    }
  }

  console.log('   Composição dos lançamentos:');
  console.log(`   - Saldos de Abertura:  D ${saldosAberturaD.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | C ${saldosAberturaC.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   - Honorários (faturas): D ${honorariosD.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | C ${honorariosC.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   - Recebimentos:         D ${recebimentosD.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | C ${recebimentosC.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   - Outros:               D ${outrosD.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | C ${outrosC.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log('   -'.repeat(30));
  console.log(`   TOTAL:                  D ${totalD.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | C ${totalC.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   SALDO:                  R$ ${(totalD - totalC).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 2. Contas filhas
  console.log('\n2. CONTAS FILHAS (1.1.2.01.xxx):\n');

  const { data: contasFilhas } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .like('code', '1.1.2.01.%');

  let totalFilhasD = 0, totalFilhasC = 0;

  for (const filha of contasFilhas || []) {
    const { data: linhasFilha } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', filha.id);

    for (const l of linhasFilha || []) {
      totalFilhasD += parseFloat(l.debit || 0);
      totalFilhasC += parseFloat(l.credit || 0);
    }
  }

  console.log(`   Total filhas: ${contasFilhas?.length || 0}`);
  console.log(`   Total D: ${totalFilhasD.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Total C: ${totalFilhasC.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Saldo:   ${(totalFilhasD - totalFilhasC).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 3. Análise conforme memory.md
  console.log('\n3. ANÁLISE CONFORME MEMORY.MD:\n');

  // Valores do memory.md para Janeiro/2025:
  // - Saldo Inicial (Clientes a Receber em 31/12/2024): R$ 298.527,29
  // - Saldo Final (Clientes a Receber em 31/01/2025): R$ 136.821,59

  console.log('   Valores esperados (memory.md):');
  console.log('   - Saldo de Abertura (31/12/2024): R$ 298.527,29');
  console.log('   - Honorários Janeiro/2025:       R$ 136.821,59');
  console.log('   - Recebimentos Janeiro:          R$ 298.527,29 (todo saldo anterior foi quitado)');
  console.log('   - Saldo Final (31/01/2025):      R$ 136.821,59');
  console.log('');
  console.log('   Fórmula: Saldo Final = Saldo Abertura + Honorários - Recebimentos');
  console.log('           136.821,59 = 298.527,29 + 136.821,59 - 298.527,29 ✓');

  // 4. Verificar se os valores batem
  console.log('\n4. COMPARAÇÃO:\n');

  console.log(`   Na conta 1.1.2.01:`);
  console.log(`   - Saldos de Abertura (D): R$ ${saldosAberturaD.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (esperado: 298.527,29)`);
  console.log(`   - Honorários (D):         R$ ${honorariosD.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (esperado: 136.821,59)`);
  console.log(`   - Recebimentos (C):       R$ ${saldosAberturaC.toLocaleString('pt-BR', {minimumFractionDigits: 2})} (esperado: 298.527,29)`);
  console.log(`   - Saldo Final:            R$ ${(totalD - totalC).toLocaleString('pt-BR', {minimumFractionDigits: 2})} (esperado: 136.821,59)`);

  // 5. Se houver problema estrutural
  console.log('\n5. DIAGNÓSTICO:\n');

  const saldoEsperado = 136821.59;
  const saldoCalculado = totalD - totalC;

  if (Math.abs(saldoCalculado - saldoEsperado) < 0.01) {
    console.log('   ✅ Saldo da conta 1.1.2.01 está CORRETO!');
    console.log('');
    console.log('   O problema é que as contas FILHAS (1.1.2.01.xxx) estão');
    console.log('   duplicando parte do saldo de abertura.');
    console.log('');
    console.log('   SOLUÇÃO: Desativar as contas filhas e manter apenas 1.1.2.01');
  } else {
    console.log('   ❌ Há divergência no saldo');
    console.log(`   Diferença: R$ ${(saldoCalculado - saldoEsperado).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  }

  // 6. Verificar conta 2.3.03.02 (contrapartida do saldo de abertura)
  console.log('\n6. CONTA 2.3.03.02 (Saldo de Abertura - Clientes):\n');

  const { data: conta2302 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '2.3.03.02')
    .single();

  const { data: linhas2302 } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta2302?.id);

  let d2302 = 0, c2302 = 0;
  for (const l of linhas2302 || []) {
    d2302 += parseFloat(l.debit || 0);
    c2302 += parseFloat(l.credit || 0);
  }

  console.log(`   Saldo: R$ ${(c2302 - d2302).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log('   Este é o valor de clientes a receber que veio do ano anterior.');
  console.log('   Está registrado no PASSIVO (Patrimônio Líquido - Saldos de Abertura).');

  console.log('\n' + '='.repeat(80));
}

verificar().catch(console.error);
