
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const DEPARTMENTS = {
    'Administrativo': {
        pj: ['ANDREA FERREIRA'],
        clt: ['Amanda Ambrosio', 'Jordana Teixeira', 'Raimundo Pereira', 'Lilian', 'Claudia', 'Fabiana Maria']
    },
    'Departamento Pessoal (DP)': {
        pj: ['ROSEMEIRE', 'ALEXSSANDRA', 'TATIANA', 'ALINE'],
        clt: ['Erick Fabricio', 'Thaniny', 'Jessyca de Freitas', 'Luciana', 'Luciane Rosa', 'Deuza']
    },
    'Contábil': {
        pj: [],
        clt: ['Josimar', 'Thaynara']
    },
    'Fiscal': {
        pj: ['DANIEL RODRIGUES'],
        clt: []
    },
    'Financeiro': {
        pj: ['TAYLANE'],
        clt: []
    },
    'Legalização': {
        pj: ['SUELI AMARAL'],
        clt: []
    }
};

const PARTNERS = ['VICTOR HUGO', 'NAYARA', 'SERGIO AUGUSTO'];

async function reportCosts() {
    console.log("📊 Calculating Monthly Costs per Department (Estimated based on recent payments)...\n");

    // We will use the last month's data scan we did, or just sum the reference values we have.
    // Since we just fixed the classifications, we can try to query the "Salaries" and "Third Party" accounts 
    // and see if we can perform a breakdown, but simpler is to use the reference values we just established.
    
    // Reference values from Memory/Audit file
    const PAYROLL_VALUES = {
        'Daniel Rodrigues': 10500.00,
        'Rose': 6677.55,
        'Sueli Amaral': 3668.77,
        'Alexssandra Ramos': 2733.39,
        'Tatiana': 1829.79,
        'Andrea Ferreira': 1518.00,
        'Aline': 1438.23,
        'Taylane': 1300.00,
        'Erick Fabricio': 4000.00,
        'Thaniny': 4000.00,
        'Amanda Ambrosio': 3800.00,
        'Josimar': 3762.00,
        'Thaynara': 3727.75,
        'Jessyca de Freitas': 3700.00,
        'Luciana': 3500.00,
        'Jordana Teixeira': 3500.00,
        'Luciane Rosa': 3300.00,
        'Deuza': 3000.00,
        'Raimundo Pereira': 2687.50,
        'Lilian': 2612.50,
        'Claudia': 2500.00,
        'Fabiana Maria': 2300.00
    };

    let totalOpEx = 0;

    for (const [dept, people] of Object.entries(DEPARTMENTS)) {
        console.log(`\n🏢 ${dept.toUpperCase()}`);
        let deptTotal = 0;

        // PJ
        for (const nameKey of people.pj) {
            // Find matched value
             const match = Object.entries(PAYROLL_VALUES).find(([key]) => nameKey.toUpperCase().includes(key.toUpperCase().split(' ')[0]) || key.toUpperCase().includes(nameKey.toUpperCase()));
             if (match) {
                 console.log(`   - ${match[0]} (PJ): R$ ${match[1].toLocaleString('pt-BR')}`);
                 deptTotal += match[1];
             }
        }
        
        // CLT
        for (const nameKey of people.clt) {
             const match = Object.entries(PAYROLL_VALUES).find(([key]) => key.toUpperCase().includes(nameKey.toUpperCase().split(' ')[0]));
             if (match) {
                 console.log(`   - ${match[0]} (CLT): R$ ${match[1].toLocaleString('pt-BR')}`);
                 deptTotal += match[1];
             }
        }

        console.log(`   💰 TOTAL ${dept}: R$ ${deptTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
        totalOpEx += deptTotal;
    }

    console.log(`\n-------------------------------------------`);
    console.log(`📉 TOTAL OPERATIONAL PERSONNEL COST: R$ ${totalOpEx.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);
    
    console.log(`\n\n🏛️  PARTNER WITHDRAWALS (Non-Operational / Assets)`);
    const partnerDraw = 6000.00;
    const partners = ['Victor Hugo', 'Nayara Leão', 'Sérgio Augusto'];
    let totalPartners = 0;
    
    partners.forEach(p => {
        console.log(`   - ${p}: R$ ${partnerDraw.toLocaleString('pt-BR')}`);
        totalPartners += partnerDraw;
    });
    console.log(`   💰 TOTAL WITHDRAWALS: R$ ${totalPartners.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`);

}

reportCosts();
