import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { parseCNAB400Return, detectCNABFormat, parseCNAB240Return } from "../_shared/cnab-parser.ts";
import { readOFXFile } from "../_shared/ofx-parser.ts";

interface ReconciliationRequest {
  ofx_content: string;
  cnab_content: string;
  bank_account_id: string;
}

interface ReconciliationResult {
  total_ofx_transactions: number;
  total_cnab_transactions: number;
  matched_transactions: number;
  pending_reconciliations: number;
  unmatched_ofx: number;
  unmatched_cnab: number;
  errors: string[];
  matched_details: MatchedDetail[];
}

interface MatchedDetail {
  ofx_amount: number;
  ofx_date: string;
  cnab_document: string;
  cnab_amount: number;
  cnab_date: string;
  invoice_number?: string;
  confidence: number;
  status: string;
}

interface OFXTransaction {
  amount: number;
  date: string;
  description: string;
  fitid: string;
}

interface CNABTransaction {
  amount: number;
  transaction_date: string;
  payment_date?: string;
  document_number?: string;
  bank_reference: string;
  status: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: ReconciliationRequest = await req.json();
    const { ofx_content, cnab_content, bank_account_id } = body;

    if (!ofx_content || !cnab_content || !bank_account_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (OFX, CNAB, bank_account_id)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Parse OFX
    let ofxTransactions: OFXTransaction[] = [];
    try {
      const ofxData = readOFXFile(ofx_content);
      ofxTransactions = ofxData.transactions.map((t: any) => ({
        amount: t.amount,
        date: t.date,
        description: t.description,
        fitid: t.fitid,
      }));
    } catch (error) {
      return new Response(
        JSON.stringify({ error: `Invalid OFX file: ${String(error)}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Parse CNAB
    let cnabTransactions: CNABTransaction[] = [];
    try {
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

      cnabTransactions = cnabData.transactions;
    } catch (error) {
      return new Response(
        JSON.stringify({ error: `Invalid CNAB file: ${String(error)}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(
      `Processing ${ofxTransactions.length} OFX transactions and ${cnabTransactions.length} CNAB transactions`
    );

    const results: ReconciliationResult = {
      total_ofx_transactions: ofxTransactions.length,
      total_cnab_transactions: cnabTransactions.length,
      matched_transactions: 0,
      pending_reconciliations: 0,
      unmatched_ofx: 0,
      unmatched_cnab: 0,
      errors: [],
      matched_details: [],
    };

    // Track which CNAB records were matched
    const matchedCnabIndices = new Set<number>();

    // Step 1: Match OFX transactions with CNAB records
    for (const ofxTx of ofxTransactions) {
      let cnabMatch: { index: number; transaction: CNABTransaction; confidence: number } | null =
        null;

      // Try to find a CNAB record with matching amount and date (within 2 days)
      for (let i = 0; i < cnabTransactions.length; i++) {
        if (matchedCnabIndices.has(i)) continue;

        const cnabTx = cnabTransactions[i];
        const ofxDate = new Date(ofxTx.date);
        const cnabDate = new Date(cnabTx.payment_date || cnabTx.transaction_date);

        // Check if amounts match (within 0.01)
        if (Math.abs(ofxTx.amount - cnabTx.amount) > 0.01) continue;

        // Check if dates are close (within 2 days)
        const daysDiff = Math.abs(ofxDate.getTime() - cnabDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 2) continue;

        // Found a match
        const confidence = daysDiff === 0 ? 0.99 : 0.95;
        cnabMatch = {
          index: i,
          transaction: cnabTx,
          confidence,
        };
        break;
      }

      if (cnabMatch) {
        matchedCnabIndices.add(cnabMatch.index);
        results.matched_transactions++;

        // Try to find invoice
        const invoiceMatch = await findMatchingInvoice(
          supabase,
          ofxTx,
          cnabMatch.transaction,
          bank_account_id
        );

        // Save as pending reconciliation
        try {
          const { error } = await supabase
            .from("pending_reconciliations")
            .insert({
              bank_account_id,
              invoice_id: invoiceMatch?.invoice_id,
              ofx_fitid: ofxTx.fitid,
              ofx_amount: ofxTx.amount,
              ofx_date: ofxTx.date,
              cnab_reference: cnabMatch.transaction.bank_reference,
              cnab_document: cnabMatch.transaction.document_number || cnabMatch.transaction.bank_reference,
              cnab_amount: cnabMatch.transaction.amount,
              cnab_date: cnabMatch.transaction.payment_date || cnabMatch.transaction.transaction_date,
              confidence: invoiceMatch?.confidence || cnabMatch.confidence,
              status: "pending",
            });

          if (!error) {
            results.pending_reconciliations++;
            results.matched_details.push({
              ofx_amount: ofxTx.amount,
              ofx_date: ofxTx.date,
              cnab_document: cnabMatch.transaction.document_number || cnabMatch.transaction.bank_reference,
              cnab_amount: cnabMatch.transaction.amount,
              cnab_date: cnabMatch.transaction.payment_date || cnabMatch.transaction.transaction_date,
              invoice_number: invoiceMatch?.invoice_number,
              confidence: invoiceMatch?.confidence || cnabMatch.confidence,
              status: "pending",
            });
          } else {
            results.errors.push(`Failed to save pending reconciliation: ${error.message}`);
          }
        } catch (error) {
          results.errors.push(`Error processing OFX-CNAB match: ${String(error)}`);
        }
      } else {
        results.unmatched_ofx++;
        console.log(`No CNAB match found for OFX transaction: ${ofxTx.amount} on ${ofxTx.date}`);
      }
    }

    // Count unmatched CNAB records
    results.unmatched_cnab = cnabTransactions.length - matchedCnabIndices.size;

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
  ofxTx: OFXTransaction,
  cnabTx: CNABTransaction,
  bank_account_id: string
): Promise<{ invoice_id: string; invoice_number: string; confidence: number } | null> {
  try {
    // Try to match by document number
    if (cnabTx.document_number) {
      const { data } = await supabase
        .from("invoices")
        .select("id, number")
        .eq("document_number", cnabTx.document_number)
        .eq("status", "pending")
        .single();

      if (data && Math.abs(Number(data.amount) - cnabTx.amount) < 0.01) {
        return {
          invoice_id: data.id,
          invoice_number: data.number,
          confidence: 0.99,
        };
      }
    }

    // Try fuzzy match by amount + date
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, number, amount, due_date, status")
      .eq("status", "pending")
      .gte("due_date", getDateOffset(cnabTx.payment_date || cnabTx.transaction_date, -5))
      .lte("due_date", getDateOffset(cnabTx.payment_date || cnabTx.transaction_date, 5));

    if (invoices && invoices.length > 0) {
      const matches = invoices.filter(
        (inv: any) => Math.abs(Number(inv.amount) - cnabTx.amount) < 0.01
      );

      if (matches.length === 1) {
        return {
          invoice_id: matches[0].id,
          invoice_number: matches[0].number,
          confidence: 0.95,
        };
      }
    }
  } catch (error) {
    console.error("Error finding invoice:", error);
  }

  return null;
}

function getDateOffset(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
