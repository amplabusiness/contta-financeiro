/**
 * CORREÇÃO DR. CÍCERO - REFERENCE_TYPE E REFERENCE_ID
 *
 * Corrige lançamentos que estão sem reference_type ou reference_id
 *
 * Fundamentação: NBC TG 26, ITG 2000
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixReferenceFields() {
  console.log('='.repeat(80));
  console.log('CORREÇÃO DR. CÍCERO - REFERENCE_TYPE E REFERENCE_ID');
  console.log('='.repeat(80));
  console.log('\nData:', new Date().toLocaleString('pt-BR'));
  console.log('\n');

  // 1. Buscar lançamentos sem reference_type
  console.log('1. Buscando lançamentos sem reference_type...\n');

  const { data: entriesWithoutRefType, error: err1 } = await supabase
    .from('accounting_entries')
    .select('*')
    .is('reference_type', null);

  if (err1) {
    console.error('❌ Erro:', err1.message);
    return;
  }

  console.log(`   Encontrados: ${entriesWithoutRefType?.length || 0} lançamentos\n`);

  // 2. Corrigir cada lançamento
  if (entriesWithoutRefType && entriesWithoutRefType.length > 0) {
    console.log('2. Inferindo reference_type da descrição e source_type...\n');

    let corrigidos = 0;

    for (const entry of entriesWithoutRefType) {
      // Inferir reference_type
      let referenceType = entry.source_type || 'legacy';
      const desc = (entry.description || '').toLowerCase();

      if (desc.includes('saldo de abertura') || desc.includes('saldo inicial')) {
        referenceType = 'opening_balance';
      } else if (desc.includes('honorário') || desc.includes('honorarios') || desc.includes('fatura')) {
        referenceType = 'invoice';
      } else if (desc.includes('despesa') || desc.includes('tarifa') || desc.includes('manutenção') || desc.includes('manutencao')) {
        referenceType = 'expense';
      } else if (desc.includes('boleto') || desc.includes('liquidação') || desc.includes('liquidacao')) {
        referenceType = 'boleto';
      } else if (desc.includes('pix') || desc.includes('transf')) {
        referenceType = 'bank_transaction';
      } else if (desc.includes('recebimento')) {
        referenceType = 'payment';
      } else if (entry.source_type) {
        referenceType = entry.source_type;
      }

      // reference_id: usar source_id se existir, senão o próprio id
      const referenceId = entry.source_id || entry.id;

      // Atualizar
      const { error: updateError } = await supabase
        .from('accounting_entries')
        .update({
          reference_type: referenceType,
          reference_id: referenceId,
          source_type: entry.source_type || referenceType,
        })
        .eq('id', entry.id);

      if (!updateError) {
        corrigidos++;
        if (corrigidos <= 15) {
          console.log(`   ✅ ${entry.id.substring(0, 8)}... → type: ${referenceType}, id: ${referenceId.substring(0, 8)}...`);
        }
      } else {
        console.log(`   ❌ ${entry.id.substring(0, 8)}...: ${updateError.message}`);
      }
    }

    if (corrigidos > 15) {
      console.log(`   ... e mais ${corrigidos - 15} lançamentos`);
    }

    console.log(`\n   Total corrigidos: ${corrigidos}`);
  }

  // 3. Buscar lançamentos sem reference_id
  console.log('\n3. Buscando lançamentos sem reference_id...\n');

  const { data: entriesWithoutRefId, error: err2 } = await supabase
    .from('accounting_entries')
    .select('*')
    .is('reference_id', null);

  if (err2) {
    console.error('❌ Erro:', err2.message);
    return;
  }

  console.log(`   Encontrados: ${entriesWithoutRefId?.length || 0} lançamentos\n`);

  if (entriesWithoutRefId && entriesWithoutRefId.length > 0) {
    console.log('4. Atribuindo reference_id...\n');

    let corrigidos2 = 0;

    for (const entry of entriesWithoutRefId) {
      // Usar source_id se existir, senão o próprio id do lançamento
      const referenceId = entry.source_id || entry.id;

      const { error: updateError } = await supabase
        .from('accounting_entries')
        .update({
          reference_id: referenceId,
        })
        .eq('id', entry.id);

      if (!updateError) {
        corrigidos2++;
      }
    }

    console.log(`   Total corrigidos: ${corrigidos2}`);
  }

  // 5. Verificação final
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO FINAL');
  console.log('='.repeat(80));

  const { count: semCode } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('internal_code', null);

  const { count: semRefType } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('reference_type', null);

  const { count: semRefId } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('reference_id', null);

  const { count: total } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true });

  console.log(`\n📊 SITUAÇÃO ATUAL:`);
  console.log(`   Total de lançamentos:   ${total || 0}`);
  console.log(`   ✅ Com internal_code:   ${(total || 0) - (semCode || 0)}`);
  console.log(`   ✅ Com reference_type:  ${(total || 0) - (semRefType || 0)}`);
  console.log(`   ✅ Com reference_id:    ${(total || 0) - (semRefId || 0)}`);
  console.log('');
  console.log(`   ❌ Sem internal_code:   ${semCode || 0}`);
  console.log(`   ❌ Sem reference_type:  ${semRefType || 0}`);
  console.log(`   ❌ Sem reference_id:    ${semRefId || 0}`);

  if ((semCode || 0) === 0 && (semRefType || 0) === 0 && (semRefId || 0) === 0) {
    console.log('\n✅ CORREÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('   Todos os lançamentos agora possuem rastreabilidade completa:');
    console.log('   - internal_code: ✓');
    console.log('   - reference_type: ✓');
    console.log('   - reference_id: ✓');
  } else {
    console.log('\n⚠️ Ainda existem lançamentos pendentes.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('Assinado: Dr. Cícero - Agente IA Contábil');
  console.log('Fundamentação: NBC TG 26, ITG 2000');
  console.log('='.repeat(80));
}

fixReferenceFields().catch(console.error);
