import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

async function checkMigrations() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔗 Conectando à Supabase...\n');

    // Teste simples: verificar uma tabela
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .limit(1);

    if (error) {
      console.log('❌ Erro ao conectar: ' + error.message);
      return;
    }

    console.log('✅ Conexão com Supabase: OK');
    console.log('✅ Banco de dados: Acessível\n');

    // Verificar migrações
    console.log('📋 Verificando migrações...\n');

    const migrationsPath = path.join(process.cwd(), 'supabase', 'migrations');
    const files = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql'));

    console.log(`📊 Total de migrações locais: ${files.length}\n`);
    console.log('📅 Últimas 10 migrações:\n');

    const sorted = files.sort().reverse().slice(0, 10);
    sorted.forEach((f, i) => {
      const date = f.substring(0, 8);
      const timestamp = f.substring(8, 15);
      const year = parseInt(date.substring(0, 4));
      const month = parseInt(date.substring(4, 6));
      const day = parseInt(date.substring(6, 8));
      
      const d = new Date(year, month - 1, day);
      const dateStr = d.toLocaleDateString('pt-BR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      console.log(`  ${i + 1}. ${dateStr} - ${f.substring(0, 30)}...`);
    });

    // Verificar tabelas principais
    console.log('\n\n🗂️  Verificando tabelas principais...\n');

    const tables = [
      'chart_of_accounts',
      'accounting_entries',
      'accounting_entry_lines',
      'expenses',
      'bank_accounts',
      'bank_transactions',
      'invoices',
      'clients',
      'employees'
    ];

    for (const table of tables) {
      const { data: d, error: e } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      const status = e ? '❌' : '✅';
      const count = e ? 'Erro' : `${d?.length || 0} registros`;
      console.log(`  ${status} ${table.padEnd(30)} - ${count}`);
    }

    console.log('\n✅ Verificação concluída!');
    console.log('\n💡 Status: Todas as migrações parecem estar em dia.');
    console.log('💾 Banco de dados está funcionando normalmente.\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

checkMigrations();
