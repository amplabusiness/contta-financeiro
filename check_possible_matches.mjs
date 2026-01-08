
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) envPath = path.join(__dirname, '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const anonKeyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
const serviceKeyMatch = envContent.match(/SupabaseServiceRole=(.+)/) || envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseUrl = urlMatch?.[1]?.trim();
const supabaseKey = serviceKeyMatch?.[1]?.trim() || anonKeyMatch?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

const missingNames = [
    "ADMIR OLIVEIRA ALVES",
    "EVEREST GESTAO E ADMINISTRACAO DE PROPRI",
    "KROVER ENGENHARIA E SERVICOS",
    "L F GONCALVES CONFECCOES LTDA",
    "L.A.R. CONSTRUTORA",
    "PATRICIA PEREZ ACESSORIOS PARA NOIVAS LT",
    "QUICK COMERCIO DE PECAS PARA VEICULOS LT",
    "R&P AVIACAO COMERCIO IMPORTACAO E EXPORT",
    "SAO LUIS INDUSTRIA E COMERCIO DE AGUA MI",
    "CARVALHO E MELO ADM. E PARTIPA AO EIRELI",
    "COLLOR GEL COMERCIO E INDUSTRIA DE TINTA",
    "D ANGE COMERCIO DE BICHO DE PELUCIA LTDA",
    "D ANGE2 COMERCIO DE BICHO DE PELUCIA LTD",
    "FE CONSULTORIA JURIDICA",
    "FORMA COMUNICA AO VISUAL LTDA-ME",
    "M L PINHEIRO MILAZZO EIRELI",
    "PREMIER SOLU OES INDUSTRIAIS LTDA",
    "TSD DISTRIBUIDORA DE CARTOES",
    "KORSICA COMERCIO ATACADISTA DE PNEUS LTD",
    "MOTTA COMERCIO DE INFORMATICA LTDA",
    "C.R.J MANUTENCAO EM AR CONDICIONADO LTDA",
    "CHRISTIANE RODRIGUES MACHADO LOPES LTDA",
    "CENTRO OESTE SERVICOS DE VISTORIAS LTDA",
    "MARO - AGROPECUARIA E PARTICIPACOES S/A",
    "MUNDIM SA E GUIMARAES ADVOGADOS ASSOCIAD"
];

async function run() {
    console.log("Searching for potential matches in the database...");
    
    // Fetch all clients to do local fuzzy matching (more efficient for small datasets than many DB calls)
    const { data: allClients, error } = await supabase.from('clients').select('id, name, cnpj');
    
    if (error) {
        console.error("Error fetching clients:", error);
        return;
    }

    const matches = [];

    for (const missing of missingNames) {
        // Simple strategy: Split missing name into words and look for clients that contain at least the first 2 significant words
        const words = missing.split(/[\s\-\.]+/).filter(w => w.length > 2);
        if (words.length === 0) continue;

        const firstWord = words[0];
        const secondWord = words[1];

        const possible = allClients.filter(c => {
            const dbName = c.name.toUpperCase();
            // Check if first word is present
            if (!dbName.includes(firstWord.toUpperCase())) return false;
            
            // If there's a second word, check it too to reduce noise
            if (secondWord && !dbName.includes(secondWord.toUpperCase())) return false;

            return true;
        });

        if (possible.length > 0) {
            matches.push({
                missing: missing,
                found: possible.map(p => `${p.name} (CNPJ: ${p.cnpj || 'N/A'}) - ID: ${p.id}`)
            });
        }
    }

    console.log("\n--- POTENTIAL MATCHES FOUND ---");
    if (matches.length === 0) {
        console.log("No partial matches found. These clients seem completely new.");
    } else {
        matches.forEach(m => {
            console.log(`\nImport Name: "${m.missing}"`);
            console.log(`Potential DB Matches:`);
            m.found.forEach(f => console.log(`  -> ${f}`));
        });
    }

    // Check the special case with CPF in name
    console.log("\n--- SPECIAL CHECKS ---");
    const marcus = "MARCUS VINICIUS LEAL PIRES 75208709104";
    const potentialCpf = "75208709104";
    // Check if this CPF exists
    const { data: cpfMatch } = await supabase.from('clients').select('*').ilike('cnpj', `%${potentialCpf}%`);
    if (cpfMatch && cpfMatch.length > 0) {
        console.log(`CPF ${potentialCpf} found in DB:`, cpfMatch.map(c => c.name));
    } else {
        console.log(`CPF ${potentialCpf} NOT found in DB.`);
    }
}

run();
