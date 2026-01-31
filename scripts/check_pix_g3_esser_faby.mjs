// Verificar detalhes dos PIX G3, ESSER e FABY para Dr. Cícero
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const TENANT = 'a53a4957-fe97-4856-b3ca-70045157b421';
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║   DETALHES DOS PIX - G3, ESSER, FABY - PARA DR. CÍCERO IDENTIFICAR        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Buscar todas as transações de crédito em janeiro
  const { data: txs } = await supabase
    .from('bank_transactions')
    .select('id, description, amount, transaction_date')
    .eq('tenant_id', TENANT)
    .eq('transaction_type', 'credit')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('amount', { ascending: false });
  
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('TRANSAÇÕES BANCÁRIAS (CRÉDITO) JANEIRO/2025 - VALORES PRINCIPAIS:');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  
  // Mostrar as principais para identificar
  const valores = [31253.06, 8000, 2000, 1461.19, 1206];
  
  for (const tx of txs || []) {
    // Verificar se bate com os valores procurados
    const isMatch = valores.some(v => Math.abs(tx.amount - v) < 1);
    if (isMatch || tx.amount > 5000) {
      console.log('─────────────────────────────────────────────────────────────────────────');
      console.log('DATA:        ', tx.transaction_date);
      console.log('VALOR:       R$', tx.amount?.toFixed(2));
      console.log('DESCRIÇÃO:   ', tx.description);
      console.log('');
    }
  }
  
  // Buscar especificamente pelos valores
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('BUSCANDO PELOS VALORES ESPECÍFICOS:');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  
  // G3 = R$ 31.253,06
  const { data: g3 } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('tenant_id', TENANT)
    .gte('amount', 31253)
    .lte('amount', 31254);
  
  console.log('\n🔍 G3 (R$ 31.253,06):');
  (g3 || []).forEach(t => {
    console.log('   Data:', t.transaction_date);
    console.log('   Descrição:', t.description);
  });
  
  // ESSER = R$ 8.000 e R$ 2.000
  const { data: esser8k } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('tenant_id', TENANT)
    .gte('amount', 7999)
    .lte('amount', 8001);
    
  console.log('\n🔍 ESSER (R$ 8.000):');
  (esser8k || []).forEach(t => {
    console.log('   Data:', t.transaction_date);
    console.log('   Descrição:', t.description);
  });
  
  const { data: esser2k } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('tenant_id', TENANT)
    .gte('amount', 1999)
    .lte('amount', 2001);
    
  console.log('\n🔍 ESSER (R$ 2.000):');
  (esser2k || []).forEach(t => {
    console.log('   Data:', t.transaction_date);
    console.log('   Descrição:', t.description);
  });
  
  // FABY = R$ 1.461,19 e R$ 1.206,00
  const { data: faby1 } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('tenant_id', TENANT)
    .gte('amount', 1461)
    .lte('amount', 1462);
    
  console.log('\n🔍 FABY (R$ 1.461,19):');
  (faby1 || []).forEach(t => {
    console.log('   Data:', t.transaction_date);
    console.log('   Descrição:', t.description);
  });
  
  const { data: faby2 } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('tenant_id', TENANT)
    .gte('amount', 1205)
    .lte('amount', 1207);
    
  console.log('\n🔍 FABY (R$ 1.206):');
  (faby2 || []).forEach(t => {
    console.log('   Data:', t.transaction_date);
    console.log('   Descrição:', t.description);
  });
  
  console.log('');
}

main().catch(console.error);
