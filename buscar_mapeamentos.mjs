// Buscar clientes no banco para criar mapeamentos
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Nomes dos CSVs (sem acentos) -> buscar equivalente no banco
const termosCSV = [
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

console.log('// === NOVOS MAPEAMENTOS PARA import_baixa_clientes.mjs ===');
console.log('');

const mapeamentos = [];

for (const termoCSV of termosCSV) {
  // Extrair primeiras palavras para busca
  const palavras = termoCSV.split(' ').slice(0, 2).join(' ').replace('&', '');
  
  const { data } = await supabase
    .from('clients')
    .select('name')
    .ilike('name', `%${palavras}%`)
    .limit(3);
  
  if (data?.length) {
    // Pegar o mais similar
    const nomeBanco = data[0].name;
    if (nomeBanco.toUpperCase() !== termoCSV.toUpperCase()) {
      mapeamentos.push({ csv: termoCSV, banco: nomeBanco });
      console.log(`  '${termoCSV}': '${nomeBanco}',`);
    } else {
      console.log(`  // '${termoCSV}' -> IGUAL NO BANCO`);
    }
  } else {
    console.log(`  // '${termoCSV}' -> NÃO ENCONTRADO`);
  }
}

console.log('');
console.log('// Total mapeamentos:', mapeamentos.length);
