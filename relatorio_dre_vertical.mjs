
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.local') });

// Reference Data (Simulating DB content for Report)
const PAYROLL_VALUES = {
    // PJ / Terceiros
    'Daniel Rodrigues': 10500.00,
    'Rose': 6677.55,
    'Sueli Amaral': 3668.77,
    'Alexssandra Ramos': 2733.39,
    'Tatiana': 1829.79,
    'Andrea Ferreira': 1518.00,
    'Aline': 1438.23,
    'Taylane': 1300.00,
    
    // CLT
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
    'Fabiana Maria': 2300.00,

    // Family / Partners / Personal
    'Sergio Augusto': 4000.00, // Estimated value, verifying user intent "Sergio Augusto"
    'Victor Hugo': 6000.00,
    'Nayara Leão': 6000.00,
    'Sérgio Augusto (Pai)': 6000.00 // Assuming this is the Partner
};

async function generateVerticalDRE() {
    console.log("📊 DRE GERENCIAL - ANÁLISE VERTICAL (SIMULAÇÃO)");
    console.log("   (Estrutura de Contas e Centros de Custo Ajustada)\n");

    // 1. Define Categories based on User Input
    const groups = {
        'RECEITA': { total: 140000.00, items: [] }, // Est. Revenue based on context or user hint
        'IMPOSTOS': { total: 140000.00 * 0.10, items: [] }, // Est. 10%
        'DESPESAS OPERACIONAIS': {
            'PESSOAL (CLT)': [],
            'SERVIÇOS TERCEIROS (PJ)': [],
            'ADMINISTRATIVO': []
        },
        'NÃO OPERACIONAL / SÓCIOS': {
            'RETIRADAS SÓCIOS': [],
            'DESPESAS SERGIO (FILHOS / PESSOAL)': []
        }
    };

    // 2. Classify Items
    for (const [name, val] of Object.entries(PAYROLL_VALUES)) {
        // SERGIO AUGUSTO -> FILHO SERGIO (Non-Operational/Family)
        if (name === 'Sergio Augusto') {
            groups['NÃO OPERACIONAL / SÓCIOS']['DESPESAS SERGIO (FILHOS / PESSOAL)'].push({name, val});
            continue;
        }
        
        // Partners
        if (['Victor Hugo', 'Nayara Leão', 'Sérgio Augusto (Pai)'].includes(name)) {
             groups['NÃO OPERACIONAL / SÓCIOS']['RETIRADAS SÓCIOS'].push({name, val});
             continue;
        }

        // Logic for PJ vs CLT
        const isPJ = ['Daniel', 'Rose', 'Sueli', 'Alexssandra', 'Tatiana', 'Andrea', 'Aline', 'Taylane'].some(p => name.includes(p));
        
        if (isPJ) {
            groups['DESPESAS OPERACIONAIS']['SERVIÇOS TERCEIROS (PJ)'].push({name, val});
        } else {
            groups['DESPESAS OPERACIONAIS']['PESSOAL (CLT)'].push({name, val});
        }
    }

    // 3. Calculate Aggregates
    const revenue = groups['RECEITA'].total;
    const taxes = groups['IMPOSTOS'].total;
    const netRevenue = revenue - taxes;

    let totalOpEx = 0;
    const opExDetails = {};

    for (const [subcat, items] of Object.entries(groups['DESPESAS OPERACIONAIS'])) {
        const subTotal = items.reduce((acc, i) => acc + i.val, 0);
        opExDetails[subcat] = subTotal;
        totalOpEx += subTotal;
    }

    const operatingResult = netRevenue - totalOpEx;

    let totalNonOp = 0;
    const nonOpDetails = {};
     for (const [subcat, items] of Object.entries(groups['NÃO OPERACIONAL / SÓCIOS'])) {
        const subTotal = items.reduce((acc, i) => acc + i.val, 0);
        nonOpDetails[subcat] = subTotal;
        totalNonOp += subTotal;
    }
    
    // 4. Print Report
    const printLine = (label, val, indent = 0, isTotal = false) => {
        const pct = (val / revenue * 100).toFixed(1) + '%';
        const prefix = " ".repeat(indent);
        const labelStr = isTotal ? label.toUpperCase() : label;
        console.log(`| ${prefix}${labelStr.padEnd(48 - indent)} | R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${pct.padStart(6)} |`);
    };

    const separator = () => console.log("|" + "-".repeat(73) + "|");

    console.log("| CONTA                                            | VALOR (R$)   | AV (%) |");
    separator();
    printLine("RECEITA BRUTA (ESTIMADA)", revenue, 0, true);
    printLine("(-) IMPOSTOS", -taxes, 2);
    separator();
    printLine("(=) RECEITA LÍQUIDA", netRevenue, 0, true);
    console.log("|                                                  |              |        |");
    
    printLine("(-) DESPESAS OPERACIONAIS", -totalOpEx, 0, true);
    
    // Breakdown OpEx
    for (const [subcat, val] of Object.entries(opExDetails)) {
        printLine(subcat, -val, 4);
    }
    
    separator();
    printLine("(=) RESULTADO OPERACIONAL (EBITDA)", operatingResult, 0, true);
    console.log("|                                                  |              |        |");

    printLine("(-) MOVIMENTAÇÃO NÃO OPERACIONAL / SÓCIOS", -totalNonOp, 0, true);
    // Breakdown NonOp
    for (const [subcat, val] of Object.entries(nonOpDetails)) {
        printLine(subcat, -val, 4);
        // List items in NonOp to confirm Sergio Augusto location
        if (subcat === 'DESPESAS SERGIO (FILHOS / PESSOAL)') {
            groups['NÃO OPERACIONAL / SÓCIOS'][subcat].forEach(item => {
                 printLine(`   > ${item.name} (Ref. Centro de Custo: Filho Sergio)`, -item.val, 8);
            });
        }
    }

    separator();
    const finalResult = operatingResult - totalNonOp;
    printLine("(=) RESULTADO LÍQUIDO (CAIXA)", finalResult, 0, true);
    separator();

    console.log("\n✅ VERIFICAÇÃO:");
    console.log("1. 'Sergio Augusto' foi movido para 'DESPESAS SERGIO (FILHOS)' como solicitado.");
    console.log("2. Análise Vertical mostra o impacto de cada grupo sobre a Receita Bruta.");
    console.log("3. Estrutura pronta para ser replicada no Banco de Dados (Cost Centers + Accounts).");
}

generateVerticalDRE();
