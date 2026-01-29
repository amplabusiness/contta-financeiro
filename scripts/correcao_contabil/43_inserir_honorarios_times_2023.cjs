// scripts/correcao_contabil/43_inserir_honorarios_times_2023.cjs
// Inserir honorários do cliente TIMES NEGOCIOS IMOBILIARIOS 2023 como saldo de abertura
// Gera lançamentos contábeis: D - Conta Cliente (Ativo) / C - Conta 5 (PL)
//
// USO:
//   node scripts/correcao_contabil/43_inserir_honorarios_times_2023.cjs          # Simulação
//   node scripts/correcao_contabil/43_inserir_honorarios_times_2023.cjs --execute # Execução real

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTE = process.argv.includes('--execute');

// Dados dos honorários TIMES 2023 (conforme planilha do usuário)
const HONORARIOS_TIMES_2023 = [
  { comp: '01/2023', venc: '2023-02-05', valor: 969.54, status: 'paid', pag: '2023-03-29', obs: 'PIX C6', is13: false },
  { comp: '02/2023', venc: '2023-03-05', valor: 969.54, status: 'paid', pag: '2023-03-29', obs: 'PIX C6', is13: false },
  { comp: '03/2023', venc: '2023-04-05', valor: 969.54, status: 'paid', pag: '2023-04-26', obs: 'PIX C6', is13: false },
  { comp: '04/2023', venc: '2023-05-05', valor: 969.54, status: 'pending', pag: null, obs: 'DEVENDO', is13: false },
  { comp: '05/2023', venc: '2023-06-05', valor: 969.54, status: 'paid', pag: '2023-06-14', obs: 'PIX C6', is13: false },
  { comp: '06/2023', venc: '2023-07-05', valor: 969.54, status: 'paid', pag: '2023-07-05', obs: 'BOLETO SICREDI', is13: false },
  { comp: '07/2023', venc: '2023-08-05', valor: 969.54, status: 'paid', pag: '2023-08-05', obs: 'BOLETO SICREDI', is13: false },
  { comp: '08/2023', venc: '2023-09-05', valor: 969.54, status: 'pending', pag: null, obs: 'DEVENDO', is13: false },
  { comp: '09/2023', venc: '2023-10-05', valor: 969.54, status: 'paid', pag: '2023-10-05', obs: 'BOLETO SICREDI', is13: false },
  { comp: '10/2023', venc: '2023-11-06', valor: 969.54, status: 'paid', pag: '2023-11-06', obs: 'BOLETO SICREDI', is13: false },
  { comp: '11/2023', venc: '2023-12-05', valor: 982.94, status: 'pending', pag: null, obs: 'DEVENDO', is13: false },
  { comp: '13/2023', venc: '2023-12-20', valor: 982.94, status: 'pending', pag: null, obs: '13º SALÁRIO - DEVENDO', is13: true },
  { comp: '12/2023', venc: '2024-01-05', valor: 969.54, status: 'paid', pag: '2024-01-04', obs: 'PIX SICREDI', is13: false },
];

