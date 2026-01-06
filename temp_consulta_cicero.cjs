const https = require('https');

const data = JSON.stringify({
  action: 'consult',
  question: `
Analise nossa estrutura contábil e verifique se atende às NBC (Normas Brasileiras de Contabilidade):

ESTRUTURA ATUAL:
1. Banco de dados com as seguintes tabelas:
   - chart_of_accounts (398 contas - plano de contas)
   - accounting_entries (381 lançamentos)
   - accounting_entry_lines (760 linhas de lançamento)
   - clients (219 clientes ativos)
   - invoices (110 faturas)
   - bank_transactions (393 transações bancárias)
   - expenses (535 despesas)
   - cost_centers (57 centros de custo)
   - employees (23 funcionários)
   - ai_agents (14 agentes de IA)
   - accounting_periods (controle de períodos)

2. Janeiro/2025 - Competência fechada:
   - Saldo Banco Sicredi: R$ 18.553,54
   - Clientes a Receber: R$ 136.821,59
   - Total de receitas e despesas lançados

3. Modelo contábil:
   - Partidas dobradas (débito = crédito)
   - accounting_entries armazena cabeçalho do lançamento
   - accounting_entry_lines armazena débitos e créditos
   - Ligação via account_id com chart_of_accounts
   - Controle por centro de custo
   - Separação de despesas pessoais (adiantamento a sócios)

4. Empresa: AMPLA CONTABILIDADE LTDA - Lucro Presumido

PERGUNTAS:
1. Esta estrutura atende às NBC TG 00, TG 26 e demais normas?
2. O que está faltando para compliance total?
3. Quais melhorias são necessárias?
4. A separação entre empresa e família (adiantamentos) está correta?
`
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
    const result = JSON.parse(body);
    console.log('=== ANÁLISE DO DR. CÍCERO ===\n');
    console.log(result.response || JSON.stringify(result, null, 2));
  });
});

req.write(data);
req.end();
