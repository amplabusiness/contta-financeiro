/**
 * DR. CÍCERO - CLASSIFICAÇÃO AUTOMÁTICA DE DESPESAS
 *
 * Classifica as saídas pendentes na conta transitória usando
 * as regras de negócio da Ampla Contabilidade.
 *
 * Regras:
 * 1. Família Leão → Adiantamento a Sócios (1.1.3.04.XX)
 * 2. Tarifas bancárias → Despesas Financeiras (4.1.3.02)
 * 3. Energia/Água/Internet → Despesas Administrativas (4.1.1.XX)
 * 4. Impostos/Tributos → Despesas com Tributos (4.1.4.XX)
 * 5. Fornecedores conhecidos → Contas específicas
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// REGRAS DE CLASSIFICAÇÃO
// ============================================

const REGRAS_FAMILIA_LEAO = {
  'SERGIO CARNEIRO LEAO': '1.1.3.04.01',
  'NAYARA CRISTINA PEREIRA LEAO': '1.1.3.04.04',
  'NAYARA': '1.1.3.04.04',
  'VICTOR HUGO LEAO': '1.1.3.04.03',
  'Victor Hugo Leao': '1.1.3.04.03',
  'SERGIO AUGUSTO': '1.1.3.04.05',
  'SERGIO AUGUSTO DE OLIVEIRA LEAO': '1.1.3.04.05',
  'CARLA LEAO': '1.1.3.04.02',
  'AMPLA CONTABILIDADE LTDA': '1.1.3.04.01', // Transferência para conta PJ = adiant. sócio
  'AMPLA CONTABILIDADE': '1.1.3.04.01',
  // Energia do Lago das Brisas = despesa pessoal
  'ENERGISA': '1.1.3.04.99', // Energia Lago das Brisas → Adiantamento Família
  // Condomínios pessoais do Sérgio
  'MUNDI CONSCIENTE': '1.1.3.04.01', // Condomínio Mundi → Adiantamento Sérgio
  'CONDOMINIO': '1.1.3.04.01', // Outros condomínios → Adiantamento Sérgio
};

const REGRAS_DESPESAS = {
  // Despesas Administrativas - usando contas existentes que aceitam lançamentos
  // IMPORTANTE: Energisa = Lago das Brisas (pessoal) → adiantamento
  // Equatorial = Ampla (empresa) → despesa operacional
  'EQUATORIAL GOIAS': '4.1.2.02', // Energia Elétrica da Ampla
  'EQUATORIAL': '4.1.2.02',
  // ENERGISA vai para adiantamento (será tratado nas regras da família)
  'SANEAGO': '4.1.2.07', // Água Mineral (mais próxima)
  'VIVO': '4.1.2.03', // Telefone e Internet
  'CLARO': '4.1.2.03',
  'TIM': '4.1.2.03',
  'TIMCEL': '4.1.2.03',
  'OI ': '4.1.2.03',
  'NET ': '4.1.2.03',
  'ALUGUEL': '4.1.2.01', // Aluguel
  // CONDOMINIO e MUNDI são do Sérgio (pessoal) - tratados nas regras da família

  // Despesas com Pessoal
  'FGTS': '4.1.1.02.02', // FGTS
  'INSS': '4.1.1.02.01', // INSS Patronal
  'VALE TRANSPORTE': '4.1.1.09', // Vale Transporte
  'VT ': '4.1.1.09',
  'VR BENEF': '4.1.1.10', // Vale Refeição/Alimentação

  // Despesas Financeiras
  'TARIFA': '4.1.3.02', // Tarifas Bancárias
  'TAR ': '4.1.3.02',
  'IOF': '4.1.3.02',
  'JUROS': '4.1.3.01', // Juros e Multas
  'PJBANK': '4.1.3.02', // Taxas de Pagamento

  // Tributos
  'SIMPLES NACIONAL': '4.1.4.01', // Simples Nacional
  'DAS': '4.1.4.01',
  'ISS': '4.1.4.02',
  'IPTU': '4.1.4.03', // IPTU Sede
  'IPVA': '4.1.4.05', // IPVA e DETRAN
  'DETRAN': '4.1.4.05',
  'DEPARTAMENTO ESTADUAL DE TRANSITO': '4.1.4.05',
  'PMGO': '4.1.4.04', // Taxas e Licenças
  'ALGARTE': '4.1.4.04', // Taxas

  // Despesas Diversas
  'CARTORIO': '4.1.9.01', // Cartório e Registros
  'CORREIOS': '4.1.9.02', // Correios e Malotes
  'COMBUSTIVEL': '4.1.9.03', // Combustíveis
  'POSTO': '4.1.9.03',
  'MATERIAL': '4.1.2.14', // Material de Papelaria
  'PAPELARIA': '4.1.2.14',

  // Software e Sistemas
  'THOMSON REUTERS': '4.1.2.12', // Software e Sistemas
  'DOMINIO': '4.1.2.12',
  'SITTAX': '4.1.2.12',
  'DATAUNIQUE': '4.1.2.12',
  'CONTUS': '4.1.2.12',
  'NB TECHNOLOGY': '4.1.2.12',
  'CR SISTEMA': '4.1.2.12',
  'VERI SOLUCOES': '4.1.2.12',
  'AUTMAIS': '4.1.2.12',

  // Associações e Conselhos
  'CRC': '4.1.4.04', // Taxas e Licenças (CRC, etc)
  'CONS REG CONTABILIDADE': '4.1.4.04',
  'CONS REG CONTABIL': '4.1.4.04',
  'CAIXA DE ASSISTENCIA DOS ADVOGADOS': '4.1.4.04',
  'OAB': '4.1.4.04',

  // Terceirizados
  'SCALA CONTABI': '4.1.2.13.99', // Outros Terceirizados
  'OUTSIDER': '4.1.2.13.99',
  'FACULDADE': '4.1.9.05', // Cursos e Treinamentos
  'CATHO': '4.1.2.99', // Outras Despesas Administrativas

  // Veículos
  'REDEMOB': '4.1.5.02', // Manutenção Veículos
};

// Colaboradores conhecidos → 4.1.1.01 (Salários e Ordenados - conta analítica)
const COLABORADORES = [
  'DANIEL RODRIGUES RIBEIRO',
  'JOSIMAR DOS SANTOS MOTA',
  'ROSEMEIRE RODRIGUES',
  'ANDREA LEONE BASTOS',
  'ALEXSSANDRA FERREIRA RAMOS',
  'FABRICIO SOARES BOMFIM',
  'CORACI ALINE DOS SANTOS',
  'ANDREA FERREIRA FAGUNDES',
  'THAYNARA',
  'TAYLANE BELLE',
  'LILIAN MOREIRA',
  'FABIANA MARIA',
  'DEUZA RESENDE'
];
const CONTA_SALARIOS = '4.1.1.01'; // Salários e Ordenados (analítica, aceita lançamentos)

const CONTA_TRANSITORIA = '1.1.9.01';
const CONTA_BANCO_SICREDI = '1.1.1.05';
const MODO = process.argv[2] || 'simulacao';

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function classificarTransacao(descricao) {
  const descUpper = descricao.toUpperCase();

  // 1. Verificar se é da Família Leão
  for (const [nome, conta] of Object.entries(REGRAS_FAMILIA_LEAO)) {
    if (descUpper.includes(nome.toUpperCase())) {
      return { tipo: 'ADIANTAMENTO_SOCIO', conta, descricao: `Adiantamento - ${nome}` };
    }
  }

  // 2. Verificar se é colaborador (despesa com pessoal → 4.1.1.01)
  for (const colab of COLABORADORES) {
    if (descUpper.includes(colab.toUpperCase())) {
      return { tipo: 'DESPESA_PESSOAL', conta: CONTA_SALARIOS, descricao: `Salário - ${colab}` };
    }
  }

  // 3. Verificar regras de despesas
  for (const [pattern, conta] of Object.entries(REGRAS_DESPESAS)) {
    if (descUpper.includes(pattern.toUpperCase())) {
      return { tipo: 'DESPESA', conta, descricao: `Despesa - ${pattern.trim()}` };
    }
  }

  // 4. Não classificado
  return { tipo: 'NAO_CLASSIFICADO', conta: null, descricao: 'Pendente classificação manual' };
}

async function buscarOuCriarConta(code, nome, parentCode) {
  // Verificar se conta existe
  const { data: contaExistente } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .maybeSingle();

  if (contaExistente) {
    return contaExistente;
  }

  // Buscar conta pai
  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', parentCode)
    .maybeSingle();

  // Criar conta
  const { data: novaConta, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code,
      name: nome,
      parent_id: contaPai?.id,
      account_type: code.startsWith('4') ? 'EXPENSE' : 'ASSET',
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.log(`   Erro criando conta ${code}: ${error.message}`);
    return null;
  }

  console.log(`   Conta criada: ${code} - ${nome}`);
  return novaConta;
}

async function main() {
  console.log('═'.repeat(100));
  console.log('🤖 DR. CÍCERO - CLASSIFICAÇÃO AUTOMÁTICA DE DESPESAS');
  console.log(`   Modo: ${MODO.toUpperCase()}`);
  console.log('═'.repeat(100));

  // 1. Buscar conta transitória
  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', CONTA_TRANSITORIA)
    .single();

  if (!contaTransitoria) {
    console.log('❌ Conta transitória não encontrada');
    return;
  }

  // 2. Buscar items com débito na conta transitória
  const { data: itemsTransitoria } = await supabase
    .from('accounting_entry_items')
    .select('id, debit, entry_id, account_id')
    .eq('account_id', contaTransitoria.id)
    .gt('debit', 0);

  console.log(`\n📊 Items com débito na transitória: ${itemsTransitoria?.length || 0}`);

  if (!itemsTransitoria || itemsTransitoria.length === 0) {
    console.log('✅ Nenhuma saída pendente de classificação!');
    return;
  }

  // Buscar os entries correspondentes
  const entryIds = [...new Set(itemsTransitoria.map(i => i.entry_id))];
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, entry_type, description')
    .in('id', entryIds)
    .in('entry_type', ['SAIDA_PENDENTE_CLASSIFICACAO', 'PENDENTE_CLASSIFICACAO'])
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  // Criar mapa entry_id -> item
  const itemPorEntry = {};
  for (const item of itemsTransitoria) {
    itemPorEntry[item.entry_id] = item;
  }

  console.log(`\n📊 Entries SAIDA_PENDENTE_CLASSIFICACAO: ${entries?.length || 0}`);

  // Estatísticas
  const stats = {
    total: 0,
    classificados: 0,
    adiantamentos: 0,
    despesas: 0,
    naoClassificados: 0,
    valorClassificado: 0,
    valorNaoClassificado: 0
  };

  const naoClassificados = [];

  for (const entry of entries || []) {
    stats.total++;

    // Pegar a linha que está na conta transitória (débito)
    const linhaTransitoria = itemPorEntry[entry.id];

    if (!linhaTransitoria) continue;

    const valor = Number(linhaTransitoria.debit);
    const descricao = entry.description || '';

    // Classificar
    const classificacao = classificarTransacao(descricao);

    if (classificacao.tipo === 'NAO_CLASSIFICADO') {
      stats.naoClassificados++;
      stats.valorNaoClassificado += valor;
      naoClassificados.push({ entry_id: entry.id, descricao, valor });
      continue;
    }

    stats.classificados++;
    stats.valorClassificado += valor;

    if (classificacao.tipo === 'ADIANTAMENTO_SOCIO') {
      stats.adiantamentos++;
    } else {
      stats.despesas++;
    }

    console.log(`\n[${entry.entry_date}] R$ ${valor.toFixed(2)}`);
    console.log(`   ${descricao.substring(0, 60)}`);
    console.log(`   → ${classificacao.tipo}: ${classificacao.conta}`);

    if (MODO === 'aplicar') {
      // Buscar ou criar conta destino
      const parentCode = classificacao.conta.split('.').slice(0, -1).join('.');
      const contaDestino = await buscarOuCriarConta(
        classificacao.conta,
        classificacao.descricao,
        parentCode
      );

      if (!contaDestino) {
        console.log(`   ⚠️  Não foi possível obter conta ${classificacao.conta}`);
        continue;
      }

      // Atualizar a linha: trocar conta transitória pela conta correta
      const { error } = await supabase
        .from('accounting_entry_items')
        .update({ account_id: contaDestino.id })
        .eq('id', linhaTransitoria.id);

      if (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      } else {
        console.log(`   ✅ Reclassificado`);
      }

      // Atualizar entry_type
      await supabase
        .from('accounting_entries')
        .update({
          entry_type: classificacao.tipo === 'ADIANTAMENTO_SOCIO'
            ? 'ADIANTAMENTO_SOCIO'
            : 'DESPESA_CLASSIFICADA'
        })
        .eq('id', entry.id);
    }
  }

  // Resumo
  console.log('\n' + '═'.repeat(100));
  console.log('📊 RESUMO DA CLASSIFICAÇÃO');
  console.log('═'.repeat(100));
  console.log(`Total de entries: ${stats.total}`);
  console.log(`Classificados: ${stats.classificados} (R$ ${stats.valorClassificado.toFixed(2)})`);
  console.log(`  - Adiantamentos a Sócios: ${stats.adiantamentos}`);
  console.log(`  - Despesas Operacionais: ${stats.despesas}`);
  console.log(`Não classificados: ${stats.naoClassificados} (R$ ${stats.valorNaoClassificado.toFixed(2)})`);

  if (naoClassificados.length > 0) {
    console.log('\n📋 PENDENTES DE CLASSIFICAÇÃO MANUAL:');
    for (const item of naoClassificados.slice(0, 20)) {
      console.log(`   R$ ${item.valor.toFixed(2).padStart(10)} | ${item.descricao.substring(0, 60)}`);
    }
    if (naoClassificados.length > 20) {
      console.log(`   ... e mais ${naoClassificados.length - 20} items`);
    }
  }

  if (MODO === 'simulacao') {
    console.log('\n💡 Para aplicar as alterações, execute:');
    console.log('   node scripts/dr_cicero_classificar_despesas.mjs aplicar');
  }

  console.log('\n' + '═'.repeat(100));
}

main().catch(console.error);
