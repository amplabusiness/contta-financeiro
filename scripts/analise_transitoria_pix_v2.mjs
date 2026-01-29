/**
 * Análise completa da conta transitória e PIX pendentes
 * Versão corrigida da query
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

  // Buscar journal entries de janeiro
  const { data: entries, error: errEntries } = await supabase
    .from('journal_entries')
    .select('id, date, description, status')
    .eq('tenant_id', TENANT_ID)
    .eq('status', 'posted')
    .gte('date', '2025-01-01')
    .lte('date', '2025-01-31');

  if (errEntries) {
    console.error('Erro ao buscar entries:', errEntries);
    return;
  }

  const entryIds = entries.map(e => e.id);

  // Buscar linhas na conta transitória
  const { data: lancamentos, error: errLanc } = await supabase
    .from('journal_entry_lines')
    .select('id, account_code, debit, credit, description, journal_entry_id')
    .eq('account_code', '1.1.9.01')
    .in('journal_entry_id', entryIds);

  if (errLanc) {
    console.error('Erro ao buscar linhas:', errLanc);
    return;
  }

  // Mapear entries por ID
  const entriesMap = {};
  for (const e of entries) {
    entriesMap[e.id] = e;
  }

  let totalDebito = 0;
  let totalCredito = 0;
  
  const entradas = []; // Créditos (entradas de dinheiro)
  const saidas = [];   // Débitos (baixas/classificações)

  for (const l of lancamentos) {
    const entry = entriesMap[l.journal_entry_id];
    const item = {
      date: entry.date,
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

  console.log('--- RESUMO CONTA TRANSITÓRIA ---\n');
  console.log(`Total CRÉDITOS (entradas): R$ ${totalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Total DÉBITOS (saídas):    R$ ${totalDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`SALDO (C - D):             R$ ${(totalCredito - totalDebito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`(Negativo = dinheiro saiu = precisa classificar receita)`);

  // Filtrar PIX nas entradas
  console.log('\n\n--- ENTRADAS PIX NA TRANSITÓRIA ---\n');
  
  const pixEntradas = entradas.filter(e => e.descricao.toUpperCase().includes('PIX'));
  pixEntradas.sort((a, b) => b.credit - a.credit);

  for (const pix of pixEntradas) {
    console.log(`${pix.date} | R$ ${pix.credit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | ${pix.descricao}`);
  }

  console.log(`\nTOTAL PIX ENTRADAS: R$ ${pixEntradas.reduce((s, p) => s + p.credit, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Verificar as saídas (baixas feitas)
  console.log('\n\n--- BAIXAS JÁ REALIZADAS (DÉBITOS NA TRANSITÓRIA) ---\n');
  
  console.log(`Total de baixas: ${saidas.length}`);
  console.log(`Valor total baixado: R$ ${saidas.reduce((s, b) => s + b.debit, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

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

  // Proposta de classificação
  console.log('\n\n=== PROPOSTA DE CLASSIFICAÇÃO DOS PIX ===\n');
  
  console.log('Com base nas informações fornecidas:\n');
  console.log('1. ACTION SOLUCOES (2,85% faturamento) → Comissão/Taxa Administrativa');
  console.log('2. MATA PRAGAS (2,85% faturamento) → Comissão/Taxa Administrativa');
  console.log('3. JULIANA PERILLO (Agropecuárias) → Honorários Contábeis');
  console.log('4. ENZO DE AQUINO (Crystal/ECD) → Honorários Contábeis');
  console.log('5. EMILIA GONCALVES (Confecção sócia) → Honorários Contábeis');
  console.log('6. CANAL PET → Honorários Contábeis');
  console.log('7. A.I EMPREENDIMENTOS (Grupo) → Honorários Contábeis');
  console.log('8. TAYLANE BELLE (Reembolso) → Outras Receitas/Reembolso');
  console.log('9. IVAIR GONCALVES → A CONFIRMAR');
  console.log('10. PAULA MILHOMEM → A CONFIRMAR (Centro Médico Milhomem?)');

  // O que ainda falta esclarecer
  console.log('\n\n=== PENDÊNCIAS PARA O USUÁRIO ===\n');
  console.log('Por favor confirme:');
  console.log('');
  console.log('1. IVAIR GONCALVES (R$ 2.826,00) - paga para qual empresa?');
  console.log('2. PAULA MILHOMEM (R$ 200,00) - é do Centro Médico Milhomem?');
  console.log('');
  console.log('3. Os valores de 2,85% (ACTION e MATA PRAGAS) são:');
  console.log('   a) Honorários contábeis proporcionais ao faturamento?');
  console.log('   b) Comissão/Taxa administrativa sobre vendas?');
  console.log('   c) Outro tipo de receita?');
}

main().catch(console.error);
