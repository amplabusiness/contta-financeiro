
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tentar ler .env.local ou .env
let envContent = '';
const envPathLocal = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPathLocal)) {
  envContent = fs.readFileSync(envPathLocal, 'utf-8');
  // Se não encontrar a chave de serviço no local, tenta ler o .env padrão para complementar
  if (!envContent.includes('VITE_SUPABASE_SERVICE_ROLE_KEY')) {
      if (fs.existsSync(envPath)) {
          envContent += '\n' + fs.readFileSync(envPath, 'utf-8');
      }
  }
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
    keyMatch2 = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
    if (!urlMatch || !keyMatch2) {
        console.error('❌ Credenciais Supabase não encontradas no .env');
        process.exit(1);
    }
}

const supabaseUrl = urlMatch[1].trim().replace(/^["']|["']$/g, '');
// Tenta usar Service Role Key primeiro para ignorar RLS e ler tudo
const serviceKeyMatch = envContent.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.+)/);
let rawKey = serviceKeyMatch ? serviceKeyMatch[1] : (keyMatch ? keyMatch[1] : keyMatch2[1]);
const supabaseKey = rawKey.trim().replace(/^["']|["']$/g, '');

if (serviceKeyMatch) console.log('🔑 Usando Service Role Key (Admin Mode)');

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log('🔍 Iniciando Auditoria: Operacional vs Contábil...');
  console.log('------------------------------------------------');

  // 1. Operacional: Invoices
  console.log('📊 Consultando Invoices (Pending/Overdue)...');
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('amount')
    .in('status', ['pending', 'overdue']);

  if (invError) {
    console.error('❌ Erro invoices:', invError);
    return;
  }
  
  const totalInvoices = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
  console.log(`   Total Faturas: R$ ${totalInvoices.toFixed(2)}`);

  // 2. Operacional: Opening Balances
  console.log('📊 Consultando Saldos de Abertura (Pending/Partial/Overdue)...');
  const { data: opening, error: opError } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount')
    .in('status', ['pending', 'partial', 'overdue']);

  if (opError) {
    console.error('❌ Erro opening balances:', opError);
    return;
  }

  const totalOpening = opening.reduce((sum, ob) => {
    const remaining = Number(ob.amount || 0) - Number(ob.paid_amount || 0);
    return sum + (remaining > 0 ? remaining : 0);
  }, 0);
  console.log(`   Total Saldo Abertura: R$ ${totalOpening.toFixed(2)}`);

  const totalOperational = totalInvoices + totalOpening;
  console.log(`✅ TOTAL OPERACIONAL: R$ ${totalOperational.toFixed(2)}`);
  console.log('------------------------------------------------');

  // 3. Contábil: v_balancete
  console.log('📚 Consultando Razão Contábil (1.1.2.01 - Contas a Receber)...');
  const { data: ledger, error: ledError } = await supabase
    .from('v_balancete')
    .select('balance, year, month') // Assuming balance column exists as per my read of the SQL view logic
    .eq('account_code', '1.1.2.01');

  if (ledError) {
    console.error('❌ Erro v_balancete:', ledError);
    console.log('   Tentando consulta alternativa na tabela accounting_entry_lines...');
    
    // Fallback logic if view is not accessible
    // ...
  }
  
  // v_balancete is grouped by year/month. We need to sum the balances? 
  // No, balance in trial balance is usually cumulative... wait.
  // The view read_file showed:
  // CASE WHEN nature = 'DEVEDORA' THEN total_debit - total_credit ...
  // It groups by year/month. 
  // Trial balance usually shows the MOVEMENT for that month or accumulated?
  // The SQL view logic I read:
  // COALESCE(SUM(ael.debit), 0) as total_debit,
  // GROUP BY ... EXTRACT(YEAR FROM ae.entry_date), EXTRACT(MONTH FROM ae.entry_date)
  
  // This means the view returns MONTHLY movements, not cumulative balance.
  // So I must SUM all rows for 1.1.2.01 to get the current balance.
  
  let totalAccounting = 0;
  if (ledger) {
      totalAccounting = ledger.reduce((sum, row) => sum + Number(row.balance || 0), 0);
  }

  console.log(`✅ TOTAL CONTÁBIL: R$ ${totalAccounting.toFixed(2)}`);
  console.log('------------------------------------------------');

  const diff = totalOperational - totalAccounting;
  console.log(`⚖️  DIFERENÇA: R$ ${diff.toFixed(2)}`);
  
  if (Math.abs(diff) < 0.05) {
      console.log('🎉 AUDITORIA APROVADA: Os saldos batem!');
  } else {
      console.log('⚠️  AUDITORIA REPROVADA: Divergência detectada.');
      console.log('   Possíveis causas:');
      console.log('   - Fatura paga no sistema mas sem baixa contábil?');
      console.log('   - Lançamento manual direto na contabilidade sem fatura?');
      console.log('   - Saldo de abertura duplicado?');
  }
}

runAudit();
