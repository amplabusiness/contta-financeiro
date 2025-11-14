import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const PLUGGY_API = 'https://api.pluggy.ai'
const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID')
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, data } = await req.json()

    let result

    switch (action) {
      case 'create_connect_token':
        result = await createConnectToken()
        break
      case 'sync_transactions':
        result = await syncTransactions(data.item_id, data.account_id)
        break
      case 'sync_all_accounts':
        result = await syncAllAccounts()
        break
      case 'get_accounts':
        result = await getAccounts(data.item_id)
        break
      case 'webhook':
        result = await handleWebhook(data)
        break
      default:
        throw new Error('Invalid action')
    }

    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Pluggy error:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/**
 * Get Pluggy API key
 */
async function getPluggyApiKey(): Promise<string> {
  const response = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET
    })
  })

  if (!response.ok) {
    throw new Error('Failed to authenticate with Pluggy')
  }

  const { apiKey } = await response.json()
  return apiKey
}

/**
 * Create connect token for Pluggy Widget
 */
async function createConnectToken() {
  const apiKey = await getPluggyApiKey()

  const response = await fetch(`${PLUGGY_API}/connect_token`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey
    }
  })

  if (!response.ok) {
    throw new Error('Failed to create connect token')
  }

  return await response.json()
}

/**
 * Get accounts for a connected item
 */
async function getAccounts(itemId: string) {
  const apiKey = await getPluggyApiKey()

  const response = await fetch(`${PLUGGY_API}/accounts?itemId=${itemId}`, {
    headers: {
      'X-API-KEY': apiKey
    }
  })

  if (!response.ok) {
    throw new Error('Failed to get accounts')
  }

  const { results } = await response.json()
  return results
}

/**
 * Sync transactions from a Pluggy account
 */
async function syncTransactions(itemId: string, accountId?: string) {
  const apiKey = await getPluggyApiKey()

  // Get last 90 days of transactions
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  let url = `${PLUGGY_API}/transactions?itemId=${itemId}&from=${from}&to=${to}`
  if (accountId) {
    url += `&accountId=${accountId}`
  }

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': apiKey
    }
  })

  if (!response.ok) {
    throw new Error('Failed to sync transactions')
  }

  const { results } = await response.json()

  // Import to database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const transactions = results.map((t: any) => ({
    bank_reference: t.id,
    amount: Math.abs(t.amount),
    description: t.description,
    transaction_type: t.amount > 0 ? 'credit' : 'debit',
    transaction_date: t.date,
    imported_from: 'pluggy',
    matched: false,
    category: t.category,
    metadata: {
      pluggy_id: t.id,
      account_id: t.accountId,
      payment_data: t.paymentData
    }
  }))

  const { data, error } = await supabase
    .from('bank_transactions')
    .upsert(transactions, {
      onConflict: 'bank_reference',
      ignoreDuplicates: true
    })

  if (error) throw error

  // Update last sync time
  await supabase
    .from('bank_accounts')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('pluggy_account_id', accountId)

  return {
    imported: data?.length || 0,
    total: results.length
  }
}

/**
 * Sync all connected bank accounts
 */
async function syncAllAccounts() {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get all active bank accounts with Pluggy
  const { data: accounts } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('sync_enabled', true)
    .eq('is_active', true)
    .not('pluggy_item_id', 'is', null)

  if (!accounts || accounts.length === 0) {
    return { message: 'No accounts to sync' }
  }

  const results = []

  for (const account of accounts) {
    try {
      const result = await syncTransactions(account.pluggy_item_id, account.pluggy_account_id)
      results.push({
        account_id: account.id,
        status: 'success',
        imported: result.imported
      })
    } catch (error) {
      results.push({
        account_id: account.id,
        status: 'failed',
        error: error.message
      })
    }

    // Wait 1s between accounts to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return { results }
}

/**
 * Handle Pluggy webhooks
 */
async function handleWebhook(webhookData: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Handle different webhook events
  switch (webhookData.event) {
    case 'item/created':
    case 'item/updated':
      // Update bank account with new item data
      await supabase
        .from('bank_accounts')
        .update({
          pluggy_item_id: webhookData.data.id,
          metadata: webhookData.data
        })
        .eq('pluggy_item_id', webhookData.data.id)
      break

    case 'transactions/created':
      // Auto-sync new transactions
      await syncTransactions(webhookData.data.itemId, webhookData.data.accountId)
      break

    case 'item/error':
      // Handle connection errors
      console.error('Pluggy item error:', webhookData.data)
      break
  }

  return { message: 'Webhook processed' }
}
