// Listar clientes não cadastrados que pagaram boletos
import fs from 'fs';

const csvFiles = [
  { file: 'banco/clientes boletos jan.csv', pagadorIdx: 2, valorIdx: 6 },
  { file: 'banco/clientes de boleto fev.csv', pagadorIdx: 2, valorIdx: 6 },
  { file: 'banco/baixa_clientes/clientes de boleto março 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/clientes de boleto abril 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/clientes de boleto maio 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/clientes de boleto junho 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/boletos clientes julho 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/clientes de boleto agosto 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/boletos clientes setembro 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/clientes de boleto out 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/clientes de boleto nov 2.csv', pagadorIdx: 3, valorIdx: 7 },
  { file: 'banco/baixa_clientes/clientes boletos dez 2.csv', pagadorIdx: 3, valorIdx: 7 },
];

// Termos de busca (início dos nomes dos clientes não encontrados)
const termosBusca = [
  'JR SOLUCOES',
  'R&P AVIACAO',
  'RAMAYOLE',
  'SAO LUIS INDUSTRIA',
  'FE CONSULTORIA',
  'UNICAIXAS DESPACHANTE',
  'AMETISTA GESTAO',
  'C.R.J MANUTENCAO',
  'COVAS SERVICOS',
  'PM ADMINISTRACAO',
  'MURANO ADMINISTRACAO',
  'AMADEU ARAUJO',
  'DR BERNARDO',
  'HOLDINGS BCS',
  'MARIAH PARTICIPACOES',
  'ACAI DO MADRUGA',
  'MEDITERRANE',
  'GARIBALDI ADRIANO',
  'RBC DESPACHANTE',
  'THC LOCACAO',
  'UPPER DESPACHANTES',
  'TWO COMPANY',
  'SEAPORT COMERCIO',
];

const resultados = {};

for (const { file, pagadorIdx, valorIdx } of csvFiles) {
  try {
    const content = fs.readFileSync(file, 'latin1');
    const lines = content.split('\n').filter(l => l.trim());
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';');
      const pagador = (cols[pagadorIdx] || '').trim().replace(/\r/g, '').toUpperCase();
      
      if (!pagador) continue;
      
      // Verificar cada termo
      for (const termo of termosBusca) {
        if (pagador.includes(termo.toUpperCase())) {
          let valorStr = (cols[valorIdx] || '').replace(/R\s*\$/g, '').replace(/\./g, '').replace(',', '.').trim();
          const valor = parseFloat(valorStr) || 0;
          
          if (!resultados[termo]) {
            resultados[termo] = { nomeCompleto: pagador, valor: 0, count: 0, meses: [] };
          }
          resultados[termo].valor += valor;
          resultados[termo].count++;
          
          // Mês do arquivo
          const mes = file.match(/(jan|fev|março|abril|maio|junho|julho|agosto|setembro|out|nov|dez)/i)?.[1] || '?';
          if (!resultados[termo].meses.includes(mes)) {
            resultados[termo].meses.push(mes);
          }
          break; // Só conta uma vez por linha
        }
      }
    }
  } catch (e) {
    console.error(`Erro ao ler ${file}:`, e.message);
  }
}

// Ordenar por valor
const sorted = Object.entries(resultados).sort((a, b) => b[1].valor - a[1].valor);

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════╗');
console.log('║                     CLIENTES NÃO CADASTRADOS QUE PAGARAM BOLETOS EM 2025                                 ║');
console.log('╠═══════════════════════════════════════════════════════════════════════════════════════════════════════════╣');
console.log('║  #  │ Cliente                                               │ Boletos │      Valor       │ Meses         ║');
console.log('╠═════╪═══════════════════════════════════════════════════════╪═════════╪══════════════════╪═══════════════╣');

let totalValor = 0;
let totalBoletos = 0;

sorted.forEach(([termo, data], i) => {
  const nome = data.nomeCompleto.substring(0, 53).padEnd(53);
  const meses = data.meses.slice(0, 4).join(',').substring(0, 13);
  console.log('║ ' + String(i+1).padStart(2) + '  │ ' + nome + ' │ ' + String(data.count).padStart(7) + ' │ R$ ' + data.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12) + ' │ ' + meses.padEnd(13) + ' ║');
  totalValor += data.valor;
  totalBoletos += data.count;
});

// Termos não encontrados
const naoEncontrados = termosBusca.filter(t => !resultados[t]);
naoEncontrados.forEach((termo, i) => {
  console.log('║ ' + String(sorted.length + i + 1).padStart(2) + '  │ ' + termo.padEnd(53) + ' │     N/A │            N/A   │ N/A           ║');
});

console.log('╠═════╧═══════════════════════════════════════════════════════╧═════════╧══════════════════╧═══════════════╣');
console.log('║  TOTAL: ' + String(termosBusca.length).padStart(2) + ' clientes não cadastrados                        │ ' + String(totalBoletos).padStart(7) + ' │ R$ ' + totalValor.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12) + ' │               ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('📝 Ação necessária: Cadastrar estes ' + termosBusca.length + ' clientes no sistema.');
console.log('   Após cadastro, re-executar: node import_baixa_clientes.mjs');
console.log('   Diferença atual não mapeada: R$ 242.978,01');
