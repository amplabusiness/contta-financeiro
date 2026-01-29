/**
 * Buscar saldos de clientes a receber com débito em janeiro 2025
 * e completar mapeamentos pendentes
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
  console.log('=== SALDOS CLIENTES A RECEBER JAN/2025 ===\n');

  // Buscar saldos de clientes via journal_entry_lines
  const { data: saldos, error: errSaldos } = await supabase
    .rpc('get_account_balances_by_period', {
      p_tenant_id: TENANT_ID,
      p_year: 2025,
      p_month: 1
    });

  if (errSaldos) {
    console.log('RPC não disponível, buscando manualmente...\n');
  }

  // Buscar clientes a receber com saldo devedor (abertura ou movimento)
  const { data: clientes, error: errClientes } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('tenant_id', TENANT_ID)
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%CONSOLIDADO%')
    .order('code');

  console.log(`Total clientes (sem consolidados): ${clientes?.length}\n`);

  // Buscar todos os lançamentos de clientes em janeiro
  const { data: lancamentos, error: errLanc } = await supabase
    .from('journal_entry_lines')
    .select(`
      account_code, 
      debit, 
      credit,
      journal_entries!inner(id, date, status, tenant_id)
    `)
    .eq('journal_entries.tenant_id', TENANT_ID)
    .eq('journal_entries.status', 'posted')
    .like('account_code', '1.1.2.01.%')
    .gte('journal_entries.date', '2024-12-01')
    .lte('journal_entries.date', '2025-01-31');

  // Calcular saldos por conta
  const saldosPorConta = {};
  
  for (const l of lancamentos || []) {
    const code = l.account_code;
    if (!saldosPorConta[code]) {
      saldosPorConta[code] = { debito: 0, credito: 0 };
    }
    saldosPorConta[code].debito += l.debit || 0;
    saldosPorConta[code].credito += l.credit || 0;
  }

  // Filtrar contas com saldo devedor
  const contasComSaldo = [];
  for (const [code, valores] of Object.entries(saldosPorConta)) {
    const saldo = valores.debito - valores.credito;
    if (saldo > 0.01) { // Saldo devedor positivo
      const cliente = clientes?.find(c => c.code === code);
      contasComSaldo.push({
        code,
        name: cliente?.name || 'N/A',
        debito: valores.debito,
        credito: valores.credito,
        saldo
      });
    }
  }

  contasComSaldo.sort((a, b) => b.saldo - a.saldo);

  console.log('--- CLIENTES COM SALDO A RECEBER (TOP 50) ---\n');
  
  let totalSaldo = 0;
  for (const conta of contasComSaldo.slice(0, 50)) {
    totalSaldo += conta.saldo;
    console.log(`${conta.code} | R$ ${conta.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)} | ${conta.name}`);
  }
  console.log(`\nTOTAL SALDO A RECEBER: R$ ${totalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Buscar IVAIR e PAULA
  console.log('\n\n--- BUSCA ESPECÍFICA IVAIR e PAULA ---\n');

  const termosBusca = ['IVAIR', 'PAULA', 'GONCALVES', 'MILHOMEM'];
  
  for (const termo of termosBusca) {
    const encontrados = clientes?.filter(c => c.name.toUpperCase().includes(termo)) || [];
    if (encontrados.length > 0) {
      console.log(`\n"${termo}":`);
      encontrados.forEach(c => {
        const saldo = saldosPorConta[c.code];
        const saldoFinal = saldo ? (saldo.debito - saldo.credito) : 0;
        console.log(`  ${c.code} - ${c.name} (Saldo: R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
      });
    }
  }

  // Verificar ACTION, MATA PRAGAS, CRYSTAL/ECD, EMILIA, CANAL PET e GRUPO A.I
  console.log('\n\n--- SALDOS DOS GRUPOS IDENTIFICADOS ---\n');

  const grupos = [
    { nome: 'ACTION', codigos: ['1.1.2.01.0021', '1.1.2.01.0334'] },
    { nome: 'MATA PRAGAS', codigos: ['1.1.2.01.0086'] },
    { nome: 'CRYSTAL/ECD (ENZO)', codigos: ['1.1.2.01.0003', '1.1.2.01.0005', '1.1.2.01.0007', '1.1.2.01.0391'] },
    { nome: 'EMILIA/CONFECCAO', codigos: ['1.1.2.01.0437', '1.1.2.01.0292', '1.1.2.01.0341'] },
    { nome: 'CANAL PET', codigos: ['1.1.2.01.0037'] },
    { nome: 'GRUPO A.I', codigos: ['1.1.2.01.0153', '1.1.2.01.0310', '1.1.2.01.0193', '1.1.2.01.0234', '1.1.2.01.0343', '1.1.2.01.0371', '1.1.2.01.0144', '1.1.2.01.0380'] },
  ];

  for (const grupo of grupos) {
    console.log(`\n${grupo.nome}:`);
    let totalGrupo = 0;
    
    for (const code of grupo.codigos) {
      const cliente = clientes?.find(c => c.code === code);
      const saldo = saldosPorConta[code];
      const saldoFinal = saldo ? (saldo.debito - saldo.credito) : 0;
      totalGrupo += saldoFinal;
      
      if (saldoFinal > 0 || cliente) {
        console.log(`  ${code} - ${cliente?.name || 'N/A'}`);
        console.log(`    Saldo: R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      }
    }
    console.log(`  TOTAL GRUPO: R$ ${totalGrupo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  // Buscar AGROPECUÁRIAS do EDSON/JULIANA PERILLO
  console.log('\n\n--- AGROPECUÁRIAS (JULIANA PERILLO / EDSON) ---\n');
  
  const agropecuarias = clientes?.filter(c => 
    c.name.toUpperCase().includes('AGROPEC') && 
    !c.name.includes('CONSOLIDADO')
  ) || [];

  let totalAgro = 0;
  for (const agro of agropecuarias) {
    const saldo = saldosPorConta[agro.code];
    const saldoFinal = saldo ? (saldo.debito - saldo.credito) : 0;
    if (saldoFinal > 0.01) {
      totalAgro += saldoFinal;
      console.log(`${agro.code} - ${agro.name}`);
      console.log(`  Saldo: R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
  }
  console.log(`\nTOTAL AGROPECUÁRIAS: R$ ${totalAgro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

main().catch(console.error);
