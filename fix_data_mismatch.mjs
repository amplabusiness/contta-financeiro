
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ler variáveis de ambiente
let envContent = '';
const envPathLocal = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPathLocal)) {
  envContent = fs.readFileSync(envPathLocal, 'utf-8');
} else if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
} else {
  console.error('❌ Arquivo .env não encontrado!');
  process.exit(1);
}

const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);
let keyMatch2 = null;

if (!urlMatch || !keyMatch) {
    keyMatch2 = envContent.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.+)/); // Try service role first for admin ops?
    if (!keyMatch2) {
        keyMatch2 = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
    }
    
    if (!urlMatch || !keyMatch2) {
        console.error('❌ Credenciais Supabase não encontradas no .env');
        process.exit(1);
    }
}

const supabaseUrl = urlMatch[1].trim();
// Helper to try Key 1 then Key 2? No, just pick one. 
// Attempt to use SERVICE ROLE if available in env (common in backend scripts)
// Otherwise fallback to ANON (which might fail due to RLS if not configured right)
const supabaseKey = (envContent.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1] || (keyMatch ? keyMatch[1] : keyMatch2[1])).trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixData() {
  console.log('🔧 Iniciando Correção de Dados: Migrando Items -> Lines...');

  // 1. Buscar Itens de 'SALDO_ABERTURA' que não estão em Lines
  // Using query requires permissions.
  // Note: Standard Supabase client doesn't support complex JOIN in simple select easily without view or foreign keys correctly mapped.
  // But we can do it in two steps.
  
  // Step A: Get Entries of type SALDO_ABERTURA
  const { data: entries, error: errEntries } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('entry_type', 'SALDO_ABERTURA');
    
  if (errEntries) { console.error('Error fetching entries:', errEntries); return; }
  
  const entryIds = entries.map(e => e.id);
  console.log(`   Encontrados ${entryIds.length} lançamentos de SALDO_ABERTURA.`);
  
  if (entryIds.length === 0) return;

  // Step B: Check LINES for these entries
  const { data: lines, error: errLines } = await supabase
    .from('accounting_entry_lines')
    .select('entry_id')
    .in('entry_id', entryIds);
    
  if (errLines) { console.error('Error fetching lines:', errLines); return; }
  console.log(`   Encontrados ${lines.length} linhas na tabela NOVA (accounting_entry_lines) para estes lançamentos.`);

  if (lines.length === 0) {
      console.log('⚠️  ALERTA: Entradas existem mas não têm linhas! (Orphaned Entries)');
      console.log('   Isto confirma que o disparador escreveu na tabela errada ou a gravação falhou.');
      
      // Try to read ITEMS again? Or reconstruct from somewhere else?
      // Since I can't read ITEMS (RLS likely), I can't migrate them easily from here.
      // But I can instruct the user to run the SQL Migration which runs as Owner (bypassing RLS).
      // OR I can delete these orphaned entries and re-run valid insertion logic?
  }
}

fixData();
