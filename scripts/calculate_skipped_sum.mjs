
import fs from 'fs';

function calculateSkipped() {
    console.log("Reading _sistema_entries.json...");
    const rawData = fs.readFileSync('_sistema_entries.json', 'utf8');
    const entries = JSON.parse(rawData);

    let saldoSum = 0;
    let provisaoSum = 0;
    let countSaldo = 0;

    for (const e of entries) {
        const descLower = e.description.toLowerCase();
        
        if (descLower.includes('saldo de abertura')) {
            const val = Number(e.total_debit || e.total_credit || 0);
            saldoSum += val;
            console.log(`[${e.entry_date}] R$ ${val.toFixed(2)} - ${e.description.substring(0, 50)}...`);
            countSaldo++;
        }
        else if (descLower.includes('provisionamento')) {
            const val = Number(e.total_debit || e.total_credit || 0);
            provisaoSum += val;
        }
    }

    console.log('\n--- Resultado ---');
    console.log(`'Saldo de Abertura' Total: R$ ${saldoSum.toFixed(2)} (${countSaldo} itens)`);
    console.log(`'Provisionamento' Total: R$ ${provisaoSum.toFixed(2)}`);
}

calculateSkipped();
