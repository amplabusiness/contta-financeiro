/**
 * Cadastrar ex-cliente Emília Gonçalves Basílio
 * CNPJ: 24.799.541/0001-90
 *
 * Era cliente ativa em janeiro/2025, será suspensa posteriormente
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('═'.repeat(80));
  console.log('CADASTRO DE CLIENTE - EMÍLIA GONÇALVES BASÍLIO');
  console.log('═'.repeat(80));

  // Verificar se já existe
  const { data: existente } = await supabase
    .from('clients')
    .select('id, name, cnpj, status')
    .or('cnpj.eq.24799541000190,name.ilike.%EMILIA%BASILIO%')
    .maybeSingle();

  if (existente) {
    console.log('\n⚠️  Cliente já cadastrada:');
    console.log(`   ID: ${existente.id}`);
    console.log(`   Nome: ${existente.name}`);
    console.log(`   CNPJ: ${existente.cnpj}`);
    console.log(`   Status: ${existente.status}`);
    return;
  }

  // Cadastrar
  const { data: novoCliente, error } = await supabase
    .from('clients')
    .insert({
      name: 'EMILIA GONCALVES BASILIO',
      cnpj: '24799541000190',
      status: 'active', // Ativa em janeiro/2025, será suspensa depois
      is_active: true,
      contract_start_date: '2024-01-01', // Data aproximada
      notes: 'Ex-cliente. Ativa em janeiro/2025 para receber honorários. Será suspensa posteriormente.'
    })
    .select()
    .single();

  if (error) {
    console.log(`\n❌ Erro ao cadastrar: ${error.message}`);
    return;
  }

  console.log('\n✅ Cliente cadastrada com sucesso:');
  console.log(`   ID: ${novoCliente.id}`);
  console.log(`   Nome: ${novoCliente.name}`);
  console.log(`   CNPJ: ${novoCliente.cnpj}`);
  console.log(`   Status: ${novoCliente.status}`);

  console.log('\n═'.repeat(80));
  console.log('💡 Lembre-se de suspender a cliente após o processamento de janeiro/2025');
  console.log('═'.repeat(80));
}

main().catch(console.error);
