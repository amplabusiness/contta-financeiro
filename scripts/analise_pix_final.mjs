/**
 * Análise PIX pendentes - versão simplificada com SQL direto
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

  // Query direta para buscar PIX na transitória
  const { data: pixData, error: errPix } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      account_code,
      debit,
      credit,
      accounting_entries!inner(
        id,
        tenant_id,
        entry_date,
        description
      )
    `)
    .eq('accounting_entries.tenant_id', TENANT_ID)
    .eq('account_code', '1.1.9.01')
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31')
    .ilike('accounting_entries.description', '%PIX%');

  if (errPix) {
    console.error('Erro ao buscar PIX:', errPix);
    return;
  }

  console.log(`Linhas PIX na transitória: ${pixData?.length || 0}`);

  // Separar entradas (créditos) e saídas (débitos)
  const entradas = pixData?.filter(l => l.credit > 0) || [];
  const saidas = pixData?.filter(l => l.debit > 0) || [];

  let totalEntradas = entradas.reduce((s, l) => s + l.credit, 0);
  let totalSaidas = saidas.reduce((s, l) => s + l.debit, 0);

  console.log(`\nEntradas PIX (créditos): ${entradas.length} = R$ ${totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Saídas PIX (débitos):    ${saidas.length} = R$ ${totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Saldo PIX na transitória: R$ ${(totalEntradas - totalSaidas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Listar PIX de entrada ordenados por valor
  console.log('\n\n--- PIX RECEBIDOS (CRÉDITOS NA TRANSITÓRIA) ---\n');
  
  entradas.sort((a, b) => b.credit - a.credit);
  
  for (const pix of entradas) {
    const desc = pix.accounting_entries?.description || '';
    console.log(`${pix.accounting_entries?.entry_date} | R$ ${pix.credit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | ${desc.substring(0, 55)}`);
  }

  // Agora buscar saldo TOTAL da transitória
  console.log('\n\n--- SALDO TOTAL CONTA TRANSITÓRIA ---\n');
  
  const { data: todosSaldos, error: errSaldos } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit,
      credit,
      accounting_entries!inner(
        id,
        tenant_id,
        entry_date
      )
    `)
    .eq('accounting_entries.tenant_id', TENANT_ID)
    .eq('account_code', '1.1.9.01')
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  if (errSaldos) {
    console.error('Erro:', errSaldos);
    return;
  }

  const totalDebitoGeral = todosSaldos?.reduce((s, l) => s + (l.debit || 0), 0) || 0;
  const totalCreditoGeral = todosSaldos?.reduce((s, l) => s + (l.credit || 0), 0) || 0;
  const saldoGeral = totalCreditoGeral - totalDebitoGeral;

  console.log(`Total Débitos (saídas):  R$ ${totalDebitoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Total Créditos (entradas): R$ ${totalCreditoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`SALDO CONTA TRANSITÓRIA: R$ ${saldoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Verificar contas de receita disponíveis
  console.log('\n\n--- CONTAS DE RECEITA DISPONÍVEIS ---\n');
  
  const { data: contasReceita } = await supabase
    .from('chart_of_accounts')
    .select('code, name')
    .eq('tenant_id', TENANT_ID)
    .or('code.like.3.1.%,code.like.4.%')
    .eq('is_group', false)
    .order('code');

  for (const conta of contasReceita || []) {
    console.log(`${conta.code} - ${conta.name}`);
  }

  // Resumo das classificações necessárias baseado nas informações do usuário
  console.log('\n\n=== CLASSIFICAÇÕES A FAZER (baseado nas informações do usuário) ===\n');
  
  const classificacoes = [
    { pagador: 'ACTION SOLUCOES', valor: 74761.78, data: '2025-01-21', tipo: '2,85% faturamento', contaReceita: '3.1.1.01', obs: 'Honorários sobre faturamento' },
    { pagador: 'ACTION SOLUCOES', valor: 70046.90, data: '2025-01-14', tipo: '2,85% faturamento', contaReceita: '3.1.1.01', obs: 'Honorários sobre faturamento' },
    { pagador: 'MATA PRAGAS', valor: 29660.14, data: '2025-01-21', tipo: '2,85% faturamento', contaReceita: '3.1.1.01', obs: 'Honorários sobre faturamento' },
    { pagador: 'JULIANA PERILLO', valor: 4043.05, data: '2025-01-22', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'Agropecuárias EDSON DE SÁ' },
    { pagador: 'ENZO DE AQUINO', valor: 4000.00, data: '2025-01-08', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'Crystal/ECD' },
    { pagador: 'ENZO DE AQUINO', valor: 1718.81, data: '2025-01-30', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'Crystal/ECD' },
    { pagador: 'EMILIA GONCALVES', valor: 2118.00, data: '2025-01-06', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'L.F. Confecções (sócia)' },
    { pagador: 'EMILIA GONCALVES', valor: 2118.00, data: '2025-01-20', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'L.F. Confecções (sócia)' },
    { pagador: 'IVAIR GONCALVES', valor: 2826.00, data: '2025-01-14', tipo: 'A CONFIRMAR', contaReceita: '?', obs: 'VERIFICAR COM USUÁRIO' },
    { pagador: 'CANAL PET', valor: 706.00, data: '2025-01-23', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'Cliente cadastrado' },
    { pagador: 'A.I EMPREENDIMENTOS', valor: 375.00, data: '2025-01-06', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'Grupo: A.I/P.A./CAGI/Cleiton/Gisele' },
    { pagador: 'A.I EMPREENDIMENTOS', valor: 375.00, data: '2025-01-13', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'Grupo: A.I/P.A./CAGI/Cleiton/Gisele' },
    { pagador: 'A.I EMPREENDIMENTOS', valor: 375.00, data: '2025-01-20', tipo: 'honorários', contaReceita: '3.1.1.01', obs: 'Grupo: A.I/P.A./CAGI/Cleiton/Gisele' },
    { pagador: 'PAULA MILHOMEM', valor: 200.00, data: '2025-01-27', tipo: 'A CONFIRMAR', contaReceita: '?', obs: 'Centro Médico Milhomem?' },
    { pagador: 'TAYLANE BELLE', valor: 6.03, data: '2025-01-20', tipo: 'REEMBOLSO', contaReceita: '4.1.9.01', obs: 'Reembolso de multa (funcionária)' },
  ];

  console.log('| Data | Pagador | Valor | Tipo | Conta | Observação |');
  console.log('|------|---------|-------|------|-------|------------|');
  
  let totalClassificar = 0;
  for (const c of classificacoes) {
    totalClassificar += c.valor;
    console.log(`| ${c.data} | ${c.pagador.padEnd(20)} | R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(10)} | ${c.tipo.padEnd(18)} | ${c.contaReceita} | ${c.obs} |`);
  }

  console.log(`\n\nTOTAL A CLASSIFICAR: R$ ${totalClassificar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`SALDO TRANSITÓRIA ATUAL: R$ ${Math.abs(saldoGeral).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`DIFERENÇA: R$ ${Math.abs(totalClassificar - Math.abs(saldoGeral)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Pendências
  console.log('\n\n=== PENDÊNCIAS PARA CONFIRMAR ===\n');
  console.log('1. IVAIR GONCALVES (R$ 2.826,00) - paga para qual empresa?');
  console.log('2. PAULA MILHOMEM (R$ 200,00) - é do Centro Médico Milhomem?');
}

main().catch(console.error);
