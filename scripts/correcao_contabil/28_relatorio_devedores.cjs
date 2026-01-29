// scripts/correcao_contabil/28_relatorio_devedores.cjs
// Relatório final dos devedores 2024 (CommonJS)

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatMoney(valor) {
  return 'R$ ' + (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function relatorioDevedores() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           RELATÓRIO DE DEVEDORES - SALDO DE ABERTURA 2024                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════════╝');

  // 1. Buscar todos os saldos
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .order('competence');

  // 2. Buscar clientes para cada ID
  const clientIds = [...new Set(saldos?.map(s => s.client_id) || [])];
  const clientesMap = new Map();

  for (const id of clientIds) {
    const { data } = await supabase
      .from('clients')
      .select('id, name, document, monthly_fee, is_active')
      .eq('id', id);

    if (data?.length > 0) {
      clientesMap.set(id, data[0]);
    }
  }

  console.log('\nClientes encontrados:', clientesMap.size, 'de', clientIds.length);

  // 3. Agrupar saldos por cliente
  const devedores = {};
  let totalPendente = 0;
  let totalPago = 0;

  for (const s of saldos || []) {
    const cliente = clientesMap.get(s.client_id);
    const valor = parseFloat(s.amount) || 0;

    if (!devedores[s.client_id]) {
      devedores[s.client_id] = {
        nome: cliente?.name || `ID: ${s.client_id}`,
        documento: cliente?.document || '',
        honorario: parseFloat(cliente?.monthly_fee) || 0,
        ativo: cliente?.is_active !== false,
        pendentes: [],
        pagos: []
      };
    }

    if (s.status === 'pending') {
      devedores[s.client_id].pendentes.push({ comp: s.competence, valor });
      totalPendente += valor;
    } else {
      devedores[s.client_id].pagos.push({ comp: s.competence, valor });
      totalPago += valor;
    }
  }

  // 4. Ordenar por total pendente
  const devedoresOrdenados = Object.entries(devedores)
    .map(([id, dados]) => ({
      id,
      ...dados,
      totalPendente: dados.pendentes.reduce((sum, c) => sum + c.valor, 0),
      totalPago: dados.pagos.reduce((sum, c) => sum + c.valor, 0)
    }))
    .filter(d => d.totalPendente > 0)
    .sort((a, b) => b.totalPendente - a.totalPendente);

  console.log('');
  console.log('┌────────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ CLIENTES COM DÉBITOS PENDENTES (2024)                                                              │');
  console.log('└────────────────────────────────────────────────────────────────────────────────────────────────────┘');

  let num = 1;
  for (const dev of devedoresOrdenados) {
    const statusIcon = dev.ativo ? '🟢' : '🔴';
    console.log('');
    console.log(`${num}. ${statusIcon} ${dev.nome}`);
    if (dev.documento) console.log(`   CNPJ/CPF: ${dev.documento}`);
    console.log(`   Honorário Cadastrado: ${formatMoney(dev.honorario)} | Total Pendente: ${formatMoney(dev.totalPendente)}`);
    console.log('   ┌──────────────┬────────────────┐');
    console.log('   │ Competência  │     Valor      │');
    console.log('   ├──────────────┼────────────────┤');

    for (const c of dev.pendentes) {
      console.log(`   │    ${c.comp.padEnd(8)}  │ ${formatMoney(c.valor).padStart(14)} │`);
    }
    console.log('   └──────────────┴────────────────┘');
    num++;
  }

  // 5. Pagamentos já realizados
  const comPagamentos = Object.entries(devedores)
    .map(([id, dados]) => ({
      id,
      ...dados,
      totalPago: dados.pagos.reduce((sum, c) => sum + c.valor, 0)
    }))
    .filter(d => d.totalPago > 0);

  if (comPagamentos.length > 0) {
    console.log('');
    console.log('┌────────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ PAGAMENTOS JÁ REALIZADOS (2024)                                                                    │');
    console.log('└────────────────────────────────────────────────────────────────────────────────────────────────────┘');

    for (const pag of comPagamentos) {
      const comps = pag.pagos.map(p => p.comp).join(', ');
      console.log(`   ✅ ${pag.nome}: ${comps} = ${formatMoney(pag.totalPago)}`);
    }
  }

  // 6. Resumo
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                      RESUMO FINANCEIRO                                             ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Clientes Devedores:          ${String(devedoresOrdenados.length).padStart(3)}                                                         ║`);
  console.log(`║  Competências Pendentes:      ${String(saldos?.filter(s => s.status === 'pending').length || 0).padStart(3)}                                                         ║`);
  console.log(`║  ─────────────────────────────────────────────────────────────────────────────────────────────     ║`);
  console.log(`║  💰 TOTAL A RECEBER:     ${formatMoney(totalPendente).padStart(15)}                                               ║`);
  console.log(`║  ✅ TOTAL JÁ RECEBIDO:   ${formatMoney(totalPago).padStart(15)}                                               ║`);
  console.log(`║  📊 TOTAL GERAL:         ${formatMoney(totalPendente + totalPago).padStart(15)}                                               ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
}

relatorioDevedores().catch(console.error);
