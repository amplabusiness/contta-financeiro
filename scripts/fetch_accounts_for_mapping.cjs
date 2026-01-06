const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY; 

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listExpenseAccounts() {
    const { data: expenses } = await supabase
        .from("chart_of_accounts")
        .select("code, name")
        .ilike("code", "4.%")
        .order("code");
    
    // Also get revenue for incoming
    const { data: revenue } = await supabase
        .from("chart_of_accounts")
        .select("code, name")
        .ilike("code", "3.%")
        .order("code");

    console.log("=== EXPENSES ===");
    console.table(expenses.filter(e => !e.name.includes("ENCERRAR")).slice(0, 30));
    
    console.log("=== REVENUE ===");
    console.table(revenue.slice(0, 30));
}

listExpenseAccounts();
