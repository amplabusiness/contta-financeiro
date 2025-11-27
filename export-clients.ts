import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// SCRIPT PARA EXPORTAR CNPJs DO BANCO ANTIGO

// 1. Configure as credenciais do banco ANTIGO (Lovable)
const LOVABLE_URL = 'https://nrodnjassdrvqtgfdodf.supabase.co';
const LOVABLE_KEY = 'COLE_A_ANON_KEY_DO_LOVABLE_AQUI';

const supabaseOld = createClient(LOVABLE_URL, LOVABLE_KEY);

async function exportClients() {
  console.log('🔄 Conectando ao banco antigo do Lovable...');
  
  const { data: clients, error } = await supabaseOld
    .from('clients')
    .select('id, name, cnpj, email, phone, monthly_fee, fee_due_day, is_active')
    .order('name');

  if (error) {
    console.error('❌ Erro ao exportar:', error);
    return;
  }

  console.log(`✅ ${clients.length} clientes encontrados!`);
  
  // Criar lista de CNPJs
  const cnpjList = clients
    .filter(c => c.cnpj)
    .map(c => ({
      cnpj: c.cnpj,
      name_original: c.name,
      monthly_fee: c.monthly_fee,
      fee_due_day: c.fee_due_day
    }));

  // Salvar em arquivo JSON
  fs.writeFileSync(
    'clientes_exportados.json',
    JSON.stringify(cnpjList, null, 2)
  );

  // Salvar em SQL para importação direta
  const sqlInserts = cnpjList.map(c => 
    `('${c.cnpj}', '${c.name_original.replace(/'/g, "''")}', ${c.monthly_fee}, ${c.fee_due_day})`
  ).join(',\n  ');

  const sql = `-- CNPJs exportados do banco antigo
-- Execute no novo banco após enriquecer com API

INSERT INTO clients (cnpj, name, monthly_fee, fee_due_day, is_active)
VALUES
  ${sqlInserts}
ON CONFLICT (cnpj) DO NOTHING;
`;

  fs.writeFileSync('clientes_para_importar.sql', sql);

  console.log('✅ Arquivos criados:');
  console.log('   - clientes_exportados.json');
  console.log('   - clientes_para_importar.sql');
  console.log(`\n📋 Total de CNPJs: ${cnpjList.length}`);
}

exportClients();
