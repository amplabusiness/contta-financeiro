// scripts/correcao_contabil/18_listar_devedores.mjs
// Lista todos os clientes com saldos de abertura pendentes

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

async function listarDevedores() {
  console.log('='.repeat(100));
  console.log('LISTA COMPLETA DE SALDOS DE ABERTURA - CLIENTES DEVEDORES');
  console.log('='.repeat(100));

  // Buscar clientes
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee, status, is_active');

  const clientesMap = new Map();
  for (const c of clientes || []) {
    clientesMap.set(c.id, c);
  }

  // Buscar TODOS os saldos
  const { data: todosSaldos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .order('client_id')
    .order('competence');

  console.log('\nTotal de saldos no banco:', todosSaldos?.length || 0);

  // Separar por status
  const pendentes = todosSaldos?.filter(s => s.status === 'pending') || [];
  const pagos = todosSaldos?.filter(s => s.status === 'paid') || [];

  console.log('  - Pendentes:', pendentes.length);
  console.log('  - Pagos:', pagos.length);

  // Agrupar PENDENTES por cliente
  const porCliente = {};
  let totalGeralPendente = 0;

  for (const s of pendentes) {
    const cliente = clientesMap.get(s.client_id);
    const nomeCliente = cliente?.name || 'Cliente não encontrado';

    if (!porCliente[s.client_id]) {
      porCliente[s.client_id] = {
        nome: nomeCliente,
        honorario: cliente?.monthly_fee || 0,
        ativo: cliente?.is_active,
        competencias: [],
        total: 0
      };
    }

    const valor = parseFloat(s.amount) || 0;
    porCliente[s.client_id].competencias.push({
      comp: s.competence,
      valor,
      vencimento: s.due_date
    });
    porCliente[s.client_id].total += valor;
    totalGeralPendente += valor;
  }

  // Ordenar por valor total (maior devedor primeiro)
  const clientesOrdenados = Object.entries(porCliente)
    .sort((a, b) => b[1].total - a[1].total);

  console.log('\n' + '-'.repeat(100));
  console.log('DEVEDORES POR VALOR (maior primeiro)');
  console.log('-'.repeat(100));
  console.log('');
  console.log('Cliente'.padEnd(45), 'Honor.Mensal'.padStart(12), 'Total Devido'.padStart(14), 'Qtd.Comp');
  console.log('='.repeat(100));

  for (const [clienteId, dados] of clientesOrdenados) {
    const statusStr = dados.ativo ? '' : ' [INATIVO]';
    console.log(
      (dados.nome.substring(0, 44) + statusStr).padEnd(45),
      formatMoney(dados.honorario).padStart(12),
      formatMoney(dados.total).padStart(14),
      String(dados.competencias.length).padStart(8)
    );

    // Mostrar competências
    for (const c of dados.competencias) {
      console.log('    -> ' + c.comp.padEnd(10) + formatMoney(c.valor).padStart(12));
    }
    console.log('');
  }

  console.log('='.repeat(100));
  console.log('RESUMO PENDENTES:');
  console.log('  Clientes devedores:', clientesOrdenados.length);
  console.log('  Total de competências pendentes:', pendentes.length);
  console.log('  VALOR TOTAL PENDENTE:', formatMoney(totalGeralPendente));

  // Total geral
  let totalGeral = 0;
  for (const s of todosSaldos || []) {
    totalGeral += parseFloat(s.amount) || 0;
  }

  console.log('\n  VALOR TOTAL (pendentes + pagos):', formatMoney(totalGeral));
  console.log('='.repeat(100));

  // Verificar se valores batem com honorários
  console.log('\n' + '='.repeat(100));
  console.log('VERIFICACAO: VALORES vs HONORARIOS CADASTRADOS');
  console.log('='.repeat(100));

  let divergencias = 0;
  for (const [clienteId, dados] of clientesOrdenados) {
    const honorario = dados.honorario;

    for (const c of dados.competencias) {
      const diff = Math.abs(c.valor - honorario);
      if (diff > 1) { // Tolerância de R$ 1
        if (divergencias < 20) {
          console.log('DIVERGENCIA:', dados.nome.substring(0, 30), '|', c.comp, '| Valor:', formatMoney(c.valor), '| Esperado:', formatMoney(honorario));
        }
        divergencias++;
      }
    }
  }

  if (divergencias > 20) {
    console.log('... e mais', divergencias - 20, 'divergências');
  }

  console.log('\nTotal de divergências:', divergencias);
  console.log('='.repeat(100));
}

listarDevedores().catch(console.error);
