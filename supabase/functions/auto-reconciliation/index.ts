import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import type {
  EdgeSupabaseClient,
  BankTransaction,
  Invoice,
  ChartOfAccount,
  ReconciliationMatch,
  ReconciliationResult,
  BestMatch,
  MatchCriteria,
  ReconciliationConfig,
  ChartOfAccounts
} from '../_shared/types.ts'

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Erro desconhecido';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, data } = await req.json()

    if (action === 'reconcile_bank_statement') {
      // Conciliar extrato bancário completo
      const result = await reconcileBankStatement(supabase, data)

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    else if (action === 'reconcile_transaction') {
      // Conciliar uma transação específica
      const result = await reconcileTransaction(supabase, data.transactionId)

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    else if (action === 'manual_reconciliation') {
      // Conciliação manual forçada
      const result = await manualReconciliation(
        supabase,
        data.transactionId,
        data.invoiceId
      )

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    else {
      throw new Error(`Ação desconhecida: ${action}`)
    }

  } catch (error: unknown) {
    console.error('Erro na conciliação:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function reconcileBankStatement(supabase: EdgeSupabaseClient, config: ReconciliationConfig) {
  const { startDate, endDate, accountId } = config

  // Buscar transações bancárias não conciliadas (apenas entradas de dinheiro)
  let query = supabase
    .from('bank_transactions')
    .select('*')
    .gt('amount', 0) // Apenas entradas (crédito)
    .is('invoice_id', null) // Não conciliadas
    .order('transaction_date', { ascending: false })

  if (startDate) query = query.gte('transaction_date', startDate)
  if (endDate) query = query.lte('transaction_date', endDate)
  if (accountId) query = query.eq('account_id', accountId)

  const { data: transactions, error } = await query

  if (error) throw error

  console.log(`Processando ${transactions?.length || 0} transações não conciliadas`)

  const result: ReconciliationResult = {
    processed: transactions?.length || 0,
    matched: 0,
    unmatched: 0,
    entriesCreated: 0,
    matches: [],
    unmatchedTransactions: []
  }

  // Buscar honorários pendentes
  const { data: pendingInvoices } = await supabase
    .from('invoices')
    .select('*, clients(id, name, cnpj)')
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true })

  if (!pendingInvoices || pendingInvoices.length === 0) {
    console.log('Nenhum honorário pendente encontrado')
    result.unmatchedTransactions = transactions || []
    result.unmatched = transactions?.length || 0
    return result
  }

  // Para cada transação, tentar encontrar um match
  for (const transaction of transactions) {
    try {
      const match = await findBestMatch(transaction, pendingInvoices)

      if (match && match.confidenceScore >= 80) {
        // Match com alta confiança - processar automaticamente
        const reconciled = await processReconciliation(
          supabase,
          transaction,
          match.invoice,
          match.matchMethod,
          match.confidenceScore,
          match.matchCriteria
        )

        if (reconciled) {
          result.matched++
          result.entriesCreated++
          result.matches.push({
            transactionId: transaction.id,
            invoiceId: match.invoice.id,
            clientId: match.invoice.client_id,
            clientName: match.invoice.clients?.name || 'Desconhecido',
            matchMethod: match.matchMethod,
            confidenceScore: match.confidenceScore,
            matchCriteria: match.matchCriteria
          })
        }
      } else {
        // Match com baixa confiança ou nenhum match
        result.unmatched++
        result.unmatchedTransactions.push({
          transaction,
          possibleMatches: match ? [match] : []
        })
      }
    } catch (error) {
      console.error(`Erro ao processar transação ${transaction.id}:`, error)
      result.unmatched++
      result.unmatchedTransactions.push({ transaction, error: getErrorMessage(error) })
    }
  }

  return result
}

async function findBestMatch(transaction: BankTransaction, invoices: Invoice[]): Promise<BestMatch | null> {
  const transactionAmount = Math.abs(transaction.amount)
  const transactionDescription = (transaction.description || '').toLowerCase()
  const transactionDate = new Date(transaction.transaction_date)

  let bestMatch: BestMatch | null = null
  let highestScore = 0

  for (const invoice of invoices) {
    const invoiceAmount = Number(invoice.amount)
    const clientName = (invoice.clients?.name || '').toLowerCase()
    const clientCnpj = invoice.clients?.cnpj || ''
    const dueDate = new Date(invoice.due_date)

    let score = 0
    const criteria: MatchCriteria = {}

    // 1. MATCH EXATO DE VALOR (peso 40)
    if (Math.abs(transactionAmount - invoiceAmount) < 0.01) {
      score += 40
      criteria.exactAmount = true
    } else {
      // Tolerância de 5%
      const diff = Math.abs(transactionAmount - invoiceAmount) / invoiceAmount
      if (diff <= 0.05) {
        score += 30
        criteria.approximateAmount = true
      }
    }

    // 2. MATCH DE NOME DO CLIENTE (peso 30)
    if (transactionDescription.includes(clientName)) {
      score += 30
      criteria.nameInDescription = true
    } else {
      // Match fuzzy (primeiras palavras)
      const clientWords = clientName.split(' ').filter(w => w.length > 3)
      let matchedWords = 0
      for (const word of clientWords) {
        if (transactionDescription.includes(word)) {
          matchedWords++
        }
      }
      if (matchedWords > 0) {
        score += (matchedWords / clientWords.length) * 20
        criteria.partialNameMatch = true
        criteria.matchedWords = matchedWords
      }
    }

    // 3. MATCH DE CNPJ (peso 20)
    if (clientCnpj && transactionDescription.includes(clientCnpj.replace(/\D/g, ''))) {
      score += 20
      criteria.cnpjMatch = true
    }

    // 4. PROXIMIDADE DE DATA (peso 10)
    const daysDiff = Math.abs(
      (transactionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff <= 7) {
      score += 10
      criteria.dateProximity = true
    } else if (daysDiff <= 30) {
      score += 5
      criteria.approximateDateProximity = true
    }

    if (score > highestScore) {
      highestScore = score
      bestMatch = {
        invoice,
        matchMethod: score >= 95 ? 'AUTO_EXACT' : 'AUTO_FUZZY',
        confidenceScore: score,
        matchCriteria: criteria
      }
    }
  }

  return bestMatch
}

async function reconcileTransaction(supabase: EdgeSupabaseClient, transactionId: string) {
  // Buscar a transação
  const { data: transaction, error: txError } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', transactionId)
    .single()

  if (txError) throw txError

  // Buscar honorários pendentes
  const { data: pendingInvoices } = await supabase
    .from('invoices')
    .select('*, clients(id, name, cnpj)')
    .in('status', ['pending', 'overdue'])

  if (!pendingInvoices || pendingInvoices.length === 0) {
    return { matched: false, reason: 'Nenhum honorário pendente encontrado' }
  }

  const match = await findBestMatch(transaction, pendingInvoices)

  if (match && match.confidenceScore >= 70) {
    await processReconciliation(
      supabase,
      transaction,
      match.invoice,
      match.matchMethod,
      match.confidenceScore,
      match.matchCriteria
    )

    return {
      matched: true,
      invoice: match.invoice,
      confidenceScore: match.confidenceScore,
      method: match.matchMethod
    }
  }

  return {
    matched: false,
    possibleMatches: match ? [match] : [],
    reason: 'Nenhum match com confiança suficiente'
  }
}

async function manualReconciliation(
  supabase: EdgeSupabaseClient,
  transactionId: string,
  invoiceId: string
) {
  const { data: transaction } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('id', transactionId)
    .single()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, clients(id, name)')
    .eq('id', invoiceId)
    .single()

  if (!transaction || !invoice) {
    throw new Error('Transação ou honorário não encontrado')
  }

  return await processReconciliation(
    supabase,
    transaction,
    invoice,
    'MANUAL',
    100,
    { manualReconciliation: true }
  )
}

async function processReconciliation(
  supabase: EdgeSupabaseClient,
  transaction: BankTransaction,
  invoice: Invoice,
  method: string,
  confidenceScore: number,
  matchCriteria: MatchCriteria
) {
  // 1. Buscar contas contábeis
  const accounts = await getChartOfAccounts(supabase)

  // 2. Criar lançamento contábil de BAIXA
  const transactionDate = new Date(transaction.transaction_date)
  const amount = Math.abs(transaction.amount)

  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: transactionDate.toISOString().split('T')[0],
      competence_date: transactionDate.toISOString().split('T')[0],
      description: `Recebimento de honorário - ${invoice.clients?.name || 'Cliente'} - Competência ${invoice.competence}`,
      history: `${transaction.description} - Conciliação automática (${method})`,
      entry_type: 'BAIXA_RECEITA',
      document_type: getPaymentMethod(transaction.description),
      document_number: transaction.bank_reference || transaction.id,
      invoice_id: invoice.id,
      transaction_id: transaction.id,
      total_debit: amount,
      total_credit: amount,
      is_draft: false
    })
    .select()
    .single()

  if (entryError) throw entryError

  // 3. Criar itens do lançamento (partidas dobradas)
  const items = [
    {
      entry_id: entry.id,
      account_id: accounts.bancosContaMovimento.id,
      debit: amount,
      credit: 0,
      history: `Recebimento via ${getPaymentMethod(transaction.description)}`,
      client_id: invoice.client_id
    },
    {
      entry_id: entry.id,
      account_id: accounts.honorariosAReceber.id,
      debit: 0,
      credit: amount,
      history: `Baixa de honorário ref. ${invoice.competence}`,
      client_id: invoice.client_id
    }
  ]

  await supabase.from('accounting_entry_items').insert(items)

  // 4. Atualizar invoice como pago
  await supabase
    .from('invoices')
    .update({
      status: 'paid',
      payment_date: transaction.transaction_date
    })
    .eq('id', invoice.id)

  // 5. Linkar transação ao invoice
  await supabase
    .from('bank_transactions')
    .update({ invoice_id: invoice.id })
    .eq('id', transaction.id)

  // 6. Registrar na tabela de conciliação
  await supabase
    .from('bank_reconciliation')
    .insert({
      transaction_id: transaction.id,
      invoice_id: invoice.id,
      accounting_entry_id: entry.id,
      reconciliation_method: method,
      confidence_score: confidenceScore,
      match_criteria: matchCriteria,
      notes: `Conciliação ${method} - Score: ${confidenceScore}%`
    })

  return { success: true, entryId: entry.id }
}

async function getChartOfAccounts(supabase: EdgeSupabaseClient): Promise<ChartOfAccounts> {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('is_analytical', true)

  if (error) throw error

  const accounts = data as ChartOfAccount[]

  return {
    honorariosAReceber: accounts.find((a) => a.code === '1.1.02.001')!,
    bancosContaMovimento: accounts.find((a) => a.code === '1.1.01.002')!,
    caixa: accounts.find((a) => a.code === '1.1.01.001')!,
    receitaHonorarios: accounts.find((a) => a.code === '3.1.01.001')!
  }
}

function getPaymentMethod(description: string | null): string {
  if (!description) return 'OUTROS'
  const desc = description.toLowerCase()

  if (desc.includes('pix')) return 'PIX'
  if (desc.includes('ted')) return 'TED'
  if (desc.includes('doc')) return 'DOC'
  if (desc.includes('transferencia')) return 'TRANSFERENCIA'
  if (desc.includes('boleto')) return 'BOLETO'

  return 'OUTROS'
}
