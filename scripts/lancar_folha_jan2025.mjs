/**
 * LANÇAR FOLHA DE PAGAMENTO - JANEIRO/2025
 * Regime de Caixa: Débito Despesa / Crédito Banco
 *
 * CLT: Adiantamento (dia 14/15) + Pagamento (dia 29/30)
 * PJ: Pagamento (dia 10)
 *
 * USO: node scripts/lancar_folha_jan2025.mjs [--execute]
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

// Funcionários CLT da Ampla com departamento
// Nomes completos extraídos das transações bancárias
const FUNCIONARIOS_CLT = [
  { nome: 'JOSIMAR DOS SANTOS MOTA', departamento: 'Administrativo', conta: '4.1.1.01.01' },
  { nome: 'ROSEMEIRE RODRIGUES', departamento: 'Contábil', conta: '4.1.1.01.01' },
  { nome: 'Taylane Belle Ferreira Saraiva', departamento: 'Fiscal', conta: '4.1.1.01.01' },
  { nome: 'Lilian Moreira da Costa', departamento: 'Pessoal', conta: '4.1.1.01.01' },
  { nome: 'Fabiana Maria da silva', departamento: 'Pessoal', conta: '4.1.1.01.01' },
  { nome: 'DEUZA RESENDE DE JESUS', departamento: 'Serviços Gerais', conta: '4.1.1.01.01' },
  { nome: 'Thaynara Concei', departamento: 'Fiscal', conta: '4.1.1.01.01' }
];

// Terceirizados PJ - Contas analíticas por departamento
// Nomes completos extraídos das transações bancárias
// NOTA: DANIELLE RODRIGUES é a filha de SUELI AMARAL (Legalização) - recebe por ela
const TERCEIRIZADOS = [
  { nome: 'DANIEL RODRIGUES RIBEIRO', departamento: 'Fiscal (Terceirizado)', conta: '4.1.2.13.03' },
  { nome: 'FABRICIO SOARES BOMFIM', departamento: 'Fiscal (Terceirizado)', conta: '4.1.2.13.03' },
  { nome: 'ANDREA FERREIRA FAGUNDES', departamento: 'Legalização (Terceirizado)', conta: '4.1.2.13.05' },
  { nome: 'ANDREA LEONE BASTOS', departamento: 'Andrea Leone (Terceirizado)', conta: '4.1.2.13.09' },
  { nome: 'CORACI ALINE DOS SANTOS', departamento: 'Pessoal (Terceirizado)', conta: '4.1.2.13.01' },
  { nome: 'ALEXSSANDRA FERREIRA RAMOS', departamento: 'Fiscal (Terceirizado)', conta: '4.1.2.13.03' },
  { nome: 'DANIELLE RODRIGU', departamento: 'Sueli Amaral - Legalização (Terceirizado)', conta: '4.1.2.13.05' }
];

async function buscarConta(code) {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .single();
  return data;
}

async function buscarTransacoesFuncionario(nome, mesAno = '2025-01') {
  const inicioMes = `${mesAno}-01`;
  const fimMes = `${mesAno}-31`;

  const { data } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, status, journal_entry_id')
    .gte('transaction_date', inicioMes)
    .lte('transaction_date', fimMes)
    .ilike('description', `%${nome}%`)
    .eq('transaction_type', 'debit')
    .order('transaction_date');

  return data || [];
}

async function criarLancamento(tx, funcionario, contaDespesa, contaBanco) {
  const valor = Math.abs(parseFloat(tx.amount));
  const dia = new Date(tx.transaction_date).getDate();

  let tipoLancamento = 'PAGAMENTO_SALARIO';
  if (dia >= 14 && dia <= 15) {
    tipoLancamento = 'ADIANTAMENTO_SALARIO';
  }

  const descricao = `${funcionario.nome} - ${funcionario.departamento}: ${tx.description.substring(0, 50)}`;

  console.log(`   ${tx.transaction_date} | R$ ${valor.toFixed(2).padStart(10)} | ${tipoLancamento}`);
  console.log(`      D: ${contaDespesa.code} - ${contaDespesa.name}`);
  console.log(`      C: ${contaBanco.code} - ${contaBanco.name}`);

  if (!EXECUTAR) {
    return { simulado: true };
  }

  // Criar entry
  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: tx.transaction_date,
      competence_date: tx.transaction_date,
      description: descricao,
      entry_type: tipoLancamento,
      is_draft: false,
      reference_type: 'bank_transaction',
      reference_id: tx.id
    })
    .select()
    .single();

  if (entryError) {
    console.log(`      ❌ Erro ao criar entry: ${entryError.message}`);
    return { erro: entryError.message };
  }

  // Criar items (débito e crédito)
  const { error: itemsError } = await supabase
    .from('accounting_entry_items')
    .insert([
      {
        entry_id: entry.id,
        account_id: contaDespesa.id,
        debit: valor,
        credit: 0,
        history: `${funcionario.nome} - ${funcionario.departamento}`
      },
      {
        entry_id: entry.id,
        account_id: contaBanco.id,
        debit: 0,
        credit: valor,
        history: `Pagamento ${funcionario.nome}`
      }
    ]);

  if (itemsError) {
    console.log(`      ❌ Erro ao criar items: ${itemsError.message}`);
    return { erro: itemsError.message };
  }

  // Atualizar transação bancária
  await supabase
    .from('bank_transactions')
    .update({
      status: 'reconciled',
      journal_entry_id: entry.id
    })
    .eq('id', tx.id);

  console.log(`      ✅ Lançamento criado: ${entry.id.substring(0, 8)}...`);
  return { sucesso: true, entry_id: entry.id };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('LANÇAR FOLHA DE PAGAMENTO - JANEIRO/2025');
  console.log('Regime de Caixa: D: Despesa Pessoal / C: Banco');
  console.log('═'.repeat(80));
  console.log('');

  if (!EXECUTAR) {
    console.log('🔍 MODO SIMULAÇÃO - Use --execute para criar os lançamentos');
    console.log('');
  }

  // Buscar conta do banco
  const contaBanco = await buscarConta('1.1.1.05');
  if (!contaBanco) {
    console.log('❌ Conta 1.1.1.05 (Banco Sicredi) não encontrada!');
    return;
  }

  let totalLancamentos = 0;
  let totalValor = 0;

  // 1. Processar CLT
  console.log('═'.repeat(80));
  console.log('FUNCIONÁRIOS CLT:');
  console.log('═'.repeat(80));

  for (const func of FUNCIONARIOS_CLT) {
    const contaDespesa = await buscarConta(func.conta);
    if (!contaDespesa) {
      console.log(`❌ Conta ${func.conta} não encontrada para ${func.nome}`);
      continue;
    }

    const txs = await buscarTransacoesFuncionario(func.nome);

    // Filtrar apenas transações pending (não processadas)
    const txsPendentes = txs.filter(tx => tx.status === 'pending' && !tx.journal_entry_id);

    if (txsPendentes.length === 0) {
      console.log(`\n👤 ${func.nome} (${func.departamento}): Nenhuma transação pendente`);
      continue;
    }

    console.log(`\n👤 ${func.nome} (${func.departamento}):`);

    for (const tx of txsPendentes) {
      const resultado = await criarLancamento(tx, func, contaDespesa, contaBanco);
      if (resultado.sucesso || resultado.simulado) {
        totalLancamentos++;
        totalValor += Math.abs(parseFloat(tx.amount));
      }
    }
  }

  // 2. Processar Terceirizados
  console.log('');
  console.log('═'.repeat(80));
  console.log('TERCEIRIZADOS (PJ):');
  console.log('═'.repeat(80));

  for (const terc of TERCEIRIZADOS) {
    // Buscar conta analítica específica do terceirizado
    const contaDespesa = await buscarConta(terc.conta);
    if (!contaDespesa) {
      console.log(`❌ Conta ${terc.conta} não encontrada para ${terc.nome}`);
      continue;
    }

    const txs = await buscarTransacoesFuncionario(terc.nome);
    const txsPendentes = txs.filter(tx => tx.status === 'pending' && !tx.journal_entry_id);

    if (txsPendentes.length === 0) {
      console.log(`\n📋 ${terc.nome} (${terc.departamento}): Nenhuma transação pendente`);
      continue;
    }

    console.log(`\n📋 ${terc.nome} (${terc.departamento}):`);

    for (const tx of txsPendentes) {
      const resultado = await criarLancamento(tx, terc, contaDespesa, contaBanco);
      if (resultado.sucesso || resultado.simulado) {
        totalLancamentos++;
        totalValor += Math.abs(parseFloat(tx.amount));
      }
    }
  }

  // Resumo
  console.log('');
  console.log('═'.repeat(80));
  console.log('RESUMO:');
  console.log('═'.repeat(80));
  console.log(`Total de lançamentos: ${totalLancamentos}`);
  console.log(`Valor total: R$ ${totalValor.toFixed(2)}`);
  console.log('');

  if (!EXECUTAR) {
    console.log('⚠️  SIMULAÇÃO - Nenhum lançamento foi criado');
    console.log('   Execute com --execute para criar os lançamentos');
  } else {
    console.log('✅ Lançamentos criados com sucesso!');
  }
}

main().catch(console.error);
