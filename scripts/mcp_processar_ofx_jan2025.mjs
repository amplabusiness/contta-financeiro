// scripts/mcp_processar_ofx_jan2025.mjs
// Processa OFX de Janeiro 2025 usando MCP Guardião
// Autor: MCP Financeiro + Dr. Cícero

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configurações
const COMPETENCIA = '2025-01-01';
const CONTA_BANCO_SICREDI = '1.1.1.05'; // Banco Sicredi (correto)
const CONTA_TRANSITORIA = '1.1.9.01';   // Conta Transitória para COB

// Estatísticas
const stats = {
  transacoesProcessadas: 0,
  transacoesIgnoradas: 0,
  transacoesJaExistem: 0,
  cobrancasAgrupadas: 0,
  erros: 0,
  valorTotalDebitos: 0,
  valorTotalCreditos: 0
};

// Parse OFX simples
function parseOFX(conteudo) {
  const transacoes = [];
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;

  while ((match = regex.exec(conteudo)) !== null) {
    const bloco = match[1];

    const tipo = bloco.match(/<TRNTYPE>([^<]+)/)?.[1];
    const dataRaw = bloco.match(/<DTPOSTED>([^<]+)/)?.[1];
    const valor = parseFloat(bloco.match(/<TRNAMT>([^<]+)/)?.[1] || '0');
    const fitid = bloco.match(/<FITID>([^<]+)/)?.[1];
    const memo = bloco.match(/<MEMO>([^<]+)/)?.[1]?.trim() || '';

    // Converter data YYYYMMDD para YYYY-MM-DD
    const data = dataRaw ? `${dataRaw.substring(0,4)}-${dataRaw.substring(4,6)}-${dataRaw.substring(6,8)}` : null;

    if (data && fitid) {
      transacoes.push({
        tipo,
        data,
        valor: Math.abs(valor),
        valorOriginal: valor,
        fitid,
        memo,
        isDebito: valor < 0,
        isCredito: valor > 0
      });
    }
  }

  return transacoes;
}

// Identificar tipo de transação pelo memo
function identificarTipoTransacao(memo) {
  const memoUpper = memo.toUpperCase();

  // Cobranças agrupadas (para desmembrar)
  if (memoUpper.includes('LIQ.COBRANCA') && memoUpper.includes('COB')) {
    const cobMatch = memo.match(/COB\d+/i);
    return { tipo: 'COBRANCA_AGRUPADA', cobranca: cobMatch?.[0] };
  }

  // Tarifas bancárias
  if (memoUpper.includes('TARIFA') || memoUpper.includes('MANUTENCAO DE TITULOS')) {
    return { tipo: 'TARIFA_BANCARIA' };
  }

  // PIX recebido
  if (memoUpper.includes('PIX_CRED') || memoUpper.includes('RECEBIMENTO PIX')) {
    return { tipo: 'PIX_RECEBIDO' };
  }

  // PIX enviado
  if (memoUpper.includes('PIX_DEB') || memoUpper.includes('PAGAMENTO PIX')) {
    return { tipo: 'PIX_ENVIADO' };
  }

  // Boleto pago
  if (memoUpper.includes('LIQUIDACAO BOLETO')) {
    return { tipo: 'BOLETO_PAGO' };
  }

  // Transferência
  if (memoUpper.includes('TRANSFERENCIA') || memoUpper.includes('TED') || memoUpper.includes('DOC')) {
    return { tipo: 'TRANSFERENCIA' };
  }

  // Débito automático
  if (memoUpper.includes('DEBITO AUTOMATICO')) {
    return { tipo: 'DEBITO_AUTOMATICO' };
  }

  // Juros/rendimentos
  if (memoUpper.includes('JUROS') || memoUpper.includes('RENDIMENTO')) {
    return { tipo: 'RENDIMENTO' };
  }

  return { tipo: 'OUTROS' };
}

// MCP Guardião: Validar lançamento
async function validarLancamento(tipo, linhas, referenceId, referenceType) {
  const erros = [];
  const avisos = [];

  // Regra 1: Partida dobrada (D = C)
  const totalDebitos = linhas.reduce((s, l) => s + (l.debito || 0), 0);
  const totalCreditos = linhas.reduce((s, l) => s + (l.credito || 0), 0);

  if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
    erros.push(`BLOQUEADO: Débitos (${totalDebitos.toFixed(2)}) ≠ Créditos (${totalCreditos.toFixed(2)})`);
  }

  // Regra 2: Verificar contas sintéticas
  for (const linha of linhas) {
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, is_synthetic')
      .eq('code', linha.conta_code)
      .single();

    if (!conta) {
      erros.push(`Conta ${linha.conta_code} não encontrada`);
    } else if (conta.is_synthetic) {
      erros.push(`BLOQUEADO: Conta ${linha.conta_code} é sintética (NBC TG 26)`);
    }
  }

  // Regra 3: Idempotência
  if (referenceId) {
    const { data: existente } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('internal_code', referenceId)
      .maybeSingle();

    if (existente) {
      avisos.push(`Lançamento ${referenceId} já existe (idempotência)`);
      return { valido: false, jaExiste: true, erros, avisos };
    }
  }

  return {
    valido: erros.length === 0,
    jaExiste: false,
    erros,
    avisos,
    totalDebitos,
    totalCreditos
  };
}

