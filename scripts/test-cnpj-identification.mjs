// Script para testar identificação de clientes por CNPJ e grupos econômicos
// Usando fetch direto para ter mais controle sobre headers

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

async function callDrCicero(action, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/dr-cicero-contador`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ action, ...body }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

// Casos de teste - descrições reais de transações PIX
const testCases = [
  // Caso 1: A.I EMPREENDIMENTOS - CNPJ 28792279000102
  'PIX RECEBIDO - 28792279000102 A.I EMPREENDIMENTOS',
  'PIX CRED SICREDI 28792279000102',

  // Caso 2: CNPJ formatado
  'PIX RECEBIDO 28.792.279/0001-02 AI EMPREENDIMENTOS',

  // Caso 3: Outro cliente qualquer
  'PIX RECEBIDO 02022739000120 ADMIR ALVES',

  // Caso 4: Sem CNPJ (deve usar busca por nome)
  'PIX RECEBIDO ISABELA CESARIO DANTAS',
];

async function testIdentificationByCnpj() {
  console.log('=== Testando Identificação por CNPJ e Grupos Econômicos ===\n');

  // Testar cada caso
  for (const description of testCases) {
    console.log('─'.repeat(70));
    console.log(`🔍 Testando: "${description}"`);
    console.log('─'.repeat(70));

    try {
      // Testar action identify_client_by_cnpj
      console.log('\n📌 Action: identify_client_by_cnpj');
      const cnpjResult = await callDrCicero('identify_client_by_cnpj', { description });

      if (cnpjResult.found) {
        console.log(`✅ ENCONTRADO pelo CNPJ!`);
        console.log(`   Cliente: ${cnpjResult.client_nome_fantasia || cnpjResult.client_name}`);
        console.log(`   CNPJ: ${cnpjResult.cnpj}`);
        console.log(`   Honorário mensal: R$ ${cnpjResult.monthly_fee?.toFixed(2) || '0.00'}`);

        if (cnpjResult.has_economic_group && cnpjResult.economic_group) {
          console.log(`\n   🏢 GRUPO ECONÔMICO: ${cnpjResult.economic_group.name}`);
          console.log(`   É pagador principal: ${cnpjResult.economic_group.is_main_payer ? 'SIM' : 'NÃO'}`);
          console.log(`   Total do grupo: R$ ${cnpjResult.economic_group.total_fee?.toFixed(2) || '0.00'}`);
          console.log(`   Membros (${cnpjResult.economic_group.members.length}):`);
          cnpjResult.economic_group.members.forEach((m, i) => {
            console.log(`      ${i + 1}. ${m.client_name} | CNPJ: ${m.client_cnpj} | R$ ${m.monthly_fee?.toFixed(2) || '0.00'}`);
          });
        } else if (cnpjResult.related_companies && cnpjResult.related_companies.length > 0) {
          console.log(`\n   🔗 EMPRESAS RELACIONADAS (${cnpjResult.related_companies.length}):`);
          cnpjResult.related_companies.forEach((r, i) => {
            console.log(`      ${i + 1}. ${r.client_name} | ${r.relationship}`);
          });
        } else {
          console.log(`\n   ℹ️ Cliente sem grupo econômico`);
        }

        console.log(`\n   📝 ${cnpjResult.reasoning}`);
      } else {
        console.log(`❌ NÃO ENCONTRADO pelo CNPJ`);
        console.log(`   ${cnpjResult.reasoning}`);

        // Tentar busca por nome
        console.log('\n📌 Tentando busca por nome (identify_payer_by_name)...');
        const nameResult = await callDrCicero('identify_payer_by_name', { description });

        if (nameResult.found) {
          console.log(`✅ ENCONTRADO pelo nome!`);
          console.log(`   Pagador: ${nameResult.payer_name}`);
          console.log(`   Cliente: ${nameResult.client_name}`);
          console.log(`   Relação: ${nameResult.relationship}`);
          console.log(`   Confiança: ${(nameResult.confidence * 100).toFixed(0)}%`);
        } else {
          console.log(`❌ Também não encontrado pelo nome`);
        }
      }
    } catch (err) {
      console.log(`❌ Erro: ${err.message}`);
    }

    console.log('\n');
  }
}

async function testGetEconomicGroupMembers() {
  console.log('=== Testando Busca de Membros de Grupo Econômico ===\n');

  // Buscar membros do grupo do cliente ADMIR (que está no Grupo 3)
  console.log('📌 Buscando grupo do cliente ADMIR DE OLIVEIRA ALVES...');

  try {
    const result = await callDrCicero('get_economic_group_members', {
      cnpj: '02022739000120'
    });

    console.log('Resultado:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.log(`❌ Erro: ${err.message}`);
  }
}

async function main() {
  await testIdentificationByCnpj();
  console.log('\n' + '='.repeat(70) + '\n');
  await testGetEconomicGroupMembers();
}

main().catch(console.error);
