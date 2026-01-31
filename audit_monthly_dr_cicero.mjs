/**
 * AUDITORIA AUTOMÁTICA MENSAL — DR. CÍCERO
 * 
 * Script para verificação automatizada de integridade contábil
 * Executar: node audit_monthly_dr_cicero.mjs 2025 01
 * 
 * VERSÃO 2.0 — Usa RPC para evitar limite de paginação da API
 * 
 * @author Contta Financeiro
 * @version 2.0
 * @date 31/01/2026
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// Pegar ano e mês dos argumentos
const args = process.argv.slice(2);
const ano = args[0] || new Date().getFullYear();
const mes = args[1] || String(new Date().getMonth() + 1).padStart(2, '0');

const dataInicio = `${ano}-${mes}-01`;
const dataFim = new Date(ano, parseInt(mes), 0).toISOString().split('T')[0];

async function executarAuditoria() {
  const protocolo = `AUD-${ano}${mes}-${Date.now().toString(36).toUpperCase()}`;
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     AUDITORIA AUTOMÁTICA MENSAL — DR. CÍCERO                 ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Protocolo: ${protocolo.padEnd(46)}║`);
  console.log(`║  Período:   ${mes}/${ano}                                          ║`);
  console.log(`║  Data:      ${new Date().toLocaleDateString('pt-BR').padEnd(46)}║`);
  console.log(`║  Método:    RPC (sem limite de paginação)                     ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  const resultados = {
    protocolo,
    periodo: `${mes}/${ano}`,
    dataExecucao: new Date().toISOString(),
    metodo: 'RPC',
    verificacoes: {}
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TENTAR USAR RPC (FUNÇÃO audit_monthly_complete)
  // ═══════════════════════════════════════════════════════════════════════════
  const { data: rpcData, error: rpcError } = await supabase.rpc('audit_monthly_complete', {
    p_tenant: TENANT_ID,
    p_start: dataInicio,
    p_end: dataFim
  });
  
  if (!rpcError && rpcData && rpcData.length > 0) {
    // RPC disponível - usar resultados diretos
    console.log('');
    console.log('  Usando RPC audit_monthly_complete (fonte única de verdade)');
    console.log('');
    
    for (const row of rpcData) {
      const icon = row.status === '✅' ? '✅' : row.status === '❌' ? '❌' : row.status === '⚠️' ? '⚠️' : '  ';
      console.log(`  ${row.verificacao.padEnd(30)} ${row.valor.padStart(20)} ${icon}`);
      
      // Mapear para resultados
      if (row.verificacao.includes('órfãs')) resultados.verificacoes.transacoesOrfas = parseInt(row.valor) || 0;
      if (row.verificacao.includes('Débitos') && !row.verificacao.includes('Transitória')) resultados.verificacoes.totalDebitos = parseFloat(row.valor.replace(/\./g, '').replace(',', '.')) || 0;
      if (row.verificacao.includes('Créditos') && !row.verificacao.includes('Transitória')) resultados.verificacoes.totalCreditos = parseFloat(row.valor.replace(/\./g, '').replace(',', '.')) || 0;
      if (row.verificacao.includes('Diferença')) resultados.verificacoes.diferenca = parseFloat(row.valor.replace(/\./g, '').replace(',', '.')) || 0;
      if (row.verificacao.includes('Desbalanceados')) resultados.verificacoes.desbalanceados = parseInt(row.valor) || 0;
      if (row.verificacao === 'STATUS FINAL') resultados.status = row.valor;
    }
    
    const aprovado = resultados.status === 'APROVADO';
    resultados.aprovado = aprovado;
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    if (aprovado) {
      console.log('║  ✅ STATUS: APROVADO PARA FECHAMENTO                         ║');
    } else {
      console.log('║  ⚠️  STATUS: PENDENTE — VERIFICAR ITENS ACIMA                 ║');
    }
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    
    return resultados;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK: USAR QUERIES INDIVIDUAIS COM RPC
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('  RPC não disponível, usando queries com RPC individual...');
  
  // 1. Transações órfãs (via RPC)
  const { data: orphansData } = await supabase.rpc('audit_count_orphan_transactions', {
    p_tenant: TENANT_ID,
    p_start: dataInicio,
    p_end: dataFim
  });
  const transacoesOrfas = orphansData ?? 0;
  resultados.verificacoes.transacoesOrfas = transacoesOrfas;
  console.log('');
  console.log('  [1] Transações bancárias sem lançamento:', transacoesOrfas, transacoesOrfas === 0 ? '✅' : '❌');
  
  // 2. Partidas dobradas (via RPC)
  const { data: totalsData } = await supabase.rpc('audit_totals_month', {
    p_tenant: TENANT_ID,
    p_start: dataInicio,
    p_end: dataFim
  });
  
  const totalDebitos = totalsData?.[0]?.total_debit || 0;
  const totalCreditos = totalsData?.[0]?.total_credit || 0;
  const diferenca = totalsData?.[0]?.difference || 0;
  
  resultados.verificacoes.totalDebitos = totalDebitos;
  resultados.verificacoes.totalCreditos = totalCreditos;
  resultados.verificacoes.diferenca = diferenca;
  
  console.log('');
  console.log('  [2] Partidas Dobradas:');
  console.log('      Total Débitos:  R$', totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('      Total Créditos: R$', totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('      Diferença:      R$', diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), diferenca < 0.01 ? '✅' : '❌');
  
  // 3. Desbalanceados (via RPC)
  const { data: unbalancedData } = await supabase.rpc('audit_count_unbalanced', {
    p_tenant: TENANT_ID,
    p_start: dataInicio,
    p_end: dataFim
  });
  const desbalanceados = unbalancedData ?? 0;
  resultados.verificacoes.desbalanceados = desbalanceados;
  console.log('');
  console.log('  [3] Lançamentos desbalanceados:', desbalanceados, desbalanceados === 0 ? '✅' : '❌');
  
  // 4. Transitórias (via RPC)
  const { data: transD } = await supabase.rpc('audit_account_balance', {
    p_tenant: TENANT_ID,
    p_account: '3e1fd22f-fba2-4cc2-b628-9d729233bca0',
    p_start: dataInicio,
    p_end: dataFim
  });
  const saldoTransD = transD ?? 0;
  
  const { data: transC } = await supabase.rpc('audit_account_balance', {
    p_tenant: TENANT_ID,
    p_account: '28085461-9e5a-4fb4-847d-c9fc047fe0a1',
    p_start: dataInicio,
    p_end: dataFim
  });
  const saldoTransC = (transC ?? 0) * -1; // Inverter para mostrar saldo credor
  
  resultados.verificacoes.transitoriaDebitos = saldoTransD;
  resultados.verificacoes.transitoriaCreditos = saldoTransC;
  
  console.log('');
  console.log('  [4] Contas Transitórias:');
  console.log('      1.1.9.01 Débitos:  R$', saldoTransD.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), Math.abs(saldoTransD) < 0.01 ? '✅' : '⚠️');
  console.log('      2.1.9.01 Créditos: R$', saldoTransC.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), Math.abs(saldoTransC) < 0.01 ? '✅' : '⚠️');
  
  // 5. Estatísticas (count não tem limite de paginação)
  const { count: totalLancamentos } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', dataInicio)
    .lte('entry_date', dataFim);
  
  const { count: estornos } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .eq('source_type', 'reversal')
    .gte('entry_date', dataInicio)
    .lte('entry_date', dataFim);
  
  resultados.verificacoes.totalLancamentos = totalLancamentos;
  resultados.verificacoes.estornos = estornos;
  
  console.log('');
  console.log('  [5] Estatísticas:');
  console.log('      Total de lançamentos:', totalLancamentos);
  console.log('      Estornos técnicos:', estornos);
  
  // Parecer final
  const aprovado = (
    transacoesOrfas === 0 &&
    diferenca < 0.01 &&
    desbalanceados === 0
  );
  
  resultados.status = aprovado ? 'APROVADO' : 'PENDENTE';
  resultados.aprovado = aprovado;
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  if (aprovado) {
    console.log('║  ✅ STATUS: APROVADO PARA FECHAMENTO                         ║');
  } else {
    console.log('║  ⚠️  STATUS: PENDENTE — VERIFICAR ITENS ACIMA                 ║');
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  return resultados;
}

// Executar
executarAuditoria()
  .then(r => {
    if (!r.aprovado) {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Erro na auditoria:', err);
    process.exit(2);
  });
