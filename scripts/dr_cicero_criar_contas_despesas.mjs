/**
 * DR. CÍCERO - CRIAR CONTAS ANALÍTICAS PARA DESPESAS
 *
 * Conforme NBC TG 26 e ITG 2000:
 * "Os lançamentos contábeis devem ser efetuados em contas ANALÍTICAS,
 * sendo vedado o registro em contas SINTÉTICAS ou de grupo."
 *
 * Este script cria a estrutura completa de contas analíticas para despesas.
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
// ESTRUTURA DE CONTAS DE DESPESA (GRUPO 4)
// ============================================

const ESTRUTURA_DESPESAS = {
  // 4.1.1 - Despesas Administrativas
  '4.1.1': {
    nome: 'Despesas Administrativas',
    filhas: {
      '4.1.1.01': { nome: 'Energia Elétrica', fornecedores: ['EQUATORIAL', 'ENERGISA', 'CELG', 'ENEL'] },
      '4.1.1.02': { nome: 'Água e Esgoto', fornecedores: ['SANEAGO', 'SABESP', 'AGUA PURA'] },
      '4.1.1.03': { nome: 'Telefone e Internet', fornecedores: ['VIVO', 'CLARO', 'TIM', 'OI', 'NET', 'TIMCEL'] },
      '4.1.1.04': { nome: 'Aluguel de Imóveis', fornecedores: ['ALUGUEL'] },
      '4.1.1.05': { nome: 'Condomínio', fornecedores: ['CONDOMINIO', 'MUNDI CONSCIENTE'] },
      '4.1.1.06': { nome: 'Sistemas e Software', fornecedores: ['THOMSON REUTERS', 'DOMINIO', 'FORTES', 'SITTAX', 'DATAUNIQUE', 'CONTUS', 'NB TECHNOLOGY', 'CR SISTEMA', 'VERI SOLUCOES', 'AUTMAIS'] },
      '4.1.1.07': { nome: 'Conselhos de Classe', fornecedores: ['CRC', 'CONS REG CONTABILIDADE', 'CONS REG CONTABIL'] },
      '4.1.1.08': { nome: 'Associações e Sindicatos', fornecedores: ['CAIXA DE ASSISTENCIA DOS ADVOGADOS', 'OAB', 'SINDICONT'] },
      '4.1.1.09': { nome: 'Material de Escritório', fornecedores: ['PAPELARIA', 'MATERIAL', 'OBJETIVA EDICOES'] },
      '4.1.1.10': { nome: 'Serviços de Terceiros PJ', fornecedores: ['SCALA CONTABI', 'OUTSIDER'] },
      '4.1.1.11': { nome: 'Recrutamento e Seleção', fornecedores: ['CATHO'] },
      '4.1.1.12': { nome: 'Manutenção e Conservação', fornecedores: ['LIMPEZA', 'CONSERVACAO', 'ELEVADOR', 'ADV SYSTEM'] },
      '4.1.1.13': { nome: 'Seguros', fornecedores: ['SEGURO', 'BRADESCO SEGUROS'] },
      '4.1.1.99': { nome: 'Outras Despesas Administrativas', fornecedores: [] }
    }
  },

  // 4.1.2 - Despesas com Pessoal
  '4.1.2': {
    nome: 'Despesas com Pessoal',
    filhas: {
      '4.1.2.01': { nome: 'Salários e Ordenados', fornecedores: ['SALARIO', 'FOLHA'] },
      '4.1.2.02': { nome: 'FGTS', fornecedores: ['FGTS'] },
      '4.1.2.03': { nome: 'INSS Patronal', fornecedores: ['INSS', 'GPS'] },
      '4.1.2.04': { nome: 'Vale Transporte', fornecedores: ['VT', 'VALE TRANSPORTE'] },
      '4.1.2.05': { nome: 'Vale Refeição/Alimentação', fornecedores: ['VR BENEF', 'SODEXO', 'ALELO', 'TICKET'] },
      '4.1.2.06': { nome: 'Plano de Saúde', fornecedores: ['UNIMED', 'AMIL', 'BRADESCO SAUDE'] },
      '4.1.2.07': { nome: 'Férias e 13º Salário', fornecedores: ['FERIAS', '13'] },
      '4.1.2.08': { nome: 'Rescisões', fornecedores: ['RESCISAO', 'HOMOLOGACAO'] },
      '4.1.2.09': { nome: 'Pró-Labore', fornecedores: ['PRO-LABORE', 'PROLABORE'] },
      '4.1.2.99': { nome: 'Outras Despesas com Pessoal', fornecedores: [] }
    }
  },

  // 4.1.3 - Despesas Financeiras
  '4.1.3': {
    nome: 'Despesas Financeiras',
    filhas: {
      '4.1.3.01': { nome: 'Juros Pagos', fornecedores: ['JUROS'] },
      '4.1.3.02': { nome: 'Tarifas Bancárias', fornecedores: ['TARIFA', 'TAR '] },
      '4.1.3.03': { nome: 'IOF', fornecedores: ['IOF'] },
      '4.1.3.04': { nome: 'Descontos Concedidos', fornecedores: ['DESCONTO'] },
      '4.1.3.05': { nome: 'Taxas de Cartão', fornecedores: ['CIELO', 'REDE', 'STONE', 'PJBANK'] },
      '4.1.3.99': { nome: 'Outras Despesas Financeiras', fornecedores: [] }
    }
  },

  // 4.1.4 - Tributos e Contribuições
  '4.1.4': {
    nome: 'Tributos e Contribuições',
    filhas: {
      '4.1.4.01': { nome: 'Simples Nacional / DAS', fornecedores: ['SIMPLES NACIONAL', 'DAS'] },
      '4.1.4.02': { nome: 'ISS', fornecedores: ['ISS', 'ISSQN'] },
      '4.1.4.03': { nome: 'IPTU', fornecedores: ['IPTU'] },
      '4.1.4.04': { nome: 'IPVA', fornecedores: ['IPVA'] },
      '4.1.4.05': { nome: 'Taxas e Licenças', fornecedores: ['DETRAN', 'DEPARTAMENTO ESTADUAL DE TRANSITO', 'PMGO', 'ALGARTE'] },
      '4.1.4.06': { nome: 'IRRF sobre Serviços', fornecedores: ['IRRF'] },
      '4.1.4.99': { nome: 'Outros Tributos', fornecedores: [] }
    }
  },

  // 4.1.9 - Outras Despesas Operacionais
  '4.1.9': {
    nome: 'Outras Despesas Operacionais',
    filhas: {
      '4.1.9.01': { nome: 'Cartório e Registros', fornecedores: ['CARTORIO'] },
      '4.1.9.02': { nome: 'Correios e Malotes', fornecedores: ['CORREIOS'] },
      '4.1.9.03': { nome: 'Combustíveis', fornecedores: ['COMBUSTIVEL', 'POSTO', 'SHELL', 'IPIRANGA'] },
      '4.1.9.04': { nome: 'Publicidade e Marketing', fornecedores: ['PUBLICIDADE', 'MARKETING'] },
      '4.1.9.05': { nome: 'Cursos e Treinamentos', fornecedores: ['FACULDADE', 'CURSO', 'TREINAMENTO'] },
      '4.1.9.06': { nome: 'Despesas com Veículos', fornecedores: ['REDEMOB', 'CONSORCIO'] },
      '4.1.9.07': { nome: 'Copa e Cozinha', fornecedores: ['CAFE', 'AGUA MINERAL'] },
      '4.1.9.08': { nome: 'Despesas Diversas', fornecedores: [] },
      '4.1.9.99': { nome: 'Outras Despesas Operacionais', fornecedores: [] }
    }
  }
};

// Contas analíticas para colaboradores
const COLABORADORES_CONTAS = {
  'DANIEL RODRIGUES RIBEIRO': '4.1.2.01.01',
  'JOSIMAR DOS SANTOS MOTA': '4.1.2.01.02',
  'ROSEMEIRE RODRIGUES': '4.1.2.01.03',
  'ANDREA LEONE BASTOS': '4.1.2.01.04',
  'ALEXSSANDRA FERREIRA RAMOS': '4.1.2.01.05',
  'FABRICIO SOARES BOMFIM': '4.1.2.01.06',
  'CORACI ALINE DOS SANTOS': '4.1.2.01.07',
  'ANDREA FERREIRA FAGUNDES': '4.1.2.01.08',
  'THAYNARA': '4.1.2.01.09',
  'TAYLANE BELLE': '4.1.2.01.10',
  'LILIAN MOREIRA': '4.1.2.01.11',
  'FABIANA MARIA': '4.1.2.01.12',
  'DEUZA RESENDE': '4.1.2.01.13'
};

async function criarContaSePreciso(code, nome, parentCode) {
  // Verificar se já existe
  const { data: existente } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .maybeSingle();

  if (existente) {
    return { conta: existente, criada: false };
  }

  // Buscar conta pai
  let parentId = null;
  if (parentCode) {
    const { data: pai } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', parentCode)
      .maybeSingle();
    parentId = pai?.id;
  }

  // Calcular level baseado no código (número de pontos + 1)
  const level = code.split('.').length;

  // Determinar account_type baseado no primeiro dígito
  let accountType = 'EXPENSE';
  if (code.startsWith('1')) accountType = 'ASSET';
  else if (code.startsWith('2')) accountType = 'LIABILITY';
  else if (code.startsWith('3')) accountType = 'REVENUE';
  else if (code.startsWith('4')) accountType = 'EXPENSE';
  else if (code.startsWith('5')) accountType = 'EQUITY';

  // Criar
  const { data: novaConta, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code,
      name: nome,
      parent_id: parentId,
      account_type: accountType,
      nature: code.startsWith('1') || code.startsWith('4') ? 'DEVEDORA' : 'CREDORA',
      level,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.log(`   Erro criando ${code}: ${error.message}`);
    return { conta: null, criada: false };
  }

  return { conta: novaConta, criada: true };
}

async function main() {
  console.log('═'.repeat(100));
  console.log('🤖 DR. CÍCERO - CRIAÇÃO DE CONTAS ANALÍTICAS DE DESPESAS');
  console.log('   NBC TG 26: Lançamentos devem ser em contas ANALÍTICAS');
  console.log('═'.repeat(100));

  let contasCriadas = 0;
  let contasExistentes = 0;

  // 1. Criar estrutura de contas sintéticas e analíticas
  for (const [codigoGrupo, grupo] of Object.entries(ESTRUTURA_DESPESAS)) {
    console.log(`\n📁 ${codigoGrupo} - ${grupo.nome}`);

    // Criar conta sintética do grupo (se não existir)
    const { criada: grupoCriado } = await criarContaSePreciso(codigoGrupo, grupo.nome, '4.1');
    if (grupoCriado) {
      contasCriadas++;
      console.log(`   ✅ Criada conta sintética: ${codigoGrupo}`);
    }

    // Criar contas analíticas filhas
    for (const [codigoFilha, dadosFilha] of Object.entries(grupo.filhas)) {
      const { conta, criada } = await criarContaSePreciso(codigoFilha, dadosFilha.nome, codigoGrupo);

      if (criada) {
        contasCriadas++;
        console.log(`   ✅ ${codigoFilha} - ${dadosFilha.nome}`);
      } else if (conta) {
        contasExistentes++;
      }
    }
  }

  // 2. Criar contas analíticas para colaboradores (4.1.2.01.XX)
  console.log('\n📁 Contas para Colaboradores (Salários)');
  for (const [nome, codigo] of Object.entries(COLABORADORES_CONTAS)) {
    const { conta, criada } = await criarContaSePreciso(codigo, `Salário - ${nome}`, '4.1.2.01');

    if (criada) {
      contasCriadas++;
      console.log(`   ✅ ${codigo} - Salário - ${nome}`);
    } else if (conta) {
      contasExistentes++;
    }
  }

  // 3. Criar contas analíticas para adiantamentos (1.1.3.04.XX)
  console.log('\n📁 Contas para Adiantamentos a Sócios (1.1.3.04.XX)');

  const ADIANTAMENTOS = {
    '1.1.3.04.01': 'Adiantamento - Sérgio Carneiro Leão',
    '1.1.3.04.02': 'Adiantamento - Carla Leão',
    '1.1.3.04.03': 'Adiantamento - Victor Hugo Leão',
    '1.1.3.04.04': 'Adiantamento - Nayara Cristina Pereira Leão',
    '1.1.3.04.05': 'Adiantamento - Sérgio Augusto de Oliveira Leão',
    '1.1.3.04.99': 'Adiantamento - Família (Sítio)'
  };

  // Criar conta pai 1.1.3.04 se não existir
  await criarContaSePreciso('1.1.3.04', 'Adiantamentos a Sócios e Família', '1.1.3');

  for (const [codigo, nome] of Object.entries(ADIANTAMENTOS)) {
    const { conta, criada } = await criarContaSePreciso(codigo, nome, '1.1.3.04');

    if (criada) {
      contasCriadas++;
      console.log(`   ✅ ${codigo} - ${nome}`);
    } else if (conta) {
      contasExistentes++;
    }
  }

  // Resumo
  console.log('\n' + '═'.repeat(100));
  console.log('📊 RESUMO');
  console.log('═'.repeat(100));
  console.log(`Contas criadas: ${contasCriadas}`);
  console.log(`Contas já existentes: ${contasExistentes}`);
  console.log('═'.repeat(100));
}

main().catch(console.error);
