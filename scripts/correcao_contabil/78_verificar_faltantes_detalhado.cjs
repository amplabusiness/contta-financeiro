// scripts/correcao_contabil/78_verificar_faltantes_detalhado.cjs
// Verificar detalhadamente quais honorários estão sem lançamento

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeamento de nomes em client_opening_balance para códigos de conta
const MAPEAMENTO_CONTAS = {
  'KORSICA COM ATAC DE PNEUS LTDA': '1.1.2.01.0093',
  'PM ADMINSTRAÇÃO E SERVIÇOS': '1.1.2.01.0052',
  'UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA': '1.1.2.01.0101',
  'TIMES NEGOCIOS IMOBILIARIOS LTDA': '1.1.2.01.0006',
};

async function verificarFaltantes() {
  console.log('='.repeat(100));
  console.log('VERIFICAÇÃO DETALHADA - HONORÁRIOS x LANÇAMENTOS');
  console.log('='.repeat(100));

  // Buscar TODOS os honorários PENDENTES
  const { data: pendentes } = await supabase
    .from('client_opening_balance')
    .select('id, client_id, competence, amount, paid_amount, status, clients(name)')
    .neq('status', 'paid')
    .order('competence');

  console.log(`\nTotal de honorários pendentes: ${pendentes?.length || 0}`);

  // Agrupar por cliente
  const porCliente = {};
  for (const h of pendentes || []) {
    const nome = h.clients?.name || 'DESCONHECIDO';
    if (!porCliente[nome]) {
      porCliente[nome] = [];
    }
    const saldo = Number(h.amount || 0) - Number(h.paid_amount || 0);
    if (saldo > 0) {
      porCliente[nome].push({ competence: h.competence, valor: saldo });
    }
  }

  // Para cada cliente, comparar honorários com lançamentos
  console.log('\n📋 COMPARAÇÃO POR CLIENTE:');
  console.log('='.repeat(100));

  let totalFaltante = 0;
  const faltantes = [];

  for (const [nome, honorarios] of Object.entries(porCliente).sort((a, b) => a[0].localeCompare(b[0]))) {
    // Buscar conta do cliente
    let contaCliente = null;
    const codigoMapeado = MAPEAMENTO_CONTAS[nome];

    if (codigoMapeado) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('code', codigoMapeado)
        .single();
      contaCliente = conta;
    }

    if (!contaCliente) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .like('code', '1.1.2.01.%')
        .ilike('name', `%${nome.substring(0, 15)}%`)
        .not('name', 'ilike', '%[CONSOLIDADO]%')
        .limit(1)
        .single();
      contaCliente = conta;
    }

    if (!contaCliente) {
      console.log(`\n❌ ${nome} - CONTA NÃO ENCONTRADA`);
      const total = honorarios.reduce((s, h) => s + h.valor, 0);
      totalFaltante += total;
      honorarios.forEach(h => faltantes.push({ cliente: nome, ...h, motivo: 'CONTA_NAO_ENCONTRADA' }));
      continue;
    }

    // Buscar lançamentos desta conta
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, accounting_entries(entry_type, description)')
      .eq('account_id', contaCliente.id)
      .gt('debit', 0);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, accounting_entries(entry_type, description)')
      .eq('account_id', contaCliente.id)
      .gt('debit', 0);

    // Filtrar apenas saldo de abertura
    const lancamentos = [...(items || []), ...(lines || [])]
      .filter(l =>
        l.accounting_entries?.entry_type === 'SALDO_ABERTURA' ||
        l.accounting_entries?.description?.toLowerCase().includes('saldo de abertura') ||
        l.accounting_entries?.description?.toLowerCase().includes('saldo devedor')
      )
      .map(l => Number(l.debit));

    // Calcular totais
    const totalHonorarios = honorarios.reduce((s, h) => s + h.valor, 0);
    const totalLancamentos = lancamentos.reduce((s, v) => s + v, 0);

    if (Math.abs(totalHonorarios - totalLancamentos) > 1) {
      console.log(`\n📊 ${nome}`);
      console.log(`   Conta: ${contaCliente.code}`);
      console.log(`   Honorários pendentes: R$ ${totalHonorarios.toFixed(2)}`);
      console.log(`   Lançamentos: R$ ${totalLancamentos.toFixed(2)}`);
      console.log(`   DIFERENÇA: R$ ${(totalHonorarios - totalLancamentos).toFixed(2)}`);

      // Listar honorários
      console.log('   Honorários:');
      honorarios.forEach(h => console.log(`      ${h.competence}: R$ ${h.valor.toFixed(2)}`));

      // Listar lançamentos
      console.log('   Lançamentos:');
      lancamentos.forEach(v => console.log(`      R$ ${v.toFixed(2)}`));

      totalFaltante += (totalHonorarios - totalLancamentos);

      // Identificar quais honorários faltam
      const valoresLancamentos = [...lancamentos];
      for (const h of honorarios) {
        const idx = valoresLancamentos.findIndex(v => Math.abs(v - h.valor) < 0.01);
        if (idx === -1) {
          faltantes.push({ cliente: nome, conta: contaCliente.code, ...h, motivo: 'SEM_LANCAMENTO' });
        } else {
          valoresLancamentos.splice(idx, 1);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESUMO DOS FALTANTES:');
  console.log('='.repeat(100));
  console.log(`\nTotal faltante estimado: R$ ${totalFaltante.toFixed(2)}`);

  console.log('\nHonorários específicos sem lançamento:');
  for (const f of faltantes) {
    console.log(`   ${f.cliente.substring(0, 35).padEnd(35)} | ${(f.conta || 'N/A').padEnd(15)} | ${f.competence} | R$ ${f.valor.toFixed(2)} | ${f.motivo}`);
  }

  console.log('='.repeat(100));
}

verificarFaltantes().catch(console.error);
