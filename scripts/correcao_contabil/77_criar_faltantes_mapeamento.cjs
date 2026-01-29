// scripts/correcao_contabil/77_criar_faltantes_mapeamento.cjs
// Criar lançamentos faltantes com mapeamento manual de contas

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTA_PL = '5.2.1.01'; // Lucros Acumulados
const DATA_COMPETENCIA = '2024-12-01';
const DATA_ENTRY = '2024-12-31';

// Mapeamento de nomes em client_opening_balance para códigos de conta
const MAPEAMENTO_CONTAS = {
  'KORSICA COM ATAC DE PNEUS LTDA': '1.1.2.01.0093',
  'PM ADMINSTRAÇÃO E SERVIÇOS': '1.1.2.01.0052',
  'UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA': '1.1.2.01.0101',
  'TIMES NEGOCIOS IMOBILIARIOS LTDA': '1.1.2.01.0006',
};

async function criarFaltantes() {
  console.log('='.repeat(100));
  console.log('CRIANDO LANÇAMENTOS FALTANTES COM MAPEAMENTO MANUAL');
  console.log('='.repeat(100));

  // Buscar conta de Lucros Acumulados
  const { data: contaPL } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_PL)
    .single();

  if (!contaPL) {
    console.error('❌ Conta de Lucros Acumulados não encontrada!');
    return;
  }

  console.log(`\n📊 Conta PL: ${contaPL.code} - ${contaPL.name}`);

  // Buscar TODOS os honorários PENDENTES
  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('id, client_id, competence, amount, paid_amount, status, clients(name)')
    .neq('status', 'paid');

  console.log(`📋 Total de honorários pendentes: ${pendentes?.length || 0}`);

  let criados = 0;
  let valorTotal = 0;
  let jaExistem = 0;
  let contaNaoEncontrada = 0;

  for (const hon of pendentes || []) {
    const clienteName = hon.clients?.name || '';
    const saldo = Number(hon.amount || 0) - Number(hon.paid_amount || 0);

    if (saldo <= 0) continue;

    // Buscar conta do cliente - primeiro tenta mapeamento manual
    let contaCliente = null;
    const codigoMapeado = MAPEAMENTO_CONTAS[clienteName];

    if (codigoMapeado) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('code', codigoMapeado)
        .single();
      contaCliente = conta;
    }

    // Se não achou pelo mapeamento, busca pelo nome
    if (!contaCliente) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .like('code', '1.1.2.01.%')
        .ilike('name', `%${clienteName.substring(0, 15)}%`)
        .not('name', 'ilike', '%[CONSOLIDADO]%')
        .limit(1)
        .single();
      contaCliente = conta;
    }

    if (!contaCliente) {
      if (contaNaoEncontrada < 5) {
        console.log(`   ⚠️  Conta não encontrada: ${clienteName}`);
      }
      contaNaoEncontrada++;
      continue;
    }

    // Verificar se já existe lançamento para este valor nesta conta
    const { data: existingItems } = await supabase
      .from('accounting_entry_items')
      .select('id, entry_id, debit, accounting_entries(entry_type, description)')
      .eq('account_id', contaCliente.id)
      .eq('debit', saldo);

    const { data: existingLines } = await supabase
      .from('accounting_entry_lines')
      .select('id, entry_id, debit, accounting_entries(entry_type, description)')
      .eq('account_id', contaCliente.id)
      .eq('debit', saldo);

    const allExisting = [...(existingItems || []), ...(existingLines || [])];
    const temLancamento = allExisting.some(l =>
      l.accounting_entries?.entry_type === 'SALDO_ABERTURA' ||
      l.accounting_entries?.description?.toLowerCase().includes('saldo de abertura')
    );

    if (temLancamento) {
      jaExistem++;
      continue;
    }

    // Criar lançamento
    const descricao = `Saldo de abertura - ${hon.competence} - ${clienteName.substring(0, 40)}`;

    console.log(`   Criando: ${contaCliente.code} | ${clienteName.substring(0, 25).padEnd(25)} | ${hon.competence} | R$ ${saldo.toFixed(2)}`);

    // Criar entry
    const { data: entry, error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: DATA_ENTRY,
        competence_date: DATA_COMPETENCIA,
        entry_type: 'SALDO_ABERTURA',
        description: descricao,
        total_debit: saldo,
        total_credit: saldo,
        balanced: true
      })
      .select()
      .single();

    if (errEntry) {
      console.error(`   ❌ Erro ao criar entry: ${errEntry.message}`);
      continue;
    }

    // Criar items (D-Cliente, C-PL) - usa 'history' em vez de 'description'
    const { error: errItems } = await supabase
      .from('accounting_entry_items')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: saldo,
          credit: 0,
          history: `Saldo devedor - ${hon.competence}`
        },
        {
          entry_id: entry.id,
          account_id: contaPL.id,
          debit: 0,
          credit: saldo,
          history: `Contrapartida saldo abertura - ${hon.competence}`
        }
      ]);

    if (errItems) {
      console.error(`   ❌ Erro ao criar items: ${errItems.message}`);
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      continue;
    }

    criados++;
    valorTotal += saldo;
  }

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESULTADO:');
  console.log('='.repeat(100));
  console.log(`   Lançamentos já existiam: ${jaExistem}`);
  console.log(`   Contas não encontradas: ${contaNaoEncontrada}`);
  console.log(`   Lançamentos criados: ${criados}`);
  console.log(`   Valor total criado: R$ ${valorTotal.toFixed(2)}`);

  // Verificar saldo final
  console.log('\n📊 Verificando saldo final...');

  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  let totalDebitos = 0;

  for (const conta of subcontas || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    totalDebitos += (items?.reduce((s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0) || 0);
    totalDebitos += (lines?.reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0) || 0);
  }

  const { data: pendentesVerif } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount')
    .neq('status', 'paid');

  const saldoPendente = pendentesVerif?.reduce((s, h) => s + Number(h.amount || 0) - Number(h.paid_amount || 0), 0) || 0;

  console.log(`   Saldo contábil: R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Saldo pendente: R$ ${saldoPendente.toFixed(2)}`);
  console.log(`   Diferença: R$ ${(saldoPendente - totalDebitos).toFixed(2)}`);

  if (Math.abs(totalDebitos - saldoPendente) < 1) {
    console.log('\n✅ SALDOS CONFEREM!');
  } else {
    console.log('\n⚠️  Ainda há diferença - verificar manualmente');
  }

  console.log('='.repeat(100));
}

criarFaltantes().catch(console.error);
