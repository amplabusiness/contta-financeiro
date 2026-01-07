
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQuery(dateStr) {
    const competenceDate = new Date(dateStr);
    const startDateFilter = dateStr; 
    // Logic: start_date <= date AND (termination is null OR termination >= date)
    
    console.log(`\nTesting for Competence: ${dateStr}`);
    
    const { data, error } = await supabase
        .from('accounting_contracts')
        .select(`
            id,
            monthly_fee,
            start_date,
            termination_date, 
            status,
            clients!inner ( name )
        `)
        .lte('start_date', startDateFilter)
        // .or(`termination_date.is.null,termination_date.gte.${startDateFilter}`) // .or syntax is tricky with mixed precedence
        // Using explicit filter for termination is safer in JS by filtering locally or carefully constructing query
        .in('status', ['active', 'suspended', 'terminated'])
        .gt('monthly_fee', 0)
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Client-side filtering because OR Logic in Supabase JS client can be tricky when combined with ANDs
    const validContracts = data.filter(c => {
        if (c.termination_date && new Date(c.termination_date) < competenceDate) return false;
        return true;
    });

    console.log(`Found ${validContracts.length} valid contracts (sample):`);
    validContracts.forEach(c => {
        console.log(`- ${c.clients.name}: Fee ${c.monthly_fee} (Start: ${c.start_date}, End: ${c.termination_date || 'Active'})`);
    });
}

async function run() {
    await testQuery('2025-01-01');
    await testQuery('2026-01-01'); // Future check
}

run();
