// scripts/03_reclassificar_sintetica_para_analiticas.mjs
// Move lançamentos da conta sintética 1.1.2.01 para contas analíticas por cliente

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Conta sintética (NÃO deveria ter lançamentos)
const CONTA_SINTETICA_CODE = '1.1.2.01';

// Mapeamento de nomes de clientes (CSV -> Banco) - para casos de encoding diferente
const MAPEAMENTO_CLIENTES = {
  'ALLIANCE EMPREENDIMENTOS LTDA': 'ALLIANCE EMPREENDIMETOS',
  'ELETROSOL SOLUCOES EM ENERGIA LTDA': 'ELETROSOL SOLUÇÕES EM ENCERGIA LTDA',
  'JR SOLUCOES INDUSTRIAIS LTDA': 'JR SOLUÇÕES INDUSTRIAIS LTDA',
  'L F GONCALVES CONFECCOES LTDA': 'L.F. GONCALVES CONFECCOES LTDA',
  'ACTION SOLUCOES INDUSTRIAIS LTDA': 'ACTION SOLUÇÕES INDUSTRIAIS LTDA',
  'UNICAIXAS DESPACHANTE LTDA': 'UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA',
  'KORSICA COMERCIO ATACADISTA DE PNEUS LTD': 'KORSICA COM ATAC DE PNEUS LTDA',
  'AMETISTA GESTAO EMPRESARIAL LTDA': 'AMETISTA GESTÃO EMPRESARIAL LTDA',
  'C.R.J MANUTENCAO EM AR CONDICIONADO LTDA': 'C.R.J MANUTENÇÃO EM AR CONDICIONADO LTDA',
  'CHRISTIANE RODRIGUES MACHADO LOPES LTDA': 'CHRISTIANE RODRIGEUS MACHADO',
  'ANAPOLIS SERVICOS DE VISTORIAS LTDA': 'ANAPOLIS VISTORIA LTDA',
  'CENTRO OESTE SERVICOS DE VISTORIAS LTDA': 'CENTRO OESTE SERVIÇO DE VISTORIA LTDA',
  'ARANTES NEGOCIOS LTDA': 'ARANTES NEGOCIOS EIRELI -ME',
  'CARVALHO E MELO ADM. E PARTIPA AO EIRELI': 'CARVALHO E MELO LTDA',
  'FORMA COMUNICA AO VISUAL LTDA-ME': 'FORMA COMUNICAÇÃO VISUAL LTDA ME',
  'MARCUS VINICIUS LEAL PIRES 75208709104': 'MARCUS VINICIUS LEAL PIRES - MEI',
  'PREMIER SOLU OES INDUSTRIAIS LTDA': 'PREMIER SOLUÇÕES INDUSTRIAL LTDA',
  'COVAS SERVICOS DE PINTURAS LTDA': 'COVAS SERVIÇOS DE PINTURAS LTDA',
  'FERNANDA COVAS DO VALE': 'FERNANDA COVAS VALE',
  'BCS MINAS SERVICOS MEDICOS LTDA': 'BCS MINAS SERVIÇOS MEDICOS LTDA',
  'BCS GOIAS SERVICOS MEDICOS LTDA': 'BCS GOIAS SERVIÇOS MEDICOS LTDA',
};

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

