// Executar SQL de importação de boletos via Supabase API
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
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     IMPORTANDO BOLETO PAYMENTS VIA SUPABASE API              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Ler dados parseados
  const parsed = JSON.parse(fs.readFileSync('./_baixa_clientes_parsed.json'));
  
  console.log(`📦 Total de registros: ${parsed.length}\n`);

  // 1. Verificar se tabela existe (tentar inserir e ver o erro)
  console.log('1️⃣  Verificando/criando tabela boleto_payments...');
  
  // Tentar criar via insert de teste
  const { error: testError } = await supabase
    .from('boleto_payments')
    .select('id')
    .limit(1);
  
  if (testError && testError.code === '42P01') {
    console.log('   ⚠️  Tabela não existe. Execute o SQL abaixo no Supabase Dashboard:\n');
    console.log('   https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new\n');
    console.log('   --- SQL para criar tabela ---');
    console.log(`
CREATE TABLE IF NOT EXISTS boleto_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id UUID REFERENCES bank_transactions(id),
  client_id UUID REFERENCES clients(id),
  invoice_id UUID REFERENCES invoices(id),
  cob VARCHAR(20),
  nosso_numero VARCHAR(50),
  data_vencimento DATE,
  data_liquidacao DATE,
  data_extrato DATE,
  valor_original DECIMAL(15,2),
  valor_liquidado DECIMAL(15,2),
  juros DECIMAL(15,2) DEFAULT 0,
  multa DECIMAL(15,2) DEFAULT 0,
  desconto DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nosso_numero)
);

CREATE INDEX IF NOT EXISTS idx_boleto_payments_bank_tx ON boleto_payments(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_client ON boleto_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_cob ON boleto_payments(cob);
CREATE INDEX IF NOT EXISTS idx_boleto_payments_data_extrato ON boleto_payments(data_extrato);
    `);
    console.log('\n   Após criar a tabela, execute este script novamente.');
    return;
  }
  
  console.log('   ✅ Tabela existe\n');

  // 2. Limpar registros existentes
  console.log('2️⃣  Limpando registros existentes...');
  const { error: deleteError } = await supabase
    .from('boleto_payments')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all
  
  if (deleteError) {
    console.log('   ⚠️  Erro ao limpar:', deleteError.message);
  } else {
    console.log('   ✅ Tabela limpa\n');
  }

  // 3. Inserir registros em lotes
  console.log('3️⃣  Inserindo registros...');
  
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;
  
  for (let i = 0; i < parsed.length; i += batchSize) {
    const batch = parsed.slice(i, i + batchSize).map(r => ({
      bank_transaction_id: r.bank_transaction_id || null,
      client_id: r.client_id || null,
      cob: r.cob,
      nosso_numero: r.nosso_numero,
      data_vencimento: r.data_vencimento || null,
      data_liquidacao: r.data_liquidacao || null,
      data_extrato: r.data_extrato || null,
      valor_original: r.valor_original || 0,
      valor_liquidado: r.valor_liquidado || 0
    }));
    
    const { error } = await supabase
      .from('boleto_payments')
      .insert(batch);
    
    if (error) {
      errors += batch.length;
      if (errors <= 3) {
        console.log(`   ⚠️  Erro no lote ${Math.floor(i/batchSize) + 1}: ${error.message}`);
      }
    } else {
      inserted += batch.length;
    }
    
    process.stdout.write(`\r   Progresso: ${Math.min(i + batchSize, parsed.length)}/${parsed.length} (${Math.round(Math.min(i + batchSize, parsed.length)/parsed.length*100)}%)`);
  }
  
  console.log(`\n   ✅ Inseridos: ${inserted} | ⚠️  Erros: ${errors}\n`);

  // 4. Atualizar has_multiple_matches nas transações
  console.log('4️⃣  Atualizando flag has_multiple_matches...');
  
  // Buscar transações com múltiplos boletos
  const { data: txIds } = await supabase
    .from('boleto_payments')
    .select('bank_transaction_id')
    .not('bank_transaction_id', 'is', null);
  
  const uniqueTxIds = [...new Set(txIds?.map(t => t.bank_transaction_id) || [])];
  
  let updated = 0;
  for (const txId of uniqueTxIds) {
    const { error } = await supabase
      .from('bank_transactions')
      .update({ has_multiple_matches: true })
      .eq('id', txId);
    if (!error) updated++;
  }
  
  console.log(`   ✅ ${updated} transações atualizadas\n`);

  // 5. Verificar resultado
  console.log('5️⃣  Verificando resultado...');
  
  const { data: stats } = await supabase
    .from('boleto_payments')
    .select('*');
  
  const totalBoletos = stats?.length || 0;
  const clientesDistintos = new Set(stats?.map(s => s.client_id).filter(Boolean)).size;
  const transacoesVinculadas = new Set(stats?.map(s => s.bank_transaction_id).filter(Boolean)).size;
  const valorTotal = stats?.reduce((s, r) => s + parseFloat(r.valor_liquidado || 0), 0) || 0;
  
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    IMPORTAÇÃO CONCLUÍDA                      ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total de boletos:           ${String(totalBoletos).padStart(8)}                     ║`);
  console.log(`║  Clientes distintos:         ${String(clientesDistintos).padStart(8)}                     ║`);
  console.log(`║  Transações vinculadas:      ${String(transacoesVinculadas).padStart(8)}                     ║`);
  console.log(`║  Valor total:           R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}                ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

main();
