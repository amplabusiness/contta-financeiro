import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
)

async function cleanupDuplicates() {
  console.log('=== LIMPEZA DE DUPLICAÇÕES ===\n')
  
  // 1. Encontrar os duplicados
  const { data: duplicates, error: dupError } = await supabase.rpc('get_duplicate_lines')
  
  if (dupError) {
    // Se a function não existe, criar query direta
    console.log('Buscando duplicados manualmente...')
    
    const { data: entries, error } = await supabase
      .from('accounting_entries')
      .select(`
        id,
        entry_date,
        description,
        accounting_entry_lines (
          id,
          account_id,
          debit,
          credit
        ),
        accounting_entry_items (
          id,
          account_id,
          debit,
          credit
        )
      `)
      .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421')
      
    if (error) throw error
    
    // Encontrar entries com lines que são duplicados de items em outro entry
    const allItems = []
    const allLines = []
    
    for (const entry of entries) {
      for (const item of entry.accounting_entry_items || []) {
        allItems.push({
          entry_id: entry.id,
          date: entry.entry_date,
          account_id: item.account_id,
          debit: parseFloat(item.debit) || 0,
          credit: parseFloat(item.credit) || 0
        })
      }
      for (const line of entry.accounting_entry_lines || []) {
        allLines.push({
          entry_id: entry.id,
          line_id: line.id,
          date: entry.entry_date,
          account_id: line.account_id,
          debit: parseFloat(line.debit) || 0,
          credit: parseFloat(line.credit) || 0
        })
      }
    }
    
    // Encontrar lines duplicados (mesmo account, date, debit, credit em entries diferentes)
    const linesToDelete = []
    const entriesToDelete = new Set()
    
    for (const line of allLines) {
      const hasDuplicateItem = allItems.some(item => 
        item.account_id === line.account_id &&
        item.date === line.date &&
        item.debit === line.debit &&
        item.credit === line.credit &&
        item.entry_id !== line.entry_id
      )
      
      if (hasDuplicateItem) {
        linesToDelete.push(line.line_id)
        entriesToDelete.add(line.entry_id)
      }
    }
    
    console.log(`Encontrados ${linesToDelete.length} lines duplicados em ${entriesToDelete.size} entries`)
    
    if (linesToDelete.length === 0) {
      console.log('Nenhuma duplicação encontrada!')
      return
    }
    
    // 2. Deletar as linhas
    console.log('\nDeletando linhas duplicadas...')
    const { error: delLinesError } = await supabase
      .from('accounting_entry_lines')
      .delete()
      .in('id', linesToDelete)
      
    if (delLinesError) {
      console.error('Erro ao deletar lines:', delLinesError)
      return
    }
    
    console.log(`Deletadas ${linesToDelete.length} linhas`)
    
    // 3. Verificar se os entries ficaram órfãos e deletá-los
    console.log('\nVerificando entries órfãos...')
    let orphanCount = 0
    
    for (const entryId of entriesToDelete) {
      const { data: checkLines } = await supabase
        .from('accounting_entry_lines')
        .select('id')
        .eq('entry_id', entryId)
        .limit(1)
        
      const { data: checkItems } = await supabase
        .from('accounting_entry_items')
        .select('id')
        .eq('entry_id', entryId)
        .limit(1)
        
      if ((!checkLines || checkLines.length === 0) && (!checkItems || checkItems.length === 0)) {
        // Entry órfão - deletar
        const { error: delEntryError } = await supabase
          .from('accounting_entries')
          .delete()
          .eq('id', entryId)
          
        if (!delEntryError) orphanCount++
      }
    }
    
    console.log(`Deletados ${orphanCount} entries órfãos`)
  }
  
  // 4. Verificar contagens finais
  console.log('\n=== VERIFICAÇÃO FINAL ===')
  
  const { count: itemsCount } = await supabase
    .from('accounting_entry_items')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421')
    
  const { count: linesCount } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421')
    
  console.log(`accounting_entry_items: ${itemsCount}`)
  console.log(`accounting_entry_lines: ${linesCount}`)
  
  // 5. Verificar saldo do banco
  console.log('\n=== SALDO BANCO ===')
  const bankAccountCode = '1.1.1.05'
  
  const { data: bankAccount } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, initial_balance')
    .eq('code', bankAccountCode)
    .eq('tenant_id', 'a53a4957-fe97-4856-b3ca-70045157b421')
    .single()
    
  if (bankAccount) {
    // Somar items
    const { data: itemsData } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', bankAccount.id)
      
    const itemsSum = (itemsData || []).reduce((acc, i) => ({
      debit: acc.debit + (parseFloat(i.debit) || 0),
      credit: acc.credit + (parseFloat(i.credit) || 0)
    }), { debit: 0, credit: 0 })
    
    // Somar lines
    const { data: linesData } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', bankAccount.id)
      
    const linesSum = (linesData || []).reduce((acc, l) => ({
      debit: acc.debit + (parseFloat(l.debit) || 0),
      credit: acc.credit + (parseFloat(l.credit) || 0)
    }), { debit: 0, credit: 0 })
    
    const initialBalance = parseFloat(bankAccount.initial_balance) || 0
    const totalDebit = itemsSum.debit + linesSum.debit
    const totalCredit = itemsSum.credit + linesSum.credit
    
    // Para conta de ATIVO: Saldo = Inicial + Débitos - Créditos
    const finalBalance = initialBalance + totalDebit - totalCredit
    
    console.log(`Conta: ${bankAccount.code} - ${bankAccount.name}`)
    console.log(`Saldo Inicial: R$ ${initialBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
    console.log(`Items - Débitos: ${itemsSum.debit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}, Créditos: ${itemsSum.credit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
    console.log(`Lines - Débitos: ${linesSum.debit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}, Créditos: ${linesSum.credit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
    console.log(`SALDO FINAL: R$ ${finalBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`)
    console.log(`Esperado: R$ 18.553,54`)
    console.log(Math.abs(finalBalance - 18553.54) < 0.01 ? '✅ CORRETO!' : '❌ INCORRETO!')
  }
  
  console.log('\n=== LIMPEZA CONCLUÍDA ===')
}

cleanupDuplicates().catch(console.error)
