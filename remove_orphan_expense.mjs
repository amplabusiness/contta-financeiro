import { createClient } from '@supabase/supabase-js';

// Credenciais do .env
const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

async function removeOrphanExpense() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔍 Procurando lançamento órfão...\n');

    // Step 1: Encontrar a conta 4.1.2.13.02
    const { data: accounts, error: accountError } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '4.1.2.13.02');

    if (accountError) throw accountError;
    if (!accounts || accounts.length === 0) {
      console.log('❌ Conta 4.1.2.13.02 não encontrada');
      return;
    }

    const accountId = accounts[0].id;
    console.log(`✅ Conta encontrada: ${accountId}`);

    // Step 2: Encontrar TODAS as entradas com lançamento para esta conta
    console.log('\n📋 Analisando lançamentos para a conta 4.1.2.13.02...\n');
    
    const { data: lines, error: linesError } = await supabase
      .from('accounting_entry_lines')
      .select('id, entry_id, debit, credit, entry_id(id, entry_date, description, reference_type, reference_id)')
      .eq('account_id', accountId);

    if (linesError) throw linesError;
    if (!lines || lines.length === 0) {
      console.log('✅ Nenhum lançamento encontrado para esta conta!');
      return;
    }

    console.log(`Encontrados ${lines.length} lançamento(s) para a conta 4.1.2.13.02`);

    // Filtrar entradas órfãs (sem despesa correspondente)
    const orphanEntries = [];
    for (const line of lines) {
      const entry = line.entry_id;
      const { data: expense } = await supabase
        .from('expenses')
        .select('id')
        .eq('id', entry.reference_id);

      const isOrphan = !expense || expense.length === 0;
      const value = line.debit > 0 ? line.debit : line.credit;
      
      console.log(`  - ${entry.entry_date} | ${entry.description?.substring(0, 40) || '(sem descrição)'} | R$ ${value.toFixed(2)} | ${isOrphan ? '🔴 ÓRFÃO' : '✅ OK'}`);

      if (isOrphan) {
        orphanEntries.push({
          ...entry,
          lineId: line.id,
          value: value
        });
      }
    }

    if (orphanEntries.length === 0) {
      console.log('\n✅ Nenhum lançamento órfão encontrado!');
      return;
    }

    // Step 3: Deletar lançamentos órfãos
    const entryIds = orphanEntries.map(e => e.id);
    
    console.log(`\n🗑️  Deletando ${orphanEntries.length} lançamento(s) órfão(s)...\n`);

    // Deletar linhas contábeis
    const { error: linesDeleteError } = await supabase
      .from('accounting_entry_lines')
      .delete()
      .in('entry_id', entryIds);

    if (linesDeleteError) throw linesDeleteError;
    console.log(`✅ Linhas contábeis deletadas`);

    // Deletar entradas contábeis
    const { error: entriesDeleteError } = await supabase
      .from('accounting_entries')
      .delete()
      .in('id', entryIds);

    if (entriesDeleteError) throw entriesDeleteError;
    console.log(`✅ Entradas contábeis deletadas`);

    console.log(`\n✅ Lançamento órfão removido com sucesso!`);
    console.log(`\n📊 A DRE será atualizada automaticamente.`);

  } catch (error) {
    console.error('❌ Erro ao remover lançamento órfão:', error);
    process.exit(1);
  }
}

removeOrphanExpense();
