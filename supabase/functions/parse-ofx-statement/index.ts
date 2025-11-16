import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { parseOFX, isValidOFX } from '../_shared/ofx-parser.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { ofx_content } = await req.json()

    if (!ofx_content) {
      throw new Error('OFX content is required')
    }

    // Validate OFX
    if (!isValidOFX(ofx_content)) {
      throw new Error('Invalid OFX format')
    }

    // Parse OFX
    const parsedData = parseOFX(ofx_content)
    const transactions = parsedData.transactions
    const bankInfo = parsedData.bankInfo

    // Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Cadastrar banco se tiver informações
    let bankAccountId = null
    if (bankInfo?.bankId && bankInfo?.accountId) {
      // Buscar conta bancária existente
      const { data: existingBank } = await supabase
        .from('bank_balance')
        .select('id')
        .eq('account_number', bankInfo.accountId)
        .eq('bank_name', bankInfo.bankId)
        .maybeSingle()

      if (existingBank) {
        bankAccountId = existingBank.id
      } else {
        // Criar nova conta bancária
        const { data: newBank, error: bankError } = await supabase
          .from('bank_balance')
          .insert({
            account_name: `Conta ${bankInfo.accountType || 'Corrente'} - ${bankInfo.bankId}`,
            account_number: bankInfo.accountId,
            bank_name: bankInfo.bankId,
            account_type: bankInfo.accountType === 'SAVINGS' ? 'savings' : 'checking',
            balance: 0,
            balance_date: new Date().toISOString().split('T')[0],
            created_by: user.id,
            notes: `Importado automaticamente via OFX em ${new Date().toLocaleDateString('pt-BR')}`
          })
          .select()
          .single()

        if (!bankError && newBank) {
          bankAccountId = newBank.id
          console.log('Conta bancária criada:', newBank)
        }
      }
    }

    // Adicionar informações do banco nas transações
    const transactionsWithBank = transactions.map((t: any) => ({
      ...t,
      imported_from: 'OFX',
      notes: bankAccountId ? `Conta: ${bankInfo.accountId}` : t.notes
    }))

    // Insert transactions (ignore duplicates)
    const { data, error } = await supabase
      .from('bank_transactions')
      .upsert(transactionsWithBank, {
        onConflict: 'bank_reference',
        ignoreDuplicates: true
      })
      .select()

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      imported: data?.length || 0,
      total_parsed: transactions.length,
      bank_account_id: bankAccountId,
      bank_info: bankInfo,
      transactions: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error parsing OFX:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
