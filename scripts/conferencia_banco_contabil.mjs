/**
 * CONFERÊNCIA: EXTRATO BANCÁRIO vs CONTABILIDADE
 *
 * Regra contábil:
 * - Entrada no banco (crédito extrato) = Débito na conta Banco (1.1.1.05)
 * - Saída do banco (débito extrato) = Crédito na conta Banco (1.1.1.05)
 *
 * Os valores devem ser IGUAIS!
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('═'.repeat(100));
  console.log('CONFERÊNCIA: EXTRATO BANCÁRIO vs CONTABILIDADE - JANEIRO/2025');
  console.log('═'.repeat(100));
  console.log('');

  // 1. EXTRATO BANCÁRIO (bank_transactions)
  const { data: extrato } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, transaction_type')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date');

  let bancoEntradas = 0;  // Créditos no extrato
  let bancoSaidas = 0;    // Débitos no extrato

  for (const tx of extrato || []) {
    const valor = Math.abs(parseFloat(tx.amount));
    if (tx.transaction_type === 'credit') {
      bancoEntradas += valor;
    } else {
      bancoSaidas += valor;
    }
  }

  // 2. RAZÃO BANCO SICREDI (1.1.1.05)
  const { data: contaSicredi } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  const { data: razao } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, entry:accounting_entries!inner(entry_date)')
    .eq('account_id', contaSicredi.id);

  const razaoJan = (razao || []).filter(i => {
    const d = i.entry?.entry_date;
    return d >= '2025-01-01' && d <= '2025-01-31';
  });

  let contabilDebitos = 0;   // Entradas na contabilidade
  let contabilCreditos = 0;  // Saídas na contabilidade

  for (const item of razaoJan) {
    contabilDebitos += parseFloat(item.debit) || 0;
    contabilCreditos += parseFloat(item.credit) || 0;
  }

  // 3. COMPARAÇÃO
  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│                           EXTRATO BANCÁRIO                              │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Entradas (créditos):    R$ ${bancoEntradas.toFixed(2).padStart(15)}                        │`);
  console.log(`│  Saídas (débitos):       R$ ${bancoSaidas.toFixed(2).padStart(15)}                        │`);
  console.log(`│  Movimento líquido:      R$ ${(bancoEntradas - bancoSaidas).toFixed(2).padStart(15)}                        │`);
  console.log(`│  Qtd transações:         ${String(extrato?.length || 0).padStart(18)}                        │`);
  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│                        CONTABILIDADE (Razão 1.1.1.05)                   │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Débitos (entradas):     R$ ${contabilDebitos.toFixed(2).padStart(15)}                        │`);
  console.log(`│  Créditos (saídas):      R$ ${contabilCreditos.toFixed(2).padStart(15)}                        │`);
  console.log(`│  Movimento líquido:      R$ ${(contabilDebitos - contabilCreditos).toFixed(2).padStart(15)}                        │`);
  console.log(`│  Qtd lançamentos:        ${String(razaoJan.length).padStart(18)}                        │`);
  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // 4. DIFERENÇAS
  const difEntradas = bancoEntradas - contabilDebitos;
  const difSaidas = bancoSaidas - contabilCreditos;

  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│                              DIFERENÇAS                                 │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');

  const statusEntradas = Math.abs(difEntradas) < 0.01 ? '✅ OK' : '❌ ERRO';
  const statusSaidas = Math.abs(difSaidas) < 0.01 ? '✅ OK' : '❌ ERRO';

  console.log(`│  Entradas: ${statusEntradas}                                                        │`);
  console.log(`│    Banco:        R$ ${bancoEntradas.toFixed(2).padStart(15)}                              │`);
  console.log(`│    Contabil:     R$ ${contabilDebitos.toFixed(2).padStart(15)}                              │`);
  console.log(`│    Diferença:    R$ ${difEntradas.toFixed(2).padStart(15)}                              │`);
  console.log('│                                                                         │');
  console.log(`│  Saídas: ${statusSaidas}                                                          │`);
  console.log(`│    Banco:        R$ ${bancoSaidas.toFixed(2).padStart(15)}                              │`);
  console.log(`│    Contabil:     R$ ${contabilCreditos.toFixed(2).padStart(15)}                              │`);
  console.log(`│    Diferença:    R$ ${difSaidas.toFixed(2).padStart(15)}                              │`);
  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log('');

  // 5. SE HÁ DIFERENÇA, MOSTRAR DETALHES
  if (Math.abs(difSaidas) > 0.01) {
    console.log('═'.repeat(100));
    console.log('ANÁLISE DA DIFERENÇA NAS SAÍDAS: R$ ' + Math.abs(difSaidas).toFixed(2));
    console.log('═'.repeat(100));
    console.log('');
    console.log('A contabilidade tem R$ ' + Math.abs(difSaidas).toFixed(2) + ' a MAIS de saídas que o extrato.');
    console.log('Isso indica LANÇAMENTOS DUPLICADOS ou ENTRIES SEM TRANSAÇÃO BANCÁRIA.');
    console.log('');

    // Buscar entries que creditam o banco mas não têm transação correspondente
    const { data: razaoCompleto } = await supabase
      .from('accounting_entry_items')
      .select(`
        id, debit, credit,
        entry:accounting_entries!inner(id, entry_date, description, entry_type, reference_type, reference_id)
      `)
      .eq('account_id', contaSicredi.id)
      .gt('credit', 0);

    const creditosJan = (razaoCompleto || []).filter(i => {
      const d = i.entry?.entry_date;
      return d >= '2025-01-01' && d <= '2025-01-31';
    });

    // IDs das transações do extrato
    const extratoIds = new Set((extrato || []).map(t => t.id));

    // Encontrar créditos sem transação
    const creditosSemTx = creditosJan.filter(item => {
      const refType = item.entry?.reference_type;
      const refId = item.entry?.reference_id;
      return refType !== 'bank_transaction' || !refId || !extratoIds.has(refId);
    });

    let totalSemTx = 0;
    for (const item of creditosSemTx) {
      totalSemTx += parseFloat(item.credit) || 0;
    }

    console.log(`Lançamentos que CREDITAM o banco SEM transação bancária vinculada:`);
    console.log(`Total: ${creditosSemTx.length} lançamentos = R$ ${totalSemTx.toFixed(2)}`);
    console.log('');

    // Agrupar por entry_type
    const porTipo = {};
    for (const item of creditosSemTx) {
      const tipo = item.entry?.entry_type || 'SEM_TIPO';
      if (!porTipo[tipo]) porTipo[tipo] = { count: 0, valor: 0 };
      porTipo[tipo].count++;
      porTipo[tipo].valor += parseFloat(item.credit) || 0;
    }

    console.log('Por tipo:');
    console.log('-'.repeat(80));
    for (const [tipo, dados] of Object.entries(porTipo).sort((a, b) => b[1].valor - a[1].valor)) {
      console.log(`  ${tipo.padEnd(35)} ${String(dados.count).padStart(3)} lanç  R$ ${dados.valor.toFixed(2).padStart(12)}`);
    }
  }

  if (Math.abs(difEntradas) > 0.01) {
    console.log('');
    console.log('═'.repeat(100));
    console.log('ANÁLISE DA DIFERENÇA NAS ENTRADAS: R$ ' + Math.abs(difEntradas).toFixed(2));
    console.log('═'.repeat(100));
    // Similar analysis for entradas if needed
  }

  // 6. RESUMO FINAL
  console.log('');
  console.log('═'.repeat(100));
  console.log('RESUMO FINAL');
  console.log('═'.repeat(100));

  if (Math.abs(difEntradas) < 0.01 && Math.abs(difSaidas) < 0.01) {
    console.log('✅ BANCO E CONTABILIDADE ESTÃO BATENDO PERFEITAMENTE!');
  } else {
    console.log('❌ HÁ DIFERENÇAS QUE PRECISAM SER CORRIGIDAS:');
    if (Math.abs(difEntradas) > 0.01) {
      console.log(`   - Entradas: Diferença de R$ ${difEntradas.toFixed(2)}`);
    }
    if (Math.abs(difSaidas) > 0.01) {
      console.log(`   - Saídas: Diferença de R$ ${difSaidas.toFixed(2)}`);
      console.log('');
      console.log('   AÇÃO NECESSÁRIA: Remover lançamentos duplicados ou vincular corretamente');
    }
  }
}

main().catch(console.error);
