// deno-lint-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @deno-types="https://cdn.sheetjs.com/xlsx-0.20.3/package/types/index.d.ts"
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
import * as cptable from 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/cpexcel.full.mjs';
import { corsHeaders } from '../_shared/cors.ts';

XLSX.set_cptable(cptable);

interface BankPaymentRecord {
  documentNumber?: string; // Nosso Número / Identificador
  paidDate?: Date;
  paidAmount?: number;
  clientName?: string;
  clientCNPJ?: string;
  status?: 'paid' | 'pending' | 'cancelled';
  bankReference?: string;
  competence?: string; // MM/YYYY
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { file_content, filename } = await req.json();

    if (!file_content) {
      throw new Error('File content is required');
    }

    console.log(`Processing Excel file: ${filename || 'unknown'}`);

    // Decode base64 content
    const binaryString = atob(file_content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Parse Excel file
    const workbook = XLSX.read(bytes, { type: 'array' });
    
    // Get first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Found ${rawData.length} rows in Excel file`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse payment records
    const paymentRecords: BankPaymentRecord[] = [];
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Detect column headers (usually first row)
    const headers = rawData[0] as string[];
    const headerMap = detectColumnMapping(headers);

    console.log('Detected column mapping:', headerMap);

    // Process each row (skip header)
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      
      if (!row || row.length === 0 || !row[headerMap.documentNumber]) {
        continue; // Skip empty rows
      }

      try {
        const record: BankPaymentRecord = {
          documentNumber: parseValue(row[headerMap.documentNumber]),
          paidAmount: parseNumber(row[headerMap.amount]),
          paidDate: parseDate(row[headerMap.paidDate]),
          clientName: parseValue(row[headerMap.clientName]),
          clientCNPJ: parseValue(row[headerMap.clientCNPJ]),
          status: parseStatus(row[headerMap.status]),
          bankReference: parseValue(row[headerMap.bankReference]),
          competence: parseCompetence(row[headerMap.competence])
        };

        paymentRecords.push(record);

        // Try to match with invoice or opening balance
        await processPaymentRecord(supabase, record);
        successCount++;

      } catch (error: unknown) {
        console.error(`Error processing row ${i}:`, error);
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentsProcessed: successCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 10), // Limit to first 10 errors
        totalRows: rawData.length - 1,
        summary: {
          processed: successCount,
          failed: errorCount,
          skipped: (rawData.length - 1) - (successCount + errorCount)
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: unknown) {
    console.error('Error processing Excel file:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details: errorStack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

/**
 * Detect column mapping from headers
 * Returns object with column indices for each field
 */
function detectColumnMapping(headers: string[]): any {
  const map: any = {
    documentNumber: -1,
    amount: -1,
    paidDate: -1,
    clientName: -1,
    clientCNPJ: -1,
    status: -1,
    bankReference: -1,
    competence: -1
  };

  headers.forEach((header, index) => {
    const normalizedHeader = (header || '').toLowerCase().trim();

    // Document number / Nosso Número
    if (normalizedHeader.match(/nosso.?n[uú]mero|documento|boleto|n[uú]mero.*documento/i)) {
      map.documentNumber = index;
    }

    // Amount / Valor
    if (normalizedHeader.match(/valor|vlr\.?|amount|total/i)) {
      map.amount = index;
    }

    // Paid date / Data de pagamento
    if (normalizedHeader.match(/data.*pag|dt.*pag|pagamento|paid.*date/i)) {
      map.paidDate = index;
    }

    // Client name / Nome do cliente
    if (normalizedHeader.match(/cliente|sacado|pagador|benefici[aá]rio|nome/i)) {
      map.clientName = index;
    }

    // Client CNPJ/CPF
    if (normalizedHeader.match(/cnpj|cpf|documento.*cliente|inscri[cç][aã]o/i)) {
      map.clientCNPJ = index;
    }

    // Status
    if (normalizedHeader.match(/status|situa[cç][aã]o|estado/i)) {
      map.status = index;
    }

    // Bank reference
    if (normalizedHeader.match(/refer[eê]ncia|nsa|c[oó]digo.*banco/i)) {
      map.bankReference = index;
    }

    // Competence / Competência
    if (normalizedHeader.match(/compet[eê]ncia|m[eê]s.*ano|per[ií]odo/i)) {
      map.competence = index;
    }
  });

  return map;
}

/**
 * Parse value from cell
 */
function parseValue(value: any): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return String(value).trim();
}

/**
 * Parse number from cell
 */
function parseNumber(value: any): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  
  // Handle string values
  if (typeof value === 'string') {
    // Remove currency symbols and thousands separators
    const cleaned = value.replace(/[R$\s.]/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }

  // Handle numeric values
  if (typeof value === 'number') {
    return value;
  }

  return undefined;
}

/**
 * Parse date from cell
 */
function parseDate(value: any): Date | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  // Handle Excel serial date
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return date;
  }

  // Handle string date (DD/MM/YYYY)
  if (typeof value === 'string') {
    const parts = value.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      return new Date(year, month, day);
    }
  }

