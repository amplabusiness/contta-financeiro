// ============================================================================
// IMPORTAR BAIXA DE CLIENTES (COB → Clientes)
// Vincula liquidações de cobrança com clientes pagantes
// Execute: node import_baixa_clientes.mjs
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BAIXA_DIR = './banco/baixa_clientes';

// Arquivos disponíveis
const BAIXA_FILES = [
  'clientes de boleto março 2.csv',
  'clientes de boleto abril 2.csv',
  'clientes de boleto maio 2.csv',
  'clientes de boleto junho 2.csv',
  'boletos clientes julho 2.csv',
  'clientes de boleto agosto 2.csv',
  'boletos clientes setembro 2.csv',
  'clientes de boleto out 2.csv',
  'clientes de boleto nov 2.csv',
  'clientes boletos dez 2.csv'
];

// Também verificar na pasta banco raiz
const RAIZ_FILES = [
  { file: 'clientes boletos jan.csv', mes: '2025-01' },
  { file: 'clientes de boleto fev.csv', mes: '2025-02' }
];

// Parsear CSV com encoding latin1 e separador ;
function parseCSV(content, fileName) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  
  // Header
  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(';').map(h => h.trim().replace(/\r/g, ''));
  
  // Detectar formato baseado no header
  const hasCart = headers.some(h => h.includes('cart'));
  const hasDocumento = headers.some(h => h.includes('documento'));
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';').map(v => v.trim().replace(/\r/g, ''));
    if (values.length < 5) continue;
    
    // Mapear campos baseado no formato detectado
    let cob, nossoNumero, pagador, dataVencimento, dataLiquidacao, valor, valorLiquidacao, dataExtrato;
    
    // Verificar se primeiro campo começa com COB (independente do header)
    const firstFieldIsCOB = values[0]?.startsWith('COB');
    
    if (hasCart) {
      // Formato: Cart;Nº Doc;Nosso Nº;Pagador;Data Vencimento;Data Liquidação;Valor (R$);Liquidação (R$);data do extrato
      cob = values[0];
      nossoNumero = values[2];
      pagador = values[3];
      dataVencimento = values[4];
      dataLiquidacao = values[5];
      valor = values[6];
      valorLiquidacao = values[7];
      dataExtrato = values[8];
    } else if (hasDocumento) {
      // Formato Janeiro: Documento;N do boleto;Pagador;Data Vencimento;Data Liquidação; valor boleto ; valor recebido ;data do extrato
      cob = values[0];
      nossoNumero = values[1];
      pagador = values[2];
      dataVencimento = values[3];
      dataLiquidacao = values[4];
      valor = values[5];
      valorLiquidacao = values[6];
      dataExtrato = values[7];
    } else if (firstFieldIsCOB) {
      // Formato Março: Header diz "Nº Doc" mas primeiro campo é COB
      // COB;Nosso Nº;Pagador;Data Vencimento;Data Liquidação;Valor (R$);Liquidação (R$);DATA DO EXTRATO
      cob = values[0];
      nossoNumero = values[1];
      pagador = values[2];
      dataVencimento = values[3];
      dataLiquidacao = values[4];
      valor = values[5];
      valorLiquidacao = values[6];
      dataExtrato = values[7];
    } else {
      // Fallback genérico
      cob = values[0];
      nossoNumero = values[1];
      pagador = values[2];
      dataVencimento = values[3];
      dataLiquidacao = values[4];
      valor = values[5];
      valorLiquidacao = values[6];
      dataExtrato = values[7];
    }
    
    // Limpar e converter valores
    const parseValor = (v) => {
      if (!v) return 0;
      // Remove R$ (com ou sem espaço), espaços, pontos de milhar, e converte vírgula para ponto
      return parseFloat(String(v).replace(/R\s*\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    };
    
    records.push({
      cob: cob || '',
      nossoNumero: nossoNumero || '',
      pagador: pagador || '',
      dataVencimento: dataVencimento || '',
      dataLiquidacao: dataLiquidacao || '',
      valor: parseValor(valor),
      valorLiquidacao: parseValor(valorLiquidacao),
      dataExtrato: dataExtrato || ''
    });
  }
  
  return records;
}

