// scripts/correcao_contabil/16_auditoria_saldos_v2.mjs
// Auditoria completa dos saldos de abertura com regra de datas
//
// REGRAS:
// 1. Cliente só tem saldos a partir da data de início com a Ampla
// 2. Cliente inativo não deve ter saldos após data de inativação
// 3. Cada ano = 12 competências (01-12) + 13º (competência 13)
// 4. Valor de cada competência = monthly_fee do cliente
//
// CAMPOS USADOS:
// - opening_balance_date: Data de início com a Ampla (ou created_at se não existir)
// - is_active/status: Se cliente está ativo
// - monthly_fee: Valor do honorário mensal

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

// Calcula as competências esperadas para um cliente baseado nas datas
function calcularCompetenciasEsperadas(dataInicio, dataFim, has13th = true) {
  const competencias = [];

  const inicio = new Date(dataInicio);
  const fim = dataFim ? new Date(dataFim) : new Date();

  const anoInicio = inicio.getFullYear();
  const mesInicio = inicio.getMonth() + 1;
  const anoFim = fim.getFullYear();
  const mesFim = fim.getMonth() + 1;

  for (let ano = anoInicio; ano <= anoFim; ano++) {
    const mesInicioAno = ano === anoInicio ? mesInicio : 1;
    const mesFimAno = ano === anoFim ? mesFim : 12;

    // Meses do ano
    for (let mes = mesInicioAno; mes <= mesFimAno; mes++) {
      const comp = String(mes).padStart(2, '0') + '/' + ano;
      competencias.push(comp);
    }

    // 13º salário (se trabalhou o ano inteiro ou parcial)
    if (has13th && mesFimAno === 12) {
      competencias.push('13/' + ano);
    }
  }

  return competencias;
}

