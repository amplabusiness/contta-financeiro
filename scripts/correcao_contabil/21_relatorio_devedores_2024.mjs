// scripts/correcao_contabil/21_relatorio_devedores_2024.mjs
// Relatório detalhado dos devedores 2024

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

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

  // Buscar clientes
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee, status, is_active, document');

  const clientesMap = new Map();
  for (const c of clientes || []) {
    clientesMap.set(c.id, c);
  }

  // Buscar saldos PENDENTES
  const { data: saldosPendentes } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('status', 'pending')
    .order('client_id')
    .order('competence');

  // Buscar saldos PAGOS
  const { data: saldosPagos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .eq('status', 'paid')
    .order('client_id')
    .order('competence');

  // Agrupar PENDENTES por cliente
  const devedores = {};
  let totalPendente = 0;

  for (const s of saldosPendentes || []) {
    const cliente = clientesMap.get(s.client_id);
    if (!devedores[s.client_id]) {
      devedores[s.client_id] = {
        nome: cliente?.name || 'N/A',
        documento: cliente?.document || '',
        honorario: cliente?.monthly_fee || 0,
        ativo: cliente?.is_active,
        competencias: []
      };
    }
    const valor = parseFloat(s.amount) || 0;
    devedores[s.client_id].competencias.push({
      comp: s.competence,
      valor,
      vencimento: s.due_date
    });
    totalPendente += valor;
  }

  // Ordenar por valor total
  const devedoresOrdenados = Object.entries(devedores)
    .map(([id, dados]) => ({
      id,
      ...dados,
      total: dados.competencias.reduce((sum, c) => sum + c.valor, 0)
    }))
    .sort((a, b) => b.total - a.total);

  console.log('');
  console.log('┌────────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ CLIENTES COM DÉBITOS PENDENTES (2024)                                                              │');
  console.log('└────────────────────────────────────────────────────────────────────────────────────────────────────┘');

  let num = 1;
  for (const dev of devedoresOrdenados) {
    const statusIcon = dev.ativo ? '🟢' : '🔴';
    console.log('');
    console.log(`${num}. ${statusIcon} ${dev.nome}`);
    console.log(`   CNPJ/CPF: ${dev.documento || 'Não informado'}`);
    console.log(`   Honorário Atual: ${formatMoney(dev.honorario)} | Total Devido: ${formatMoney(dev.total)}`);
    console.log('   ┌──────────────┬────────────────┐');
    console.log('   │ Competência  │     Valor      │');
    console.log('   ├──────────────┼────────────────┤');

    for (const c of dev.competencias) {
      console.log(`   │    ${c.comp.padEnd(8)}  │ ${formatMoney(c.valor).padStart(14)} │`);
    }
    console.log('   └──────────────┴────────────────┘');
    num++;
  }

  // Resumo PAGOS
  console.log('');
  console.log('┌────────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ CLIENTES COM PAGAMENTOS REALIZADOS (2024)                                                          │');
  console.log('└────────────────────────────────────────────────────────────────────────────────────────────────────┘');

  const pagos = {};
  let totalPago = 0;

  for (const s of saldosPagos || []) {
    const cliente = clientesMap.get(s.client_id);
    if (!pagos[s.client_id]) {
      pagos[s.client_id] = {
        nome: cliente?.name || 'N/A',
        competencias: []
      };
    }
    const valor = parseFloat(s.amount) || 0;
    pagos[s.client_id].competencias.push({
      comp: s.competence,
      valor
    });
    totalPago += valor;
  }

  for (const [id, dados] of Object.entries(pagos)) {
    const total = dados.competencias.reduce((sum, c) => sum + c.valor, 0);
    console.log(`   ✅ ${dados.nome}: ${dados.competencias.map(c => c.comp).join(', ')} = ${formatMoney(total)}`);
  }

  // Resumo Final
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                      RESUMO FINANCEIRO                                             ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Clientes Devedores:          ${String(devedoresOrdenados.length).padStart(3)}                                                         ║`);
  console.log(`║  Competências Pendentes:      ${String(saldosPendentes?.length || 0).padStart(3)}                                                         ║`);
  console.log(`║  ─────────────────────────────────────────────────────────────────────────────────────────────     ║`);
  console.log(`║  💰 TOTAL A RECEBER:     ${formatMoney(totalPendente).padStart(15)}                                               ║`);
  console.log(`║  ✅ TOTAL JÁ RECEBIDO:   ${formatMoney(totalPago).padStart(15)}                                               ║`);
  console.log(`║  📊 TOTAL GERAL:         ${formatMoney(totalPendente + totalPago).padStart(15)}                                               ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
}

relatorioDevedores().catch(console.error);
