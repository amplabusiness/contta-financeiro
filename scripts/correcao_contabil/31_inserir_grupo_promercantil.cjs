// scripts/correcao_contabil/31_inserir_grupo_promercantil.cjs
// Insere saldos do grupo econômico PROMERCANTIL/DSL

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs das empresas do grupo
const EMPRESAS = {
  PROMERCANTIL: 'b94f3025-c93c-4de3-ab0e-414e3d9a011f',
  DSL_HOLDING: 'a959fc39-2510-4b9a-b469-27e2d6524cac',
  DSL_PARTICIPACOES: '0733ac80-e225-4bfe-8894-0719ab73bc84',
  SUPERAMED: '6f28ca5f-1f23-4f27-8533-3ee1ff1d316a',
  DSL_MARKETING: 'a9440faf-c429-4059-9574-9ee5de472184'  // AINDA MARKETING = DSL MARKETING
};

// Nome do grupo econômico
const GRUPO_ECONOMICO = 'GRUPO DSL/PROMERCANTIL - GUILHERME';

async function inserirSaldos() {
  console.log('='.repeat(80));
  console.log('INSERINDO SALDOS DO GRUPO ECONOMICO PROMERCANTIL/DSL');
  console.log('='.repeat(80));

  // ========================================
  // 1. PROMERCANTIL - Honorário R$ 3.337,54
  // ========================================
  const promercantilSaldos = [
    // 2023 - Devendo a partir de jun/23
    { competence: '06/2023', amount: 3337.54, due_date: '2023-07-10' },
    { competence: '07/2023', amount: 3337.54, due_date: '2023-08-10' },
    { competence: '08/2023', amount: 3337.54, due_date: '2023-09-10' },
    { competence: '09/2023', amount: 3337.54, due_date: '2023-10-10' },
    { competence: '10/2023', amount: 3337.54, due_date: '2023-11-10' },
    { competence: '11/2023', amount: 3337.54, due_date: '2023-12-10' },
    { competence: '13/2023', amount: 3337.54, due_date: '2023-12-20' },
    { competence: '12/2023', amount: 3337.54, due_date: '2024-01-10' },
    // 2024
    { competence: '01/2024', amount: 3120.07, due_date: '2024-02-10' },
    { competence: '02/2024', amount: 3337.54, due_date: '2024-03-10' },
    { competence: '03/2024', amount: 3337.54, due_date: '2024-04-10' },
    { competence: '04/2024', amount: 3337.54, due_date: '2024-05-10' },
    { competence: '05/2024', amount: 3337.54, due_date: '2024-06-10' },
    { competence: '06/2024', amount: 3337.54, due_date: '2024-07-10' },
    { competence: '07/2024', amount: 3337.54, due_date: '2024-08-10' },
    { competence: '08/2024', amount: 3337.54, due_date: '2024-09-10' },
    { competence: '09/2024', amount: 3337.54, due_date: '2024-10-10' },
    { competence: '10/2024', amount: 3337.54, due_date: '2024-11-10' },
    { competence: '11/2024', amount: 3337.54, due_date: '2024-12-10' },
    { competence: '13/2024', amount: 3337.54, due_date: '2024-12-20' },
    { competence: '12/2024', amount: 3337.54, due_date: '2025-01-10' }
  ];

  // ========================================
  // 2. DSL HOLDING - Honorário R$ 256,73 (2024) / R$ 240,00 (2023)
  // ========================================
  const dslHoldingSaldos = [
    // 2023
    { competence: '06/2023', amount: 240.00, due_date: '2023-07-10' },
    { competence: '07/2023', amount: 240.00, due_date: '2023-08-10' },
    { competence: '08/2023', amount: 240.00, due_date: '2023-09-10' },
    { competence: '09/2023', amount: 240.00, due_date: '2023-10-10' },
    { competence: '10/2023', amount: 240.00, due_date: '2023-11-10' },
    { competence: '11/2023', amount: 240.00, due_date: '2023-12-10' },
    { competence: '13/2023', amount: 240.00, due_date: '2023-12-20' },
    { competence: '12/2023', amount: 240.00, due_date: '2024-01-10' },
    // 2024
    { competence: '01/2024', amount: 256.73, due_date: '2024-02-10' },
    { competence: '02/2024', amount: 256.73, due_date: '2024-03-10' },
    { competence: '03/2024', amount: 256.73, due_date: '2024-04-10' },
    { competence: '04/2024', amount: 256.73, due_date: '2024-05-10' },
    { competence: '05/2024', amount: 256.73, due_date: '2024-06-10' },
    { competence: '06/2024', amount: 256.73, due_date: '2024-07-10' }
  ];

  // ========================================
  // 3. DSL PARTICIPACOES - Mesmos valores que DSL HOLDING
  // ========================================
  const dslParticipacoesSaldos = [...dslHoldingSaldos];

  // ========================================
  // 4. SUPERAMED - Mesmos valores que DSL HOLDING
  // ========================================
  const superamedSaldos = [...dslHoldingSaldos];

  // ========================================
  // 5. DSL MARKETING (AINDA MARKETING) - Mesmos valores que DSL HOLDING
  // ========================================
  const dslMarketingSaldos = [...dslHoldingSaldos];

  // Função para inserir saldos de uma empresa
  async function inserirEmpresa(clientId, nome, saldos, honorarioAtual) {
    console.log('\n' + '-'.repeat(80));
    console.log('EMPRESA:', nome);
    console.log('-'.repeat(80));

    // Atualizar honorário e grupo econômico
    await supabase
      .from('clients')
      .update({
        monthly_fee: honorarioAtual,
        financial_group: GRUPO_ECONOMICO
      })
      .eq('id', clientId);

    console.log('Honorario atualizado para R$', honorarioAtual);
    console.log('Grupo economico:', GRUPO_ECONOMICO);

    // Deletar saldos antigos
    await supabase
      .from('client_opening_balance')
      .delete()
      .eq('client_id', clientId);

    // Inserir novos saldos
    let total = 0;
    for (const s of saldos) {
      const { error } = await supabase
        .from('client_opening_balance')
        .insert({
          client_id: clientId,
          competence: s.competence,
          amount: s.amount,
          due_date: s.due_date,
          status: 'pending',
          description: 'Saldo de abertura - Honorarios'
        });

      if (error) {
        console.log('  ERRO:', s.competence, error.message);
      }
      total += s.amount;
    }

    console.log('Inseridos:', saldos.length, 'competencias');
    console.log('Total: R$', total.toFixed(2));
    return total;
  }

  let totalGeral = 0;

  // Inserir cada empresa
  totalGeral += await inserirEmpresa(EMPRESAS.PROMERCANTIL, 'PROMERCANTIL LTDA', promercantilSaldos, 3337.54);
  totalGeral += await inserirEmpresa(EMPRESAS.DSL_HOLDING, 'DSL HOLDING LTDA', dslHoldingSaldos, 256.73);
  totalGeral += await inserirEmpresa(EMPRESAS.DSL_PARTICIPACOES, 'DSL PARTICIPACOES LTDA', dslParticipacoesSaldos, 256.73);
  totalGeral += await inserirEmpresa(EMPRESAS.SUPERAMED, 'SUPERAMED DISTRIBUIDORA DE MEDICAMENTOS LTDA', superamedSaldos, 256.73);
  totalGeral += await inserirEmpresa(EMPRESAS.DSL_MARKETING, 'DSL MARKETING DIGITAL LTDA (AINDA MARKETING)', dslMarketingSaldos, 256.73);

  console.log('\n' + '='.repeat(80));
  console.log('RESUMO GRUPO ECONOMICO');
  console.log('='.repeat(80));
  console.log('TOTAL GERAL DO GRUPO: R$', totalGeral.toFixed(2));
  console.log('Esperado (planilha):  R$ 58.827,32');
  console.log('Diferenca: R$', Math.abs(totalGeral - 58827.32).toFixed(2));
  console.log('='.repeat(80));
}

inserirSaldos().catch(console.error);
