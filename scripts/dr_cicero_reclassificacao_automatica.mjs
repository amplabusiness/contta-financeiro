/**
 * DR. CÍCERO - RECLASSIFICAÇÃO AUTOMÁTICA DE LANÇAMENTOS
 *
 * Este script usa as funções existentes do sistema para:
 * 1. Identificar lançamentos em contas sintéticas (1.1.2.01 Clientes a Receber)
 * 2. Criar contas analíticas para cada cliente
 * 3. Reclassificar os lançamentos para as contas analíticas corretas
 * 4. Gerar razão contábil
 *
 * Fundamentação: NBC TG 26, ITG 2000
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Modo de execução: 'simulacao' ou 'aplicar'
const MODO = process.argv[2] || 'simulacao';
const PERIODO = process.argv[3] || '2025-01';

async function buscarTodos(tabela, campos = '*', filtros = null) {
  const todos = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase.from(tabela).select(campos).range(page * pageSize, (page + 1) * pageSize - 1);

    if (filtros) {
      for (const [key, value] of Object.entries(filtros)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  return todos;
}

async function main() {
  console.log('═'.repeat(80));
  console.log(`🤖 DR. CÍCERO - RECLASSIFICAÇÃO AUTOMÁTICA`);
  console.log(`   Modo: ${MODO.toUpperCase()} | Período: ${PERIODO}`);
  console.log('═'.repeat(80));

  // 1. Buscar conta sintética 1.1.2.01
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01')
    .single();

  if (!contaSintetica) {
    console.log('❌ Conta sintética 1.1.2.01 não encontrada');
    return;
  }

  console.log(`\n📌 Conta Sintética: ${contaSintetica.code} - ${contaSintetica.name}`);

  // 2. Buscar lançamentos na conta sintética
  const linhasSintetica = await buscarTodos(
    'accounting_entry_lines',
    'id, entry_id, debit, credit, description, account_id',
    { account_id: contaSintetica.id }
  );

  console.log(`\n📋 Lançamentos na conta sintética: ${linhasSintetica.length}`);

  if (linhasSintetica.length === 0) {
    console.log('\n✅ Nenhum lançamento na conta sintética. Já está correto!');
    return;
  }

  // 3. Buscar entries para ter source_type e reference_id
  const entryIds = [...new Set(linhasSintetica.map(l => l.entry_id))];
  const entries = [];
  for (let i = 0; i < entryIds.length; i += 100) {
    const lote = entryIds.slice(i, i + 100);
    const { data } = await supabase
      .from('accounting_entries')
      .select('id, source_type, reference_type, reference_id, description')
      .in('id', lote);
    if (data) entries.push(...data);
  }
  const mapEntries = {};
  entries.forEach(e => mapEntries[e.id] = e);

  // 4. Buscar contas analíticas existentes
  const { data: analiticasExistentes } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .eq('is_analytical', true);

  console.log(`   Contas analíticas existentes: ${analiticasExistentes?.length || 0}`);

  // Mapear contas por nome normalizado
  const mapaContasPorNome = {};
  for (const conta of analiticasExistentes || []) {
    const nomeNorm = normalizarNome(conta.name.replace('Cliente: ', ''));
    mapaContasPorNome[nomeNorm] = conta;
  }

  // 5. Processar cada lançamento
  const reclassificacoes = [];
  const contasParaCriar = new Map();
  const naoIdentificados = [];
  const estatisticas = { porTipo: {} };

  for (const linha of linhasSintetica) {
    const entry = mapEntries[linha.entry_id];
    const sourceType = entry?.source_type || 'null';

    if (!estatisticas.porTipo[sourceType]) {
      estatisticas.porTipo[sourceType] = { total: 0, identificados: 0 };
    }
    estatisticas.porTipo[sourceType].total++;

    // Identificar cliente
    const clienteInfo = await identificarCliente(linha, entry);

    if (clienteInfo.client_id || clienteInfo.nome !== 'NAO_IDENTIFICADO') {
      estatisticas.porTipo[sourceType].identificados++;

      const nomeNorm = normalizarNome(clienteInfo.nome);
      let contaDestino = mapaContasPorNome[nomeNorm];

      if (!contaDestino) {
        // Marcar para criar
        if (!contasParaCriar.has(nomeNorm)) {
          contasParaCriar.set(nomeNorm, {
            nome: clienteInfo.nome,
            client_id: clienteInfo.client_id
          });
        }
      }

      reclassificacoes.push({
        linha_id: linha.id,
        cliente_nome: clienteInfo.nome,
        cliente_norm: nomeNorm,
        client_id: clienteInfo.client_id,
        conta_destino: contaDestino,
        debit: linha.debit,
        credit: linha.credit
      });
    } else {
      naoIdentificados.push({
        linha_id: linha.id,
        source_type: sourceType,
        description: (entry?.description || linha.description || '').substring(0, 80),
        debit: linha.debit,
        credit: linha.credit
      });
    }
  }

  // 6. Mostrar resultados
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 RESULTADO DA ANÁLISE');
  console.log('═'.repeat(80));

  console.log(`\n✅ Lançamentos identificados: ${reclassificacoes.length}`);
  console.log(`❌ Lançamentos NÃO identificados: ${naoIdentificados.length}`);
  console.log(`🆕 Contas a criar: ${contasParaCriar.size}`);

  console.log('\n📋 Por source_type:');
  for (const [tipo, stats] of Object.entries(estatisticas.porTipo)) {
    const pct = stats.total > 0 ? ((stats.identificados / stats.total) * 100).toFixed(1) : '0';
    console.log(`   ${tipo}: ${stats.identificados}/${stats.total} (${pct}%)`);
  }

  // Calcular valores
  let totalDebito = 0, totalCredito = 0;
  reclassificacoes.forEach(r => {
    totalDebito += parseFloat(r.debit) || 0;
    totalCredito += parseFloat(r.credit) || 0;
  });

  console.log('\n📊 VALORES A RECLASSIFICAR:');
  console.log(`   Débitos: R$ ${totalDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Créditos: R$ ${totalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // 7. Se modo aplicar, executar
  if (MODO === 'aplicar') {
    console.log('\n\n' + '═'.repeat(80));
    console.log('🔄 APLICANDO RECLASSIFICAÇÕES...');
    console.log('═'.repeat(80));

    // Criar contas novas
    console.log(`\n   Criando ${contasParaCriar.size} contas novas...`);
    for (const [nomeNorm, info] of contasParaCriar) {
      const novaConta = await criarContaAnalitica(contaSintetica, info.nome, info.client_id);
      if (novaConta) {
        mapaContasPorNome[nomeNorm] = novaConta;
        console.log(`   ✅ Criada: ${novaConta.code} - ${novaConta.name}`);
      }
    }

    // Reclassificar lançamentos
    console.log(`\n   Reclassificando ${reclassificacoes.length} lançamentos...`);
    let sucesso = 0, erro = 0;

    for (const recl of reclassificacoes) {
      const contaDestino = recl.conta_destino || mapaContasPorNome[recl.cliente_norm];

      if (!contaDestino) {
        erro++;
        continue;
      }

      const { error } = await supabase
        .from('accounting_entry_lines')
        .update({ account_id: contaDestino.id })
        .eq('id', recl.linha_id);

      if (error) {
        erro++;
      } else {
        sucesso++;
      }

      if ((sucesso + erro) % 100 === 0) {
        console.log(`   Progresso: ${sucesso + erro}/${reclassificacoes.length}`);
      }
    }

    console.log(`\n   ✅ Reclassificados: ${sucesso}`);
    console.log(`   ❌ Erros: ${erro}`);

    // Verificar resultado
    const { count: restante } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', contaSintetica.id);

    console.log(`\n📊 Lançamentos restantes na sintética: ${restante || 0}`);

  } else {
    console.log('\n\n' + '═'.repeat(80));
    console.log('ℹ️  MODO SIMULAÇÃO - Nenhuma alteração foi feita');
    console.log('═'.repeat(80));
    console.log('\nPara aplicar as reclassificações, execute:');
    console.log('   node scripts/dr_cicero_reclassificacao_automatica.mjs aplicar');
  }

  // Gerar razão
  await gerarRazaoContabil(PERIODO);
}

async function identificarCliente(linha, entry) {
  const sourceType = entry?.source_type || 'null';
  let nome = 'NAO_IDENTIFICADO';
  let client_id = null;

  switch (sourceType) {
    case 'invoice':
      if (entry?.reference_id) {
        const { data } = await supabase
          .from('invoices')
          .select('client_id, clients(name)')
          .eq('id', entry.reference_id)
          .single();
        if (data?.clients?.name) {
          nome = data.clients.name;
          client_id = data.client_id;
        }
      }
      break;

    case 'boleto_sicredi':
    case 'sicredi_boleto':
      if (entry?.reference_id) {
        const { data } = await supabase
          .from('boleto_payments')
          .select('client_id, clients(name)')
          .eq('id', entry.reference_id)
          .single();
        if (data?.clients?.name) {
          nome = data.clients.name;
          client_id = data.client_id;
        }
      }
      break;

    case 'client_opening_balance':
      if (entry?.reference_id) {
        const { data } = await supabase
          .from('client_opening_balances')
          .select('client_id, clients(name)')
          .eq('id', entry.reference_id)
          .single();
        if (data?.clients?.name) {
          nome = data.clients.name;
          client_id = data.client_id;
        }
      }
      break;
  }

  // Fallback: extrair do description
  if (nome === 'NAO_IDENTIFICADO') {
    nome = extrairNomeDoDescription(entry?.description || linha.description || '');
  }

  return { nome, client_id };
}

function extrairNomeDoDescription(desc) {
  if (!desc) return 'NAO_IDENTIFICADO';

  let match;

  match = desc.match(/Receita Honorarios:\s*(.+?)(?:\s*-\s*COB|\s*$)/i);
  if (match) return limpar(match[1]);

  match = desc.match(/Recebimento\s+(.+?)\s*-\s*COB/i);
  if (match) return limpar(match[1]);

  match = desc.match(/Saldo Abertura(?:\s+13º)?\s*-\s*(.+?)(?:\s*$)/i);
  if (match) return limpar(match[1]);

  match = desc.match(/Clientes a Receber\s*-\s*(.+?)(?:\s*$)/i);
  if (match) return limpar(match[1]);

  match = desc.match(/Débito:\s*(.+?)(?:\s*$)/i);
  if (match && !match[1].toLowerCase().includes('clientes')) return limpar(match[1]);

  return 'NAO_IDENTIFICADO';
}

function limpar(s) {
  return s.replace(/^\s*-\s*/, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function normalizarNome(nome) {
  return (nome || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '').substring(0, 100);
}

