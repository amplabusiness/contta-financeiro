import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { parseCNAB400Return, detectCNABFormat, parseCNAB240Return } from "../_shared/cnab-parser.ts";

interface ReconciliationRequest {
  cnab_content: string;
  bank_account_id: string;
}

interface ReconciliationResult {
  total_processed: number;
  reconciled: number;
  unmatched: number;
  errors: string[];
  matched_invoices: MatchedInvoice[];
}

interface MatchedInvoice {
  invoice_id: string;
  invoice_number: string;
  cnab_document: string;
  amount: number;
  payment_date: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ReconciliationRequest = await req.json();
    const { cnab_content, bank_account_id } = body;

    if (!cnab_content || !bank_account_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Detect and parse CNAB format
    const format = detectCNABFormat(cnab_content);
    if (!format) {
      return new Response(
        JSON.stringify({ error: "Invalid CNAB file format" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cnabData = format === "400"
      ? parseCNAB400Return(cnab_content)
      : parseCNAB240Return(cnab_content);

    console.log(`Processing ${cnabData.transactions.length} CNAB transactions`);

    const results: ReconciliationResult = {
      total_processed: cnabData.transactions.length,
      reconciled: 0,
      unmatched: 0,
      errors: [],
      matched_invoices: [],
    };

    // For each CNAB transaction, find matching invoice
    for (const transaction of cnabData.transactions) {
      try {
        const match = await findMatchingInvoice(
          supabase,
          transaction,
          bank_account_id
        );

        if (match) {
          // Update invoice as paid
          const { error: updateError } = await supabase
            .from("invoices")
            .update({
              status: "paid",
              payment_date: transaction.payment_date || new Date().toISOString().split("T")[0],
              reconciled_at: new Date().toISOString(),
              cnab_reference: transaction.bank_reference,
            })
            .eq("id", match.invoice_id);

          if (updateError) {
            results.errors.push(`Failed to update invoice ${match.invoice_id}: ${updateError.message}`);
          } else {
            results.reconciled++;
            results.matched_invoices.push({
              invoice_id: match.invoice_id,
              invoice_number: match.invoice_number,
              cnab_document: transaction.document_number || transaction.bank_reference,
              amount: transaction.amount,
              payment_date: transaction.payment_date || new Date().toISOString().split("T")[0],
              confidence: match.confidence,
            });

            // Create accounting entry for payment if not exists
            await createPaymentEntry(
              supabase,
              match.invoice_id,
              transaction.amount,
              transaction.payment_date || new Date().toISOString().split("T")[0]
            );
          }
        } else {
          results.unmatched++;
          console.log(`No match found for CNAB transaction: ${transaction.bank_reference}`);
        }
      } catch (error) {
        results.errors.push(`Error processing transaction ${transaction.bank_reference}: ${String(error)}`);
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

async function findMatchingInvoice(
  supabase: any,
  transaction: any,
  bank_account_id: string
): Promise<{ invoice_id: string; invoice_number: string; confidence: number } | null> {
  // Try to match by document number (our number / nosso número)
  if (transaction.document_number) {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, number, amount, due_date, status")
      .eq("document_number", transaction.document_number)
      .eq("status", "pending")
      .single();

    if (data && !error) {
      // Check if amount matches
      if (Math.abs(Number(data.amount) - transaction.amount) < 0.01) {
        return {
          invoice_id: data.id,
          invoice_number: data.number,
          confidence: 0.99,
        };
      }
    }
  }

  // Try fuzzy match by amount + date (within 3 days)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, amount, due_date, status")
    .eq("status", "pending")
    .gte("due_date", getDateOffset(transaction.transaction_date, -5))
    .lte("due_date", getDateOffset(transaction.transaction_date, 5));

  if (invoices && invoices.length > 0) {
    // Find closest match by amount
    const matches = invoices.filter(
      (inv: any) => Math.abs(Number(inv.amount) - transaction.amount) < 0.01
    );

    if (matches.length === 1) {
      return {
        invoice_id: matches[0].id,
        invoice_number: matches[0].number,
        confidence: 0.95,
      };
    }

    // If multiple matches, return the closest date match
    if (matches.length > 1) {
      const closest = matches.reduce((prev: any, curr: any) =>
        Math.abs(new Date(curr.due_date).getTime() - new Date(transaction.transaction_date).getTime()) <
        Math.abs(new Date(prev.due_date).getTime() - new Date(transaction.transaction_date).getTime())
          ? curr
          : prev
      );

      return {
        invoice_id: closest.id,
        invoice_number: closest.number,
        confidence: 0.85,
      };
    }
  }

  return null;
}

async function createPaymentEntry(
  supabase: any,
  invoice_id: string,
  amount: number,
  payment_date: string
): Promise<void> {
  try {
    // Get invoice details
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, client_id, amount")
      .eq("id", invoice_id)
      .single();

    if (!invoice) return;

    // Check if payment entry already exists
    const { data: existing } = await supabase
      .from("accounting_entries")
      .select("id")
      .eq("invoice_id", invoice_id)
      .eq("type", "payment");

    if (existing && existing.length > 0) return;

    // Create payment accounting entry
    await supabase.from("accounting_entries").insert({
      invoice_id,
      client_id: invoice.client_id,
      type: "payment",
      amount,
      entry_date: payment_date,
      status: "posted",
      description: `Pagamento reconciliado via CNAB`,
    });
  } catch (error) {
    console.error("Error creating payment entry:", error);
  }
}

function getDateOffset(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
