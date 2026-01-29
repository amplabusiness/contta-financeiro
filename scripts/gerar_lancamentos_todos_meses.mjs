/**
 * GERAR LANÇAMENTOS CONTÁBEIS - TODOS OS MESES DE 2025
 *
 * Este script processa TODOS os boletos pagos de 2025 e cria lançamentos
 * contábeis individuais por cliente no Razão do Banco.
 *
 * Uso:
 *   node gerar_lancamentos_todos_meses.mjs           # Simulação
 *   node gerar_lancamentos_todos_meses.mjs --execute # Execução real
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Usar SERVICE_ROLE_KEY para bypass do RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(process.env.VITE_SUPABASE_URL, supabaseKey);

// Configuração
const CONFIG = {
  CONTA_BANCO_SICREDI_ID: null,
  CONTA_CLIENTES_RECEBER_ID: null,
  ANO: 2025,
  DRY_RUN: !process.argv.includes('--execute'),
};

// Mapa de pagadores
let mapaPagadores = {};

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  🏦 GERAÇÃO DE LANÇAMENTOS CONTÁBEIS - BOLETOS SICREDI 2025          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📅 Ano: ${CONFIG.ANO}`);
  console.log(`🔧 Modo: ${CONFIG.DRY_RUN ? '⚠️  SIMULAÇÃO (use --execute para gravar)' : '✅ EXECUÇÃO REAL'}`);
  console.log('');

  // 1. Carregar pagadores dos CSVs
  await carregarPagadores();

  // 2. Buscar contas contábeis
  await buscarContasContabeis();

  // 3. Verificar lançamentos existentes
  const { count: existentes } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true })
    .eq('source_type', 'boleto_sicredi');

  if (existentes > 0) {
    console.log(`⚠️  Já existem ${existentes} lançamentos de boletos. Pulando para evitar duplicatas.\n`);
    console.log('   Para reprocessar, delete os lançamentos existentes primeiro.');
    return;
  }

  // 4. Buscar TODOS os boletos de 2025
  const { data: boletos, error } = await supabase
    .from('boleto_payments')
    .select('id, cob, nosso_numero, valor_liquidado, data_liquidacao, data_extrato')
    .gte('data_liquidacao', '2025-01-01')
    .lte('data_liquidacao', '2025-12-31')
    .order('data_liquidacao');

  if (error || !boletos?.length) {
    console.log('❌ Nenhum boleto encontrado:', error?.message);
    return;
  }

  console.log(`📊 Total de boletos em 2025: ${boletos.length}\n`);

  // 5. Agrupar por mês para mostrar resumo
  const porMes = {};
  for (const boleto of boletos) {
    const mes = boleto.data_liquidacao.substring(0, 7); // YYYY-MM
    if (!porMes[mes]) porMes[mes] = { boletos: [], total: 0 };
    porMes[mes].boletos.push(boleto);
    porMes[mes].total += parseFloat(boleto.valor_liquidado) || 0;
  }

  console.log('📅 RESUMO POR MÊS:');
  console.log('─'.repeat(50));
  for (const [mes, info] of Object.entries(porMes).sort()) {
    const [ano, m] = mes.split('-');
    const nomeMes = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][parseInt(m)];
    const valor = 'R$ ' + info.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    console.log(`   ${nomeMes}/${ano}: ${info.boletos.length.toString().padStart(3)} boletos | ${valor.padStart(15)}`);
  }

  const totalGeral = boletos.reduce((s, b) => s + (parseFloat(b.valor_liquidado) || 0), 0);
  console.log('─'.repeat(50));
  console.log(`   TOTAL:        ${boletos.length.toString().padStart(3)} boletos | R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}`);

  // 6. Criar lançamentos
  if (!CONFIG.DRY_RUN) {
    console.log('\n\n📝 CRIANDO LANÇAMENTOS CONTÁBEIS...');
    console.log('═'.repeat(70));

    let sucesso = 0;
    let erro = 0;
    let ultimoMes = '';

    for (const boleto of boletos) {
      const mesAtual = boleto.data_liquidacao.substring(0, 7);
      if (mesAtual !== ultimoMes) {
        if (ultimoMes) console.log('');
        console.log(`\n📅 Processando ${mesAtual}...`);
        ultimoMes = mesAtual;
      }

      const pagador = buscarPagador(boleto.nosso_numero) || 'PAGADOR NÃO IDENTIFICADO';
      const valor = parseFloat(boleto.valor_liquidado) || 0;
      const dataLancamento = boleto.data_extrato || boleto.data_liquidacao;
      const descricao = `Recebimento ${pagador} - ${boleto.cob}`;

      try {
        // Criar entry
        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert({
            entry_date: dataLancamento,
            competence_date: boleto.data_liquidacao,
            description: descricao,
            entry_type: 'recebimento',
            is_draft: false,
            reference_type: 'boleto_payment',
            reference_id: boleto.id,
            source_type: 'boleto_sicredi',
          })
          .select()
          .single();

        if (entryError) {
          erro++;
          continue;
        }

        // Criar linhas
        const { error: linhasError } = await supabase
          .from('accounting_entry_lines')
          .insert([
            {
              entry_id: entry.id,
              account_id: CONFIG.CONTA_BANCO_SICREDI_ID,
              debit: valor,
              credit: 0,
              description: `D - Banco Sicredi`
            },
            {
              entry_id: entry.id,
              account_id: CONFIG.CONTA_CLIENTES_RECEBER_ID,
              debit: 0,
              credit: valor,
              description: `C - Clientes a Receber - ${pagador}`
            }
          ]);

        if (linhasError) {
          erro++;
        } else {
          sucesso++;
          process.stdout.write('.');
          if (sucesso % 50 === 0) process.stdout.write(` ${sucesso}\n`);
        }
      } catch (e) {
        erro++;
      }
    }

    console.log('\n\n' + '═'.repeat(70));
    console.log(`✅ Lançamentos criados com sucesso: ${sucesso}`);
    if (erro > 0) console.log(`❌ Erros: ${erro}`);
    console.log('═'.repeat(70));
  } else {
    console.log('\n\n' + '═'.repeat(70));
    console.log('⚠️  MODO SIMULAÇÃO - Nenhum dado foi gravado.');
    console.log('   Para executar de verdade:');
    console.log('   node scripts/gerar_lancamentos_todos_meses.mjs --execute');
    console.log('═'.repeat(70));
  }
}

async function carregarPagadores() {
  console.log('📋 Carregando nomes dos pagadores dos CSVs...');

  const BANCO_DIR = join(__dirname, '..', 'banco');
  const BAIXA_DIR = join(__dirname, '..', 'banco', 'baixa_clientes');

  const lerCSV = (caminho) => {
    try {
      const conteudo = readFileSync(caminho, 'latin1');
      const linhas = conteudo.split('\n');
      for (let i = 1; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (!linha) continue;
        const campos = linha.split(';');
        if (campos.length >= 3) {
          const nossoNumero = campos[1]?.trim();
          const pagador = campos[2]?.trim();
          if (nossoNumero && pagador && pagador.length > 2) {
            mapaPagadores[nossoNumero] = pagador;
          }
        }
      }
    } catch (e) { /* ignore */ }
  };

  try {
    readdirSync(BANCO_DIR).filter(f => f.endsWith('.csv')).forEach(f => lerCSV(join(BANCO_DIR, f)));
    readdirSync(BAIXA_DIR).filter(f => f.endsWith('.csv')).forEach(f => lerCSV(join(BAIXA_DIR, f)));
  } catch (e) { /* ignore */ }

  console.log(`   ✓ ${Object.keys(mapaPagadores).length} pagadores carregados\n`);
}

function buscarPagador(nossoNumero) {
  if (mapaPagadores[nossoNumero]) return mapaPagadores[nossoNumero];
  const norm = nossoNumero.replace(/[^0-9]/g, '');
  for (const [key, nome] of Object.entries(mapaPagadores)) {
    if (key.replace(/[^0-9]/g, '') === norm) return nome;
  }
  return null;
}

async function buscarContasContabeis() {
  const { data: banco } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  const { data: clientes } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  if (!banco || !clientes) throw new Error('Contas contábeis não encontradas!');

  CONFIG.CONTA_BANCO_SICREDI_ID = banco.id;
  CONFIG.CONTA_CLIENTES_RECEBER_ID = clientes.id;
  console.log('✓ Contas contábeis carregadas\n');
}

main().catch(console.error);
