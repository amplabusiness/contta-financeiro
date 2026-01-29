// scripts/correcao_contabil/15_auditoria_saldos_abertura.mjs
// Auditoria completa dos saldos de abertura
// Regra: Cada cliente deve ter 13 competencias por ano (01-12 + 13)
// Valor de cada competencia deve ser igual ao monthly_fee do cliente

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

function formatMoney(valor) {
  return 'R$ ' + (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function auditoria() {
  console.log('='.repeat(80));
  console.log('AUDITORIA SALDOS DE ABERTURA | MODO:', MODO);
  console.log('='.repeat(80));

  // 1. Buscar clientes com monthly_fee
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee, status')
    .order('name');

  const clientesMap = new Map();
  const clientesComFee = [];
  for (const c of clientes || []) {
    clientesMap.set(c.id, c);
    if (parseFloat(c.monthly_fee) > 0) {
      clientesComFee.push(c);
    }
  }

  console.log('\nClientes totais:', clientes?.length || 0);
  console.log('Clientes com honorario definido:', clientesComFee.length);

  // 2. Buscar todos os saldos
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .order('client_id')
    .order('competence');

  console.log('Total de saldos de abertura:', saldos?.length || 0);

  // 3. Identificar duplicatas
  console.log('\n' + '='.repeat(80));
  console.log('FASE 1: IDENTIFICAR DUPLICATAS');
  console.log('='.repeat(80));

  const porClienteCompetencia = {};
  for (const s of saldos || []) {
    const key = s.client_id + '_' + s.competence;
    if (!porClienteCompetencia[key]) {
      porClienteCompetencia[key] = [];
    }
    porClienteCompetencia[key].push(s);
  }

  const idsParaDeletar = [];
  let totalDuplicatas = 0;

  for (const [key, registros] of Object.entries(porClienteCompetencia)) {
    if (registros.length > 1) {
      totalDuplicatas++;
      // Manter o primeiro, deletar os demais
      for (let i = 1; i < registros.length; i++) {
        idsParaDeletar.push(registros[i].id);
      }
    }
  }

  console.log('Competencias com duplicatas:', totalDuplicatas);
  console.log('Registros para deletar:', idsParaDeletar.length);

  // 4. Deletar duplicatas se modo execucao
  if (MODO === 'EXECUCAO' && idsParaDeletar.length > 0) {
    console.log('\nDeletando duplicatas...');
    let deletados = 0;

    for (let i = 0; i < idsParaDeletar.length; i += 100) {
      const lote = idsParaDeletar.slice(i, i + 100);
      const { count } = await supabase
        .from('client_opening_balance')
        .delete({ count: 'exact' })
        .in('id', lote);
      deletados += count || 0;
    }

    console.log('Duplicatas deletadas:', deletados);
  }

  // 5. Recarregar saldos apos limpeza
  const { data: saldosLimpos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .order('client_id')
    .order('competence');

  // 6. Analisar valores vs honorarios
  console.log('\n' + '='.repeat(80));
  console.log('FASE 2: VERIFICAR VALORES vs HONORARIOS');
  console.log('='.repeat(80));

  const divergencias = [];
  const saldosPorCliente = {};

  for (const s of saldosLimpos || []) {
    if (!saldosPorCliente[s.client_id]) {
      saldosPorCliente[s.client_id] = [];
    }
    saldosPorCliente[s.client_id].push(s);
  }

  for (const cliente of clientesComFee) {
    const honorario = parseFloat(cliente.monthly_fee) || 0;
    const saldosCliente = saldosPorCliente[cliente.id] || [];

    for (const s of saldosCliente) {
      const valor = parseFloat(s.amount) || 0;
      const diff = Math.abs(valor - honorario);

      // Tolerancia de 5% para diferencas pequenas (juros, descontos)
      const tolerancia = honorario * 0.05;

      if (diff > tolerancia && diff > 10) {
        divergencias.push({
          clienteId: cliente.id,
          clienteNome: cliente.name,
          competencia: s.competence,
          saldoId: s.id,
          valorSaldo: valor,
          honorarioEsperado: honorario,
          diferenca: valor - honorario,
          percentual: ((valor - honorario) / honorario * 100).toFixed(1) + '%',
          status: s.status
        });
      }
    }
  }

  console.log('Divergencias significativas encontradas:', divergencias.length);

  if (divergencias.length > 0) {
    console.log('\nPrimeiras 30 divergencias:');
    console.log('-'.repeat(100));
    console.log('Cliente'.padEnd(35), 'Comp.'.padEnd(8), 'Saldo'.padStart(12), 'Esperado'.padStart(12), 'Diferenca'.padStart(12), '%');
    console.log('-'.repeat(100));

    for (const d of divergencias.slice(0, 30)) {
      console.log(
        d.clienteNome.substring(0, 34).padEnd(35),
        d.competencia.padEnd(8),
        formatMoney(d.valorSaldo).padStart(12),
        formatMoney(d.honorarioEsperado).padStart(12),
        formatMoney(d.diferenca).padStart(12),
        d.percentual
      );
    }
  }

  // 7. Verificar competencias por ano
  console.log('\n' + '='.repeat(80));
  console.log('FASE 3: VERIFICAR COMPETENCIAS POR ANO');
  console.log('='.repeat(80));

  // Descobrir anos existentes
  const anosSet = new Set();
  for (const s of saldosLimpos || []) {
    const ano = s.competence?.split('/')[1];
    if (ano) anosSet.add(ano);
  }
  const anos = Array.from(anosSet).sort();

  console.log('Anos encontrados:', anos.join(', '));

  // Competencias esperadas (01-12 + 13)
  const competenciasEsperadas = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'];

  const clientesSemCompetencia = [];
  const clientesComCompetenciaExtra = [];

  for (const cliente of clientesComFee) {
    const saldosCliente = saldosPorCliente[cliente.id] || [];

    for (const ano of anos) {
      const competenciasDoAno = saldosCliente
        .filter(s => s.competence?.endsWith('/' + ano))
        .map(s => s.competence?.split('/')[0]);

      // Verificar faltantes
      const faltantes = competenciasEsperadas.filter(c => !competenciasDoAno.includes(c));
      if (faltantes.length > 0 && competenciasDoAno.length > 0) {
        clientesSemCompetencia.push({
          cliente: cliente.name,
          ano,
          faltantes,
          existentes: competenciasDoAno.length
        });
      }

      // Verificar extras (competencias invalidas)
      const extras = competenciasDoAno.filter(c => !competenciasEsperadas.includes(c));
      if (extras.length > 0) {
        clientesComCompetenciaExtra.push({
          cliente: cliente.name,
          ano,
          extras
        });
      }
    }
  }

  console.log('\nClientes com competencias faltando:', clientesSemCompetencia.length);
  if (clientesSemCompetencia.length > 0 && clientesSemCompetencia.length <= 20) {
    for (const c of clientesSemCompetencia) {
      console.log('  -', c.cliente.substring(0, 40), '(' + c.ano + '):', 'falta', c.faltantes.join(', '));
    }
  }

  console.log('\nClientes com competencias invalidas:', clientesComCompetenciaExtra.length);
  if (clientesComCompetenciaExtra.length > 0) {
    for (const c of clientesComCompetenciaExtra.slice(0, 10)) {
      console.log('  -', c.cliente.substring(0, 40), '(' + c.ano + '):', c.extras.join(', '));
    }
  }

  // 8. Resumo financeiro final
  console.log('\n' + '='.repeat(80));
  console.log('RESUMO FINANCEIRO');
  console.log('='.repeat(80));

  let totalGeral = 0;
  let totalPendente = 0;
  let totalPago = 0;

  for (const s of saldosLimpos || []) {
    const valor = parseFloat(s.amount) || 0;
    totalGeral += valor;
    if (s.status === 'pending') totalPendente += valor;
    else if (s.status === 'paid') totalPago += valor;
  }

  // Calcular esperado
  let totalEsperado = 0;
  for (const cliente of clientesComFee) {
    const honorario = parseFloat(cliente.monthly_fee) || 0;
    // 13 competencias por ano
    totalEsperado += honorario * 13 * anos.length;
  }

  console.log('\nTotal em saldos:', formatMoney(totalGeral));
  console.log('  - Pendentes:', formatMoney(totalPendente));
  console.log('  - Pagos:', formatMoney(totalPago));
  console.log('\nTotal esperado (', clientesComFee.length, 'clientes x 13 comp x', anos.length, 'anos):', formatMoney(totalEsperado));
  console.log('Diferenca:', formatMoney(totalGeral - totalEsperado));

  // 9. Recomendacoes
  console.log('\n' + '='.repeat(80));
  console.log('RECOMENDACOES');
  console.log('='.repeat(80));

  if (idsParaDeletar.length > 0 && MODO === 'SIMULACAO') {
    console.log('\n1. DUPLICATAS: Execute com --executar para remover', idsParaDeletar.length, 'duplicatas');
  }

  if (divergencias.length > 0) {
    console.log('\n2. VALORES: Existem', divergencias.length, 'saldos com valores diferentes do honorario cadastrado');
    console.log('   - Verificar se houve reajuste no honorario');
    console.log('   - Verificar se cliente pagou valor parcial ou com juros');
  }

  if (clientesSemCompetencia.length > 0) {
    console.log('\n3. COMPETENCIAS FALTANDO:', clientesSemCompetencia.length, 'clientes com competencias incompletas');
  }

  console.log('\n' + '='.repeat(80));

  return {
    duplicatas: idsParaDeletar.length,
    divergencias: divergencias.length,
    competenciasFaltando: clientesSemCompetencia.length,
    totalSaldos: totalGeral,
    totalEsperado
  };
}

auditoria().catch(console.error);
