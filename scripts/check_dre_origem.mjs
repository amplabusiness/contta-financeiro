import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('🔍 INVESTIGANDO ORIGEM DAS RECEITAS NO DRE\n');

  // Buscar TODAS as contas do grupo 3 (Receitas)
  const { data: contasReceita } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type, nature')
    .or('code.like.3.%,type.eq.RECEITA');

  console.log('📋 Contas de Receita encontradas:');
  contasReceita?.forEach(c => {
    console.log(`   ${c.code} - ${c.name} (type: ${c.type}, nature: ${c.nature})`);
  });

  const idsReceita = contasReceita?.map(c => c.id) || [];

  // Buscar TODAS as linhas que usam essas contas
  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, debit, credit, account_id, entry_id')
    .in('account_id', idsReceita);

  console.log(`\n📊 Total de linhas em contas de receita: ${todasLinhas?.length || 0}`);

  // Agrupar por mês
  if (todasLinhas && todasLinhas.length > 0) {
    // Buscar as entries para pegar as datas
    const entryIds = [...new Set(todasLinhas.map(l => l.entry_id))];

    const { data: entries } = await supabase
      .from('accounting_entries')
      .select('id, entry_date, source_type, description')
      .in('id', entryIds);

    const mapEntries = {};
    entries?.forEach(e => mapEntries[e.id] = e);

    // Agrupar por mês
    const porMes = {};
    todasLinhas.forEach(l => {
      const entry = mapEntries[l.entry_id];
      if (!entry) return;

      const mes = entry.entry_date.substring(0, 7);
      if (!porMes[mes]) porMes[mes] = { creditos: 0, debitos: 0, linhas: [] };

      porMes[mes].creditos += parseFloat(l.credit) || 0;
      porMes[mes].debitos += parseFloat(l.debit) || 0;
      porMes[mes].linhas.push({ ...l, entry });
    });

    console.log('\n💰 RESUMO POR MÊS (Contas de Receita):');
    console.log('─'.repeat(80));
    console.log('Mês        | Créditos         | Débitos          | Receita (C-D)');
    console.log('─'.repeat(80));

    Object.entries(porMes).sort().forEach(([mes, vals]) => {
      const c = vals.creditos.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15);
      const d = vals.debitos.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15);
      const r = (vals.creditos - vals.debitos).toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15);
      console.log(`${mes}  | R$ ${c} | R$ ${d} | R$ ${r}`);
    });

    // Detalhar Janeiro
    console.log('\n\n📋 DETALHES JANEIRO/2025:');
    const jan = porMes['2025-01'];
    if (jan) {
      // Agrupar por source_type
      const porTipo = {};
      jan.linhas.forEach(l => {
        const tipo = l.entry.source_type || 'null';
        if (!porTipo[tipo]) porTipo[tipo] = { c: 0, d: 0, count: 0 };
        porTipo[tipo].c += parseFloat(l.credit) || 0;
        porTipo[tipo].d += parseFloat(l.debit) || 0;
        porTipo[tipo].count++;
      });

      console.log('Por source_type:');
      Object.entries(porTipo).forEach(([tipo, vals]) => {
        console.log(`   ${tipo}: ${vals.count} linhas | C: R$ ${vals.c.toLocaleString('pt-BR')} | D: R$ ${vals.d.toLocaleString('pt-BR')}`);
      });

      // Mostrar alguns exemplos
      console.log('\nExemplos de lançamentos:');
      jan.linhas.slice(0, 10).forEach(l => {
        console.log(`   ${l.entry.entry_date} | ${l.entry.source_type?.padEnd(15) || 'null'.padEnd(15)} | C: ${l.credit} D: ${l.debit} | ${l.entry.description?.substring(0, 40)}`);
      });
    } else {
      console.log('   Nenhum lançamento em contas de receita em Janeiro/2025');
    }
  }

  // Verificar a função RPC get_account_balances
  console.log('\n\n🔍 TESTANDO RPC get_account_balances:');

  const { data: balances, error } = await supabase.rpc('get_account_balances', {
    p_period_start: '2025-01-01',
    p_period_end: '2025-01-31'
  });

  if (error) {
    console.log('Erro:', error);
  } else {
    // Filtrar contas do grupo 3
    const grupo3 = balances?.filter(b => b.account_code?.startsWith('3.')) || [];
    console.log(`Contas grupo 3 retornadas: ${grupo3.length}`);

    let totalReceita = 0;
    grupo3.forEach(b => {
      const saldo = parseFloat(b.closing_balance) || 0;
      // Para receitas (natureza credora): saldo positivo = receita
      totalReceita += saldo;
      if (Math.abs(saldo) > 0.01) {
        console.log(`   ${b.account_code} - ${b.account_name}: R$ ${saldo.toLocaleString('pt-BR')}`);
      }
    });
    console.log(`\nTotal Receitas (via RPC): R$ ${totalReceita.toLocaleString('pt-BR')}`);
  }
}

check().catch(console.error);
