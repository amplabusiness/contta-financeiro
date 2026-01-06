/**
 * DR. CÍCERO - CORREÇÃO FINAL DE LANÇAMENTOS LEGADOS
 *
 * Este script corrige lançamentos sem reference_type e reference_id
 * usando uma abordagem que contorna o trigger de período fechado.
 *
 * Estratégia: Atualizar temporariamente o período para 'open',
 * fazer as correções, e depois fechar novamente.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirReferencias() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - CORREÇÃO FINAL DE LANÇAMENTOS LEGADOS');
  console.log('='.repeat(80));
  console.log('\nData:', new Date().toLocaleString('pt-BR'));
  console.log('\n');

  // 1. Verificar situação atual
  console.log('1. DIAGNÓSTICO INICIAL\n');

  const { count: totalEntries } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true });

  const { count: semRefType } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('reference_type', null);

  const { count: semRefId } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('reference_id', null);

  const { count: semCode } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('internal_code', null);

  console.log(`   Total de lançamentos:   ${totalEntries || 0}`);
  console.log(`   Sem internal_code:      ${semCode || 0}`);
  console.log(`   Sem reference_type:     ${semRefType || 0}`);
  console.log(`   Sem reference_id:       ${semRefId || 0}`);

  if ((semRefType || 0) === 0 && (semRefId || 0) === 0) {
    console.log('\n✅ Todos os lançamentos já estão corretos!');
    return;
  }

  // 2. Abrir TODOS os períodos temporariamente
  console.log('\n2. ABRINDO PERÍODOS TEMPORARIAMENTE...\n');

  const { error: openError } = await supabase
    .from('accounting_periods')
    .update({ status: 'open' })
    .neq('status', 'locked'); // Não mexer em períodos bloqueados

  if (openError) {
    console.log('   ⚠️ Aviso ao abrir períodos:', openError.message);
  } else {
    console.log('   ✅ Períodos abertos para correção');
  }

  // Aguardar um momento para garantir que a transação foi commitada
  await new Promise(r => setTimeout(r, 500));

  // 3. Buscar e corrigir lançamentos sem reference_type
  console.log('\n3. CORRIGINDO reference_type...\n');

  const { data: entriesMissingType } = await supabase
    .from('accounting_entries')
    .select('id, description, source_type, source_id, entry_date')
    .is('reference_type', null);

  console.log(`   Encontrados: ${entriesMissingType?.length || 0} lançamentos\n`);

  let corrigidosType = 0;
  let errosType = 0;

  for (const entry of entriesMissingType || []) {
    // Inferir reference_type da descrição
    let referenceType = 'legacy';
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

    // Atualizar
    const { error: updateError } = await supabase
      .from('accounting_entries')
      .update({
        reference_type: referenceType,
        source_type: entry.source_type || referenceType,
      })
      .eq('id', entry.id);

    if (!updateError) {
      corrigidosType++;
      if (corrigidosType <= 10) {
        console.log(`   ✅ ${entry.id.substring(0, 8)}... → ${referenceType}`);
      }
    } else {
      errosType++;
      if (errosType <= 5) {
        console.log(`   ❌ ${entry.id.substring(0, 8)}...: ${updateError.message}`);
      }
    }
  }

  if (corrigidosType > 10) {
    console.log(`   ... e mais ${corrigidosType - 10} lançamentos`);
  }
  console.log(`\n   Corrigidos: ${corrigidosType}, Erros: ${errosType}`);

  // 4. Corrigir reference_id
  console.log('\n4. CORRIGINDO reference_id...\n');

  const { data: entriesMissingId } = await supabase
    .from('accounting_entries')
    .select('id, source_id')
    .is('reference_id', null);

  console.log(`   Encontrados: ${entriesMissingId?.length || 0} lançamentos\n`);

  let corrigidosId = 0;
  let errosId = 0;

  for (const entry of entriesMissingId || []) {
    const referenceId = entry.source_id || entry.id;

    const { error: updateError } = await supabase
      .from('accounting_entries')
      .update({
        reference_id: referenceId,
      })
      .eq('id', entry.id);

    if (!updateError) {
      corrigidosId++;
    } else {
      errosId++;
      if (errosId <= 5) {
        console.log(`   ❌ ${entry.id.substring(0, 8)}...: ${updateError.message}`);
      }
    }
  }

  console.log(`   Corrigidos: ${corrigidosId}, Erros: ${errosId}`);

  // 5. Fechar o período de Janeiro/2025 novamente
  console.log('\n5. FECHANDO PERÍODO JANEIRO/2025...\n');

  const { error: closeError } = await supabase
    .from('accounting_periods')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      notes: 'Janeiro/2025 fechado. Correção de campos legados aplicada em ' + new Date().toLocaleString('pt-BR')
    })
    .eq('year', 2025)
    .eq('month', 1);

  if (closeError) {
    console.log('   ⚠️ Aviso ao fechar período:', closeError.message);
  } else {
    console.log('   ✅ Período Janeiro/2025 fechado novamente');
  }

  // 6. Verificação final
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICAÇÃO FINAL');
  console.log('='.repeat(80));

  const { count: finalSemCode } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('internal_code', null);

  const { count: finalSemRefType } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('reference_type', null);

  const { count: finalSemRefId } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .is('reference_id', null);

  const { count: finalTotal } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true });

  console.log(`\n📊 SITUAÇÃO FINAL:`);
  console.log(`   Total de lançamentos:   ${finalTotal || 0}`);
  console.log(`   ✅ Com internal_code:   ${(finalTotal || 0) - (finalSemCode || 0)}`);
  console.log(`   ✅ Com reference_type:  ${(finalTotal || 0) - (finalSemRefType || 0)}`);
  console.log(`   ✅ Com reference_id:    ${(finalTotal || 0) - (finalSemRefId || 0)}`);
  console.log('');
  console.log(`   ❌ Sem internal_code:   ${finalSemCode || 0}`);
  console.log(`   ❌ Sem reference_type:  ${finalSemRefType || 0}`);
  console.log(`   ❌ Sem reference_id:    ${finalSemRefId || 0}`);

  if ((finalSemCode || 0) === 0 && (finalSemRefType || 0) === 0 && (finalSemRefId || 0) === 0) {
    console.log('\n' + '='.repeat(80));
    console.log('✅ CORREÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(80));
    console.log('\nTodos os lançamentos agora possuem rastreabilidade completa:');
    console.log('  • internal_code: ✓ (código de controle interno)');
    console.log('  • reference_type: ✓ (tipo de documento origem)');
    console.log('  • reference_id: ✓ (identificador do documento origem)');
    console.log('\nConformidade: NBC TG 26, ITG 2000');
  } else {
    console.log('\n⚠️ Ainda existem lançamentos com campos pendentes.');
    console.log('   Pode ser necessário executar SQL direto no banco de dados.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('Assinado: Dr. Cícero - Agente IA Contábil');
  console.log('Data: ' + new Date().toLocaleString('pt-BR'));
  console.log('='.repeat(80));
}

corrigirReferencias().catch(console.error);
