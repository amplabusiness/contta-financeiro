/**
 * SCRIPT: Criar Lançamentos de Abertura 01/01/2025
 * 
 * Executa a lógica da migration via API Supabase.
 * Não depende de conexão direta PostgreSQL.
 */

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const DATA_ABERTURA = '2025-01-01';

async function criarLancamentosAbertura() {
  console.log('='.repeat(80));
  console.log('CRIANDO LANÇAMENTOS DE ABERTURA - 01/01/2025');
  console.log('='.repeat(80));

  // 1. Buscar conta contrapartida
  const { data: contaContra, error: errContra } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '5.2.1.01')
    .eq('tenant_id', TENANT_ID)
    .single();

  if (errContra || !contaContra) {
    console.error('ERRO: Conta 5.2.1.01 não encontrada!');
    return;
  }
  console.log(`Conta contrapartida: ${contaContra.code} - ${contaContra.name}`);

  // 2. Buscar saldos pendentes
  const { data: saldosPendentes, error: errSaldos } = await supabase
    .from('client_opening_balance')
    .select(`
      id,
      client_id,
      competence,
      amount,
      clients!inner(id, name)
    `)
    .eq('status', 'pending')
    .eq('tenant_id', TENANT_ID);

  if (errSaldos) {
    console.error('ERRO ao buscar saldos:', errSaldos.message);
    return;
  }

  console.log(`Saldos pendentes a processar: ${saldosPendentes?.length || 0}`);

  // 3. Buscar todas as contas de clientes
  const { data: contasClientes, error: errContas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .eq('tenant_id', TENANT_ID);

  if (errContas) {
    console.error('ERRO ao buscar contas:', errContas.message);
    return;
  }

  // Criar mapa nome normalizado -> conta
  const mapaContas = new Map();
  for (const c of contasClientes || []) {
    const nomeNorm = c.name.toUpperCase().trim();
    mapaContas.set(nomeNorm, c);
  }

  // 4. Processar cada saldo
  let processados = 0;
  let erros = 0;
  let semConta = 0;
  let totalValor = 0;

  for (const saldo of saldosPendentes || []) {
    const nomeCliente = saldo.clients.name.toUpperCase().trim();
    const contaCliente = mapaContas.get(nomeCliente);

    if (!contaCliente) {
      console.log(`  AVISO: ${saldo.clients.name} sem conta analítica`);
      semConta++;
      continue;
    }

    const valor = parseFloat(saldo.amount);

    // Criar o lançamento usando batch insert para contornar triggers
    const entryId = crypto.randomUUID();

    // INSERT accounting_entry - vai falhar por trigger, mas tenta
    const { error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        id: entryId,
        tenant_id: TENANT_ID,
        entry_date: DATA_ABERTURA,
        competence_date: DATA_ABERTURA,
        entry_type: 'SALDO_ABERTURA',
        document_type: 'ABERTURA',
        reference_type: 'saldo_inicial',
        description: `Saldo de abertura 01/01/2025 - ${saldo.clients.name} (${saldo.competence})`,
        total_debit: valor,
        total_credit: valor
      });

    if (errEntry) {
      console.log(`  ERRO entry ${saldo.clients.name}: ${errEntry.message}`);
      erros++;
      continue;
    }

    // INSERT linha débito
    const { error: errDebit } = await supabase
      .from('accounting_entry_lines')
      .insert({
        tenant_id: TENANT_ID,
        entry_id: entryId,
        account_id: contaCliente.id,
        debit: valor,
        credit: 0,
        description: `D - Saldo devedor abertura - ${saldo.clients.name}`
      });

    if (errDebit) {
      console.log(`  ERRO débito: ${errDebit.message}`);
      erros++;
      continue;
    }

    // INSERT linha crédito
    const { error: errCredit } = await supabase
      .from('accounting_entry_lines')
      .insert({
        tenant_id: TENANT_ID,
        entry_id: entryId,
        account_id: contaContra.id,
        debit: 0,
        credit: valor,
        description: `C - Contrapartida abertura - ${saldo.clients.name}`
      });

    if (errCredit) {
      console.log(`  ERRO crédito: ${errCredit.message}`);
      erros++;
      continue;
    }

    // Atualizar status
    await supabase
      .from('client_opening_balance')
      .update({ status: 'processed' })
      .eq('id', saldo.id);

    processados++;
    totalValor += valor;

    if (processados % 10 === 0) {
      console.log(`  Processados: ${processados}...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESUMO:');
  console.log('='.repeat(80));
  console.log(`  Lançamentos criados: ${processados}`);
  console.log(`  Clientes sem conta: ${semConta}`);
  console.log(`  Erros: ${erros}`);
  console.log(`  Total lançado: R$ ${totalValor.toFixed(2)}`);
  console.log('='.repeat(80));

  // Verificação final
  const { data: verificacao } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('entry_type', 'SALDO_ABERTURA')
    .eq('entry_date', DATA_ABERTURA)
    .eq('tenant_id', TENANT_ID);

  console.log(`\nVerificação: ${verificacao?.length || 0} lançamentos ABERTURA em 01/01/2025`);
}

criarLancamentosAbertura().catch(console.error);
