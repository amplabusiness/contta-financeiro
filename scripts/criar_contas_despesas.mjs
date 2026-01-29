/**
 * CRIAR CONTAS ANALÍTICAS DE DESPESAS
 * Conforme TREINAMENTO_DESPESAS_ANALITICAS.md
 *
 * Este script:
 * 1. Cria a estrutura de contas sintéticas necessárias
 * 2. Cria contas analíticas específicas por tipo de despesa
 * 3. Reclassifica lançamentos da conta genérica 4.1.2.99
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

// Estrutura de contas a criar
const ESTRUTURA_DESPESAS = [
  // Contas sintéticas (pais)
  { code: '4.1.2.18', name: 'Segurança e Vigilância', is_synthetic: true, parent: '4.1.2' },
  { code: '4.1.2.19', name: 'Manutenção Predial', is_synthetic: true, parent: '4.1.2' },
  { code: '4.1.2.20', name: 'Serviços Profissionais', is_synthetic: true, parent: '4.1.2' },

  // Contas analíticas - Segurança
  { code: '4.1.2.18.01', name: 'Segurança - Monitoramento', is_synthetic: false, parent: '4.1.2.18' },
  { code: '4.1.2.18.02', name: 'Segurança - Vigilância', is_synthetic: false, parent: '4.1.2.18' },
  { code: '4.1.2.18.03', name: 'Segurança - Alarme e CFTV', is_synthetic: false, parent: '4.1.2.18' },

  // Contas analíticas - Manutenção Predial
  { code: '4.1.2.19.01', name: 'Manutenção - Elevador', is_synthetic: false, parent: '4.1.2.19' },
  { code: '4.1.2.19.02', name: 'Manutenção - Ar Condicionado', is_synthetic: false, parent: '4.1.2.19' },
  { code: '4.1.2.19.03', name: 'Manutenção - Elétrica', is_synthetic: false, parent: '4.1.2.19' },
  { code: '4.1.2.19.04', name: 'Manutenção - Hidráulica', is_synthetic: false, parent: '4.1.2.19' },
  { code: '4.1.2.19.05', name: 'Manutenção - Pintura e Reparos', is_synthetic: false, parent: '4.1.2.19' },

  // Contas analíticas - Serviços Profissionais
  { code: '4.1.2.20.01', name: 'Serviços Jurídicos', is_synthetic: false, parent: '4.1.2.20' },
  { code: '4.1.2.20.02', name: 'Consultoria Empresarial', is_synthetic: false, parent: '4.1.2.20' },
  { code: '4.1.2.20.03', name: 'Marketing e Publicidade', is_synthetic: false, parent: '4.1.2.20' },
  { code: '4.1.2.20.04', name: 'Outros Serviços Profissionais', is_synthetic: false, parent: '4.1.2.20' },
];

// Padrões para reclassificação
const PADROES_DESPESA = [
  // DESPESAS PESSOAIS → ADIANTAMENTO (PRIORIDADE MÁXIMA)
  { pattern: /APT\s*SERGIO|APARTAMENTO\s*SERGIO|CASA\s*SERGIO|CONDOMINIO\s*APT|INTERNET\s*APT/i, target: '1.1.3.04.01', name: 'Adiantamento Sérgio Carneiro', is_personal: true },
  { pattern: /GAS\s*APT|GÁS\s*APT|GAS\s*APTO|GÁS\s*APTO/i, target: '1.1.3.04.01', name: 'Adiantamento Sérgio Carneiro', is_personal: true },
  { pattern: /LAGO|SITIO|SÍTIO/i, target: '1.1.3.04.01', name: 'Adiantamento Sítio', is_personal: true },
  { pattern: /FACULDADE|MEDICINA|SERGIO\s*AUGUSTO/i, target: '1.1.3.04.01', name: 'Adiantamento Sérgio Augusto', is_personal: true },

  // DESPESAS DA EMPRESA
  { pattern: /SEGURANÇA|VIGILANCIA|VIGILÂNCIA|MONITORAMENTO|COP\b/i, target: '4.1.2.18.01', name: 'Segurança - Monitoramento' },
  { pattern: /ELEVADOR|ADVANCE/i, target: '4.1.2.19.01', name: 'Manutenção - Elevador' },
  { pattern: /AR\s*CONDICIONADO|SPLIT|HVAC/i, target: '4.1.2.19.02', name: 'Manutenção - Ar Condicionado' },
  { pattern: /ELETRIC|ELÉTRIC/i, target: '4.1.2.19.03', name: 'Manutenção - Elétrica' },
  { pattern: /HIDRAULIC|HIDRÁULIC|ENCANAMENTO/i, target: '4.1.2.19.04', name: 'Manutenção - Hidráulica' },
  { pattern: /PINTURA|REFORMA/i, target: '4.1.2.19.05', name: 'Manutenção - Pintura e Reparos' },
  { pattern: /PLANO\s*SAUDE|PLANO\s*SAÚDE|CASAG|UNIMED/i, target: '4.1.1.11', name: 'Plano de Saúde' },
  { pattern: /ADVOGAD|JURIDIC|JURÍDIC/i, target: '4.1.2.20.01', name: 'Serviços Jurídicos' },
  { pattern: /CONSULTORIA/i, target: '4.1.2.20.02', name: 'Consultoria Empresarial' },
  { pattern: /MARKETING|PUBLICIDADE/i, target: '4.1.2.20.03', name: 'Marketing e Publicidade' },
  { pattern: /TECNOLOGIA|ACESSORIAS|TI\b/i, target: '4.1.2.12', name: 'Software e Sistemas' },
];

async function criarContasDespesas() {
  console.log('='.repeat(80));
  console.log(`🤖 DR. CÍCERO - CRIAR CONTAS ANALÍTICAS DE DESPESAS | MODO: ${MODO}`);
  console.log('='.repeat(80));

  // 1. CRIAR ESTRUTURA DE CONTAS
  console.log('\n' + '-'.repeat(80));
  console.log('📊 FASE 1: Criar estrutura de contas');
  console.log('-'.repeat(80));

  const contasCriadas = [];
  const contasExistentes = [];

  for (const conta of ESTRUTURA_DESPESAS) {
    // Verificar se já existe
    const { data: existe } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', conta.code)
      .single();

    if (existe) {
      contasExistentes.push(conta.code);
      continue;
    }

    // Buscar parent_id
    const { data: parent } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', conta.parent)
      .single();

    if (!parent) {
      console.log(`   ⚠️ Conta pai ${conta.parent} não encontrada para ${conta.code}`);
      continue;
    }

    if (MODO === 'EXECUCAO') {
      const { data: nova, error } = await supabase
        .from('chart_of_accounts')
        .insert({
          code: conta.code,
          name: conta.name,
          account_type: 'DESPESA',
          nature: 'DEVEDORA',
          parent_id: parent.id,
          level: conta.code.split('.').length,
          is_analytical: !conta.is_synthetic,
          is_synthetic: conta.is_synthetic,
          is_active: true,
          accepts_entries: !conta.is_synthetic
        })
        .select('id, code')
        .single();

      if (error) {
        console.log(`   ❌ Erro ao criar ${conta.code}: ${error.message}`);
      } else {
        contasCriadas.push(conta.code);
        console.log(`   ✅ Criada: ${conta.code} - ${conta.name}`);
      }
    } else {
      contasCriadas.push(conta.code);
      console.log(`   [SIM] Criar: ${conta.code} - ${conta.name}`);
    }
  }

  console.log(`\n   Resumo: ${contasCriadas.length} a criar, ${contasExistentes.length} já existem`);

  // 2. ANALISAR LANÇAMENTOS NA CONTA GENÉRICA
  console.log('\n' + '-'.repeat(80));
  console.log('📊 FASE 2: Analisar lançamentos na conta genérica 4.1.2.99');
  console.log('-'.repeat(80));

  const { data: contaGenerica } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4.1.2.99')
    .single();

  if (!contaGenerica) {
    console.log('   ⚠️ Conta 4.1.2.99 não encontrada');
    return;
  }

  const { data: linhasGenerica } = await supabase
    .from('accounting_entry_lines')
    .select('id, description, debit, credit, entry_id')
    .eq('account_id', contaGenerica.id);

  console.log(`   Total de lançamentos: ${linhasGenerica?.length || 0}`);

  // 3. CLASSIFICAR E RECLASSIFICAR
  console.log('\n' + '-'.repeat(80));
  console.log('📊 FASE 3: Classificar e reclassificar lançamentos');
  console.log('-'.repeat(80));

  const reclassificacoes = [];
  const naoIdentificados = [];

  for (const linha of linhasGenerica || []) {
    const desc = linha.description || '';
    let matched = false;

    for (const padrao of PADROES_DESPESA) {
      if (padrao.pattern.test(desc)) {
        reclassificacoes.push({
          linha_id: linha.id,
          descricao: desc,
          valor: linha.debit || linha.credit,
          conta_destino: padrao.target,
          nome_conta: padrao.name,
          is_personal: padrao.is_personal || false
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      naoIdentificados.push({
        linha_id: linha.id,
        descricao: desc,
        valor: linha.debit || linha.credit
      });
    }
  }

  // Agrupar por conta destino
  const porConta = {};
  for (const r of reclassificacoes) {
    if (!porConta[r.conta_destino]) {
      porConta[r.conta_destino] = { nome: r.nome_conta, linhas: [], total: 0, is_personal: r.is_personal };
    }
    porConta[r.conta_destino].linhas.push(r);
    porConta[r.conta_destino].total += r.valor;
  }

  console.log('\n   Reclassificações identificadas:');
  for (const [codigo, dados] of Object.entries(porConta)) {
    const tipo = dados.is_personal ? '🏠 PESSOAL' : '🏢 EMPRESA';
    console.log(`   ${tipo} ${codigo} - ${dados.nome}`);
    console.log(`         ${dados.linhas.length} lançamentos | R$ ${dados.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }

  if (naoIdentificados.length > 0) {
    console.log(`\n   ⚠️ Não identificados: ${naoIdentificados.length}`);
    naoIdentificados.slice(0, 5).forEach(n => {
      console.log(`      - ${n.descricao?.substring(0, 50)} | R$ ${n.valor}`);
    });
  }

  // 4. EXECUTAR RECLASSIFICAÇÃO
  if (MODO === 'EXECUCAO' && reclassificacoes.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log('📊 FASE 4: Executando reclassificação');
    console.log('-'.repeat(80));

    let sucesso = 0;
    let erros = 0;

    for (const [codigo, dados] of Object.entries(porConta)) {
      // Buscar conta destino
      const { data: contaDestino } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', codigo)
        .single();

      if (!contaDestino) {
        console.log(`   ❌ Conta ${codigo} não encontrada`);
        erros += dados.linhas.length;
        continue;
      }

      // Atualizar linhas
      for (const linha of dados.linhas) {
        const { error } = await supabase
          .from('accounting_entry_lines')
          .update({ account_id: contaDestino.id })
          .eq('id', linha.linha_id);

        if (error) {
          erros++;
        } else {
          sucesso++;
        }
      }
    }

    console.log(`   ✅ Reclassificados: ${sucesso}`);
    console.log(`   ❌ Erros: ${erros}`);
  }

  // 5. RESUMO FINAL
  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMO');
  console.log('='.repeat(80));

  console.log(`\n   Contas a criar: ${contasCriadas.length}`);
  console.log(`   Lançamentos a reclassificar: ${reclassificacoes.length}`);
  console.log(`   - Para ADIANTAMENTO (pessoal): ${reclassificacoes.filter(r => r.is_personal).length}`);
  console.log(`   - Para DESPESAS (empresa): ${reclassificacoes.filter(r => !r.is_personal).length}`);
  console.log(`   Não identificados: ${naoIdentificados.length}`);

  if (MODO === 'SIMULACAO') {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  MODO SIMULAÇÃO - NENHUMA ALTERAÇÃO FEITA');
    console.log('='.repeat(80));
    console.log('\n🚀 Para executar: node scripts/criar_contas_despesas.mjs --executar');
  }

  console.log('\n' + '='.repeat(80));
  console.log('🤖 Dr. Cícero: "Cada despesa no seu lugar, razão contábil sempre claro!"');
  console.log('='.repeat(80));
}

criarContasDespesas();
