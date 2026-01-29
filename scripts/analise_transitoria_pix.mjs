/**
 * Análise completa da conta transitória e PIX pendentes
 * Cruzar com extrato bancário para entender o que precisa ser baixado
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

async function main() {
  console.log('=== ANÁLISE CONTA TRANSITÓRIA 1.1.9.01 - JANEIRO 2025 ===\n');

  // Buscar todos os lançamentos na conta transitória em janeiro
  const { data: lancamentos, error } = await supabase
    .from('journal_entry_lines')
    .select(`
      id,
      account_code,
      debit,
      credit,
      description,
      journal_entries!inner(id, date, description, status, tenant_id)
    `)
    .eq('journal_entries.tenant_id', TENANT_ID)
    .eq('journal_entries.status', 'posted')
    .eq('account_code', '1.1.9.01')
    .gte('journal_entries.date', '2025-01-01')
    .lte('journal_entries.date', '2025-01-31')
    .order('journal_entries(date)');

  if (error) {
    console.error('Erro:', error);
    return;
  }

  let totalDebito = 0;
  let totalCredito = 0;
  
  const entradas = []; // Créditos (entradas de dinheiro)
  const saidas = [];   // Débitos (baixas/classificações)

  for (const l of lancamentos) {
    const item = {
      date: l.journal_entries.date,
      valor: l.credit > 0 ? l.credit : -l.debit,
      descricao: l.journal_entries.description,
      entry_id: l.journal_entries.id
    };

    if (l.credit > 0) {
      entradas.push({ ...item, credit: l.credit });
      totalCredito += l.credit;
    } else if (l.debit > 0) {
      saidas.push({ ...item, debit: l.debit });
      totalDebito += l.debit;
    }
  }

  console.log('--- RESUMO CONTA TRANSITÓRIA ---\n');
  console.log(`Total CRÉDITOS (entradas): R$ ${totalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Total DÉBITOS (saídas):    R$ ${totalDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`SALDO (C - D):             R$ ${(totalCredito - totalDebito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Filtrar PIX nas entradas que ainda não foram classificados
  console.log('\n\n--- ENTRADAS PIX AINDA NA TRANSITÓRIA ---\n');
  
  const pixEntradas = entradas.filter(e => e.descricao.toUpperCase().includes('PIX'));
  pixEntradas.sort((a, b) => b.credit - a.credit);

  // Verificar se cada PIX já tem uma saída correspondente
  for (const pix of pixEntradas) {
    // Buscar se existe débito na transitória para este PIX (baixa)
    const temBaixa = saidas.some(s => 
      s.descricao.includes(pix.entry_id) || 
      s.descricao.toUpperCase().includes(pix.descricao.split(' ').slice(-2).join(' ').toUpperCase())
    );
    
    console.log(`${pix.date} | R$ ${pix.credit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | ${pix.descricao}`);
  }

  console.log(`\nTOTAL PIX: R$ ${pixEntradas.reduce((s, p) => s + p.credit, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Verificar as saídas (baixas feitas)
  console.log('\n\n--- BAIXAS JÁ REALIZADAS (DÉBITOS NA TRANSITÓRIA) ---\n');
  
  const baixasBoleto = saidas.filter(s => s.descricao.toUpperCase().includes('BAIXA') || s.descricao.toUpperCase().includes('COB'));
  
  console.log(`Total de baixas: ${baixasBoleto.length}`);
  console.log(`Valor total baixado: R$ ${baixasBoleto.reduce((s, b) => s + b.debit, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Agora verificar: se os PIX estão na transitória como CRÉDITO (entrada)
  // precisamos criar baixas (DÉBITO transitória / CRÉDITO clientes)
  // MAS se os clientes têm saldo zero, significa que a receita foi reconhecida diretamente
  
  console.log('\n\n--- ANÁLISE DO FLUXO ---\n');
  console.log('Os PIX entraram na transitória como CRÉDITO.');
  console.log('Para zerar a transitória, precisamos criar DÉBITO na transitória.');
  console.log('A contrapartida depende do tipo de receita:\n');
  console.log('1. Honorários de cliente → CRÉDITO em Receita de Honorários (3.1.1.01)');
  console.log('2. Reembolso de despesa → CRÉDITO em Receita de Reembolso ou Estorno');
  console.log('3. 2,85% do faturamento → CRÉDITO em Receita de Comissão/Taxa Adm');

  // Listar os PIX que precisam de tratamento
  console.log('\n\n=== PIX PENDENTES DE CLASSIFICAÇÃO ===\n');

  const pixPendentes = [
    { pagador: 'ACTION SOLUCOES', valor: 74761.78, tipo: '2,85% faturamento', conta_receita: '3.1.1.02' },
    { pagador: 'ACTION SOLUCOES', valor: 70046.90, tipo: '2,85% faturamento', conta_receita: '3.1.1.02' },
    { pagador: 'MATA PRAGAS', valor: 29660.14, tipo: '2,85% faturamento', conta_receita: '3.1.1.02' },
    { pagador: 'JULIANA PERILLO (Agropecuárias EDSON)', valor: 4043.05, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'ENZO DE AQUINO (Crystal/ECD)', valor: 4000.00, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'ENZO DE AQUINO (Crystal/ECD)', valor: 1718.81, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'EMILIA GONCALVES (Confecção)', valor: 2118.00, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'EMILIA GONCALVES (Confecção)', valor: 2118.00, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'IVAIR GONCALVES', valor: 2826.00, tipo: 'verificar', conta_receita: '?' },
    { pagador: 'CANAL PET', valor: 706.00, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'A.I EMPREENDIMENTOS (Grupo)', valor: 375.00, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'A.I EMPREENDIMENTOS (Grupo)', valor: 375.00, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'A.I EMPREENDIMENTOS (Grupo)', valor: 375.00, tipo: 'honorários', conta_receita: '3.1.1.01' },
    { pagador: 'PAULA MILHOMEM (Centro Médico?)', valor: 200.00, tipo: 'verificar', conta_receita: '?' },
    { pagador: 'TAYLANE BELLE FERREIRA (REEMBOLSO)', valor: 6.03, tipo: 'reembolso multa', conta_receita: '4.1.9.01' },
  ];

  console.log('| Pagador | Valor | Tipo | Conta Receita |');
  console.log('|---------|-------|------|---------------|');
  for (const pix of pixPendentes) {
    console.log(`| ${pix.pagador.padEnd(40)} | R$ ${pix.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(10)} | ${pix.tipo.padEnd(20)} | ${pix.conta_receita} |`);
  }

  const totalPix = pixPendentes.reduce((s, p) => s + p.valor, 0);
  console.log(`\nTOTAL PIX PENDENTES: R$ ${totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Verificar contas de receita disponíveis
  console.log('\n\n--- CONTAS DE RECEITA DISPONÍVEIS ---\n');
  
  const { data: contasReceita } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .eq('tenant_id', TENANT_ID)
    .or('code.like.3.1.%,code.like.4.1.%')
    .eq('is_group', false)
    .order('code');

  for (const conta of contasReceita || []) {
    console.log(`${conta.code} - ${conta.name}`);
  }
}

main().catch(console.error);
