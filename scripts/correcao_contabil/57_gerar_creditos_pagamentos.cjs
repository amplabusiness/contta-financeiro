// scripts/correcao_contabil/57_gerar_creditos_pagamentos.cjs
// Gerar lançamentos de CRÉDITO para honorários marcados como pagos

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Conta do banco
const CONTA_BANCO = '1.1.1.05'; // Banco Sicredi

async function gerarCreditos() {
  console.log('='.repeat(100));
  console.log('GERANDO LANÇAMENTOS DE CRÉDITO (PAGAMENTOS) PARA HONORÁRIOS PAGOS');
  console.log('='.repeat(100));

  // 1. Buscar honorários pagos (status = 'paid' ou paid_amount > 0)
  const { data: honorariosPagos, error: errHon } = await supabase
    .from('client_opening_balance')
    .select('*, clients(name)')
    .or('status.eq.paid,paid_amount.gt.0')
    .order('paid_date');

  if (errHon) {
    console.error('Erro ao buscar honorários:', errHon);
    return;
  }

  console.log(`\n📋 Honorários pagos/parciais encontrados: ${honorariosPagos?.length || 0}`);

  // 2. Buscar conta do banco
  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_BANCO)
    .single();

  if (!contaBanco) {
    console.error('Conta do banco não encontrada:', CONTA_BANCO);
    return;
  }

  console.log(`📊 Conta Banco: ${contaBanco.code} - ${contaBanco.name}`);

  // 3. Buscar conta PL para contrapartida (5.2.1.01 - Lucros Acumulados)
  // Na verdade, o correto é D-Banco / C-Cliente
  // O lançamento original foi: D-Cliente / C-PL (saldo de abertura)
  // O pagamento deve ser: D-Banco / C-Cliente

  let lancamentosCriados = 0;
  let valorTotal = 0;

  for (const hon of honorariosPagos || []) {
    const valorPago = Number(hon.paid_amount || hon.amount || 0);
    if (valorPago <= 0) continue;

    const clienteName = hon.clients?.name || 'CLIENTE';
    const dataPagamento = hon.paid_date || hon.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];

    // Buscar conta do cliente (subconta de 1.1.2.01)
    const { data: contaCliente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .like('code', '1.1.2.01.%')
      .ilike('name', `%${clienteName.substring(0, 20)}%`)
      .not('name', 'ilike', '%[CONSOLIDADO]%')
      .limit(1)
      .single();

    if (!contaCliente) {
      console.log(`   ⚠️  Conta não encontrada para cliente: ${clienteName}`);
      continue;
    }

    // Verificar se já existe lançamento de crédito para este pagamento
    // Buscar por descrição similar
    const descricao = `Recebimento Honorário ${hon.competence} - ${clienteName}`;

    const { data: existente } = await supabase
      .from('accounting_entries')
      .select('id')
      .ilike('description', `%Recebimento%${hon.competence}%${clienteName.substring(0, 15)}%`)
      .limit(1);

    if (existente?.length > 0) {
      // Já existe, pular
      continue;
    }

    console.log(`   📝 ${dataPagamento} | ${clienteName.substring(0, 30)} | ${hon.competence} | R$ ${valorPago.toFixed(2)}`);

    // Criar lançamento contábil
    // D - Banco / C - Cliente
    const { data: entry, error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: dataPagamento,
        entry_type: 'RECEBIMENTO',
        description: descricao.substring(0, 200),
        reference_type: 'client_opening_balance',
        reference_id: hon.id,
        total_debit: valorPago,
        total_credit: valorPago,
        balanced: true,
        created_by: '00000000-0000-0000-0000-000000000000' // Sistema
      })
      .select()
      .single();

    if (errEntry) {
      console.error(`   ❌ Erro ao criar entry:`, errEntry.message);
      continue;
    }

    // Criar linhas: D-Banco, C-Cliente
    const { error: errItems } = await supabase
      .from('accounting_entry_items')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaBanco.id,
          debit: valorPago,
          credit: 0,
          description: `Recebimento ${clienteName.substring(0, 30)}`
        },
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: 0,
          credit: valorPago,
          description: `Baixa Honorário ${hon.competence}`
        }
      ]);

    if (errItems) {
      console.error(`   ❌ Erro ao criar items:`, errItems.message);
      // Limpar entry órfão
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      continue;
    }

    lancamentosCriados++;
    valorTotal += valorPago;
  }

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESUMO:');
  console.log('='.repeat(100));
  console.log(`   Lançamentos de recebimento criados: ${lancamentosCriados}`);
  console.log(`   Valor total creditado nas contas de clientes: R$ ${valorTotal.toFixed(2)}`);
  console.log('='.repeat(100));
}

gerarCreditos().catch(console.error);
