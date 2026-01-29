// scripts/correcao_contabil/33_lancamentos_saldo_abertura.cjs
// Cria lançamentos contábeis para os saldos de abertura
// Seguindo GUIA_RAPIDO_FLUXO_CONTABIL.md
//
// REGRA:
// D - 1.1.2.01.xxxx (Cliente a Receber - analítica)
// C - 5.2.1.01 (Lucros Acumulados)

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Conta de contrapartida para saldo de abertura
const CONTA_CONTRAPARTIDA = '5.2.1.01'; // Lucros Acumulados

// Tenant ID da Ampla Contabilidade (RLS obrigatório)
const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// Data oficial de abertura conforme especificação
const DATA_ABERTURA = '2025-01-01';

async function criarLancamentos() {
  console.log('='.repeat(80));
  console.log('CRIANDO LANCAMENTOS CONTABEIS - SALDO DE ABERTURA');
  console.log('Regra: D-1.1.2.01.xxxx (Cliente) | C-5.2.1.01 (Lucros Acumulados)');
  console.log('='.repeat(80));

  // 1. Buscar ID da conta de contrapartida
  const { data: contaContra, error: errContra } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_CONTRAPARTIDA)
    .single();

  if (errContra || !contaContra) {
    console.log('ERRO: Conta de contrapartida não encontrada:', CONTA_CONTRAPARTIDA);
    return;
  }

  console.log('Conta contrapartida:', contaContra.code, '-', contaContra.name);

  // 2. Buscar todos os saldos de abertura pendentes
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('status', 'pending')
    .order('client_id')
    .order('competence');

  console.log('Saldos pendentes a processar:', saldos?.length || 0);

  // 3. Para cada saldo, criar lançamento
  let lancamentosCriados = 0;
  let erros = 0;
  let totalLancado = 0;

  // Agrupar por cliente
  const porCliente = {};
  for (const s of saldos || []) {
    if (!porCliente[s.client_id]) {
      porCliente[s.client_id] = [];
    }
    porCliente[s.client_id].push(s);
  }

  for (const [clientId, saldosCliente] of Object.entries(porCliente)) {
    // Buscar conta analítica do cliente (1.1.2.01.xxxx)
    const { data: contaCliente, error: errConta } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .like('code', '1.1.2.01.%')
      .like('name', '%' + clientId.substring(0, 8) + '%')
      .single();

    // Se não encontrar por ID, buscar pelo nome do cliente
    let contaClienteFinal = contaCliente;

    if (!contaClienteFinal) {
      // Buscar nome do cliente
      const { data: cliente } = await supabase
        .from('clients')
        .select('name')
        .eq('id', clientId)
        .single();

      if (cliente) {
        // Buscar conta pelo nome do cliente
        const { data: contaPorNome } = await supabase
          .from('chart_of_accounts')
          .select('id, code, name')
          .like('code', '1.1.2.01.%')
          .ilike('name', '%' + cliente.name.substring(0, 20) + '%')
          .limit(1);

        if (contaPorNome?.length > 0) {
          contaClienteFinal = contaPorNome[0];
        }
      }
    }

    if (!contaClienteFinal) {
      console.log('  AVISO: Conta analítica não encontrada para cliente', clientId.substring(0, 8));
      console.log('         Precisa criar conta 1.1.2.01.xxxx para este cliente');
      erros++;
      continue;
    }

    // Criar um lançamento por competência
    for (const s of saldosCliente) {
      const valor = parseFloat(s.amount) || 0;

      // Verificar se já existe lançamento para este saldo
      const refId = 'SALDO_ABERTURA_' + clientId + '_' + s.competence.replace('/', '_');

      const { data: existente } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('reference_id', refId)
        .limit(1);

      if (existente?.length > 0) {
        console.log('  Já existe lançamento para:', s.competence);
        continue;
      }

      // Criar entry (cabeçalho do lançamento)
      // Colunas corretas: entry_date, competence_date, description, history, entry_type, document_type
      // IMPORTANTE: Conforme especificação reoganizacao_28_01_2026.md:
      //   - Data: 01/01 do exercício (DATA_ABERTURA)
      //   - Tipo: ABERTURA (usando SALDO_ABERTURA para compatibilidade)
      //   - Origem: saldo_inicial
      const nomeCliente = contaClienteFinal.name.replace('Cliente: ', '').replace('[CONSOLIDADO] ', '');
      const { data: entry, error: errEntry } = await supabase
        .from('accounting_entries')
        .insert({
          tenant_id: TENANT_ID,
          entry_date: DATA_ABERTURA,
          competence_date: DATA_ABERTURA,
          description: 'Saldo de abertura - ' + nomeCliente,
          history: 'Saldo Inicial - Comp: ' + s.competence + ' - ' + nomeCliente,
          entry_type: 'SALDO_ABERTURA',
          document_type: 'ABERTURA',
          reference_type: 'saldo_inicial',
          reference_id: s.id,
          total_debit: valor,
          total_credit: valor,
          is_draft: false,
          balanced: true,
          internal_code: 'saldo_abertura:' + DATA_ABERTURA + ':' + clientId.substring(0, 8) + ':' + s.competence.replace('/', '')
        })
        .select()
        .single();

      if (errEntry) {
        console.log('  ERRO ao criar entry:', errEntry.message);
        erros++;
        continue;
      }

      // Criar linhas do lançamento (partidas dobradas)
      // Linha 1: Débito no cliente
      const { error: errLinha1 } = await supabase
        .from('accounting_entry_lines')
        .insert({
          tenant_id: TENANT_ID,
          entry_id: entry.id,
          account_id: contaClienteFinal.id,
          debit: valor,
          credit: 0,
          description: `Saldo devedor ${DATA_ABERTURA} - ${s.client_name || s.client_id}`
        });

      if (errLinha1) {
        console.log('  ERRO linha débito:', errLinha1.message);
        erros++;
        continue;
      }

      // Linha 2: Crédito na contrapartida (5.2.1.01)
      const { error: errLinha2 } = await supabase
        .from('accounting_entry_lines')
        .insert({
          tenant_id: TENANT_ID,
          entry_id: entry.id,
          account_id: contaContra.id,
          debit: 0,
          credit: valor,
          description: `Contrapartida saldo abertura ${DATA_ABERTURA} - ${s.client_name || s.client_id}`
        });

      if (errLinha2) {
        console.log('  ERRO linha crédito:', errLinha2.message);
        erros++;
        continue;
      }

      // Atualizar status no client_opening_balance
      const { error: errStatus } = await supabase
        .from('client_opening_balance')
        .update({ status: 'processed' })
        .eq('id', s.id);

      if (errStatus) {
        console.log('  AVISO: Não atualizou status:', errStatus.message);
      }

      lancamentosCriados++;
      totalLancado += valor;
    }

    console.log('  Cliente', contaClienteFinal.code, ':', saldosCliente.length, 'lançamentos');
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESUMO:');
  console.log('='.repeat(80));
  console.log('  Lançamentos criados:', lancamentosCriados);
  console.log('  Erros:', erros);
  console.log('  Total lançado: R$', totalLancado.toFixed(2));
  console.log('='.repeat(80));

  // Verificar equação contábil
  const { data: verificacao } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  let totalDebitos = 0;
  let totalCreditos = 0;
  for (const l of verificacao || []) {
    totalDebitos += parseFloat(l.debit) || 0;
    totalCreditos += parseFloat(l.credit) || 0;
  }

  console.log('\nVERIFICACAO EQUACAO CONTABIL:');
  console.log('  Total Débitos:  R$', totalDebitos.toFixed(2));
  console.log('  Total Créditos: R$', totalCreditos.toFixed(2));
  console.log('  Diferença:      R$', Math.abs(totalDebitos - totalCreditos).toFixed(2));
  console.log('  Status:', Math.abs(totalDebitos - totalCreditos) < 0.01 ? 'OK' : 'ERRO!');
}

criarLancamentos().catch(console.error);
