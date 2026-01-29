// scripts/correcao_contabil/80_saldo_abertura_sicredi.cjs
// Criar saldo de abertura do Banco Sicredi em 31/12/2024

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALOR = 90725.06;
const DATA_ENTRY = '2024-12-31';
const DATA_COMPETENCIA = '2024-12-01';

async function criarSaldoAberturaSicredi() {
  console.log('='.repeat(80));
  console.log('CRIANDO SALDO DE ABERTURA - SICREDI');
  console.log('='.repeat(80));
  console.log(`Valor: R$ ${VALOR.toFixed(2)}`);
  console.log(`Data: ${DATA_ENTRY}`);

  // Buscar conta Banco Sicredi (1.1.1.02)
  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.1.02')
    .single();

  if (!contaBanco) {
    console.error('❌ Conta Banco Sicredi (1.1.1.02) não encontrada!');
    return;
  }
  console.log(`\n📊 Conta Banco: ${contaBanco.code} - ${contaBanco.name}`);

  // Buscar conta Lucros Acumulados (5.2.1.01)
  const { data: contaPL } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '5.2.1.01')
    .single();

  if (!contaPL) {
    console.error('❌ Conta Lucros Acumulados (5.2.1.01) não encontrada!');
    return;
  }
  console.log(`📊 Conta PL: ${contaPL.code} - ${contaPL.name}`);

  // Verificar se já existe lançamento
  const { data: existing } = await supabase
    .from('accounting_entry_items')
    .select('id, debit, accounting_entries(entry_type, description)')
    .eq('account_id', contaBanco.id)
    .eq('debit', VALOR);

  if (existing && existing.length > 0) {
    console.log(`\n⚠️  Já existe lançamento de R$ ${VALOR.toFixed(2)} na conta Sicredi`);
    console.log('Lançamento existente:', JSON.stringify(existing[0], null, 2));
    return;
  }

  // Criar entry
  const { data: entry, error: errEntry } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: DATA_ENTRY,
      competence_date: DATA_COMPETENCIA,
      entry_type: 'SALDO_ABERTURA',
      description: 'Saldo de abertura - Banco Sicredi - Conta Principal',
      total_debit: VALOR,
      total_credit: VALOR,
      balanced: true
    })
    .select()
    .single();

  if (errEntry) {
    console.error('❌ Erro ao criar entry:', errEntry.message);
    return;
  }
  console.log(`\n✅ Entry criado: ${entry.id}`);

  // Criar items (D-Banco, C-PL)
  const { error: errItems } = await supabase
    .from('accounting_entry_items')
    .insert([
      {
        entry_id: entry.id,
        account_id: contaBanco.id,
        debit: VALOR,
        credit: 0,
        history: 'Saldo de abertura - Sicredi Conta Principal'
      },
      {
        entry_id: entry.id,
        account_id: contaPL.id,
        debit: 0,
        credit: VALOR,
        history: 'Contrapartida saldo abertura - Sicredi'
      }
    ]);

  if (errItems) {
    console.error('❌ Erro ao criar items:', errItems.message);
    await supabase.from('accounting_entries').delete().eq('id', entry.id);
    return;
  }

  console.log('✅ Items criados com sucesso!');
  console.log('');
  console.log('='.repeat(80));
  console.log('📌 LANÇAMENTO CRIADO:');
  console.log('='.repeat(80));
  console.log(`   D - 1.1.1.02 Banco Sicredi:       R$ ${VALOR.toFixed(2)}`);
  console.log(`   C - 5.2.1.01 Lucros Acumulados:   R$ ${VALOR.toFixed(2)}`);
  console.log('='.repeat(80));
}

criarSaldoAberturaSicredi().catch(console.error);