// Buscar conta pelo código
async function buscarConta(codigo) {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', codigo)
    .single();
  return data;
}

// Criar lançamento contábil via Guardião MCP
async function criarLancamentoContabil(tipo, data, competencia, descricao, linhas, referenceId, referenceType) {
  // Validar com Guardião
  const validacao = await validarLancamento(tipo, linhas, referenceId, referenceType);

  if (validacao.jaExiste) {
    return { sucesso: true, jaExiste: true };
  }

  if (!validacao.valido) {
    console.log(`   ❌ GUARDIÃO BLOQUEOU: ${validacao.erros.join(', ')}`);
    return { sucesso: false, bloqueado_pelo_guardiao: true, erros: validacao.erros };
  }

  // Criar entry
  const { data: entry, error: errEntry } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: data,
      competence_date: competencia,
      entry_type: tipo,
      description: descricao,
      reference_type: referenceType,
      internal_code: referenceId,
      total_debit: validacao.totalDebitos,
      total_credit: validacao.totalCreditos,
      balanced: true
    })
    .select()
    .single();

  if (errEntry) {
    console.log(`   ❌ Erro ao criar entry: ${errEntry.message}`);
    return { sucesso: false, erro: errEntry.message };
  }

  // Criar items
  const items = [];
  for (const linha of linhas) {
    const conta = await buscarConta(linha.conta_code);
    if (!conta) continue;

    items.push({
      entry_id: entry.id,
      account_id: conta.id,
      debit: linha.debito || 0,
      credit: linha.credito || 0,
      history: linha.historico || descricao
    });
  }

  const { error: errItems } = await supabase
    .from('accounting_entry_items')
    .insert(items);

  if (errItems) {
    console.log(`   ❌ Erro ao criar items: ${errItems.message}`);
    await supabase.from('accounting_entries').delete().eq('id', entry.id);
    return { sucesso: false, erro: errItems.message };
  }

  return { sucesso: true, entry_id: entry.id };
}

