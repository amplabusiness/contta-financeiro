// scripts/correcao_contabil/22_devedores_join.mjs
// Relatório detalhado com JOIN correto

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

  // Buscar saldos com JOIN para cliente
  const { data: saldos, error } = await supabase
    .from('client_opening_balance')
    .select(`
      id,
      client_id,
      competence,
      amount,
      status,
      due_date,
      clients!inner (
        id,
        name,
        document,
        monthly_fee,
        is_active
      )
    `)
    .order('competence');

  if (error) {
    console.log('Erro no JOIN, buscando separado...');

    // Buscar separado
    const { data: saldosSep } = await supabase
      .from('client_opening_balance')
      .select('*')
      .order('competence');

    const { data: clientesSep } = await supabase
      .from('clients')
      .select('id, name, document, monthly_fee, is_active');

    const clientesMap = new Map();
    for (const c of clientesSep || []) {
      clientesMap.set(c.id, c);
    }

    // Verificar os client_ids
    console.log('\nClient IDs nos saldos:');
    const idsUnicos = [...new Set(saldosSep?.map(s => s.client_id) || [])];
    for (const id of idsUnicos.slice(0, 5)) {
      const cliente = clientesMap.get(id);
      console.log('  ID:', id, '| Cliente:', cliente?.name || 'NÃO ENCONTRADO');
    }

    // Mostrar amostra de clientes
    console.log('\nAmostra de clientes na tabela:');
    for (const c of (clientesSep || []).slice(0, 5)) {
      console.log('  ID:', c.id, '| Nome:', c.name);
    }

    // Agrupar por cliente
    const devedores = {};
    let totalPendente = 0;
    let totalPago = 0;

    for (const s of saldosSep || []) {
      const cliente = clientesMap.get(s.client_id);
      const valor = parseFloat(s.amount) || 0;

      if (!devedores[s.client_id]) {
        devedores[s.client_id] = {
          nome: cliente?.name || `ID: ${s.client_id}`,
          documento: cliente?.document || '',
          honorario: cliente?.monthly_fee || 0,
          ativo: cliente?.is_active,
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

    // Ordenar por total pendente
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
      const statusIcon = dev.ativo === false ? '🔴' : '🟢';
      console.log('');
      console.log(`${num}. ${statusIcon} ${dev.nome}`);
      if (dev.documento) console.log(`   CNPJ/CPF: ${dev.documento}`);
      console.log(`   Honorário Atual: ${formatMoney(dev.honorario)} | Total Pendente: ${formatMoney(dev.totalPendente)}`);
      console.log('   ┌──────────────┬────────────────┐');
      console.log('   │ Competência  │     Valor      │');
      console.log('   ├──────────────┼────────────────┤');

      for (const c of dev.pendentes) {
        console.log(`   │    ${c.comp.padEnd(8)}  │ ${formatMoney(c.valor).padStart(14)} │`);
      }
      console.log('   └──────────────┴────────────────┘');
      num++;
    }

    // Clientes com pagamentos
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
      console.log('│ CLIENTES COM PAGAMENTOS REALIZADOS (2024)                                                          │');
      console.log('└────────────────────────────────────────────────────────────────────────────────────────────────────┘');

      for (const pag of comPagamentos) {
        const comps = pag.pagos.map(p => p.comp).join(', ');
        console.log(`   ✅ ${pag.nome}: ${comps} = ${formatMoney(pag.totalPago)}`);
      }
    }

    // Resumo
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                      RESUMO FINANCEIRO                                             ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║  Clientes Devedores:          ${String(devedoresOrdenados.length).padStart(3)}                                                         ║`);
    console.log(`║  Competências Pendentes:      ${String(saldosSep?.filter(s => s.status === 'pending').length || 0).padStart(3)}                                                         ║`);
    console.log(`║  ─────────────────────────────────────────────────────────────────────────────────────────────     ║`);
    console.log(`║  💰 TOTAL A RECEBER:     ${formatMoney(totalPendente).padStart(15)}                                               ║`);
    console.log(`║  ✅ TOTAL JÁ RECEBIDO:   ${formatMoney(totalPago).padStart(15)}                                               ║`);
    console.log(`║  📊 TOTAL GERAL:         ${formatMoney(totalPendente + totalPago).padStart(15)}                                               ║`);
    console.log('╚════════════════════════════════════════════════════════════════════════════════════════════════════╝');

    return;
  }

  console.log('Total de saldos:', saldos?.length || 0);
}

relatorioDevedores().catch(console.error);
