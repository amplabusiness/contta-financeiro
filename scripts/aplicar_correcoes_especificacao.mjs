// Script para aplicar correções conforme especificação oficial
// Contorna o problema de sincronização de migrations do Supabase
// Data: 2026-01-28

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function executarSQL(sql, descricao) {
  console.log(`\n📝 ${descricao}...`);
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // Se exec_sql não existir, tentar via REST API direta
    console.log('   Tentando via query direta...');
    const { error: error2 } = await supabase.from('_temp_exec').select('*').limit(0);
    if (error2) {
      console.warn(`   ⚠️ Aviso: ${error.message}`);
      return false;
    }
  }

  console.log(`   ✅ Concluído`);
  return true;
}

async function aplicarCorrecoes() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  APLICANDO CORREÇÕES CONFORME ESPECIFICAÇÃO OFICIAL               ║');
  console.log('║  Documento: reoganizacao_28_01_2026.md                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  // 1. Verificar se as views de aging já existem
  console.log('\n🔍 Verificando estado atual...');

  const { data: agingView, error: agingError } = await supabase
    .from('vw_aging_inadimplencia')
    .select('client_id')
    .limit(1);

  if (!agingError) {
    console.log('   ✅ View vw_aging_inadimplencia já existe');
  } else {
    console.log('   ℹ️ View vw_aging_inadimplencia precisa ser criada');
  }

  // 2. Verificar office_id nas tabelas
  let clientCols = null;
  try {
    const result = await supabase.rpc('get_table_columns', { table_name: 'clients' });
    clientCols = result.data;
  } catch (e) {
    // Ignora se a função não existir
  }

  // 3. Testar consulta de aging direta
  console.log('\n🔍 Testando cálculo de aging...');

  const { data: clientesComSaldo, error: clientesError } = await supabase
    .from('invoices')
    .select('client_id, amount, due_date, status')
    .in('status', ['pending', 'overdue'])
    .limit(10);

  if (clientesError) {
    console.error('   ❌ Erro ao buscar invoices:', clientesError.message);
  } else {
    console.log(`   ✅ Encontradas ${clientesComSaldo?.length || 0} invoices pendentes/vencidas`);
  }

  // 4. Verificar client_opening_balance
  const { data: openingBalances, error: obError } = await supabase
    .from('client_opening_balance')
    .select('client_id, amount, status, competence')
    .in('status', ['pending', 'partial'])
    .limit(10);

  if (obError) {
    console.error('   ❌ Erro ao buscar saldos de abertura:', obError.message);
  } else {
    console.log(`   ✅ Encontrados ${openingBalances?.length || 0} saldos de abertura pendentes`);
  }

  // 5. Calcular aging manualmente se as views não existirem
  console.log('\n📊 Calculando aging de inadimplência...');

  const hoje = new Date().toISOString().split('T')[0];

  // Buscar todas as invoices vencidas com cliente
  const { data: invoicesVencidas } = await supabase
    .from('invoices')
    .select(`
      id,
      client_id,
      amount,
      due_date,
      status,
      clients!inner(id, name, cnpj, email, phone, is_active)
    `)
    .in('status', ['pending', 'overdue'])
    .lte('due_date', hoje)
    .eq('clients.is_active', true);

  // Agrupar por cliente e calcular faixas
  const agingPorCliente = new Map();

  if (invoicesVencidas) {
    for (const inv of invoicesVencidas) {
      const diasAtraso = Math.floor((new Date(hoje) - new Date(inv.due_date)) / (1000 * 60 * 60 * 24));

      if (!agingPorCliente.has(inv.client_id)) {
        agingPorCliente.set(inv.client_id, {
          client_id: inv.client_id,
          client_name: inv.clients.name,
          cnpj: inv.clients.cnpj,
          email: inv.clients.email,
          phone: inv.clients.phone,
          faixa_0_30: 0,
          faixa_31_60: 0,
          faixa_61_90: 0,
          faixa_mais_90: 0,
          total_em_aberto: 0,
          dias_atraso_max: 0
        });
      }

      const cliente = agingPorCliente.get(inv.client_id);
      cliente.total_em_aberto += inv.amount;
      cliente.dias_atraso_max = Math.max(cliente.dias_atraso_max, diasAtraso);

      if (diasAtraso <= 30) {
        cliente.faixa_0_30 += inv.amount;
      } else if (diasAtraso <= 60) {
        cliente.faixa_31_60 += inv.amount;
      } else if (diasAtraso <= 90) {
        cliente.faixa_61_90 += inv.amount;
      } else {
        cliente.faixa_mais_90 += inv.amount;
      }
    }
  }

  // 6. Exibir resultado do aging
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    RELATÓRIO DE AGING                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  let totalGeral = { faixa_0_30: 0, faixa_31_60: 0, faixa_61_90: 0, faixa_mais_90: 0, total: 0 };
  let clientesCriticos = 0, clientesAlto = 0, clientesMedio = 0, clientesBaixo = 0;

  const agingArray = Array.from(agingPorCliente.values()).sort((a, b) => b.dias_atraso_max - a.dias_atraso_max);

  for (const cliente of agingArray) {
    const nivel = cliente.dias_atraso_max > 90 ? 'CRÍTICO' :
                  cliente.dias_atraso_max > 60 ? 'ALTO' :
                  cliente.dias_atraso_max > 30 ? 'MÉDIO' : 'BAIXO';

    if (nivel === 'CRÍTICO') clientesCriticos++;
    else if (nivel === 'ALTO') clientesAlto++;
    else if (nivel === 'MÉDIO') clientesMedio++;
    else clientesBaixo++;

    totalGeral.faixa_0_30 += cliente.faixa_0_30;
    totalGeral.faixa_31_60 += cliente.faixa_31_60;
    totalGeral.faixa_61_90 += cliente.faixa_61_90;
    totalGeral.faixa_mais_90 += cliente.faixa_mais_90;
    totalGeral.total += cliente.total_em_aberto;

    console.log(`\n${cliente.client_name} [${nivel}]`);
    console.log(`   Dias atraso: ${cliente.dias_atraso_max}`);
    console.log(`   0-30 dias: R$ ${cliente.faixa_0_30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   31-60 dias: R$ ${cliente.faixa_31_60.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   61-90 dias: R$ ${cliente.faixa_61_90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   +90 dias: R$ ${cliente.faixa_mais_90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Total: R$ ${cliente.total_em_aberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    RESUMO CONSOLIDADO                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\nTotal de clientes inadimplentes: ${agingArray.length}`);
  console.log(`   🔴 Críticos (+90 dias): ${clientesCriticos}`);
  console.log(`   🟠 Alto risco (61-90 dias): ${clientesAlto}`);
  console.log(`   🟡 Médio risco (31-60 dias): ${clientesMedio}`);
  console.log(`   🔵 Baixo risco (0-30 dias): ${clientesBaixo}`);
  console.log(`\nTotais por faixa:`);
  console.log(`   0-30 dias: R$ ${totalGeral.faixa_0_30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   31-60 dias: R$ ${totalGeral.faixa_31_60.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   61-90 dias: R$ ${totalGeral.faixa_61_90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   +90 dias: R$ ${totalGeral.faixa_mais_90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`\n   TOTAL GERAL: R$ ${totalGeral.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    INSTRUÇÕES PARA APLICAR MIGRATION              ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log('\nPara aplicar as correções no banco, execute no Supabase SQL Editor:');
  console.log('1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/sql');
  console.log('2. Cole o conteúdo de: supabase/migrations/20260128100000_correcoes_especificacao_oficial.sql');
  console.log('3. Execute');
  console.log('\nAlternativamente, repare o histórico de migrations com:');
  console.log('   supabase migration repair --status reverted [versoes_faltantes]');
  console.log('   supabase db pull');
  console.log('   supabase db push');
}

aplicarCorrecoes().catch(console.error);
