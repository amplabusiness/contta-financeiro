/**
 * RECLASSIFICAÇÃO DE LANÇAMENTOS: SINTÉTICA → ANALÍTICAS
 *
 * Move lançamentos da conta sintética 1.1.2.01 (Clientes a Receber)
 * para as contas analíticas correspondentes (1.1.2.01.xxxx)
 *
 * Fundamentação: NBC TG 26, ITG 2000
 * "Os lançamentos contábeis devem ser efetuados em contas ANALÍTICAS,
 * sendo vedado o registro em contas SINTÉTICAS ou de grupo."
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
  console.log(`📋 RECLASSIFICAÇÃO DE LANÇAMENTOS - MODO: ${MODO.toUpperCase()}`);
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
  console.log(`   ID: ${contaSintetica.id}`);

  // 2. Buscar todas as contas analíticas filhas (1.1.2.01.xxxx)
  const contasAnaliticas = await buscarTodos(
    'chart_of_accounts',
    'id, code, name, metadata',
    null
  );

  const analiticasFilhas = contasAnaliticas.filter(c =>
    c.code.startsWith('1.1.2.01.') && c.code !== '1.1.2.01'
  );

  console.log(`\n📊 Contas analíticas disponíveis: ${analiticasFilhas.length}`);

  // Criar mapa de client_id -> conta analítica
  const mapaClienteParaConta = {};
  const mapaClienteNomeParaConta = {};

  for (const conta of analiticasFilhas) {
    // O metadata pode ter client_id
    if (conta.metadata?.client_id) {
      mapaClienteParaConta[conta.metadata.client_id] = conta;
    }
    // Também mapear pelo nome (normalizado)
    const nomeNormalizado = normalizarNome(conta.name);
    mapaClienteNomeParaConta[nomeNormalizado] = conta;
  }

  console.log(`   Mapeadas por client_id: ${Object.keys(mapaClienteParaConta).length}`);
  console.log(`   Mapeadas por nome: ${Object.keys(mapaClienteNomeParaConta).length}`);

  // 3. Buscar lançamentos na conta sintética
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

  // 4. Buscar entries para ter source_type e reference_id
  const entryIds = [...new Set(linhasSintetica.map(l => l.entry_id))];
  console.log(`   Entries únicos: ${entryIds.length}`);

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

  // 5. Para cada lançamento, identificar o cliente e a conta analítica destino
  const reclassificacoes = [];
  const naoIdentificados = [];
  const estatisticas = {
    porTipo: {},
    porMotivo: {}
  };

  for (const linha of linhasSintetica) {
    const entry = mapEntries[linha.entry_id];
    const sourceType = entry?.source_type || 'null';

    if (!estatisticas.porTipo[sourceType]) {
      estatisticas.porTipo[sourceType] = { total: 0, identificados: 0, naoIdentificados: 0 };
    }
    estatisticas.porTipo[sourceType].total++;

    let contaDestino = null;
    let motivoIdentificacao = null;

    // Estratégia de identificação baseada no source_type
    switch (sourceType) {
      case 'invoice':
        // Buscar client_id na tabela invoices
        if (entry?.reference_id) {
          const { data: invoice } = await supabase
            .from('invoices')
            .select('client_id')
            .eq('id', entry.reference_id)
            .single();

          if (invoice?.client_id && mapaClienteParaConta[invoice.client_id]) {
            contaDestino = mapaClienteParaConta[invoice.client_id];
            motivoIdentificacao = 'invoice.client_id';
          }
        }
        break;

      case 'boleto_sicredi':
      case 'sicredi_boleto':
        // Buscar client_id na tabela boleto_payments
        if (entry?.reference_id) {
          const { data: boleto } = await supabase
            .from('boleto_payments')
            .select('client_id')
            .eq('id', entry.reference_id)
            .single();

          if (boleto?.client_id && mapaClienteParaConta[boleto.client_id]) {
            contaDestino = mapaClienteParaConta[boleto.client_id];
            motivoIdentificacao = 'boleto_payments.client_id';
          }
        }
        break;

      case 'client_opening_balance':
        // Buscar client_id na tabela client_opening_balances
        if (entry?.reference_id) {
          const { data: saldo } = await supabase
            .from('client_opening_balances')
            .select('client_id')
            .eq('id', entry.reference_id)
            .single();

          if (saldo?.client_id && mapaClienteParaConta[saldo.client_id]) {
            contaDestino = mapaClienteParaConta[saldo.client_id];
            motivoIdentificacao = 'client_opening_balances.client_id';
          }
        }
        break;

      case 'bank_transaction':
        // Tentar extrair do description
        // Exemplo: "Recebimento: Clientes a Receber" - sem nome específico
        break;
    }

    // Se não encontrou por client_id, tentar pelo nome no description
    if (!contaDestino) {
      const nomeExtraido = extrairNomeCliente(entry?.description || linha.description || '');
      if (nomeExtraido) {
        const nomeNormalizado = normalizarNome(nomeExtraido);
        contaDestino = mapaClienteNomeParaConta[nomeNormalizado];
        if (contaDestino) {
          motivoIdentificacao = 'description (nome)';
        } else {
          // Tentar busca parcial
          contaDestino = buscarContaPorNomeParcial(nomeExtraido, analiticasFilhas);
          if (contaDestino) {
            motivoIdentificacao = 'description (nome parcial)';
          }
        }
      }
    }

    if (contaDestino) {
      estatisticas.porTipo[sourceType].identificados++;
      if (!estatisticas.porMotivo[motivoIdentificacao]) {
        estatisticas.porMotivo[motivoIdentificacao] = 0;
      }
      estatisticas.porMotivo[motivoIdentificacao]++;

      reclassificacoes.push({
        linha_id: linha.id,
        entry_id: linha.entry_id,
        source_type: sourceType,
        conta_origem: contaSintetica.code,
        conta_destino_id: contaDestino.id,
        conta_destino_code: contaDestino.code,
        conta_destino_name: contaDestino.name,
        debit: linha.debit,
        credit: linha.credit,
        motivo: motivoIdentificacao
      });
    } else {
      estatisticas.porTipo[sourceType].naoIdentificados++;
      naoIdentificados.push({
        linha_id: linha.id,
        entry_id: linha.entry_id,
        source_type: sourceType,
        reference_id: entry?.reference_id,
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

  console.log('\n📋 Por source_type:');
  for (const [tipo, stats] of Object.entries(estatisticas.porTipo)) {
    const pct = stats.total > 0 ? ((stats.identificados / stats.total) * 100).toFixed(1) : '0';
    console.log(`   ${tipo}: ${stats.identificados}/${stats.total} (${pct}%)`);
  }

  console.log('\n📋 Por método de identificação:');
  for (const [motivo, qtd] of Object.entries(estatisticas.porMotivo).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${motivo}: ${qtd}`);
  }

  // Mostrar amostra dos não identificados
  if (naoIdentificados.length > 0) {
    console.log('\n\n📋 AMOSTRA DOS NÃO IDENTIFICADOS (primeiros 20):');
    console.log('-'.repeat(80));
    for (const item of naoIdentificados.slice(0, 20)) {
      console.log(`${item.source_type} | D: ${item.debit} C: ${item.credit}`);
      console.log(`   ${item.description}`);
    }
  }

  // 7. Calcular valores
  let totalDebitoReclassificar = 0;
  let totalCreditoReclassificar = 0;
  reclassificacoes.forEach(r => {
    totalDebitoReclassificar += parseFloat(r.debit) || 0;
    totalCreditoReclassificar += parseFloat(r.credit) || 0;
  });

  console.log('\n\n📊 VALORES A RECLASSIFICAR:');
  console.log(`   Débitos: R$ ${totalDebitoReclassificar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Créditos: R$ ${totalCreditoReclassificar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // 8. Se modo aplicar, executar as atualizações
  if (MODO === 'aplicar' && reclassificacoes.length > 0) {
    console.log('\n\n' + '═'.repeat(80));
    console.log('🔄 APLICANDO RECLASSIFICAÇÕES...');
    console.log('═'.repeat(80));

    let sucesso = 0;
    let erro = 0;

    for (const recl of reclassificacoes) {
      const { error } = await supabase
        .from('accounting_entry_lines')
        .update({ account_id: recl.conta_destino_id })
        .eq('id', recl.linha_id);

      if (error) {
        console.log(`❌ Erro ao atualizar linha ${recl.linha_id}: ${error.message}`);
        erro++;
      } else {
        sucesso++;
      }

      // Mostrar progresso a cada 100
      if ((sucesso + erro) % 100 === 0) {
        console.log(`   Progresso: ${sucesso + erro}/${reclassificacoes.length}`);
      }
    }

    console.log(`\n✅ Reclassificações aplicadas: ${sucesso}`);
    console.log(`❌ Erros: ${erro}`);

    // Verificar resultado final
    const { count: restante } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', contaSintetica.id);

    console.log(`\n📊 Lançamentos restantes na conta sintética: ${restante || 0}`);

  } else if (MODO === 'simulacao') {
    console.log('\n\n' + '═'.repeat(80));
    console.log('ℹ️  MODO SIMULAÇÃO - Nenhuma alteração foi feita');
    console.log('═'.repeat(80));
    console.log('\nPara aplicar as reclassificações, execute:');
    console.log('   node scripts/reclassificar_sintetica_para_analiticas.mjs aplicar');
  }

  // Mostrar resumo por conta destino
  console.log('\n\n📋 RESUMO POR CONTA DESTINO (top 20):');
  const porContaDestino = {};
  reclassificacoes.forEach(r => {
    if (!porContaDestino[r.conta_destino_code]) {
      porContaDestino[r.conta_destino_code] = {
        nome: r.conta_destino_name,
        qtd: 0,
        debito: 0,
        credito: 0
      };
    }
    porContaDestino[r.conta_destino_code].qtd++;
    porContaDestino[r.conta_destino_code].debito += parseFloat(r.debit) || 0;
    porContaDestino[r.conta_destino_code].credito += parseFloat(r.credit) || 0;
  });

  const ordenado = Object.entries(porContaDestino)
    .sort((a, b) => b[1].qtd - a[1].qtd)
    .slice(0, 20);

  for (const [code, dados] of ordenado) {
    const saldo = dados.debito - dados.credito;
    console.log(`${code} | ${dados.qtd} lanç. | Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   ${dados.nome.substring(0, 50)}`);
  }
}

function normalizarNome(nome) {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function extrairNomeCliente(description) {
  // Padrões conhecidos:
  // "Receita Honorarios: NOME_CLIENTE"
  // "Recebimento NOME_CLIENTE - COB000XXX"
  // "Saldo Abertura - NOME_CLIENTE"
  // "C - Clientes a Receber - NOME_CLIENTE"
  // "Débito: NOME_CLIENTE"

  let nome = null;

  // Padrão: "Receita Honorarios: NOME"
  let match = description.match(/Receita Honorarios:\s*(.+?)(?:\s*-\s*COB|\s*$)/i);
  if (match) return match[1].trim();

  // Padrão: "Recebimento NOME - COB"
  match = description.match(/Recebimento\s+(.+?)\s*-\s*COB/i);
  if (match) return match[1].trim();

  // Padrão: "Saldo Abertura - NOME" ou "Saldo Abertura 13º - NOME"
  match = description.match(/Saldo Abertura(?:\s+13º)?\s*-\s*(.+?)(?:\s*$)/i);
  if (match) return match[1].trim();

  // Padrão: "C - Clientes a Receber - NOME"
  match = description.match(/Clientes a Receber\s*-\s*(.+?)(?:\s*$)/i);
  if (match) return match[1].trim();

  // Padrão: "Débito: NOME"
  match = description.match(/Débito:\s*(.+?)(?:\s*$)/i);
  if (match) return match[1].trim();

  return nome;
}

function buscarContaPorNomeParcial(nomeCliente, contasAnaliticas) {
  const nomeNorm = normalizarNome(nomeCliente);

  // Buscar correspondência exata primeiro
  for (const conta of contasAnaliticas) {
    const contaNorm = normalizarNome(conta.name);
    if (contaNorm === nomeNorm) {
      return conta;
    }
  }

  // Buscar correspondência parcial (nome começa igual)
  for (const conta of contasAnaliticas) {
    const contaNorm = normalizarNome(conta.name);
    if (contaNorm.startsWith(nomeNorm) || nomeNorm.startsWith(contaNorm)) {
      return conta;
    }
  }

  // Buscar por palavras-chave principais (primeiras 3 palavras)
  const palavras = nomeCliente.toUpperCase().split(/\s+/).slice(0, 3);
  if (palavras.length >= 2) {
    for (const conta of contasAnaliticas) {
      const contaUpper = conta.name.toUpperCase();
      if (palavras.every(p => contaUpper.includes(p))) {
        return conta;
      }
    }
  }

  return null;
}

main().catch(console.error);
