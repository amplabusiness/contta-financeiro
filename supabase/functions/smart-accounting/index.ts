import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Estrutura padrão do plano de contas
// Nota: Usando is_analytical (false = sintética, true = analítica) e account_type conforme tabela do banco
const DEFAULT_CHART_STRUCTURE = {
  // ATIVO
  '1': { name: 'ATIVO', account_type: 'ATIVO', nature: 'DEVEDORA', level: 1, is_analytical: false },
  '1.1': { name: 'ATIVO CIRCULANTE', account_type: 'ATIVO', nature: 'DEVEDORA', level: 2, is_analytical: false },
  '1.1.1': { name: 'Caixa e Equivalentes', account_type: 'ATIVO', nature: 'DEVEDORA', level: 3, is_analytical: false },
  '1.1.1.01': { name: 'Caixa Geral', account_type: 'ATIVO', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '1.1.1.02': { name: 'Bancos Conta Movimento', account_type: 'ATIVO', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '1.1.2': { name: 'Créditos a Receber', account_type: 'ATIVO', nature: 'DEVEDORA', level: 3, is_analytical: false },
  '1.1.2.01': { name: 'Clientes a Receber', account_type: 'ATIVO', nature: 'DEVEDORA', level: 4, is_analytical: false }, // Conta sintética para subcontas de clientes

  // PASSIVO
  '2': { name: 'PASSIVO', account_type: 'PASSIVO', nature: 'CREDORA', level: 1, is_analytical: false },
  '2.1': { name: 'PASSIVO CIRCULANTE', account_type: 'PASSIVO', nature: 'CREDORA', level: 2, is_analytical: false },
  '2.1.1': { name: 'Fornecedores', account_type: 'PASSIVO', nature: 'CREDORA', level: 3, is_analytical: false },
  '2.1.1.01': { name: 'Fornecedores a Pagar', account_type: 'PASSIVO', nature: 'CREDORA', level: 4, is_analytical: true },
  '2.1.2': { name: 'Obrigações Trabalhistas', account_type: 'PASSIVO', nature: 'CREDORA', level: 3, is_analytical: false },
  '2.1.3': { name: 'Obrigações Tributárias', account_type: 'PASSIVO', nature: 'CREDORA', level: 3, is_analytical: false },

  // RECEITAS
  '3': { name: 'RECEITAS', account_type: 'RECEITA', nature: 'CREDORA', level: 1, is_analytical: false },
  '3.1': { name: 'RECEITAS OPERACIONAIS', account_type: 'RECEITA', nature: 'CREDORA', level: 2, is_analytical: false },
  '3.1.1': { name: 'Receita de Honorários', account_type: 'RECEITA', nature: 'CREDORA', level: 3, is_analytical: false },
  '3.1.1.01': { name: 'Honorários Contábeis', account_type: 'RECEITA', nature: 'CREDORA', level: 4, is_analytical: true },
  '3.1.1.02': { name: 'Honorários Fiscais', account_type: 'RECEITA', nature: 'CREDORA', level: 4, is_analytical: true },
  '3.1.1.03': { name: 'Honorários Trabalhistas', account_type: 'RECEITA', nature: 'CREDORA', level: 4, is_analytical: true },
  '3.1.2': { name: 'Outras Receitas', account_type: 'RECEITA', nature: 'CREDORA', level: 3, is_analytical: false },

  // DESPESAS
  '4': { name: 'DESPESAS', account_type: 'DESPESA', nature: 'DEVEDORA', level: 1, is_analytical: false },
  '4.1': { name: 'DESPESAS OPERACIONAIS', account_type: 'DESPESA', nature: 'DEVEDORA', level: 2, is_analytical: false },
  '4.1.1': { name: 'Despesas com Pessoal', account_type: 'DESPESA', nature: 'DEVEDORA', level: 3, is_analytical: false },
  '4.1.1.01': { name: 'Salários e Ordenados', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '4.1.1.02': { name: 'Encargos Sociais', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '4.1.2': { name: 'Despesas Administrativas', account_type: 'DESPESA', nature: 'DEVEDORA', level: 3, is_analytical: false },
  '4.1.2.01': { name: 'Aluguel', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '4.1.2.02': { name: 'Energia Elétrica', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '4.1.2.03': { name: 'Telefone e Internet', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '4.1.2.04': { name: 'Material de Escritório', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '4.1.2.05': { name: 'Serviços de Terceiros', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '4.1.3': { name: 'Despesas Financeiras', account_type: 'DESPESA', nature: 'DEVEDORA', level: 3, is_analytical: false },
  '4.1.3.01': { name: 'Juros e Multas', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },
  '4.1.3.02': { name: 'Tarifas Bancárias', account_type: 'DESPESA', nature: 'DEVEDORA', level: 4, is_analytical: true },

  // PATRIMÔNIO LÍQUIDO
  '5': { name: 'PATRIMÔNIO LÍQUIDO', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 1, is_analytical: false },
  '5.1': { name: 'CAPITAL SOCIAL', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 2, is_analytical: false },
  '5.1.1': { name: 'Capital Integralizado', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 3, is_analytical: false },
  '5.1.1.01': { name: 'Capital Social', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
  '5.2': { name: 'LUCROS OU PREJUÍZOS ACUMULADOS', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 2, is_analytical: false },
  '5.2.1': { name: 'Resultados Acumulados', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 3, is_analytical: false },
  '5.2.1.01': { name: 'Lucros Acumulados', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
  '5.2.1.02': { name: 'Saldos de Abertura', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Usar service role para criar contas
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    console.log('Smart Accounting - Action:', action, 'Body:', JSON.stringify(body));

    // AÇÃO: Inicializar plano de contas
    if (action === 'init_chart') {
      const result = await initializeChartOfAccounts(supabaseClient, user.id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Garantir que conta existe (ou criar)
    if (action === 'ensure_account') {
      const { code, name, account_type, is_analytical, parent_code } = body;
      // Suporta parâmetros antigos (type, is_synthetic) para compatibilidade
      const accountType = account_type || body.type || 'ATIVO';
      const isAnalytical = is_analytical !== undefined ? is_analytical : (body.is_synthetic === undefined ? true : !body.is_synthetic);
      const account = await ensureAccountExists(supabaseClient, user.id, code, name, accountType, isAnalytical, parent_code);
      return new Response(JSON.stringify({ success: true, account }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Criar conta para cliente específico
    if (action === 'ensure_client_account') {
      const { clientId, clientName } = body;
      const account = await ensureClientAccount(supabaseClient, user.id, clientId, clientName);
      return new Response(JSON.stringify({ success: true, account }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Criar lançamento contábil inteligente
    if (action === 'create_entry') {
      const result = await createSmartAccountingEntry(supabaseClient, user.id, body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Gerar lançamentos retroativos
    if (action === 'generate_retroactive') {
      console.log('[v2] Starting generate_retroactive for:', body.table);
      try {
        const result = await generateRetroactiveEntries(supabaseClient, user.id, body);
        console.log('[v2] generate_retroactive completed:', result);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        console.error('[v2] generate_retroactive error:', err);
        return new Response(JSON.stringify({
          success: false,
          error: err.message,
          message: `Erro ao processar ${body.table}: ${err.message}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // AÇÃO: Análise IA do plano de contas
    if (action === 'ai_analyze') {
      const result = await aiAnalyzeTransaction(supabaseClient, body);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Smart Accounting Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Inicializar plano de contas com estrutura padrão
async function initializeChartOfAccounts(supabase: any, userId: string) {
  const created: string[] = [];
  const existing: string[] = [];
  const errors: string[] = [];

  // Ordenar as contas por nível (1, 2, 3, 4) para garantir que pais sejam criados antes dos filhos
  const sortedCodes = Object.keys(DEFAULT_CHART_STRUCTURE).sort((a, b) => {
    const levelA = DEFAULT_CHART_STRUCTURE[a as keyof typeof DEFAULT_CHART_STRUCTURE].level;
    const levelB = DEFAULT_CHART_STRUCTURE[b as keyof typeof DEFAULT_CHART_STRUCTURE].level;
    if (levelA !== levelB) return levelA - levelB;
    return a.localeCompare(b);
  });

  console.log('Creating accounts in order:', sortedCodes.join(', '));

  for (const code of sortedCodes) {
    const config = DEFAULT_CHART_STRUCTURE[code as keyof typeof DEFAULT_CHART_STRUCTURE];

    try {
      const { data: existingAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', code)
        .single();

      if (!existingAccount) {
        // Encontrar parent_id - apenas para contas que têm pai (nível > 1)
        const parentCode = code.split('.').slice(0, -1).join('.');
        let parentId = null;

        // Apenas buscar parent_id se o código tiver um pai (não for conta nível 1)
        if (parentCode && parentCode.length > 0) {
          const { data: parent } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('code', parentCode)
            .single();
          parentId = parent?.id || null;

          // Se não encontrar o pai e deveria ter um, logar o erro
          if (!parentId && config.level > 1) {
            console.error(`Parent ${parentCode} not found for ${code}`);
            errors.push(`${code}: Conta pai ${parentCode} não encontrada`);
            continue;
          }
        }

        console.log(`Creating account ${code} (level ${config.level}, parent: ${parentCode || 'none'})`);

        const { error } = await supabase
          .from('chart_of_accounts')
          .insert({
            code,
            name: config.name,
            account_type: config.account_type,
            nature: config.nature,
            level: config.level,
            is_analytical: config.is_analytical,
            parent_id: parentId,
            is_active: true,
          });

        if (!error) {
          created.push(code);
        } else {
          console.error(`Error creating account ${code}:`, error);
          errors.push(`${code}: ${error.message}`);
        }
      } else {
        existing.push(code);
      }
    } catch (err: any) {
      console.error(`Exception for account ${code}:`, err);
      errors.push(`${code}: ${err.message}`);
    }
  }

  return {
    success: errors.length === 0,
    created,
    existing,
    errors,
    message: `Criadas ${created.length} contas, ${existing.length} já existiam${errors.length > 0 ? `, ${errors.length} erros` : ''}`
  };
}

// Garantir que uma conta existe, criando se necessário
async function ensureAccountExists(
  supabase: any,
  userId: string,
  code: string,
  name: string,
  accountType: string, // ATIVO, PASSIVO, RECEITA, DESPESA
  is_analytical: boolean = true,
  parentCode?: string
) {
  // Verificar se existe
  const { data: existing } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('code', code)
    .single();

  if (existing) {
    return existing;
  }

  // Encontrar parent_id
  let parentId = null;
  if (parentCode) {
    const { data: parent } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', parentCode)
      .single();
    parentId = parent?.id || null;
  } else {
    // Tentar encontrar parent pelo código
    const parentCodeAuto = code.split('.').slice(0, -1).join('.');
    if (parentCodeAuto) {
      const { data: parent } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', parentCodeAuto)
        .single();
      parentId = parent?.id || null;
    }
  }

  // Determinar natureza baseada no tipo de conta
  const nature = ['ATIVO', 'DESPESA'].includes(accountType.toUpperCase()) ? 'DEVEDORA' : 'CREDORA';
  const level = code.split('.').length;

  // Criar conta
  const { data: newAccount, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code,
      name,
      account_type: accountType.toUpperCase(),
      nature,
      level,
      is_analytical,
      parent_id: parentId,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar conta ${code}: ${error.message}`);
  }

  return newAccount;
}

// Criar conta específica para cliente
async function ensureClientAccount(supabase: any, userId: string, clientId: string, clientName: string) {
  // Buscar o cliente se não tiver nome
  let name = clientName;
  if (!name && clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', clientId)
      .single();
    name = client?.name || 'Cliente';
  }

  // Garantir que a conta sintética "Clientes a Receber" existe (is_analytical=false = sintética)
  await ensureAccountExists(supabase, userId, '1.1.2.01', 'Clientes a Receber', 'ATIVO', false, '1.1.2');

  // Buscar próximo código disponível para cliente
  const { data: existingClientAccounts } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .like('code', '1.1.2.01.%')
    .order('code', { ascending: false });

  let nextCode = '1.1.2.01.001';
  if (existingClientAccounts && existingClientAccounts.length > 0) {
    const lastCode = existingClientAccounts[0].code;
    const lastNum = parseInt(lastCode.split('.').pop() || '0');
    nextCode = `1.1.2.01.${String(lastNum + 1).padStart(3, '0')}`;
  }

  // Verificar se já existe conta para este cliente (por nome similar ou metadata)
  const { data: existingByName } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .like('code', '1.1.2.01.%')
    .ilike('name', `%${name}%`)
    .single();

  if (existingByName) {
    return existingByName;
  }

  // Criar conta analítica para o cliente (is_analytical=true = analítica)
  const account = await ensureAccountExists(
    supabase,
    userId,
    nextCode,
    `Cliente: ${name}`,
    'ATIVO',
    true,
    '1.1.2.01'
  );

  return account;
}

// Criar lançamento contábil inteligente
async function createSmartAccountingEntry(supabase: any, userId: string, params: any) {
  const {
    entry_type, // 'receita_honorarios', 'recebimento', 'despesa', 'pagamento_despesa', 'saldo_abertura'
    amount,
    date,
    description,
    client_id,
    client_name,
    reference_type,
    reference_id,
    competence,
    expense_category,
  } = params;

  console.log('Creating smart entry:', { entry_type, amount, date, description, client_id });

  // Garantir estrutura básica do plano de contas (is_analytical=true = conta analítica)
  await ensureAccountExists(supabase, userId, '1.1.1.01', 'Caixa Geral', 'ATIVO', true, '1.1.1');
  await ensureAccountExists(supabase, userId, '3.1.1.01', 'Honorários Contábeis', 'RECEITA', true, '3.1.1');

  let debitAccountId: string;
  let creditAccountId: string;
  let entryDescription: string;

  switch (entry_type) {
    case 'receita_honorarios': {
      // Débito: Conta do Cliente (Clientes a Receber)
      // Crédito: Receita de Honorários

      // Criar/buscar conta específica do cliente
      const clientAccount = await ensureClientAccount(supabase, userId, client_id, client_name);
      debitAccountId = clientAccount.id;

      // Buscar conta de receita
      const { data: revenueAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '3.1.1.01')
        .single();

      if (!revenueAccount) {
        throw new Error('Conta de receita não encontrada');
      }
      creditAccountId = revenueAccount.id;
      entryDescription = `Provisionamento: ${description}`;
      break;
    }

    case 'saldo_abertura': {
      // Saldo de Abertura: NÃO é receita do período atual!
      // Débito: Conta do Cliente (Clientes a Receber) - Ativo
      // Crédito: Saldos de Abertura (5.2.1.02) - Patrimônio Líquido
      // Isso representa um ativo que já existia, cuja receita foi reconhecida em período anterior

      // Criar/buscar conta específica do cliente
      const clientAccountOB = await ensureClientAccount(supabase, userId, client_id, client_name);
      debitAccountId = clientAccountOB.id;

      // Garantir que a conta de Saldos de Abertura existe
      const openingBalanceAccount = await ensureAccountExists(
        supabase,
        userId,
        '5.2.1.02',
        'Saldos de Abertura',
        'PATRIMONIO_LIQUIDO',
        true,
        '5.2.1'
      );
      creditAccountId = openingBalanceAccount.id;
      entryDescription = `Saldo de Abertura: ${description}`;
      break;
    }

    case 'recebimento': {
      // Débito: Caixa
      // Crédito: Conta do Cliente (baixa do saldo)

      const { data: cashAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '1.1.1.01')
        .single();

      if (!cashAccount) {
        throw new Error('Conta de caixa não encontrada');
      }
      debitAccountId = cashAccount.id;

      // Buscar conta do cliente
      const clientAccount = await ensureClientAccount(supabase, userId, client_id, client_name);
      creditAccountId = clientAccount.id;
      entryDescription = `Recebimento: ${description}`;
      break;
    }

    case 'despesa': {
      // Débito: Conta de Despesa específica
      // Crédito: Fornecedores a Pagar

      // Mapear categoria para conta de despesa
      const expenseCode = mapExpenseCategoryToAccount(expense_category);
      const expenseAccount = await ensureAccountExists(
        supabase,
        userId,
        expenseCode.code,
        expenseCode.name,
        'DESPESA',
        true, // is_analytical = true (conta analítica)
        expenseCode.parent
      );
      debitAccountId = expenseAccount.id;

      // Buscar/criar conta de fornecedores a pagar
      const payableAccount = await ensureAccountExists(
        supabase,
        userId,
        '2.1.1.01',
        'Fornecedores a Pagar',
        'PASSIVO',
        true, // is_analytical = true (conta analítica)
        '2.1.1'
      );
      creditAccountId = payableAccount.id;
      entryDescription = `Provisionamento Despesa: ${description}`;
      break;
    }

    case 'pagamento_despesa': {
      // Débito: Fornecedores a Pagar
      // Crédito: Caixa

      const { data: payableAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '2.1.1.01')
        .single();

      if (!payableAccount) {
        throw new Error('Conta de fornecedores não encontrada');
      }
      debitAccountId = payableAccount.id;

      const { data: cashAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', '1.1.1.01')
        .single();

      if (!cashAccount) {
        throw new Error('Conta de caixa não encontrada');
      }
      creditAccountId = cashAccount.id;
      entryDescription = `Pagamento: ${description}`;
      break;
    }

    default:
      throw new Error(`Tipo de lançamento inválido: ${entry_type}`);
  }

  // Função auxiliar para extrair data no formato YYYY-MM-DD
  const extractDate = (dateValue: any): string | null => {
    if (!dateValue) return null;
    // Se já é uma string no formato YYYY-MM-DD
    if (typeof dateValue === 'string') {
      // Se contém T (ISO timestamp), extrair só a data
      if (dateValue.includes('T')) {
        return dateValue.split('T')[0];
      }
      // Se já está no formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      // Se está no formato DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split('/');
        return `${year}-${month}-${day}`;
      }
    }
    // Se é uma Date ou pode ser convertido
    try {
      const d = new Date(dateValue);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch {
      // Ignorar erro
    }
    return null;
  };

  // Determinar data do lançamento e competência
  let entryDate = extractDate(date);
  let competenceDate: string | null = null;

  // Se temos competência no formato MM/YYYY, usar último dia do mês
  if (competence && typeof competence === 'string' && competence.includes('/')) {
    const parts = competence.split('/');
    if (parts.length === 2) {
      const [month, year] = parts;
      if (month && year && !isNaN(parseInt(month)) && !isNaN(parseInt(year))) {
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        competenceDate = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    }
  }

  // Fallbacks para garantir que nunca temos null
  const today = new Date().toISOString().split('T')[0];

  if (!entryDate) {
    entryDate = competenceDate || today;
  }
  if (!competenceDate) {
    competenceDate = entryDate || today;
  }

  console.log(`Entry dates calculated: entryDate=${entryDate}, competenceDate=${competenceDate}, original date=${date}, competence=${competence}`);

  // Criar lançamento contábil
  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: entryDate,
      competence_date: competenceDate,
      entry_type: entry_type,
      description: entryDescription,
      reference_type: reference_type || entry_type,
      reference_id: reference_id,
      total_debit: amount,
      total_credit: amount,
      balanced: true,
      created_by: userId,
    })
    .select()
    .single();

  if (entryError) {
    throw new Error(`Erro ao criar lançamento: ${entryError.message}`);
  }

  // Criar linhas do lançamento
  const { error: linesError } = await supabase
    .from('accounting_entry_lines')
    .insert([
      {
        entry_id: entry.id,
        account_id: debitAccountId,
        description: `D - ${entryDescription}`,
        debit: amount,
        credit: 0,
      },
      {
        entry_id: entry.id,
        account_id: creditAccountId,
        description: `C - ${entryDescription}`,
        debit: 0,
        credit: amount,
      },
    ]);

  if (linesError) {
    throw new Error(`Erro ao criar linhas: ${linesError.message}`);
  }

  // Criar lançamento no razão do cliente (se for receita/recebimento)
  if (client_id && ['receita_honorarios', 'saldo_abertura', 'recebimento'].includes(entry_type)) {
    const isDebit = ['receita_honorarios', 'saldo_abertura'].includes(entry_type);

    await supabase
      .from('client_ledger')
      .insert({
        client_id: client_id,
        transaction_date: entryDate,
        description: entryDescription,
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
        balance: 0,
        reference_type: reference_type || entry_type,
        reference_id: reference_id,
        created_by: userId,
      });
  }

  return {
    success: true,
    entry_id: entry.id,
    message: `Lançamento contábil criado com sucesso`
  };
}

// Mapear categoria de despesa para conta contábil
function mapExpenseCategoryToAccount(category: string): { code: string; name: string; parent: string } {
  const mapping: Record<string, { code: string; name: string; parent: string }> = {
    'salarios': { code: '4.1.1.01', name: 'Salários e Ordenados', parent: '4.1.1' },
    'encargos': { code: '4.1.1.02', name: 'Encargos Sociais', parent: '4.1.1' },
    'aluguel': { code: '4.1.2.01', name: 'Aluguel', parent: '4.1.2' },
    'energia': { code: '4.1.2.02', name: 'Energia Elétrica', parent: '4.1.2' },
    'telefone': { code: '4.1.2.03', name: 'Telefone e Internet', parent: '4.1.2' },
    'internet': { code: '4.1.2.03', name: 'Telefone e Internet', parent: '4.1.2' },
    'material': { code: '4.1.2.04', name: 'Material de Escritório', parent: '4.1.2' },
    'servicos': { code: '4.1.2.05', name: 'Serviços de Terceiros', parent: '4.1.2' },
    'juros': { code: '4.1.3.01', name: 'Juros e Multas', parent: '4.1.3' },
    'tarifas': { code: '4.1.3.02', name: 'Tarifas Bancárias', parent: '4.1.3' },
    'default': { code: '4.1.2.99', name: 'Outras Despesas Administrativas', parent: '4.1.2' },
  };

  const key = category?.toLowerCase() || 'default';
  return mapping[key] || mapping['default'];
}

// Gerar lançamentos retroativos para registros existentes
// v2 - 2024-11-29 05:35
async function generateRetroactiveEntries(supabase: any, userId: string, params: any) {
  const { table } = params;
  const results = { created: 0, skipped: 0, errors: [] as string[] };

  console.log(`[v2] generateRetroactiveEntries started for table: ${table}`);

  if (table === 'client_opening_balance') {
    // Buscar saldos de abertura sem lançamento contábil
    const { data: balances, error } = await supabase
      .from('client_opening_balance')
      .select(`
        *,
        clients(id, name)
      `)
      .order('created_at')
      .limit(100); // Limitar para evitar timeout

    if (error) {
      console.error('Error fetching client_opening_balance:', error);
      throw error;
    }

    console.log(`Found ${balances?.length || 0} opening balances to process`);

    // Retornar rápido se não há dados
    if (!balances || balances.length === 0) {
      return {
        success: true,
        created: 0,
        skipped: 0,
        errors: [],
        message: 'Nenhum saldo de abertura para processar'
      };
    }

    for (const balance of balances) {
      try {
        // Verificar se já existe lançamento
        const { data: existingEntry } = await supabase
          .from('accounting_entries')
          .select('id')
          .eq('reference_type', 'opening_balance')
          .eq('reference_id', balance.id)
          .single();

        if (existingEntry) {
          results.skipped++;
          continue;
        }

        // Criar lançamento
        await createSmartAccountingEntry(supabase, userId, {
          entry_type: 'saldo_abertura',
          amount: balance.amount,
          date: balance.due_date,
          description: balance.description || `Honorários de ${balance.competence}`,
          client_id: balance.client_id,
          client_name: balance.clients?.name,
          reference_type: 'opening_balance',
          reference_id: balance.id,
          competence: balance.competence,
        });

        results.created++;
      } catch (err: any) {
        console.error(`Error processing balance ${balance.id}:`, err);
        results.errors.push(`Balance ${balance.id}: ${err.message}`);
      }
    }

    console.log(`client_opening_balance completed: ${results.created} created, ${results.skipped} skipped`);
  } else if (table === 'invoices') {
    // Buscar faturas sem lançamento contábil
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        *,
        clients(id, name)
      `)
      .order('created_at')
      .limit(100); // Limitar para evitar timeout

    if (error) throw error;

    console.log(`Found ${invoices?.length || 0} invoices to process`);

    // Retornar rápido se não há dados
    if (!invoices || invoices.length === 0) {
      return {
        success: true,
        created: 0,
        skipped: 0,
        errors: [],
        message: 'Nenhuma fatura para processar'
      };
    }

    for (const invoice of invoices) {
      try {
        // Verificar se já existe lançamento de provisionamento
        const { data: existingEntry } = await supabase
          .from('accounting_entries')
          .select('id')
          .eq('reference_type', 'invoice')
          .eq('reference_id', invoice.id)
          .eq('entry_type', 'receita_honorarios')
          .single();

        if (existingEntry) {
          results.skipped++;
          continue;
        }

        // Criar lançamento de provisionamento
        await createSmartAccountingEntry(supabase, userId, {
          entry_type: 'receita_honorarios',
          amount: invoice.amount,
          date: invoice.issue_date || invoice.created_at,
          description: invoice.description || `Fatura ${invoice.invoice_number}`,
          client_id: invoice.client_id,
          client_name: invoice.clients?.name,
          reference_type: 'invoice',
          reference_id: invoice.id,
          competence: invoice.competence,
        });

        results.created++;

        // Se fatura está paga, criar lançamento de recebimento
        if (invoice.status === 'paid' && invoice.payment_date) {
          await createSmartAccountingEntry(supabase, userId, {
            entry_type: 'recebimento',
            amount: invoice.amount,
            date: invoice.payment_date,
            description: `Recebimento Fatura ${invoice.invoice_number}`,
            client_id: invoice.client_id,
            client_name: invoice.clients?.name,
            reference_type: 'invoice_payment',
            reference_id: invoice.id,
          });
          results.created++;
        }
      } catch (err: any) {
        console.error(`Error processing invoice ${invoice.id}:`, err);
        results.errors.push(`Invoice ${invoice.id}: ${err.message}`);
      }
    }

    console.log(`invoices completed: ${results.created} created, ${results.skipped} skipped`);
  } else if (table === 'expenses' || table === 'accounts_payable') {
    const tableName = table;
    const { data: expenses, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at')
      .limit(100); // Limitar para evitar timeout

    if (error) throw error;

    console.log(`Found ${expenses?.length || 0} ${tableName} to process`);

    // Retornar rápido se não há dados
    if (!expenses || expenses.length === 0) {
      return {
        success: true,
        created: 0,
        skipped: 0,
        errors: [],
        message: `Nenhum registro em ${tableName} para processar`
      };
    }

    for (const expense of expenses) {
      try {
        // Verificar se já existe lançamento
        const { data: existingEntry } = await supabase
          .from('accounting_entries')
          .select('id')
          .eq('reference_type', tableName)
          .eq('reference_id', expense.id)
          .eq('entry_type', 'despesa')
          .single();

        if (existingEntry) {
          results.skipped++;
          continue;
        }

        // Criar lançamento de despesa
        await createSmartAccountingEntry(supabase, userId, {
          entry_type: 'despesa',
          amount: expense.amount,
          date: expense.expense_date || expense.due_date || expense.created_at,
          description: expense.description,
          reference_type: tableName,
          reference_id: expense.id,
          expense_category: expense.category,
        });

        results.created++;

        // Se despesa está paga
        if (expense.status === 'paid' && expense.payment_date) {
          await createSmartAccountingEntry(supabase, userId, {
            entry_type: 'pagamento_despesa',
            amount: expense.amount,
            date: expense.payment_date,
            description: `Pagamento: ${expense.description}`,
            reference_type: `${tableName}_payment`,
            reference_id: expense.id,
          });
          results.created++;
        }
      } catch (err: any) {
        console.error(`Error processing expense ${expense.id}:`, err);
        results.errors.push(`Expense ${expense.id}: ${err.message}`);
      }
    }

    console.log(`${tableName} completed: ${results.created} created, ${results.skipped} skipped`);
  }

  console.log(`generateRetroactiveEntries finished for ${table}:`, results);

  return {
    success: true,
    ...results,
    message: `Criados ${results.created} lançamentos, ${results.skipped} já existiam, ${results.errors.length} erros`
  };
}

// Análise IA para sugerir conta contábil
async function aiAnalyzeTransaction(supabase: any, params: any) {
  const { description, amount, type } = params;

  // Buscar contas analíticas existentes para sugestão
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('code, name, account_type')
    .eq('is_analytical', true)
    .eq('is_active', true);

  // Lógica simples de matching (pode ser expandida com IA real)
  const keywords: Record<string, string[]> = {
    '4.1.1.01': ['salario', 'salário', 'folha', 'pagamento funcionario'],
    '4.1.2.01': ['aluguel', 'locação', 'locacao'],
    '4.1.2.02': ['energia', 'luz', 'eletrica', 'cemig', 'enel'],
    '4.1.2.03': ['telefone', 'internet', 'tim', 'vivo', 'claro', 'oi'],
    '4.1.3.02': ['tarifa', 'ted', 'doc', 'pix', 'bancaria'],
    '3.1.1.01': ['honorario', 'honorários', 'mensalidade', 'contabil'],
  };

  const descLower = description?.toLowerCase() || '';
  let suggestedCode = type === 'despesa' ? '4.1.2.99' : '3.1.2.01';

  for (const [code, words] of Object.entries(keywords)) {
    if (words.some(w => descLower.includes(w))) {
      suggestedCode = code;
      break;
    }
  }

  const suggestedAccount = accounts?.find((a: any) => a.code === suggestedCode);

  // Mapear tipo para account_type
  const accountTypeMap: Record<string, string> = {
    'despesa': 'DESPESA',
    'receita': 'RECEITA',
    'ativo': 'ATIVO',
    'passivo': 'PASSIVO',
  };
  const accountType = accountTypeMap[type?.toLowerCase()] || type?.toUpperCase();

  return {
    suggested_account: suggestedAccount || null,
    confidence: suggestedAccount ? 0.8 : 0.3,
    alternatives: accounts?.filter((a: any) => a.account_type === accountType).slice(0, 5) || [],
  };
}
