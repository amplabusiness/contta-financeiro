const https = require('https');

// Primeiro, buscar dados reais do banco para a análise
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_service_role
);

async function coletarDados() {
  console.log('Coletando dados do banco para auditoria...\n');

  // Plano de contas
  const { data: contas, count: totalContas } = await supabase
    .from('chart_of_accounts')
    .select('*', { count: 'exact' });

  // Lançamentos
  const { count: totalEntries } = await supabase
    .from('accounting_entries')
    .select('*', { count: 'exact', head: true });

  // Linhas de lançamento
  const { count: totalLines } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact', head: true });

  // Verificar partidas dobradas - soma total de débitos e créditos
  const { data: totais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  let totalDebitos = 0;
  let totalCreditos = 0;
  totais?.forEach(l => {
    totalDebitos += Number(l.debit) || 0;
    totalCreditos += Number(l.credit) || 0;
  });

  // Contas sintéticas vs analíticas
  const sinteticas = contas?.filter(c => !c.is_analytical).length || 0;
  const analiticas = contas?.filter(c => c.is_analytical).length || 0;

  // Verificar se há lançamentos em contas sintéticas (ERRO!)
  const contasSinteticasIds = contas?.filter(c => !c.is_analytical).map(c => c.id) || [];
  const { count: lancamentosSinteticas } = await supabase
    .from('accounting_entry_lines')
    .select('*', { count: 'exact', head: true })
    .in('account_id', contasSinteticasIds.slice(0, 100));

  // Estrutura do plano de contas
  const estrutura = {
    ativo: contas?.filter(c => c.code?.startsWith('1')).length || 0,
    passivo: contas?.filter(c => c.code?.startsWith('2')).length || 0,
    receitas: contas?.filter(c => c.code?.startsWith('3')).length || 0,
    despesas: contas?.filter(c => c.code?.startsWith('4')).length || 0,
    patrimonio: contas?.filter(c => c.code?.startsWith('5')).length || 0,
  };

  // Períodos
  const { data: periodos } = await supabase
    .from('accounting_periods')
    .select('*');

  return {
    totalContas,
    totalEntries,
    totalLines,
    totalDebitos,
    totalCreditos,
    diferencaPartidasDobradas: Math.abs(totalDebitos - totalCreditos),
    sinteticas,
    analiticas,
    lancamentosSinteticas: lancamentosSinteticas || 0,
    estrutura,
    periodos
  };
}

async function consultarDrCicero(dados) {
  return new Promise((resolve, reject) => {
    const pergunta = `
Dr. Cícero, como contador experiente com 35 anos de experiência em NBC/CFC, preciso de uma AUDITORIA COMPLETA do nosso módulo contábil.

DADOS COLETADOS DO SISTEMA:

1. PLANO DE CONTAS:
   - Total de contas: ${dados.totalContas}
   - Contas sintéticas: ${dados.sinteticas}
   - Contas analíticas: ${dados.analiticas}
   - Estrutura:
     * Ativo (1.x): ${dados.estrutura.ativo} contas
     * Passivo (2.x): ${dados.estrutura.passivo} contas
     * Receitas (3.x): ${dados.estrutura.receitas} contas
     * Despesas (4.x): ${dados.estrutura.despesas} contas
     * Patrimônio Líquido (5.x): ${dados.estrutura.patrimonio} contas

2. LANÇAMENTOS CONTÁBEIS:
   - Total de lançamentos (accounting_entries): ${dados.totalEntries}
   - Total de linhas (accounting_entry_lines): ${dados.totalLines}
   - SOMA TOTAL DÉBITOS: R$ ${dados.totalDebitos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
   - SOMA TOTAL CRÉDITOS: R$ ${dados.totalCreditos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
   - DIFERENÇA (deve ser ZERO): R$ ${dados.diferencaPartidasDobradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}

3. VERIFICAÇÕES DE INTEGRIDADE:
   - Lançamentos em contas SINTÉTICAS (ERRO se > 0): ${dados.lancamentosSinteticas}

4. CONTROLE DE PERÍODOS:
   - Períodos cadastrados: ${dados.periodos?.length || 0}
   ${dados.periodos?.map(p => `   * ${p.month}/${p.year}: ${p.status}`).join('\n') || '   * Nenhum período cadastrado'}

5. MODELO DE DADOS:
   - accounting_entries: Cabeçalho do lançamento (data, descrição, tipo)
   - accounting_entry_lines: Débitos e créditos (account_id, debit, credit)
   - chart_of_accounts: Plano de contas com natureza (DEVEDORA/CREDORA)
   - Cada linha referencia uma conta via account_id

PERGUNTAS PARA AUDITORIA:

1. O MÓDULO ESTÁ SEGURO para uso em produção?

2. ESTÁ EM CONFORMIDADE com as seguintes normas?
   - NBC TG 00 (Estrutura Conceitual)
   - NBC TG 26 (Apresentação das Demonstrações Contábeis)
   - NBC TG 03 (DFC)
   - Lei 6.404/76

3. QUAIS RISCOS existem na estrutura atual?

4. O QUE ESTÁ FALTANDO para compliance total?

5. QUAL SUA NOTA (0-10) para este módulo contábil?

Por favor, seja RIGOROSO e TÉCNICO na sua análise. Precisamos saber a verdade.
`;

    const data = JSON.stringify({
      action: 'consult',
      question: pergunta
    });

    const options = {
      hostname: 'xdtlhzysrpoinqtsglmr.supabase.co',
      port: 443,
      path: '/functions/v1/dr-cicero-brain',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          // A resposta pode vir como string direta ou como objeto
          if (typeof result === 'string') {
            resolve(result);
          } else if (result.response) {
            resolve(result.response);
          } else if (result.success) {
            // Converter objeto de caracteres para string
            let texto = '';
            const keys = Object.keys(result).filter(k => !isNaN(parseInt(k))).sort((a,b) => parseInt(a) - parseInt(b));
            keys.forEach(k => texto += result[k]);
            resolve(texto || JSON.stringify(result));
          } else {
            resolve(JSON.stringify(result, null, 2));
          }
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    const dados = await coletarDados();

    console.log('========================================');
    console.log('  DADOS COLETADOS PARA AUDITORIA');
    console.log('========================================\n');
    console.log('Plano de Contas:', dados.totalContas, 'contas');
    console.log('Lançamentos:', dados.totalEntries);
    console.log('Linhas:', dados.totalLines);
    console.log('Total Débitos: R$', dados.totalDebitos.toFixed(2));
    console.log('Total Créditos: R$', dados.totalCreditos.toFixed(2));
    console.log('Diferença:', dados.diferencaPartidasDobradas.toFixed(2), dados.diferencaPartidasDobradas < 0.01 ? '✓ OK' : '✗ ERRO!');
    console.log('\nConsultando Dr. Cícero...\n');

    const parecer = await consultarDrCicero(dados);

    console.log('========================================');
    console.log('  PARECER DO DR. CÍCERO');
    console.log('========================================\n');
    console.log(parecer);

  } catch (error) {
    console.error('Erro:', error);
  }
}

main();
