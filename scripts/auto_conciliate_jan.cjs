const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually load .env
try {
    const envPath = path.resolve(__dirname, "../.env");
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach(line => {
        const [key, val] = line.split("=");
        if (key && val) {
            // Remove quotes if present
            let cleanedVal = val.trim();
            if ((cleanedVal.startsWith('"') && cleanedVal.endsWith('"')) || (cleanedVal.startsWith("'") && cleanedVal.endsWith("'"))) {
                cleanedVal = cleanedVal.slice(1, -1);
            }
            process.env[key.trim()] = cleanedVal;
        }
    });
} catch (e) {
    console.error("Could not read .env", e);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Use Service Role if available, otherwise fallback
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_service_role || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const RULES = [
    { contains: "TARIFA", account: "4.1.4.03", name: "Despesas Bancárias" },
    { contains: "CESTA DE RELACIONAMENTO", account: "4.1.4.03", name: "Despesas Bancárias" },
    { contains: "TRANSITO", account: "4.1.4.02", name: "Impostos e Taxas (Detran)" },
    { contains: "VIVO", account: "4.1.3.06", name: "Telefone/Internet" },
    { contains: "TIMCEL", account: "4.1.3.06", name: "Telefone/Internet" },
    { contains: "CLICKSIGN", account: "4.1.3.11", name: "Assinaturas de Software" },
    { contains: "EQUATORIAL", account: "4.1.3.01", name: "Energia Elétrica" },
    { contains: "CAIXA ECONOMICA FEDERAL", account: "4.1.4.03", name: "Despesas Bancárias" }, 
    { contains: "SIMPLES-COB", account: "3.1.1.01", name: "Receita de Serviços" },
    { contains: "RECEBIMENTO PIX", account: "3.1.1.01", name: "Receita de Serviços" },
    { contains: "AMPLA CONTABILIDADE", type: "transfer", account: "1.1.1.01", name: "Transferência" }, // Assuming internal
    { contains: "AMPLA SAUDE", type: "transfer", account: "1.1.1.01", name: "Transferência" },
    { contains: "NAYARA", account: "4.1.1.01", name: "Salários" },
    { contains: "VICTOR HUGO", account: "4.1.1.01", name: "Salários" },
    { contains: "SERGIO AUGUSTO", account: "4.1.1.02", name: "Pró-Labore" },
    { contains: "ANDREA FERREIRA", account: "4.1.1.01", name: "Salários" },
    { contains: "CORACI ALINE", account: "4.1.1.01", name: "Salários" },
    { contains: "DANIEL RODRIGUES", account: "4.1.1.01", name: "Salários" },
];

const SICREDI_CODE = "1.1.1.05";

async function run() {
    console.log("Starting Auto-Conciliation for January 2025...");

    // 1. Get Sicredi ID
    const { data: bankAcc, error: bankError } = await supabase.from('chart_of_accounts').select('id, code').eq('code', SICREDI_CODE).single();
    let bankId = bankAcc ? bankAcc.id : null;

    if (!bankId) {
        console.log("Searching by name...");
         const { data: b2 } = await supabase.from('chart_of_accounts').select('id, code').ilike('name', '%Sicredi%').single();
         if(b2) bankId = b2.id;
         else {
             console.error("Bank account not found.");
             return;
         }
    }

    // 2. Fetch Unmatched Transactions
    const { data: txs, error: txError } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('transaction_date', '2025-01-01')
        .lte('transaction_date', '2025-01-31')
        .eq('matched', false);

    if (txError) { console.error("Error fetching txs", txError); return; }

    console.log(`Found ${txs.length} pending transactions.`);

    let processed = 0;

    for (const tx of txs) {
        let matchedRule = null;
        for (const rule of RULES) {
            if (tx.description && tx.description.toUpperCase().includes(rule.contains)) {
                matchedRule = rule;
                break;
            }
        }

        if (matchedRule) {
            // Resolve Account ID
            const { data: acc } = await supabase.from('chart_of_accounts').select('id').eq('code', matchedRule.account).single();
            if(!acc) {
                continue;
            }

            // Create Journal Entry
            const { data: entry, error: entryError } = await supabase
                .from('accounting_entries')
                .insert({
                    entry_date: tx.transaction_date,
                    competence_date: tx.transaction_date,
                    description:  `Automático (${matchedRule.name}) - ${tx.description}`,
                    entry_type: Number(tx.amount) > 0 ? 'recebimento' : 'pagamento_despesa'
                })
                .select()
                .single();

            if (entryError) { console.error("Entry error", entryError); continue; }

            const val = Math.abs(Number(tx.amount));

            try {
                if (Number(tx.amount) > 0) {
                    await supabase.from('accounting_entry_lines').insert([
                        { entry_id: entry.id, account_id: bankId, debit: val, credit: 0, description: "Entrada Banco" },
                        { entry_id: entry.id, account_id: acc.id, debit: 0, credit: val, description: matchedRule.name }
                    ]);
                } else {
                    await supabase.from('accounting_entry_lines').insert([
                        { entry_id: entry.id, account_id: acc.id, debit: val, credit: 0, description: matchedRule.name },
                        { entry_id: entry.id, account_id: bankId, debit: 0, credit: val, description: "Saída Banco" }
                    ]);
                }
                // Update Transaction
                await supabase.from('bank_transactions').update({ matched: true, journal_entry_id: entry.id }).eq('id', tx.id);
                processed++;
            } catch(e) { console.error(e); }
        }
    }
    console.log(`Processed ${processed} transactions successfully.`);
}

run();
