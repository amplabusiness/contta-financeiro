/**
 * DR. CÍCERO - RECLASSIFICAR DESPESAS PESSOAIS DO SÉRGIO
 *
 * Corrige lançamentos que foram classificados como despesa da empresa,
 * mas são na verdade despesas pessoais do Sérgio Carneiro Leão.
 *
 * Despesas pessoais do Sérgio:
 * - MUNDI CONSCIENTE (Edifício Mundi - condomínio)
 * - CONDOMINIO DA GAL (residência)
 * - Qualquer outro CONDOMINIO
 * - ENERGISA (Energia do Lago das Brisas - sítio/residência)
 *
 * Conta destino: 1.1.3.04.01 (Adiantamento - Sérgio Carneiro Leão)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTA_ADIANTAMENTO_SERGIO = '1.1.3.04.01';
const MODO = process.argv[2] || 'simulacao';

async function main() {
  console.log('═'.repeat(100));
  console.log('🤖 DR. CÍCERO - RECLASSIFICAÇÃO DE DESPESAS PESSOAIS DO SÉRGIO');
  console.log(`   Modo: ${MODO.toUpperCase()}`);
  console.log('   Condomínios e Energisa (Lago das Brisas) são despesas pessoais');
  console.log('═'.repeat(100));

  // 1. Buscar conta destino (Adiantamento Sérgio)
  const { data: contaAdiantamento } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_ADIANTAMENTO_SERGIO)
    .single();

  if (!contaAdiantamento) {
    console.log(`❌ Conta ${CONTA_ADIANTAMENTO_SERGIO} não encontrada`);
    return;
  }

  console.log(`\n📌 Conta destino: ${contaAdiantamento.code} - ${contaAdiantamento.name}`);

  // 2. Buscar entries com CONDOMINIO, MUNDI ou ENERGISA na descrição
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .or('description.ilike.%CONDOMINIO%,description.ilike.%MUNDI%,description.ilike.%ENERGISA%')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  console.log(`\n📊 Entries com CONDOMÍNIO/MUNDI/ENERGISA encontrados: ${entries?.length || 0}`);

  if (!entries || entries.length === 0) {
    console.log('✅ Nenhum entry de condomínio encontrado');
    return;
  }

  let reclassificados = 0;
  let jaCorretos = 0;

  for (const entry of entries) {
    console.log(`\n[${entry.entry_date}] ${entry.description?.substring(0, 60)}`);
    console.log(`   Tipo atual: ${entry.entry_type}`);

    // Pular receitas de honorários (clientes com "MUNDIM" no nome)
    if (entry.entry_type === 'receita_honorarios') {
      console.log(`   ⏭️  Ignorado (receita de honorários)`);
      continue;
    }

    // Buscar items deste entry (débitos)
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('id, account_id, debit')
      .eq('entry_id', entry.id)
      .gt('debit', 0);

    for (const item of items || []) {
      // Verificar se já está na conta de adiantamento
      if (item.account_id === contaAdiantamento.id) {
        jaCorretos++;
        console.log(`   ✓ Já está na conta correta`);
        continue;
      }

      // Buscar conta atual
      const { data: contaAtual } = await supabase
        .from('chart_of_accounts')
        .select('code, name')
        .eq('id', item.account_id)
        .single();

      console.log(`   Conta atual: ${contaAtual?.code} - ${contaAtual?.name}`);
      console.log(`   → Reclassificar para: ${contaAdiantamento.code} - ${contaAdiantamento.name}`);

      if (MODO === 'aplicar') {
        // Atualizar item para conta de adiantamento
        const { error: itemError } = await supabase
          .from('accounting_entry_items')
          .update({ account_id: contaAdiantamento.id })
          .eq('id', item.id);

        if (itemError) {
          console.log(`   ❌ Erro item: ${itemError.message}`);
          continue;
        }

        // Atualizar entry_type
        const { error: entryError } = await supabase
          .from('accounting_entries')
          .update({ entry_type: 'ADIANTAMENTO_SOCIO' })
          .eq('id', entry.id);

        if (entryError) {
          console.log(`   ❌ Erro entry: ${entryError.message}`);
          continue;
        }

        console.log(`   ✅ Reclassificado com sucesso`);
        reclassificados++;
      } else {
        reclassificados++;
      }
    }
  }

  // Resumo
  console.log('\n' + '═'.repeat(100));
  console.log('📊 RESUMO');
  console.log('═'.repeat(100));
  console.log(`Total de entries: ${entries.length}`);
  console.log(`Reclassificados: ${reclassificados}`);
  console.log(`Já corretos: ${jaCorretos}`);

  if (MODO === 'simulacao') {
    console.log('\n💡 Para aplicar as correções, execute:');
    console.log('   node scripts/dr_cicero_reclassificar_condominios.mjs aplicar');
  }

  console.log('═'.repeat(100));
}

main().catch(console.error);
