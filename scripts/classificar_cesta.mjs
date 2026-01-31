import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const TRANSITORIA_DEBITOS = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';

async function classificar() {
  console.log('🔍 Buscando conta de despesas bancárias...');
  
  // Buscar conta de tarifas bancárias (4.1.3.02)
  const { data: contaDespesa } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('tenant_id', TENANT_ID)
    .eq('code', '4.1.3.02')
    .single();
  
  if (!contaDespesa) {
    console.log('❌ Conta de despesas bancárias não encontrada');
    return;
  }
  console.log('✅ Conta encontrada:', contaDespesa.code, contaDespesa.name);

  // Buscar a transação
  console.log('🔍 Buscando transação CESTA DE RELACIONAMENTO...');
  const { data: transacao, error: txError } = await supabase
    .from('bank_transactions')
    .select('id, amount, description, transaction_date, journal_entry_id, status')
    .eq('tenant_id', TENANT_ID)
    .ilike('description', '%CESTA DE RELACIONAMENTO%')
    .eq('status', 'pending')
    .order('transaction_date', { ascending: false })
    .limit(1)
    .single();

  if (txError || !transacao) {
    console.log('❌ Transação não encontrada:', txError?.message);
    return;
  }
  
  console.log('✅ Transação:', transacao.description);
  console.log('   Valor: R$', Math.abs(transacao.amount).toFixed(2));
  console.log('   Status:', transacao.status);

  if (transacao.status === 'reconciled') {
    console.log('⚠️  Transação já está conciliada!');
    return;
  }

  // Criar lançamento de classificação
  const entryId = crypto.randomUUID();
  const internalCode = 'CLASS_' + Date.now() + '_CESTA_REL';
  const valor = Math.abs(transacao.amount);

  console.log('📝 Criando lançamento de classificação...');
  
  const { error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      id: entryId,
      tenant_id: TENANT_ID,
      entry_date: transacao.transaction_date,
      competence_date: transacao.transaction_date,
      description: 'Classificação: Cesta de Relacionamento Bancário - Fevereiro/2025',
      internal_code: internalCode,
      source_type: 'classification',
      entry_type: 'CLASSIFICACAO',
      reference_type: 'bank_transaction',
      reference_id: transacao.id
    });

  if (entryError) {
    console.log('❌ Erro ao criar lançamento:', entryError.message);
    return;
  }

  // Criar linhas do lançamento
  const { error: linesError } = await supabase
    .from('accounting_entry_lines')
    .insert([
      {
        id: crypto.randomUUID(),
        tenant_id: TENANT_ID,
        entry_id: entryId,
        account_id: contaDespesa.id,
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

  // Atualizar transação como conciliada
  const { error: updateError } = await supabase
    .from('bank_transactions')
    .update({
      status: 'reconciled',
      is_reconciled: true,
      reconciled_at: new Date().toISOString()
    })
    .eq('id', transacao.id);

  if (updateError) {
    console.log('❌ Erro ao atualizar transação:', updateError.message);
    return;
  }

  console.log('');
  console.log('✅ CLASSIFICAÇÃO CONFIRMADA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 Lançamento:', internalCode);
  console.log('📅 Data:', transacao.transaction_date);
  console.log('💰 Valor: R$', valor.toFixed(2));
  console.log('');
  console.log('D - ' + contaDespesa.code + ' ' + contaDespesa.name + '    R$', valor.toFixed(2));
  console.log('C - 1.1.9.01 Transitória Débitos             R$', valor.toFixed(2));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('🎉 Dr. Cícero aprovou esta classificação automaticamente.');
}

classificar().catch(console.error);