function formatMoney(valor) {
  return `R$ ${(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Normalizar nome para comparação
function normalizarNome(nome) {
  return (nome || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^A-Z0-9\s]/g, ' ')    // Remove caracteres especiais
    .replace(/\s+/g, ' ')            // Remove espaços duplos
    .trim();
}

// Extrair nome do cliente da descrição do lançamento
function extrairNomeCliente(descricao) {
  if (!descricao) return null;
  
  const padroes = [
    /Receita Honorarios:\s*(.+)/i,
    /Recebimento\s+(.+?)\s*-\s*COB/i,
    /Recebimento\s+(.+?)\s*$/i,
    /Saldo Abertura\s*-\s*(.+)/i,
    /Saldo abertura cliente\s*:\s*(.+)/i,
    /Débito:\s*(.+)/i,
    /Cliente:\s*(.+)/i,
    /^(.+?)\s*-\s*COB\d+/i,
    /Honorário\s+(.+)/i,
    /Fatura\s+(.+)/i,
  ];
  
  for (const padrao of padroes) {
    const match = descricao.match(padrao);
    if (match && match[1]) {
      let nome = match[1].trim();
      // Limpar sufixos comuns
      nome = nome.replace(/\s*-\s*\d+\/\d+.*$/, '').trim();
      nome = nome.replace(/\s*COB\d+.*$/, '').trim();
      return nome;
    }
  }
  
  return null;
}

// Calcular similaridade entre dois nomes
function calcularSimilaridade(nome1, nome2) {
  const n1 = normalizarNome(nome1);
  const n2 = normalizarNome(nome2);
  
  if (n1 === n2) return 1.0;
  
  // Similaridade por palavras em comum
  const palavras1 = new Set(n1.split(' ').filter(p => p.length > 2));
  const palavras2 = new Set(n2.split(' ').filter(p => p.length > 2));
  
  if (palavras1.size === 0 || palavras2.size === 0) return 0;
  
  const intersecao = [...palavras1].filter(p => palavras2.has(p)).length;
  const uniao = new Set([...palavras1, ...palavras2]).size;
  
  return intersecao / uniao;
}

async function reclassificarSintetica() {
  console.log('\n' + '='.repeat(70));
  console.log(`🔧 RECLASSIFICAÇÃO: SINTÉTICA → ANALÍTICAS | MODO: ${MODO}`);
  console.log('='.repeat(70));

  // 1. Buscar conta sintética
  console.log('\n📍 Buscando conta sintética...');
  
  const { data: contaSintetica, error: errSint } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_SINTETICA_CODE)
    .single();

  if (errSint || !contaSintetica) {
    console.error(`❌ Conta ${CONTA_SINTETICA_CODE} não encontrada!`);
    return { success: false, error: 'Conta sintética não encontrada' };
  }

  console.log(`   ✅ ${contaSintetica.code} - ${contaSintetica.name}`);

  // 2. Buscar linhas na conta sintética
  console.log('\n📊 Buscando lançamentos na conta sintética...');

  const { data: linhasSinteticas, error: errLinhas } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      entry_id,
      debit,
      credit,
      description,
      accounting_entries!inner (
        id,
        entry_date,
        description,
        reference_type,
        reference_id,
        source_type
      )
    `)
    .eq('account_id', contaSintetica.id);

  if (errLinhas) {
    console.error('❌ Erro ao buscar linhas:', errLinhas);
    return { success: false, error: errLinhas };
  }

  console.log(`   Total: ${linhasSinteticas.length} lançamentos`);

  if (linhasSinteticas.length === 0) {
    console.log('\n✅ Nenhum lançamento na conta sintética! Já está correto.');
    return { success: true, message: 'Nenhuma reclassificação necessária' };
  }

  // 3. Buscar todos os clientes
  console.log('\n📍 Carregando clientes...');
  
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name');

  console.log(`   ${clientes.length} clientes carregados`);

  // Criar mapa de clientes por nome normalizado
  const clientesPorNome = new Map();
  for (const c of clientes) {
    clientesPorNome.set(normalizarNome(c.name), c);
  }
  
  // Adicionar mapeamentos especiais
  for (const [csvNome, bancoNome] of Object.entries(MAPEAMENTO_CLIENTES)) {
    const cliente = clientes.find(c => normalizarNome(c.name) === normalizarNome(bancoNome));
    if (cliente) {
      clientesPorNome.set(normalizarNome(csvNome), cliente);
    }
  }

  // 4. Buscar contas analíticas existentes
  console.log('\n📍 Carregando contas analíticas existentes...');
  
  const { data: contasAnaliticas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('code', '1.1.2.01.%')
    .order('code');

  console.log(`   ${contasAnaliticas?.length || 0} contas analíticas`);

  const contasPorNome = new Map();
  const contasPorCodigo = new Map();
  for (const conta of contasAnaliticas || []) {
    contasPorNome.set(normalizarNome(conta.name), conta);
    contasPorCodigo.set(conta.code, conta);
  }

  // 5. Processar cada linha
  console.log('\n📝 Processando lançamentos...');

  const alteracoes = [];
  const semCliente = [];
  const contasParaCriar = new Map();
  
  // Encontrar próximo código disponível
  let proximoCodigo = 1;
  for (const conta of contasAnaliticas || []) {
    const num = parseInt(conta.code.split('.').pop() || '0');
    if (num >= proximoCodigo) {
      proximoCodigo = num + 1;
    }
  }

  for (const linha of linhasSinteticas) {
    const descricao = linha.description || linha.accounting_entries?.description || '';
    const nomeExtraido = extrairNomeCliente(descricao);
    
    if (!nomeExtraido) {
      semCliente.push({ 
        linha, 
        motivo: 'Nome não extraído da descrição',
        descricao: descricao.substring(0, 60)
      });
      continue;
    }

    // Tentar encontrar cliente pelo nome
    let cliente = clientesPorNome.get(normalizarNome(nomeExtraido));
    
    // Se não encontrou, tentar por similaridade
    if (!cliente) {
      let melhorMatch = null;
      let melhorScore = 0;
      
      for (const c of clientes) {
        const score = calcularSimilaridade(nomeExtraido, c.name);
        if (score > melhorScore && score >= 0.5) {
          melhorScore = score;
          melhorMatch = c;
        }
      }
      
      if (melhorMatch) {
        cliente = melhorMatch;
      }
    }

    if (!cliente) {
      semCliente.push({ 
        linha, 
        motivo: `Cliente não encontrado: "${nomeExtraido}"`,
        descricao: descricao.substring(0, 60)
      });
      continue;
    }

    // Verificar se já tem conta analítica
    let contaAnalitica = contasPorNome.get(normalizarNome(cliente.name));

    if (!contaAnalitica) {
      // Verificar se já está na lista para criar
      const nomeNorm = normalizarNome(cliente.name);
      if (contasParaCriar.has(nomeNorm)) {
        contaAnalitica = contasParaCriar.get(nomeNorm);
      } else {
        // Criar nova conta
        const novoCodigo = `1.1.2.01.${String(proximoCodigo).padStart(4, '0')}`;
        proximoCodigo++;
        
        contaAnalitica = {
          id: null,
          code: novoCodigo,
          name: cliente.name,
          nova: true
        };
        contasParaCriar.set(nomeNorm, contaAnalitica);
        contasPorNome.set(nomeNorm, contaAnalitica);
      }
    }

    alteracoes.push({
      linhaId: linha.id,
      clienteId: cliente.id,
      clienteNome: cliente.name,
      contaAnalitica,
      valor: linha.debit || linha.credit,
      tipo: linha.debit ? 'D' : 'C',
      descricaoOriginal: descricao.substring(0, 50)
    });
  }

  // 6. Relatório
  console.log('\n' + '='.repeat(70));
  console.log('RELATÓRIO DE RECLASSIFICAÇÃO');
  console.log('='.repeat(70));

  const totalReclassificar = alteracoes.length;
  const totalSemCliente = semCliente.length;
  const totalContasNovas = contasParaCriar.size;

  console.log(`\n✅ Linhas a reclassificar: ${totalReclassificar}`);
  console.log(`📝 Novas contas a criar:   ${totalContasNovas}`);
  console.log(`❌ Linhas sem cliente:     ${totalSemCliente}`);

  // Agrupar por source_type
  const porSourceType = {};
  for (const alt of alteracoes) {
    const linha = linhasSinteticas.find(l => l.id === alt.linhaId);
    const sourceType = linha?.accounting_entries?.source_type || 'null';
    if (!porSourceType[sourceType]) {
      porSourceType[sourceType] = { qtd: 0, valor: 0 };
    }
    porSourceType[sourceType].qtd++;
    porSourceType[sourceType].valor += alt.valor || 0;
  }

  console.log('\n📊 Por source_type:');
  for (const [tipo, dados] of Object.entries(porSourceType)) {
    console.log(`   ${tipo}: ${dados.qtd} linhas, ${formatMoney(dados.valor)}`);
  }

  if (MODO === 'SIMULACAO') {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  MODO SIMULAÇÃO - NENHUMA ALTERAÇÃO FOI FEITA');
    console.log('='.repeat(70));
    
    // Mostrar contas a criar
    if (contasParaCriar.size > 0) {
      console.log('\n📝 Contas analíticas a criar:');
      for (const [_, conta] of contasParaCriar) {
        console.log(`   ${conta.code} - ${conta.name}`);
      }
    }

    // Mostrar amostra de reclassificações
    console.log('\n📝 Amostra das primeiras 15 reclassificações:');
    console.log('-'.repeat(90));
    
    for (const alt of alteracoes.slice(0, 15)) {
      const contaStr = alt.contaAnalitica.nova ? `${alt.contaAnalitica.code} (NOVA)` : alt.contaAnalitica.code;
      console.log(`   ${alt.tipo} ${formatMoney(alt.valor).padStart(15)} → ${contaStr} | ${alt.clienteNome.substring(0, 30)}`);
    }
    
    if (alteracoes.length > 15) {
      console.log(`   ... e mais ${alteracoes.length - 15} reclassificações`);
    }

    // Mostrar linhas sem cliente
    if (semCliente.length > 0) {
      console.log('\n⚠️ Linhas sem cliente identificado (primeiras 10):');
      for (const { linha, motivo, descricao } of semCliente.slice(0, 10)) {
        console.log(`   ${descricao} | ${motivo}`);
      }
      if (semCliente.length > 10) {
        console.log(`   ... e mais ${semCliente.length - 10} linhas`);
      }
    }

    console.log('\n🚀 Para executar a reclassificação, rode:');
    console.log('   node scripts/03_reclassificar_sintetica_para_analiticas.mjs --executar');
    
    return { 
      success: true, 
      modo: 'SIMULACAO',
      a_reclassificar: totalReclassificar,
      contas_a_criar: totalContasNovas,
      sem_cliente: totalSemCliente
    };
  }

  // 7. EXECUÇÃO
  console.log('\n' + '='.repeat(70));
  console.log('🔧 EXECUTANDO RECLASSIFICAÇÃO...');
  console.log('='.repeat(70));

  // 7.1 Criar contas analíticas novas
  if (contasParaCriar.size > 0) {
    console.log('\n📍 Criando contas analíticas novas...');
    
    for (const [nomeNorm, conta] of contasParaCriar) {
      const { data: novaConta, error: errConta } = await supabase
        .from('chart_of_accounts')
        .insert({
          code: conta.code,
          name: conta.name,
          account_type: 'ATIVO',
          nature: 'DEVEDORA',
          is_synthetic: false,
          parent_code: '1.1.2.01',
          is_active: true,
          description: `Conta a Receber - ${conta.name}`
        })
        .select('id, code')
        .single();

      if (errConta) {
        console.error(`   ❌ Erro ao criar ${conta.code}:`, errConta.message);
      } else {
        conta.id = novaConta.id;
        console.log(`   ✅ ${novaConta.code} - ${conta.name}`);
      }
    }
  }

  // 7.2 Recarregar contas para ter os IDs
  const { data: contasAtualizadas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('code', '1.1.2.01.%');

  const contaIdPorCodigo = new Map();
  for (const conta of contasAtualizadas || []) {
    contaIdPorCodigo.set(conta.code, conta.id);
  }

  // 7.3 Atualizar linhas
  console.log('\n📍 Atualizando linhas para contas analíticas...');
  
  let atualizadas = 0;
  let erros = 0;

  for (const alt of alteracoes) {
    const contaId = contaIdPorCodigo.get(alt.contaAnalitica.code);
    
    if (!contaId) {
      console.error(`   ❌ Conta ${alt.contaAnalitica.code} não encontrada`);
      erros++;
      continue;
    }

    const { error: errUpdate } = await supabase
      .from('accounting_entry_lines')
      .update({ account_id: contaId })
      .eq('id', alt.linhaId);

    if (errUpdate) {
      console.error(`   ❌ Erro ao atualizar linha ${alt.linhaId}:`, errUpdate.message);
      erros++;
    } else {
      atualizadas++;
    }
  }

  console.log(`   ✅ ${atualizadas} linhas atualizadas`);
  if (erros > 0) {
    console.log(`   ❌ ${erros} erros`);
  }

  // 8. Verificação final
  console.log('\n📊 VERIFICAÇÃO FINAL:');

  const { data: linhasRestantes, count: countRestantes } = await supabase
    .from('accounting_entry_lines')
    .select('id', { count: 'exact' })
    .eq('account_id', contaSintetica.id);

  console.log(`   Linhas restantes na sintética: ${countRestantes || 0}`);

  if (countRestantes === 0) {
    console.log('\n✅ CONTA SINTÉTICA LIMPA! Todos os lançamentos foram reclassificados.');
  } else {
    console.log(`\n⚠️ Ainda restam ${countRestantes} linhas na sintética (provavelmente sem cliente identificado).`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ RECLASSIFICAÇÃO CONCLUÍDA!');
  console.log('='.repeat(70));
  console.log('\nPróximo passo: Execute o script 04_validar_equacao_contabil.mjs');

  return { 
    success: true,
    linhas_atualizadas: atualizadas,
    contas_criadas: contasParaCriar.size,
    erros,
    linhas_restantes: countRestantes
  };
}

reclassificarSintetica().catch(console.error);
