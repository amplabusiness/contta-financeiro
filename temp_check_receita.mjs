import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('=== VERIFICANDO LANÇAMENTOS DE RECEITA HONORÁRIOS ===\n');

  // Buscar lançamentos de receita_honorarios
  const { data: entries, error: entriesError } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, competence_date, description, entry_type')
    .eq('entry_type', 'receita_honorarios')
    .gte('competence_date', '2025-01-01')
    .lte('competence_date', '2025-01-31')
    .limit(10);

  if (entriesError) {
    console.log('Erro ao buscar lançamentos:', entriesError.message);
    return;
  }

  console.log('Lançamentos receita_honorarios em Janeiro/2025:', entries ? entries.length : 0);

  if (entries && entries.length > 0) {
    for (const e of entries) {
      console.log('\n--- Lançamento ID:', e.id, '---');
      console.log('Data:', e.entry_date, '| Competência:', e.competence_date);
      console.log('Descrição:', e.description);

      // Buscar linhas deste lançamento
      const { data: lines, error: linesError } = await supabase
        .from('accounting_entry_lines')
        .select('id, debit, credit, description, chart_of_accounts(code, name)')
        .eq('entry_id', e.id);

      if (linesError) {
        console.log('Erro ao buscar linhas:', linesError.message);
        continue;
      }

      console.log('Linhas:', lines ? lines.length : 0);
      if (lines && lines.length > 0) {
        let totalD = 0, totalC = 0;
        for (const l of lines) {
          const conta = l.chart_of_accounts ? l.chart_of_accounts.code + ' ' + l.chart_of_accounts.name : 'N/A';
          const d = Number(l.debit) || 0;
          const c = Number(l.credit) || 0;
          totalD += d;
          totalC += c;
          console.log('  D:', d.toFixed(2).padStart(10), '| C:', c.toFixed(2).padStart(10), '|', conta.substring(0, 50));
        }
        console.log('  TOTAL: D:', totalD.toFixed(2), '| C:', totalC.toFixed(2), '| Diferença:', (totalD - totalC).toFixed(2));
      }
    }
  }

  // Verificar se existem lançamentos de saldo_abertura de clientes
  console.log('\n\n=== VERIFICANDO SALDO DE ABERTURA CLIENTES ===');
  const { data: saldoAbertura, error: saldoError } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, competence_date, description, entry_type')
    .eq('entry_type', 'saldo_abertura')
    .ilike('description', '%honorar%')
    .limit(10);

  if (saldoError) {
    console.log('Erro:', saldoError.message);
  } else {
    console.log('Lançamentos saldo_abertura de honorários:', saldoAbertura ? saldoAbertura.length : 0);
    if (saldoAbertura && saldoAbertura.length > 0) {
      for (const e of saldoAbertura) {
        console.log('\n--- Lançamento ID:', e.id, '---');
        console.log('Data:', e.entry_date, '| Competência:', e.competence_date);
        console.log('Descrição:', e.description);

        const { data: lines } = await supabase
          .from('accounting_entry_lines')
          .select('id, debit, credit, description, chart_of_accounts(code, name)')
          .eq('entry_id', e.id);

        if (lines && lines.length > 0) {
          for (const l of lines) {
            const conta = l.chart_of_accounts ? l.chart_of_accounts.code + ' ' + l.chart_of_accounts.name : 'N/A';
            console.log('  D:', (Number(l.debit) || 0).toFixed(2).padStart(10), '| C:', (Number(l.credit) || 0).toFixed(2).padStart(10), '|', conta.substring(0, 50));
          }
        }
      }
    }
  }
}

check().catch(console.error);
