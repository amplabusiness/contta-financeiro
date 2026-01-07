
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

const DEPARTMENTS = {
    'Administrativo': ['ANDREA FERREIRA', 'AMANDA AMBROSIO', 'JORDANA', 'RAIMUNDO', 'LILIAN', 'CLAUDIA', 'FABIANA MARIA'],
    'DP': ['ROSEMEIRE', 'ALEXSSANDRA', 'TATIANA', 'ALINE', 'ERICK FABRICIO', 'THANINY', 'JESSYCA', 'LUCIANA', 'LUCIANE', 'DEUZA'],
    'Fiscal': ['DANIEL RODRIGUES'],
    'Contábil': ['JOSIMAR', 'THAYNARA'],
    'Legalização': ['SUELI AMARAL'],
    'Financeiro': ['TAYLANE']
};

function generateMatrix() {
    console.log("📊 DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE) - ANÁLISE HORIZONTAL POR CENTRO DE CUSTO");
    console.log("   (Baseado nos dados processados de Folha de Pagamento e Serviços Tomados)\n");

    const matrix = {};
    const depts = Object.keys(DEPARTMENTS);
    depts.push('TOTAL');

    // Initialize Matrix Rows
    const rows = ['Receita Bruta', '(-) Impostos', '(=) Receita Líquida', '(-) Pessoal (CLT)', '(-) Serviços (PJ/Terceiros)', '(=) RESULTADO OP.'];

    rows.forEach(r => {
        matrix[r] = {};
        depts.forEach(d => matrix[r][d] = 0);
    });

    // Populate Expenses from Data
    let totalOpEx = 0;

    for (const [name, amount] of Object.entries(PAYROLL_VALUES)) {
        // Find Dept
        let dept = 'Administrativo'; // Default fallthrough if not matched (but should match)
        for (const [d, names] of Object.entries(DEPARTMENTS)) {
            if (names.some(n => name.toUpperCase().includes(n) || n.includes(name.toUpperCase().split(' ')[0]))) {
                dept = d;
                break;
            }
        }

        // Categorize PJ vs CLT (Simplistic: Daniel, Rose, Sueli, Andrea, Aline, Taylane, Alexssandra, Tatiana are PJ/Ex-CLT logic)
        // From previous context:
        // PJ: Daniel, Rose, Sueli, Alexssandra, Tatiana, Andrea, Aline, Taylane
        // CLT: The rest
        const isPJ = ['Daniel', 'Rose', 'Sueli', 'Alexssandra', 'Tatiana', 'Andrea', 'Aline', 'Taylane'].some(p => name.includes(p));
        const rowName = isPJ ? '(-) Serviços (PJ/Terceiros)' : '(-) Pessoal (CLT)';

        matrix[rowName][dept] += amount;
        matrix[rowName]['TOTAL'] += amount;
        
        // Impact on Result (Expenses are negative impact, but stored positive here for display)
        matrix['(=) RESULTADO OP.'][dept] -= amount;
        matrix['(=) RESULTADO OP.']['TOTAL'] -= amount;

        totalOpEx += amount;
    }

    // Print Header
    const colWidth = 15;
    let header = "| CONTA".padEnd(30);
    depts.forEach(d => header += ` | ${d.substring(0, 12).padEnd(12)}`);
    header += " |";
    
    console.log(header);
    console.log("-".repeat(header.length));

    // Print Rows
    for (const row of rows) {
        let line = `| ${row.padEnd(28)}`;
        for (const d of depts) {
            const val = matrix[row][d];
            const strVal = val === 0 ? '-' : val.toLocaleString('pt-BR', {minimumFractionDigits: 0});
            line += ` | ${strVal.padStart(12)}`;
        }
        line += " |";
        console.log(line);
    }
    
    console.log("\n📉  OBSERVAÇÕES:");
    console.log("1. Receitas e Impostos não alocados neste relatório (foco em Custos de Pessoal).");
    console.log("2. A coluna 'Total' reflete o impacto mensal projetado.");
    console.log("3. Para visualizar isto no sistema permanentemente, é necessário executar o script SQL de migração.");
}

generateMatrix();
