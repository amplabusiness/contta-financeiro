// scripts/mcp_desmembrar_cobrancas_jan2025.mjs
// Desmembra cobranças agrupadas (COBxxxx) usando dados do CSV
// Autor: MCP Financeiro + Dr. Cícero

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurações
const COMPETENCIA = '2025-01-01';
const CONTA_TRANSITORIA = '1.1.9.01';
const CONTA_RECEITA_HONORARIOS = '3.1.1.01';

// Estatísticas
const stats = {
  boletosProcessados: 0,
  boletosJaExistem: 0,
  clientesNaoEncontrados: 0,
  erros: 0,
  valorTotal: 0
};

// Normalizar nome para busca
function normalizarNome(nome) {
  return nome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .trim();
}

// Parsear valor BR para número
function parseValorBR(valor) {
  if (typeof valor === 'number') return valor;
  return parseFloat(
    valor
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  );
}

// Parsear data BR para ISO
function parseDataBR(data) {
  const [dia, mes, ano] = data.split('/');
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// Ler CSV de boletos
function lerCSVBoletos(caminho) {
  const conteudo = readFileSync(caminho, 'latin1');
  const linhas = conteudo.split('\n').filter(l => l.trim());
  const boletos = [];

  for (let i = 1; i < linhas.length; i++) { // Pular cabeçalho
    const campos = linhas[i].split(';');
    if (campos.length < 8) continue;

    boletos.push({
      documento: campos[0]?.trim(),
      numBoleto: campos[1]?.trim(),
      pagador: campos[2]?.trim(),
      dataVencimento: campos[3]?.trim(),
      dataLiquidacao: campos[4]?.trim(),
      valorBoleto: parseValorBR(campos[5]),
      valorRecebido: parseValorBR(campos[6]),
      dataExtrato: campos[7]?.trim()
    });
  }

  return boletos;
}

// Buscar conta do cliente
async function buscarContaCliente(nomePagador) {
  const nomeNorm = normalizarNome(nomePagador);
  const primeiraPalavra = nomeNorm.split(' ')[0];

  // Buscar conta do cliente em 1.1.2.01.*
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .neq('code', '1.1.2.01')
    .not('name', 'ilike', '%[CONSOLIDADO]%');

  // Tentar match exato primeiro
  for (const conta of contas || []) {
    const nomeContaNorm = normalizarNome(conta.name);
    if (nomeContaNorm === nomeNorm) {
      return conta;
    }
  }

  // Tentar match parcial (primeira palavra)
  for (const conta of contas || []) {
    const nomeContaNorm = normalizarNome(conta.name);
    if (nomeContaNorm.startsWith(primeiraPalavra) || nomeContaNorm.includes(nomeNorm)) {
      return conta;
    }
  }

  // Buscar cliente pelo nome na tabela clients
  const { data: cliente } = await supabase
    .from('clients')
    .select('id, company_name')
    .or(`company_name.ilike.%${primeiraPalavra}%,company_name.ilike.%${nomeNorm.substring(0, 20)}%`)
    .limit(1)
    .single();

  if (cliente) {
    // Buscar conta associada ao cliente
    const { data: contaCliente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .ilike('name', `%${cliente.company_name.substring(0, 20)}%`)
      .like('code', '1.1.2.01.%')
      .limit(1)
      .single();

    if (contaCliente) {
      return contaCliente;
    }
  }

  return null;
}

// Buscar conta do banco/transitória
async function buscarConta(codigo) {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', codigo)
    .single();
  return data;
}

// Validar lançamento (Guardião MCP)
async function validarLancamento(linhas, referenceId) {
  const erros = [];

  // Regra 1: Partida dobrada
  const totalD = linhas.reduce((s, l) => s + (l.debito || 0), 0);
  const totalC = linhas.reduce((s, l) => s + (l.credito || 0), 0);

  if (Math.abs(totalD - totalC) > 0.01) {
    erros.push(`Débitos (${totalD.toFixed(2)}) ≠ Créditos (${totalC.toFixed(2)})`);
  }

  // Regra 2: Idempotência
  if (referenceId) {
    const { data: existente } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('internal_code', referenceId)
      .maybeSingle();

    if (existente) {
      return { valido: false, jaExiste: true, erros };
    }
  }

  return { valido: erros.length === 0, jaExiste: false, erros, totalD, totalC };
}

// Criar lançamento de recebimento do boleto
async function criarLancamentoRecebimento(boleto, contaCliente) {
  const referenceId = `boleto_${boleto.numBoleto.replace(/\//g, '_')}_${boleto.documento}`;
  const dataRecebimento = parseDataBR(boleto.dataExtrato);

  // Lançamento: D-Transitória (baixa) / C-Cliente a Receber
  const linhas = [
    { conta_code: CONTA_TRANSITORIA, debito: 0, credito: boleto.valorRecebido },
    { conta_id: contaCliente.id, credito: boleto.valorRecebido, debito: 0 }
  ];

  const validacao = await validarLancamento([
    { debito: 0, credito: boleto.valorRecebido },
    { debito: boleto.valorRecebido, credito: 0 }
  ], referenceId);

  if (validacao.jaExiste) {
    return { sucesso: true, jaExiste: true };
  }

  if (!validacao.valido) {
    console.log(`   ❌ GUARDIÃO: ${validacao.erros.join(', ')}`);
    return { sucesso: false, erros: validacao.erros };
  }

  // Buscar conta transitória
  const contaTransitoria = await buscarConta(CONTA_TRANSITORIA);

  // Criar entry
  const { data: entry, error: errEntry } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: dataRecebimento,
      competence_date: COMPETENCIA,
      entry_type: 'RECEBIMENTO_BOLETO',
      description: `Recebimento boleto ${boleto.numBoleto} - ${boleto.pagador.substring(0, 40)}`,
      reference_type: 'BOLETO',
      internal_code: referenceId,
      total_debit: boleto.valorRecebido,
      total_credit: boleto.valorRecebido,
      balanced: true
    })
    .select()
    .single();

  if (errEntry) {
    console.log(`   ❌ Erro entry: ${errEntry.message}`);
    return { sucesso: false, erro: errEntry.message };
  }

  // Criar items (baixa da transitória + baixa do cliente)
  const { error: errItems } = await supabase
    .from('accounting_entry_items')
    .insert([
      {
        entry_id: entry.id,
        account_id: contaTransitoria.id,
        debit: boleto.valorRecebido,
        credit: 0,
        history: `Desmembramento ${boleto.documento} - Boleto ${boleto.numBoleto}`
      },
      {
        entry_id: entry.id,
        account_id: contaCliente.id,
        debit: 0,
        credit: boleto.valorRecebido,
        history: `Recebimento boleto ${boleto.numBoleto}`
      }
    ]);

  if (errItems) {
    console.log(`   ❌ Erro items: ${errItems.message}`);
    await supabase.from('accounting_entries').delete().eq('id', entry.id);
    return { sucesso: false, erro: errItems.message };
  }

  return { sucesso: true, entry_id: entry.id };
}