// Processar transação individual
async function processarTransacao(tx) {
  const { tipo, cobranca } = identificarTipoTransacao(tx.memo);

  console.log(`\n📋 [${tx.data}] ${tx.isDebito ? 'DÉBITO' : 'CRÉDITO'} R$ ${tx.valor.toFixed(2)}`);
  console.log(`   FITID: ${tx.fitid}`);
  console.log(`   Memo: ${tx.memo.substring(0, 60)}...`);
  console.log(`   Tipo: ${tipo}`);

  // Cobranças agrupadas vão para conta transitória
  if (tipo === 'COBRANCA_AGRUPADA') {
    console.log(`   ⏳ Cobrança agrupada ${cobranca} - será desmembrada depois`);

    const linhas = [
      { conta_code: CONTA_BANCO_SICREDI, debito: tx.valor, credito: 0, historico: `Recebimento ${cobranca}` },
      { conta_code: CONTA_TRANSITORIA, debito: 0, credito: tx.valor, historico: `${cobranca} - aguardando desmembramento` }
    ];

    const resultado = await criarLancamentoContabil(
      'RECEBIMENTO_AGRUPADO',
      tx.data,
      COMPETENCIA,
      `Recebimento cobrança agrupada - ${cobranca}`,
      linhas,
      `ofx_${tx.fitid}`,
      'OFX_BANK'
    );

    if (resultado.sucesso && !resultado.jaExiste) {
      stats.cobrancasAgrupadas++;
      stats.valorTotalCreditos += tx.valor;
      console.log(`   ✅ Registrado na conta transitória`);
    } else if (resultado.jaExiste) {
      stats.transacoesJaExistem++;
      console.log(`   ⚠️  Já existe`);
    }

    return;
  }

  // Tarifas bancárias
  if (tipo === 'TARIFA_BANCARIA') {
    // Usar conta de tarifas bancárias (4.1.3.02)
    const contaDespesa = '4.1.3.02'; // Tarifas Bancárias

    const linhas = [
      { conta_code: contaDespesa, debito: tx.valor, credito: 0, historico: tx.memo },
      { conta_code: CONTA_BANCO_SICREDI, debito: 0, credito: tx.valor, historico: tx.memo }
    ];

    const resultado = await criarLancamentoContabil(
      'DESPESA_BANCARIA',
      tx.data,
      COMPETENCIA,
      tx.memo,
      linhas,
      `ofx_${tx.fitid}`,
      'OFX_BANK'
    );

    if (resultado.sucesso && !resultado.jaExiste) {
      stats.transacoesProcessadas++;
      stats.valorTotalDebitos += tx.valor;
      console.log(`   ✅ Tarifa bancária registrada`);
    } else if (resultado.jaExiste) {
      stats.transacoesJaExistem++;
      console.log(`   ⚠️  Já existe`);
    }

    return;
  }

  // PIX/Transferências enviadas (saídas) - classificar depois
  if (tipo === 'PIX_ENVIADO' || tipo === 'BOLETO_PAGO' || tipo === 'TRANSFERENCIA') {
    // Vão para conta transitória para classificação posterior
    const linhas = [
      { conta_code: CONTA_TRANSITORIA, debito: tx.valor, credito: 0, historico: tx.memo },
      { conta_code: CONTA_BANCO_SICREDI, debito: 0, credito: tx.valor, historico: tx.memo }
    ];

    const resultado = await criarLancamentoContabil(
      'SAIDA_PENDENTE_CLASSIFICACAO',
      tx.data,
      COMPETENCIA,
      tx.memo,
      linhas,
      `ofx_${tx.fitid}`,
      'OFX_BANK'
    );

    if (resultado.sucesso && !resultado.jaExiste) {
      stats.transacoesProcessadas++;
      stats.valorTotalDebitos += tx.valor;
      console.log(`   ✅ Registrado para classificação posterior`);
    } else if (resultado.jaExiste) {
      stats.transacoesJaExistem++;
      console.log(`   ⚠️  Já existe`);
    }

    return;
  }

  // PIX recebidos (créditos)
  if (tipo === 'PIX_RECEBIDO') {
    // Também vai para transitória até identificar cliente
    const linhas = [
      { conta_code: CONTA_BANCO_SICREDI, debito: tx.valor, credito: 0, historico: tx.memo },
      { conta_code: CONTA_TRANSITORIA, debito: 0, credito: tx.valor, historico: tx.memo }
    ];

    const resultado = await criarLancamentoContabil(
      'PIX_RECEBIDO',
      tx.data,
      COMPETENCIA,
      tx.memo,
      linhas,
      `ofx_${tx.fitid}`,
      'OFX_BANK'
    );

    if (resultado.sucesso && !resultado.jaExiste) {
      stats.transacoesProcessadas++;
      stats.valorTotalCreditos += tx.valor;
      console.log(`   ✅ PIX recebido registrado`);
    } else if (resultado.jaExiste) {
      stats.transacoesJaExistem++;
      console.log(`   ⚠️  Já existe`);
    }

    return;
  }

  // Rendimentos
  if (tipo === 'RENDIMENTO') {
    const linhas = [
      { conta_code: CONTA_BANCO_SICREDI, debito: tx.valor, credito: 0, historico: tx.memo },
      { conta_code: '3.2.1.02', debito: 0, credito: tx.valor, historico: tx.memo } // Rendimentos de Aplicações
    ];

    const resultado = await criarLancamentoContabil(
      'RENDIMENTO',
      tx.data,
      COMPETENCIA,
      tx.memo,
      linhas,
      `ofx_${tx.fitid}`,
      'OFX_BANK'
    );

    if (resultado.sucesso && !resultado.jaExiste) {
      stats.transacoesProcessadas++;
      stats.valorTotalCreditos += tx.valor;
      console.log(`   ✅ Rendimento registrado`);
    } else if (resultado.jaExiste) {
      stats.transacoesJaExistem++;
      console.log(`   ⚠️  Já existe`);
    }

    return;
  }

  // Outros - para conta transitória
  console.log(`   ⏳ Tipo não identificado - conta transitória`);
  const linhas = tx.isDebito
    ? [
        { conta_code: CONTA_TRANSITORIA, debito: tx.valor, credito: 0, historico: tx.memo },
        { conta_code: CONTA_BANCO_SICREDI, debito: 0, credito: tx.valor, historico: tx.memo }
      ]
    : [
        { conta_code: CONTA_BANCO_SICREDI, debito: tx.valor, credito: 0, historico: tx.memo },
        { conta_code: CONTA_TRANSITORIA, debito: 0, credito: tx.valor, historico: tx.memo }
      ];

  const resultado = await criarLancamentoContabil(
    'PENDENTE_CLASSIFICACAO',
    tx.data,
    COMPETENCIA,
    tx.memo,
    linhas,
    `ofx_${tx.fitid}`,
    'OFX_BANK'
  );

  if (resultado.sucesso && !resultado.jaExiste) {
    stats.transacoesProcessadas++;
    if (tx.isDebito) stats.valorTotalDebitos += tx.valor;
    else stats.valorTotalCreditos += tx.valor;
    console.log(`   ✅ Registrado para classificação`);
  } else if (resultado.jaExiste) {
    stats.transacoesJaExistem++;
    console.log(`   ⚠️  Já existe`);
  }
}