async function criarContaAnalitica(contaSintetica, nome, client_id) {
  const { data: ultima } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .like('code', `${contaSintetica.code}.%`)
    .order('code', { ascending: false })
    .limit(1)
    .single();

  let proximo = 1;
  if (ultima) {
    const partes = ultima.code.split('.');
    proximo = (parseInt(partes[partes.length - 1]) || 0) + 1;
  }

  const novoCodigo = `${contaSintetica.code}.${proximo.toString().padStart(4, '0')}`;

  const { data: nova, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code: novoCodigo,
      name: nome.substring(0, 100),
      account_type: 'ATIVO',
      nature: 'DEVEDORA',
      parent_id: contaSintetica.id,
      level: 5,
      is_analytical: true,
      is_synthetic: false,
      is_active: true,
      accepts_entries: true
    })
    .select()
    .single();

  if (error) {
    console.log(`   ⚠️  Erro ao criar ${novoCodigo}: ${error.message}`);
    return null;
  }

  return nova;
}

async function gerarRazaoContabil(periodo) {
  console.log('\n\n' + '═'.repeat(80));
  console.log('📚 RAZÃO CONTÁBIL - CONTAS DE CLIENTES');
  console.log('═'.repeat(80));

  const [ano, mes] = periodo.split('-');
  const dataInicio = `${ano}-${mes}-01`;
  const dataFim = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0];

  console.log(`\n   Período: ${dataInicio} a ${dataFim}`);

  // Buscar contas de clientes (1.1.2.01.xxxx)
  const { data: contasClientes } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .eq('is_analytical', true)
    .order('code');

  if (!contasClientes || contasClientes.length === 0) {
    console.log('   Nenhuma conta de cliente encontrada.');
    return;
  }

  console.log(`   ${contasClientes.length} contas de clientes\n`);
  console.log('   ' + '─'.repeat(90));
  console.log('   Código          | Nome                                     | Saldo Ant.    | Débitos       | Créditos      | Saldo Final');
  console.log('   ' + '─'.repeat(90));

  let totalSaldoAnt = 0, totalDebitos = 0, totalCreditos = 0, totalSaldoFinal = 0;

  for (const conta of contasClientes.slice(0, 30)) {
    // Saldo anterior
    const { data: saldoAntData } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit, accounting_entries!inner(entry_date)')
      .eq('account_id', conta.id)
      .lt('accounting_entries.entry_date', dataInicio);

    let saldoAnt = 0;
    saldoAntData?.forEach(l => {
      saldoAnt += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
    });

    // Movimento do período
    const { data: movPeriodo } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit, accounting_entries!inner(entry_date)')
      .eq('account_id', conta.id)
      .gte('accounting_entries.entry_date', dataInicio)
      .lte('accounting_entries.entry_date', dataFim);

    let debitos = 0, creditos = 0;
    movPeriodo?.forEach(l => {
      debitos += parseFloat(l.debit) || 0;
      creditos += parseFloat(l.credit) || 0;
    });

    const saldoFinal = saldoAnt + debitos - creditos;

    // Só mostrar se tem movimento
    if (saldoAnt !== 0 || debitos !== 0 || creditos !== 0) {
      totalSaldoAnt += saldoAnt;
      totalDebitos += debitos;
      totalCreditos += creditos;
      totalSaldoFinal += saldoFinal;

      const sA = `R$ ${saldoAnt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
      const sD = `R$ ${debitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
      const sC = `R$ ${creditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
      const sF = `R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);

      console.log(`   ${conta.code.padEnd(16)} | ${conta.name.substring(0, 40).padEnd(40)} | ${sA} | ${sD} | ${sC} | ${sF}`);
    }
  }

  console.log('   ' + '─'.repeat(90));
  const tA = `R$ ${totalSaldoAnt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
  const tD = `R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
  const tC = `R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
  const tF = `R$ ${totalSaldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
  console.log(`   ${'TOTAL'.padEnd(16)} | ${''.padEnd(40)} | ${tA} | ${tD} | ${tC} | ${tF}`);
  console.log('   ' + '─'.repeat(90));
}

main().catch(console.error);
