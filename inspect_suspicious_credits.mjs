
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let envContent = '';
const envPathLocal = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPathLocal)) {
  envContent = fs.readFileSync(envPathLocal, 'utf-8');
  if (!envContent.includes('VITE_SUPABASE_SERVICE_ROLE_KEY') && fs.existsSync(envPath)) {
      envContent += '\n' + fs.readFileSync(envPath, 'utf-8');
  }
} else if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const serviceKeyMatch = envContent.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const supabaseUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
const supabaseKey = serviceKeyMatch[1].trim().replace(/^["']|["']$/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('🕵️  Investigando Origem dos Créditos em 1.1.2.01...');

  // 1. Validate Account ID
  const { data: acc } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.2.01').single();
  if (!acc) { console.error('Conta não encontrada'); return; }

  // 2. Fetch Credit Lines
  const { data: lines, error: lineError } = await supabase
    .from('accounting_entry_lines')
    .select('credit, entry_id')
    .eq('account_id', acc.id)
    .gt('credit', 0);
  
  if (lineError) { console.error(lineError); return; }
  
  console.log(`Encontradas ${lines.length} linhas de crédito.`);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);
  console.log(`Total Crédito na Linha: R$ ${totalCredit.toFixed(2)}`);
  
  // 3. Get Entry Types
  const entryIds = [...new Set(lines.map(l => l.entry_id))];
  // Fetch entries in chunks if needed, but assuming small enough
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_type, description')
    .in('id', entryIds);
    
  if (!entries) return;
  
  const typeMap = {};
  entries.forEach(e => {
      if (!typeMap[e.entry_type]) typeMap[e.entry_type] = 0;
      // Find lines for this entry
      const entryLines = lines.filter(l => l.entry_id === e.id);
      const sum = entryLines.reduce((s, l) => s + Number(l.credit), 0);
      typeMap[e.entry_type] += sum;
  });
  
  console.log('\nResumo por Tipo de Lançamento:');
  for (const [type, sum] of Object.entries(typeMap)) {
      console.log(`- ${type}: R$ ${Number(sum).toFixed(2)}`);
  }
}

inspect();
