/**
 * Análise completa da conta transitória e PIX pendentes
 * Usando tabelas corretas: accounting_entries e accounting_entry_lines
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

  // Buscar accounting_entries de janeiro
  const { data: entries, error: errEntries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description')
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  if (errEntries) {
    console.error('Erro ao buscar entries:', errEntries);
    return;
  }

  console.log(`Total de lançamentos janeiro: ${entries.length}`);

  const entryIds = entries.map(e => e.id);

  // Buscar linhas na conta transitória
  const { data: lancamentos, error: errLanc } = await supabase
    .from('accounting_entry_lines')
    .select('id, account_code, debit, credit, description, accounting_entry_id')
    .eq('account_code', '1.1.9.01')
    .in('accounting_entry_id', entryIds);

  if (errLanc) {
    console.error('Erro ao buscar linhas:', errLanc);
    return;
  }

  console.log(`Linhas na conta transitória: ${lancamentos?.length || 0}`);

  // Mapear entries por ID
  const entriesMap = {};
  for (const e of entries) {
    entriesMap[e.id] = e;
  }

  let totalDebito = 0;
  let totalCredito = 0;
  
  const entradas = []; // Créditos (entradas de dinheiro)
  const saidas = [];   // Débitos (baixas/classificações)

  for (const l of lancamentos || []) {
    const entry = entriesMap[l.accounting_entry_id];
    if (!entry) continue;
    
    const item = {
      date: entry.entry_date,
      descricao: entry.description,
      entry_id: entry.id
    };

    if (l.credit > 0) {
      entradas.push({ ...item, credit: l.credit });
      totalCredito += l.credit;
    } else if (l.debit > 0) {
      saidas.push({ ...item, debit: l.debit });
      totalDebito += l.debit;
    }
  }

  console.log('\n--- RESUMO CONTA TRANSITÓRIA ---\n');
  console.log(`Total CRÉDITOS (entradas): R$ ${totalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Total DÉBITOS (saídas):    R$ ${totalDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  const saldo = totalCredito - totalDebito;
  console.log(`SALDO (C - D):             R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`(Negativo = dinheiro saiu para conta definitiva)`);

  // Filtrar PIX nas entradas
  console.log('\n\n--- ENTRADAS PIX NA TRANSITÓRIA ---\n');
  
  const pixEntradas = entradas.filter(e => e.descricao?.toUpperCase().includes('PIX'));
  pixEntradas.sort((a, b) => b.credit - a.credit);

  for (const pix of pixEntradas) {
    console.log(`${pix.date} | R$ ${pix.credit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | ${pix.descricao?.substring(0, 60)}`);
  }

  const totalPixEntradas = pixEntradas.reduce((s, p) => s + p.credit, 0);
  console.log(`\nTOTAL PIX ENTRADAS: R$ ${totalPixEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Verificar as saídas (baixas feitas) relacionadas a PIX
  console.log('\n\n--- BAIXAS JÁ REALIZADAS (DÉBITOS NA TRANSITÓRIA) ---\n');
  
  console.log(`Total de baixas: ${saidas.length}`);
  console.log(`Valor total baixado: R$ ${saidas.reduce((s, b) => s + b.debit, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Mostrar PIX que NÃO foram baixados (valor ainda na transitória)
  console.log('\n\n--- PIX PENDENTES DE CLASSIFICAÇÃO ---\n');
  console.log('(Valor recebido via PIX mas ainda não classificado como receita)\n');

  // Verificar PIX que têm entrada mas não têm saída correspondente
  // Para isso, precisamos cruzar com as baixas feitas
  
  // Identificar PIX únicos por descrição/valor
  const pixUnicos = [];
  for (const pix of pixEntradas) {
    const descSimples = pix.descricao?.split(' - ')[0] || pix.descricao;
    const chave = `${pix.date}_${pix.credit}_${descSimples}`;
    pixUnicos.push({
      ...pix,
      chave,
      descSimples
    });
  }

  // Listar cada PIX
  for (const pix of pixUnicos) {
    console.log(`${pix.date} | R$ ${pix.credit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | ${pix.descSimples?.substring(0, 50)}`);
  }

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

  // Proposta de classificação baseada nas informações do usuário
  console.log('\n\n=== PROPOSTA DE CLASSIFICAÇÃO DOS PIX (baseada nas informações) ===\n');
  
  const propostas = [
    { pagador: 'ACTION SOLUCOES', valores: [74761.78, 70046.90], tipo: '2,85% sobre faturamento', clientes: ['ACTION SERVICOS INDUSTRIAIS LTDA', 'ACTION SOLUCOES INDUSTRIAIS LTDA'] },
    { pagador: 'MATA PRAGAS', valores: [29660.14], tipo: '2,85% sobre faturamento', clientes: ['MATA PRAGAS CONTROLE DE PRAGAS LTDA'] },
    { pagador: 'JULIANA PERILLO M DE SA', valores: [4043.05], tipo: 'Honorários', clientes: ['Agropecuárias do EDSON DE SÁ'] },
    { pagador: 'ENZO DE AQUINO ALVES DONADI', valores: [4000.00, 1718.81], tipo: 'Honorários', clientes: ['CRYSTAL PARTICIPACOES', 'ECD CONSTRUTORA', etc] },
    { pagador: 'EMILIA GONCALVES BAZILIO', valores: [2118.00, 2118.00], tipo: 'Honorários', clientes: ['L.F. GONCALVES CONFECCOES LTDA (sócia)'] },
    { pagador: 'CANAL PET', valores: [706.00], tipo: 'Honorários', clientes: ['CANAL PET DISTRIBUIDORA LTDA'] },
    { pagador: 'A.I EMPREENDIMENTOS', valores: [375.00, 375.00, 375.00], tipo: 'Honorários', clientes: ['A.I EMPREEND', 'P.A. INDUSTRIA', 'CAGI INDUSTRIA', 'CLEITON CESARIO', 'GISELE DE MELO'] },
    { pagador: 'IVAIR GONCALVES', valores: [2826.00], tipo: 'A CONFIRMAR', clientes: ['?'] },
    { pagador: 'PAULA MILHOMEM', valores: [200.00], tipo: 'A CONFIRMAR', clientes: ['Centro Médico Milhomem?'] },
    { pagador: 'TAYLANE BELLE FERREIRA', valores: [6.03], tipo: 'REEMBOLSO DE MULTA', clientes: ['Não é cliente - é funcionária que reembolsou multa'] },
  ];

  for (const p of propostas) {
    const total = p.valores.reduce((s, v) => s + v, 0);
    console.log(`\n${p.pagador}:`);
    console.log(`  Valores: ${p.valores.map(v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })).join(', ')}`);
    console.log(`  Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Tipo: ${p.tipo}`);
    console.log(`  Clientes: ${p.clientes.join(', ')}`);
  }

  // Saldo esperado após classificações
  const totalClassificar = propostas.reduce((s, p) => s + p.valores.reduce((a, b) => a + b, 0), 0);
  console.log(`\n\nTOTAL A CLASSIFICAR: R$ ${totalClassificar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`SALDO ATUAL TRANSITÓRIA: R$ ${Math.abs(saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

main().catch(console.error);
