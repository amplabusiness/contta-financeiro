
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function analyzeDescriptions() {
    console.log("=== Analisando Descrições no Banco ===");

    const { data: acc } = await supabase.from('chart_of_accounts').select('id').eq('code', '1.1.1.05').single();
    const accountId = acc.id;

    const { data: entries } = await supabase
        .from('accounting_entry_lines')
        .select(`
            debit, 
            credit, 
            accounting_entries!inner (
                description
            )
        `)
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31');

    const typeSummary = {};

    entries.forEach(e => {
        let desc = e.accounting_entries.description;
        // Simplify description to find patterns
        let type = "OUTROS";
        if (desc.includes("PIX")) type = "PIX (Importado)";
        else if (desc.includes("TARIFA")) type = "TARIFA (Importado)";
        else if (desc.includes("LIQ.")) type = "LIQUIDACAO (Importado)";
        else if (desc.includes("Recebimento de Honorários")) type = "SISTEMA: HONORARIOS";
        else if (desc.includes("Pagamento de Despesa")) type = "SISTEMA: DESPESA";
        else if (desc.includes("Baixa")) type = "SISTEMA: BAIXA";
        else if (desc.includes("RECEBIMENTO BOLETO")) type = "BOLETO (Importado)";
        
        if (!typeSummary[type]) typeSummary[type] = { count: 0, debit: 0, credit: 0 };
        typeSummary[type].count++;
        typeSummary[type].debit += Number(e.debit||0);
        typeSummary[type].credit += Number(e.credit||0);
    });

    console.table(typeSummary);
}

analyzeDescriptions();
