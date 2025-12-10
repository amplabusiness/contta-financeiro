// Script para executar migration SQL via Supabase Management API
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

async function runMigration() {
  console.log('Executando migration para criar tabela ai_learned_patterns...\n');

  // Criar cliente com service role para ter acesso total
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Verificar se tabela já existe
  console.log('1. Verificando se tabela já existe...');
  const { data: checkData, error: checkError } = await supabase
    .from('ai_learned_patterns')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✅ Tabela ai_learned_patterns já existe!');

    // Contar registros
    const { count } = await supabase
      .from('ai_learned_patterns')
      .select('*', { count: 'exact', head: true });

    console.log(`   ${count || 0} padrões de classificação cadastrados.\n`);
    return;
  }

  // "Could not find the table" também significa que não existe
  if (checkError && !checkError.message.includes('does not exist') && !checkError.message.includes('Could not find')) {
    console.log('⚠️ Erro inesperado:', checkError.message);
    return;
  }

  // Tabela não existe - tentar criar via pg connection
  console.log('❌ Tabela não existe. Tentando criar via postgres-js...\n');

  const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '20250110_ai_learned_patterns.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Tentar via pg usando a connection pooler
  try {
    const { default: postgres } = await import('postgres');

    // Connection string do Supabase (Transaction mode)
    const connectionString = 'postgresql://postgres.xdtlhzysrpoinqtsglmr:Ampla202430@@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

    console.log('Conectando ao PostgreSQL...');
    const pg = postgres(connectionString, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 30
    });

    console.log('Executando migration SQL...');
    await pg.unsafe(sql);

    console.log('✅ Migration executada com sucesso!');
    await pg.end();

    // Verificar se funcionou
    const { count } = await supabase
      .from('ai_learned_patterns')
      .select('*', { count: 'exact', head: true });

    console.log(`✅ Tabela criada com ${count || 0} padrões iniciais.`);
    return;

  } catch (pgError) {
    console.log('⚠️ Erro ao conectar via postgres:', pgError.message);
    console.log('\nA tabela precisa ser criada manualmente.\n');
  }

  console.log('='.repeat(60));
  console.log('⚠️  Execute o SQL abaixo no Dashboard do Supabase:');
  console.log('   https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new');
  console.log('='.repeat(60));
  console.log(sql);
}

runMigration().catch(console.error);
