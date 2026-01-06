import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Buscar algumas contas do plano de contas
  const { data: accounts, error: accError } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .limit(5);

  if (accError) {
    console.log('Erro contas:', accError.message);
    return;
  }

  console.log('=== CONTAS NO PLANO ===');
  for (const a of accounts) {
    console.log('ID:', a.id, '| Código:', a.code);
  }

  // Buscar algumas linhas de lançamento
  const { data: lines, error: linesError } = await supabase
    .from('accounting_entry_lines')
    .select('id, account_id, debit, credit')
    .limit(5);

  if (linesError) {
    console.log('Erro linhas:', linesError.message);
    return;
  }

  console.log('\n=== LINHAS DE LANÇAMENTO ===');
  for (const l of lines) {
    console.log('Line ID:', l.id, '| Account ID:', l.account_id);
  }

  // Verificar se os account_ids das linhas existem no plano de contas
  console.log('\n=== VERIFICANDO INTEGRIDADE ===');
  const { data: allLines, error: allError } = await supabase
    .from('accounting_entry_lines')
    .select('account_id')
    .limit(1000);

  if (allError) {
    console.log('Erro:', allError.message);
    return;
  }

  const uniqueAccountIds = [...new Set(allLines.map(l => l.account_id))];
  console.log('IDs únicos de conta nas linhas:', uniqueAccountIds.length);

  // Verificar quantos existem no plano
  const { data: existingAccounts, error: existError } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .in('id', uniqueAccountIds.slice(0, 100)); // Limitar a 100 por query

  if (existError) {
    console.log('Erro verificação:', existError.message);
    return;
  }

  console.log('Desses, existem no plano:', existingAccounts?.length || 0);

  // Listar alguns que não existem
  const existingIds = new Set(existingAccounts?.map(a => a.id) || []);
  const missing = uniqueAccountIds.filter(id => !existingIds.has(id)).slice(0, 5);

  if (missing.length > 0) {
    console.log('\n=== IDs DE CONTA ÓRFÃOS (não existem no plano) ===');
    for (const id of missing) {
      console.log('  -', id);
    }
  }
}

check().catch(console.error);
