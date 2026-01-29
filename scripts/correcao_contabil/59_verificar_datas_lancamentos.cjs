// scripts/correcao_contabil/59_verificar_datas_lancamentos.cjs
// Verificar as datas dos lançamentos de saldo de abertura

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO DATAS DOS LANÇAMENTOS');
  console.log('='.repeat(100));

  // 1. Buscar lançamentos de saldo de abertura
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, entry_type')
    .or('description.ilike.%Saldo de abertura%,entry_type.eq.SALDO_ABERTURA')
    .order('entry_date')
    .limit(50);

  console.log(`\n📋 Lançamentos de Saldo de Abertura: ${entries?.length || 0}`);

  // Agrupar por ano/mês
  const porPeriodo = {};
  entries?.forEach(e => {
    const periodo = e.entry_date.substring(0, 7); // YYYY-MM
    if (!porPeriodo[periodo]) porPeriodo[periodo] = 0;
    porPeriodo[periodo]++;
  });

  console.log('\n📊 Distribuição por período:');
  Object.entries(porPeriodo).sort().forEach(([periodo, qtd]) => {
    console.log(`   ${periodo}: ${qtd} lançamentos`);
  });

  // 2. Verificar o que foi para janeiro/2025
  console.log('\n📋 Lançamentos em JANEIRO/2025:');
  const jan2025 = entries?.filter(e => e.entry_date.startsWith('2025-01'));

  if (jan2025?.length === 0) {
    console.log('   ⚠️  NENHUM lançamento em janeiro/2025!');
    console.log('   Os lançamentos foram criados nas datas originais dos honorários.');
  } else {
    jan2025?.forEach(e => {
      console.log(`   ${e.entry_date} | ${e.description.substring(0, 60)}`);
    });
  }

  // 3. Verificar lançamentos em janeiro/2026
  console.log('\n📋 Lançamentos em JANEIRO/2026:');
  const jan2026 = entries?.filter(e => e.entry_date.startsWith('2026-01'));

  if (jan2026?.length === 0) {
    console.log('   ⚠️  NENHUM lançamento em janeiro/2026!');
  } else {
    jan2026?.forEach(e => {
      console.log(`   ${e.entry_date} | ${e.description.substring(0, 60)}`);
    });
  }

  // 4. Explicação
  console.log('\n' + '='.repeat(100));
  console.log('📌 EXPLICAÇÃO:');
  console.log('='.repeat(100));
  console.log(`
  Os lançamentos de SALDO DE ABERTURA foram criados com as datas
  ORIGINAIS dos honorários (2023/2024).

  Para que apareçam corretamente em janeiro/2025, temos duas opções:

  OPÇÃO 1: Alterar as datas dos lançamentos para 01/01/2025
           (data de implantação do saldo de abertura)

  OPÇÃO 2: Usar a função getAccountBalance SEM filtro de período
           para pegar o saldo acumulado de todos os tempos

  REGRA CONTÁBIL CORRETA:
  - Saldo de abertura deve ser lançado em 01/01/XXXX do ano de início
  - Se o sistema começou em 2025, todos os saldos iniciais devem ter data 01/01/2025
  `);
}

verificar().catch(console.error);
