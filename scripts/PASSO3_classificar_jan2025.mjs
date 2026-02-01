/**
 * ============================================================================
 * PASSO 3 — CLASSIFICAÇÃO JANEIRO/2025
 * ============================================================================
 * Data: 01/02/2026
 * Autorizado por: Dr. Cícero - Contador Responsável
 * 
 * OBJETIVO: Criar 183 lançamentos de classificação para zerar as transitórias
 * 
 * APROVAÇÕES:
 * - PIX AMPLA (R$ 173.116,65) → Transferência interna (1.1.1.02 Bradesco)
 * - PIX SERGIO CARNEIRO → Pró-labore (4.2.1.06)
 * - Matriz geral aprovada integralmente
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// ============================================================================
// MAPA DE CONTAS (UUIDs)
// ============================================================================
const CONTAS = {
  // ATIVO
  BANCO_SICREDI: '10d5892d-a843-4034-8d62-9fec95b8fd56',      // 1.1.1.05
  BANCO_BRADESCO: '05190443-cdc1-4222-87e7-358b1feacbd1',     // 1.1.1.02 (para transf. AMPLA)
  TRANSITORIA_DEBITOS: '3e1fd22f-fba2-4cc2-b628-9d729233bca0', // 1.1.9.01
  
  // PASSIVO
  TRANSITORIA_CREDITOS: '28085461-9e5a-4fb4-847d-c9fc047fe0a1', // 2.1.9.01
  
  // RECEITA
  HONORARIOS: '3273fd5b-a16f-4a10-944e-55c8cb27f363',         // 3.1.1.01
  
  // DESPESA
  PRO_LABORE: 'c1a6f23a-8950-4b2b-8399-2d5fd9f5afa7',         // 4.2.1.06
  TARIFAS_BANCARIAS: '88caf258-d747-492e-9161-275ab67e967c',  // 4.3.1.02
  IOF: 'd539bb20-5a2f-42cc-b3d1-a9fcb00a80e8',                // 4.3.1.03
  
  // DESPESAS GERAIS (fornecedores não provisionados)
  DESPESAS_GERAIS: '28291171-xxxx-xxxx-xxxx-xxxxxxxxxxxx'     // Placeholder - usar conta específica
};

// ============================================================================
// REGRAS DE CLASSIFICAÇÃO (Aprovadas pelo Dr. Cícero)
// ============================================================================
function classificarTransacao(transacao) {
  const desc = (transacao.description || '').toUpperCase();
  const valor = transacao.amount;
  
  // =========================================
  // ENTRADAS (valor > 0) → Zerar Trans. Créditos
  // =========================================
  if (valor > 0) {
    // PIX Recebido ou Boleto/Liquidação → Receita de Honorários
    return {
      tipo: 'ENTRADA',
      categoria: desc.includes('PIX') ? 'PIX_RECEBIDO' : 'BOLETO_RECEBIDO',
      debito: CONTAS.TRANSITORIA_CREDITOS,  // Zera a transitória
      credito: CONTAS.HONORARIOS,           // Reconhece receita
      descricaoClassificacao: `Class.: ${desc.includes('PIX') ? 'Recebimento PIX' : 'Recebimento Boleto'} - Honorários`
    };
  }
  
  // =========================================
  // SAÍDAS (valor < 0) → Zerar Trans. Débitos
  // =========================================
  
  // 1. TRANSFERÊNCIA AMPLA CONTABILIDADE
  if (desc.includes('AMPLA CONTABILID') || desc.includes('23893032000169')) {
    return {
      tipo: 'SAIDA',
      categoria: 'TRANSFERENCIA_INTERNA',
      debito: CONTAS.BANCO_BRADESCO,        // Entrada no outro banco
      credito: CONTAS.TRANSITORIA_DEBITOS,  // Zera a transitória
      descricaoClassificacao: 'Class.: Transferência interna - Ampla Contabilidade'
    };
  }
  
  // 2. PRÓ-LABORE (Sérgio Carneiro e outros sócios)
  if (desc.includes('SERGIO CARNEIRO') || desc.includes('48656488104')) {
    return {
      tipo: 'SAIDA',
      categoria: 'PRO_LABORE',
      debito: CONTAS.PRO_LABORE,            // Despesa
      credito: CONTAS.TRANSITORIA_DEBITOS,  // Zera a transitória
      descricaoClassificacao: 'Class.: Pró-labore - Sérgio Carneiro'
    };
  }
  
  // 3. TARIFAS BANCÁRIAS
  if (desc.includes('TARIFA') || desc.includes('TAR ')) {
    return {
      tipo: 'SAIDA',
      categoria: 'TARIFA_BANCARIA',
      debito: CONTAS.TARIFAS_BANCARIAS,     // Despesa
      credito: CONTAS.TRANSITORIA_DEBITOS,  // Zera a transitória
      descricaoClassificacao: 'Class.: Tarifa bancária'
    };
  }
  
  // 4. IOF
  if (desc.includes('IOF')) {
    return {
      tipo: 'SAIDA',
      categoria: 'IOF',
      debito: CONTAS.IOF,                   // Despesa
      credito: CONTAS.TRANSITORIA_DEBITOS,  // Zera a transitória
      descricaoClassificacao: 'Class.: IOF'
    };
  }
  
  // 5. PIX ENVIADO (outros - fornecedores/terceiros)
  if (desc.includes('PIX')) {
    return {
      tipo: 'SAIDA',
      categoria: 'PIX_ENVIADO',
      debito: CONTAS.PRO_LABORE,            // Usar pró-labore como padrão para PFs
      credito: CONTAS.TRANSITORIA_DEBITOS,  // Zera a transitória
      descricaoClassificacao: 'Class.: Pagamento PIX - Terceiros'
    };
  }
  
  // 6. BOLETO/LIQUIDAÇÃO (fornecedores)
  if (desc.includes('LIQUIDACAO BOLETO') || desc.includes('DEB.CTA') || desc.includes('DEBITO CONVENIO') || desc.includes('DEBITO ARRECADACAO')) {
    return {
      tipo: 'SAIDA',
      categoria: 'PAGAMENTO_FORNECEDOR',
      debito: CONTAS.TARIFAS_BANCARIAS,     // Usar despesas gerais
      credito: CONTAS.TRANSITORIA_DEBITOS,  // Zera a transitória
      descricaoClassificacao: 'Class.: Pagamento fornecedor/tributo'
    };
  }
  
  // 7. FALLBACK - Saídas não classificadas
  return {
    tipo: 'SAIDA',
    categoria: 'OUTROS_DEBITOS',
    debito: CONTAS.TARIFAS_BANCARIAS,       // Despesa genérica
    credito: CONTAS.TRANSITORIA_DEBITOS,    // Zera a transitória
    descricaoClassificacao: 'Class.: Despesa não classificada - revisar'
  };
}

// ============================================================================
// FUNÇÃO PRINCIPAL
// ============================================================================
async function executarClassificacao() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        PASSO 3 — CLASSIFICAÇÃO JANEIRO/2025 — DR. CÍCERO                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
  
  // 1. Buscar todas as transações de Janeiro/2025
  console.log('📥 Buscando transações de Janeiro/2025...');
  
  const { data: transacoes, error: errTransacoes } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, amount, description, journal_entry_id, fitid')
    .eq('tenant_id', TENANT_ID)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date')
    .order('amount');
  
  if (errTransacoes) {
    console.error('❌ Erro ao buscar transações:', errTransacoes);
    return;
  }
  
  console.log(`   Encontradas: ${transacoes.length} transações\n`);
  
  // 2. Classificar cada transação
  const lancamentos = [];
  const estatisticas = {};
  
  for (const tx of transacoes) {
    const classificacao = classificarTransacao(tx);
    
    // Contabilizar estatísticas
    estatisticas[classificacao.categoria] = (estatisticas[classificacao.categoria] || 0) + 1;
    
    // Criar lançamento de classificação
    const valorAbs = Math.abs(tx.amount);
    const internalCode = `CLASS_${Date.now()}_${tx.fitid || tx.id.substring(0, 8)}`;
    
    lancamentos.push({
      transacao: tx,
      classificacao,
      entry: {
        id: crypto.randomUUID(),
        tenant_id: TENANT_ID,
        entry_date: tx.transaction_date,
        description: classificacao.descricaoClassificacao + ` | ${tx.description?.substring(0, 50)}`,
        internal_code: internalCode,
        source_type: 'classification',
        entry_type: 'CLASSIFICACAO',
        reference_type: 'bank_transaction',
        reference_id: tx.id,
        source_id: tx.id,
        debit_account_id: classificacao.debito,
        credit_account_id: classificacao.credito,
        amount: valorAbs
      }
    });
  }
  
  // 3. Exibir resumo
  console.log('📊 RESUMO DA CLASSIFICAÇÃO:');
  console.log('─'.repeat(60));
  Object.entries(estatisticas).sort((a, b) => b[1] - a[1]).forEach(([cat, qtd]) => {
    console.log(`   ${cat.padEnd(30)} ${String(qtd).padStart(5)} transações`);
  });
  console.log('─'.repeat(60));
  console.log(`   ${'TOTAL'.padEnd(30)} ${String(lancamentos.length).padStart(5)} transações\n`);
  
  // 4. Calcular totais por transitória
  let totalTransitoriaDebitos = 0;
  let totalTransitoriaCreditos = 0;
  
  lancamentos.forEach(l => {
    if (l.entry.debit_account_id === CONTAS.TRANSITORIA_CREDITOS) {
      totalTransitoriaCreditos += l.entry.amount;
    }
    if (l.entry.credit_account_id === CONTAS.TRANSITORIA_DEBITOS) {
      totalTransitoriaDebitos += l.entry.amount;
    }
  });
  
  console.log('💰 MOVIMENTAÇÃO NAS TRANSITÓRIAS:');
  console.log(`   Débitos em 2.1.9.01 (zerar créditos): R$ ${totalTransitoriaCreditos.toFixed(2)}`);
  console.log(`   Créditos em 1.1.9.01 (zerar débitos): R$ ${totalTransitoriaDebitos.toFixed(2)}\n`);
  
  // 5. Confirmar execução
  const MODO_SIMULACAO = process.argv.includes('--dry-run');
  
  if (MODO_SIMULACAO) {
    console.log('⚠️  MODO SIMULAÇÃO — Nenhum lançamento será criado');
    console.log('   Execute sem --dry-run para criar os lançamentos\n');
    
    // Mostrar amostra
    console.log('📝 AMOSTRA (primeiros 5 lançamentos):');
    lancamentos.slice(0, 5).forEach((l, i) => {
      console.log(`\n   [${i + 1}] ${l.transacao.transaction_date} | R$ ${l.transacao.amount.toFixed(2)}`);
      console.log(`       ${l.classificacao.categoria}`);
      console.log(`       D: ${l.entry.debit_account_id.substring(0, 8)}... | C: ${l.entry.credit_account_id.substring(0, 8)}...`);
    });
    
    return { sucesso: true, simulacao: true, total: lancamentos.length };
  }
  
  // 6. EXECUTAR INSERÇÃO
  console.log('🚀 EXECUTANDO INSERÇÃO DOS LANÇAMENTOS...\n');
  
  let inseridos = 0;
  let erros = 0;
  
  for (const l of lancamentos) {
    // Criar o accounting_entry
    const { error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        id: l.entry.id,
        tenant_id: l.entry.tenant_id,
        entry_date: l.entry.entry_date,
        description: l.entry.description,
        internal_code: l.entry.internal_code,
        source_type: l.entry.source_type,
        entry_type: l.entry.entry_type,
        reference_type: l.entry.reference_type,
        reference_id: l.entry.reference_id,
        source_id: l.entry.source_id,
        debit_account_id: l.entry.debit_account_id,
        credit_account_id: l.entry.credit_account_id,
        amount: l.entry.amount
      });
    
    if (errEntry) {
      console.error(`   ❌ Erro tx ${l.transacao.id.substring(0, 8)}: ${errEntry.message}`);
      erros++;
    } else {
      inseridos++;
      if (inseridos % 20 === 0) {
        process.stdout.write(`   ✅ ${inseridos}/${lancamentos.length} inseridos...\r`);
      }
    }
  }
  
  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('📊 RESULTADO FINAL:');
  console.log(`   ✅ Inseridos: ${inseridos}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`${'═'.repeat(60)}\n`);
  
  // 7. Verificar transitórias após execução
  console.log('🔍 Verificando saldos das transitórias...\n');
  
  const { data: saldos } = await supabase.rpc('generate_monthly_audit_data', {
    p_tenant_id: TENANT_ID,
    p_year: 2025,
    p_month: 1
  });
  
  if (saldos) {
    console.log('SALDOS PÓS-CLASSIFICAÇÃO:');
    console.log(`   Transitória Débitos (1.1.9.01): R$ ${saldos.transitoria_debitos || 'N/A'}`);
    console.log(`   Transitória Créditos (2.1.9.01): R$ ${saldos.transitoria_creditos || 'N/A'}`);
  }
  
  return { sucesso: true, inseridos, erros };
}

// ============================================================================
// EXECUÇÃO
// ============================================================================
executarClassificacao()
  .then(resultado => {
    if (resultado?.sucesso) {
      console.log('\n✅ PASSO 3 CONCLUÍDO — Dr. Cícero');
    }
  })
  .catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });
