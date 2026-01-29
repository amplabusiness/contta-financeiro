/**
 * LANÇAR SAÍDAS PENDENTES - JANEIRO/2025
 *
 * Cria lançamentos contábeis para todas as transações de saída pendentes
 * Usa contas transitórias para classificação posterior
 *
 * Regra: Saída do banco = Crédito Banco + Débito na conta destino
 *
 * USO: node scripts/lancar_saidas_pendentes.mjs [--execute]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTAR = process.argv.includes('--execute');

// Mapeamento de classificação automática
const CLASSIFICACAO = {
  // Adiantamentos a sócios
  'SERGIO CARNEIRO LEAO': { conta: '1.1.3.01.01', nome: 'Adiant. Sergio Carneiro Leao', tipo: 'ADIANTAMENTO_SOCIO' },
  'SERGIO CARNEIRO': { conta: '1.1.3.01.01', nome: 'Adiant. Sergio Carneiro Leao', tipo: 'ADIANTAMENTO_SOCIO' },
  'NAYARA CRISTINA': { conta: '1.1.3.01.02', nome: 'Adiant. Nayara', tipo: 'ADIANTAMENTO_SOCIO' },
  'NAYARA': { conta: '1.1.3.01.02', nome: 'Adiant. Nayara', tipo: 'ADIANTAMENTO_SOCIO' },
  'VICTOR HUGO': { conta: '1.1.3.01.03', nome: 'Adiant. Victor Hugo', tipo: 'ADIANTAMENTO_SOCIO' },
  'SERGIO AUGUSTO': { conta: '1.1.3.01.04', nome: 'Adiant. Sergio Augusto', tipo: 'ADIANTAMENTO_SOCIO' },
  'AMPLA CONTABIL': { conta: '1.1.3.01.05', nome: 'Adiant. Socios via Empresa', tipo: 'ADIANTAMENTO_SOCIO' },

  // Despesas conhecidas
  'DETRAN': { conta: '4.1.2.07', nome: 'Taxas e Licenças', tipo: 'DESPESA_CLASSIFICADA' },
  'DEPARTAMENTO ESTADUAL': { conta: '4.1.2.07', nome: 'Taxas e Licenças', tipo: 'DESPESA_CLASSIFICADA' },
  'PMGO': { conta: '4.1.2.07', nome: 'Taxas e Licenças (PMGO)', tipo: 'DESPESA_CLASSIFICADA' },
  'FACULDADE': { conta: '4.1.2.99', nome: 'Outras Despesas', tipo: 'DESPESA_CLASSIFICADA' },
  'PJBANK': { conta: '4.1.3.02.99', nome: 'Outras Tarifas Bancárias', tipo: 'DESPESA_BANCARIA' },
  'ADV SYS': { conta: '4.1.2.09', nome: 'Softwares e Sistemas', tipo: 'DESPESA_CLASSIFICADA' },
  'MUNDI CONSULTORIA': { conta: '4.1.2.09', nome: 'Softwares e Sistemas', tipo: 'DESPESA_CLASSIFICADA' },
  'OBJETIVA': { conta: '4.1.2.09', nome: 'Softwares e Sistemas', tipo: 'DESPESA_CLASSIFICADA' },
};

// Conta transitória padrão para saídas não classificadas
const CONTA_TRANSITORIA_DEBITO = '1.1.9.01'; // Pendente de Classificação - Débitos

async function buscarConta(code) {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .single();
  return data;
}

function classificarTransacao(descricao) {
  const descUpper = descricao.toUpperCase();

  for (const [chave, config] of Object.entries(CLASSIFICACAO)) {
    if (descUpper.includes(chave.toUpperCase())) {
      return config;
    }
  }

  // Se não encontrou classificação, usa conta transitória
  return {
    conta: CONTA_TRANSITORIA_DEBITO,
    nome: 'Pendente de Classificação',
    tipo: 'PENDENTE_CLASSIFICACAO'
  };
}

async function main() {
  console.log('═'.repeat(100));
  console.log('LANÇAR SAÍDAS PENDENTES - JANEIRO/2025');
  console.log('═'.repeat(100));
  console.log('');

  if (!EXECUTAR) {
    console.log('🔍 MODO SIMULAÇÃO - Use --execute para criar os lançamentos');
    console.log('');
  }

  // Buscar conta Banco Sicredi
  const contaBanco = await buscarConta('1.1.1.05');
  if (!contaBanco) {
    console.log('❌ Conta Banco Sicredi não encontrada');
    return;
  }

  // Buscar transações de saída pendentes
  const { data: pendentes } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount')
    .eq('transaction_type', 'debit')
    .eq('status', 'pending')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  console.log(`Transações pendentes encontradas: ${pendentes?.length || 0}`);
  console.log('');

  // Agrupar por classificação para resumo
  const porClassificacao = {};
  const lancamentos = [];

  for (const tx of pendentes || []) {
    const classificacao = classificarTransacao(tx.description);
    const valor = Math.abs(parseFloat(tx.amount));

    if (!porClassificacao[classificacao.tipo]) {
      porClassificacao[classificacao.tipo] = { count: 0, valor: 0, conta: classificacao.conta };
    }
    porClassificacao[classificacao.tipo].count++;
    porClassificacao[classificacao.tipo].valor += valor;

    lancamentos.push({
      tx,
      classificacao,
      valor
    });
  }

  console.log('RESUMO POR CLASSIFICAÇÃO:');
  console.log('-'.repeat(80));
  for (const [tipo, dados] of Object.entries(porClassificacao).sort((a, b) => b[1].valor - a[1].valor)) {
    console.log(`  ${tipo.padEnd(30)} ${String(dados.count).padStart(3)} lanç  R$ ${dados.valor.toFixed(2).padStart(12)}  (${dados.conta})`);
  }
  console.log('-'.repeat(80));
  console.log(`  TOTAL: ${lancamentos.length} lançamentos`);
  console.log('');

  if (!EXECUTAR) {
    console.log('⚠️  SIMULAÇÃO - Nenhum lançamento foi criado');
    console.log('   Execute com --execute para criar os lançamentos');
    return;
  }

  // Cache de contas
  const cacheContas = { '1.1.1.05': contaBanco };

  // Criar lançamentos
  console.log('Criando lançamentos...');
  console.log('');

  let criados = 0;
  let erros = 0;

  for (const { tx, classificacao, valor } of lancamentos) {
    // Buscar conta de débito
    if (!cacheContas[classificacao.conta]) {
      cacheContas[classificacao.conta] = await buscarConta(classificacao.conta);
    }
    const contaDebito = cacheContas[classificacao.conta];

    if (!contaDebito) {
      console.log(`   ❌ Conta ${classificacao.conta} não encontrada`);
      erros++;
      continue;
    }

    // Criar entry
    const { data: entry, error: entryError } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: tx.transaction_date,
        competence_date: tx.transaction_date,
        description: tx.description,
        entry_type: classificacao.tipo,
        is_draft: false,
        reference_type: 'bank_transaction',
        reference_id: tx.id
      })
      .select()
      .single();

    if (entryError) {
      console.log(`   ❌ Erro ao criar entry: ${entryError.message}`);
      erros++;
      continue;
    }

    // Criar items (débito e crédito)
    const { error: itemsError } = await supabase
      .from('accounting_entry_items')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaDebito.id,
          debit: valor,
          credit: 0,
          history: classificacao.nome
        },
        {
          entry_id: entry.id,
          account_id: contaBanco.id,
          debit: 0,
          credit: valor,
          history: `Saída banco - ${tx.description.substring(0, 50)}`
        }
      ]);

    if (itemsError) {
      console.log(`   ❌ Erro ao criar items: ${itemsError.message}`);
      // Remover entry órfão
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      erros++;
      continue;
    }

    // Atualizar status da transação
    await supabase
      .from('bank_transactions')
      .update({ status: 'reconciled', journal_entry_id: entry.id })
      .eq('id', tx.id);

    criados++;
  }

  console.log('');
  console.log(`✅ Criados: ${criados} lançamentos`);
  if (erros > 0) {
    console.log(`❌ Erros: ${erros}`);
  }

  // Verificação final
  console.log('');
  console.log('═'.repeat(100));
  console.log('VERIFICAÇÃO FINAL');
  console.log('═'.repeat(100));

  // Recalcular
  const { data: extratoFinal } = await supabase
    .from('bank_transactions')
    .select('amount, transaction_type')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  let bancoEntradas = 0;
  let bancoSaidas = 0;
  for (const tx of extratoFinal || []) {
    const valor = Math.abs(parseFloat(tx.amount));
    if (tx.transaction_type === 'credit') bancoEntradas += valor;
    else bancoSaidas += valor;
  }

  const { data: razaoFinal } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, entry:accounting_entries!inner(entry_date)')
    .eq('account_id', contaBanco.id);

  const razaoJanFinal = (razaoFinal || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  let contabilDebitos = 0;
  let contabilCreditos = 0;
  for (const item of razaoJanFinal) {
    contabilDebitos += parseFloat(item.debit) || 0;
    contabilCreditos += parseFloat(item.credit) || 0;
  }

  console.log('');
  console.log('EXTRATO BANCÁRIO:');
  console.log(`  Entradas: R$ ${bancoEntradas.toFixed(2)}`);
  console.log(`  Saídas:   R$ ${bancoSaidas.toFixed(2)}`);
  console.log('');
  console.log('CONTABILIDADE:');
  console.log(`  Débitos (entradas):  R$ ${contabilDebitos.toFixed(2)}`);
  console.log(`  Créditos (saídas):   R$ ${contabilCreditos.toFixed(2)}`);
  console.log('');

  const difEntradas = Math.abs(bancoEntradas - contabilDebitos);
  const difSaidas = Math.abs(bancoSaidas - contabilCreditos);

  if (difEntradas < 0.01 && difSaidas < 0.01) {
    console.log('✅ BANCO E CONTABILIDADE ESTÃO BATENDO PERFEITAMENTE!');
  } else {
    console.log('⚠️  Ainda há diferenças:');
    console.log(`   Entradas: R$ ${(bancoEntradas - contabilDebitos).toFixed(2)}`);
    console.log(`   Saídas:   R$ ${(bancoSaidas - contabilCreditos).toFixed(2)}`);
  }
}

main().catch(console.error);
