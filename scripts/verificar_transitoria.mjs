// scripts/verificar_transitoria.mjs
// Verificar o que está na conta transitória
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CONTA_TRANSITORIA = '1.1.9.01';

async function main() {
  console.log('='.repeat(100));
  console.log('ANÁLISE DA CONTA TRANSITÓRIA');
  console.log('='.repeat(100));

  // Buscar conta transitória
  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_TRANSITORIA)
    .single();

  if (!contaTransitoria) {
    console.log('Conta transitória não encontrada!');
    return;
  }

  // Buscar todos os items na conta transitória
  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select(`
      id,
      debit,
      credit,
      history,
      entry_id,
      accounting_entries (
        id,
        entry_date,
        description,
        entry_type,
        internal_code
      )
    `)
    .eq('account_id', contaTransitoria.id)
    .order('entry_id', { ascending: true });

  let totalDebitos = 0;
  let totalCreditos = 0;

  // Agrupar por tipo
  const porTipo = {};
  const porData = {};

  for (const item of items || []) {
    const tipo = item.accounting_entries?.entry_type || 'DESCONHECIDO';
    const data = item.accounting_entries?.entry_date || 'SEM_DATA';

    if (!porTipo[tipo]) porTipo[tipo] = { debitos: 0, creditos: 0, count: 0 };
    porTipo[tipo].debitos += Number(item.debit || 0);
    porTipo[tipo].creditos += Number(item.credit || 0);
    porTipo[tipo].count++;

    if (!porData[data]) porData[data] = { debitos: 0, creditos: 0 };
    porData[data].debitos += Number(item.debit || 0);
    porData[data].creditos += Number(item.credit || 0);

    totalDebitos += Number(item.debit || 0);
    totalCreditos += Number(item.credit || 0);
  }

  console.log(`\n📊 Conta: ${contaTransitoria.code} - ${contaTransitoria.name}`);
  console.log(`   Total de items: ${items?.length || 0}`);
  console.log(`   Total débitos: R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Total créditos: R$ ${totalCreditos.toFixed(2)}`);
  console.log(`   Saldo: R$ ${(totalDebitos - totalCreditos).toFixed(2)}`);

  console.log('\n📋 Por tipo de lançamento:');
  for (const [tipo, valores] of Object.entries(porTipo).sort((a, b) => b[1].debitos - a[1].debitos)) {
    const saldo = valores.debitos - valores.creditos;
    console.log(`   ${tipo}: ${valores.count} items | D=${valores.debitos.toFixed(2)} C=${valores.creditos.toFixed(2)} | Saldo=${saldo.toFixed(2)}`);
  }

  // Listar os items de saída pendentes de classificação
  console.log('\n📋 Saídas pendentes de classificação (PIX/Boletos):');

  const saidasPendentes = (items || []).filter(i =>
    (i.accounting_entries?.entry_type === 'SAIDA_PENDENTE_CLASSIFICACAO' ||
     i.accounting_entries?.entry_type === 'PIX_ENVIADO' ||
     i.accounting_entries?.entry_type === 'BOLETO_PAGO') &&
    Number(i.debit || 0) > 0
  );

  // Agrupar por descrição similar
  const porDescricao = {};
  for (const item of saidasPendentes) {
    const desc = item.accounting_entries?.description || 'SEM DESCRICAO';
    // Extrair nome do beneficiário
    let beneficiario = desc.match(/PIX_DEB\s+\d+\s+([A-Za-zÀ-ú ]+)/)?.[1]?.trim() ||
                       desc.match(/LIQUIDACAO BOLETO.*?\d+\s+([A-Za-zÀ-ú ]+)/)?.[1]?.trim() ||
                       desc.substring(0, 50);

    if (!porDescricao[beneficiario]) {
      porDescricao[beneficiario] = { total: 0, items: [] };
    }
    porDescricao[beneficiario].total += Number(item.debit || 0);
    porDescricao[beneficiario].items.push({
      data: item.accounting_entries?.entry_date,
      valor: Number(item.debit || 0),
      descricao: desc.substring(0, 60)
    });
  }

  // Ordenar por total
  const beneficiariosSorted = Object.entries(porDescricao)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 30); // Top 30

  console.log('   (Top 30 por valor total)\n');
  for (const [benef, dados] of beneficiariosSorted) {
    console.log(`   ${benef.substring(0, 35).padEnd(35)} | R$ ${dados.total.toFixed(2).padStart(10)} (${dados.items.length}x)`);
  }

  console.log('\n' + '='.repeat(100));
}

main().catch(console.error);
