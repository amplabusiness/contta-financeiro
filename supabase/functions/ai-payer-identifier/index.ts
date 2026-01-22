import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface IdentificationResult {
  transactionId: string
  confidence: number
  method: 'cnpj_match' | 'cpf_match' | 'qsa_match' | 'name_similarity' | 'pattern_learned' | 'invoice_match' | 'none'
  clientId?: string
  clientName?: string
  accountCode?: string
  invoiceId?: string
  reasoning: string
}

interface Client {
  id: string
  name: string
  razao_social?: string
  cnpj?: string
  cpf?: string
  qsa?: Array<{ cpf_cnpj?: string; nome?: string }>
  accounting_account_id?: string
  chart_of_accounts?: { code: string }
}

interface Transaction {
  id: string
  description: string
  amount: number
  transaction_date: string
  tenant_id: string
  extracted_cnpj?: string
  extracted_cpf?: string
  extracted_cob?: string
  extracted_name?: string
  matched: boolean
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { transaction_id, action, tenant_id } = body

    if (action === 'identify_batch') {
      // Identificar em lote todas transacoes pendentes
      const results = await identifyBatch(supabase, tenant_id)
      return new Response(
        JSON.stringify({ success: true, data: results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!transaction_id) {
      throw new Error('transaction_id is required')
    }

    // Buscar transacao
    const { data: tx, error: txError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('id', transaction_id)
      .single()

    if (txError || !tx) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const result = await identifyPayer(supabase, tx)

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na identificacao:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function identifyPayer(supabase: any, tx: Transaction): Promise<IdentificationResult> {
  const result: IdentificationResult = {
    transactionId: tx.id,
    confidence: 0,
    method: 'none',
    reasoning: ''
  }

  // ESTRATEGIA 1: Match por CNPJ extraido (100% confianca)
  if (tx.extracted_cnpj) {
    const cnpjClean = tx.extracted_cnpj.replace(/\D/g, '')

    const { data: clientByCnpj } = await supabase
      .from('clients')
      .select('id, name, accounting_account_id, chart_of_accounts(code)')
      .or(`cnpj.eq.${tx.extracted_cnpj},cnpj.eq.${cnpjClean}`)
      .eq('tenant_id', tx.tenant_id)
      .eq('is_active', true)
      .single()

    if (clientByCnpj) {
      result.confidence = 100
      result.method = 'cnpj_match'
      result.clientId = clientByCnpj.id
      result.clientName = clientByCnpj.name
      result.accountCode = clientByCnpj.chart_of_accounts?.code
      result.reasoning = `CNPJ ${tx.extracted_cnpj} encontrado no cadastro de clientes`

      await updateTransactionMatch(supabase, tx.id, result)
      return result
    }
  }

  // ESTRATEGIA 2: Match por CPF extraido (95% confianca)
  if (tx.extracted_cpf) {
    const cpfClean = tx.extracted_cpf.replace(/\D/g, '')

    const { data: clientByCpf } = await supabase
      .from('clients')
      .select('id, name, accounting_account_id, chart_of_accounts(code)')
      .or(`cpf.eq.${tx.extracted_cpf},cpf.eq.${cpfClean}`)
      .eq('tenant_id', tx.tenant_id)
      .eq('is_active', true)
      .single()

    if (clientByCpf) {
      result.confidence = 95
      result.method = 'cpf_match'
      result.clientId = clientByCpf.id
      result.clientName = clientByCpf.name
      result.accountCode = clientByCpf.chart_of_accounts?.code
      result.reasoning = `CPF ${tx.extracted_cpf} encontrado no cadastro de clientes`

      await updateTransactionMatch(supabase, tx.id, result)
      return result
    }
  }

  // ESTRATEGIA 3: Match por CPF no QSA (socios) - 92% confianca
  if (tx.extracted_cpf) {
    const cpfClean = tx.extracted_cpf.replace(/\D/g, '')

    const { data: clientsWithQsa } = await supabase
      .from('clients')
      .select('id, name, qsa, accounting_account_id, chart_of_accounts(code)')
      .eq('tenant_id', tx.tenant_id)
      .eq('is_active', true)
      .not('qsa', 'is', null)

    for (const client of clientsWithQsa || []) {
      const qsa = client.qsa as Array<{ cpf_cnpj?: string; nome?: string }> | null
      if (qsa?.some(socio =>
        socio.cpf_cnpj?.replace(/\D/g, '') === cpfClean
      )) {
        const socioNome = qsa.find(s => s.cpf_cnpj?.replace(/\D/g, '') === cpfClean)?.nome || 'Socio'

        result.confidence = 92
        result.method = 'qsa_match'
        result.clientId = client.id
        result.clientName = client.name
        result.accountCode = client.chart_of_accounts?.code
        result.reasoning = `CPF ${tx.extracted_cpf} (${socioNome}) e socio da empresa ${client.name}`

        await updateTransactionMatch(supabase, tx.id, result)
        return result
      }
    }
  }

  // ESTRATEGIA 4: Match por valor + data com faturas pendentes (85% confianca)
  if (tx.amount > 0) {
    const txDate = new Date(tx.transaction_date)
    const startDate = new Date(txDate.getTime() - 5 * 24 * 60 * 60 * 1000) // -5 dias
    const endDate = new Date(txDate.getTime() + 2 * 24 * 60 * 60 * 1000)   // +2 dias

    const { data: matchingInvoices } = await supabase
      .from('invoices')
      .select('id, client_id, amount, due_date, clients(id, name, accounting_account_id, chart_of_accounts(code))')
      .eq('tenant_id', tx.tenant_id)
      .in('status', ['pending', 'overdue'])
      .gte('due_date', startDate.toISOString().split('T')[0])
      .lte('due_date', endDate.toISOString().split('T')[0])

    // Filtrar por valor exato (com tolerancia de centavos)
    const exactMatches = matchingInvoices?.filter((inv: any) =>
      Math.abs(Number(inv.amount) - Number(tx.amount)) < 0.02
    )

    if (exactMatches?.length === 1) {
      const invoice = exactMatches[0]
      const client = invoice.clients as any

      result.confidence = 85
      result.method = 'invoice_match'
      result.clientId = client.id
      result.clientName = client.name
      result.accountCode = client.chart_of_accounts?.code
      result.invoiceId = invoice.id
      result.reasoning = `Valor R$ ${tx.amount} coincide com fatura unica pendente do cliente ${client.name} (venc. ${invoice.due_date})`

      await updateTransactionMatch(supabase, tx.id, result)
      return result
    }
  }

  // ESTRATEGIA 5: Match por nome similar (70-85% confianca)
  if (tx.extracted_name || tx.description) {
    const searchText = (tx.extracted_name || tx.description || '').toUpperCase()

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, razao_social, accounting_account_id, chart_of_accounts(code)')
      .eq('tenant_id', tx.tenant_id)
      .eq('is_active', true)

    let bestMatch = { client: null as Client | null, score: 0 }

    for (const client of clients || []) {
      const namesToCheck = [client.name, client.razao_social].filter(Boolean) as string[]

      for (const name of namesToCheck) {
        const score = calculateSimilarity(searchText, name.toUpperCase())
        if (score > bestMatch.score) {
          bestMatch = { client, score }
        }
      }
    }

    if (bestMatch.score >= 0.65 && bestMatch.client) {
      result.confidence = Math.round(bestMatch.score * 100)
      result.method = 'name_similarity'
      result.clientId = bestMatch.client.id
      result.clientName = bestMatch.client.name
      result.accountCode = (bestMatch.client as any).chart_of_accounts?.code
      result.reasoning = `Nome "${tx.extracted_name || 'na descricao'}" similar a "${bestMatch.client.name}" (${result.confidence}% similaridade)`

      await updateTransactionMatch(supabase, tx.id, result)
      return result
    }
  }

  // ESTRATEGIA 6: Padroes aprendidos
  const { data: patternMatch } = await supabase
    .rpc('fn_find_matching_pattern', {
      p_description: tx.description,
      p_tenant_id: tx.tenant_id
    })

  if (patternMatch && patternMatch.length > 0) {
    const pattern = patternMatch[0]

    result.confidence = Math.round(pattern.confidence)
    result.method = 'pattern_learned'
    result.clientId = pattern.client_id
    result.clientName = pattern.client_name
    result.reasoning = `Padrao aprendido: "${pattern.pattern_text}" -> ${pattern.client_name} (efetividade ${pattern.confidence}%)`

    // Incrementar uso do padrao
    await supabase
      .from('ai_classification_patterns')
      .update({
        usage_count: supabase.sql`usage_count + 1`,
        last_used_at: new Date().toISOString()
      })
      .eq('id', pattern.pattern_id)

    await updateTransactionMatch(supabase, tx.id, result)
    return result
  }

  // Nao identificado
  result.confidence = 0
  result.method = 'none'
  result.reasoning = 'Nao foi possivel identificar o pagador automaticamente'

  // Marcar como needs_review
  await supabase
    .from('bank_transactions')
    .update({
      identification_confidence: 0,
      identification_method: 'none',
      identification_reasoning: result.reasoning,
      needs_review: true
    })
    .eq('id', tx.id)

  return result
}

function calculateSimilarity(a: string, b: string): number {
  // Tokenizar e remover palavras muito curtas
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))

  if (wordsA.size === 0 || wordsB.size === 0) return 0

  // Jaccard similarity
  const intersection = [...wordsA].filter(x => wordsB.has(x)).length
  const union = new Set([...wordsA, ...wordsB]).size

  const jaccard = intersection / union

  // Bonus se o nome completo esta contido
  if (a.includes(b) || b.includes(a)) {
    return Math.min(1, jaccard + 0.3)
  }

  return jaccard
}

async function updateTransactionMatch(supabase: any, txId: string, result: IdentificationResult) {
  const updateData: any = {
    suggested_client_id: result.clientId,
    identification_confidence: result.confidence,
    identification_method: result.method,
    identification_reasoning: result.reasoning
  }

  if (result.confidence >= 90) {
    // Auto-conciliar com alta confianca
    updateData.auto_matched = true
    updateData.matched = true
    updateData.needs_review = false
  } else if (result.confidence >= 70) {
    // Sugerir mas nao auto-conciliar
    updateData.auto_matched = false
    updateData.needs_review = true
  } else {
    updateData.needs_review = true
  }

  await supabase
    .from('bank_transactions')
    .update(updateData)
    .eq('id', txId)
}

async function identifyBatch(supabase: any, tenantId: string): Promise<{
  processed: number
  identified: number
  autoMatched: number
  needsReview: number
  failed: number
}> {
  const stats = {
    processed: 0,
    identified: 0,
    autoMatched: 0,
    needsReview: 0,
    failed: 0
  }

  // Buscar transacoes de credito nao identificadas
  const { data: pendingTx, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('matched', false)
    .gt('amount', 0) // Apenas creditos (recebimentos)
    .is('suggested_client_id', null)
    .order('transaction_date', { ascending: false })
    .limit(100) // Processar em batches

  if (error) {
    console.error('Erro ao buscar transacoes:', error)
    return stats
  }

  console.log(`Processando ${pendingTx?.length || 0} transacoes pendentes`)

  for (const tx of pendingTx || []) {
    try {
      const result = await identifyPayer(supabase, tx)
      stats.processed++

      if (result.confidence > 0) {
        stats.identified++

        if (result.confidence >= 90) {
          stats.autoMatched++
        } else {
          stats.needsReview++
        }
      } else {
        stats.needsReview++
      }
    } catch (err) {
      console.error(`Erro ao processar transacao ${tx.id}:`, err)
      stats.failed++
    }
  }

  return stats
}
