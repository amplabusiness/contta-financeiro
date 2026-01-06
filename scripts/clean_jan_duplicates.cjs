
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = path.resolve(__dirname, '..', '.env');
const envConfig = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanBadEntries() {
    console.log("Cleaning duplicated automatic entries...");

    // 1. Identify entries to delete (Created today with 'Automático' prefix)
    // Safety check: only delete those created very recently or by description pattern
    
    const { data: entries, error } = await supabase
        .from('accounting_entries')
        .select('id')
        .ilike('description', 'Automático%')
        .gte('created_at', new Date().toISOString().split('T')[0]); // created today

    if (error) { console.error(error); return; }

    if (entries.length === 0) {
        console.log("No entries found to clean.");
        return;
    }

    console.log(`Found ${entries.length} entries to delete.`);
    const ids = entries.map(e => e.id);

    // 2. Delete matches in bank_transactions first (reset them)
    // Actually, if we delete the entry, we should set matched=false on transaction
    // But my previous diagnostic said "matched: 0", so maybe they are not linked.
    // Let's be safe and try to update any tx linked to these ids.

    const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({ matched: false, journal_entry_id: null })
        .in('journal_entry_id', ids);

    if (updateError) console.log("Error unmatching transactions (might be none):", updateError.message);
    else console.log("Reset bank transactions links.");

    // 3. Delete accounting_entry_lines (cascade usually handles this, but let's be explicit if needed, though CASCADE is better)
    // Assuming DB has CASCADE. If not, delete lines first.
    const { error: linesError } = await supabase
        .from('accounting_entry_lines')
        .delete()
        .in('entry_id', ids);
    
    if (linesError) console.log("Error deleting lines (or already deleted):", linesError.message);

    // 4. Delete accounting_entries
    const { error: delError } = await supabase
        .from('accounting_entries')
        .delete()
        .in('id', ids);

    if (delError) console.error("Error deleting entries:", delError);
    else console.log("Successfully deleted duplicated entries.");

}

cleanBadEntries();
