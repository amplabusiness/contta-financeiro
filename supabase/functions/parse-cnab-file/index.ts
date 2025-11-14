import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { parseCNAB240Return, parseCNAB400Return, detectCNABFormat } from '../_shared/cnab-parser.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { cnab_content } = await req.json()

    if (!cnab_content) {
      throw new Error('CNAB content is required')
    }

    // Detect format
    const format = detectCNABFormat(cnab_content)

    if (!format) {
      throw new Error('Invalid CNAB format. Must be CNAB 240 or 400')
    }

    // Parse based on format
    const result = format === '240'
      ? parseCNAB240Return(cnab_content)
      : parseCNAB400Return(cnab_content)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Process paid invoices
    const paidTransactions = result.transactions.filter(t => t.status === 'paid')
    const updates = []

    for (const trx of paidTransactions) {
      // Find invoice by document number (boleto nosso número)
      const { data: invoice } = await supabase
        .from('invoices')
        .select('id, amount')
        .eq('boleto_digitable_line', trx.document_number)
        .or(`external_charge_id.eq.${trx.document_number}`)
        .single()

      if (invoice) {
        // Update invoice to paid
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            payment_date: trx.payment_date,
            payment_method: 'boleto'
          })
          .eq('id', invoice.id)

        // Create accounting entry
        await supabase.functions.invoke('create-accounting-entry', {
          body: {
            type: 'invoice',
            operation: 'payment',
            referenceId: invoice.id,
            amount: invoice.amount,
            date: trx.payment_date
          }
        })

        updates.push({ invoice_id: invoice.id, document_number: trx.document_number })
      }
    }

    // Import transactions to bank_transactions
    const { data: importedTrx, error } = await supabase
      .from('bank_transactions')
      .upsert(result.transactions.map(t => ({
        bank_reference: t.bank_reference,
        transaction_date: t.transaction_date,
        amount: t.amount,
        description: t.description,
        transaction_type: t.transaction_type,
        matched: t.status === 'paid',
        imported_from: `cnab_${format}`,
        category: 'boleto_return'
      })), {
        onConflict: 'bank_reference',
        ignoreDuplicates: true
      })

    if (error) console.error('Error importing transactions:', error)

    return new Response(JSON.stringify({
      success: true,
      format: `CNAB ${format}`,
      bank_code: result.bank_code,
      company_name: result.company_name,
      total_transactions: result.transactions.length,
      paid_invoices: paidTransactions.length,
      invoices_updated: updates.length,
      updates
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error parsing CNAB:', error)

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
