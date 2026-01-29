import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Contar lançamentos por source_type
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('source_type');

  const contagem = {};
  entries?.forEach(e => {
    const tipo = e.source_type || 'null';
    contagem[tipo] = (contagem[tipo] || 0) + 1;
  });

  console.log('LANCAMENTOS POR SOURCE_TYPE:');
  console.log('='.repeat(50));
  Object.entries(contagem).sort((a,b) => b[1]-a[1]).forEach(([tipo, qtd]) => {
    console.log(`   ${tipo.padEnd(25)}: ${qtd}`);
  });

  // Verificar bank_transactions que afetam contas grupo 3
  console.log('\n\nANÁLISE DE LINHAS EM CONTAS DE RECEITA (GRUPO 3):');
  console.log('='.repeat(70));

  const { data: contasGrupo3 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '3.%');

  const idsGrupo3 = contasGrupo3?.map(c => c.id) || [];
  console.log(`Contas do grupo 3 encontradas: ${idsGrupo3.length}`);

  // Buscar linhas que usam contas do grupo 3
  const { data: linhasG3 } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id, account_id, debit, credit')
    .in('account_id', idsGrupo3);

  console.log(`Total linhas em contas grupo 3: ${linhasG3?.length}`);

  // Buscar os entries dessas linhas
  const entryIds = [...new Set(linhasG3?.map(l => l.entry_id) || [])];

  const { data: entriesG3 } = await supabase
    .from('accounting_entries')
    .select('id, source_type')
    .in('id', entryIds.slice(0, 1000));

  const mapEntries = {};
  entriesG3?.forEach(e => mapEntries[e.id] = e.source_type);

  // Agrupar por source_type
  const porTipo = {};
  linhasG3?.forEach(l => {
    const tipo = mapEntries[l.entry_id] || 'null';
    if (!porTipo[tipo]) porTipo[tipo] = { linhas: 0, debitos: 0, creditos: 0 };
    porTipo[tipo].linhas++;
    porTipo[tipo].debitos += parseFloat(l.debit) || 0;
    porTipo[tipo].creditos += parseFloat(l.credit) || 0;
  });

  console.log('\nLinhas em contas RECEITA agrupadas por source_type:');
  console.log('-'.repeat(70));
  Object.entries(porTipo).sort((a,b) => b[1].linhas - a[1].linhas).forEach(([tipo, vals]) => {
    const saldo = vals.creditos - vals.debitos;
    console.log(`${tipo.padEnd(20)}: ${vals.linhas.toString().padStart(4)} linhas`);
    console.log(`   Débitos: R$ ${vals.debitos.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(15)}`);
    console.log(`   Créditos: R$ ${vals.creditos.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(14)}`);
    console.log(`   Saldo (C-D): R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);
    console.log('');
  });

  // Mostrar exemplos de bank_transaction com débito em receita
  console.log('\n\nEXEMPLOS DE BANK_TRANSACTION COM DÉBITO EM RECEITA:');
  console.log('='.repeat(70));

  const { data: entriesBT } = await supabase
    .from('accounting_entries')
    .select('id, description, entry_date')
    .eq('source_type', 'bank_transaction')
    .limit(100);

  const idsBT = entriesBT?.map(e => e.id) || [];

  const { data: linhasBT } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id, account_id, debit, credit')
    .in('entry_id', idsBT)
    .in('account_id', idsGrupo3)
    .gt('debit', 0);

  console.log(`Encontrados ${linhasBT?.length} lançamentos bank_transaction com DÉBITO em receita`);

  let count = 0;
  for (const linha of linhasBT || []) {
    if (count >= 5) break;
    const entry = entriesBT?.find(e => e.id === linha.entry_id);
    const conta = contasGrupo3?.find(c => c.id === linha.account_id);
    console.log(`\n${entry?.entry_date} | ${conta?.code} ${conta?.name}`);
    console.log(`   ${entry?.description?.substring(0, 60)}`);
    console.log(`   DÉBITO: R$ ${linha.debit}`);
    count++;
  }
}

check().catch(console.error);