async function main() {
  console.log('='.repeat(100));
  console.log('MCP GUARDIÃO FINANCEIRO - PROCESSAMENTO OFX JANEIRO 2025');
  console.log('Dr. Cícero - Contador Oficial');
  console.log('='.repeat(100));
  console.log(`Executado em: ${new Date().toLocaleString('pt-BR')}`);

  // Verificar contas necessárias
  console.log('\n📊 Verificando contas contábeis...');

  const contaBanco = await buscarConta(CONTA_BANCO_SICREDI);
  if (!contaBanco) {
    console.error(`❌ Conta ${CONTA_BANCO_SICREDI} não encontrada!`);
    return;
  }
  console.log(`   ✅ ${contaBanco.code} - ${contaBanco.name}`);

  const contaTransitoria = await buscarConta(CONTA_TRANSITORIA);
  if (!contaTransitoria) {
    console.error(`❌ Conta ${CONTA_TRANSITORIA} não encontrada!`);
    return;
  }
  console.log(`   ✅ ${contaTransitoria.code} - ${contaTransitoria.name}`);

  // Ler arquivo OFX
  console.log('\n📂 Lendo arquivo OFX...');
  const ofxPath = 'banco/jan 2025.ofx';
  const conteudo = readFileSync(ofxPath, 'latin1');

  const transacoes = parseOFX(conteudo);
  console.log(`   Total de transações encontradas: ${transacoes.length}`);

  // Resumo por tipo
  const resumo = {};
  for (const tx of transacoes) {
    const { tipo } = identificarTipoTransacao(tx.memo);
    resumo[tipo] = (resumo[tipo] || 0) + 1;
  }
  console.log('\n📋 Resumo por tipo:');
  for (const [tipo, qtd] of Object.entries(resumo).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${tipo}: ${qtd}`);
  }

  // Processar transações
  console.log('\n' + '='.repeat(100));
  console.log('PROCESSANDO TRANSAÇÕES');
  console.log('='.repeat(100));

  for (const tx of transacoes) {
    try {
      await processarTransacao(tx);
    } catch (err) {
      console.log(`   ❌ Erro: ${err.message}`);
      stats.erros++;
    }
  }

  // Relatório final
  console.log('\n' + '='.repeat(100));
  console.log('RELATÓRIO FINAL - MCP GUARDIÃO');
  console.log('='.repeat(100));
  console.log(`   Total transações no OFX: ${transacoes.length}`);
  console.log(`   Processadas com sucesso: ${stats.transacoesProcessadas}`);
  console.log(`   Cobranças agrupadas:     ${stats.cobrancasAgrupadas} (para desmembrar)`);
  console.log(`   Já existentes:           ${stats.transacoesJaExistem}`);
  console.log(`   Erros:                   ${stats.erros}`);
  console.log('');
  console.log(`   Valor total débitos:     R$ ${stats.valorTotalDebitos.toFixed(2)}`);
  console.log(`   Valor total créditos:    R$ ${stats.valorTotalCreditos.toFixed(2)}`);

  // Verificar saldo conta transitória
  console.log('\n📊 Verificando saldo da conta transitória...');

  const { data: itemsTransitoria } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit')
    .eq('account_id', contaTransitoria.id);

  const saldoTransitoria = (itemsTransitoria || []).reduce(
    (s, i) => s + Number(i.debit || 0) - Number(i.credit || 0), 0
  );

  console.log(`   Saldo conta transitória: R$ ${saldoTransitoria.toFixed(2)}`);

  if (Math.abs(saldoTransitoria) > 0.01) {
    console.log(`   ⚠️  Há lançamentos pendentes de classificação/desmembramento`);
  } else {
    console.log(`   ✅ Conta transitória zerada`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('PRÓXIMO PASSO: Executar desmembramento das cobranças agrupadas');
  console.log('='.repeat(100));
}

main().catch(console.error);
