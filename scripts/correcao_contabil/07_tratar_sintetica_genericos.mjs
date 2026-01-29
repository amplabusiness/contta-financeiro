// scripts/correcao_contabil/07_tratar_sintetica_genericos.mjs
// Trata os lançamentos genéricos na conta sintética 1.1.2.01

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

function formatMoney(valor) {
  return `R$ ${(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function tratarGenericos() {
  console.log('\n' + '='.repeat(70));
  console.log(`🔧 TRATAMENTO DE LANÇAMENTOS GENÉRICOS | MODO: ${MODO}`);
  console.log('='.repeat(70));

  // 1. Buscar conta sintética
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01')
    .single();

  if (!contaSintetica) {
    console.log('❌ Conta 1.1.2.01 não encontrada!');
    return;
  }

  console.log(`\n📍 Conta sintética: ${contaSintetica.code} - ${contaSintetica.name}`);

  // 2. Buscar linhas na conta sintética
  const { data: linhasSinteticas } = await supabase
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

  console.log(`\n📊 Linhas na conta sintética: ${linhasSinteticas?.length || 0}`);

  if (!linhasSinteticas || linhasSinteticas.length === 0) {
    console.log('✅ Nenhum lançamento na conta sintética!');
    return;
  }

  // 3. Analisar por source_type e reference_type
  const porSourceType = {};
  const porReferenceType = {};

  for (const linha of linhasSinteticas) {
    const source = linha.accounting_entries?.source_type || 'null';
    const ref = linha.accounting_entries?.reference_type || 'null';

    if (!porSourceType[source]) porSourceType[source] = { qtd: 0, valor: 0 };
    porSourceType[source].qtd++;
    porSourceType[source].valor += parseFloat(linha.debit) || parseFloat(linha.credit) || 0;

    if (!porReferenceType[ref]) porReferenceType[ref] = { qtd: 0, valor: 0 };
    porReferenceType[ref].qtd++;
    porReferenceType[ref].valor += parseFloat(linha.debit) || parseFloat(linha.credit) || 0;
  }

  console.log('\n   Por source_type:');
  for (const [source, dados] of Object.entries(porSourceType).sort((a, b) => b[1].qtd - a[1].qtd)) {
    console.log(`   ${source.padEnd(25)} ${String(dados.qtd).padStart(5)} linhas  ${formatMoney(dados.valor).padStart(18)}`);
  }

  console.log('\n   Por reference_type:');
  for (const [ref, dados] of Object.entries(porReferenceType).sort((a, b) => b[1].qtd - a[1].qtd)) {
    console.log(`   ${ref.padEnd(25)} ${String(dados.qtd).padStart(5)} linhas  ${formatMoney(dados.valor).padStart(18)}`);
  }

  // 4. Buscar clientes e contas analíticas
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, cnpj');

  const { data: contasAnaliticas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('code', '1.1.2.01.%');

  console.log(`\n📍 Clientes: ${clientes?.length || 0}`);
  console.log(`📍 Contas analíticas: ${contasAnaliticas?.length || 0}`);

  // Criar mapa de clientes por ID
  const clientesPorId = new Map(clientes.map(c => [c.id, c]));

  // Criar mapa de contas por nome normalizado
  const normalizarNome = (nome) => (nome || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const contasPorNome = new Map();
  for (const conta of contasAnaliticas || []) {
    contasPorNome.set(normalizarNome(conta.name), conta);
  }

  // 5. Tentar identificar clientes por reference_id (invoice_id)
  console.log('\n📍 Tentando identificar clientes por invoice_id...');

  const referenceIds = linhasSinteticas
    .filter(l => l.accounting_entries?.reference_type === 'invoice')
    .map(l => l.accounting_entries?.reference_id)
    .filter(Boolean);

  let invoicesEncontradas = 0;
  const clientesIdentificados = new Map();

  if (referenceIds.length > 0) {
    for (let i = 0; i < referenceIds.length; i += 50) {
      const lote = referenceIds.slice(i, i + 50);
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, client_id')
        .in('id', lote);

      for (const inv of invoices || []) {
        if (inv.client_id) {
          clientesIdentificados.set(inv.id, inv.client_id);
          invoicesEncontradas++;
        }
      }
    }
  }

  console.log(`   Invoices com client_id: ${invoicesEncontradas}`);

  // 6. Processar cada linha
  const paraReclassificar = [];
  const semIdentificacao = [];

  for (const linha of linhasSinteticas) {
    const refId = linha.accounting_entries?.reference_id;
    const refType = linha.accounting_entries?.reference_type;

    let clienteId = null;
    let contaDestino = null;

    if (refType === 'invoice' && refId && clientesIdentificados.has(refId)) {
      clienteId = clientesIdentificados.get(refId);
      const cliente = clientesPorId.get(clienteId);
      if (cliente) {
        contaDestino = contasPorNome.get(normalizarNome(cliente.name));
      }
    }

    if (contaDestino) {
      paraReclassificar.push({
        linhaId: linha.id,
        contaDestinoId: contaDestino.id,
        contaDestinoCodigo: contaDestino.code,
        clienteNome: clientesPorId.get(clienteId)?.name,
        valor: parseFloat(linha.debit) || parseFloat(linha.credit) || 0
      });
    } else {
      semIdentificacao.push({
        linhaId: linha.id,
        entryId: linha.entry_id,
        descricao: linha.description || linha.accounting_entries?.description,
        refType,
        refId,
        valor: parseFloat(linha.debit) || parseFloat(linha.credit) || 0
      });
    }
  }

  console.log(`\n📊 RESULTADO DA ANÁLISE:`);
  console.log(`   Identificados para reclassificar: ${paraReclassificar.length}`);
  console.log(`   Sem identificação: ${semIdentificacao.length}`);

  // 7. Mostrar opções para linhas sem identificação
  if (semIdentificacao.length > 0) {
    console.log('\n📋 OPÇÕES PARA LINHAS SEM IDENTIFICAÇÃO:');
    console.log('   1. Mover para conta "Pendente de Identificação" (1.1.2.01.9999)');
    console.log('   2. Deletar linhas e entries correspondentes');
    console.log('   3. Manter na sintética (não recomendado)');

    const { data: contaPendente } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', '1.1.2.01.9999')
      .maybeSingle();

    if (!contaPendente) {
      console.log('\n   ⚠️ Conta 1.1.2.01.9999 não existe. Será criada se executar.');
    }
  }

  if (MODO === 'SIMULACAO') {
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  MODO SIMULAÇÃO - NENHUMA ALTERAÇÃO FEITA');
    console.log('='.repeat(70));

    if (paraReclassificar.length > 0) {
      console.log('\n📝 Amostra de reclassificações (10 primeiras):');
      for (const item of paraReclassificar.slice(0, 10)) {
        console.log(`   ${item.contaDestinoCodigo} ${item.clienteNome?.substring(0, 30).padEnd(30)} ${formatMoney(item.valor)}`);
      }
    }

    if (semIdentificacao.length > 0) {
      console.log('\n📝 Amostra sem identificação (10 primeiras):');
      for (const item of semIdentificacao.slice(0, 10)) {
        console.log(`   ${(item.descricao || '').substring(0, 40).padEnd(40)} ${formatMoney(item.valor)}`);
      }
    }

    console.log(`\n🚀 Para executar, rode:`);
    console.log('   node scripts/correcao_contabil/07_tratar_sintetica_genericos.mjs --executar');

    return;
  }

  // 8. EXECUÇÃO
  console.log('\n' + '='.repeat(70));
  console.log('🔧 EXECUTANDO...');
  console.log('='.repeat(70));

  // 8.1 Criar conta de pendentes se não existir
  let contaPendenteId = null;
  const { data: contaPendente } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01.9999')
    .maybeSingle();

  if (!contaPendente) {
    console.log('\n📍 Criando conta 1.1.2.01.9999 (Pendente de Identificação)...');

    const { data: novaConta, error } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: '1.1.2.01.9999',
        name: 'Pendente de Identificação',
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        parent_id: contaSintetica.id,
        level: 5,
        is_analytical: true,
        is_synthetic: false,
        is_active: true,
        accepts_entries: true,
        description: 'Clientes a receber pendentes de identificação'
      })
      .select('id')
      .single();

    if (error) {
      console.log('   ❌ Erro ao criar conta:', error.message);
    } else {
      contaPendenteId = novaConta.id;
      console.log('   ✅ Conta criada:', novaConta.id);
    }
  } else {
    contaPendenteId = contaPendente.id;
  }

  // 8.2 Reclassificar linhas identificadas
  if (paraReclassificar.length > 0) {
    console.log(`\n📍 Reclassificando ${paraReclassificar.length} linhas identificadas...`);

    let reclassificadas = 0;
    for (const item of paraReclassificar) {
      const { error } = await supabase
        .from('accounting_entry_lines')
        .update({ account_id: item.contaDestinoId })
        .eq('id', item.linhaId);

      if (!error) reclassificadas++;
    }

    console.log(`   ✅ ${reclassificadas} linhas reclassificadas`);
  }

  // 8.3 Mover linhas sem identificação para conta de pendentes
  if (semIdentificacao.length > 0 && contaPendenteId) {
    console.log(`\n📍 Movendo ${semIdentificacao.length} linhas para conta de pendentes...`);

    let movidas = 0;
    for (const item of semIdentificacao) {
      const { error } = await supabase
        .from('accounting_entry_lines')
        .update({ account_id: contaPendenteId })
        .eq('id', item.linhaId);

      if (!error) movidas++;
    }

    console.log(`   ✅ ${movidas} linhas movidas`);
  }

  // 9. Verificação final
  console.log('\n📊 VERIFICAÇÃO FINAL:');

  const { count: linhasRestantes } = await supabase
    .from('accounting_entry_lines')
    .select('id', { count: 'exact' })
    .eq('account_id', contaSintetica.id);

  console.log(`   Linhas restantes na sintética: ${linhasRestantes || 0}`);

  if (linhasRestantes === 0) {
    console.log('\n✅ CONTA SINTÉTICA LIMPA!');
  } else {
    console.log('\n⚠️ Ainda há linhas na sintética.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ TRATAMENTO CONCLUÍDO!');
  console.log('='.repeat(70));
}

tratarGenericos().catch(console.error);
