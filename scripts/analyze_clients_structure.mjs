/**
 * DR. CÍCERO - ANÁLISE DA ESTRUTURA DE CLIENTES A RECEBER
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analisar() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - ANÁLISE ESTRUTURA CLIENTES A RECEBER');
  console.log('='.repeat(80));

  // 1. Saldo da conta 1.1.2.01 (agora sintética)
  console.log('\n1. CONTA 1.1.2.01 (SINTÉTICA) - LANÇAMENTOS DIRETOS:\n');

  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id, is_synthetic')
    .eq('code', '1.1.2.01')
    .single();

  const { data: linhasConta } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta.id);

  let totalD = 0, totalC = 0;
  for (const l of linhasConta || []) {
    totalD += parseFloat(l.debit || 0);
    totalC += parseFloat(l.credit || 0);
  }

  console.log('   is_synthetic:', conta.is_synthetic);
  console.log('   Lançamentos diretos:', linhasConta?.length || 0);
  console.log('   Total Débitos:', totalD.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('   Total Créditos:', totalC.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('   Saldo:', (totalD - totalC).toLocaleString('pt-BR', {minimumFractionDigits: 2}));

  // 2. Soma das contas filhas
  console.log('\n2. SOMA DAS CONTAS FILHAS (1.1.2.01.xxx):\n');

  const { data: contasFilhas } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .like('code', '1.1.2.01.%');

  let somaFilhas = 0;
  for (const filha of contasFilhas || []) {
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', filha.id);

    let d = 0, c = 0;
    for (const l of linhas || []) {
      d += parseFloat(l.debit || 0);
      c += parseFloat(l.credit || 0);
    }
    somaFilhas += (d - c);
  }

  console.log('   Total filhas:', contasFilhas?.length || 0);
  console.log('   Soma saldos:', somaFilhas.toLocaleString('pt-BR', {minimumFractionDigits: 2}));

  // 3. Problema identificado
  console.log('\n3. ANÁLISE DO PROBLEMA:\n');

  const valorEsperado = 136821.59;
  const saldoConta = totalD - totalC;

  console.log('   Valor esperado (memory.md):     R$', valorEsperado.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('   Saldo conta 1.1.2.01 direta:   R$', saldoConta.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('   Soma contas filhas:             R$', somaFilhas.toLocaleString('pt-BR', {minimumFractionDigits: 2}));

  if (Math.abs(saldoConta - valorEsperado) < 0.01) {
    console.log('\n   ✅ O saldo CORRETO está nos lançamentos DIRETOS da conta 1.1.2.01');
    console.log('   As contas filhas são uma duplicidade dos saldos de abertura.');

    // Verificar se os lançamentos nas filhas são apenas saldos de abertura
    console.log('\n4. VERIFICANDO ORIGEM DOS LANÇAMENTOS NAS FILHAS:\n');

    let saldosAberturaFilhas = 0;
    let outrosFilhas = 0;

    for (const filha of contasFilhas || []) {
      const { data: linhas } = await supabase
        .from('accounting_entry_lines')
        .select(`
          debit, credit, description,
          entry:accounting_entries(description, reference_type)
        `)
        .eq('account_id', filha.id);

      for (const l of linhas || []) {
        const valor = parseFloat(l.debit || 0) - parseFloat(l.credit || 0);
        const desc = (l.description || l.entry?.description || '').toLowerCase();

        if (desc.includes('saldo') || desc.includes('abertura') || l.entry?.reference_type === 'opening_balance') {
          saldosAberturaFilhas += valor;
        } else {
          outrosFilhas += valor;
        }
      }
    }

    console.log('   Nas contas filhas:');
    console.log('   - Saldos de abertura: R$', saldosAberturaFilhas.toLocaleString('pt-BR', {minimumFractionDigits: 2}));
    console.log('   - Outros lançamentos: R$', outrosFilhas.toLocaleString('pt-BR', {minimumFractionDigits: 2}));

    if (Math.abs(saldosAberturaFilhas - somaFilhas) < 1) {
      console.log('\n   ⚠️ As contas filhas contêm apenas saldos de abertura!');
      console.log('   Esses valores são DUPLICADOS em relação à conta 1.1.2.01');
      console.log('\n   SOLUÇÃO: Os lançamentos nas contas filhas devem ser excluídos');
      console.log('   OU as contas filhas devem ser desativadas.');
    }
  }

  // 5. Verificar a conta 2.3.03.99 (Saldos de Abertura - Diversos)
  console.log('\n5. VERIFICANDO CONTA 2.3.03.99 (Contrapartida dos Saldos):\n');

  const { data: conta2399 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '2.3.03.99')
    .single();

  const { data: linhas2399 } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta2399?.id);

  let d2399 = 0, c2399 = 0;
  for (const l of linhas2399 || []) {
    d2399 += parseFloat(l.debit || 0);
    c2399 += parseFloat(l.credit || 0);
  }

  console.log('   Saldo 2.3.03.99: R$', (c2399 - d2399).toLocaleString('pt-BR', {minimumFractionDigits: 2}));
  console.log('   Este valor está no PASSIVO (Saldo de Abertura - Diversos)');

  // 6. A solução
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNÓSTICO E SOLUÇÃO');
  console.log('='.repeat(80));

  console.log(`
   O problema é estrutural:

   1. A conta 1.1.2.01 (Clientes a Receber) foi marcada como SINTÉTICA
      mas os lançamentos de Janeiro/2025 estão NELA DIRETAMENTE, não nas filhas.

   2. As contas filhas (1.1.2.01.xxx) contêm apenas saldos de abertura,
      que já estão também na conta 1.1.2.01 via outra contrapartida.

   OPÇÕES DE SOLUÇÃO:

   A) Voltar 1.1.2.01 para ANALÍTICA e desativar as contas filhas
      - Mantém os R$ 136.821,59 na conta 1.1.2.01
      - Exclui ou desativa as contas 1.1.2.01.xxx

   B) Mover os lançamentos de 1.1.2.01 para as filhas apropriadas
      - Complexo, requer identificar cliente de cada lançamento

   C) Excluir os lançamentos duplicados nas contas filhas
      - Remove os R$ 103.921,37 das filhas
      - Mantém estrutura atual
  `);
}

analisar().catch(console.error);
