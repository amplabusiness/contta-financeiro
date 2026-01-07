import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse dates DD/MM/YYYY -> YYYY-MM-DD
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
    return null;
}

// Helper to parse amount 1.234,56 -> 1234.56
function parseAmount(amountStr) {
    if (!amountStr) return 0;
    return parseFloat(
      amountStr
        .replace(/\./g, "")
        .replace(",", ".")
    );
}

function calculateCompetence(vencimentoDate) {
    // Competência é mês anterior ao vencimento
    const date = new Date(vencimentoDate);
    date.setMonth(date.getMonth() - 1);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}/${year}`;
}

async function main() {
    // Reading from .env logic omitted for brevity, using hardcoded from known env context
    const SUPABASE_URL = "https://xdtlhzysrpoinqtsglmr.supabase.co";
    // Using Service Role Key to bypass RLS if necessary, or just ensuring it works for backend script
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI";

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const dirPath = path.resolve(__dirname, '../banco/baixa_clientes');
    
    if (!fs.existsSync(dirPath)) {
        console.error("Directory not found:", dirPath);
        return;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.toLowerCase().endsWith('.csv'));
    
    console.log(`Found ${files.length} CSV files to process.`);

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const content = fs.readFileSync(path.join(dirPath, file), 'latin1');
        const lines = content.split('\n');

        const boletos = [];
        
        // Detect Header Line to map columns
        const headerIndex = lines.findIndex(l => l.includes('Nosso N') || l.includes('Nosso N') || l.includes('Nosso N?'));
        
        let colMap = {
            nossoNumero: -1,
            pagador: -1,
            vencimento: -1,
            dataLiquidacao: -1,
            valorNominal: -1,
            valorPago: -1,
            nDoc: -1
        };

        if (headerIndex !== -1) {
            const headerParts = lines[headerIndex].split(';').map(p => p.trim());
            
            headerParts.forEach((h, index) => {
                const lower = h.toLowerCase();
                if (lower.includes('nosso n')) colMap.nossoNumero = index;
                else if (lower.includes('n doc') || lower.includes('n doc') || lower.includes('n? doc')) colMap.nDoc = index;
                else if (lower.includes('pagador')) colMap.pagador = index;
                else if (lower.includes('vencimento')) colMap.vencimento = index;
                else if (lower.includes('data') && lower.includes('liquida')) colMap.dataLiquidacao = index;
                else if (lower.includes('valor') && lower.includes('r$')) colMap.valorNominal = index;
                else if (lower.includes('liquida') && lower.includes('r$')) colMap.valorPago = index;
            });
            
            // Fallback for March file format if detection fails or simple case
            if (colMap.nossoNumero === -1) colMap.nossoNumero = 1;
            if (colMap.pagador === -1) colMap.pagador = 2;
        } else {
             // Default map if no header found (unlikely given logic)
             colMap = { nDoc: 0, nossoNumero: 1, pagador: 2, vencimento: 3, dataLiquidacao: 4, valorNominal: 5, valorPago: 6 };
        }

        // Validate map
        if (colMap.pagador === -1 || colMap.valorPago === -1) {
             console.warn(`Could not map columns for ${file}. Header: ${lines[headerIndex]}`);
             // Try default heuristics (March format)
             colMap = { nDoc: 0, nossoNumero: 1, pagador: 2, vencimento: 3, dataLiquidacao: 4, valorNominal: 5, valorPago: 6 };
        }

        for (let i = 0; i < lines.length; i++) {
             if (i === headerIndex) continue; // Skip header
             const line = lines[i];
             const trimmedLine = line.trim();
             if (!trimmedLine) continue;
             if (trimmedLine.includes("Totais")) continue; 

             if (trimmedLine.includes(";")) {
                const parts = trimmedLine.split(";");
                // Check bounds
                if (parts.length < 5) continue;

                const getVal = (idx) => idx !== -1 && parts[idx] ? parts[idx].trim() : "";

                const nossoNumeroRaw = getVal(colMap.nossoNumero);
                const pagador = getVal(colMap.pagador);
                const dataVencStr = getVal(colMap.vencimento);
                const dataLiqStr = getVal(colMap.dataLiquidacao);
                const valorNomStr = getVal(colMap.valorNominal);
                const valorLiqStr = getVal(colMap.valorPago);

                const parsedVenc = parseDate(dataVencStr);
                const parsedLiq = parseDate(dataLiqStr);

                if (!parsedVenc || !parsedLiq) {
                     continue;
                }

                boletos.push({
                    tipo: "BOLETO",
                    numero_boleto: getVal(colMap.nDoc) || nossoNumeroRaw, 
                    nosso_numero: nossoNumeroRaw,
                    client_name: pagador,
                    data_vencimento: parsedVenc,
                    data_pagamento: parsedLiq,
                    valor_nominal: parseAmount(valorNomStr),
                    valor_pago: parseAmount(valorLiqStr),
                    status: "LIQUIDADO",
                    competencia: calculateCompetence(parsedVenc)
                });
             }
        }

        if (boletos.length === 0) {
            console.log(`No valid boletos found in ${file} (or format mismatch).`);
            continue;
        }

        console.log(`Found ${boletos.length} boletos in ${file}. Importing via direct inserts...`);

        let importedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const boleto of boletos) {
            try {
                // 1. Find Client
                // Trying exact match first, then ilike
                let { data: clients, error: clientError } = await supabase
                    .from('clients')
                    .select('id, name')
                    .ilike('name', boleto.client_name)
                    .limit(1);

                if (clientError) throw clientError;

                if (!clients || clients.length === 0) {
                    // Try to clean up name maybe?
                    // For now, just log error
                    // console.warn(`Client not found: ${boleto.client_name}`);
                    errors.push(`Client not found: ${boleto.client_name}`);
                    errorCount++;
                    continue;
                }

                const client = clients[0];
                const description = `Boleto Liquiado ${boleto.nosso_numero || ''}`;

                // Fix for constraint paid_amount <= amount
                // If paid > nominal (due to interest), use paid amount as the invoice amount for opening balance purposes
                // to satisfy the constraint constraint paid_amount_not_greater check (paid_amount <= amount)
                const amountToRecord = Math.max(boleto.valor_nominal, boleto.valor_pago);

                // 2. Check Duplicates (only for opening balance logic)
                const { data: existing, error: dupError } = await supabase
                    .from('client_opening_balance')
                    .select('id')
                    .eq('client_id', client.id)
                    .eq('competence', boleto.competencia)
                    .gt('amount', 0) // Just check existence generally for this client/month?
                    // Reducing strictness of duplicate check because amount might differ slightly
                    .eq('description', description)
                    .maybeSingle();
                
                if (dupError) throw dupError;

                if (existing) {
                    skippedCount++;
                    continue;
                }

                // 3. Insert
                const { error: insertError } = await supabase
                    .from('client_opening_balance')
                    .insert({
                        client_id: client.id,
                        competence: boleto.competencia,
                        amount: amountToRecord,
                        due_date: boleto.data_vencimento,
                        description: description,
                        status: 'paid', // Mark as paid
                        paid_amount: boleto.valor_pago,
                        paid_date: boleto.data_pagamento,
                        notes: `Importado via Script: ${file}`
                    });

                if (insertError) throw insertError;

                importedCount++;

            } catch (err) {
                console.error(`Error processing boleto ${boleto.nosso_numero}:`, err.message);
                errors.push(`Error boleto ${boleto.nosso_numero}: ${err.message}`);
                errorCount++;
            }
        }

        console.log(`Result for ${file}:`);
        console.log(`  Imported: ${importedCount}`);
        console.log(`  Skipped:  ${skippedCount}`);
        console.log(`  Errors:   ${errorCount}`);
        if (errors.length > 0) {
             console.log(`  First 5 errors:`);
             errors.slice(0, 5).forEach(e => console.log(`   - ${e}`));
        }
    }
}

main().catch(console.error);