async function main() {
  console.log('='.repeat(100));
  console.log('MCP GUARDIÃO - DESMEMBRAMENTO DE COBRANÇAS AGRUPADAS');
  console.log('Dr. Cícero - Contador Oficial');
  console.log('='.repeat(100));
  console.log(`Executado em: ${new Date().toLocaleString('pt-BR')}`);

  // Ler CSV de boletos
  console.log('\n📂 Lendo CSV de boletos...');
  const csvPath = 'banco/clientes boletos jan.csv';
  const boletos = lerCSVBoletos(csvPath);
  console.log(`   Total de boletos: ${boletos.length}`);

  // Agrupar por documento (COBxxxx)
  const porDocumento = {};
  for (const boleto of boletos) {
    if (!porDocumento[boleto.documento]) {
      porDocumento[boleto.documento] = [];
    }
    porDocumento[boleto.documento].push(boleto);
  }

  console.log(`\n📋 Documentos de cobrança encontrados: ${Object.keys(porDocumento).length}`);
  for (const [doc, bols] of Object.entries(porDocumento)) {
    const total = bols.reduce((s, b) => s + b.valorRecebido, 0);
    console.log(`   ${doc}: ${bols.length} boletos = R$ ${total.toFixed(2)}`);
  }

  // Processar cada boleto
  console.log('\n' + '='.repeat(100));
  console.log('PROCESSANDO BOLETOS');
  console.log('='.repeat(100));

  for (const boleto of boletos) {
    console.log(`\n📋 [${boleto.documento}] ${boleto.pagador.substring(0, 35)}`);
    console.log(`   Boleto: ${boleto.numBoleto} | R$ ${boleto.valorRecebido.toFixed(2)} | ${boleto.dataExtrato}`);

    // Buscar conta do cliente
    const contaCliente = await buscarContaCliente(boleto.pagador);

    if (!contaCliente) {
      console.log(`   ❌ Cliente não encontrado no plano de contas`);
      stats.clientesNaoEncontrados++;
      continue;
    }

    console.log(`   Conta: ${contaCliente.code} - ${contaCliente.name.substring(0, 30)}`);

    // Criar lançamento de recebimento
    const resultado = await criarLancamentoRecebimento(boleto, contaCliente);

    if (resultado.sucesso && !resultado.jaExiste) {
      stats.boletosProcessados++;
      stats.valorTotal += boleto.valorRecebido;
      console.log(`   ✅ Desmembrado com sucesso`);
    } else if (resultado.jaExiste) {
      stats.boletosJaExistem++;
      console.log(`   ⚠️  Já existe`);
    } else {
      stats.erros++;
    }
  }

  // Relatório final
  console.log('\n' + '='.repeat(100));
  console.log('RELATÓRIO FINAL - DESMEMBRAMENTO');
  console.log('='.repeat(100));
  console.log(`   Total de boletos no CSV:      ${boletos.length}`);
  console.log(`   Processados com sucesso:      ${stats.boletosProcessados}`);
  console.log(`   Já existentes:                ${stats.boletosJaExistem}`);
  console.log(`   Clientes não encontrados:     ${stats.clientesNaoEncontrados}`);
  console.log(`   Erros:                        ${stats.erros}`);
  console.log('');
  console.log(`   Valor total desmembrado:      R$ ${stats.valorTotal.toFixed(2)}`);

  // Verificar saldo da conta transitória
  console.log('\n📊 Verificando saldo da conta transitória...');
  const contaTransitoria = await buscarConta(CONTA_TRANSITORIA);

  const { data: itemsTransitoria } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit')
    .eq('account_id', contaTransitoria.id);

  const saldoTransitoria = (itemsTransitoria || []).reduce(
    (s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0
  );

  console.log(`   Saldo conta transitória: R$ ${saldoTransitoria.toFixed(2)}`);

  if (stats.clientesNaoEncontrados > 0) {
    console.log('\n⚠️  ATENÇÃO: Alguns clientes não foram encontrados.');
    console.log('   Verifique se existem contas no plano de contas para esses clientes.');
  }

  console.log('\n' + '='.repeat(100));
}

main().catch(console.error);
