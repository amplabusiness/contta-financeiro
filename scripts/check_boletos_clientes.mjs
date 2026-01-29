import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  // Verificar estrutura da tabela boleto_payments
  console.log('📋 AMOSTRA DE BOLETO_PAYMENTS:');
  console.log('─'.repeat(100));

  const { data: boletos } = await supabase
    .from('boleto_payments')
    .select('*')
    .limit(5);

  if (boletos && boletos.length > 0) {
    console.log('Colunas disponíveis:', Object.keys(boletos[0]).join(', '));
    console.log('\n');
    boletos.forEach((b, i) => {
      console.log(`Boleto ${i + 1}:`);
      console.log(`  COB: ${b.cob}`);
      console.log(`  Nosso Número: ${b.nosso_numero}`);
      console.log(`  client_id: ${b.client_id}`);
      console.log(`  Valor: R$ ${b.valor_liquidado}`);
      console.log(`  Data Liquidação: ${b.data_liquidacao}`);
      // Verificar se tem campo de nome do cliente
      if (b.pagador) console.log(`  Pagador (campo): ${b.pagador}`);
      if (b.cliente_nome) console.log(`  Cliente Nome: ${b.cliente_nome}`);
      console.log('');
    });
  }

  // Contar boletos com e sem client_id
  const { count: comCliente } = await supabase
    .from('boleto_payments')
    .select('*', { count: 'exact', head: true })
    .not('client_id', 'is', null);

  const { count: semCliente } = await supabase
    .from('boleto_payments')
    .select('*', { count: 'exact', head: true })
    .is('client_id', null);

  const { count: total } = await supabase
    .from('boleto_payments')
    .select('*', { count: 'exact', head: true });

  console.log('\n📊 ESTATÍSTICAS DE VINCULAÇÃO:');
  console.log('─'.repeat(50));
  console.log(`  Total de boletos: ${total}`);
  console.log(`  Com client_id: ${comCliente} (${((comCliente / total) * 100).toFixed(1)}%)`);
  console.log(`  Sem client_id: ${semCliente} (${((semCliente / total) * 100).toFixed(1)}%)`);

  // Verificar se existe coluna de nome do pagador
  console.log('\n\n📋 VERIFICANDO COLUNAS ALTERNATIVAS...');

  // Pegar todas as colunas
  const { data: sample } = await supabase
    .from('boleto_payments')
    .select('*')
    .limit(1)
    .single();

  if (sample) {
    console.log('\nTodas as colunas da tabela boleto_payments:');
    for (const [key, value] of Object.entries(sample)) {
      console.log(`  ${key}: ${value}`);
    }
  }
}

check();