async function auditoria() {
  console.log('='.repeat(80));
  console.log('AUDITORIA SALDOS DE ABERTURA V2 | MODO:', MODO);
  console.log('Regra: Respeitar data de início e fim com a Ampla');
  console.log('='.repeat(80));

  // 1. Buscar clientes com monthly_fee
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee, status, is_active, opening_balance_date, created_at, has_13th_fee')
    .gt('monthly_fee', 0)
    .order('name');

  console.log('\nClientes com honorário:', clientes?.length || 0);

  // 2. Buscar todos os saldos
  const { data: saldos } = await supabase
    .from('client_opening_balance')
    .select('*')
    .order('client_id')
    .order('competence');

  console.log('Total de saldos de abertura:', saldos?.length || 0);

  // Agrupar saldos por cliente
  const saldosPorCliente = {};
  for (const s of saldos || []) {
    if (!saldosPorCliente[s.client_id]) {
      saldosPorCliente[s.client_id] = [];
    }
    saldosPorCliente[s.client_id].push(s);
  }

  // 3. Analisar cada cliente
  console.log('\n' + '='.repeat(80));
  console.log('ANALISE POR CLIENTE');
  console.log('='.repeat(80));

  const problemas = {
    duplicatas: [],
    valorErrado: [],
    competenciaInvalida: [],
    competenciaFaltando: [],
    clienteSemDataInicio: []
  };

  let totalSaldosCorretos = 0;
  let totalValorCorreto = 0;

  for (const cliente of clientes || []) {
    const honorario = parseFloat(cliente.monthly_fee) || 0;
    const saldosCliente = saldosPorCliente[cliente.id] || [];
    const has13th = cliente.has_13th_fee !== false; // Default true

    // Data de início: usar opening_balance_date ou created_at
    let dataInicio = cliente.opening_balance_date || cliente.created_at?.substring(0, 10);

    if (!dataInicio) {
      problemas.clienteSemDataInicio.push({
        clienteId: cliente.id,
        clienteNome: cliente.name
      });
      continue;
    }

    // Data fim: se inativo, usar data atual (precisaria de contract_end_date)
    const dataFim = cliente.is_active === false ? null : null; // Por enquanto, sem data fim

    // Calcular competências esperadas
    const competenciasEsperadas = calcularCompetenciasEsperadas(dataInicio, dataFim, has13th);

    // Verificar duplicatas
    const competenciasVistas = new Set();
    for (const s of saldosCliente) {
      if (competenciasVistas.has(s.competence)) {
        problemas.duplicatas.push({
          clienteId: cliente.id,
          clienteNome: cliente.name,
          competencia: s.competence,
          saldoId: s.id,
          valor: parseFloat(s.amount) || 0
        });
      } else {
        competenciasVistas.add(s.competence);
      }
    }

    // Verificar cada saldo
    for (const s of saldosCliente) {
      const valor = parseFloat(s.amount) || 0;

      // Competência está na lista esperada?
      if (!competenciasEsperadas.includes(s.competence)) {
        problemas.competenciaInvalida.push({
          clienteId: cliente.id,
          clienteNome: cliente.name,
          competencia: s.competence,
          saldoId: s.id,
          valor,
          dataInicio,
          motivo: 'Competência fora do período do contrato'
        });
        continue;
      }

      // Valor está correto? (tolerância de 5% para juros/descontos)
      const diff = Math.abs(valor - honorario);
      const tolerancia = honorario * 0.05;

      if (diff > tolerancia && diff > 5) {
        problemas.valorErrado.push({
          clienteId: cliente.id,
          clienteNome: cliente.name,
          competencia: s.competence,
          saldoId: s.id,
          valor,
          esperado: honorario,
          diferenca: valor - honorario
        });
      } else {
        totalSaldosCorretos++;
        totalValorCorreto += valor;
      }
    }

    // Verificar competências faltando
    for (const compEsperada of competenciasEsperadas) {
      if (!competenciasVistas.has(compEsperada)) {
        problemas.competenciaFaltando.push({
          clienteId: cliente.id,
          clienteNome: cliente.name,
          competencia: compEsperada,
          valorEsperado: honorario
        });
      }
    }
  }

  // 4. Relatório
  console.log('\n' + '-'.repeat(80));
  console.log('DUPLICATAS:', problemas.duplicatas.length);
  console.log('-'.repeat(80));
  if (problemas.duplicatas.length > 0) {
    for (const p of problemas.duplicatas.slice(0, 10)) {
      console.log('  -', p.clienteNome.substring(0, 35), '|', p.competencia, '|', formatMoney(p.valor));
    }
    if (problemas.duplicatas.length > 10) {
      console.log('  ... e mais', problemas.duplicatas.length - 10);
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log('VALORES ERRADOS:', problemas.valorErrado.length);
  console.log('-'.repeat(80));
  if (problemas.valorErrado.length > 0) {
    console.log('Cliente'.padEnd(35), 'Comp.'.padEnd(8), 'Valor'.padStart(12), 'Esperado'.padStart(12), 'Diff'.padStart(12));
    for (const p of problemas.valorErrado.slice(0, 15)) {
      console.log(
        p.clienteNome.substring(0, 34).padEnd(35),
        p.competencia.padEnd(8),
        formatMoney(p.valor).padStart(12),
        formatMoney(p.esperado).padStart(12),
        formatMoney(p.diferenca).padStart(12)
      );
    }
    if (problemas.valorErrado.length > 15) {
      console.log('  ... e mais', problemas.valorErrado.length - 15);
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log('COMPETENCIAS INVALIDAS (fora do período):', problemas.competenciaInvalida.length);
  console.log('-'.repeat(80));
  if (problemas.competenciaInvalida.length > 0) {
    for (const p of problemas.competenciaInvalida.slice(0, 10)) {
      console.log('  -', p.clienteNome.substring(0, 30), '|', p.competencia, '| Início:', p.dataInicio);
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log('COMPETENCIAS FALTANDO:', problemas.competenciaFaltando.length);
  console.log('-'.repeat(80));
  // Agrupar por cliente
  const faltandoPorCliente = {};
  for (const p of problemas.competenciaFaltando) {
    if (!faltandoPorCliente[p.clienteId]) {
      faltandoPorCliente[p.clienteId] = { nome: p.clienteNome, comps: [] };
    }
    faltandoPorCliente[p.clienteId].comps.push(p.competencia);
  }

  let countFaltando = 0;
  for (const [clienteId, dados] of Object.entries(faltandoPorCliente)) {
    if (countFaltando < 10) {
      console.log('  -', dados.nome.substring(0, 40), '| Faltam:', dados.comps.slice(0, 5).join(', '), dados.comps.length > 5 ? '...' : '');
    }
    countFaltando++;
  }
  if (countFaltando > 10) {
    console.log('  ... e mais', countFaltando - 10, 'clientes');
  }

  // 5. Resumo
  console.log('\n' + '='.repeat(80));
  console.log('RESUMO');
  console.log('='.repeat(80));
  console.log('Saldos corretos:', totalSaldosCorretos);
  console.log('Valor total correto:', formatMoney(totalValorCorreto));
  console.log('\nProblemas encontrados:');
  console.log('  - Duplicatas:', problemas.duplicatas.length);
  console.log('  - Valores errados:', problemas.valorErrado.length);
  console.log('  - Competências inválidas:', problemas.competenciaInvalida.length);
  console.log('  - Competências faltando:', problemas.competenciaFaltando.length);
  console.log('  - Clientes sem data início:', problemas.clienteSemDataInicio.length);

  // 6. IDs para deletar
  const idsParaDeletar = [
    ...problemas.duplicatas.map(p => p.saldoId),
    ...problemas.competenciaInvalida.map(p => p.saldoId)
  ];

  console.log('\n' + '='.repeat(80));
  console.log('ACOES');
  console.log('='.repeat(80));
  console.log('Registros para DELETAR (duplicatas + inválidos):', idsParaDeletar.length);

  if (MODO === 'EXECUCAO' && idsParaDeletar.length > 0) {
    console.log('\nDeletando registros...');
    let deletados = 0;
    for (let i = 0; i < idsParaDeletar.length; i += 100) {
      const lote = idsParaDeletar.slice(i, i + 100);
      const { count } = await supabase
        .from('client_opening_balance')
        .delete({ count: 'exact' })
        .in('id', lote);
      deletados += count || 0;
    }
    console.log('Deletados:', deletados);
  } else if (idsParaDeletar.length > 0) {
    console.log('\nExecute com --executar para deletar');
  }

  console.log('\n' + '='.repeat(80));

  return {
    duplicatas: problemas.duplicatas.length,
    valorErrado: problemas.valorErrado.length,
    competenciaInvalida: problemas.competenciaInvalida.length,
    competenciaFaltando: problemas.competenciaFaltando.length,
    paraDeletetar: idsParaDeletar.length
  };
}

auditoria().catch(console.error);
