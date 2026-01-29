import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENANT = 'a53a4957-fe97-4856-b3ca-70045157b421';

async function cleanupOrphans() {
  console.log('='.repeat(70));
  console.log('LIMPEZA AUTORIZADA - Dr. Cícero');
  console.log('Data:', new Date().toISOString());
  console.log('='.repeat(70));
  
  // =========================================================================
  // PASSO 1: BACKUP DOS ÓRFÃOS (antes de deletar)
  // =========================================================================
  console.log('\n📦 PASSO 1: Backup dos entries órfãos...');
  
  // Buscar todos os entries
  const { data: allEntries } = await supabase
    .from('accounting_entries')
    .select('*')
    .eq('tenant_id', TENANT);
  
  // Buscar todas as linhas
  const { data: allLines } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id');
  
  const linkedIds = new Set((allLines || []).map(l => l.entry_id));
  
  // Identificar órfãos (entries sem linhas)
  const orphans = (allEntries || []).filter(e => !linkedIds.has(e.id));
  
  console.log(`   Encontrados: ${orphans.length} entries órfãos`);
  
  if (orphans.length > 0) {
    // Salvar backup
    const backupFile = `_backup_orphans_${Date.now()}.json`;
    fs.writeFileSync(backupFile, JSON.stringify(orphans, null, 2));
    console.log(`   ✅ Backup salvo: ${backupFile}`);
    
    // Filtrar apenas os que têm mais de 1 hora (segurança)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const orphansToDelete = orphans.filter(e => new Date(e.created_at) < oneHourAgo);
    
    console.log(`   Órfãos com mais de 1 hora: ${orphansToDelete.length}`);
    
    if (orphansToDelete.length > 0) {
      const orphanIds = orphansToDelete.map(e => e.id);
      
      // Deletar em batches de 50
      let deleted = 0;
      for (let i = 0; i < orphanIds.length; i += 50) {
        const batch = orphanIds.slice(i, i + 50);
        const { error } = await supabase
          .from('accounting_entries')
          .delete()
          .in('id', batch);
        
        if (error) {
          console.log(`   ❌ Erro no batch ${i}: ${error.message}`);
        } else {
          deleted += batch.length;
        }
      }
      
      console.log(`   ✅ Deletados: ${deleted} entries órfãos`);
    }
  }
  
  // =========================================================================
  // PASSO 2: PREENCHER INTERNAL_CODES FALTANTES
  // =========================================================================
  console.log('\n🏷️  PASSO 2: Preencher internal_codes faltantes...');
  
  // Buscar entries sem internal_code
  const { data: entriesWithoutCode } = await supabase
    .from('accounting_entries')
    .select('id, created_at, entry_type, reference_type, source_type')
    .eq('tenant_id', TENANT)
    .or('internal_code.is.null,internal_code.eq.');
  
  console.log(`   Encontrados: ${entriesWithoutCode?.length || 0} sem internal_code`);
  
  if (entriesWithoutCode && entriesWithoutCode.length > 0) {
    let updated = 0;
    
    for (const entry of entriesWithoutCode) {
      // Gerar código baseado na origem
      let prefix = 'LEGACY';
      if (entry.source_type) {
        prefix = entry.source_type.toUpperCase().substring(0, 10);
      } else if (entry.reference_type) {
        prefix = entry.reference_type.toUpperCase().substring(0, 10);
      } else if (entry.entry_type) {
        prefix = entry.entry_type.toUpperCase().substring(0, 10);
      }
      
      const dateStr = new Date(entry.created_at).toISOString().substring(0, 10).replace(/-/g, '');
      const shortId = entry.id.substring(0, 8);
      const internalCode = `${prefix}:${dateStr}:${shortId}`;
      
      const { error } = await supabase
        .from('accounting_entries')
        .update({ internal_code: internalCode })
        .eq('id', entry.id);
      
      if (!error) {
        updated++;
      }
    }
    
    console.log(`   ✅ Atualizados: ${updated} internal_codes`);
  }
  
  // =========================================================================
  // PASSO 3: VERIFICAÇÃO FINAL
  // =========================================================================
  console.log('\n🔍 PASSO 3: Verificação final...');
  
  const { data: integrity } = await supabase.rpc('rpc_check_accounting_integrity', {
    p_tenant_id: TENANT
  });
  
  console.log('\nResultado da integridade:');
  console.log(JSON.stringify(integrity, null, 2));
  
  // =========================================================================
  // RESUMO
  // =========================================================================
  console.log('\n' + '='.repeat(70));
  console.log('RESUMO DA LIMPEZA:');
  console.log('='.repeat(70));
  
  if (integrity?.is_healthy) {
    console.log('✅ Sistema SAUDÁVEL após limpeza!');
    console.log('\n📌 Próximo passo: Classificar as transações bancárias pendentes');
  } else {
    console.log('⚠️ Ainda existem problemas:');
    integrity?.problems?.forEach(p => {
      console.log(`   - ${p.type}: ${p.count || p.balance}`);
    });
    console.log('\n📌 Próximo passo: Resolver problemas restantes');
  }
  
  console.log('\n');
}

cleanupOrphans().catch(console.error);
