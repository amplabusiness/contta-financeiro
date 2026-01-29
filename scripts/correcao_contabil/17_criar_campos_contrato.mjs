// scripts/correcao_contabil/17_criar_campos_contrato.mjs
// Cria os campos contract_start_date e contract_end_date na tabela clients
// usando a API SQL do Supabase

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarCampos() {
  console.log('='.repeat(80));
  console.log('CRIANDO CAMPOS DE CONTRATO NA TABELA CLIENTS');
  console.log('='.repeat(80));

  // Testar se os campos já existem
  const { data: teste, error: errTeste } = await supabase
    .from('clients')
    .select('id, contract_start_date, contract_end_date')
    .limit(1);

  if (!errTeste) {
    console.log('\nCampos já existem! Nada a fazer.');
    console.log('Teste:', teste);
    return;
  }

  console.log('\nCampos não existem. Executando SQL...');

  // SQL para criar os campos
  const sqlStatements = [
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_start_date DATE",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_end_date DATE",
    "ALTER TABLE clients ADD COLUMN IF NOT EXISTS inactivation_reason TEXT"
  ];

  console.log('\n' + '-'.repeat(80));
  console.log('SQL PARA EXECUTAR MANUALMENTE NO SUPABASE DASHBOARD:');
  console.log('-'.repeat(80));
  console.log(`
-- Acesse: https://supabase.com/dashboard > SQL Editor > New Query
-- Cole e execute:

ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS inactivation_reason TEXT;

-- Inicializar contract_start_date com opening_balance_date
UPDATE clients
SET contract_start_date = opening_balance_date::date
WHERE contract_start_date IS NULL
  AND opening_balance_date IS NOT NULL;

-- Para clientes sem opening_balance_date, usar created_at
UPDATE clients
SET contract_start_date = created_at::date
WHERE contract_start_date IS NULL;

-- Verificar resultado
SELECT COUNT(*) as total, COUNT(contract_start_date) as com_inicio FROM clients;
`);
  console.log('-'.repeat(80));

  // Tentar via RPC se existir
  try {
    // Algumas instalações do Supabase têm uma função exec_sql
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlStatements.join('; ')
    });

    if (!error) {
      console.log('\nSQL executado via RPC!');
    }
  } catch (e) {
    // Não tem RPC, precisa executar manualmente
  }

  console.log('\n' + '='.repeat(80));
}

criarCampos().catch(console.error);
