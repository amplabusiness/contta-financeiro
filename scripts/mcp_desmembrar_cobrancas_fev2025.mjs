// scripts/mcp_desmembrar_cobrancas_fev2025.mjs
// Desmembra cobranças agrupadas (COBxxxx) usando dados do CSV de FEVEREIRO
// COMPETÊNCIA: Janeiro/2025 (pagos em Fevereiro/2025)
// Autor: MCP Financeiro + Dr. Cícero

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Configurações
const COMPETENCIA = '2025-01-01'; // Competência JANEIRO, pago em FEVEREIRO
const CONTA_TRANSITORIA = '1.1.9.01';
const CSV_PATH = 'banco/clientes de boleto fev.csv';

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

// Parsear valor BR para número (formato: R$ 1.234,56)
function parseValorBR(valor) {
  if (typeof valor === 'number') return valor;
  return parseFloat(
    valor
      .replace('R$', '')
      .replace(/\s/g, '')
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

// Ler CSV de boletos (formato fevereiro)
function lerCSVBoletos(caminho) {
  const conteudo = readFileSync(caminho, 'latin1');
  const linhas = conteudo.split('\n').filter(l => l.trim());
  const boletos = [];

  // Cabeçalho: Documento;N do boleto;Pagador;Data Vencimento;Data Liquidação; valor boleto ; valor recebido ;data do extrato
  for (let i = 1; i < linhas.length; i++) {
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
    .maybeSingle();

  if (cliente) {
    // Buscar conta associada ao cliente
    const { data: contaCliente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .ilike('name', `%${cliente.company_name.substring(0, 20)}%`)
      .like('code', '1.1.2.01.%')
      .limit(1)
      .maybeSingle();

    if (contaCliente) {
      return contaCliente;
    }
  }

  return null;
}

// Buscar conta pelo código
async function buscarConta(codigo) {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', codigo)
    .single();
  return data;
}

// Verificar se lançamento já existe (idempotência)
async function lancamentoJaExiste(referenceId) {
  const { data: existente } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('internal_code', referenceId)
    .maybeSingle();
  return !!existente;
}

// Criar lançamento de baixa do boleto
// D 1.1.9.01 (Transitória) / C 1.1.2.01.xxx (Cliente)
async function criarLancamentoBaixa(boleto, contaCliente) {
  const referenceId = `boleto_${boleto.numBoleto.replace(/\//g, '_')}_${boleto.documento}`;
  const dataRecebimento = parseDataBR(boleto.dataExtrato);

  // Verificar idempotência
  if (await lancamentoJaExiste(referenceId)) {
    return { sucesso: true, jaExiste: true };
  }

  // Buscar conta transitória
  const contaTransitoria = await buscarConta(CONTA_TRANSITORIA);
  if (!contaTransitoria) {
    return { sucesso: false, erro: 'Conta transitória não encontrada' };
  }

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

  // Criar items: D Transitória / C Cliente
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
  console.log('═'.repeat(100));
  console.log('MCP GUARDIÃO - DESMEMBRAMENTO DE COBRANÇAS AGRUPADAS - FEVEREIRO 2025');
  console.log('Dr. Cícero - Contador Oficial');
  console.log('═'.repeat(100));
  console.log(`Competência: Janeiro/2025 (pagos em Fevereiro/2025)`);
  console.log(`Executado em: ${new Date().toLocaleString('pt-BR')}`);

  // Ler CSV de boletos
  console.log(`\n📂 Lendo CSV de boletos: ${CSV_PATH}`);
  const boletos = lerCSVBoletos(CSV_PATH);
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
    const total = bols.reduce((s, b) => s + (isNaN(b.valorRecebido) ? 0 : b.valorRecebido), 0);
    console.log(`   ${doc}: ${bols.length} boletos = R$ ${total.toFixed(2)}`);
  }

  // Processar cada boleto
  console.log('\n' + '═'.repeat(100));
  console.log('PROCESSANDO BOLETOS');
  console.log('═'.repeat(100));

  const clientesNaoEncontrados = [];

  for (const boleto of boletos) {
    if (isNaN(boleto.valorRecebido) || boleto.valorRecebido <= 0) {
      console.log(`\n⚠️  [${boleto.documento}] ${boleto.pagador?.substring(0, 35)} - Valor inválido`);
      continue;
    }

    console.log(`\n📋 [${boleto.documento}] ${boleto.pagador?.substring(0, 35)}`);
    console.log(`   Boleto: ${boleto.numBoleto} | R$ ${boleto.valorRecebido.toFixed(2)} | ${boleto.dataExtrato}`);

    // Buscar conta do cliente
    const contaCliente = await buscarContaCliente(boleto.pagador);

    if (!contaCliente) {
      console.log(`   ❌ Cliente não encontrado no plano de contas`);
      stats.clientesNaoEncontrados++;
      clientesNaoEncontrados.push({
        doc: boleto.documento,
        pagador: boleto.pagador,
        valor: boleto.valorRecebido
      });
      continue;
    }

    console.log(`   Conta: ${contaCliente.code} - ${contaCliente.name.substring(0, 30)}`);

    // Criar lançamento de baixa
    const resultado = await criarLancamentoBaixa(boleto, contaCliente);

    if (resultado.sucesso && !resultado.jaExiste) {
      stats.boletosProcessados++;
      stats.valorTotal += boleto.valorRecebido;
      console.log(`   ✅ Baixa registrada com sucesso`);
    } else if (resultado.jaExiste) {
      stats.boletosJaExistem++;
      console.log(`   ⚠️  Já existe (idempotência OK)`);
    } else {
      stats.erros++;
    }
  }

  // Relatório final
  console.log('\n' + '═'.repeat(100));
  console.log('RELATÓRIO FINAL - DESMEMBRAMENTO FEVEREIRO 2025');
  console.log('═'.repeat(100));
  console.log(`   Total de boletos no CSV:      ${boletos.length}`);
  console.log(`   Processados com sucesso:      ${stats.boletosProcessados}`);
  console.log(`   Já existentes (não duplicou): ${stats.boletosJaExistem}`);
  console.log(`   Clientes não encontrados:     ${stats.clientesNaoEncontrados}`);
  console.log(`   Erros:                        ${stats.erros}`);
  console.log('');
  console.log(`   Valor total processado:       R$ ${stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

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

  console.log(`   Saldo conta transitória: R$ ${saldoTransitoria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  if (clientesNaoEncontrados.length > 0) {
    console.log('\n⚠️  CLIENTES NÃO ENCONTRADOS NO PLANO DE CONTAS:');
    clientesNaoEncontrados.forEach(c => {
      console.log(`   - ${c.doc} | ${c.pagador} | R$ ${c.valor.toFixed(2)}`);
    });
    console.log('\n   AÇÃO: Criar contas em 1.1.2.01.xxx para esses clientes e re-executar.');
  }

  console.log('\n' + '═'.repeat(100));
}

main().catch(console.error);
