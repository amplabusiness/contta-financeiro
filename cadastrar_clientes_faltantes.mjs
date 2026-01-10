/**
 * Script para cadastrar os 5 clientes faltantes via API CNPJA
 * AMADEU ARAUJO DA VEIGA é proprietário da Boa Vista Agropecuária (já cadastrada)
 * 
 * Uso: node cadastrar_clientes_faltantes.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';
const CNPJA_API_KEY = '8b61c942-a427-4543-900d-622d8160bd24-ffa12ab7-e121-4583-ae7d-767f421bf6cb';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Clientes a cadastrar (fornecidos pelo usuário)
const CLIENTES_CADASTRAR = [
  { 
    nomeCSV: 'RBC DESPACHANTE LTDA',
    cnpj: '55.741.473/0001-31',
    observacao: 'Fundada em 01/07/2024, situação BAIXADA'
  },
  { 
    nomeCSV: 'THC LOCACAO DE MAQUINAS LTDA',
    cnpj: '56.924.358/0001-65',
    observacao: 'Fundada em 20/08/2024, situação BAIXADA'
  },
  { 
    nomeCSV: 'UPPER DESPACHANTES LTDA',
    cnpj: '56.340.104/0001-08',
    observacao: 'Fundada em 07/08/2024'
  },
  { 
    nomeCSV: 'VIVA ESTETICA AVANCADA LTDA',
    cnpj: '38.445.830/0001-03',
    observacao: 'Fundada em 14/09/2020, status ATIVA, marca BOTULASER'
  },
  { 
    nomeCSV: 'ABRIGO NOSSO LAR',
    cnpj: '24.884.793/0001-17',
    observacao: 'OSC/Instituição Mantenedora, Rua Anápolis 231, Jardim Novo Mundo'
  }
];

// AMADEU ARAUJO DA VEIGA é proprietário da Boa Vista Agropecuária
// Vamos mapear ele para essa empresa existente

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

function formatCep(cep) {
  const clean = cep?.replace(/\D/g, '') || '';
  if (clean.length !== 8) return cep;
  return clean.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

async function cadastrarClientes() {
  console.log('═'.repeat(70));
  console.log('CADASTRAR CLIENTES FALTANTES VIA API CNPJA');
  console.log('═'.repeat(70));
  console.log('');

  let cadastrados = 0;
  let erros = 0;

  for (const cliente of CLIENTES_CADASTRAR) {
    console.log(`\n📋 Processando: ${cliente.nomeCSV}`);
    console.log(`   CNPJ: ${cliente.cnpj}`);
    
    const cleanCnpj = cliente.cnpj.replace(/\D/g, '');
    
    // Verificar se já existe
    const { data: existente } = await supabase
      .from('clients')
      .select('id, name')
      .eq('cnpj', cleanCnpj)
      .single();
    
    if (existente) {
      console.log(`   ⚠️  Já existe: ${existente.name}`);
      continue;
    }

    // Buscar dados na API CNPJA
    console.log('   🔍 Consultando API CNPJA...');
    const data = await fetchCNPJA(cliente.cnpj);

    // Preparar dados para inserção
    const novoCliente = {
      cnpj: cleanCnpj,
      name: data?.company?.name || cliente.nomeCSV,
      is_active: true
      // observacoes removido - coluna não existe
    };

    if (data) {
      // Dados do endereço
      if (data.address) {
        if (data.address.street) novoCliente.logradouro = data.address.street;
        if (data.address.number) novoCliente.numero = data.address.number;
        if (data.address.details) novoCliente.complemento = data.address.details;
        if (data.address.district) novoCliente.bairro = data.address.district;
        if (data.address.city) novoCliente.municipio = data.address.city;
        if (data.address.state) novoCliente.uf = data.address.state;
        if (data.address.zip) novoCliente.cep = formatCep(data.address.zip);
      }

      // Dados da empresa
      if (data.company) {
        if (data.company.name) novoCliente.razao_social = data.company.name;
        if (data.company.nature?.text) novoCliente.natureza_juridica = data.company.nature.text;
        if (data.company.size?.text) novoCliente.porte = data.company.size.text;
        if (data.company.equity) novoCliente.capital_social = data.company.equity;
      }
      
      if (data.founded) novoCliente.data_abertura = data.founded;

      // Status cadastral
      if (data.status?.text) novoCliente.situacao_cadastral = data.status.text;

      // Atividade principal
      if (data.mainActivity?.text) novoCliente.atividade_principal = data.mainActivity.text;

      // Simples Nacional
      if (data.simples) {
        novoCliente.opcao_pelo_simples = data.simples.optant || false;
        if (data.simples.since) novoCliente.data_opcao_simples = data.simples.since;
        novoCliente.opcao_pelo_mei = data.simples.mei || false;
      }

      // Email e telefone
      if (data.emails && data.emails.length > 0) {
        novoCliente.email = data.emails[0].address;
      }
      if (data.phones && data.phones.length > 0) {
        const phone = data.phones[0];
        novoCliente.phone = `(${phone.area}) ${phone.number}`;
      }
    }

    // Inserir cliente
    console.log(`   💾 Inserindo: ${novoCliente.name}...`);
    const { data: inserted, error } = await supabase
      .from('clients')
      .insert(novoCliente)
      .select('id, name')
      .single();

    if (error) {
      console.log(`   ❌ ERRO: ${error.message}`);
      erros++;
    } else {
      console.log(`   ✅ Cadastrado! ID: ${inserted.id}`);
      cadastrados++;

      // Processar sócios se disponível
      if (data?.company?.members && data.company.members.length > 0) {
        for (const member of data.company.members) {
          const cpfOrCnpj = member.person?.taxId || member.company?.taxId;
          const name = member.person?.name || member.company?.name;
          const role = member.role?.text || 'Sócio';
          const since = member.since;

          if (cpfOrCnpj && name) {
            const partnerType = member.person ? 'individual' : 'company';
            await supabase.from('client_partners').insert({
              client_id: inserted.id,
              name: name,
              cpf: cpfOrCnpj,
              partner_type: partnerType,
              role: role,
              entry_date: since || null
            });
            console.log(`      👤 Sócio: ${name}`);
          }
        }
      }
    }

    // Delay para não sobrecarregar API
    await new Promise(r => setTimeout(r, 500));
  }

  // Agora tratar AMADEU ARAUJO DA VEIGA - mapear para Boa Vista Agropecuária
  console.log('\n' + '─'.repeat(70));
  console.log('📋 Tratando AMADEU ARAUJO DA VEIGA...');
  console.log('   Este é proprietário da Boa Vista Agropecuária');
  
  // Buscar Boa Vista no banco
  const { data: boaVista } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%BOA VISTA%')
    .limit(5);
  
  if (boaVista && boaVista.length > 0) {
    console.log('   Empresas Boa Vista encontradas:');
    for (const bv of boaVista) {
      console.log(`      - ${bv.name} (ID: ${bv.id})`);
    }
    console.log('   ✅ Mapear "AMADEU ARAUJO DA VEIGA" → primeiro Boa Vista');
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('RESUMO');
  console.log('═'.repeat(70));
  console.log(`Clientes cadastrados: ${cadastrados}`);
  console.log(`Erros: ${erros}`);
  console.log('═'.repeat(70));
  
  // Retornar nomes para adicionar ao mapeamento
  console.log('\n📝 ADICIONE AO MAPEAMENTO_NOMES em import_baixa_clientes.mjs:');
  console.log('');
  for (const cliente of CLIENTES_CADASTRAR) {
    console.log(`  '${cliente.nomeCSV}': '${cliente.nomeCSV}',`);
  }
  console.log(`  'AMADEU ARAUJO DA VEIGA': 'BOA VISTA AGROPECUARIA E COM. DE MOVEIS LTDA',`);
}

cadastrarClientes().catch(console.error);
