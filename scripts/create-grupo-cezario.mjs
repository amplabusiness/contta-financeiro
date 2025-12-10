// Script para criar Grupo Econômico Cezário
// A.I EMPREENDIMENTOS será o pagador principal

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createGrupoCezario() {
  console.log('=== Criando Grupo Econômico Cezário ===\n');

  // 1. Buscar A.I EMPREENDIMENTOS (será o pagador principal)
  console.log('1. Buscando A.I EMPREENDIMENTOS...');
  const { data: aiEmp, error: aiErr } = await supabase
    .from('clients')
    .select('id, name, nome_fantasia, cnpj, monthly_fee, qsa')
    .eq('cnpj', '28792279000102')
    .single();

  if (aiErr) {
    console.error('Erro ao buscar A.I EMPREENDIMENTOS:', aiErr.message);
    return;
  }

  if (!aiEmp) {
    console.error('A.I EMPREENDIMENTOS não encontrado!');
    return;
  }

  console.log('   ID:', aiEmp.id);
  console.log('   Nome:', aiEmp.name);

  // 2. Buscar empresas relacionadas (sócia: ISABELA DE MELO CESARIO DANTAS)
  console.log('\n2. Buscando empresas com sócios em comum...');

  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name, nome_fantasia, cnpj, monthly_fee, qsa')
    .not('qsa', 'is', null);

  // Filtrar por sócios em comum
  const relatedClients = [];
  const targetSocios = ['ISABELA', 'CESARIO', 'DANTAS'];

  for (const client of allClients || []) {
    if (client.id === aiEmp.id) continue;
    if (!client.qsa || !Array.isArray(client.qsa)) continue;

    for (const socio of client.qsa) {
      const nome = (socio.nome || socio.name || '').toUpperCase();
      const matches = targetSocios.filter(s => nome.includes(s));

      if (matches.length >= 2) {
        relatedClients.push({
          id: client.id,
          name: client.name,
          nome_fantasia: client.nome_fantasia,
          cnpj: client.cnpj,
          monthly_fee: client.monthly_fee || 0,
          socio_match: nome
        });
        break;
      }
    }
  }

  console.log('   Empresas relacionadas encontradas:', relatedClients.length);
  relatedClients.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.nome_fantasia || c.name} | Fee: R$ ${c.monthly_fee?.toFixed(2) || '0.00'}`);
  });

  // 3. Criar o grupo econômico
  console.log('\n3. Criando grupo econômico...');

  // Buscar um usuário válido para created_by
  const { data: users } = await supabase.auth.admin.listUsers();
  const createdBy = users?.users?.[0]?.id;
  console.log('   Created by user:', createdBy);

  const totalFee = relatedClients.reduce((sum, c) => sum + (c.monthly_fee || 0), 0);

  const { data: newGroup, error: groupErr } = await supabase
    .from('economic_groups')
    .insert({
      name: 'Grupo Cezário',
      group_name: 'Grupo Cezário',
      main_payer_client_id: aiEmp.id,
      total_monthly_fee: totalFee,
      payment_day: 10,
      is_active: true,
      consolidate_billing: true,
      consolidated_reports: true,
      description: 'Grupo de empresas da família Cezário/Dantas - A.I EMPREENDIMENTOS é o pagador principal',
      main_company_name: aiEmp.nome_fantasia || aiEmp.name,
      main_company_cnpj: aiEmp.cnpj,
      created_by: createdBy,
    })
    .select()
    .single();

  if (groupErr) {
    console.error('Erro ao criar grupo:', groupErr.message);
    return;
  }

  console.log('   Grupo criado! ID:', newGroup.id);
  console.log('   Nome:', newGroup.name);
  console.log('   Pagador principal:', newGroup.main_company_name);

  // 4. Adicionar empresas como membros do grupo
  console.log('\n4. Adicionando membros ao grupo...');

  for (const client of relatedClients) {
    const { error: memberErr } = await supabase
      .from('economic_group_members')
      .insert({
        economic_group_id: newGroup.id,
        client_id: client.id,
        company_name: client.nome_fantasia || client.name,
        cnpj: client.cnpj,
        individual_fee: client.monthly_fee || 0,
        is_active: true,
        relationship_type: 'Empresa do grupo',
      });

    if (memberErr) {
      console.log(`   ⚠️ Erro ao adicionar ${client.name}: ${memberErr.message}`);
    } else {
      console.log(`   ✅ Adicionado: ${client.nome_fantasia || client.name}`);
    }
  }

  console.log('\n=== Grupo Cezário criado com sucesso! ===');
  console.log('Total de empresas:', relatedClients.length);
  console.log('Total honorários: R$', totalFee.toFixed(2));
}

createGrupoCezario().catch(console.error);
