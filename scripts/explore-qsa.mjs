// Script para explorar QSA dos clientes
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function exploreQSA() {
  console.log('=== Explorando QSA dos Clientes ===\n');

  // Primeiro, verificar estrutura da tabela
  console.log('Verificando estrutura da tabela clients...');
  const { data: sample, error: sampleError } = await supabase
    .from('clients')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.error('Erro ao verificar estrutura:', sampleError.message);
    return;
  }

  if (sample && sample[0]) {
    console.log('Colunas disponíveis:', Object.keys(sample[0]).join(', '));
    console.log('\n');
  }

  // Buscar todos clientes com QSA preenchido
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .not('qsa', 'is', null)
    .order('name');

  if (error) {
    console.error('Erro:', error.message);
    return;
  }

  console.log('Clientes com QSA:', clients.length);

  // Construir índice de sócios -> empresas
  const socioIndex = {};

  clients.forEach(client => {
    if (client.qsa && Array.isArray(client.qsa)) {
      client.qsa.forEach(socio => {
        const nome = socio.nome || socio.name;
        if (nome) {
          if (!socioIndex[nome]) {
            socioIndex[nome] = [];
          }
          socioIndex[nome].push({
            client_id: client.id,
            client_name: client.name,
            fantasy_name: client.fantasy_name,
            cnpj: client.cnpj,
            qualificacao: socio.qualificacao || socio.role
          });
        }
      });
    }
  });

  console.log('\nTotal de sócios únicos:', Object.keys(socioIndex).length);

  // Mostrar primeiros 30 sócios
  console.log('\n=== Primeiros 30 Sócios e suas Empresas ===\n');
  Object.keys(socioIndex).slice(0, 30).forEach(socio => {
    const empresas = socioIndex[socio];
    console.log(`${socio}:`);
    empresas.forEach(e => {
      console.log(`  -> ${e.fantasy_name || e.client_name} (${e.qualificacao})`);
    });
  });

  // Buscar especificamente por nomes mencionados
  console.log('\n=== Buscando nomes mencionados pelo usuário ===\n');

  const nomesParaBuscar = ['PAULA', 'MILHOMEM', 'ENZO', 'DONATI', 'IUVACI', 'LEAO', 'SERGIO'];

  nomesParaBuscar.forEach(termo => {
    const matches = Object.keys(socioIndex).filter(s =>
      s.toUpperCase().includes(termo.toUpperCase())
    );
    if (matches.length > 0) {
      console.log(`Buscando "${termo}":`);
      matches.forEach(m => {
        console.log(`  ${m} -> ${socioIndex[m].map(e => e.fantasy_name || e.client_name).join(', ')}`);
      });
    } else {
      console.log(`Buscando "${termo}": Nenhum resultado`);
    }
  });

  // Buscar também na tabela de clientes direto pelo nome
  console.log('\n=== Buscando clientes com "IUVACI" no nome ===\n');
  const { data: iuvaciClients } = await supabase
    .from('clients')
    .select('id, name, fantasy_name, cnpj, qsa')
    .or('name.ilike.%iuvaci%,fantasy_name.ilike.%iuvaci%');

  if (iuvaciClients && iuvaciClients.length > 0) {
    console.log('Encontrados:', iuvaciClients.length);
    iuvaciClients.forEach(c => {
      console.log(`- ${c.name} / ${c.fantasy_name}`);
      console.log(`  CNPJ: ${c.cnpj}`);
      if (c.qsa) {
        console.log('  Sócios:', JSON.stringify(c.qsa, null, 2));
      }
    });
  } else {
    console.log('Nenhum cliente encontrado com "IUVACI"');
  }

  // Verificar grupos econômicos
  console.log('\n=== Grupos Econômicos ===\n');
  const { data: groups } = await supabase
    .from('economic_groups')
    .select('*')
    .limit(20);

  if (groups && groups.length > 0) {
    console.log('Grupos encontrados:', groups.length);
    groups.forEach(g => {
      console.log(`- ${g.name} (ID: ${g.id})`);
    });
  } else {
    console.log('Nenhum grupo econômico encontrado');
  }
}

exploreQSA().catch(console.error);
