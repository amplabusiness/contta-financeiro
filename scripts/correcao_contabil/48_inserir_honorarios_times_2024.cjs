// scripts/correcao_contabil/48_inserir_honorarios_times_2024.cjs
// Inserir honorários do cliente TIMES NEGOCIOS IMOBILIARIOS 2024 como saldo de abertura
// Gera lançamentos contábeis: D - Conta Cliente (Ativo) / C - Conta 5 (PL)
//
// USO:
//   node scripts/correcao_contabil/48_inserir_honorarios_times_2024.cjs          # Simulação
//   node scripts/correcao_contabil/48_inserir_honorarios_times_2024.cjs --execute # Execução real

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTE = process.argv.includes('--execute');

// Dados dos honorários TIMES 2024 (conforme planilha do usuário)
// TODOS DEVENDO - Valor R$ 1.051,46
const HONORARIOS_TIMES_2024 = [
  { comp: '01/2024', venc: '2024-02-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '02/2024', venc: '2024-03-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '03/2024', venc: '2024-04-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '04/2024', venc: '2024-05-06', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '05/2024', venc: '2024-06-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '06/2024', venc: '2024-07-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '07/2024', venc: '2024-08-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '08/2024', venc: '2024-09-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '09/2024', venc: '2024-10-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '10/2024', venc: '2024-11-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '11/2024', venc: '2024-12-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
  { comp: '13/2024', venc: '2024-12-20', valor: 1051.46, status: 'pending', pag: null, obs: '13º SALÁRIO - DEVENDO', is13: true, fee_type: 'thirteenth' },
  { comp: '12/2024', venc: '2025-01-05', valor: 1051.46, status: 'pending', pag: null, obs: 'DEVENDO', is13: false, fee_type: 'monthly' },
];

async function inserirHonorarios() {
  console.log('='.repeat(100));
  console.log(EXECUTE ? '🔴 EXECUTANDO INSERÇÃO DE HONORÁRIOS TIMES 2024' : '🔵 SIMULANDO INSERÇÃO');
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

  // 4. Verificar honorários já existentes para TIMES em 2024
  const { data: existentes } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('client_id', cliente.id)
    .like('competence', '%2024');

  console.log(`\n📊 Honorários 2024 já existentes: ${existentes?.length || 0}`);

  if (existentes?.length) {
    console.log('\n| # | Competência | Valor | Status | fee_type |');
    console.log('|---|-------------|-------|--------|----------|');
    existentes.forEach((h, i) => {
      console.log(`| ${i+1} | ${h.competence} | R$ ${Number(h.amount).toFixed(2)} | ${h.status} | ${h.fee_type || '-'} |`);
    });
  }

  // 5. Inserir honorários
  console.log('\n' + '='.repeat(80));
  console.log('INSERINDO HONORÁRIOS 2024');
  console.log('='.repeat(80));

  let inseridos = 0;
  let ignorados = 0;
  let lancamentosGerados = 0;

  console.log('\n| # | Competência | Valor | Status | Ação |');
  console.log('|---|-------------|-------|--------|------|');

  for (const h of HONORARIOS_TIMES_2024) {
    // Verificar se já existe
    const jaExiste = existentes?.some(e => e.competence === h.comp);

    if (jaExiste) {
      console.log(`| ${HONORARIOS_TIMES_2024.indexOf(h)+1} | ${h.comp} | R$ ${h.valor.toFixed(2)} | ${h.status} | ⏭️ Já existe |`);
      ignorados++;
      continue;
    }

    console.log(`| ${HONORARIOS_TIMES_2024.indexOf(h)+1} | ${h.comp} | R$ ${h.valor.toFixed(2)} | ${h.status} | ✅ Inserir |`);

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

      // Criar linhas do lançamento (tabela accounting_entry_items)
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

  const totalDevendo = HONORARIOS_TIMES_2024.reduce((s, h) => s + h.valor, 0);

  console.log(`\n| Métrica | Valor |`);
  console.log(`|---------|-------|`);
  console.log(`| Honorários inseridos | ${inseridos} |`);
  console.log(`| Honorários ignorados (já existiam) | ${ignorados} |`);
  console.log(`| Lançamentos contábeis gerados | ${lancamentosGerados} |`);
  console.log(`| Total DEVENDO 2024 | R$ ${totalDevendo.toFixed(2)} |`);

  if (!EXECUTE) {
    console.log('\n⚠️  NENHUMA ALTERAÇÃO FOI FEITA (modo simulação)');
    console.log('    Para executar de verdade, use:');
    console.log('    node scripts/correcao_contabil/48_inserir_honorarios_times_2024.cjs --execute');
  } else {
    console.log('\n✅ INSERÇÃO CONCLUÍDA!');

    // Verificar estado final
    const { data: final } = await supabase
      .from('client_opening_balance')
      .select('*')
      .eq('client_id', cliente.id)
      .like('competence', '%2024');

    console.log(`\nHonorários 2024 após inserção: ${final?.length || 0}`);

    // Verificar equação contábil
    const { data: linhasVerif } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit');

    let totalD = 0, totalC = 0;
    linhasVerif?.forEach(l => {
      totalD += Number(l.debit) || 0;
      totalC += Number(l.credit) || 0;
    });

    console.log('\n📊 VERIFICAÇÃO EQUAÇÃO CONTÁBIL:');
    console.log(`   Total Débitos:  R$ ${totalD.toFixed(2)}`);
    console.log(`   Total Créditos: R$ ${totalC.toFixed(2)}`);
    console.log(`   Diferença:      R$ ${Math.abs(totalD - totalC).toFixed(2)}`);
    console.log(Math.abs(totalD - totalC) < 0.01 ? '   ✅ BALANCEADA!' : '   ⚠️ DESBALANCEADA!');
  }
}

inserirHonorarios().catch(console.error);
