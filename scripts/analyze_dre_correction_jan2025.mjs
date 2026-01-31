/**
 * ============================================================================
 * SCRIPT DE CORREÇÃO DRE JANEIRO/2025
 * ============================================================================
 * 
 * Objetivo: Identificar e corrigir lançamentos onde PIX foi classificado 
 * erroneamente como Receita.
 * 
 * PROBLEMA:
 * - DRE atual mostra ~R$ 600.000 em Receita
 * - Deveria ser ~R$ 136.000 (baseado no cadastro de honorários)
 * 
 * CAUSA:
 * - PIX gerando receita automaticamente
 * - Empréstimos de sócios classificados como receita
 * - Aportes classificados como receita
 * 
 * SOLUÇÃO:
 * - Identificar lançamentos problemáticos
 * - Propor reclassificação
 * - Aguardar aprovação Dr. Cícero
 * 
 * @author Dr. Cícero / Dev Team
 * @date 30/01/2026
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://xsrirnfwsjeovvlwgsgt.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421'; // Ampla

// Contas importantes
const CONTAS = {
  RECEITA_HONORARIOS: '3.1.1.01',
  CLIENTES_A_RECEBER: '1.1.2.01',
  EMPRESTIMOS_SOCIOS: '2.1.2.03',
  ADIANTAMENTO_CAPITAL: '2.4.1.01',
  BANCO_SICREDI: '1.1.1.05',
  TRANSITORIA_CREDITOS: '2.1.9.01',
  TRANSITORIA_DEBITOS: '1.1.9.01'
};

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('           ANÁLISE DRE JANEIRO/2025 - CORREÇÃO PIX/RECEITA         ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // =========================================================================
  // PASSO 1: Valor esperado de Receita (cadastro de honorários)
  // =========================================================================
  console.log('📊 PASSO 1: Verificando valor esperado de honorários (cadastro)');
  console.log('─────────────────────────────────────────────────────────────────');

  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('id, amount, client_id, competence, status, clients(name)')
    .eq('tenant_id', TENANT_ID)
    .ilike('competence', '%01/2025%');

  if (invError) {
    console.error('Erro ao buscar invoices:', invError);
    return;
  }

  const totalHonorarios = invoices?.reduce((sum, inv) => sum + Number(inv.amount || 0), 0) || 0;
  console.log(`Total de Faturas Jan/2025: ${invoices?.length || 0}`);
  console.log(`Valor Total Esperado: R$ ${totalHonorarios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log('');

  // =========================================================================
  // PASSO 2: Valor atual na DRE (conta de Receita)
  // =========================================================================
  console.log('📊 PASSO 2: Verificando valor atual na conta de Receita');
  console.log('─────────────────────────────────────────────────────────────────');

  const { data: receitaAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', CONTAS.RECEITA_HONORARIOS)
    .eq('tenant_id', TENANT_ID)
    .single();

  if (!receitaAccount) {
    console.error('Conta de Receita de Honorários não encontrada!');
    return;
  }

  // Buscar lançamentos em Receita em Janeiro/2025
  const { data: receitaEntries } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit, description,
      accounting_entries!inner(id, entry_date, description, source_type, internal_code, reference_type)
    `)
    .eq('account_id', receitaAccount.id)
    .eq('tenant_id', TENANT_ID)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  const totalReceitaDRE = receitaEntries?.reduce((sum, e) => sum + Number(e.credit || 0), 0) || 0;
  console.log(`Total em 3.1.1.01 (Receita Honorários): R$ ${totalReceitaDRE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Diferença (DRE - Esperado): R$ ${(totalReceitaDRE - totalHonorarios).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log('');

  // =========================================================================
  // PASSO 3: Identificar lançamentos problemáticos
  // =========================================================================
  console.log('🔍 PASSO 3: Identificando lançamentos problemáticos');
  console.log('─────────────────────────────────────────────────────────────────');

  // Lançamentos que NÃO vieram de invoice (possíveis PIX diretos)
  const problemEntries = receitaEntries?.filter(e => {
    const sourceType = e.accounting_entries?.source_type;
    const refType = e.accounting_entries?.reference_type;
    
    // Problemáticos: não são de invoice E não são de honorários provisionados
    return sourceType !== 'invoice' && 
           refType !== 'invoice' &&
           !e.accounting_entries?.description?.toLowerCase().includes('provisão');
  }) || [];

  console.log(`Lançamentos suspeitos (não vieram de invoice): ${problemEntries.length}`);
  console.log('');

  // Agrupar por origem
  const porOrigem = {};
  problemEntries.forEach(e => {
    const key = e.accounting_entries?.source_type || 'unknown';
    if (!porOrigem[key]) porOrigem[key] = { count: 0, total: 0, entries: [] };
    porOrigem[key].count++;
    porOrigem[key].total += Number(e.credit || 0);
    porOrigem[key].entries.push(e);
  });

  console.log('Por origem:');
  Object.entries(porOrigem).forEach(([origem, data]) => {
    console.log(`  ${origem}: ${data.count} lançamentos = R$ ${data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  });
  console.log('');

  // =========================================================================
  // PASSO 4: Listar lançamentos para correção
  // =========================================================================
  console.log('📋 PASSO 4: Lançamentos que precisam de correção');
  console.log('─────────────────────────────────────────────────────────────────');

  // Buscar PIX de alto valor (possíveis empréstimos/aportes)
  const { data: bankTxAltoValor } = await supabase
    .from('bank_transactions')
    .select('id, amount, description, transaction_date, matched, journal_entry_id')
    .eq('tenant_id', TENANT_ID)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .gt('amount', 0) // Entradas
    .gte('amount', 10000) // Alto valor
    .order('amount', { ascending: false });

  console.log('\nTransações de ENTRADA com valor >= R$ 10.000:');
  console.log('(Possíveis empréstimos/aportes classificados erroneamente como receita)');
  console.log('');

  bankTxAltoValor?.forEach(tx => {
    const status = tx.matched ? '✅ Conciliado' : '⚠️ Pendente';
    console.log(`  ${status} | ${tx.transaction_date} | R$ ${Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | ${tx.description?.substring(0, 50)}`);
  });

  // =========================================================================
  // PASSO 5: Gerar relatório de ações necessárias
  // =========================================================================
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('              AÇÕES NECESSÁRIAS (Dr. Cícero aprovar)               ');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const diferencaTotal = totalReceitaDRE - totalHonorarios;
  
  if (diferencaTotal > 1000) {
    console.log('⚠️ PROBLEMA IDENTIFICADO:');
    console.log(`   DRE atual: R$ ${totalReceitaDRE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Esperado:  R$ ${totalHonorarios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Diferença: R$ ${diferencaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log('');
    console.log('📌 AÇÕES RECOMENDADAS:');
    console.log('');
    console.log('   1. RECLASSIFICAR entradas que não são honorários:');
    console.log('      - Empréstimos de sócios → 2.1.2.03 (Passivo)');
    console.log('      - Aportes → 2.4.1.01 (Adiant. Futuro Aumento Capital)');
    console.log('      - Transferências internas → 1.1.1.xx (outra conta bancária)');
    console.log('');
    console.log('   2. ESTORNAR lançamentos de PIX → Receita');
    console.log('      - Criar estorno: D Receita / C Transitória');
    console.log('      - Criar classificação correta: D Transitória / C [Conta Correta]');
    console.log('');
    console.log('   3. VERIFICAR se todas as faturas têm lançamento contábil');
    console.log('      - Cada invoice deve ter: D Cliente / C Receita');
    console.log('');
  } else {
    console.log('✅ DRE aparentemente correta!');
    console.log(`   Diferença de apenas R$ ${Math.abs(diferencaTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (aceitável)`);
  }

  // =========================================================================
  // PASSO 6: Gerar arquivo JSON com correções propostas
  // =========================================================================
  const correcoesPropostas = {
    data_analise: new Date().toISOString(),
    periodo: '01/2025',
    resumo: {
      dre_atual: totalReceitaDRE,
      esperado: totalHonorarios,
      diferenca: diferencaTotal
    },
    lancamentos_suspeitos: problemEntries.map(e => ({
      entry_id: e.accounting_entries?.id,
      internal_code: e.accounting_entries?.internal_code,
      valor: Number(e.credit || 0),
      descricao: e.accounting_entries?.description,
      source_type: e.accounting_entries?.source_type
    })),
    transacoes_alto_valor: bankTxAltoValor?.map(tx => ({
      id: tx.id,
      valor: Number(tx.amount),
      descricao: tx.description,
      data: tx.transaction_date,
      conciliado: tx.matched
    })) || []
  };

  console.log('\n');
  console.log('📄 Arquivo de correções propostas gerado:');
  console.log(JSON.stringify(correcoesPropostas, null, 2));

  // Salvar arquivo
  const fs = await import('fs');
  fs.writeFileSync(
    '_correcao_dre_jan2025.json',
    JSON.stringify(correcoesPropostas, null, 2)
  );
  console.log('\n✅ Arquivo salvo: _correcao_dre_jan2025.json');
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('      AGUARDANDO APROVAÇÃO DO DR. CÍCERO PARA EXECUTAR CORREÇÕES   ');
  console.log('═══════════════════════════════════════════════════════════════════');
}

main().catch(console.error);
