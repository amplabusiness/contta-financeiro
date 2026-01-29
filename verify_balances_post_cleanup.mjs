import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421'

async function verifyBalances() {
  console.log('=== VERIFICAÇÃO SALDOS PÓS-LIMPEZA ===\n')
  
  // 1. Verificar saldo do Banco
  const bankCode = '1.1.1.05'
  
  const { data: bankAccount } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, initial_balance')
    .eq('code', bankCode)
    .eq('tenant_id', TENANT_ID)
    .single()
    
  if (!bankAccount) {
    console.log('Conta bancária não encontrada!')
    return
  }
  
  console.log(`📊 Conta: ${bankAccount.code} - ${bankAccount.name}`)
  console.log(`   Saldo Inicial: R$ ${parseFloat(bankAccount.initial_balance || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  
  // Buscar movimentos de items
  const { data: itemsData } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit')
    .eq('account_id', bankAccount.id)
    
  const itemsSum = (itemsData || []).reduce((acc, i) => ({
    debit: acc.debit + (parseFloat(i.debit) || 0),
    credit: acc.credit + (parseFloat(i.credit) || 0)
  }), { debit: 0, credit: 0 })
  
  // Buscar movimentos de lines
  const { data: linesData } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', bankAccount.id)
    
  const linesSum = (linesData || []).reduce((acc, l) => ({
    debit: acc.debit + (parseFloat(l.debit) || 0),
    credit: acc.credit + (parseFloat(l.credit) || 0)
  }), { debit: 0, credit: 0 })
  
  const initialBalance = parseFloat(bankAccount.initial_balance) || 0
  
  console.log('\n📈 Movimentação ITEMS:')
  console.log(`   Débitos: R$ ${itemsSum.debit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  console.log(`   Créditos: R$ ${itemsSum.credit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  
  console.log('\n📉 Movimentação LINES:')
  console.log(`   Débitos: R$ ${linesSum.debit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  console.log(`   Créditos: R$ ${linesSum.credit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  
  // Saldo usando só items
  const balanceItems = initialBalance + itemsSum.debit - itemsSum.credit
  console.log(`\n💰 Saldo (só items): R$ ${balanceItems.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  
  // Saldo usando items + lines
  const totalDebit = itemsSum.debit + linesSum.debit
  const totalCredit = itemsSum.credit + linesSum.credit
  const balanceTotal = initialBalance + totalDebit - totalCredit
  console.log(`💰 Saldo (items + lines): R$ ${balanceTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
  
  console.log(`\n🎯 Esperado (extrato): R$ 18.553,54`)
  
  if (Math.abs(balanceItems - 18553.54) < 0.01) {
    console.log('✅ Saldo ITEMS está CORRETO!')
  } else if (Math.abs(balanceTotal - 18553.54) < 0.01) {
    console.log('✅ Saldo TOTAL está CORRETO!')
  } else {
    console.log('❌ Nenhum saldo bate!')
  }
  
  // 2. Verificar se ainda existem duplicações para o banco
  console.log('\n--- Verificando duplicações restantes banco ---')
  
  const { data: checkItems } = await supabase
    .from('accounting_entry_items')
    .select(`
      id,
      debit,
      credit,
      entry:entry_id (
        entry_date,
        description
      )
    `)
    .eq('account_id', bankAccount.id)
    .order('entry(entry_date)')
    .limit(5)
    
  const { data: checkLines } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      debit,
      credit,
      entry:entry_id (
        entry_date,
        description
      )
    `)
    .eq('account_id', bankAccount.id)
    
  console.log(`Items no banco: ${itemsData?.length || 0}`)
  console.log(`Lines no banco: ${linesData?.length || 0}`)
  
  // 3. Verificar algumas contas de clientes
  console.log('\n\n=== VERIFICAÇÃO LEDGER CLIENTES ===\n')
  
  const clientCodes = ['1.1.2.01.0001', '1.1.2.01.0002', '1.1.2.01.0003']
  
  for (const code of clientCodes) {
    const { data: clientAccount } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, initial_balance')
      .eq('code', code)
      .eq('tenant_id', TENANT_ID)
      .single()
      
    if (clientAccount) {
      const { data: cItems } = await supabase
        .from('accounting_entry_items')
        .select('debit, credit')
        .eq('account_id', clientAccount.id)
        
      const { data: cLines } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('account_id', clientAccount.id)
        
      const itemsTotal = (cItems || []).reduce((a, i) => a + (parseFloat(i.debit) || 0) - (parseFloat(i.credit) || 0), 0)
      const linesTotal = (cLines || []).reduce((a, l) => a + (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0), 0)
      const initial = parseFloat(clientAccount.initial_balance) || 0
      
      console.log(`${clientAccount.code} - ${clientAccount.name}`)
      console.log(`   Saldo Inicial: ${initial.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
      console.log(`   Items (+D -C): ${itemsTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Lines (+D -C): ${linesTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
      console.log(`   SALDO: ${(initial + itemsTotal + linesTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
      console.log('')
    }
  }
}

verifyBalances().catch(console.error)
