/**
 * RECRIAR ENTRIES PARA SAÍDAS SEM LANÇAMENTO - JANEIRO/2025
 *
 * Verifica todas as transações de saída e cria entries para as que não têm
 *
 * USO: node scripts/recriar_entries_saidas.mjs [--execute]
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

  // Salários e terceiros
  'JOSIMAR LUIZ': { conta: '4.1.1.01', nome: 'Salários e Ordenados', tipo: 'PAGAMENTO_SALARIO' },
  'JULIANA MARQUES': { conta: '4.1.1.01', nome: 'Salários e Ordenados', tipo: 'PAGAMENTO_SALARIO' },
  'MARIA APARECIDA': { conta: '4.1.1.01', nome: 'Salários e Ordenados', tipo: 'PAGAMENTO_SALARIO' },
  'LETICIA STEPHANY': { conta: '4.1.1.01', nome: 'Salários e Ordenados', tipo: 'PAGAMENTO_SALARIO' },
  'FABIANA MOTA': { conta: '4.1.1.01', nome: 'Salários e Ordenados', tipo: 'PAGAMENTO_SALARIO' },
  'CLAUDIA ALVES': { conta: '4.1.1.01', nome: 'Salários e Ordenados', tipo: 'PAGAMENTO_SALARIO' },
  'EMILIA BASILIO': { conta: '4.1.1.01', nome: 'Salários e Ordenados', tipo: 'PAGAMENTO_SALARIO' },
  'DANIEL RODRIGUES': { conta: '4.1.2.13.03', nome: 'Terceirizado Fiscal', tipo: 'PAGAMENTO_TERCEIRO' },
  'DANIELLE RODRIGU': { conta: '4.1.2.13.05', nome: 'Terceirizado Legalização', tipo: 'PAGAMENTO_TERCEIRO' },
  'FABRICIO SOARES': { conta: '4.1.2.13.03', nome: 'Terceirizado Fiscal', tipo: 'PAGAMENTO_TERCEIRO' },
  'ANDREA FERREIRA': { conta: '4.1.2.13.05', nome: 'Terceirizado Legalização', tipo: 'PAGAMENTO_TERCEIRO' },
  'CORACI ALINE': { conta: '4.1.2.13.01', nome: 'Terceirizado Pessoal', tipo: 'PAGAMENTO_TERCEIRO' },
  'ALEXSSANDRA FERREIRA': { conta: '4.1.2.13.03', nome: 'Terceirizado Fiscal', tipo: 'PAGAMENTO_TERCEIRO' },

  // Tarifas bancárias
  'MANUTENCAO DE TITULO': { conta: '4.1.3.02.01', nome: 'Manutenção de Títulos', tipo: 'DESPESA_BANCARIA' },
  'CESTA DE RELACIONAMENTO': { conta: '4.1.3.02.03', nome: 'Cesta de Relacionamento', tipo: 'DESPESA_BANCARIA' },
  'TARIFA': { conta: '4.1.3.02.99', nome: 'Outras Tarifas Bancárias', tipo: 'DESPESA_BANCARIA' },
};

// Conta transitória padrão para saídas não classificadas
const CONTA_TRANSITORIA_DEBITO = '1.1.9.01';

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

  return {
    conta: CONTA_TRANSITORIA_DEBITO,
    nome: 'Pendente de Classificação',
    tipo: 'PENDENTE_CLASSIFICACAO'
  };
}

async function main() {
  console.log('═'.repeat(100));
  console.log('RECRIAR ENTRIES PARA SAÍDAS SEM LANÇAMENTO - JANEIRO/2025');
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

  // Buscar TODAS as transações de saída de janeiro
  const { data: todasSaidas } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount')
    .eq('transaction_type', 'debit')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  // Buscar todos os entries vinculados a bank_transactions
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, reference_id')
    .eq('reference_type', 'bank_transaction')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const idsComEntry = new Set((entries || []).map(e => e.reference_id).filter(Boolean));

  // Encontrar transações SEM entry
  const semEntry = (todasSaidas || []).filter(tx => !idsComEntry.has(tx.id));

  console.log(`Total saídas do extrato: ${todasSaidas?.length || 0}`);
  console.log(`Com entry vinculado: ${idsComEntry.size}`);
  console.log(`SEM entry (a criar): ${semEntry.length}`);
  console.log('');

  if (semEntry.length === 0) {
    console.log('✅ Todas as transações de saída já têm entry vinculado');
    return;
  }

  // Calcular valor total
  let valorTotal = 0;
  for (const tx of semEntry) {
    valorTotal += Math.abs(parseFloat(tx.amount));
  }
  console.log(`Valor total a lançar: R$ ${valorTotal.toFixed(2)}`);
  console.log('');

  // Agrupar por classificação para resumo
  const porClassificacao = {};
  const lancamentos = [];

  for (const tx of semEntry) {
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
  console.log(`  TOTAL: ${lancamentos.length} lançamentos = R$ ${valorTotal.toFixed(2)}`);
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
      console.log(`   ❌ Conta ${classificacao.conta} não encontrada para: ${tx.description.substring(0, 40)}`);
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

    // Criar items (débito na conta destino e crédito no banco)
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
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      erros++;
      continue;
    }

    criados++;
  }

  console.log('');
  console.log(`✅ Criados: ${criados} lançamentos`);
  if (erros > 0) {
    console.log(`❌ Erros: ${erros}`);
  }

  // Verificação final
  await verificarSaldo(contaBanco.id);
}

async function verificarSaldo(contaSicrediId) {
  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, entry:accounting_entries(entry_date)')
    .eq('account_id', contaSicrediId);

  let saldoAbertura = 0;
  let debitosJan = 0;
  let creditosJan = 0;

  for (const item of items || []) {
    const data = item.entry?.entry_date;
    const debito = parseFloat(item.debit || 0);
    const credito = parseFloat(item.credit || 0);

    if (data && data <= '2024-12-31') {
      saldoAbertura += debito - credito;
    } else if (data && data >= '2025-01-01' && data <= '2025-01-31') {
      debitosJan += debito;
      creditosJan += credito;
    }
  }

  console.log('');
  console.log('═'.repeat(100));
  console.log('VERIFICAÇÃO FINAL - SALDO BANCO SICREDI');
  console.log('═'.repeat(100));
  console.log('');
  console.log('Saldo de abertura (31/12/2024): R$', saldoAbertura.toFixed(2));
  console.log('Débitos Janeiro/2025:           R$', debitosJan.toFixed(2));
  console.log('Créditos Janeiro/2025:          R$', creditosJan.toFixed(2));
  console.log('Saldo Final (31/01/2025):       R$', (saldoAbertura + debitosJan - creditosJan).toFixed(2));
  console.log('');

  // Conferência com extrato
  const { data: extrato } = await supabase
    .from('bank_transactions')
    .select('amount, transaction_type')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  let bancoEntradas = 0;
  let bancoSaidas = 0;
  for (const tx of extrato || []) {
    const valor = Math.abs(parseFloat(tx.amount));
    if (tx.transaction_type === 'credit') bancoEntradas += valor;
    else bancoSaidas += valor;
  }

  console.log('CONFERÊNCIA COM EXTRATO:');
  console.log('  Extrato - Entradas: R$', bancoEntradas.toFixed(2));
  console.log('  Contab  - Débitos:  R$', debitosJan.toFixed(2));
  console.log('  Diferença:          R$', (bancoEntradas - debitosJan).toFixed(2));
  console.log('');
  console.log('  Extrato - Saídas:   R$', bancoSaidas.toFixed(2));
  console.log('  Contab  - Créditos: R$', creditosJan.toFixed(2));
  console.log('  Diferença:          R$', (bancoSaidas - creditosJan).toFixed(2));

  if (Math.abs(bancoEntradas - debitosJan) < 0.01 && Math.abs(bancoSaidas - creditosJan) < 0.01) {
    console.log('');
    console.log('✅ BANCO E CONTABILIDADE ESTÃO BATENDO PERFEITAMENTE!');
  }
}

main().catch(console.error);