  return undefined;
}

/**
 * Parse status from cell
 */
function parseStatus(value: any): 'paid' | 'pending' | 'cancelled' | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const normalized = String(value).toLowerCase().trim();

  if (normalized.match(/pago|quitado|liquidado|paid/i)) {
    return 'paid';
  }

  if (normalized.match(/pendente|aguardando|pending/i)) {
    return 'pending';
  }

  if (normalized.match(/cancelado|cancelled|estornado/i)) {
    return 'cancelled';
  }

  return undefined;
}

/**
 * Parse competence (MM/YYYY) from cell
 */
function parseCompetence(value: any): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const str = String(value).trim();

  // Already in MM/YYYY format
  if (str.match(/^\d{2}\/\d{4}$/)) {
    return str;
  }

  // Try to extract from date
  const dateMatch = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    return `${dateMatch[2]}/${dateMatch[3]}`;
  }

  return undefined;
}

/**
 * Process payment record and match with invoice or opening balance
 */
async function processPaymentRecord(supabase: any, record: BankPaymentRecord): Promise<void> {
  if (!record.documentNumber || !record.paidAmount || !record.paidDate) {
    console.log('Skipping record: missing required fields');
    return;
  }

  // Try to find matching invoice first
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, amount, status, client_id, competence')
    .or(`boleto_digitable_line.eq.${record.documentNumber},external_charge_id.eq.${record.documentNumber}`)
    .eq('status', 'pending')
    .limit(1);

  if (invoices && invoices.length > 0) {
    const invoice = invoices[0];
    
    // Update invoice status to paid
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_date: record.paidDate.toISOString(),
        paid_amount: record.paidAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoice.id);

    console.log(`✅ Matched payment with invoice ${invoice.id}`);
    return;
  }

  // Try to find matching opening balance entry
  if (record.competence) {
    const { data: openingBalances } = await supabase
      .from('client_opening_balance')
      .select('id, amount, paid_amount, status, client_id')
      .eq('competence', record.competence)
      .eq('status', 'pending')
      .limit(1);

    if (openingBalances && openingBalances.length > 0) {
      const openingBalance = openingBalances[0];
      const newPaidAmount = (openingBalance.paid_amount || 0) + record.paidAmount;
      const newStatus = newPaidAmount >= openingBalance.amount ? 'paid' : 'partial';

      await supabase
        .from('client_opening_balance')
        .update({
          paid_amount: newPaidAmount,
          paid_date: record.paidDate.toISOString(),
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', openingBalance.id);

      console.log(`✅ Matched payment with opening balance ${openingBalance.id} (${record.competence})`);
      return;
    }
  }

  // If no match found, log for manual review
  console.log(`⚠️ No match found for document ${record.documentNumber}`);
}
