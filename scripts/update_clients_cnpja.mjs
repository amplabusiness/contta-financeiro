/**
 * Script para atualizar dados completos dos clientes via API CNPJA
 * Atualiza: endereço, natureza jurídica, porte, regime tributário, sócios, etc.
 *
 * Uso: node scripts/update_clients_cnpja.mjs
 */

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

    if (!response.ok) {
      console.log(`  API retornou ${response.status} para ${cleanCnpj}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.log(`  Erro na API: ${error.message}`);
    return null;
  }
}

function formatCnpj(cnpj) {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatCep(cep) {
  const clean = cep?.replace(/\D/g, '') || '';
  if (clean.length !== 8) return cep;
  return clean.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

async function updateClients() {
  console.log('='.repeat(70));
  console.log('ATUALIZAÇÃO DE DADOS DOS CLIENTES VIA API CNPJA');
  console.log('='.repeat(70));
  console.log('');

  // Buscar clientes ativos com CNPJ válido e dados incompletos
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, cnpj, logradouro, email, municipio, natureza_juridica')
    .eq('is_active', true)
    .not('cnpj', 'is', null)
    .order('name');

  if (error) {
    console.error('Erro ao buscar clientes:', error.message);
    return;
  }

  // Filtrar clientes com CNPJ válido
  const validClients = clients?.filter(c => {
    const clean = c.cnpj?.replace(/\D/g, '');
    return clean && clean.length === 14;
  }) || [];

  // Filtrar clientes com dados incompletos
  const incompleteClients = validClients.filter(c =>
    !c.logradouro || !c.municipio || !c.natureza_juridica
  );

  console.log(`Total de clientes ativos com CNPJ: ${validClients.length}`);
  console.log(`Clientes com dados incompletos: ${incompleteClients.length}`);
  console.log('');
  console.log('Iniciando atualização...');
  console.log('');

  let updated = 0;
  let errors = 0;
  let partnersAdded = 0;

  for (let i = 0; i < incompleteClients.length; i++) {
    const client = incompleteClients[i];
    process.stdout.write(`[${i + 1}/${incompleteClients.length}] ${client.name.substring(0, 40).padEnd(40)}...`);

    const data = await fetchCNPJA(client.cnpj);

    if (!data) {
      console.log(' ERRO');
      errors++;
      continue;
    }

    // Preparar dados para atualização
    const updateData = {};

    // Dados do endereço
    if (data.address) {
      if (!client.logradouro && data.address.street) {
        updateData.logradouro = data.address.street;
      }
      if (data.address.number) {
        updateData.numero = data.address.number;
      }
      if (data.address.details) {
        updateData.complemento = data.address.details;
      }
      if (data.address.district) {
        updateData.bairro = data.address.district;
      }
      if (data.address.city) {
        updateData.municipio = data.address.city;
      }
      if (data.address.state) {
        updateData.uf = data.address.state;
      }
      if (data.address.zip) {
        updateData.cep = formatCep(data.address.zip);
      }
    }

    // Dados da empresa
    if (data.company) {
      if (data.company.name) {
        updateData.razao_social = data.company.name;
      }
      if (data.company.nature?.text) {
        updateData.natureza_juridica = data.company.nature.text;
      }
      if (data.company.size?.text) {
        updateData.porte = data.company.size.text;
      }
      if (data.company.equity) {
        updateData.capital_social = data.company.equity;
      }
      if (data.founded) {
        updateData.data_abertura = data.founded;
      }
    }

    // Status cadastral
    if (data.status?.text) {
      updateData.situacao_cadastral = data.status.text;
    }

    // Atividade principal
    if (data.mainActivity?.text) {
      updateData.atividade_principal = data.mainActivity.text;
    }

    // Simples Nacional
    if (data.simples) {
      updateData.opcao_pelo_simples = data.simples.optant || false;
      if (data.simples.since) {
        updateData.data_opcao_simples = data.simples.since;
      }
      updateData.opcao_pelo_mei = data.simples.mei || false;
    }

    // Email e telefone
    if (data.emails && data.emails.length > 0 && !client.email) {
      updateData.email = data.emails[0].address;
    }
    if (data.phones && data.phones.length > 0) {
      const phone = data.phones[0];
      const phoneStr = `(${phone.area}) ${phone.number}`;
      if (!client.phone) {
        updateData.phone = phoneStr;
      }
    }

    // Atualizar cliente
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', client.id);

      if (updateError) {
        console.log(` ERRO: ${updateError.message}`);
        errors++;
      } else {
        updated++;
        console.log(` OK (${Object.keys(updateData).length} campos)`);
      }
    } else {
      console.log(' SEM ALTERAÇÕES');
    }

    // Processar sócios
    if (data.company?.members && data.company.members.length > 0) {
      for (const member of data.company.members) {
        const cpfOrCnpj = member.person?.taxId || member.company?.taxId;
        const name = member.person?.name || member.company?.name;
        const role = member.role?.text || 'Sócio';
        const since = member.since;

        if (cpfOrCnpj && name) {
          // Verificar se já existe
          const { data: existingPartner } = await supabase
            .from('client_partners')
            .select('id')
            .eq('client_id', client.id)
            .ilike('name', name)
            .single();

          if (!existingPartner) {
            const partnerType = member.person ? 'individual' : 'company';

            const { error: partnerError } = await supabase
              .from('client_partners')
              .insert({
                client_id: client.id,
                name: name,
                cpf: cpfOrCnpj,
                partner_type: partnerType,
                role: role,
                entry_date: since || null
              });

            if (!partnerError) {
              partnersAdded++;
            }
          }
        }
      }
    }

    // Delay para não sobrecarregar API (300ms)
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('RESUMO');
  console.log('='.repeat(70));
  console.log(`Clientes atualizados: ${updated}`);
  console.log(`Erros: ${errors}`);
  console.log(`Sócios adicionados: ${partnersAdded}`);
  console.log('='.repeat(70));
}

updateClients().catch(console.error);