// Converter data BR para ISO
function parseDataBR(dataBR) {
  if (!dataBR) return null;
  const parts = dataBR.split('/');
  if (parts.length !== 3) return null;
  const [dia, mes, ano] = parts;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// MAPEAMENTO MANUAL DE NOMES DIFERENTES ENTRE CSV E BANCO
const MAPEAMENTO_NOMES = {
  'ALLIANCE EMPREENDIMENTOS LTDA': 'ALLIANCE EMPREENDIMETOS',
  'MARO - AGROPECUARIA E PARTICIPACOES S/A': 'MARO - INVESTIMENTOS E PARTICIPACOES S/A',
  'MUNDIM SA E GUIMARAES ADVOGADOS ASSOCIAD': 'MUNDIM AS GUIMARÃES',
  'L.A.R. CONSTRUTORA': 'L.A.R CONSTRUTORA LTDA',
  'WESLEY MARTINS DE MOURA ME': 'WESLEY MARTNS DE MOURA',
  'AMAGU FESTAS LTDA': 'AMAGU FESTA LTDA',
  'M L PINHEIRO MILAZZO EIRELI': 'MARIO LUCIO PINHEIRO MILAZZO - FAZ',
  'C D C OLIVEIRA - ESTACAO DA ALEGRIA': 'CDC PLAYGROUND E BRINQUEDOS EIRELI', // verificar se é o mesmo
  'ELETROSOL SOLUCOES EM ENERGIA LTDA': 'ELETROSOL SOLUÇÕES EM ENCERGIA LTDA',
  'ACTION SOLUCOES INDUSTRIAIS LTDA': 'ACTION SOLUÇÕES I NDUSTRIAIS LTDA',
  'UNICAIXAS DESPACHANTE LTDA': 'UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA',
  'KORSICA COMERCIO ATACADISTA DE PNEUS LTD': 'KORSICA COM ATAC DE PNEUS LTDA',
  'CHRISTIANE RODRIGUES MACHADO LOPES LTDA': 'CHRISTIANE RODRIGEUS MACHADO',
  'ANAPOLIS SERVICOS DE VISTORIAS LTDA': 'ANAPOLIS VISTORIA LTDA',
  'CENTRO OESTE SERVICOS DE VISTORIAS LTDA': 'CENTRO OESTE SERVIÇO DE VISTORIA LT',
  'ARANTES NEGOCIOS LTDA': 'ARANTES NEGOCIOS EIRELI -ME',
  'CARVALHO E MELO ADM. E PARTIPA AO EIRELI': 'CARVALHO E MELO LTDA',
  'FORMA COMUNICA AO VISUAL LTDA-ME': 'FORMA COMUNICAÇÃO VISUAL LTDA ME',
  'MARCUS VINICIUS LEAL PIRES 75208709104': 'MARCUS VINICIUS  LEAL PIRES - MEI',
  'PREMIER SOLU OES INDUSTRIAIS LTDA': 'PREMIER SOLUÇOES INDUSTRIAL LTDA',
  'FERNANDA COVAS DO VALE': 'FERNANDA COVAS VALE',
  // === NOVOS MAPEAMENTOS JANEIRO 2025 ===
  'MARCUS ABDULMASSIH DEL PAPA': 'MARCUS ABDULMASSIH DEL PAPA', // existe igual
  'TEREZA CRISTINA DA SILVA PAES FERREIRA': 'TEREZA CRISTINA DA SILVA PAES - DOMESTICA',
  'DEL PAPA ARQUITETURA LTDA': 'DEL PAPA ARQUITETURA LTDA ME',
  'JJC PRESTADORA DE SERVICOS LTDA': 'JJC PRESTADORA DE SERVICOS LTDA', // existe igual
  'L F GONCALVES CONFECCOES LTDA': 'L.F. GONCALVES CONFECCOES LTDA',
  'MATA PRAGAS CONTROLE DE PRAGAS LTDA': 'MATA PRAGAS CONTROLE DE PRAGAS LTDA', // existe igual
  'FGS COMERCIO LTDA': 'FGS COMERCIO LTDA', // existe igual
  'BCS MINAS SERVICOS MEDICOS LTDA': 'BCS MINAS SERVIÇOS MEDICOS LTDA',
  'BCS GOIAS SERVICOS MEDICOS LTDA': 'BCS GOIAS SERVIÇOS MEDICOS LTDA',
  // === MAPEAMENTOS DOS 23 CLIENTES NÃO ENCONTRADOS ===
  'R&P AVIACAO COMERCIO IMPORTACAO E EXPORT': 'R&P AVIAÇÃO COMERCIO IMPORTAÇÃO E EXPORTAÇÃO LTDA',
  'MURANO ADMINISTRACAO E PARTICIPACOES LTD': 'MURANO ADM E PARTICIPAÇÕES LTDA',
  'MARIAH PARTICIPACOES LTDA': 'MARIAH PARTICIPAÇÕES LTDA',
  'JR SOLUCOES INDUSTRIAIS LTDA': 'JR SOLUÇÕES INDUSTRIAIS LTDA',
  'GARIBALDI ADRIANO NETO': 'GARIBLADI ADRIANO ADMINISTRAÇÃO E PARTICIPAÇÕES LTDA', // Typo no banco: GARIBLADI
  'RAMAYOLE CASA DOS SALGADOS EIRELI - ME': 'RAMAYOLI INDUSTRIA DE SALGADOS EIRELI', // RAMAYOLE → RAMAYOLI
  'PM ADMINISTRACAO E SERVICOS LTDA': 'PM ADMINSTRAÇÃO E SERVIÇOS',
  'HOLDINGS BCS GUIMARAES LTDA': 'HOLDING BCS GUIMARÃES LTDA', // HOLDINGS → HOLDING
  'DR BERNARDO GUIMARAES LTDA': 'DR BERNASRDO GUIMARÃES LTDA', // Typo no banco: BERNASRDO
  'FE CONSULTORIA JURIDICA': 'F E CONSULTORIA JURIDICA LTDA',
  'AMETISTA GESTAO EMPRESARIAL LTDA': 'AMETISTA GESTÃO EMPRESARIAL LTDA',
  'COVAS SERVICOS DE PINTURAS LTDA': 'COVAS SERVIÇOS DE PINTURAS LTDA',
  'SAO LUIS INDUSTRIA E COMERCIO DE AGUA MI': 'SÃO LUIZ INDUSTRIA E COMERCIO DE AGUA MINERAL LTDA', // SAO LUIS → SÃO LUIZ
  'ACAI DO MADRUGA CAMPINAS LTDA': 'MARILIA RAQUEL SILVA PIRES - MEI - AÇAI DO MADRUGA',
  'C.R.J MANUTENCAO EM AR CONDICIONADO LTDA': 'C.R.J MANUTENÇAO EM AR CONDICIONADO LTDA',
  'MEDITERRANE SERVICOS DE COWORKING LTDA': 'MEDITERRANE SERVIÇOS DE COWORKING LTDA',
  // === CLIENTES CADASTRADOS EM 10/01/2026 ===
  'RBC DESPACHANTE LTDA': 'RBC DESPACHANTE LTDA',
  'THC LOCACAO DE MAQUINAS LTDA': 'THC LOCACAO DE MAQUINAS LTDA',
  'UPPER DESPACHANTES LTDA': 'UPPER DESPACHANTES LTDA',
  'VIVA ESTETICA AVANCADA LTDA': 'VIVA ESTETICA AVANCADA LTDA',
  'ABRIGO NOSSO LAR': 'ABRIGO NOSSO LAR',
  'AMADEU ARAUJO DA VEIGA': 'BOA VISTA AGROPECUARIA E COM. DE MOVEIS LTDA', // Proprietário
};

// Buscar cliente por nome (fuzzy match)
async function findClientByName(nome) {
  if (!nome) return null;
  
  // Verificar mapeamento manual primeiro
  const nomeMapeado = MAPEAMENTO_NOMES[nome] || nome;
  
  // Primeiro, busca exata com nome mapeado
  const { data: exact } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', nomeMapeado)
    .limit(1);
    
  if (exact?.length) return exact[0];
  
  // Se tinha mapeamento mas não encontrou, tenta o original
  if (nomeMapeado !== nome) {
    const { data: original } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', nome)
      .limit(1);
    if (original?.length) return original[0];
  }
  
  // Busca parcial - primeiras palavras
  const palavras = nome.split(' ').slice(0, 2).join(' ');
  const { data: partial } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', `${palavras}%`)
    .limit(1);

    
  if (partial?.length) return partial[0];
  
  return null;
}

// Buscar transação bancária pelo COB e data do extrato (com tolerância de +-3 dias)
async function findBankTransaction(cob, dataExtrato) {
  const dataISO = parseDataBR(dataExtrato);
  if (!dataISO || !cob) return null;
  
  // Validar data
  const testDate = new Date(dataISO);
  if (isNaN(testDate.getTime())) return null;
  
  // Primeiro, busca exata
  const { data: exact } = await supabase
    .from('bank_transactions')
    .select('id, amount, description, transaction_date')
    .eq('transaction_type', 'credit')
    .eq('transaction_date', dataISO)
    .ilike('description', `%${cob}%`)
    .limit(1);
    
  if (exact?.[0]) return exact[0];
  
  // Se não encontrou, busca com tolerância de +-3 dias
  const date = new Date(dataISO + 'T12:00:00Z');
  const dateMin = new Date(date);
  dateMin.setDate(date.getDate() - 3);
  const dateMax = new Date(date);
  dateMax.setDate(date.getDate() + 3);
  
  const { data: fuzzy } = await supabase
    .from('bank_transactions')
    .select('id, amount, description, transaction_date')
    .eq('transaction_type', 'credit')
    .gte('transaction_date', dateMin.toISOString().split('T')[0])
    .lte('transaction_date', dateMax.toISOString().split('T')[0])
    .ilike('description', `%${cob}%`)
    .limit(1);
    
  return fuzzy?.[0] || null;
}

// Main
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         IMPORTAR BAIXA DE CLIENTES - COB → CLIENTES                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
  
  // Primeiro, listar todos os arquivos disponíveis
  const allFiles = [];
  
  // Arquivos na pasta baixa_clientes
  for (const file of BAIXA_FILES) {
    const filePath = path.join(BAIXA_DIR, file);
    if (fs.existsSync(filePath)) {
      allFiles.push({ path: filePath, name: file });
    }
  }
  
  // Arquivos na pasta banco raiz
  for (const { file } of RAIZ_FILES) {
    const filePath = path.join('./banco', file);
    if (fs.existsSync(filePath)) {
      allFiles.push({ path: filePath, name: file });
    }
  }
  
  console.log(`📁 Encontrados ${allFiles.length} arquivos de baixa\n`);
  
  // Estatísticas gerais
  let totalRecords = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;
  let totalAmount = 0;
  
  const allBaixas = [];
  const clientesNaoEncontrados = new Set();
  const transacoesNaoEncontradas = [];
  
  // Processar cada arquivo
  for (const { path: filePath, name } of allFiles) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📄 Processando: ${name}`);
    console.log('─'.repeat(60));
    
    const content = fs.readFileSync(filePath, 'latin1');
    const records = parseCSV(content, name);
    
    console.log(`   Registros encontrados: ${records.length}`);
    
    let fileMatched = 0;
    let fileUnmatched = 0;
    let fileAmount = 0;
    
    for (const record of records) {
      totalRecords++;
      fileAmount += record.valorLiquidacao || record.valor;
      totalAmount += record.valorLiquidacao || record.valor;
      
      // Buscar cliente
      const client = await findClientByName(record.pagador);
      
      // Buscar transação bancária
      const bankTx = await findBankTransaction(record.cob, record.dataExtrato);
      
      if (client && bankTx) {
        fileMatched++;
        totalMatched++;
        allBaixas.push({
          cob: record.cob,
          nosso_numero: record.nossoNumero,
          client_id: client.id,
          client_name: client.name,
          bank_transaction_id: bankTx.id,
          data_vencimento: parseDataBR(record.dataVencimento),
          data_liquidacao: parseDataBR(record.dataLiquidacao),
          data_extrato: parseDataBR(record.dataExtrato),
          valor_original: record.valor,
          valor_liquidado: record.valorLiquidacao
        });
      } else {
        fileUnmatched++;
        totalUnmatched++;
        
        if (!client) {
          clientesNaoEncontrados.add(record.pagador);
        }
        if (!bankTx) {
          transacoesNaoEncontradas.push({
            cob: record.cob,
            data: record.dataExtrato,
            pagador: record.pagador,
            valor: record.valorLiquidacao
          });
        }
      }
    }
    
    console.log(`   ✅ Match completo: ${fileMatched}`);
    console.log(`   ⚠️  Sem match: ${fileUnmatched}`);
    console.log(`   💰 Valor: R$ ${fileAmount.toFixed(2)}`);
  }
  
  // Resumo
  console.log(`\n${'═'.repeat(60)}`);
  console.log('📊 RESUMO GERAL');
  console.log('─'.repeat(60));
  console.log(`Total de registros: ${totalRecords}`);
  console.log(`✅ Match completo (cliente + transação): ${totalMatched}`);
  console.log(`⚠️  Sem match: ${totalUnmatched}`);
  console.log(`💰 Valor total: R$ ${totalAmount.toFixed(2)}`);
  
  if (clientesNaoEncontrados.size > 0) {
    console.log(`\n⚠️  ${clientesNaoEncontrados.size} clientes não encontrados:`);
    Array.from(clientesNaoEncontrados).slice(0, 20).forEach(c => {
      console.log(`   - ${c}`);
    });
    if (clientesNaoEncontrados.size > 20) {
      console.log(`   ... e mais ${clientesNaoEncontrados.size - 20}`);
    }
  }
  
  // Perguntar se quer criar tabela e inserir
  console.log('\n' + '═'.repeat(60));
  console.log('📋 PRÓXIMOS PASSOS:');
  console.log('─'.repeat(60));
  console.log('1. Criar tabela boleto_payments para armazenar a composição');
  console.log('2. Inserir os ' + totalMatched + ' registros vinculados');
  console.log('3. Atualizar bank_transactions.has_multiple_matches = true');
  console.log('4. Vincular com invoices existentes');
  
  // Gerar SQL
  console.log('\n' + '═'.repeat(60));
  console.log('📄 GERANDO SQL...');
  
  let sql = `-- ============================================================================
-- CRIAR TABELA DE COMPOSIÇÃO DE PAGAMENTOS DE BOLETOS
-- Vincula liquidações consolidadas do banco com clientes individuais
-- ============================================================================

-- 1. Criar tabela boleto_payments (se não existir)
CREATE TABLE IF NOT EXISTS boleto_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  client_id UUID REFERENCES clients(id),
  invoice_id UUID REFERENCES invoices(id),
  cob VARCHAR(20),
  nosso_numero VARCHAR(50),
  data_vencimento DATE,
  data_liquidacao DATE,
  data_extrato DATE,
  valor_original DECIMAL(15,2),
  valor_liquidado DECIMAL(15,2),
  juros DECIMAL(15,2) DEFAULT 0,
  multa DECIMAL(15,2) DEFAULT 0,
  desconto DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nosso_numero)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_boleto_payments_bank_tx ON boleto_payments(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_client ON boleto_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_cob ON boleto_payments(cob);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_data_extrato ON boleto_payments(data_extrato);

-- 2. Inserir registros de baixa
`;

  // Agrupar por COB para inserção em batch
  const batches = [];
  let currentBatch = [];
  
  for (const baixa of allBaixas) {
    const insert = `INSERT INTO boleto_payments (bank_transaction_id, client_id, cob, nosso_numero, data_vencimento, data_liquidacao, data_extrato, valor_original, valor_liquidado)
VALUES ('${baixa.bank_transaction_id}', '${baixa.client_id}', '${baixa.cob}', '${baixa.nosso_numero}', ${baixa.data_vencimento ? `'${baixa.data_vencimento}'` : 'NULL'}, ${baixa.data_liquidacao ? `'${baixa.data_liquidacao}'` : 'NULL'}, ${baixa.data_extrato ? `'${baixa.data_extrato}'` : 'NULL'}, ${baixa.valor_original}, ${baixa.valor_liquidado})
ON CONFLICT (nosso_numero) DO UPDATE SET
  valor_liquidado = EXCLUDED.valor_liquidado,
  data_liquidacao = EXCLUDED.data_liquidacao;`;
    
    currentBatch.push(insert);
    
    if (currentBatch.length >= 100) {
      batches.push(currentBatch.join('\n'));
      currentBatch = [];
    }
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch.join('\n'));
  }
  
  sql += batches.join('\n\n');
  
  sql += `

-- 3. Atualizar bank_transactions com flag de múltiplos pagamentos
UPDATE bank_transactions bt
SET has_multiple_matches = true
WHERE id IN (
  SELECT DISTINCT bank_transaction_id 
  FROM boleto_payments 
  WHERE bank_transaction_id IS NOT NULL
);

-- 4. Verificar resultado
SELECT 
  bt.transaction_date,
  bt.description,
  bt.amount AS valor_banco,
  COUNT(bp.id) AS qtd_boletos,
  SUM(bp.valor_liquidado) AS soma_boletos
FROM bank_transactions bt
JOIN boleto_payments bp ON bp.bank_transaction_id = bt.id
GROUP BY bt.id, bt.transaction_date, bt.description, bt.amount
ORDER BY bt.transaction_date
LIMIT 20;
`;

  // Salvar SQL
  fs.writeFileSync('SQL_IMPORTAR_BAIXA_CLIENTES.sql', sql);
  console.log('\n✅ SQL gerado: SQL_IMPORTAR_BAIXA_CLIENTES.sql');
  console.log(`   ${allBaixas.length} registros para inserir`);
  
  // Também salvar JSON com dados completos
  fs.writeFileSync('_baixa_clientes_parsed.json', JSON.stringify(allBaixas, null, 2));
  console.log('✅ JSON gerado: _baixa_clientes_parsed.json');
}

main().catch(console.error);
