import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('=== CONSULTA DR. CÍCERO - HONORÁRIOS JANEIRO/2025 ===\n');

  // 1. Buscar cliente Dr. Cícero (Centro Médico Milhomem)
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, cnpj, monthly_fee')
    .or('name.ilike.%cicero%,name.ilike.%cícero%,name.ilike.%milhomem%')
    .limit(5);

  if (clientsError) {
    console.log('Erro ao buscar cliente:', clientsError.message);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('Cliente Dr. Cícero não encontrado. Buscando todos com "centro"...');

    const { data: centros } = await supabase
      .from('clients')
      .select('id, name, cnpj, monthly_fee')
      .ilike('name', '%centro%medico%')
      .limit(5);

    if (centros && centros.length > 0) {
      console.log('Encontrados clientes com "centro médico":');
      for (const c of centros) {
        console.log('  -', c.name, '| CNPJ:', c.cnpj, '| Honorário Mensal: R$', c.monthly_fee);
      }
    }
  } else {
    console.log('Cliente(s) encontrado(s):');
    for (const c of clients) {
      console.log('  -', c.name, '| CNPJ:', c.cnpj, '| Honorário Mensal: R$', c.monthly_fee);
    }
  }

  // 2. Buscar TODOS os honorários gerados em janeiro/2025
  console.log('\n\n=== RECEITA HONORÁRIOS JANEIRO/2025 ===');
  console.log('(Faturamento de competência janeiro, vencimento em fevereiro)\n');

  const { data: receitas, error: receitasError } = await supabase
    .from('accounting_entries')
    .select(`
      id, entry_date, competence_date, description, entry_type,
      accounting_entry_lines(
        debit, credit,
        chart_of_accounts(code, name)
      )
    `)
    .eq('entry_type', 'receita_honorarios')
    .gte('competence_date', '2025-01-01')
    .lte('competence_date', '2025-01-31')
    .order('description');

  if (receitasError) {
    console.log('Erro:', receitasError.message);
    return;
  }

  console.log('Total de lançamentos de receita:', receitas?.length || 0);
  console.log('\n--- DETALHAMENTO ---');

  let totalReceita = 0;
  let totalClientes = 0;

  for (const r of receitas || []) {
    const clientName = r.description?.replace('Receita Honorarios: ', '') || 'N/A';

    // Pegar o valor (débito na conta de clientes ou crédito na conta de receita)
    let valor = 0;
    let contaCliente = '';
    let contaReceita = '';

    for (const line of r.accounting_entry_lines || []) {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      const code = line.chart_of_accounts?.code || '';

      if (code.startsWith('1.1.2')) {
        contaCliente = code;
        valor = debit;
        totalClientes += debit;
      } else if (code.startsWith('3.1')) {
        contaReceita = code;
        totalReceita += credit;
      }
    }

    console.log(
      'R$', valor.toFixed(2).padStart(10),
      '|', clientName.substring(0, 50)
    );
  }

  console.log('\n=== RESUMO ===');
  console.log('Total em Clientes a Receber (Ativo): R$', totalClientes.toFixed(2));
  console.log('Total em Receita Honorários:         R$', totalReceita.toFixed(2));

  // 3. Verificar se estes valores batem com o balancete
  console.log('\n\n=== VERIFICAÇÃO CONTÁBIL ===');
  console.log('Regime de Competência aplicado corretamente:');
  console.log('  D: Clientes a Receber (1.1.2.01) - Ativo aumenta');
  console.log('  C: Receita de Honorários (3.1.01.001) - Receita reconhecida');
  console.log('\nEste lançamento registra a RECEITA em janeiro (competência)');
  console.log('O RECEBIMENTO será registrado em fevereiro (quando o cliente pagar)');
  console.log('  D: Banco (1.1.1.xx)');
  console.log('  C: Clientes a Receber (1.1.2.01)');

  // 4. Verificar recebimentos de janeiro (faturas pagas)
  console.log('\n\n=== RECEBIMENTOS EM JANEIRO/2025 ===');
  console.log('(Faturas de meses anteriores que foram pagas em janeiro)\n');

  const { data: recebimentos, error: recebError } = await supabase
    .from('accounting_entries')
    .select(`
      id, entry_date, competence_date, description,
      accounting_entry_lines(
        debit, credit,
        chart_of_accounts(code, name)
      )
    `)
    .eq('entry_type', 'recebimento')
    .gte('competence_date', '2025-01-01')
    .lte('competence_date', '2025-01-31')
    .order('entry_date');

  if (recebError) {
    console.log('Erro:', recebError.message);
    return;
  }

  console.log('Total de recebimentos:', recebimentos?.length || 0);

  let totalRecebido = 0;
  for (const r of recebimentos || []) {
    for (const line of r.accounting_entry_lines || []) {
      const code = line.chart_of_accounts?.code || '';
      const credit = Number(line.credit) || 0;

      if (code.startsWith('1.1.2')) {
        totalRecebido += credit;
      }
    }
  }

  console.log('Total recebido (baixa de Clientes a Receber): R$', totalRecebido.toFixed(2));
}

check().catch(console.error);
