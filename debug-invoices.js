/**
 * Script de debug para verificar invoices com amount 5913.78
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function debugInvoices() {
  console.log('\n🔍 Debugando invoices com amount 5913.78...\n');

  // 1. Buscar todas as invoices com esse amount
  const { data: invoices1, error: err1 } = await supabase
    .from('invoices')
    .select('id, client_id, amount, status, paid_date, due_date, created_at')
    .eq('amount', 5913.78);

  console.log('1️⃣  Invoices com amount = 5913.78:');
  console.log('Error:', err1);
  console.log('Resultado:', JSON.stringify(invoices1, null, 2));

  // 2. Buscar invoices com status paid
  const { data: invoices2, error: err2 } = await supabase
    .from('invoices')
    .select('id, client_id, amount, status, paid_date, due_date')
    .eq('status', 'paid');

  console.log('\n2️⃣  Todas as invoices com status = "paid":');
  console.log('Total encontradas:', invoices2?.length);
  const paid5913 = invoices2?.filter(inv => inv.amount === 5913.78);
  console.log('Delas, com amount 5913.78:', JSON.stringify(paid5913, null, 2));

  // 3. Buscar invoices por intervalo de data
  const { data: invoices3, error: err3 } = await supabase
    .from('invoices')
    .select('id, client_id, amount, status, paid_date')
    .lte('paid_date', '2025-01-03')
    .eq('amount', 5913.78);

  console.log('\n3️⃣  Invoices com amount 5913.78 e paid_date <= 2025-01-03:');
  console.log('Resultado:', JSON.stringify(invoices3, null, 2));

  // 4. Buscar sem filters para ver se há invoices com esse amount
  const { data: allInvoices, error: err4 } = await supabase
    .from('invoices')
    .select('id, client_id, amount, status, paid_date')
    .gte('amount', 5913)
    .lte('amount', 5914);

  console.log('\n4️⃣  Invoices com amount próximo a 5913.78 (5913-5914):');
  console.log('Resultado:', JSON.stringify(allInvoices, null, 2));

  // 5. Ver o relacionamento com clientes
  const { data: invoicesWithClients, error: err5 } = await supabase
    .from('invoices')
    .select(`
      id, 
      client_id, 
      amount, 
      status, 
      paid_date,
      clients(id, name, cnpj)
    `)
    .eq('amount', 5913.78);

  console.log('\n5️⃣  Invoices com amount 5913.78 + clientes relacionados:');
  console.log('Resultado:', JSON.stringify(invoicesWithClients, null, 2));

  // 6. Buscar múltiplas invoices que somem 5913.78
  const { data: allInvoicesPaid, error: err6 } = await supabase
    .from('invoices')
    .select('id, client_id, amount, status, paid_date, clients(id, name)')
    .eq('status', 'paid')
    .lte('paid_date', '2025-01-03')
    .order('amount', { ascending: false });

  if (allInvoicesPaid && allInvoicesPaid.length > 0) {
    console.log('\n6️⃣  Invoices pagas até 2025-01-03 (primeiras 20):');
    allInvoicesPaid.slice(0, 20).forEach(inv => {
      console.log(`   - ID: ${inv.id}, Amount: ${inv.amount}, Client: ${inv.clients?.name || 'N/A'}, Status: ${inv.status}`);
    });

    // Procurar combinações que somem 5913.78
    const sum = allInvoicesPaid
      .filter(inv => inv.paid_date && new Date(inv.paid_date) <= new Date('2025-01-03'))
      .reduce((acc, inv) => acc + inv.amount, 0);
    
    console.log(`\n   Total de invoices pagas até 2025-01-03: R$ ${sum.toFixed(2)}`);
  }

  // 7. Buscar bank_transactions para comparação
  const { data: bankTx, error: err7 } = await supabase
    .from('bank_transactions')
    .select('id, description, amount, transaction_date')
    .ilike('description', '%COB000005%')
    .eq('amount', 5913.78);

  console.log('\n7️⃣  Bank transactions COB000005 com amount 5913.78:');
  console.log('Resultado:', JSON.stringify(bankTx, null, 2));

  process.exit(0);
}

debugInvoices().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
