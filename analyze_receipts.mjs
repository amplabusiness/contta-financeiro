
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

async function analyze() {
  console.log('🕵️  Analysando Recebimentos Suspeitos (Top 50)...');

  // 1. Get Account ID for 1.1.2.01
  const { data: acc } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.2.01').single();
  
  // 2. Get Lines with Credit > 1000 (filtering small payments to focus on big distortions)
  const { data: lines, error: lineError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      credit,
      description,
      accounting_entries!inner(
        id,
        entry_date,
        description,
        history,
        reference_id,
        reference_type,
        invoice_id
      )
    `)
    .eq('account_id', acc.id)
    .gt('credit', 1000) 
    .order('credit', { ascending: false })
    .limit(50);

  if (lineError) { console.error(lineError); return; }

  // Fetch Bank Transaction descriptions if possible
  const transactionIds = lines
    .map(l => l.accounting_entries.reference_id)
    .filter((id, idx) => id && lines[idx].accounting_entries.reference_type === 'BANK_TRANSACTION');
    
  const txMap = {};
  if (transactionIds.length > 0) {
      const { data: txs } = await supabase
        .from('bank_transactions')
        .select('id, description')
        .in('id', transactionIds);
        
      txs?.forEach(t => txMap[t.id] = t.description);
  }

  console.log(`\nTop 50 Créditos > R$ 1.000,00 em Clientes a Receber:`);
  console.log('-------------------------------------------------------------------------------------------------------------------------');
  console.log('ID                                   | VALOR          | INVOICE? | DESC');
  console.log('-------------------------------------------------------------------------------------------------------------------------');
  
  lines.forEach(l => {
      const entry = l.accounting_entries;
      const amount = Number(l.credit).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}).padStart(15, ' ');
      
      let realDesc = entry.history || entry.description || '';
      if ((entry.reference_type === 'BANK_TRANSACTION' || entry.reference_type === 'bank_transaction') && entry.reference_id && txMap[entry.reference_id]) {
          realDesc = txMap[entry.reference_id];
      }
      
      const invStatus = entry.invoice_id ? '✅ SIM  ' : '❌ NÃO  ';
      console.log(`${entry.id} | ${amount} | ${invStatus} | ${realDesc.substring(0, 40)}`);
  });
}

analyze();
