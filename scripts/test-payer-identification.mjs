// Script para testar identificação de pagadores pelo Dr. Cícero
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

// Exemplos de transações para testar
const testCases = [
  // Caso 1: ENZO - tem MÚLTIPLAS empresas (Crystal, ECD, Verdi)
  'PIX RECEBIDO - ENZO DE AQUINO ALVES DONADI',
  'PIX CRED SICREDI 12345678900 ENZO DONADI',

  // Caso 2: IUVACI MILHOMEM - tem UMA empresa (Restaurante Iuvaci)
  'PIX RECEBIDO - IUVACI OLIVEIRA MILHOMEM',
  'TRANSF PIX IUVACI MILHOMEM',

  // Caso 3: PAULA MILHOMEM - NÃO está no QSA (é filha, não sócia)
  // Mas CARLOS HENRY MILHOMEM e GRAZIELLY MILHOMEM estão!
  'PIX RECEBIDO CARLOS HENRY MILHOMEM',
  'PIX MILHOMEM RESTAURANTE',

  // Caso 4: SERGIO CARNEIRO LEAO - família Ampla (múltiplas empresas)
  'PIX RECEBIDO SERGIO CARNEIRO LEAO',

  // Caso 5: Busca parcial por sobrenome
  'PIX BARBOSA JUNIOR',
  'TRANSF WENDELL MACEDO',

  // Caso 6: Empresa direto pelo nome fantasia
  'PIX ACROPOLE ACADEMIA',
  'BIOGEN DISTRIBUIDORA'
];

async function testIdentification() {
  console.log('=== Testando Identificação de Pagadores (Dr. Cícero) ===\n');

  // Primeiro, testar ação build_client_index
  console.log('📊 Construindo índice de clientes/sócios...');
  try {
    const indexResult = await callDrCicero('build_client_index');
    console.log('Índice construído:');
    console.log('  - Total clientes:', indexResult.stats?.total_clients);
    console.log('  - Clientes com QSA:', indexResult.stats?.clients_with_qsa);
    console.log('  - Total sócios:', indexResult.stats?.total_partners);
    console.log('  - Sócios únicos:', indexResult.stats?.unique_partners);
    console.log('\n');
  } catch (err) {
    console.error('Erro ao construir índice:', err.message);
    console.log('\n');
  }

  // Testar cada caso
  for (const description of testCases) {
    console.log('─'.repeat(60));
    console.log(`🔍 Testando: "${description}"`);
    console.log('─'.repeat(60));

    try {
      const data = await callDrCicero('identify_payer_by_name', { description });

      if (data.found) {
        console.log(`✅ ENCONTRADO!`);
        console.log(`   Pagador: ${data.payer_name}`);
        console.log(`   Cliente: ${data.client_fantasy_name || data.client_name}`);
        console.log(`   CNPJ: ${data.client_cnpj}`);
        console.log(`   Relação: ${data.relationship}`);
        console.log(`   Confiança: ${(data.confidence * 100).toFixed(0)}%`);

        if (data.matches && data.matches.length > 1) {
          console.log(`\n   ⚠️ MÚLTIPLAS EMPRESAS (${data.matches.length}):`);
          data.matches.forEach((m, i) => {
            console.log(`      ${i + 1}. ${m.client_name} (${m.relationship}) - Score: ${m.score}`);
          });
        } else {
          console.log(`\n   ✅ ÚNICA EMPRESA - pode classificar automaticamente!`);
        }

        console.log(`\n   📝 ${data.reasoning}`);
      } else {
        console.log(`❓ NÃO ENCONTRADO`);
        console.log(`   ${data.reasoning}`);
      }
    } catch (err) {
      console.log(`❌ Exceção: ${err.message}`);
    }

    console.log('\n');
  }
}

testIdentification().catch(console.error);
