
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function importMissing() {
    console.log("Reading _sistema_entries.json...");
    const rawData = fs.readFileSync('_sistema_entries.json', 'utf8');
    const sistemaEntries = JSON.parse(rawData);

    // Fetch current DB entries for Jan 2025
    const accountId = '10d5892d-a843-4034-8d62-9fec95b8fd56'; 
    const { data: dbLines } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit, accounting_entries!inner(entry_date)')
        .eq('account_id', accountId)
        .gte('accounting_entries.entry_date', '2025-01-01')
        .lte('accounting_entries.entry_date', '2025-01-31');
    
    // Create a frequency map for DB entries
    // Key: "AMOUNT_TYPE" -> [Dates...]
    const dbMap = {};

    dbLines.forEach(l => {
        const type = l.debit > 0 ? 'D' : 'C';
        const val = l.debit > 0 ? l.debit : l.credit;
        const key = `${Math.round(val * 100)}_${type}`;
        
        if (!dbMap[key]) dbMap[key] = [];
        dbMap[key].push(l.accounting_entries.entry_date);
    });

    const missing = []; 
    const processedSystemKeys = new Set(); 

    // Iterate through System entries
    for (const entry of sistemaEntries) {
        if (entry.entry_date < '2025-01-01' || entry.entry_date > '2025-01-31') continue;

        let amount = 0;
        let isCreditToBank = false;
        
        if (entry.total_debit > 0) amount = entry.total_debit;
        else if (entry.total_credit > 0) amount = entry.total_credit;
        else if (entry.valor > 0) amount = entry.valor;

        const type = entry.entry_type;
        const descLower = entry.description.toLowerCase();
        
        // FILTER INVALID TYPES
        if (type === 'despesa' || descLower.includes('provisionamento')) continue;
        if (descLower.includes('saldo de abertura')) continue; 

        if (descLower.includes('pagamento') || type.includes('despesa') || type.includes('saida')) {
            isCreditToBank = true;
        } else if (descLower.includes('recebimento') || type.includes('entrada')) {
            isCreditToBank = false;
        } else if (type === 'transferencia_interna') {
             if (descLower.includes('pagamento')) isCreditToBank = true;
             else isCreditToBank = false;
        }
        if (descLower.includes('recebimento')) isCreditToBank = false;

        // Dedupe System Side: Collapse (Date, Amount, Direction)
        const sysKey = `${entry.entry_date}_${isCreditToBank ? 'C' : 'D'}_${Math.round(amount * 100)}`;
        if (processedSystemKeys.has(sysKey)) continue; 
        processedSystemKeys.add(sysKey);

        // Check against DB with Fuzzy Date
        const dbKey = `${Math.round(amount * 100)}_${isCreditToBank ? 'C' : 'D'}`;
        const dbDates = dbMap[dbKey];

        let found = false;
        if (dbDates) {
            const targetDate = new Date(entry.entry_date);
            const entryTime = targetDate.getTime();
            
            for (const dStr of dbDates) {
                const d = new Date(dStr);
                const diffTime = Math.abs(entryTime - d.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (diffDays <= 2) {
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            missing.push({
                ...entry,
                polarity: isCreditToBank ? 'Credit' : 'Debit',
                amount: amount
            });
        }
    }

    console.log(`Found ${missing.length} eligible missing transactions.`);
    
    if (missing.length === 0) {
        console.log('No entries to insert.');
        return;
    }

    console.log('Inserting records...');
    
    for (const item of missing) {
        // 1. Create Entry
        const insertPayload = {
            entry_date: item.entry_date,
            competence_date: item.entry_date, 
            description: item.description,
            entry_type: 'MANUAL', 
            total_debit: item.amount,
            total_credit: item.amount,
            created_at: new Date().toISOString()
        };

        const { data: entryData, error: entryError } = await supabase
            .from('accounting_entries')
            .insert(insertPayload)
            .select()
            .single();
            
        if (entryError) {
            console.error('Entry Insert Error:', entryError);
            continue;
        }

        // 2. Create Line
        const line = {
            entry_id: entryData.id,
            account_id: accountId,
            history: item.description, 
            debit: item.polarity === 'Credit' ? 0 : item.amount,
            credit: item.polarity === 'Credit' ? item.amount : 0
        };

        const { error: lineError } = await supabase
            .from('accounting_entry_items')
            .insert(line);
            
        if (lineError) console.error('Line Insert Error:', lineError);
    }
    
    console.log('Import Complete.');
}

importMissing();
