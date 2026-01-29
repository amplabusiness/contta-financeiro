// scripts/correcao_contabil/20_verificar_saldos_2024.mjs
// Verifica os saldos de abertura 2024 restantes

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

async function verificarSaldos() {
  console.log('='.repeat(100));
  console.log('SALDOS DE ABERTURA 2024 - VERIFICAÇÃO COMPLETA');
  console.log('='.repeat(100));

  // 1. Buscar clientes
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee, status, is_active');

  const clientesMap = new Map();
  for (const c of clientes || []) {
    clientesMap.set(c.id, c);
  }

  // 2. Buscar todos os saldos
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .order('client_id')
    .order('competence');

  console.log('\nTotal de saldos restantes:', saldos?.length || 0);

  // 3. Agrupar por cliente
  const porCliente = {};
  let totalGeral = 0;
  let totalPendente = 0;
  let totalPago = 0;

  for (const s of saldos || []) {
    const cliente = clientesMap.get(s.client_id);
    const nomeCliente = cliente?.name || 'Cliente não encontrado';
    const honorario = cliente?.monthly_fee || 0;

    if (!porCliente[s.client_id]) {
      porCliente[s.client_id] = {
        nome: nomeCliente,
        honorario,
        ativo: cliente?.is_active,
        competencias: [],
        totalPendente: 0,
        totalPago: 0
      };
    }

    const valor = parseFloat(s.amount) || 0;
    porCliente[s.client_id].competencias.push({
      comp: s.competence,
      valor,
      status: s.status
    });

    if (s.status === 'pending') {
      porCliente[s.client_id].totalPendente += valor;
      totalPendente += valor;
    } else {
      porCliente[s.client_id].totalPago += valor;
      totalPago += valor;
    }
    totalGeral += valor;
  }

  // 4. Listar clientes
  console.log('\n' + '-'.repeat(100));
  console.log('CLIENTES COM SALDOS DE ABERTURA 2024');
  console.log('-'.repeat(100));
  console.log('');
  console.log('Cliente'.padEnd(40), 'Honor.'.padStart(10), 'Pendente'.padStart(12), 'Pago'.padStart(12), 'Comps');
  console.log('='.repeat(100));

  const clientesOrdenados = Object.entries(porCliente).sort((a, b) =>
    (b[1].totalPendente + b[1].totalPago) - (a[1].totalPendente + a[1].totalPago)
  );

  for (const [clienteId, dados] of clientesOrdenados) {
    const statusStr = dados.ativo ? '' : ' [INATIVO]';
    const total = dados.totalPendente + dados.totalPago;

    console.log(
      (dados.nome.substring(0, 38) + statusStr).padEnd(40),
      formatMoney(dados.honorario).padStart(10),
      formatMoney(dados.totalPendente).padStart(12),
      formatMoney(dados.totalPago).padStart(12),
      String(dados.competencias.length).padStart(5)
    );

    // Mostrar competências detalhadas
    for (const c of dados.competencias) {
      const statusIcon = c.status === 'pending' ? '⏳' : '✅';
      console.log('    ', statusIcon, c.comp.padEnd(10), formatMoney(c.valor).padStart(12));
    }
    console.log('');
  }

  // 5. Resumo
  console.log('='.repeat(100));
  console.log('RESUMO FINAL:');
  console.log('='.repeat(100));
  console.log('  Clientes com saldos:', Object.keys(porCliente).length);
  console.log('  Total de competências:', saldos?.length || 0);
  console.log('');
  console.log('  VALOR TOTAL PENDENTE:', formatMoney(totalPendente));
  console.log('  VALOR TOTAL PAGO:', formatMoney(totalPago));
  console.log('  VALOR TOTAL GERAL:', formatMoney(totalGeral));
  console.log('='.repeat(100));

  // 6. Verificar se valores batem com honorários
  console.log('\n' + '='.repeat(100));
  console.log('VERIFICAÇÃO: VALORES vs HONORÁRIOS CADASTRADOS');
  console.log('='.repeat(100));

  let divergencias = 0;
  let semHonorario = 0;

  for (const [clienteId, dados] of clientesOrdenados) {
    const honorario = dados.honorario;

    if (honorario === 0) {
      semHonorario++;
      console.log('SEM HONORÁRIO:', dados.nome.substring(0, 40));
      continue;
    }

    for (const c of dados.competencias) {
      const diff = Math.abs(c.valor - honorario);
      if (diff > 1) { // Tolerância de R$ 1
        console.log('DIVERGÊNCIA:', dados.nome.substring(0, 30), '|', c.comp, '| Valor:', formatMoney(c.valor), '| Honorário:', formatMoney(honorario));
        divergencias++;
      }
    }
  }

  console.log('\n  Divergências encontradas:', divergencias);
  console.log('  Clientes sem honorário cadastrado:', semHonorario);
  console.log('='.repeat(100));
}

verificarSaldos().catch(console.error);
