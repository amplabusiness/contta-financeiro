
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function fixDuplicates() {
    const accountId = '10d5892d-a843-4034-8d62-9fec95b8fd56'; // Sicredi

    // 1. Fetch all lines for Jan 2025
    const { data: allLines, error } = await supabase
        .from('accounting_entry_lines')
        .select('id, debit, credit, accounting_entries!inner(id, entry_date, description)')
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31');

    if (error) {
        console.error('Error fetching lines:', error);
        return;
    }

    console.log(`Fetched ${allLines.length} lines.`);

    // 2. Group by Date + Amount + Type
    const groups = {};
    allLines.forEach(l => {
        const type = l.debit > 0 ? 'D' : 'C';
        const amt = l.debit > 0 ? l.debit : l.credit;
        // Use a looser grouping key (toFixed 2) to handle float variances
        const key = `${l.accounting_entries.entry_date}_${Math.round(amt * 100)}_${type}`;
        
        if (!groups[key]) groups[key] = [];
        groups[key].push(l);
    });

    const entriesToDelete = [];

    // 3. Analyze Groups
    Object.values(groups).forEach(group => {
        if (group.length < 2) return;

        // We have a collision.
        // Heuristic: Prefer "Bank" descriptions over "System" descriptions.
        
        const systemPatterns = [
            /^Pagamento de Despesa/i,
            /^Recebimento de Honorários/i,
            /^Recebimento: LIQ.COBRANCA/i,
            /^Despesa: LIQUIDACAO BOLETO/i,  // Sometimes this is the system one?
            /^Despesa: PAGAMENTO PIX/i       // Wait, some system ones look like pix?
        ];

        // Let's print them to be safe before we add to delete list
        // In the previous output:
        // "Pagamento de Despesa (A Classificar)" -> DELETE
        // "Adiantamento Socio: PAGAMENTO PIX..." -> KEEP
        
        // "Recebimento de Honorários (Competência Corrente)" -> DELETE
        // "Recebimento: RECEBIMENTO PIX..." -> KEEP

        // "Recebimento: LIQ.COBRANCA SIMPLES..." -> DELETE
        // "Recebimento: RECEBIMENTO PIX..." -> KEEP

        // "Despesa: LIQUIDACAO BOLETO..." vs "Pagamento de Despesa (Automático)"
        // In Group 2025-01-31 Credit 138.22:
        // Line A: Despesa: LIQUIDACAO BOLETO... ONEFLOW SA
        // Line B: Pagamento de Despesa (Automático)
        // -> DELETE B. Keep A (it has the Payee Name).

        // In Group 2025-01-31 Credit 5901.92:
        // Line A: Despesa: PAGAMENTO PIX... DEUZA
        // Line B: Pagamento de Despesa (A Classificar)
        // -> DELETE B. Keep A.

        // So the rule is: Delete the one that is "Pagamento de Despesa (A Classificar/Automático)"
        // Or "Recebimento de Honorários (Competência Corrente)"
        
        // Strategy: Sort by "Quality of Description".
        // The "Bad" descriptions are very specific constants.

        const badDescriptions = [
            'Pagamento de Despesa (A Classificar)',
            'Pagamento de Despesa (Automático)',
            'Recebimento de Honorários (Competência Corrente)',
            'Recebimento: LIQ.COBRANCA SIMPLES' // This one is partial match
        ];

        let keeper = null;
        let trash = [];

        // Identify Trash
        group.forEach(item => {
            const desc = item.accounting_entries.description;
            let isTrash = false;
            
            if (desc === 'Pagamento de Despesa (A Classificar)') isTrash = true;
            if (desc === 'Pagamento de Despesa (Automático)') isTrash = true;
            if (desc === 'Recebimento de Honorários (Competência Corrente)') isTrash = true;
            if (desc.startsWith('Recebimento: LIQ.COBRANCA SIMPLES')) {
                // Only trash this IF there is another better entry (like a PIX)
                // If the group is just 2 LIQ.COBRANCA lines, we have a problem.
                // But usually it's paired with "Recebimento: RECEBIMENTO PIX..."
                const hasPix = group.some(x => x.accounting_entries.description.includes('RECEBIMENTO PIX'));
                if (hasPix) isTrash = true;
            }
            if (desc === 'Despesa: LIQUIDACAO BOLETO-          01015676000111 CONS REG CONTABILIDADE EST') {
                 // SPECIAL CASE: Group 2025-01-31 Credit 597 contains TWO of these plus Pagamento (Auto).
                 // We want to keep ONE of the specific ones.
            }

            if (isTrash) {
                trash.push(item);
            } else {
                if (!keeper) keeper = item;
                else {
                    // We have multiple "Good" entries? 
                    // E.g. Group 2025-01-10 Credit 312.21
                    // Both are "Despesa: DEBITO CONVENIOS-PMGO-C". 
                    // This is a true duplicate in the source or import.
                    // If they are literally identical descriptions, mark one as trash.
                    if (item.accounting_entries.description === keeper.accounting_entries.description) {
                        trash.push(item);
                    }
                }
            }
        });

        if (trash.length > 0) {
            trash.forEach(t => entriesToDelete.push(t.accounting_entries.id));
        }
    });

    console.log(`Identified ${entriesToDelete.length} entries to delete.`);
    
    if (entriesToDelete.length > 0) {
        // console.log('Deleting IDs:', entriesToDelete);
        const { error: delError } = await supabase
            .from('accounting_entries')
            .delete()
            .in('id', entriesToDelete);
            
        if (delError) console.error('Delete failed:', delError);
        else console.log('Deletion successful.');
    }
}

fixDuplicates();
