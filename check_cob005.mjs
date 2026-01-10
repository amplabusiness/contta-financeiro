import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Primeiro, ver as colunas da tabela
  const { data: sample } = await supabase
    .from('bank_transactions')
    .select('*')
    .limit(1);

  if (sample?.[0]) {
    console.log('Colunas da tabela:', Object.keys(sample[0]).join(', '));
  }

  // Buscar todas as transações COB000005 no banco
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount')
    .ilike('description', '%COB000005%')
    .order('transaction_date', { ascending: true });

  if (error) {
    console.error('Erro:', error);
    return;
  }

  console.log('\n=== COB000005 no BANCO ===');
  data.forEach(t => {
    console.log(t.transaction_date + ' | R$ ' + t.amount.toFixed(2) + ' | ' + t.description.substring(0, 60));
  });

  console.log('');
  console.log('Total transações COB000005 no banco:', data.length);
  console.log('Soma:', data.reduce((s, t) => s + t.amount, 0).toFixed(2));

  // Buscar todos os COBs de janeiro
  console.log('\n=== TODOS OS COBs DE JANEIRO NO BANCO ===');
  const { data: jan } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount')
    .ilike('description', '%COB%')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .order('transaction_date', { ascending: true });

  jan.forEach(t => {
    // Extrair código COB
    const cobMatch = t.description.match(/COB\d+/);
    const cob = cobMatch ? cobMatch[0] : '???';
    console.log(t.transaction_date + ' | ' + cob.padEnd(10) + ' | R$ ' + t.amount.toFixed(2).padStart(10));
  });
  
  console.log('');
  console.log('Total COBs em janeiro:', jan.length);
  console.log('Soma:', jan.reduce((s, t) => s + t.amount, 0).toFixed(2));
}

main();
