// scripts/correcao_contabil/36_deletar_lancamentos_trigger_blindagem.cjs
// Deleta todos os lançamentos criados pelo trigger de blindagem incorreto
// Esses lançamentos usaram a conta sintética 1.1.2.01 em vez das analíticas

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deletarLancamentosTriggerBlindagem() {
  console.log('='.repeat(80));
  console.log('DELETANDO LANCAMENTOS DO TRIGGER DE BLINDAGEM INCORRETO');
  console.log('Identificados por: entry_type = opening_balance');
  console.log('Motivo: Usaram conta sintética 1.1.2.01 ao invés de analíticas');
  console.log('='.repeat(80));

  // 1. Buscar todos os entries criados pelo trigger de blindagem
  const { data: entries, error: errEntries } = await supabase
    .from('accounting_entries')
    .select('id, entry_type, description, history')
    .eq('entry_type', 'opening_balance');

  if (errEntries) {
    console.log('ERRO ao buscar entries:', errEntries.message);
    return;
  }

  console.log('\nEntries do trigger de blindagem:', entries?.length || 0);

  if (!entries || entries.length === 0) {
    console.log('Nenhum entry para deletar!');
    return;
  }

  // 2. Para cada entry, deletar suas linhas primeiro
  console.log('\nDeletando linhas dos entries...');
  let linhasDeletadas = 0;
  let entriesDeletados = 0;

  for (const entry of entries) {
    // Deletar linhas
    const { data: linhas } = await supabase
      .from('accounting_entry_lines')
      .delete()
      .eq('entry_id', entry.id)
      .select();

    linhasDeletadas += linhas?.length || 0;

    // Deletar entry
    const { error: errDelete } = await supabase
      .from('accounting_entries')
      .delete()
      .eq('id', entry.id);

    if (!errDelete) {
      entriesDeletados++;
    }
  }

  console.log('Linhas deletadas:', linhasDeletadas);
  console.log('Entries deletados:', entriesDeletados);

  // 3. Verificação final - equação contábil
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICACAO FINAL');
  console.log('='.repeat(80));

  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  let totalDebitos = 0;
  let totalCreditos = 0;
  for (const l of todasLinhas || []) {
    totalDebitos += parseFloat(l.debit) || 0;
    totalCreditos += parseFloat(l.credit) || 0;
  }

  console.log('\nEQUACAO CONTABIL:');
  console.log('  Total Débitos:  R$', totalDebitos.toFixed(2));
  console.log('  Total Créditos: R$', totalCreditos.toFixed(2));
  console.log('  Diferença:      R$', Math.abs(totalDebitos - totalCreditos).toFixed(2));
  console.log('  Status:', Math.abs(totalDebitos - totalCreditos) < 0.01 ? 'OK' : 'ATENCAO');

  // 4. Verificar conta 1.1.2.01 novamente
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  const { data: linhasSintetica } = await supabase
    .from('accounting_entry_lines')
    .select('id')
    .eq('account_id', contaSintetica.id);

  console.log('\nLinhas na conta sintética 1.1.2.01:', linhasSintetica?.length || 0);
}

deletarLancamentosTriggerBlindagem().catch(console.error);
