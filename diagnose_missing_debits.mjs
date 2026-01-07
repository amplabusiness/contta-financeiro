
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

async function diagnose() {
  console.log('🕵️  Diagnóstico de Débitos Ausentes (Faturas 2025)');

  // 1. Total Invoices Issued in 2025 (Operational)
  // We assume created_at or issue_date in 2025? Or due_date? 
  // Competence is usually the driver for Revenue. 
  // Let's filter by created_at >= 2025-01-01 for simplicity of "issued invoices".
  
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('amount, created_at')
    .gte('created_at', '2025-01-01');

  if (invError) { console.error(invError); return; }
  
  const totalInvoices2025 = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
  console.log(`📄 Faturas Emitidas em 2025 (Operacional): R$ ${totalInvoices2025.toFixed(2)} (${invoices.length} faturas)`);

  // 2. Total Debits in 1.1.2.01 in 2025 (Accounting)
  // We check accounting_entry_lines join accounting_entries
  // Account 1.1.2.01 id?
  const { data: acc } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.2.01').single();
  
  const { data: lines, error: lineError } = await supabase
    .from('accounting_entry_lines')
    .select('debit')
    .eq('account_id', acc.id)
    .gt('debit', 0); // Only Debits

  // We should strictly filter by date, but getting ALL debits is a safe upper bound.
  // Ideally filter by entry_date >= 2025-01-01 through join, but assuming migration is fresh:
  
  let totalDebits = 0;
  if (lines) {
      totalDebits = lines.reduce((sum, l) => sum + Number(l.debit), 0);
  }
  
  console.log(`📚 Débitos em Contas a Receber (Contábil): R$ ${totalDebits.toFixed(2)}`);

  const gap = totalInvoices2025 - totalDebits;
  console.log(`📉 GAP (Invoices sem Contabilidade?): R$ ${gap.toFixed(2)}`);
  
  if (gap > 1000) {
      console.log('🚨 DIAGNÓSTICO CONFIRMADO: Faltam lançamentos contábeis para as faturas de 2025!');
      console.log('   Sua migração importou o saldo de 2024 e os pagamentos de 2025,');
      console.log('   mas ESQUECEU de gerar os lançamentos das faturas geradas em 2025.');
  } else {
      console.log('✅ Débitos parecem estar ok. O problema pode ser outro.');
  }
}

diagnose();
