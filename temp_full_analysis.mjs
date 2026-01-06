import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';
const CNPJA_API_KEY = '8b61c942-a427-4543-900d-622d8160bd24-ffa12ab7-e121-4583-ae7d-767f421bf6cb';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function fetchCNPJA(cnpj) {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return null;

  const url = `https://api.cnpja.com/office/${cleanCnpj}?simples=true`;

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': CNPJA_API_KEY }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function analyze() {
  // Buscar todos os clientes com CNPJ válido
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, cnpj, monthly_fee')
    .not('cnpj', 'is', null)
    .order('name');

  // Filtrar apenas CNPJs válidos (14 dígitos)
  const validClients = clients?.filter(c => {
    const clean = c.cnpj?.replace(/\D/g, '');
    return clean && clean.length === 14;
  }) || [];

  console.log(`Total de clientes com CNPJ válido: ${validClients.length}`);
  console.log('Buscando sócios na API CNPJA... (isso pode demorar alguns minutos)\n');

  const allPartners = new Map(); // CPF -> { name, companies: [{id, name, fee}] }
  let processed = 0;
  let errors = 0;

  for (const client of validClients) {
    processed++;
    process.stdout.write(`\r[${processed}/${validClients.length}] ${client.name.substring(0, 40).padEnd(40)}...`);

    const data = await fetchCNPJA(client.cnpj);

    if (data?.company?.members) {
      for (const member of data.company.members) {
        // Pegar CPF completo ou parcial
        const cpf = member.person?.taxId || member.company?.taxId;
        const name = member.person?.name || member.company?.name;

        if (cpf && name) {
          // Usar os últimos 8 dígitos como chave (parte visível do CPF mascarado)
          const cpfKey = cpf.replace(/\D/g, '').slice(-8);

          if (!allPartners.has(cpfKey)) {
            allPartners.set(cpfKey, { name, cpfFull: cpf, companies: [] });
          }

          // Evitar duplicatas
          const existing = allPartners.get(cpfKey);
          if (!existing.companies.find(c => c.id === client.id)) {
            existing.companies.push({
              id: client.id,
              name: client.name,
              fee: client.monthly_fee || 0
            });
          }

          // Salvar no banco
          const { data: existingPartner } = await supabase
            .from('client_partners')
            .select('id')
            .eq('client_id', client.id)
            .ilike('name', name)
            .single();

          if (!existingPartner) {
            await supabase.from('client_partners').insert({
              client_id: client.id,
              name: name,
              cpf: cpf,
              partner_type: 'individual'
            });
          }
        }
      }
    } else {
      errors++;
    }

    // Delay para não sobrecarregar API (300ms)
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n\nProcessados: ${processed} | Erros/Não encontrados: ${errors}`);

  // Encontrar sócios em comum (presente em 2+ empresas)
  console.log('\n========================================');
  console.log('GRUPOS ECONÔMICOS POR SÓCIOS EM COMUM');
  console.log('========================================');

  const groups = [];
  const processedCompanies = new Set();

  for (const [cpfKey, data] of allPartners.entries()) {
    if (data.companies.length >= 2) {
      // Verificar se alguma empresa deste grupo já foi processada
      const newCompanies = data.companies.filter(c => !processedCompanies.has(c.id));

      if (newCompanies.length >= 2 || (newCompanies.length >= 1 && data.companies.length >= 2)) {
        // Marcar todas as empresas como processadas
        data.companies.forEach(c => processedCompanies.add(c.id));

        groups.push({
          partner: data.name,
          cpf: data.cpfFull,
          companies: data.companies
        });
      }
    }
  }

  // Consolidar grupos (empresas que compartilham múltiplos sócios)
  const consolidatedGroups = new Map();

  for (const group of groups) {
    // Criar chave baseada nos IDs das empresas
    const companyIds = group.companies.map(c => c.id).sort().join('|');

    if (!consolidatedGroups.has(companyIds)) {
      consolidatedGroups.set(companyIds, {
        partners: [{ name: group.partner, cpf: group.cpf }],
        companies: group.companies
      });
    } else {
      consolidatedGroups.get(companyIds).partners.push({ name: group.partner, cpf: group.cpf });
    }
  }

  // Imprimir resultados
  let groupNum = 0;
  for (const [key, data] of consolidatedGroups.entries()) {
    groupNum++;
    const totalFee = data.companies.reduce((sum, c) => sum + c.fee, 0);

    console.log(`\n--- GRUPO ${groupNum} (${data.companies.length} empresas) ---`);
    console.log(`Honorário Total: R$ ${totalFee.toFixed(2)}`);
    console.log(`Sócio(s) em comum:`);
    data.partners.forEach(p => console.log(`  - ${p.name} (${p.cpf})`));
    console.log(`Empresas:`);
    data.companies.forEach(c => console.log(`  - ${c.name} | R$ ${c.fee.toFixed(2)}`));
  }

  console.log('\n========================================');
  console.log(`TOTAL: ${consolidatedGroups.size} grupos identificados por sócios em comum`);
  console.log('========================================');

  // Exportar para JSON
  const exportData = [];
  for (const [key, data] of consolidatedGroups.entries()) {
    exportData.push({
      partners: data.partners,
      companies: data.companies,
      totalFee: data.companies.reduce((sum, c) => sum + c.fee, 0)
    });
  }

  const fs = await import('fs');
  fs.writeFileSync('grupos_economicos_por_socios.json', JSON.stringify(exportData, null, 2));
  console.log('\nDados exportados para: grupos_economicos_por_socios.json');
}

analyze().catch(console.error);
