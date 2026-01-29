// scripts/correcao_contabil/14_limpar_banco.mjs
// Limpa todas as tabelas transacionais mantendo cadastros

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function limparBanco() {
  console.log('='.repeat(70));
  console.log('LIMPEZA COMPLETA DO BANCO');
  console.log('='.repeat(70));

  // 1. Deletar bank_transactions em lotes
  console.log('\n1. Deletando bank_transactions...');
  let totalBankTx = 0;
  let continuar = true;

  while (continuar) {
    const { data: lote } = await supabase
      .from('bank_transactions')
      .select('id')
      .limit(500);

    if (!lote || lote.length === 0) {
      continuar = false;
      break;
    }

    const ids = lote.map(l => l.id);
    const { count } = await supabase
      .from('bank_transactions')
      .delete({ count: 'exact' })
      .in('id', ids);

    totalBankTx += count || 0;
    process.stdout.write('  ' + totalBankTx + ' deletados\r');
  }
  console.log('   Total deletado:', totalBankTx);

  // Verificar final
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICACAO FINAL');
  console.log('='.repeat(70));

  const tabelas = [
    'invoices',
    'accounting_entries',
    'accounting_entry_lines',
    'bank_transactions',
    'boleto_payments',
    'expenses'
  ];

  let tudoVazio = true;
  for (const tabela of tabelas) {
    const { count } = await supabase
      .from(tabela)
      .select('id', { count: 'exact' });

    const status = count === 0 ? 'VAZIA' : count + ' registros';
    if (count > 0) tudoVazio = false;
    console.log(tabela.padEnd(30), status);
  }

  // Verificar cadastros mantidos
  const { count: clientes } = await supabase
    .from('clients')
    .select('id', { count: 'exact' });
  console.log('\nclients (MANTIDO)'.padEnd(30), clientes);

  const { count: contas } = await supabase
    .from('chart_of_accounts')
    .select('id', { count: 'exact' });
  console.log('chart_of_accounts (MANTIDO)'.padEnd(30), contas);

  console.log('\n' + '='.repeat(70));
  if (tudoVazio) {
    console.log('BANCO LIMPO - PRONTO PARA NOVOS DADOS');
  } else {
    console.log('ATENCAO: Ainda ha registros em algumas tabelas');
  }
  console.log('='.repeat(70));
}

limparBanco().catch(console.error);
