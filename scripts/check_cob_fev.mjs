import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  // Verificar bank_transactions de fevereiro - créditos
  const { data: txFev } = await supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, transaction_type')
    .gte('transaction_date', '2025-02-01')
    .lte('transaction_date', '2025-02-28')
    .eq('transaction_type', 'credit')
    .order('amount', { ascending: false })
    .limit(15);

  console.log('Top 15 Créditos em Fevereiro/2025:');
  console.log('─'.repeat(100));
  txFev?.forEach(t => {
    const valor = 'R$ ' + t.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12);
    console.log(`${t.transaction_date} | ${valor} | ${t.description.substring(0, 60)}`);
  });

  // Verificar boleto_payments de fevereiro
  const { data: boletosAgg } = await supabase
    .from('boleto_payments')
    .select('cob, data_extrato, valor_liquidado')
    .gte('data_liquidacao', '2025-02-01')
    .lte('data_liquidacao', '2025-02-28');

  // Agrupar por COB
  const porCob = {};
  boletosAgg?.forEach(b => {
    if (!porCob[b.cob]) porCob[b.cob] = { count: 0, data: b.data_extrato, total: 0 };
    porCob[b.cob].count++;
    porCob[b.cob].total += parseFloat(b.valor_liquidado) || 0;
  });

  console.log('\n\nBoletos liquidados em Fev/2025 por COB:');
  console.log('─'.repeat(60));
  Object.entries(porCob).sort((a, b) => b[1].total - a[1].total).forEach(([cob, info]) => {
    const total = 'R$ ' + info.total.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    console.log(`  ${cob}: ${info.count} boletos | ${total} | extrato: ${info.data}`);
  });

  // Verificar se existe transação correspondente no bank_transactions
  console.log('\n\nVerificando match COB x Bank Transactions:');
  console.log('─'.repeat(80));

  for (const [cob, info] of Object.entries(porCob)) {
    const { data: match } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, description, amount')
      .ilike('description', `%${cob}%`)
      .limit(1);

    if (match && match.length > 0) {
      console.log(`✓ ${cob} -> ENCONTRADO: ${match[0].description.substring(0, 50)}`);
    } else {
      console.log(`✗ ${cob} -> NÃO encontrado no bank_transactions`);
    }
  }
}

check();
