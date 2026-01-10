import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Buscar todos os clientes
const { data: clients } = await supabase.from('clients').select('id, name, cnpj');

// Nomes do CSV que não foram encontrados
const nomesCSV = [
  'R&P AVIACAO COMERCIO IMPORTACAO E EXPORT',
  'MURANO ADMINISTRACAO E PARTICIPACOES LTD',
  'MARIAH PARTICIPACOES LTDA',
  'UNICAIXAS DESPACHANTE LTDA',
  'JR SOLUCOES INDUSTRIAIS LTDA',
  'GARIBALDI ADRIANO NETO',
  'RAMAYOLE CASA DOS SALGADOS EIRELI - ME',
  'PM ADMINISTRACAO E SERVICOS LTDA',
  'HOLDINGS BCS GUIMARAES LTDA',
  'DR BERNARDO GUIMARAES LTDA',
  'FE CONSULTORIA JURIDICA',
  'AMETISTA GESTAO EMPRESARIAL LTDA',
  'COVAS SERVICOS DE PINTURAS LTDA',
  'SAO LUIS INDUSTRIA E COMERCIO DE AGUA MI',
  'ACAI DO MADRUGA CAMPINAS LTDA',
  'C.R.J MANUTENCAO EM AR CONDICIONADO LTDA',
  'MEDITERRANE SERVICOS DE COWORKING LTDA',
  'RBC DESPACHANTE LTDA',
  'THC LOCACAO DE MAQUINAS LTDA',
  'UPPER DESPACHANTES LTDA',
  'AMADEU ARAUJO DA VEIGA',
  'TWO COMPANY SERVICOS ADMINISTRATIVOS LTD',
  'SEAPORT COMERCIO EXTERIOR LTDA',
];

// Função para remover acentos
function removeAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

console.log('// === MAPEAMENTOS ENCONTRADOS ===\n');

for (const nomeCSV of nomesCSV) {
  const csvNorm = removeAcentos(nomeCSV);
  
  // Buscar cliente com nome similar (sem acentos)
  const match = clients.find(c => {
    const dbNorm = removeAcentos(c.name);
    // Match se contém as primeiras 15 letras (ou menos se o nome for curto)
    const prefixo = csvNorm.substring(0, Math.min(15, csvNorm.length));
    return dbNorm.includes(prefixo) || csvNorm.includes(dbNorm.substring(0, 15));
  });
  
  if (match && match.name !== nomeCSV) {
    console.log(`  '${nomeCSV}': '${match.name}',`);
  } else if (!match) {
    console.log(`  // '${nomeCSV}' -> NÃO ENCONTRADO`);
  }
}

console.log('\n// === TODOS OS CLIENTES NO BANCO ===\n');
for (const c of clients.sort((a,b) => a.name.localeCompare(b.name))) {
  console.log(`  ${c.name}` + (c.cnpj ? ` (${c.cnpj})` : ''));
}
