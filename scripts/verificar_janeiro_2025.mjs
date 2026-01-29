// scripts/verificar_janeiro_2025.mjs
// Verifica o estado atual para processar janeiro 2025
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarJaneiro2025() {
  console.log('='.repeat(80));
  console.log('VERIFICAÇÃO - PROCESSAMENTO JANEIRO 2025');
  console.log('='.repeat(80));

  // 1. Verificar clientes ativos
  console.log('\n📊 1. CLIENTES ATIVOS COM HONORÁRIOS');
  console.log('-'.repeat(80));

  const { data: clientes, error: errClientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee, status')
    .eq('status', 'active')
    .gt('monthly_fee', 0)
    .order('name');

  if (errClientes) {
    console.error('Erro ao buscar clientes:', errClientes.message);
  } else {
    console.log(`Total: ${clientes.length} clientes ativos`);
    let totalHonorarios = 0;
    for (const c of clientes.slice(0, 10)) {
      console.log(`  ${c.name.substring(0,40).padEnd(40)} R$ ${Number(c.monthly_fee).toFixed(2)}`);
      totalHonorarios += Number(c.monthly_fee || 0);
    }
    if (clientes.length > 10) {
      console.log(`  ... e mais ${clientes.length - 10} clientes`);
      for (const c of clientes.slice(10)) {
        totalHonorarios += Number(c.monthly_fee || 0);
      }
    }
    console.log(`\n  TOTAL HONORÁRIOS: R$ ${totalHonorarios.toFixed(2)}/mês`);
  }

  // 2. Verificar honorários já gerados para janeiro 2025
  console.log('\n📊 2. HONORÁRIOS JÁ GERADOS (JANEIRO 2025)');
  console.log('-'.repeat(80));

  const { data: honorariosJan, error: errHon } = await supabase
    .from('accounting_entries')
    .select('id, description, entry_date, reference_id')
    .eq('entry_type', 'receita_honorarios')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  if (errHon) {
    console.error('Erro:', errHon.message);
  } else {
    console.log(`Encontrados: ${honorariosJan?.length || 0} lançamentos`);
    if (honorariosJan && honorariosJan.length > 0) {
      for (const h of honorariosJan.slice(0, 5)) {
        console.log(`  ${h.entry_date} - ${h.description?.substring(0, 50)}`);
      }
      if (honorariosJan.length > 5) {
        console.log(`  ... e mais ${honorariosJan.length - 5} lançamentos`);
      }
    } else {
      console.log('  ⚠️  Nenhum honorário gerado para janeiro 2025');
    }
  }

  // 3. Verificar transações bancárias de janeiro 2025
  console.log('\n📊 3. TRANSAÇÕES BANCÁRIAS (JANEIRO 2025)');
  console.log('-'.repeat(80));

  const { data: transacoes, error: errTx } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, amount, description, type')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  if (errTx) {
    console.error('Erro:', errTx.message);
  } else {
    const creditos = transacoes?.filter(t => Number(t.amount) > 0) || [];
    const debitos = transacoes?.filter(t => Number(t.amount) < 0) || [];

    console.log(`Total transações: ${transacoes?.length || 0}`);
    console.log(`  Créditos: ${creditos.length} (R$ ${creditos.reduce((s, t) => s + Number(t.amount), 0).toFixed(2)})`);
    console.log(`  Débitos: ${debitos.length} (R$ ${debitos.reduce((s, t) => s + Math.abs(Number(t.amount)), 0).toFixed(2)})`);

    if (creditos.length > 0) {
      console.log('\n  Primeiros créditos:');
      for (const t of creditos.slice(0, 3)) {
        console.log(`    ${t.transaction_date} | R$ ${Number(t.amount).toFixed(2)} | ${t.description?.substring(0, 40)}`);
      }
    }
  }

  // 4. Verificar lançamentos contábeis de janeiro 2025
  console.log('\n📊 4. LANÇAMENTOS CONTÁBEIS (JANEIRO 2025)');
  console.log('-'.repeat(80));

  const { data: lancamentos, error: errLanc } = await supabase
    .from('accounting_entries')
    .select('id, entry_type, entry_date, description')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  if (errLanc) {
    console.error('Erro:', errLanc.message);
  } else {
    const porTipo = {};
    for (const l of lancamentos || []) {
      porTipo[l.entry_type] = (porTipo[l.entry_type] || 0) + 1;
    }

    console.log(`Total: ${lancamentos?.length || 0} lançamentos`);
    for (const [tipo, qtd] of Object.entries(porTipo)) {
      console.log(`  ${tipo}: ${qtd}`);
    }
  }

  // 5. Verificar saldo do banco Sicredi
  console.log('\n📊 5. SALDO BANCO SICREDI (1.1.1.05)');
  console.log('-'.repeat(80));

  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  if (contaBanco) {
    const { data: movs } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', contaBanco.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', contaBanco.id);

    let saldo = 0;
    saldo += (movs || []).reduce((s, m) => s + Number(m.debit || 0) - Number(m.credit || 0), 0);
    saldo += (lines || []).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);

    console.log(`  Saldo atual: R$ ${saldo.toFixed(2)}`);
  }

  // 6. Verificar conta transitória
  console.log('\n📊 6. CONTA TRANSITÓRIA (1.1.9.01)');
  console.log('-'.repeat(80));

  const { data: contaTrans } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9.01')
    .single();

  if (contaTrans) {
    const { data: movs } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', contaTrans.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', contaTrans.id);

    let saldo = 0;
    saldo += (movs || []).reduce((s, m) => s + Number(m.debit || 0) - Number(m.credit || 0), 0);
    saldo += (lines || []).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);

    console.log(`  Saldo: R$ ${saldo.toFixed(2)}`);
    if (Math.abs(saldo) < 0.01) {
      console.log('  ✅ Conta zerada');
    } else {
      console.log('  ⚠️  Pendente de desmembramento');
    }
  } else {
    console.log('  ⚠️  Conta transitória não encontrada');
  }

  console.log('\n' + '='.repeat(80));
  console.log('FIM DA VERIFICAÇÃO');
  console.log('='.repeat(80));
}

verificarJaneiro2025();
