
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

async function diagnose() {
    console.log("Diagnosing Jan 2025...");

    // 1. Total Transações Bancárias Jan 2025
    const { data: txs, error: txError } = await supabase
        .from('bank_transactions')
        .select('id, matched, journal_entry_id')
        .gte('transaction_date', '2025-01-01')
        .lte('transaction_date', '2025-01-31');
    
    if (txError) { console.error(txError); return; }

    const totalTx = txs.length;
    const matchedTx = txs.filter(t => t.matched).length;
    const pendingTx = txs.filter(t => !t.matched).length;

    console.log(`\nBank Transactions (Jan 2025):`);
    console.log(`Total: ${totalTx}`);
    console.log(`Matched (Conciliado): ${matchedTx}`);
    console.log(`Pending (Pendente): ${pendingTx}`);

    // 2. Accounting Entries Jan 2025
    const { data: entries, error: entError } = await supabase
        .from('accounting_entries')
        .select('id, description, created_at')
        .gte('competence_date', '2025-01-01')
        .lte('competence_date', '2025-01-31');

    if (entError) { console.error(entError); return; }

    const totalEnt = entries.length;
    const autoEnt = entries.filter(e => e.description && e.description.startsWith('Automático')).length;
    const manualEnt = totalEnt - autoEnt;

    console.log(`\nAccounting Entries (Jan 2025):`);
    console.log(`Total: ${totalEnt}`);
    console.log(`Automático (criado agora): ${autoEnt}`);
    console.log(`Manual (existente antes ou manual): ${manualEnt}`);

    // 3. Check for duplicates or orphaned manual entries
    // Se temos 183 transações e 90 automáticas, e sobraram manuais...
    // Vamos listar alguns exemplos de manuais para ver se o usuário reconhece.
    
    if (manualEnt > 0) {
        console.log(`\nExemplos de Lançamentos Manuais:`);
        entries.filter(e => !e.description.startsWith('Automático')).slice(0, 5).forEach(e => {
            console.log(`- ${e.description} (Criado em: ${e.created_at})`);
        });
    }

}

diagnose();
