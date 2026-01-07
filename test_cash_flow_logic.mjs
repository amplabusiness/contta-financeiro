
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function generateProjections() {
    console.log("🔮 Generating Cash Flow Projections (Simulation)...\n");

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    // 1. Fetch Active Employees
    const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error("Error fetching employees:", error);
        return;
    }

    const projections = [];

    // Helper to format date YYYY-MM-DD
    const fmtDate = (d) => d.toISOString().split('T')[0];

    for (const emp of employees) {
        const salary = Number(emp.official_salary || 0);

        if (emp.contract_type === 'CLT') {
            // Rule: 40% on 15th, 60% on 30th
            
            // Current Month
            const d15 = new Date(currentYear, currentMonth, 15);
            const d30 = new Date(currentYear, currentMonth + 1, 0); // Last day of month
            
            // Add Adiantamento (if date is future or today)
            // Actually, for projection, we usually want to see the whole month context or strictly future.
            // Let's list everything for the current month for validation.
            
            projections.push({
                due_date: fmtDate(d15),
                description: `Adiantamento Salarial - ${emp.name}`,
                amount: -(salary * 0.40), // Negative = Outflow
                type: 'FOPAG_ADIANTAMENTO'
            });

            projections.push({
                due_date: fmtDate(d30),
                description: `Saldo de Salário - ${emp.name}`,
                amount: -(salary * 0.60),
                type: 'FOPAG_SALARIO'
            });

        } else if (emp.contract_type === 'PJ') {
            // Rule: 100% on 10th
            let d10 = new Date(currentYear, currentMonth, 10);
            
            // If passed, maybe projection shows next month? 
            // For this test, let's show Current Month.
            
            // Use unofficial_salary + official_salary
            const val = Number(emp.unofficial_salary || 0) + Number(emp.official_salary || 0);

            if (val > 0) {
                projections.push({
                    due_date: fmtDate(d10),
                    description: `Honorários PJ - ${emp.name}`,
                    amount: -val,
                    type: 'FOPAG_PJ'
                });
            }
        }
    }

    // Sort by Date
    projections.sort((a, b) => a.due_date.localeCompare(b.due_date));

    console.table(projections.map(p => ({
        DATE: p.due_date,
        DESC: p.description.substring(0, 30),
        VAL: p.amount.toFixed(2),
        TYPE: p.type
    })));

    const total = projections.reduce((acc, p) => acc + p.amount, 0);
    console.log(`\n💰 Total Projected Outflow (Month): R$ ${total.toFixed(2)}`);
}

generateProjections();
