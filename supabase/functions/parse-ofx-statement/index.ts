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
    const transactions = parseOFX(ofx_content)

    // Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Insert transactions (ignore duplicates)
    const { data, error } = await supabase
      .from('bank_transactions')
      .upsert(transactions, {
        onConflict: 'bank_reference',
        ignoreDuplicates: true
      })
      .select()

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      imported: data?.length || 0,
      total_parsed: transactions.length,
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
