// scripts/correcao_contabil/29_relatorio_completo.cjs

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

async function run() {
  // 1. Buscar todos os saldos
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .order('competence');

  // 2. Buscar TODOS os clientes
  const { data: todosClientes } = await supabase
    .from('clients')
    .select('id, name, document, monthly_fee, is_active');

  const clientesMap = new Map();
  for (const c of todosClientes || []) {
    clientesMap.set(c.id, c);
  }

  console.log('Total clientes na base:', todosClientes?.length);
  console.log('Total saldos:', saldos?.length);

  // 3. Agrupar saldos por cliente
  const devedores = {};
  let totalPendente = 0;
  let totalPago = 0;

  for (const s of saldos || []) {
    const cliente = clientesMap.get(s.client_id);
    const valor = parseFloat(s.amount) || 0;

    if (!devedores[s.client_id]) {
      devedores[s.client_id] = {
        nome: cliente ? cliente.name : ('ID: ' + s.client_id.substring(0, 8)),
        documento: cliente ? (cliente.document || '') : '',
        honorario: cliente ? (parseFloat(cliente.monthly_fee) || 0) : 0,
        ativo: cliente ? (cliente.is_active !== false) : true,
        pendentes: [],
        pagos: []
      };
    }

    if (s.status === 'pending') {
      devedores[s.client_id].pendentes.push({ comp: s.competence, valor: valor });
      totalPendente += valor;
    } else {
      devedores[s.client_id].pagos.push({ comp: s.competence, valor: valor });
      totalPago += valor;
    }
  }

  // Ordenar
  const devedoresOrdenados = Object.entries(devedores)
    .map(function([id, dados]) {
      return {
        id: id,
        nome: dados.nome,
        documento: dados.documento,
        honorario: dados.honorario,
        ativo: dados.ativo,
        pendentes: dados.pendentes,
        pagos: dados.pagos,
        totalPendente: dados.pendentes.reduce(function(sum, c) { return sum + c.valor; }, 0),
        totalPago: dados.pagos.reduce(function(sum, c) { return sum + c.valor; }, 0)
      };
    })
    .filter(function(d) { return d.totalPendente > 0; })
    .sort(function(a, b) { return b.totalPendente - a.totalPendente; });

  console.log('\n========================================================================================================');
  console.log('                         RELATÓRIO DE DEVEDORES - SALDO ABERTURA 2024');
  console.log('========================================================================================================\n');

  let num = 1;
  for (const dev of devedoresOrdenados) {
    const statusIcon = dev.ativo ? '[ATIVO]' : '[INATIVO]';
    console.log(num + '. ' + statusIcon + ' ' + dev.nome);
    if (dev.documento) console.log('   CNPJ: ' + dev.documento);
    console.log('   Honorário: ' + formatMoney(dev.honorario) + ' | Total Pendente: ' + formatMoney(dev.totalPendente));
    console.log('   +------------+----------------+');
    console.log('   | Competência|     Valor      |');
    console.log('   +------------+----------------+');
    for (const c of dev.pendentes) {
      console.log('   |   ' + c.comp.padEnd(8) + ' | ' + formatMoney(c.valor).padStart(14) + ' |');
    }
    console.log('   +------------+----------------+');
    console.log('');
    num++;
  }

  // Pagos
  const comPagamentos = Object.values(devedores).filter(function(d) {
    return d.pagos && d.pagos.length > 0;
  });

  if (comPagamentos.length > 0) {
    console.log('--------------------------------------------------------------------------------------------------------');
    console.log('PAGAMENTOS JÁ REALIZADOS (2024)');
    console.log('--------------------------------------------------------------------------------------------------------');
    for (const pag of comPagamentos) {
      const comps = pag.pagos.map(function(p) { return p.comp; }).join(', ');
      const total = pag.pagos.reduce(function(sum, p) { return sum + p.valor; }, 0);
      console.log('   [OK] ' + pag.nome + ': ' + comps + ' = ' + formatMoney(total));
    }
  }

  console.log('\n========================================================================================================');
  console.log('                                      RESUMO FINANCEIRO');
  console.log('========================================================================================================');
  console.log('  Clientes Devedores:       ' + devedoresOrdenados.length);
  console.log('  Competências Pendentes:   ' + saldos.filter(function(s) { return s.status === 'pending'; }).length);
  console.log('  --------------------------------------------------------------------------------------------------------');
  console.log('  TOTAL A RECEBER:    ' + formatMoney(totalPendente));
  console.log('  TOTAL JÁ RECEBIDO:  ' + formatMoney(totalPago));
  console.log('  TOTAL GERAL:        ' + formatMoney(totalPendente + totalPago));
  console.log('========================================================================================================');
}

run().catch(console.error);
