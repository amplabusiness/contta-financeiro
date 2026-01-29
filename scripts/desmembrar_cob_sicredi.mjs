/**
 * DESMEMBRAR COB SICREDI
 *
 * Este script converte os recebimentos consolidados do Sicredi em lançamentos
 * individuais por cliente no Razão do Banco.
 *
 * PROBLEMA:
 * O Sicredi deposita valores consolidados (ex: R$ 20.000) com descrição
 * "LIQ.COBRANCA SIMPLES-COB000009" sem detalhar quais clientes pagaram.
 *
 * SOLUÇÃO:
 * Usar a tabela boleto_payments para desmembrar cada COB em lançamentos
 * individuais por cliente.
 *
 * RESULTADO:
 * Ao invés de um lançamento "Recebimento R$ 20.000", teremos:
 * - Recebimento CLIENTE A: R$ 5.000
 * - Recebimento CLIENTE B: R$ 8.000
 * - Recebimento CLIENTE C: R$ 7.000
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Credenciais Supabase não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração
const CONFIG = {
  // Conta do Banco Sicredi
  CONTA_BANCO_SICREDI: '1.1.1.05',
  CONTA_BANCO_SICREDI_ID: null, // Será buscado

  // Conta Clientes a Receber
  CONTA_CLIENTES_RECEBER: '1.1.2.01',
  CONTA_CLIENTES_RECEBER_ID: null, // Será buscado

  // Período para processar (null = todos)
  ANO: 2025,
  MES: 2, // Fevereiro

  // Modo de execução
  DRY_RUN: true, // true = apenas simula, false = executa de verdade
};

async function main() {
  console.log('🏦 DESMEMBRAMENTO DE COB SICREDI');
  console.log('='.repeat(60));
  console.log(`📅 Período: ${CONFIG.MES.toString().padStart(2, '0')}/${CONFIG.ANO}`);
  console.log(`🔧 Modo: ${CONFIG.DRY_RUN ? 'SIMULAÇÃO (dry-run)' : '⚠️ EXECUÇÃO REAL'}`);
  console.log('');

  // 1. Buscar IDs das contas contábeis
  await buscarContasContabeis();

  // 2. Buscar transações COB do período
  const transacoesCOB = await buscarTransacoesCOB();

  if (transacoesCOB.length === 0) {
    console.log('ℹ️ Nenhuma transação COB encontrada para o período.');
    return;
  }

  console.log(`\n📊 Encontradas ${transacoesCOB.length} transações COB\n`);

  // 3. Processar cada COB
  let totalProcessado = 0;
  let totalLancamentos = 0;

  for (const transacao of transacoesCOB) {
    const resultado = await processarCOB(transacao);
    if (resultado) {
      totalProcessado++;
      totalLancamentos += resultado.lancamentos;
    }
  }

  // 4. Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📈 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log(`✅ COBs processados: ${totalProcessado}`);
  console.log(`📝 Lançamentos gerados: ${totalLancamentos}`);

  if (CONFIG.DRY_RUN) {
    console.log('\n⚠️ MODO SIMULAÇÃO - Nenhum dado foi gravado.');
    console.log('Para executar de verdade, altere CONFIG.DRY_RUN para false');
  }
}

async function buscarContasContabeis() {
  console.log('🔍 Buscando contas contábeis...');

  // Banco Sicredi
  const { data: banco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONFIG.CONTA_BANCO_SICREDI)
    .single();

  if (banco) {
    CONFIG.CONTA_BANCO_SICREDI_ID = banco.id;
    console.log(`   ✓ Banco Sicredi: ${banco.code} - ${banco.name}`);
  } else {
    throw new Error(`Conta ${CONFIG.CONTA_BANCO_SICREDI} não encontrada!`);
  }

  // Clientes a Receber
  const { data: clientes } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONFIG.CONTA_CLIENTES_RECEBER)
    .single();

  if (clientes) {
    CONFIG.CONTA_CLIENTES_RECEBER_ID = clientes.id;
    console.log(`   ✓ Clientes a Receber: ${clientes.code} - ${clientes.name}`);
  } else {
    throw new Error(`Conta ${CONFIG.CONTA_CLIENTES_RECEBER} não encontrada!`);
  }
}

async function buscarTransacoesCOB() {
  console.log('\n🔍 Buscando transações COB do Sicredi...');

  // Definir período
  const dataInicio = `${CONFIG.ANO}-${CONFIG.MES.toString().padStart(2, '0')}-01`;
  const dataFim = `${CONFIG.ANO}-${CONFIG.MES.toString().padStart(2, '0')}-28`;

  const { data, error } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, journal_entry_id')
    .ilike('description', '%LIQ.COBRANCA SIMPLES-COB%')
    .gte('transaction_date', dataInicio)
    .lte('transaction_date', dataFim)
    .order('transaction_date');

  if (error) {
    console.error('❌ Erro ao buscar transações:', error);
    return [];
  }

  return data || [];
}

async function processarCOB(transacao) {
  // Extrair código COB da descrição
  const matchCOB = transacao.description.match(/COB\d+/);
  if (!matchCOB) {
    console.log(`⚠️ Não foi possível extrair COB de: ${transacao.description}`);
    return null;
  }

  const codigoCOB = matchCOB[0];

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📦 ${codigoCOB} - ${transacao.transaction_date}`);
  console.log(`   Valor consolidado: R$ ${transacao.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Buscar boletos deste COB
  const { data: boletos, error } = await supabase
    .from('boleto_payments')
    .select(`
      id,
      nosso_numero,
      valor_liquidado,
      data_liquidacao,
      client_id,
      clients (id, name)
    `)
    .eq('cob', codigoCOB);

  if (error) {
    console.error(`   ❌ Erro ao buscar boletos: ${error.message}`);
    return null;
  }

  if (!boletos || boletos.length === 0) {
    console.log(`   ⚠️ Nenhum boleto encontrado para ${codigoCOB}`);
    return null;
  }

  // Calcular totais
  const totalBoletos = boletos.reduce((sum, b) => sum + (parseFloat(b.valor_liquidado) || 0), 0);
  const diferenca = Math.abs(transacao.amount - totalBoletos);

  console.log(`   Boletos encontrados: ${boletos.length}`);
  console.log(`   Total boletos: R$ ${totalBoletos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  if (diferenca > 0.01) {
    console.log(`   ⚠️ Diferença: R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  } else {
    console.log(`   ✓ Valores batem!`);
  }

  // Agrupar por cliente
  const porCliente = {};
  for (const boleto of boletos) {
    const clienteId = boleto.client_id;
    const clienteNome = boleto.clients?.name || 'CLIENTE NÃO IDENTIFICADO';

    if (!porCliente[clienteId]) {
      porCliente[clienteId] = {
        id: clienteId,
        nome: clienteNome,
        valor: 0,
        boletos: []
      };
    }

    porCliente[clienteId].valor += parseFloat(boleto.valor_liquidado) || 0;
    porCliente[clienteId].boletos.push(boleto.nosso_numero);
  }

  // Mostrar composição
  console.log(`\n   📋 COMPOSIÇÃO DO ${codigoCOB}:`);

  const clientes = Object.values(porCliente).sort((a, b) => b.valor - a.valor);

  for (const cliente of clientes) {
    const percentual = ((cliente.valor / totalBoletos) * 100).toFixed(1);
    console.log(`      • ${cliente.nome.substring(0, 40).padEnd(40)} R$ ${cliente.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} (${percentual}%)`);
  }

  // Criar lançamentos individuais
  if (!CONFIG.DRY_RUN) {
    await criarLancamentosIndividuais(transacao, clientes, codigoCOB);
  } else {
    console.log(`\n   🔄 [SIMULAÇÃO] Seriam criados ${clientes.length} lançamentos individuais`);
  }

  return {
    cob: codigoCOB,
    lancamentos: clientes.length
  };
}

async function criarLancamentosIndividuais(transacaoOriginal, clientes, codigoCOB) {
  console.log(`\n   📝 Criando lançamentos individuais...`);

  // Se já existe lançamento consolidado, deletar
  if (transacaoOriginal.journal_entry_id) {
    console.log(`   🗑️ Deletando lançamento consolidado anterior...`);

    // Deletar linhas do lançamento
    await supabase
      .from('accounting_entry_lines')
      .delete()
      .eq('entry_id', transacaoOriginal.journal_entry_id);

    // Deletar lançamento
    await supabase
      .from('accounting_entries')
      .delete()
      .eq('id', transacaoOriginal.journal_entry_id);

    // Limpar referência na transação
    await supabase
      .from('bank_transactions')
      .update({ journal_entry_id: null })
      .eq('id', transacaoOriginal.id);
  }

  // Criar um lançamento para cada cliente
  for (const cliente of clientes) {
    const descricao = `Recebimento ${cliente.nome} - ${codigoCOB}`;

    // Criar entry
    const { data: entry, error: entryError } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: transacaoOriginal.transaction_date,
        competence_date: transacaoOriginal.transaction_date,
        description: descricao,
        entry_type: 'recebimento',
        status: 'posted',
        reference_type: 'boleto_payment',
        source_type: 'boleto_cob',
        transaction_id: transacaoOriginal.id
      })
      .select()
      .single();

    if (entryError) {
      console.error(`   ❌ Erro ao criar lançamento para ${cliente.nome}: ${entryError.message}`);
      continue;
    }

    // Criar linhas (Débito Banco, Crédito Clientes a Receber)
    const linhas = [
      {
        entry_id: entry.id,
        account_id: CONFIG.CONTA_BANCO_SICREDI_ID,
        debit: cliente.valor,
        credit: 0,
        description: `D - Banco Sicredi - ${cliente.nome}`
      },
      {
        entry_id: entry.id,
        account_id: CONFIG.CONTA_CLIENTES_RECEBER_ID,
        debit: 0,
        credit: cliente.valor,
        description: `C - Clientes a Receber - ${cliente.nome}`
      }
    ];

    const { error: linhasError } = await supabase
      .from('accounting_entry_lines')
      .insert(linhas);

    if (linhasError) {
      console.error(`   ❌ Erro ao criar linhas para ${cliente.nome}: ${linhasError.message}`);
    } else {
      console.log(`   ✓ ${cliente.nome}: R$ ${cliente.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
  }
}

// Executar
main().catch(console.error);
