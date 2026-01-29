/**
 * Criar items faltantes para honorários órfãos
 *
 * Lançamento contábil de honorários:
 * D - 1.1.2.01.XXXX (Conta analítica do cliente)  = valor
 * C - 3.1.1.01 (Receita de Honorários) = valor
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTA_RECEITA_HONORARIOS = '3.1.1.01'; // Receita de Honorários

const MODO = process.argv[2] || 'simulacao';

async function main() {
  console.log('═'.repeat(80));
  console.log('CRIAR ITEMS PARA HONORÁRIOS ÓRFÃOS');
  console.log(`Modo: ${MODO.toUpperCase()}`);
  console.log('═'.repeat(80));

  // 1. Buscar conta de receita
  const { data: contaReceita } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_RECEITA_HONORARIOS)
    .single();

  if (!contaReceita) {
    console.log(`❌ Conta de Receita (${CONTA_RECEITA_HONORARIOS}) não encontrada`);
    return;
  }

  console.log(`\n📌 Contas:
   D - Conta analítica do cliente (1.1.2.01.XXXX)
   C - ${contaReceita.code} ${contaReceita.name}`);

  // 2. Buscar honorários órfãos (entries sem items)
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .eq('entry_type', 'receita_honorarios')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const orfaos = [];

  for (const entry of entries || []) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('id')
      .eq('entry_id', entry.id);

    if (!items || items.length === 0) {
      orfaos.push(entry);
    }
  }

  console.log(`\n📊 Honorários órfãos: ${orfaos.length}`);

  if (orfaos.length === 0) {
    console.log('✅ Nenhum honorário órfão encontrado!');
    return;
  }

  // 3. Buscar valores dos honorários
  // O valor está na tabela de boletos ou na descrição
  let criados = 0;
  let erros = 0;

  for (const entry of orfaos) {
    // Extrair nome do cliente da descrição
    const match = entry.description?.match(/Honorários 2025-01 - (.+)/);
    const nomeCliente = match ? match[1] : entry.description;

    // Buscar cliente
    const { data: cliente } = await supabase
      .from('clients')
      .select('id, name, monthly_fee, accounting_account_id')
      .or(`name.ilike.%${nomeCliente?.substring(0, 20)}%`)
      .limit(1)
      .maybeSingle();

    const valor = cliente?.monthly_fee || 0;

    if (valor === 0) {
      console.log(`\n⚠️  ${nomeCliente?.substring(0, 40)} - Valor não encontrado`);
      erros++;
      continue;
    }

    // Buscar conta analítica do cliente
    let contaClienteId = cliente?.accounting_account_id;

    if (!contaClienteId) {
      // Tentar buscar conta pelo nome do cliente no plano de contas
      const nomeParaBusca = cliente?.name || nomeCliente;
      const { data: contaCliente } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .like('code', '1.1.2.01.%')
        .ilike('name', `%${nomeParaBusca?.substring(0, 15)}%`)
        .limit(1)
        .maybeSingle();

      contaClienteId = contaCliente?.id;
    }

    if (!contaClienteId) {
      console.log(`\n⚠️  ${nomeCliente?.substring(0, 40)} - Conta analítica não encontrada`);
      erros++;
      continue;
    }

    console.log(`\n[${entry.entry_date}] ${nomeCliente?.substring(0, 40)}`);
    console.log(`   Valor: R$ ${valor.toFixed(2)}`);

    if (MODO === 'aplicar') {
      // Criar items de débito e crédito
      const { error } = await supabase
        .from('accounting_entry_items')
        .insert([
          {
            entry_id: entry.id,
            account_id: contaClienteId,
            debit: valor,
            credit: 0
          },
          {
            entry_id: entry.id,
            account_id: contaReceita.id,
            debit: 0,
            credit: valor
          }
        ]);

      if (error) {
        console.log(`   ❌ Erro: ${error.message}`);
        erros++;
      } else {
        console.log(`   ✅ Items criados`);
        criados++;
      }
    } else {
      criados++;
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('RESUMO');
  console.log('═'.repeat(80));
  console.log(`Total órfãos: ${orfaos.length}`);
  console.log(`${MODO === 'aplicar' ? 'Criados' : 'A criar'}: ${criados}`);
  console.log(`Erros/sem valor: ${erros}`);

  if (MODO === 'simulacao') {
    console.log('\n💡 Para aplicar, execute:');
    console.log('   node scripts/criar_items_honorarios.mjs aplicar');
  }

  console.log('═'.repeat(80));
}

main().catch(console.error);
