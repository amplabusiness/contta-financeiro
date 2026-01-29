/**
 * CLASSIFICAR TARIFAS BANCÁRIAS DO SICREDI
 *
 * Regras de classificação:
 * - MANUTENCAO DE TITULOS → 4.1.3.02.01
 * - TARIFA COM R LIQUIDACAO → 4.1.3.02.02
 * - CESTA DE RELACIONAMENTO → 4.1.3.02.03
 * - LIQ.COBRANCA SIMPLES → 4.1.3.02.04
 * - Outras tarifas → 4.1.3.02.99
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODO = process.argv[2] || 'simulacao';

// Regras de classificação
// ATENÇÃO: LIQ.COBRANCA SIMPLES NÃO é tarifa - é recebimento de cliente!
const REGRAS = [
  { pattern: /MANUTENCAO DE TITULOS/i, conta: '4.1.3.02.01' },
  { pattern: /TARIFA COM R LIQUIDACAO/i, conta: '4.1.3.02.02' },
  { pattern: /CESTA DE RELACIONAMENTO/i, conta: '4.1.3.02.03' },
  { pattern: /TARIFA/i, conta: '4.1.3.02.99' }, // fallback para outras tarifas
];

// Padrões a IGNORAR (não são tarifas)
const IGNORAR = [
  /LIQ\.?COBRANCA/i, // Liquidação de cobrança = recebimento de cliente
];

async function main() {
  console.log('═'.repeat(80));
  console.log('CLASSIFICAR TARIFAS BANCÁRIAS DO SICREDI');
  console.log(`Modo: ${MODO.toUpperCase()}`);
  console.log('═'.repeat(80));

  // 1. Buscar conta do Banco Sicredi (contrapartida)
  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.1.05')
    .single();

  if (!contaBanco) {
    console.log('❌ Conta do Banco Sicredi (1.1.1.05) não encontrada');
    return;
  }

  // 2. Carregar IDs das contas de tarifa
  const contaIds = {};
  for (const regra of REGRAS) {
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', regra.conta)
      .single();

    if (data) {
      contaIds[regra.conta] = data.id;
      console.log(`📌 ${regra.conta} - ${data.name}`);
    }
  }

  // 3. Buscar transações pendentes de janeiro 2025
  // Tarifas são transações com descrição específica (EXCETO LIQ.COBRANCA que é recebimento)
  const { data: transacoes } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, status')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .eq('status', 'pending')
    .or('description.ilike.%TARIFA%,description.ilike.%MANUTENCAO DE TITULOS%,description.ilike.%CESTA DE RELACIONAMENTO%')
    .order('transaction_date');

  console.log(`\n📊 Transações de tarifas pendentes: ${transacoes?.length || 0}`);

  if (!transacoes || transacoes.length === 0) {
    console.log('✅ Nenhuma tarifa pendente encontrada');
    return;
  }

  let classificados = 0;
  let total = 0;

  for (const tx of transacoes) {
    const valor = Math.abs(Number(tx.amount));
    total += valor;

    // Identificar conta
    let contaCodigo = '4.1.3.02.99'; // default
    for (const regra of REGRAS) {
      if (regra.pattern.test(tx.description)) {
        contaCodigo = regra.conta;
        break;
      }
    }

    const contaId = contaIds[contaCodigo];

    console.log(`\n[${tx.transaction_date}] ${tx.description?.substring(0, 50)}`);
    console.log(`   Valor: R$ ${valor.toFixed(2)} → ${contaCodigo}`);

    if (MODO === 'aplicar' && contaId) {
      // Criar entry contábil
      const { data: entry, error: entryError } = await supabase
        .from('accounting_entries')
        .insert({
          entry_date: tx.transaction_date,
          competence_date: tx.transaction_date,
          description: tx.description,
          entry_type: 'DESPESA_BANCARIA'
        })
        .select()
        .single();

      if (entryError) {
        console.log(`   ❌ Erro entry: ${entryError.message}`);
        continue;
      }

      // Criar items (D: Despesa, C: Banco)
      const { error: itemsError } = await supabase
        .from('accounting_entry_items')
        .insert([
          { entry_id: entry.id, account_id: contaId, debit: valor, credit: 0 },
          { entry_id: entry.id, account_id: contaBanco.id, debit: 0, credit: valor }
        ]);

      if (itemsError) {
        console.log(`   ❌ Erro items: ${itemsError.message}`);
        continue;
      }

      // Marcar transação como reconciliada
      const { error: txError } = await supabase
        .from('bank_transactions')
        .update({
          status: 'reconciled',
          journal_entry_id: entry.id
        })
        .eq('id', tx.id);

      if (txError) {
        console.log(`   ❌ Erro tx: ${txError.message}`);
      } else {
        console.log(`   ✅ Classificado`);
        classificados++;
      }
    } else {
      classificados++;
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('RESUMO');
  console.log('═'.repeat(80));
  console.log(`Total transações: ${transacoes.length}`);
  console.log(`Total valor: R$ ${total.toFixed(2)}`);
  console.log(`${MODO === 'aplicar' ? 'Classificados' : 'A classificar'}: ${classificados}`);

  if (MODO === 'simulacao') {
    console.log('\n💡 Para aplicar, execute:');
    console.log('   node scripts/classificar_tarifas_sicredi.mjs aplicar');
  }
  console.log('═'.repeat(80));
}

main().catch(console.error);