async function inserirHonorarios() {
  console.log('='.repeat(100));
  console.log(EXECUTE ? '🔴 EXECUTANDO INSERÇÃO DE HONORÁRIOS TIMES 2023' : '🔵 SIMULANDO INSERÇÃO');
  console.log('='.repeat(100));

  if (!EXECUTE) {
    console.log('\n⚠️  MODO SIMULAÇÃO - Nenhuma alteração será feita');
    console.log('    Para executar de verdade, use: --execute\n');
  }

  // 1. Buscar cliente TIMES
  const { data: clientes, error: errCliente } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%TIMES%NEGOCIO%IMOBILI%');

  if (errCliente || !clientes?.length) {
    console.error('❌ Cliente TIMES não encontrado:', errCliente?.message);
    return;
  }

  const cliente = clientes[0];
  console.log(`\n📌 CLIENTE: ${cliente.name} (ID: ${cliente.id})`);
  console.log(`   Valor honorário atual: R$ ${cliente.monthly_fee || 'N/A'}`);

  // 2. Buscar conta contábil do cliente (1.1.2.01.xxxx)
  const { data: contaCliente } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .ilike('name', '%TIMES%NEGOCIO%')
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

  // 4. Verificar honorários já existentes para TIMES em 2023
  const { data: existentes } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('client_id', cliente.id)
    .like('competence', '%2023');

  console.log(`\n📊 Honorários 2023 já existentes: ${existentes?.length || 0}`);

  if (existentes?.length) {
    console.log('\n| # | Competência | Valor | Status |');
    console.log('|---|-------------|-------|--------|');
    existentes.forEach((h, i) => {
      console.log(`| ${i+1} | ${h.competence} | R$ ${Number(h.amount).toFixed(2)} | ${h.status} |`);
    });

    if (!EXECUTE) {
      console.log('\n⚠️  Já existem honorários para 2023. A execução irá ignorar duplicatas.');
    }
  }

  // 5. Inserir honorários
  console.log('\n' + '='.repeat(80));
  console.log('INSERINDO HONORÁRIOS 2023');
  console.log('='.repeat(80));

  let inseridos = 0;
  let ignorados = 0;
  let lancamentosGerados = 0;

  console.log('\n| # | Competência | Valor | Status | Ação |');
  console.log('|---|-------------|-------|--------|------|');

  for (const h of HONORARIOS_TIMES_2023) {
    // Verificar se já existe
    const jaExiste = existentes?.some(e => e.competence === h.comp);

    if (jaExiste) {
      console.log(`| ${HONORARIOS_TIMES_2023.indexOf(h)+1} | ${h.comp} | R$ ${h.valor.toFixed(2)} | ${h.status} | ⏭️ Já existe |`);
      ignorados++;
      continue;
    }

    console.log(`| ${HONORARIOS_TIMES_2023.indexOf(h)+1} | ${h.comp} | R$ ${h.valor.toFixed(2)} | ${h.status} | ✅ Inserir |`);

    if (EXECUTE) {
      // Inserir na tabela client_opening_balance
      const insertData = {
        client_id: cliente.id,
        competence: h.comp,
        amount: h.valor,
        due_date: h.venc,
        status: h.status,
        description: `Honorário ${h.comp} - ${h.obs}`,
        is_thirteenth_fee: h.is13
      };

      // Adicionar paid_date e paid_amount se pago
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
      // Criar entry header
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
          debit_amount: h.valor,
          credit_amount: 0,
          description: `D - A receber ${cliente.name} - ${h.comp}`
        },
        {
          entry_id: entry.id,
          account_id: contaPL.id,
          debit_amount: 0,
          credit_amount: h.valor,
          description: `C - Lucros Acumulados - ${h.comp}`
        }
      ];

      const { error: errLinhas } = await supabase
        .from('accounting_entry_lines')
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

  const totalPago = HONORARIOS_TIMES_2023.filter(h => h.status === 'paid').reduce((s, h) => s + h.valor, 0);
  const totalDevendo = HONORARIOS_TIMES_2023.filter(h => h.status === 'pending').reduce((s, h) => s + h.valor, 0);

  console.log(`\n| Métrica | Valor |`);
  console.log(`|---------|-------|`);
  console.log(`| Honorários inseridos | ${inseridos} |`);
  console.log(`| Honorários ignorados (já existiam) | ${ignorados} |`);
  console.log(`| Lançamentos contábeis gerados | ${lancamentosGerados} |`);
  console.log(`| Total PAGO | R$ ${totalPago.toFixed(2)} |`);
  console.log(`| Total DEVENDO | R$ ${totalDevendo.toFixed(2)} |`);
  console.log(`| TOTAL GERAL | R$ ${(totalPago + totalDevendo).toFixed(2)} |`);

  if (!EXECUTE) {
    console.log('\n⚠️  NENHUMA ALTERAÇÃO FOI FEITA (modo simulação)');
    console.log('    Para executar de verdade, use:');
    console.log('    node scripts/correcao_contabil/43_inserir_honorarios_times_2023.cjs --execute');
  } else {
    console.log('\n✅ INSERÇÃO CONCLUÍDA!');

    // Verificar estado final
    const { data: final } = await supabase
      .from('client_opening_balance')
      .select('*')
      .eq('client_id', cliente.id)
      .like('competence', '%2023');

    console.log(`\nHonorários 2023 após inserção: ${final?.length || 0}`);
  }
}

inserirHonorarios().catch(console.error);
