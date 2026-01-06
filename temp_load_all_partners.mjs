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

  try {
    const response = await fetch(`https://api.cnpja.com/office/${cleanCnpj}?simples=true`, {
      headers: { 'Authorization': CNPJA_API_KEY }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

async function loadAllPartners() {
  // Buscar todos os clientes com CNPJ válido (14 dígitos)
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, cnpj, monthly_fee')
    .not('cnpj', 'is', null)
    .order('name');

  const validClients = clients?.filter(c => {
    const clean = c.cnpj?.replace(/\D/g, '');
    return clean && clean.length === 14;
  }) || [];

  console.log('========================================');
  console.log('CARGA DE SÓCIOS - API CNPJA');
  console.log('========================================');
  console.log(`Clientes com CNPJ válido: ${validClients.length}`);
  console.log('Iniciando busca... (delay de 350ms entre requisições)\n');

  let processed = 0;
  let found = 0;
  let partnersInserted = 0;
  const allPartners = new Map(); // Para análise de grupos

  for (const client of validClients) {
    processed++;
    const progress = ((processed / validClients.length) * 100).toFixed(1);
    process.stdout.write(`\r[${progress}%] ${processed}/${validClients.length} - ${client.name.substring(0, 35).padEnd(35)}`);

    const data = await fetchCNPJA(client.cnpj);

    if (data?.company?.members && data.company.members.length > 0) {
      found++;

      for (const member of data.company.members) {
        const cpf = member.person?.taxId || member.company?.taxId || null;
        const name = member.person?.name || member.company?.name || 'Desconhecido';
        const role = member.role?.text || '';
        const since = member.since || null;

        // Verificar se já existe
        const { data: existing } = await supabase
          .from('client_partners')
          .select('id')
          .eq('client_id', client.id)
          .ilike('name', name)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase.from('client_partners').insert({
            client_id: client.id,
            name: name,
            cpf: cpf,
            partner_type: role?.toLowerCase().includes('administrador') ? 'administrator' : 'individual',
            is_administrator: role?.toLowerCase().includes('administrador') || false,
            joined_date: since ? new Date(since) : null
          });

          if (!error) partnersInserted++;
        }

        // Guardar para análise de grupos
        if (cpf) {
          const cpfKey = cpf.replace(/\D/g, '').slice(-8);
          if (!allPartners.has(cpfKey)) {
            allPartners.set(cpfKey, { name, cpf, companies: [] });
          }
          const partnerData = allPartners.get(cpfKey);
          if (!partnerData.companies.find(c => c.id === client.id)) {
            partnerData.companies.push({
              id: client.id,
              name: client.name,
              cnpj: client.cnpj,
              fee: client.monthly_fee || 0
            });
          }
        }
      }
    }

    // Delay para não sobrecarregar API
    await new Promise(r => setTimeout(r, 350));
  }

  console.log('\n\n========================================');
  console.log('RESULTADO DA CARGA');
  console.log('========================================');
  console.log(`Clientes processados: ${processed}`);
  console.log(`Empresas com sócios encontrados: ${found}`);
  console.log(`Sócios inseridos no banco: ${partnersInserted}`);

  // Análise de grupos por sócios em comum
  console.log('\n========================================');
  console.log('GRUPOS ECONÔMICOS IDENTIFICADOS');
  console.log('(Sócios presentes em 2+ empresas)');
  console.log('========================================');

  const groups = [];
  for (const [cpfKey, data] of allPartners.entries()) {
    if (data.companies.length >= 2) {
      groups.push(data);
    }
  }

  // Ordenar por número de empresas
  groups.sort((a, b) => b.companies.length - a.companies.length);

  groups.forEach((g, i) => {
    const totalFee = g.companies.reduce((sum, c) => sum + c.fee, 0);
    console.log(`\n${i + 1}. ${g.name} (${g.cpf})`);
    console.log(`   Presente em ${g.companies.length} empresas | Total: R$ ${totalFee.toFixed(2)}`);
    g.companies.forEach(c => {
      console.log(`   - ${c.name} | R$ ${c.fee.toFixed(2)}`);
    });
  });

  console.log(`\n========================================`);
  console.log(`TOTAL: ${groups.length} sócios com participação em múltiplas empresas`);
  console.log(`========================================`);

  // Salvar análise em JSON
  const fs = await import('fs');
  fs.writeFileSync('analise_socios_grupos.json', JSON.stringify(groups, null, 2));
  console.log('\nAnálise salva em: analise_socios_grupos.json');
}

loadAllPartners().catch(console.error);
