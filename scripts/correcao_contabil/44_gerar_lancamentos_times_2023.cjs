// scripts/correcao_contabil/44_gerar_lancamentos_times_2023.cjs
// Gerar lançamentos contábeis para os honorários TIMES 2023 já inseridos
// D - Conta Cliente (Ativo 1.1.2.01.xxxx) / C - Conta PL (5.2.1.01)
//
// USO:
//   node scripts/correcao_contabil/44_gerar_lancamentos_times_2023.cjs          # Simulação
//   node scripts/correcao_contabil/44_gerar_lancamentos_times_2023.cjs --execute # Execução real

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTE = process.argv.includes('--execute');

async function gerarLancamentos() {
  console.log('='.repeat(100));
  console.log(EXECUTE ? '🔴 GERANDO LANÇAMENTOS CONTÁBEIS TIMES 2023' : '🔵 SIMULANDO LANÇAMENTOS');
  console.log('='.repeat(100));

  if (!EXECUTE) {
    console.log('\n⚠️  MODO SIMULAÇÃO - Nenhuma alteração será feita');
    console.log('    Para executar de verdade, use: --execute\n');
  }

  // 1. Buscar cliente TIMES
  const { data: clientes } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%TIMES%NEGOCIO%IMOBILI%');

  if (!clientes?.length) {
    console.error('❌ Cliente TIMES não encontrado');
    return;
  }

  const cliente = clientes[0];
  console.log(`\n📌 CLIENTE: ${cliente.name} (ID: ${cliente.id})`);

  // 2. Buscar conta contábil do cliente
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

  // 4. Buscar honorários 2023 do cliente
  const { data: honorarios } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('client_id', cliente.id)
    .like('competence', '%2023')
    .order('competence');

  console.log(`\n📊 Honorários 2023 encontrados: ${honorarios?.length || 0}`);

  if (!honorarios?.length) {
    console.log('   Nenhum honorário para processar');
    return;
  }

  // 5. Verificar lançamentos já existentes para saldo de abertura TIMES
  const { data: lancExistentes } = await supabase
    .from('accounting_entries')
    .select('id, description')
    .ilike('description', '%TIMES%')
    .eq('entry_type', 'SALDO_ABERTURA');

  console.log(`   Lançamentos de saldo abertura já existentes: ${lancExistentes?.length || 0}`);

  // 6. Gerar lançamentos
  console.log('\n' + '='.repeat(80));
  console.log('GERANDO LANÇAMENTOS CONTÁBEIS');
  console.log('D - ' + contaCliente.code + ' (Cliente - Ativo)');
  console.log('C - ' + contaPL.code + ' (Lucros Acumulados - PL)');
  console.log('='.repeat(80));

  let gerados = 0;
  let erros = 0;

  console.log('\n| # | Competência | Valor | Data Lanc. | Status |');
  console.log('|---|-------------|-------|------------|--------|');

  for (const h of honorarios) {
    const dataLanc = h.due_date;

    if (EXECUTE) {
      // Criar entry header
      const { data: entry, error: errEntry } = await supabase
        .from('accounting_entries')
        .insert({
          entry_date: dataLanc,
          competence_date: dataLanc,
          description: `Saldo de abertura - Honorário ${h.competence} - ${cliente.name}`,
          entry_type: 'SALDO_ABERTURA',
          document_type: 'MANUAL',
          total_debit: h.amount,
          total_credit: h.amount,
          is_draft: false
        })
        .select()
        .single();

      if (errEntry) {
        console.log(`| ${honorarios.indexOf(h)+1} | ${h.competence} | R$ ${Number(h.amount).toFixed(2)} | ${dataLanc} | ❌ ${errEntry.message.substring(0,30)} |`);
        erros++;
        continue;
      }

      // Criar linhas do lançamento (tabela accounting_entry_items)
      const linhas = [
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: h.amount,
          credit: 0,
          history: `D - A receber ${cliente.name} - ${h.competence}`,
          client_id: cliente.id
        },
        {
          entry_id: entry.id,
          account_id: contaPL.id,
          debit: 0,
          credit: h.amount,
          history: `C - Lucros Acumulados - ${h.competence}`
        }
      ];

      const { error: errLinhas } = await supabase
        .from('accounting_entry_items')
        .insert(linhas);

      if (errLinhas) {
        console.log(`| ${honorarios.indexOf(h)+1} | ${h.competence} | R$ ${Number(h.amount).toFixed(2)} | ${dataLanc} | ❌ Linhas: ${errLinhas.message.substring(0,20)} |`);
        erros++;
        continue;
      }

      console.log(`| ${honorarios.indexOf(h)+1} | ${h.competence} | R$ ${Number(h.amount).toFixed(2)} | ${dataLanc} | ✅ OK |`);
      gerados++;
    } else {
      console.log(`| ${honorarios.indexOf(h)+1} | ${h.competence} | R$ ${Number(h.amount).toFixed(2)} | ${dataLanc} | 🔵 Simular |`);
      gerados++;
    }
  }

  // 7. Resumo
  console.log('\n' + '='.repeat(100));
  console.log('RESUMO');
  console.log('='.repeat(100));

  const totalValor = honorarios.reduce((s, h) => s + Number(h.amount), 0);

  console.log(`\n| Métrica | Valor |`);
  console.log(`|---------|-------|`);
  console.log(`| Lançamentos gerados | ${gerados} |`);
  console.log(`| Erros | ${erros} |`);
  console.log(`| Total movimentado | R$ ${totalValor.toFixed(2)} |`);

  if (!EXECUTE) {
    console.log('\n⚠️  NENHUMA ALTERAÇÃO FOI FEITA (modo simulação)');
    console.log('    Para executar de verdade, use:');
    console.log('    node scripts/correcao_contabil/44_gerar_lancamentos_times_2023.cjs --execute');
  } else {
    console.log('\n✅ LANÇAMENTOS GERADOS COM SUCESSO!');

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

gerarLancamentos().catch(console.error);
