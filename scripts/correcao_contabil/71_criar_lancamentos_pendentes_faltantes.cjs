// scripts/correcao_contabil/71_criar_lancamentos_pendentes_faltantes.cjs
// Criar lançamentos para honorários PENDENTES que estão sem lançamento

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

async function criarLancamentos() {
  console.log('='.repeat(100));
  console.log('CRIANDO LANÇAMENTOS PARA HONORÁRIOS PENDENTES SEM LANÇAMENTO');
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

  // Honorários específicos que precisam de lançamento
  const honorariosFaltantes = [
    { cliente: 'PM ADMINISTRACAO E SERVICOS LTDA', competencia: '12/2024', valor: 932.05 },
    { cliente: 'PM ADMINISTRACAO E SERVICOS LTDA', competencia: '13/2024', valor: 932.05 },
    { cliente: 'UNICAIXAS DESPACHANTE LTDA', competencia: '12/2024', valor: 1604.67 },
    // KORSICA precisa criar a conta primeiro
  ];

  // 1. Primeiro criar conta para KORSICA se não existir
  console.log('\n📋 Verificando/criando conta KORSICA...');

  let contaKorsica = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('name', '%KORSICA%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .single();

  if (!contaKorsica.data) {
    // Buscar o próximo código disponível
    const { data: ultimaConta } = await supabase
      .from('chart_of_accounts')
      .select('code')
      .like('code', '1.1.2.01.%')
      .order('code', { ascending: false })
      .limit(1)
      .single();

    const ultimoNumero = parseInt(ultimaConta?.code?.split('.').pop() || '0');
    const novoCodigo = `1.1.2.01.${String(ultimoNumero + 1).padStart(4, '0')}`;

    console.log(`   Criando conta ${novoCodigo} para KORSICA...`);

    const { data: novaConta, error: errConta } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: novoCodigo,
        name: 'KORSICA COMERCIO ATACADISTA DE PNEUS LTDA',
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        level: 5,
        is_analytical: true,
        is_active: true,
        created_by: '00000000-0000-0000-0000-000000000000'
      })
      .select()
      .single();

    if (errConta) {
      console.error('   ❌ Erro ao criar conta:', errConta.message);
    } else {
      contaKorsica = { data: novaConta };
      console.log(`   ✅ Conta criada: ${novaConta.code}`);

      // Adicionar honorários de KORSICA
      honorariosFaltantes.push(
        { cliente: 'KORSICA COMERCIO ATACADISTA DE PNEUS LTDA', competencia: '12/2024', valor: 647.50 },
        { cliente: 'KORSICA COMERCIO ATACADISTA DE PNEUS LTDA', competencia: '13/2024', valor: 647.50 }
      );
    }
  } else {
    // Conta existe, adicionar honorários
    honorariosFaltantes.push(
      { cliente: 'KORSICA COMERCIO ATACADISTA DE PNEUS LTDA', competencia: '12/2024', valor: 647.50 },
      { cliente: 'KORSICA COMERCIO ATACADISTA DE PNEUS LTDA', competencia: '13/2024', valor: 647.50 }
    );
  }

  // 2. Criar lançamentos
  console.log('\n📋 Criando lançamentos...');

  let criados = 0;
  let valorTotal = 0;

  for (const hon of honorariosFaltantes) {
    // Buscar conta do cliente
    const { data: contaCliente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .like('code', '1.1.2.01.%')
      .ilike('name', `%${hon.cliente.substring(0, 15)}%`)
      .not('name', 'ilike', '%[CONSOLIDADO]%')
      .limit(1)
      .single();

    if (!contaCliente) {
      console.log(`   ⚠️  Conta não encontrada: ${hon.cliente}`);
      continue;
    }

    const descricao = `Saldo de abertura - Honorário ${hon.competencia} - ${hon.cliente.substring(0, 30)}`;

    console.log(`   Criando: ${hon.cliente.substring(0, 25)} | ${hon.competencia} | R$ ${hon.valor.toFixed(2)}`);

    // Criar entry
    const { data: entry, error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: DATA_ENTRY,
        competence_date: DATA_COMPETENCIA,
        entry_type: 'SALDO_ABERTURA',
        description: descricao,
        total_debit: hon.valor,
        total_credit: hon.valor,
        balanced: true,
        created_by: '00000000-0000-0000-0000-000000000000'
      })
      .select()
      .single();

    if (errEntry) {
      console.error(`   ❌ Erro ao criar entry:`, errEntry.message);
      continue;
    }

    // Criar items (D-Cliente, C-PL)
    const { error: errItems } = await supabase
      .from('accounting_entry_items')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: hon.valor,
          credit: 0,
          description: `Saldo abertura ${hon.competencia}`
        },
        {
          entry_id: entry.id,
          account_id: contaPL.id,
          debit: 0,
          credit: hon.valor,
          description: `Contrapartida saldo abertura`
        }
      ]);

    if (errItems) {
      console.error(`   ❌ Erro ao criar items:`, errItems.message);
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      continue;
    }

    criados++;
    valorTotal += hon.valor;
  }

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESULTADO:');
  console.log('='.repeat(100));
  console.log(`   Lançamentos criados: ${criados}`);
  console.log(`   Valor total: R$ ${valorTotal.toFixed(2)}`);

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
      .select('debit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit')
      .eq('account_id', conta.id);

    totalDebitos += (items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0);
    totalDebitos += (lines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0);
  }

  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount')
    .neq('status', 'paid');

  const saldoPendente = pendentes?.reduce((s, h) => s + Number(h.amount || 0) - Number(h.paid_amount || 0), 0) || 0;

  console.log(`   Saldo contábil: R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Saldo pendente: R$ ${saldoPendente.toFixed(2)}`);
  console.log(`   Diferença: R$ ${(totalDebitos - saldoPendente).toFixed(2)}`);

  if (Math.abs(totalDebitos - saldoPendente) < 100) {
    console.log('\n✅ SALDOS CONFEREM!');
  }

  console.log('='.repeat(100));
}

criarLancamentos().catch(console.error);
