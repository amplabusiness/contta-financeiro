// scripts/correcao_contabil/40_consulta_encerramento_exercicio.cjs
// Consulta ao Dr. Cícero sobre encerramento do exercício

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function consultarDrCicero() {
  const pergunta = `
Dr. Cicero, preciso entender a mecanica correta do ENCERRAMENTO DO EXERCICIO:

1. O que acontece com as contas do grupo 3 (Receitas) e grupo 4 (Despesas) no dia 31/12?
2. Como funciona o zeramento dessas contas?
3. O resultado (Lucro ou Prejuizo) vai para qual conta do Patrimonio Liquido?
4. Qual e o lancamento contabil correto para transferir o resultado?
5. A conta 5.2.1.01 (Lucros Acumulados) e a conta correta para receber o resultado?

Por favor, explique com exemplos de lancamentos no formato D/C.
`;

  console.log('='.repeat(80));
  console.log('CONSULTA AO DR. CICERO - ENCERRAMENTO DO EXERCICIO');
  console.log('='.repeat(80));
  console.log('\nPergunta:', pergunta);

  try {
    const { data, error } = await supabase.functions.invoke('dr-cicero-contador', {
      body: {
        question: pergunta,
        context: 'encerramento_exercicio'
      }
    });

    if (error) {
      console.log('\nERRO ao consultar Dr. Cicero:', error.message);
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('RESPOSTA DO DR. CICERO:');
    console.log('='.repeat(80));
    console.log(data?.response || data?.answer || JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('\nERRO:', e.message);
  }
}

consultarDrCicero();
