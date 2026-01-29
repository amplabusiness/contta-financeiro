/**
 * CONSULTA DR. CÍCERO - LÓGICA DE CONTAS SINTÉTICAS VS ANALÍTICAS
 *
 * Problema: Lançamentos estão na conta sintética 1.1.2.01 (Clientes a Receber)
 * ao invés das contas analíticas por cliente (1.1.2.01.0001, etc.)
 *
 * Fundamentação: NBC TG 26, ITG 2000
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function consultarDrCicero() {
  console.log('═'.repeat(80));
  console.log('📚 CONSULTA DR. CÍCERO - CONTAS SINTÉTICAS VS ANALÍTICAS');
  console.log('═'.repeat(80));

  const pergunta = `
Dr. Cícero, preciso de orientação sobre a estrutura correta de contas sintéticas e analíticas.

SITUAÇÃO ATUAL:
- Conta 1.1.2.01 (Clientes a Receber) está marcada como SINTÉTICA (is_synthetic = true)
- Existem 396 contas analíticas filhas (1.1.2.01.0001, 1.1.2.01.0002, etc.)
- MAS: há 4.024 lançamentos DIRETOS na conta sintética 1.1.2.01

PROBLEMA:
Os lançamentos de honorários (invoice) e recebimentos (boleto_sicredi) estão sendo
feitos na conta SINTÉTICA ao invés das contas ANALÍTICAS por cliente.

PERGUNTA:
1. Qual a regra correta conforme NBC TG 26 e ITG 2000?
2. Como deve funcionar a totalização da conta sintética?
3. Os lançamentos na sintética devem ser reclassificados para as analíticas?
4. Como identificar para qual conta analítica cada lançamento deve ir?
`;

  try {
    const { data, error } = await supabase.functions.invoke('dr-cicero-brain', {
      body: { question: pergunta }
    });

    if (error) {
      console.log('\n❌ Erro ao consultar Dr. Cícero:', error.message);
      console.log('\nUsando conhecimento local...\n');
      return mostrarConhecimentoLocal();
    }

    console.log('\n📋 RESPOSTA DO DR. CÍCERO:\n');
    console.log(data?.answer || data?.response || JSON.stringify(data, null, 2));

  } catch (e) {
    console.log('\n❌ Erro de conexão:', e.message);
    console.log('\nUsando conhecimento local...\n');
    return mostrarConhecimentoLocal();
  }
}

function mostrarConhecimentoLocal() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║  📚 FUNDAMENTAÇÃO CONTÁBIL - NBC TG 26 E ITG 2000                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

1. DEFINIÇÃO DE CONTAS

   CONTA SINTÉTICA (Conta de Grupo/Totalizadora):
   - Agrupa contas de mesma natureza
   - NÃO recebe lançamentos diretos
   - Seu saldo é a SOMA dos saldos das contas analíticas abaixo dela
   - Exemplos: 1.1.2 (Créditos), 1.1.2.01 (Clientes a Receber)

   CONTA ANALÍTICA (Conta de Movimento/Folha):
   - Recebe os lançamentos contábeis diretos
   - Está no último nível da estrutura
   - Exemplos: 1.1.2.01.0001 (Cliente: João), 1.1.2.01.0002 (Cliente: Maria)

2. REGRA FUNDAMENTAL (ITG 2000)

   "Os lançamentos contábeis devem ser efetuados em contas ANALÍTICAS,
   sendo vedado o registro em contas SINTÉTICAS ou de grupo."

3. TOTALIZAÇÃO AUTOMÁTICA

   O saldo da conta sintética deve ser calculado dinamicamente:

   1.1.2.01 (Clientes a Receber) = SOMA de:
     - 1.1.2.01.0001 (Cliente A)
     - 1.1.2.01.0002 (Cliente B)
     - 1.1.2.01.0003 (Cliente C)
     - ...

4. CORREÇÃO NECESSÁRIA

   Os 4.024 lançamentos na conta sintética 1.1.2.01 devem ser:

   a) RECLASSIFICADOS para as contas analíticas correspondentes
      - Identificar o cliente pelo campo 'description' ou 'client_id'
      - Mover para 1.1.2.01.xxxx correspondente

   b) OU, se não houver conta analítica para o cliente:
      - Criar a conta analítica primeiro
      - Depois reclassificar o lançamento

5. IMPLEMENTAÇÃO NO SISTEMA

   O cálculo do saldo da sintética deve ser:

   SELECT
     SUM(debit) as total_debitos,
     SUM(credit) as total_creditos
   FROM accounting_entry_lines
   WHERE account_id IN (
     SELECT id FROM chart_of_accounts
     WHERE code LIKE '1.1.2.01.%'  -- Todas as analíticas filhas
     AND is_analytical = true
   )

   Nunca buscar lançamentos diretamente na sintética!

6. VALIDAÇÃO

   Após correção, verificar que:
   - Conta sintética tem ZERO lançamentos diretos
   - Saldo sintética = Soma dos saldos analíticas
   - Partidas dobradas mantidas (Débito = Crédito)
`);
}

async function analisarLancamentosSintetica() {
  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📊 ANÁLISE DOS LANÇAMENTOS NA CONTA SINTÉTICA');
  console.log('═'.repeat(80));

  // Buscar conta sintética
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  if (!contaSintetica) {
    console.log('❌ Conta 1.1.2.01 não encontrada');
    return;
  }

  // Buscar lançamentos da sintética com informações do entry
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, debit, credit, description, entry_id')
    .eq('account_id', contaSintetica.id)
    .limit(100);

  // Buscar entries para ter client_id e description
  const entryIds = [...new Set(linhas?.map(l => l.entry_id) || [])];
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, description, reference_id, reference_type, source_type')
    .in('id', entryIds);

  const mapEntries = {};
  entries?.forEach(e => mapEntries[e.id] = e);

  // Analisar como identificar o cliente
  console.log('\n📋 AMOSTRA DE LANÇAMENTOS (para identificar padrão do cliente):\n');

  const amostras = linhas?.slice(0, 20) || [];
  for (const linha of amostras) {
    const entry = mapEntries[linha.entry_id];
    console.log(`ID: ${linha.id.substring(0, 8)}`);
    console.log(`   source_type: ${entry?.source_type}`);
    console.log(`   reference_type: ${entry?.reference_type}`);
    console.log(`   reference_id: ${entry?.reference_id?.substring(0, 8) || 'null'}`);
    console.log(`   entry.description: ${entry?.description?.substring(0, 60)}`);
    console.log(`   line.description: ${linha.description?.substring(0, 60) || 'null'}`);
    console.log(`   D: ${linha.debit} C: ${linha.credit}`);
    console.log('');
  }

  // Verificar se reference_id aponta para invoice ou boleto_payment
  console.log('\n📋 ESTRATÉGIA DE IDENTIFICAÇÃO DO CLIENTE:\n');

  // Agrupar por source_type
  const porTipo = {};
  linhas?.forEach(l => {
    const entry = mapEntries[l.entry_id];
    const tipo = entry?.source_type || 'null';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    porTipo[tipo].push({ linha: l, entry });
  });

  for (const [tipo, items] of Object.entries(porTipo)) {
    console.log(`\n${tipo.toUpperCase()}:`);

    if (tipo === 'invoice') {
      console.log('   → reference_id aponta para tabela invoices');
      console.log('   → invoices.client_id identifica o cliente');
      console.log('   → Buscar: SELECT client_id FROM invoices WHERE id = reference_id');
    } else if (tipo === 'boleto_sicredi') {
      console.log('   → reference_id aponta para tabela boleto_payments');
      console.log('   → boleto_payments.client_id identifica o cliente');
      console.log('   → OU: Extrair nome do cliente do description');
    } else if (tipo === 'client_opening_balance') {
      console.log('   → Nome do cliente está no description');
      console.log('   → Extrair: "Saldo Abertura - NOME_CLIENTE"');
    } else if (tipo === 'bank_transaction') {
      console.log('   → reference_id aponta para bank_transactions');
      console.log('   → Verificar se há client_id na transação');
    }
  }

  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('📋 PLANO DE AÇÃO RECOMENDADO');
  console.log('═'.repeat(80));
  console.log(`
1. CRIAR SCRIPT DE RECLASSIFICAÇÃO:
   - Para cada lançamento na conta sintética 1.1.2.01:
     a) Identificar o cliente (via reference_id ou description)
     b) Encontrar ou criar conta analítica 1.1.2.01.xxxx
     c) Atualizar account_id da linha para a conta analítica

2. EXECUTAR EM SIMULAÇÃO PRIMEIRO:
   - Mostrar quantos lançamentos serão movidos
   - Mostrar para quais contas
   - Só executar após aprovação

3. VALIDAR APÓS CORREÇÃO:
   - Conta sintética deve ter ZERO lançamentos
   - Soma das analíticas deve bater com saldo anterior
   - Partidas dobradas mantidas
`);
}

async function main() {
  await consultarDrCicero();
  await analisarLancamentosSintetica();
}

main().catch(console.error);
