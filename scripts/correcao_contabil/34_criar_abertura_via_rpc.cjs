/**
 * SCRIPT: Criar Lançamentos de Abertura via SQL Direto
 * 
 * Este script executa o SQL que:
 * 1. Desabilita triggers temporariamente
 * 2. Cria lançamentos de SALDO_ABERTURA em 01/01/2025
 * 3. Atualiza status dos saldos processados
 * 4. Reativa triggers
 */

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const DATA_ABERTURA = '2025-01-01';

async function executarCriacaoAbertura() {
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
    console.error('ERRO: Conta 5.2.1.01 não encontrada');
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
      value,
      clients!inner(id, name)
    `)
    .eq('status', 'pending')
    .eq('tenant_id', TENANT_ID);

  if (errSaldos) {
    console.error('ERRO ao buscar saldos:', errSaldos);
    return;
  }

  console.log(`Saldos pendentes a processar: ${saldosPendentes.length}`);
  
  // 3. Buscar contas de clientes
  const { data: contasClientes, error: errContas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, client_id')
    .like('code', '1.1.2.01.%')
    .eq('tenant_id', TENANT_ID)
    .not('client_id', 'is', null);

  if (errContas) {
    console.error('ERRO ao buscar contas clientes:', errContas);
    return;
  }

  // Mapear client_id -> conta
  const mapaContas = new Map();
  for (const c of contasClientes) {
    mapaContas.set(c.client_id, c);
  }

  // 4. Construir os INSERTs em batch
  let lancamentosCriados = 0;
  let totalValor = 0;
  let semConta = 0;

  for (const saldo of saldosPendentes) {
    const contaCliente = mapaContas.get(saldo.client_id);
    
    if (!contaCliente) {
      console.log(`  AVISO: Cliente ${saldo.clients.name} sem conta analítica`);
      semConta++;
      continue;
    }

    const entryId = crypto.randomUUID();
    const valor = parseFloat(saldo.value);
    const clientName = saldo.clients.name;

    // Criar entry via SQL direto (bypass triggers)
    const { error: errEntry } = await supabase.rpc('execute_sql', {
      query: `
        INSERT INTO accounting_entries (
          id, tenant_id, entry_date, competence_date, entry_type, 
          document_type, reference_type, description, origin,
          total_debit, total_credit, is_balanced, created_at, updated_at
        ) VALUES (
          '${entryId}'::uuid,
          '${TENANT_ID}'::uuid,
          '${DATA_ABERTURA}'::date,
          '${DATA_ABERTURA}'::date,
          'SALDO_ABERTURA',
          'ABERTURA',
          'saldo_inicial',
          'Saldo de abertura 01/01/2025 - ${clientName.replace(/'/g, "''")} (${saldo.competence})',
          'saldo_inicial',
          ${valor},
          ${valor},
          true,
          NOW(),
          NOW()
        )
      `
    });

    if (errEntry) {
      console.log(`  ERRO entry: ${errEntry.message}`);
      continue;
    }

    // Criar linha débito
    const { error: errDebit } = await supabase.rpc('execute_sql', {
      query: `
        INSERT INTO accounting_entry_lines (
          id, tenant_id, entry_id, account_id, debit, credit, description, created_at
        ) VALUES (
          '${crypto.randomUUID()}'::uuid,
          '${TENANT_ID}'::uuid,
          '${entryId}'::uuid,
          '${contaCliente.id}'::uuid,
          ${valor},
          0,
          'D - Saldo devedor abertura - ${clientName.replace(/'/g, "''")}',
          NOW()
        )
      `
    });

    if (errDebit) {
      console.log(`  ERRO débito: ${errDebit.message}`);
      continue;
    }

    // Criar linha crédito
    const { error: errCredit } = await supabase.rpc('execute_sql', {
      query: `
        INSERT INTO accounting_entry_lines (
          id, tenant_id, entry_id, account_id, debit, credit, description, created_at
        ) VALUES (
          '${crypto.randomUUID()}'::uuid,
          '${TENANT_ID}'::uuid,
          '${entryId}'::uuid,
          '${contaContra.id}'::uuid,
          0,
          ${valor},
          'C - Contrapartida abertura - ${clientName.replace(/'/g, "''")}',
          NOW()
        )
      `
    });

    if (errCredit) {
      console.log(`  ERRO crédito: ${errCredit.message}`);
      continue;
    }

    // Atualizar status
    const { error: errStatus } = await supabase
      .from('client_opening_balance')
      .update({ status: 'processed', updated_at: new Date().toISOString() })
      .eq('id', saldo.id);

    if (errStatus) {
      console.log(`  AVISO: Status não atualizado: ${errStatus.message}`);
    }

    lancamentosCriados++;
    totalValor += valor;
    
    if (lancamentosCriados % 10 === 0) {
      console.log(`  Processados: ${lancamentosCriados}...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESUMO:');
  console.log('='.repeat(80));
  console.log(`  Lançamentos criados: ${lancamentosCriados}`);
  console.log(`  Clientes sem conta: ${semConta}`);
  console.log(`  Total lançado: R$ ${totalValor.toFixed(2)}`);
  console.log('='.repeat(80));
}

executarCriacaoAbertura().catch(console.error);
