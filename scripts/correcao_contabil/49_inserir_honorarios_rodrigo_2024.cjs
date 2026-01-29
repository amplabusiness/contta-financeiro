// scripts/correcao_contabil/49_inserir_honorarios_rodrigo_2024.cjs
// Inserir honorários do cliente RODRIGO AUGUSTO RODRIGUES 2024
// Valor base: R$ 256,73 (mas planilha mostra R$ 275,98 para alguns)
//
// USO:
//   node scripts/correcao_contabil/49_inserir_honorarios_rodrigo_2024.cjs          # Simulação
//   node scripts/correcao_contabil/49_inserir_honorarios_rodrigo_2024.cjs --execute # Execução real

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTE = process.argv.includes('--execute');

// Dados dos honorários RODRIGO 2024 (conforme planilha do usuário)
// Valor base R$ 256,73, devendo mostra R$ 275,98 (com juros?)
const HONORARIOS_RODRIGO_2024 = [
  { comp: '01/2024', venc: '2024-02-15', valor: 256.73, status: 'paid', pag: '2024-02-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
  { comp: '02/2024', venc: '2024-03-15', valor: 275.98, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '03/2024', venc: '2024-04-15', valor: 256.73, status: 'paid', pag: '2024-04-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
  { comp: '04/2024', venc: '2024-05-15', valor: 275.98, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '05/2024', venc: '2024-06-15', valor: 256.73, status: 'paid', pag: '2024-06-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
  { comp: '06/2024', venc: '2024-07-15', valor: 256.73, status: 'paid', pag: '2024-07-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
  { comp: '07/2024', venc: '2024-08-15', valor: 256.73, status: 'paid', pag: '2024-08-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
  { comp: '08/2024', venc: '2024-09-15', valor: 256.73, status: 'paid', pag: '2024-09-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
  { comp: '09/2024', venc: '2024-10-15', valor: 256.73, status: 'paid', pag: '2024-10-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
  { comp: '10/2024', venc: '2024-11-15', valor: 275.98, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '11/2024', venc: '2024-12-15', valor: 256.73, status: 'paid', pag: '2024-12-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
  { comp: '13/2024', venc: '2024-12-20', valor: 256.73, status: 'paid', pag: '2024-12-20', obs: '13º BOLETO SICREDI', is13: true, fee_type: 'thirteenth' },
  { comp: '12/2024', venc: '2025-01-15', valor: 256.73, status: 'paid', pag: '2025-01-15', obs: 'BOLETO SICREDI', is13: false, fee_type: 'monthly' },
];

async function inserirHonorarios() {
  console.log('='.repeat(100));
  console.log(EXECUTE ? '🔴 EXECUTANDO INSERÇÃO DE HONORÁRIOS RODRIGO RODRIGUES 2024' : '🔵 SIMULANDO INSERÇÃO');
  console.log('='.repeat(100));

  if (!EXECUTE) {
    console.log('\n⚠️  MODO SIMULAÇÃO - Nenhuma alteração será feita');
    console.log('    Para executar de verdade, use: --execute\n');
  }

  // 1. Buscar cliente
  const { data: clientes, error: errCliente } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%RODRIGO%RODRIGUES%');

  if (errCliente || !clientes?.length) {
    console.error('❌ Cliente não encontrado:', errCliente?.message);
    return;
  }

  const cliente = clientes[0];
  console.log(`\n📌 CLIENTE: ${cliente.name} (ID: ${cliente.id})`);
  console.log(`   Valor honorário atual: R$ ${cliente.monthly_fee || 'N/A'}`);

  // 2. Buscar conta contábil do cliente
  const { data: contaCliente } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .ilike('name', '%RODRIGO%RODRIGUES%')
    .eq('is_active', true)
    .single();

  if (!contaCliente) {
    console.error('❌ Conta contábil do cliente não encontrada');
    return;
  }

  console.log(`   Conta contábil: ${contaCliente.code} - ${contaCliente.name}`);

  // 3. Buscar conta de Lucros Acumulados (5.2.1.01)
  const { data: contaPL } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('code', '5.2.1.01')
    .single();

  if (!contaPL) {
    console.error('❌ Conta 5.2.1.01 (Lucros Acumulados) não encontrada');
    return;
  }

  console.log(`   Conta PL: ${contaPL.code} - ${contaPL.name}`);

  // 4. Verificar honorários já existentes
  const { data: existentes } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('client_id', cliente.id)
    .like('competence', '%2024');

  console.log(`\n📊 Honorários 2024 já existentes: ${existentes?.length || 0}`);

  // 5. Inserir honorários
  console.log('\n' + '='.repeat(80));
  console.log('INSERINDO HONORÁRIOS 2024');
  console.log('='.repeat(80));

  let inseridos = 0;
  let ignorados = 0;
  let lancamentosGerados = 0;

  console.log('\n| # | Competência | Valor | Status | Ação |');
  console.log('|---|-------------|-------|--------|------|');

  for (const h of HONORARIOS_RODRIGO_2024) {
    const jaExiste = existentes?.some(e => e.competence === h.comp);

    if (jaExiste) {
      console.log(`| ${HONORARIOS_RODRIGO_2024.indexOf(h)+1} | ${h.comp} | R$ ${h.valor.toFixed(2)} | ${h.status} | ⏭️ Já existe |`);
      ignorados++;
      continue;
    }

    console.log(`| ${HONORARIOS_RODRIGO_2024.indexOf(h)+1} | ${h.comp} | R$ ${h.valor.toFixed(2)} | ${h.status} | ✅ Inserir |`);

    if (EXECUTE) {
      // Inserir na tabela client_opening_balance
      const insertData = {
        client_id: cliente.id,
        competence: h.comp,
        amount: h.valor,
        due_date: h.venc,
        status: h.status,
        description: `Honorário ${h.comp} - ${h.obs}`,
        is_thirteenth_fee: h.is13,
        fee_type: h.fee_type
      };

      if (h.status === 'paid' && h.pag) {
        insertData.paid_date = h.pag;
        insertData.paid_amount = h.valor;
      }

      const { error: errInsert } = await supabase
        .from('client_opening_balance')
        .insert(insertData);

      if (errInsert) {
        console.log(`   ❌ Erro ao inserir: ${errInsert.message}`);
        continue;
      }

      // Gerar lançamento contábil (D - Cliente / C - PL)
      const { data: entry, error: errEntry } = await supabase
        .from('accounting_entries')
        .insert({
          entry_date: h.venc,
          competence_date: h.venc,
          description: `Saldo de abertura - Honorário ${h.comp} - ${cliente.name}`,
          entry_type: 'SALDO_ABERTURA',
          document_type: 'MANUAL',
          total_debit: h.valor,
          total_credit: h.valor,
          is_draft: false
        })
        .select()
        .single();

      if (errEntry) {
        console.log(`   ❌ Erro ao criar lançamento: ${errEntry.message}`);
        continue;
      }

      // Criar linhas do lançamento
      const linhas = [
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: h.valor,
          credit: 0,
          history: `D - A receber ${cliente.name} - ${h.comp}`,
          client_id: cliente.id
        },
        {
          entry_id: entry.id,
          account_id: contaPL.id,
          debit: 0,
          credit: h.valor,
          history: `C - Lucros Acumulados - ${h.comp}`
        }
      ];

      const { error: errLinhas } = await supabase
        .from('accounting_entry_items')
        .insert(linhas);

      if (errLinhas) {
        console.log(`   ❌ Erro ao criar linhas: ${errLinhas.message}`);
        continue;
      }

      lancamentosGerados++;
    }

    inseridos++;
  }

  // 6. Resumo
  console.log('\n' + '='.repeat(100));
  console.log('RESUMO');
  console.log('='.repeat(100));

  const totalPago = HONORARIOS_RODRIGO_2024.filter(h => h.status === 'paid').reduce((s, h) => s + h.valor, 0);
  const totalDevendo = HONORARIOS_RODRIGO_2024.filter(h => h.status === 'pending').reduce((s, h) => s + h.valor, 0);

  console.log(`\n| Métrica | Valor |`);
  console.log(`|---------|-------|`);
  console.log(`| Honorários inseridos | ${inseridos} |`);
  console.log(`| Honorários ignorados | ${ignorados} |`);
  console.log(`| Lançamentos contábeis | ${lancamentosGerados} |`);
  console.log(`| Total PAGO | R$ ${totalPago.toFixed(2)} |`);
  console.log(`| Total DEVENDO | R$ ${totalDevendo.toFixed(2)} |`);
  console.log(`| TOTAL GERAL | R$ ${(totalPago + totalDevendo).toFixed(2)} |`);

  if (!EXECUTE) {
    console.log('\n⚠️  NENHUMA ALTERAÇÃO FOI FEITA (modo simulação)');
    console.log('    Para executar de verdade, use:');
    console.log('    node scripts/correcao_contabil/49_inserir_honorarios_rodrigo_2024.cjs --execute');
  } else {
    console.log('\n✅ INSERÇÃO CONCLUÍDA!');

    const { data: final } = await supabase
      .from('client_opening_balance')
      .select('*')
      .eq('client_id', cliente.id)
      .like('competence', '%2024');

    console.log(`\nHonorários 2024 após inserção: ${final?.length || 0}`);
  }
}

inserirHonorarios().catch(console.error);
