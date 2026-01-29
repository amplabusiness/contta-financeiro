// scripts/importar_bank_transactions_jan2025.mjs
// Importa transações OFX para bank_transactions (para conciliação)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse OFX
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

    const data = dataRaw ? `${dataRaw.substring(0,4)}-${dataRaw.substring(4,6)}-${dataRaw.substring(6,8)}` : null;

    if (data && fitid) {
      transacoes.push({
        tipo,
        data,
        valor,
        fitid,
        memo
      });
    }
  }

  return transacoes;
}

async function main() {
  console.log('='.repeat(80));
  console.log('IMPORTAÇÃO BANK_TRANSACTIONS - JANEIRO 2025');
  console.log('='.repeat(80));

  // Buscar bank_account do Sicredi
  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('id, name')
    .ilike('name', '%sicredi%')
    .limit(1)
    .single();

  if (!bankAccount) {
    console.log('Conta bancária Sicredi não encontrada em bank_accounts');
    return;
  }

  console.log(`Conta bancária: ${bankAccount.id} - ${bankAccount.name}`);

  // Ler OFX
  const ofxPath = 'banco/jan 2025.ofx';
  const conteudo = readFileSync(ofxPath, 'latin1');
  const transacoes = parseOFX(conteudo);

  console.log(`Transações no OFX: ${transacoes.length}`);

  // Verificar quantas já existem
  const { count: existentes } = await supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('bank_account_id', bankAccount.id)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  console.log(`Transações existentes jan/2025: ${existentes}`);

  if (existentes > 0) {
    console.log('Já existem transações para janeiro 2025. Abortando.');
    return;
  }

  // Inserir transações
  let inseridas = 0;
  let erros = 0;

  for (const tx of transacoes) {
    const { error } = await supabase
      .from('bank_transactions')
      .insert({
        bank_account_id: bankAccount.id,
        transaction_date: tx.data,
        amount: tx.valor,
        description: tx.memo,
        fitid: tx.fitid,
        transaction_type: tx.valor > 0 ? 'credit' : 'debit',
        reconciled: false
      });

    if (error) {
      if (!error.message.includes('duplicate')) {
        console.log(`Erro: ${error.message}`);
        erros++;
      }
    } else {
      inseridas++;
    }
  }

  console.log(`\nInseridas: ${inseridas}`);
  console.log(`Erros: ${erros}`);

  // Verificar totais
  const { data: txJan } = await supabase
    .from('bank_transactions')
    .select('amount')
    .eq('bank_account_id', bankAccount.id)
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31');

  let creditos = 0, debitos = 0;
  for (const tx of txJan || []) {
    const val = Number(tx.amount || 0);
    if (val > 0) creditos += val;
    else debitos += Math.abs(val);
  }

  console.log(`\nTotais importados:`);
  console.log(`  Créditos: R$ ${creditos.toFixed(2)}`);
  console.log(`  Débitos: R$ ${debitos.toFixed(2)}`);
  console.log(`  Líquido: R$ ${(creditos - debitos).toFixed(2)}`);

  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);
