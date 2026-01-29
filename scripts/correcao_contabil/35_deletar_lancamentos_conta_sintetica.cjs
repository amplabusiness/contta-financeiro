// scripts/correcao_contabil/35_deletar_lancamentos_conta_sintetica.cjs
// Deleta todos os lançamentos na conta sintética 1.1.2.01
// Esses lançamentos foram criados incorretamente pelo trigger de blindagem
// que deveria usar contas analíticas (1.1.2.01.xxxx) ao invés da sintética

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deletarLancamentosContaSintetica() {
  console.log('='.repeat(80));
  console.log('DELETANDO LANCAMENTOS NA CONTA SINTETICA 1.1.2.01');
  console.log('Motivo: Contas sintéticas NÃO podem receber lançamentos diretamente');
  console.log('='.repeat(80));

  // 1. Buscar a conta sintética
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01')
    .single();

  console.log('\nConta sintética:', contaSintetica.code, '-', contaSintetica.name);

  // 2. Buscar todas as linhas de lançamento nessa conta
  const { data: linhas, error: errLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id, debit, credit')
    .eq('account_id', contaSintetica.id);

  if (errLinhas) {
    console.log('ERRO ao buscar linhas:', errLinhas.message);
    return;
  }

  console.log('Linhas encontradas:', linhas?.length || 0);

  if (!linhas || linhas.length === 0) {
    console.log('Nenhuma linha para deletar!');
    return;
  }

  // Calcular totais
  let totalDebito = 0;
  let totalCredito = 0;
  for (const l of linhas) {
    totalDebito += parseFloat(l.debit) || 0;
    totalCredito += parseFloat(l.credit) || 0;
  }

  console.log('Total débito a remover: R$', totalDebito.toFixed(2));
  console.log('Total crédito a remover: R$', totalCredito.toFixed(2));

  // 3. Coletar entry_ids únicos
  const entryIds = [...new Set(linhas.map(l => l.entry_id))];
  console.log('Entries afetados:', entryIds.length);

  // 4. Deletar as linhas
  console.log('\nDeletando linhas da conta sintética...');
  const { error: errDelete } = await supabase
    .from('accounting_entry_lines')
    .delete()
    .eq('account_id', contaSintetica.id);

  if (errDelete) {
    console.log('ERRO ao deletar linhas:', errDelete.message);
    return;
  }

  console.log('Linhas deletadas com sucesso!');

  // 5. Verificar entries que ficaram "órfãos" (sem linhas)
  console.log('\nVerificando entries orfaos...');

  let entriesOrfaos = 0;
  let entriesDeletados = 0;

  for (const entryId of entryIds) {
    const { data: linhasRestantes, count } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact' })
      .eq('entry_id', entryId);

    if (!linhasRestantes || linhasRestantes.length === 0) {
      entriesOrfaos++;
      // Deletar o entry que ficou sem linhas
      const { error: errDeleteEntry } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('id', entryId);

      if (!errDeleteEntry) {
        entriesDeletados++;
      }
    }
  }

  console.log('Entries órfãos encontrados:', entriesOrfaos);
  console.log('Entries deletados:', entriesDeletados);

  // 6. Verificação final
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICACAO FINAL');
  console.log('='.repeat(80));

  const { data: verificacao } = await supabase
    .from('accounting_entry_lines')
    .select('id')
    .eq('account_id', contaSintetica.id);

  console.log('Linhas restantes na conta 1.1.2.01:', verificacao?.length || 0);

  // Equação contábil
  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  let totalDebitosGeral = 0;
  let totalCreditosGeral = 0;
  for (const l of todasLinhas || []) {
    totalDebitosGeral += parseFloat(l.debit) || 0;
    totalCreditosGeral += parseFloat(l.credit) || 0;
  }

  console.log('\nEQUACAO CONTABIL:');
  console.log('  Total Débitos:  R$', totalDebitosGeral.toFixed(2));
  console.log('  Total Créditos: R$', totalCreditosGeral.toFixed(2));
  console.log('  Diferença:      R$', Math.abs(totalDebitosGeral - totalCreditosGeral).toFixed(2));
  console.log('  Status:', Math.abs(totalDebitosGeral - totalCreditosGeral) < 0.01 ? 'OK' : 'ATENCAO');
}

deletarLancamentosContaSintetica().catch(console.error);
