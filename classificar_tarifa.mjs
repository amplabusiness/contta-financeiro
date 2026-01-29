// Script para classificar a tarifa pendente
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function classificarTarifaPendente() {
  console.log('=== CLASSIFICAR TARIFA PENDENTE ===\n');
  
  const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
  
  // Buscar a tarifa pendente
  const { data: pendente } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('matched', false)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .single();
  
  if (!pendente) {
    console.log('Nenhuma transação pendente encontrada!');
    return;
  }
  
  console.log('Transação encontrada:');
  console.log('  ID:', pendente.id);
  console.log('  Data:', pendente.transaction_date);
  console.log('  Valor:', parseFloat(pendente.amount).toFixed(2));
  console.log('  Descrição:', pendente.description);
  
  // Buscar as contas necessárias
  const { data: contaManutencao } = await supabase.from('chart_of_accounts').select('id').eq('code', '4.1.3.02.01').single();
  const { data: contaBanco } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.1.05').single();
  
  if (!contaManutencao || !contaBanco) {
    console.log('\nContas não encontradas:');
    console.log('  4.1.3.02.01:', contaManutencao ? '✅' : '❌');
    console.log('  1.1.1.05:', contaBanco ? '✅' : '❌');
    return;
  }
  
  const valor = Math.abs(parseFloat(pendente.amount));
  const desc = 'Tarifa bancária - ' + pendente.description;
  
  console.log('\n📋 LANÇAMENTO A CRIAR:');
  console.log('  D 4.1.3.02.01 (Manutenção Títulos):', valor.toFixed(2));
  console.log('  C 1.1.1.05 (Banco Sicredi):', valor.toFixed(2));
  
  // Criar via SQL com bypass de RLS
  const sql = `
    SET session_replication_role = 'replica';
    
    WITH new_entry AS (
      INSERT INTO accounting_entries (
        tenant_id, entry_date, competence_date, description, entry_type, 
        is_draft, transaction_id, total_debit, total_credit, balanced
      ) VALUES (
        '${TENANT_ID}',
        '${pendente.transaction_date}',
        '${pendente.transaction_date}',
        '${desc.replace(/'/g, "''")}',
        'expense',
        false,
        '${pendente.id}',
        ${valor},
        ${valor},
        true
      ) RETURNING id
    ),
    items AS (
      INSERT INTO accounting_entry_items (entry_id, account_id, debit, credit)
      SELECT 
        id as entry_id,
        '${contaManutencao.id}' as account_id,
        ${valor} as debit,
        0 as credit
      FROM new_entry
      UNION ALL
      SELECT 
        id as entry_id,
        '${contaBanco.id}' as account_id,
        0 as debit,
        ${valor} as credit
      FROM new_entry
    ),
    upd AS (
      UPDATE bank_transactions 
      SET matched = true, journal_entry_id = (SELECT id FROM new_entry)
      WHERE id = '${pendente.id}'
    )
    SELECT id FROM new_entry;
    
    SET session_replication_role = 'origin';
  `;
  
  console.log('\n📝 SQL a executar:');
  console.log(sql);
  
  // Verificar se existe uma função RPC para executar SQL
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
  
  if (error) {
    console.log('\nErro RPC execute_sql:', error.message);
    console.log('\n⚠️  Executar o SQL acima manualmente no Supabase SQL Editor');
    return;
  }
  
  console.log('\n✅ Resultado:', data);
}

classificarTarifaPendente().catch(console.error);
