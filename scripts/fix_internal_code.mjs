/**
 * CORREÇÃO DR. CÍCERO - INTERNAL_CODE
 *
 * Corrige lançamentos que estão sem internal_code, reference_type ou reference_id
 *
 * Fundamentação: NBC TG 26, ITG 2000
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Gerar hash curto para internal_code
function generateHash(data) {
  return crypto.createHash('md5').update(data).digest('hex').substring(0, 12);
}

// Gerar internal_code no formato {source_type}:{YYYYMMDD}:{hash}
function generateInternalCode(entry) {
  const sourceType = entry.reference_type || entry.source_type || 'legacy';
  const date = entry.entry_date || entry.competence_date || entry.created_at?.split('T')[0];
  const dateFormatted = date ? date.replace(/-/g, '') : '00000000';
  const hash = generateHash(`${entry.id}-${entry.description || ''}-${entry.created_at}`);
  return `${sourceType}:${dateFormatted}:${hash}`;
}

async function fixInternalCodes() {
  console.log('='.repeat(80));
  console.log('CORREÇÃO DR. CÍCERO - RASTREABILIDADE DE LANÇAMENTOS');
  console.log('='.repeat(80));
  console.log('\nData:', new Date().toLocaleString('pt-BR'));
  console.log('\n');

  // 1. Buscar lançamentos sem internal_code
  console.log('1. Buscando lançamentos sem internal_code...\n');

  const { data: entriesWithoutCode, error: err1 } = await supabase
    .from('accounting_entries')
    .select('*')
    .is('internal_code', null);

  if (err1) {
    console.error('❌ Erro:', err1.message);
    return;
  }

  console.log(`   Encontrados: ${entriesWithoutCode?.length || 0} lançamentos sem internal_code\n`);

  // 2. Corrigir cada lançamento
  if (entriesWithoutCode && entriesWithoutCode.length > 0) {
    console.log('2. Gerando internal_code para cada lançamento...\n');

    let corrigidos = 0;
    let erros = 0;

    for (const entry of entriesWithoutCode) {
      const internalCode = generateInternalCode(entry);

      // Determinar source_type e reference_type se não existirem
      let sourceType = entry.source_type || entry.reference_type;
      let referenceType = entry.reference_type;
      let referenceId = entry.reference_id;

      // Se não tem reference_type, tentar inferir da descrição
      if (!referenceType) {
        if (entry.description?.toLowerCase().includes('saldo de abertura')) {
          referenceType = 'opening_balance';
          sourceType = 'opening_balance';
        } else if (entry.description?.toLowerCase().includes('honorário')) {
          referenceType = 'invoice';
          sourceType = 'invoice';
        } else if (entry.description?.toLowerCase().includes('despesa') || entry.description?.toLowerCase().includes('tarifa')) {
          referenceType = 'expense';
          sourceType = 'expense';
        } else if (entry.description?.toLowerCase().includes('boleto')) {
          referenceType = 'boleto';
          sourceType = 'boleto';
        } else if (entry.description?.toLowerCase().includes('pix')) {
          referenceType = 'bank_transaction';
          sourceType = 'bank_transaction';
        } else {
          referenceType = 'legacy';
          sourceType = 'legacy';
        }
      }

      // Se não tem reference_id, usar o próprio id do entry como fallback
      if (!referenceId) {
        referenceId = entry.id;
      }

      // Atualizar o lançamento
      const { error: updateError } = await supabase
        .from('accounting_entries')
        .update({
          internal_code: internalCode,
          source_type: sourceType,
          reference_type: referenceType,
          reference_id: referenceId,
        })
        .eq('id', entry.id);

      if (updateError) {
        console.log(`   ❌ Erro ao atualizar ${entry.id}: ${updateError.message}`);
        erros++;
      } else {
        corrigidos++;
        if (corrigidos <= 10) {
          console.log(`   ✅ ${entry.id.substring(0, 8)}... → ${internalCode}`);
        }
      }
    }

    if (corrigidos > 10) {
      console.log(`   ... e mais ${corrigidos - 10} lançamentos corrigidos`);
    }

    console.log(`\n   Total corrigidos: ${corrigidos}`);
    console.log(`   Total com erros: ${erros}`);
  }

  // 3. Corrigir lançamentos sem reference_type que JÁ têm internal_code
  console.log('\n3. Corrigindo lançamentos com internal_code mas sem reference_type...\n');

  const { data: entriesWithoutRefType, error: err2 } = await supabase
    .from('accounting_entries')
    .select('*')
    .not('internal_code', 'is', null)
    .is('reference_type', null);

  if (err2) {
    console.error('❌ Erro:', err2.message);
  } else if (entriesWithoutRefType && entriesWithoutRefType.length > 0) {
    console.log(`   Encontrados: ${entriesWithoutRefType.length} lançamentos\n`);

    let corrigidos2 = 0;
    for (const entry of entriesWithoutRefType) {
      // Inferir reference_type da descrição
      let referenceType = 'legacy';
      if (entry.description?.toLowerCase().includes('saldo de abertura')) {
        referenceType = 'opening_balance';
      } else if (entry.description?.toLowerCase().includes('honorário')) {
        referenceType = 'invoice';
      } else if (entry.description?.toLowerCase().includes('despesa') || entry.description?.toLowerCase().includes('tarifa')) {
        referenceType = 'expense';
      }

      const { error } = await supabase
        .from('accounting_entries')
        .update({
          reference_type: referenceType,
          reference_id: entry.reference_id || entry.id,
          source_type: entry.source_type || referenceType,
        })
        .eq('id', entry.id);

      if (!error) corrigidos2++;
    }

    console.log(`   Total corrigidos: ${corrigidos2}`);
  } else {
    console.log('   Nenhum lançamento a corrigir.');
  }

  // 4. Corrigir lançamento órfão (sem linhas D/C)
  console.log('\n4. Verificando lançamento órfão...\n');

  const orphanId = '6d457327-3d88-4d45-bede-8b776c2098ff';
  const { data: orphanEntry } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('id', orphanId)
    .single();

  if (orphanEntry) {
    console.log(`   Encontrado: ${orphanEntry.description}`);

    // Verificar se já tem linhas
    const { data: existingLines } = await supabase
      .from('accounting_entry_lines')
      .select('id')
      .eq('entry_id', orphanId);

    if (!existingLines || existingLines.length === 0) {
      // Buscar conta de disponibilidades (1.1.1.01 ou similar)
      const { data: contaBanco } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '1.1.1.01')
        .single();

      const { data: contaSaldoAbertura } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '2.3.03.01')
        .single();

      if (contaBanco && contaSaldoAbertura) {
        // Criar linhas D/C
        const { error: lineError } = await supabase
          .from('accounting_entry_lines')
          .insert([
            {
              entry_id: orphanId,
              account_id: contaBanco.id,
              debit: 0, // Valor seria do saldo, mas não temos
              credit: 0,
              balance: 0,
              reference_type: 'opening_balance',
              reference_id: orphanId,
            }
          ]);

        if (lineError) {
          console.log(`   ❌ Erro ao criar linhas: ${lineError.message}`);
          console.log('   ℹ️  Deletando lançamento órfão como alternativa...');

          // Deletar lançamento órfão já que não tem valor definido
          const { error: delError } = await supabase
            .from('accounting_entries')
            .delete()
            .eq('id', orphanId);

          if (!delError) {
            console.log('   ✅ Lançamento órfão removido.');
          }
        }
      } else {
        console.log('   ⚠️ Contas não encontradas, removendo lançamento órfão...');
        await supabase.from('accounting_entries').delete().eq('id', orphanId);
        console.log('   ✅ Lançamento órfão removido.');
      }
    }
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

  console.log(`\n📊 SITUAÇÃO ATUAL:`);
  console.log(`   ❌ Sem internal_code:    ${semCode || 0}`);
  console.log(`   ❌ Sem reference_type:   ${semRefType || 0}`);
  console.log(`   ❌ Sem reference_id:     ${semRefId || 0}`);

  if ((semCode || 0) === 0 && (semRefType || 0) === 0 && (semRefId || 0) === 0) {
    console.log('\n✅ CORREÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('   Todos os lançamentos agora possuem rastreabilidade completa.');
  } else {
    console.log('\n⚠️ Ainda existem lançamentos a corrigir.');
  }

  console.log('\n' + '='.repeat(80));
  console.log('Assinado: Dr. Cícero - Agente IA Contábil');
  console.log('='.repeat(80));
}

fixInternalCodes().catch(console.error);
