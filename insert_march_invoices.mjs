
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

function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function parseCurrency(valStr) {
    if (!valStr) return 0;
    return parseFloat(valStr.replace(/\./g, '').replace(',', '.'));
}

async function run() {
    console.log("Importing March 2025 Honorariums (Receivables)...");

    const csvPath = path.join(__dirname, 'banco', 'baixa_clientes', 'clientes de boleto março 2.csv');
    if (!fs.existsSync(csvPath)) {
        console.error("CSV not found:", csvPath);
        return;
    }

    const csvContent = fs.readFileSync(csvPath, 'latin1'); 
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim().length > 0);
    const headerLine = lines[0];
    const headers = headerLine.split(';').map(h => h.trim());
    
    const idxPagador = headers.findIndex(h => h.includes('Pagador'));
    const idxVenc = headers.findIndex(h => h.includes('Vencimento'));
    const idxLiq = headers.findIndex(h => h.includes('Liquid')); 
    const idxValor = headers.findIndex(h => h.includes('Valor')); 

    const missingClients = new Set();
    const createdPlaceholders = new Set();

    // Fetch existing clients
    const { data: clients, error: errClients } = await supabase.from('clients').select('id, name, cnpj');
    if (errClients) throw errClients;
    
    const clientMap = new Map();
    clients.forEach(c => {
        clientMap.set(c.name.toUpperCase().trim(), c.id);
        if (c.cnpj) clientMap.set(c.cnpj.replace(/\D/g, ''), c.id);
    });

    // Mapeamento manual para corrigir divergencias de nomes (CSV vs Banco)
    const manualMapping = {
        "ADMIR OLIVEIRA ALVES": "0105c761-a740-49c5-a487-71a3123f6296",
        "EVEREST GESTAO E ADMINISTRACAO DE PROPRI": "5bc57657-5577-4f21-b3d0-9ad1c3666a62",
        "KROVER ENGENHARIA E SERVICOS": "183d2e36-cf1a-4708-a656-1750a39e7f51",
        "L F GONCALVES CONFECCOES LTDA": "0c8c3517-5f71-4907-b94c-74fdf0ee2b1c",
        "L.A.R. CONSTRUTORA": "d98a951d-e182-4486-aacc-aeae2c6e963d",
        "QUICK COMERCIO DE PECAS PARA VEICULOS LT": "f6d9a90f-d1f1-4bad-8d92-cf31b6fb2f09",
        "R&P AVIACAO COMERCIO IMPORTACAO E EXPORT": "744c9872-be69-45f4-9c51-f60f581ac48c",
        "SAO LUIS INDUSTRIA E COMERCIO DE AGUA MI": "532910cd-e4a6-4457-856d-49b732b7c4db",
        "CARVALHO E MELO ADM. E PARTIPA AO EIRELI": "92e8e23a-a279-428f-9c74-8beb66ffa7af",
        "COLLOR GEL COMERCIO E INDUSTRIA DE TINTA": "f1b01a43-38b8-4521-94cf-6a2b6087c80e",
        "D ANGE COMERCIO DE BICHO DE PELUCIA LTDA": "48fd6593-adec-447b-91db-9ad7847daaf5",
        "D ANGE2 COMERCIO DE BICHO DE PELUCIA LTD": "86f4d91a-ec96-4e9b-b92e-63da2a2e6ce8",
        "FE CONSULTORIA JURIDICA": "33f6f324-a7c9-4fdc-9f5c-a49fc1cdd68e",
        "FORMA COMUNICA AO VISUAL LTDA-ME": "6500afb1-3c18-4bdd-abbc-fc509d79ab34",
        "M L PINHEIRO MILAZZO EIRELI": "41f72a96-f012-48b1-92d9-1587625973d0",
        "PREMIER SOLU OES INDUSTRIAIS LTDA": "a4e9e69b-e69b-446f-a400-b5ee012620e1",
        "TSD DISTRIBUIDORA DE CARTOES": "cca5abc2-a34f-4a8c-86ee-f48dab227a91",
        "KORSICA COMERCIO ATACADISTA DE PNEUS LTD": "6ea8cafa-3780-4fe0-a77e-366ce406a4cf",
        "MOTTA COMERCIO DE INFORMATICA LTDA": "42c749f3-4346-42ba-8c26-32f6288af855",
        "C.R.J MANUTENCAO EM AR CONDICIONADO LTDA": "dfc1df26-e264-4fec-b427-effcda2e6dd4",
        "CHRISTIANE RODRIGUES MACHADO LOPES LTDA": "d3d69d2a-061c-4910-8639-2bdc6560fde4",
        "CENTRO OESTE SERVICOS DE VISTORIAS LTDA": "abfc96dc-e28f-4ee9-83ea-5f52d1049f21",
        "MUNDIM SA E GUIMARAES ADVOGADOS ASSOCIAD": "8545268d-d93e-42ea-99c0-4110f22f6929",
        "PATRICIA PEREZ ACESSORIOS PARA NOIVAS LT": "9fabf180-853d-424e-a6ee-1941e3eb8f78",
        "MARO - AGROPECUARIA E PARTICIPACOES S/A": "6869b050-94ca-428e-83f1-36a81e613ba4",
        "MARCUS VINICIUS LEAL PIRES 75208709104": "8b2d76a3-b6fd-4a3b-be75-7699bdea74f9"
    };

    // Apply manual mappings to the clientMap for lookup
    for (const [csvName, dbId] of Object.entries(manualMapping)) {
        clientMap.set(csvName.toUpperCase(), dbId);
    }

    // Load JSON CNPJs
    let companyCnpjMap = new Map();
    try {
        const jsonPath = path.join(__dirname, 'analise_socios_grupos.json');
        if (fs.existsSync(jsonPath)) {
            const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
            const groups = JSON.parse(jsonContent); 
            groups.forEach(g => {
                if (g.companies) {
                    g.companies.forEach(c => {
                        if (c.name && c.cnpj) {
                            companyCnpjMap.set(c.name.toUpperCase().trim(), c.cnpj.replace(/\D/g, ''));
                        }
                    });
                }
            });
        }
    } catch (e) { console.warn(e.message); }

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(';');
        if (row.length < headers.length) continue;
        
        const pagador = row[idxPagador]?.trim();
        const venc = row[idxVenc]?.trim();
        const liq = row[idxLiq]?.trim();
        const valorStr = row[idxValor]?.trim();

        if (!pagador) continue;

        const amount = parseCurrency(valorStr);
        const dueDate = parseDate(venc);
        const paidDate = parseDate(liq);
        
        let clientId = clientMap.get(pagador.toUpperCase());
        
        if (!clientId) {
            const cnpj = companyCnpjMap.get(pagador.toUpperCase());
            if (cnpj) {
                const existingId = clientMap.get(cnpj);
                if (existingId) {
                     clientId = existingId;
                } else {
                    // Create with CNPJ
                    const { data: newClient } = await supabase.from('clients').insert({
                        name: pagador.toUpperCase(),
                        cnpj: cnpj,
                        is_active: true
                    }).select().single();
                    if (newClient) {
                        clientId = newClient.id;
                        clientMap.set(pagador.toUpperCase(), clientId);
                        console.log(`Created client with CNPJ: ${pagador}`);
                    }
                }
            }
            
            if (!clientId) {
                // Create Placeholder
                 const { data: newClient, error: errNew } = await supabase.from('clients').insert({
                    name: pagador.toUpperCase(),
                    is_active: true,
                    notes: 'AUTO-CREATED BY IMPORT - MISSING CNPJ'
                }).select().single();

                if (newClient) {
                    clientId = newClient.id;
                    clientMap.set(pagador.toUpperCase(), clientId);
                    createdPlaceholders.add(pagador);
                    missingClients.add(pagador);
                    console.log(`Created placeholder for: ${pagador}`);
                } else {
                    console.error(`Failed to create placeholder for ${pagador}:`, errNew?.message);
                    continue;
                }
            }
        }

        // Upsert Invoice
        const payload = {
            client_id: clientId,
            description: `HONORÁRIOS 03/2025 - ${pagador}`,
            competence: '03/2025',
            due_date: dueDate,
            amount: amount,
            status: paidDate ? 'paid' : 'pending',
            paid_date: paidDate || null,
            paid_amount: paidDate ? amount : 0, 
            total_received: paidDate ? amount : 0, 
            notes: 'Imported from clientes de boleto março 2.csv',
            type: 'income' 
        };

        const { data: existingList } = await supabase.from('invoices')
            .select('id, status')
            .eq('client_id', clientId)
            .eq('competence', '03/2025');
        
        const existing = existingList?.[0];

        if (existing) {
            if ((existing.status !== 'paid' && payload.status === 'paid')) {
                 await supabase.from('invoices').update({ 
                     status: 'paid', 
                     paid_date: payload.paid_date, 
                     paid_amount: payload.paid_amount,
                     total_received: payload.total_received
                 }).eq('id', existing.id);
                 console.log(`Updated (Marked Paid): ${pagador}`);
            }
        } else {
            const { error: errIns } = await supabase.from('invoices').insert(payload);
            if (errIns) {
                 if (errIns.message.includes('type')) {
                    delete payload.type;
                    const { error: errRetry } = await supabase.from('invoices').insert(payload);
                    if (errRetry) console.error(`Error inserting invoice for ${pagador}:`, errRetry.message);
                    else console.log(`Inserted invoice: ${pagador}`);
                } else if (errIns.message.includes('unique')) {
                    // duplicate, ignore
                } else {
                    console.error(`Error inserting invoice for ${pagador}:`, errIns.message);
                }
            } else {
                console.log(`Inserted invoice: ${pagador}`);
            }
        }
    }

    if (missingClients.size > 0) {
        console.log("\n⚠️  CLIENTS CREATED AS PLACEHOLDERS (NEED CNPJ):");
        missingClients.forEach(c => console.log(`- ${c}`));
    } else {
        console.log("\n✅ All clients accounted for.");
    }
}

run();
