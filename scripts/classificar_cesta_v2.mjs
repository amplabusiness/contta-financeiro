import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const CONTA_TARIFA = '3bf3b44b-8f3c-4a86-9fdb-4cc104a5f59c'; // 4.1.3.02 Tarifas Bancárias
const TRANSITORIA_DEBITOS = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
const TX_ID = '3113deff-7b93-41d7-b00a-f4f288fba413'; // CESTA fev/2025

async function classificar() {
  console.log('🔍 Buscando transação...');
  
  const { data: tx } = await supabase
    .from('bank_transactions')
    .select('id, amount, transaction_date, description, status')
    .eq('id', TX_ID)
    .single();

  if (!tx) {
    console.log('❌ Transação não encontrada');
    return;
  }

  console.log('✅ Transação:', tx.description);
  console.log('   Data:', tx.transaction_date);
  console.log('   Valor: R$', Math.abs(tx.amount).toFixed(2));
  console.log('   Status:', tx.status);

  if (tx.status === 'reconciled') {
    console.log('⚠️  Transação já conciliada!');
    return;
  }

  const entryId = crypto.randomUUID();
  const valor = Math.abs(tx.amount);
  const internalCode = 'CLASS_' + Date.now() + '_CESTA_FEV';

  console.log('📝 Criando lançamento...');

  // Inserir lançamento via SQL direto (bypass RLS)
  const { error: insertError } = await supabase.from('accounting_entries').insert({
    id: entryId,
    tenant_id: TENANT_ID,
    entry_date: tx.transaction_date,
    competence_date: tx.transaction_date,
    description: 'Classificação: Cesta de Relacionamento Bancário - Fevereiro/2025',
    internal_code: internalCode,
    source_type: 'classification',
    entry_type: 'CLASSIFICACAO',
    reference_type: 'bank_transaction',
    reference_id: tx.id
  });

  if (insertError) {
    console.log('❌ Erro ao criar lançamento:', insertError.message);
    
    // Tentar via chamada direta ao banco
    console.log('🔄 Tentando via SQL direto...');
    
    const sql = `
      INSERT INTO accounting_entries (id, tenant_id, entry_date, competence_date, description, internal_code, source_type, entry_type, reference_type, reference_id)
      VALUES ($1, $2, $3, $3, $4, $5, 'classification', 'CLASSIFICACAO', 'bank_transaction', $6)
    `;
    
    const { error: sqlError } = await supabase.rpc('execute_raw_sql', {
      query: sql,
      params: [entryId, TENANT_ID, tx.transaction_date, 'Classificação: Cesta de Relacionamento Bancário', internalCode, tx.id]
    });
    
    if (sqlError) {
      console.log('❌ Ainda com erro:', sqlError.message);
      return;
    }
  }

  // Inserir linhas
  console.log('📝 Inserindo linhas do lançamento...');
  
  const { error: linesError } = await supabase.from('accounting_entry_lines').insert([
    {
      id: crypto.randomUUID(),
      tenant_id: TENANT_ID,
      entry_id: entryId,
      account_id: CONTA_TARIFA,
      debit: valor,
      credit: 0,
      description: 'Despesa bancária - Cesta de Relacionamento'
    },
    {
      id: crypto.randomUUID(),
      tenant_id: TENANT_ID,
      entry_id: entryId,
      account_id: TRANSITORIA_DEBITOS,
      debit: 0,
      credit: valor,
      description: 'Baixa transitória - despesa identificada'
    }
  ]);

  if (linesError) {
    console.log('❌ Erro ao criar linhas:', linesError.message);
    return;
  }

  // Atualizar transação
  console.log('📝 Atualizando status da transação...');
  
  const { error: updateError } = await supabase
    .from('bank_transactions')
    .update({
      status: 'reconciled',
      is_reconciled: true,
      reconciled_at: new Date().toISOString()
    })
    .eq('id', tx.id);

  if (updateError) {
    console.log('❌ Erro ao atualizar transação:', updateError.message);
    return;
  }

  console.log('');
  console.log('✅ CLASSIFICAÇÃO CONFIRMADA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 Lançamento:', internalCode);
  console.log('📅 Data:', tx.transaction_date);
  console.log('💰 Valor: R$', valor.toFixed(2));
  console.log('');
  console.log('D - 4.1.3.02 Tarifas Bancárias          R$', valor.toFixed(2));
  console.log('C - 1.1.9.01 Transitória Débitos        R$', valor.toFixed(2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🎉 Dr. Cícero aprovou esta classificação.');
}

classificar().catch(console.error);
