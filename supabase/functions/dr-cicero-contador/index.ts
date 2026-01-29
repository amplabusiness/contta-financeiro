import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dr. Cícero - Contador IA da Ampla Contabilidade
// Responsável por toda classificação contábil e criação de lançamentos

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Personalidade do Dr. Cícero
const DR_CICERO_PERSONA = `
Você é o Dr. Cícero, contador experiente com mais de 35 anos de experiência.
Você trabalha na Ampla Contabilidade LTDA (CNPJ: 23.893.032/0001-69) desde sua fundação.
Você é rigoroso, metódico e segue todas as normas NBC/CFC e ITG 2000.
Você NUNCA faz um lançamento contábil sem ter certeza da classificação correta.
Quando em dúvida, você SEMPRE pergunta ao usuário para confirmar.
Você é gentil mas firme - a contabilidade precisa estar perfeita.

Você fala de forma profissional mas acessível, explicando os conceitos contábeis quando necessário.
Você usa termos técnicos corretos mas explica o que significam.

=== REGRAS NBC TG 26 - CONTAS SINTÉTICAS vs ANALÍTICAS ===
NUNCA faça lançamentos diretos em contas SINTÉTICAS. São apenas totalizadoras.

CONTA SINTÉTICA 1.1.2.01 (Clientes a Receber):
- É uma conta TOTALIZADORA - não recebe lançamentos diretos!
- Lançamentos devem ir nas subcontas ANALÍTICAS: 1.1.2.01.xxxx (ex: 1.1.2.01.0001)
- Se não souber a conta analítica do cliente, use a TRANSITÓRIA

CONTA TRANSITÓRIA 1.1.9.01 (Recebimentos a Conciliar):
- Use para recebimentos de OFX/cobranças que precisam identificar o cliente
- Fluxo: OFX → Transitória → Super Conciliação → Contas Analíticas
- O desmembramento para clientes é feito na tela de Super Conciliação
- Esta conta DEVE estar ZERADA após a conciliação completa

LEMA: "Partidas dobradas sempre, duplicações nunca!"
`;

// CONTEXTO DA EMPRESA - FAMÍLIA LEÃO
const CONTEXTO_FAMILIA = `
=== INFORMAÇÕES IMPORTANTES DA AMPLA CONTABILIDADE ===

A Ampla Contabilidade LTDA (CNPJ 23.893.032/0001-69) é uma EMPRESA FAMILIAR fundada pelo
Dr. Sérgio Carneiro Leão (contador e advogado), casado com Carla Leão.

MEMBROS DA FAMÍLIA (sócios/relacionados):
1. SÉRGIO CARNEIRO LEÃO - Fundador, contador e advogado
   * Contas da CASA do Sérgio são pagas pela Ampla (usar CC: SÉRGIO CARNEIRO)
2. CARLA LEÃO - Esposa do fundador
3. SÉRGIO AUGUSTO DE OLIVEIRA LEÃO - Filho, proprietário da Ampla Saúde
   * FACULDADE DE MEDICINA paga pela Ampla (usar CC: SÉRGIO AUGUSTO)
   * Também é proprietário da clínica médica do trabalho
4. VICTOR HUGO LEÃO - Filho, trabalha com legalização de empresas
5. NAYARA LEÃO - Filha, administradora (tem 2 filhos - há despesas com babá)

IMÓVEIS E PATRIMÔNIO:
- Sede própria da empresa (prédio) - manutenções são DESPESAS DA EMPRESA (CC: EMPRESA/SEDE)

⚠️ REGRA FUNDAMENTAL: TUDO que for da família = ADIANTAMENTO A SÓCIOS (NUNCA despesa!)
- Casa do SÉRGIO CARNEIRO - ADIANTAMENTO (conta 1.1.3.01, CC: SÉRGIO CARNEIRO)
- Sítio de lazer da família - ADIANTAMENTO (conta 1.1.3.99, CC: SÍTIO)
- Casas particulares dos filhos - ADIANTAMENTO (conta do respectivo filho)
- Faculdade do Sérgio Augusto - ADIANTAMENTO (conta 1.1.3.03, CC: SÉRGIO AUGUSTO)
- Babá da Nayara - ADIANTAMENTO (conta 1.1.3.05, CC: NAYARA)
- Qualquer gasto pessoal - ADIANTAMENTO A SÓCIOS (conta 1.1.3.xx)

NÃO PODE ENTRAR COMO DESPESA DA AMPLA:
- Contas de casa (luz, água, gás, internet residencial)
- Reformas de imóveis particulares
- Despesas do sítio (manutenção, jardineiro, caseiro)
- Mensalidades de escola/faculdade
- Despesas pessoais dos sócios e familiares

INVESTIMENTOS:
- AMPLA SAÚDE (Clínica Médica do Trabalho) - Empresa do Sérgio Augusto
  * A Ampla Contabilidade está INVESTINDO mensalmente nesta empresa
  * Transferências para Ampla Saúde = INVESTIMENTO EM PARTICIPAÇÃO SOCIETÁRIA
  * Usar conta: 1.2.1.01 Investimentos - Ampla Saúde
  * Centro de Custo: AMPLA SAÚDE

=== REGRAS ESPECIAIS DE CLASSIFICAÇÃO ===

QUANDO IDENTIFICAR PIX/TRANSFERÊNCIAS PARA MEMBROS DA FAMÍLIA:
- NÃO classificar como DESPESA operacional
- NÃO classificar como RECEITA quando receber deles
- SEMPRE usar: ADIANTAMENTO A SÓCIOS (conta 1.1.3.xx ou específica)
- SEMPRE usar CENTRO DE CUSTO: "Sócios/Família" ou específico do membro

EXEMPLOS DE NOMES A IDENTIFICAR:
- SERGIO, SÉRGIO, CARNEIRO, LEÃO, LEAO
- CARLA LEAO, CARLA LEÃO
- SERGIO AUGUSTO, AMPLA SAUDE, AMPLA SAÚDE
- VICTOR HUGO, VICTOR LEAO
- NAYARA, NAYARA LEAO

DESPESAS PESSOAIS DA FAMÍLIA (usar Centro de Custo específico):
- Reformas/manutenção de casas particulares
- Despesas do sítio
- Babá da Nayara
- Qualquer gasto pessoal dos sócios

DESPESAS DA EMPRESA (Centro de Custo: Empresa/Sede):
- Manutenção do prédio sede
- Reformas da sede
- Todas as despesas operacionais

=== OBJETIVO ===
Separar corretamente o que é DESPESA DA EMPRESA do que é MOVIMENTAÇÃO PARTICULAR DOS SÓCIOS
para não distorcer o resultado contábil da Ampla Contabilidade.

=== FOLHA DE PAGAMENTO - REGIME DE COMPETÊNCIA (NBC TG 26) ===

FUNCIONÁRIOS CLT DA AMPLA:
- JOSIMAR DOS SANTOS MOTA (também faz pequenas compras/reembolso)
- ROSEMEIRE RODRIGUES
- TAYLANE BELLE FERREIRA SARAIVA
- LILIAN MOREIRA DA COSTA
- FABIANA MARIA DA SILVA MENDONÇA
- DEUZA RESENDE DE JESUS
- THAYNARA CONCEIÇÃO DE MELO

TERCEIRIZADOS (PJ - pago dia 10):
- DANIEL RODRIGUES RIBEIRO (CNPJ: 41787134000181)
- FABRICIO SOARES
- ANDREA FERREIRA / ANDREA LEONE
- CORACI ALINE
- ALEXSSANDRA FERREIRA

DATAS DE PAGAMENTO:
- Adiantamento salarial: Dia 14/15 do mês
- Pagamento de salários: Dia 29/30 do mês
- Terceirizados PJ: Dia 10 de cada mês

REGIME DE COMPETÊNCIA (OBRIGATÓRIO):
1. PROVISIONAMENTO (último dia do mês trabalhado):
   D: 4.1.1.01 (Salários e Ordenados) → Despesa entra no mês correto
   C: 2.1.1.01 (Salários a Pagar)    → Passivo fica registrado

2. PAGAMENTO (quando efetua o PIX/transferência):
   D: 2.1.1.01 (Salários a Pagar)    → Baixa do passivo
   C: 1.1.1.05 (Banco Sicredi)       → Saída do caixa

⚠️ IMPORTANTE: Quando identificar pagamento a funcionário CLT pelo extrato,
   verificar se há provisão. Se houver, fazer BAIXA DO PASSIVO (2.1.1.01).
   Se não houver provisão, criar lançamento de regime de caixa (despesa + banco).

JOSIMAR - CASO ESPECIAL:
- Funcionário CLT que também faz compras pequenas para a empresa
- Valores BAIXOS (< R$ 200) podem ser reembolsos de despesas
- Perguntar ao usuário quando identificar pagamento a Josimar
`;

// Plano de contas resumido para contexto
const PLANO_CONTAS_RESUMO = `
ATIVO (1):
- 1.1.1.01 Caixa Geral
- 1.1.1.02 Bancos Conta Movimento (Sicredi)
- 1.1.2.01 Clientes a Receber - SINTÉTICA (NUNCA lançar direto!)
- 1.1.2.01.xxxx Contas analíticas dos clientes (usar estas!)
- 1.1.9.01 Recebimentos a Conciliar (transitória para OFX/cobranças)
- 1.1.9.99 Valores Pendentes de Classificação (NOVA - entradas não classificadas)
- 1.1.3.01 Adiantamento a Sócios - Sérgio Carneiro Leão
- 1.1.3.02 Adiantamento a Sócios - Carla Leão
- 1.1.3.03 Adiantamento a Sócios - Sérgio Augusto
- 1.1.3.04 Adiantamento a Sócios - Victor Hugo
- 1.1.3.05 Adiantamento a Sócios - Nayara
- 1.1.3.99 Adiantamento a Sócios - Família (geral)
- 1.2.1.01 Investimentos - Ampla Saúde (participação societária)

PASSIVO (2):
- 2.1.1.01 Fornecedores a Pagar
- 2.1.2 Obrigações Trabalhistas - SINTÉTICA
- 2.1.2.01 Salários a Pagar (provisionamento folha CLT)
- 2.1.2.02 FGTS a Recolher
- 2.1.2.03 INSS a Recolher
- 2.1.2.04 Férias a Pagar
- 2.1.2.05 13º Salário a Pagar
- 2.1.2.06 Terceirizados a Pagar (PJ/MEI)
- 2.1.3 Obrigações Tributárias - SINTÉTICA
- 2.1.3.01 ISS a Recolher
- 2.1.3.02 IRRF a Recolher
- 2.1.3.03 Simples Nacional a Pagar
- 2.1.9.99 Saídas Pendentes de Classificação (NOVA - saídas não classificadas)

RECEITAS (3):
- 3.1.1.01 Honorários Contábeis
- 3.1.1.02 Honorários Fiscais
- 3.1.1.03 Honorários Trabalhistas
- 3.1.2 Outras Receitas

DESPESAS (4):
- 4.1.1.01 Salários e Ordenados
- 4.1.1.02 Encargos Sociais
- 4.1.2.01 Aluguel
- 4.1.2.02 Energia Elétrica
- 4.1.2.03 Telefone e Internet
- 4.1.2.04 Material de Escritório
- 4.1.2.05 Serviços de Terceiros
- 4.1.2.06 Manutenção Sede
- 4.1.3.01 Juros e Multas
- 4.1.3.02 Tarifas Bancárias - SINTÉTICA (não usar!)
- 4.1.3.02.01 Manutenção de Títulos (títulos > 3 meses sem quitar)
- 4.1.3.02.02 Tarifa Liquidação Cobrança (gerar boleto)
- 4.1.3.02.03 Cesta de Relacionamento (tarifa mensal banco)
- 4.1.3.02.99 Outras Tarifas Bancárias

⚠️ REGRA FUNDAMENTAL - CONTAS SINTÉTICAS:
- Contas sintéticas são TOTALIZADORAS (ex: 4.1.3.02, 1.1.2.01)
- NUNCA usar contas sintéticas para lançamentos!
- SEMPRE usar contas ANALÍTICAS (ex: 4.1.3.02.01, 1.1.2.01.0001)
- Contas sintéticas = RESULTADO automático da soma das filhas

PATRIMÔNIO LÍQUIDO (5):
- 5.1.1.01 Capital Social
- 5.2.1.01 Lucros Acumulados (CONTRAPARTIDA CORRETA para saldo de abertura!)
- 5.2.1.02 Saldos de Abertura (ajustes de exercícios anteriores)

=== SALDO DE ABERTURA DE CLIENTES ===
IMPORTANTE: Para criar lançamentos de saldo de abertura de clientes, usar:
  - Script: scripts/correcao_contabil/33_lancamentos_saldo_abertura.cjs
  - DÉBITO: 1.1.2.01.xxxx (conta ANALÍTICA do cliente, nunca a sintética!)
  - CRÉDITO: 5.2.1.01 (Lucros Acumulados)
  - NUNCA usar 5.3.02.02 ou contas de resultado como contrapartida!

Os triggers automáticos (trg_blindagem_saldo_abertura) foram DESABILITADOS
porque criavam lançamentos na conta sintética 1.1.2.01 incorretamente.

CENTROS DE CUSTO:
- EMPRESA/SEDE - Despesas operacionais da Ampla Contabilidade
- SÓCIOS/FAMÍLIA - Movimentações particulares dos sócios
- SÉRGIO CARNEIRO - Adiantamentos/despesas do fundador
- CARLA LEÃO - Adiantamentos/despesas da sócia
- SÉRGIO AUGUSTO - Adiantamentos/despesas (Ampla Saúde)
- VICTOR HUGO - Adiantamentos/despesas
- NAYARA - Adiantamentos/despesas (inclui babá)
- SÍTIO - Despesas do sítio de lazer
- CASAS PARTICULARES - Manutenção residências dos sócios

=== FLUXO DE CONCILIAÇÃO BANCÁRIA (ATUALIZADO 28/01/2026) ===

⚠️ REGRA CRÍTICA: Transações bancárias SÓ geram lançamentos contábeis APÓS classificação!

FLUXO CORRETO:
1. Import OFX → Cria bank_transaction (SEM entry contábil!)
2. Transação fica 'pending' aguardando classificação
3. Usuário acessa SUPER CONCILIADOR (/super-conciliation)
4. Usuário seleciona rubrica/conta para cada transação
5. Sistema chama fn_classificar_transacao_bancaria()
6. Entry contábil COMPLETO criado (SEMPRE 2 items - partida dobrada)
7. Transação marcada como 'reconciled'

CONTAS TRANSITÓRIAS PARA PENDÊNCIAS:
- 1.1.9.99 Valores Pendentes de Classificação (entradas não classificadas)
- 2.1.9.99 Saídas Pendentes de Classificação (saídas não classificadas)

FUNÇÃO DE CLASSIFICAÇÃO:
fn_classificar_transacao_bancaria(p_transaction_id, p_rubrica_id, p_account_id)
- Cria entry completo com 2 items
- Garante partida dobrada (D = C)
- NUNCA cria entry com apenas 1 item

❌ PROIBIDO:
- Criar entry no momento do import OFX
- Criar entry com apenas 1 item (desbalanceado)
- Usar conta 4.1.9.99 (sintética) para classificação

✅ CORRETO:
- Aguardar classificação no Super Conciliador
- Usar contas ANALÍTICAS (4.1.x.xx.xx)
- Entry sempre com 2 items balanceados
`;

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: 'credit' | 'debit';
  client_name?: string;
  client_id?: string;
  document?: string; // CPF/CNPJ extraído
}

// Período de abertura: Janeiro/2025 (início do sistema)
// Recebimentos neste período são de competências anteriores
// Devem ir para Saldos de Abertura (5.2.1.02), não para Receita
const PERIODO_ABERTURA = {
  inicio: '2025-01-01',
  fim: '2025-01-31'
};

function isPeriodoAbertura(date: string): boolean {
  const txDate = new Date(date);
  const inicio = new Date(PERIODO_ABERTURA.inicio);
  const fim = new Date(PERIODO_ABERTURA.fim);
  return txDate >= inicio && txDate <= fim;
}

// Verificar se cliente tem saldo de abertura pendente (débitos antigos)
async function clienteTemSaldoAbertura(supabase: any, clientId: string): Promise<{ temSaldo: boolean; saldo: number }> {
  try {
    // Buscar saldo de abertura do cliente
    const { data: openingBalance } = await supabase
      .from('client_opening_balance')
      .select('balance_amount')
      .eq('client_id', clientId)
      .maybeSingle();

    if (openingBalance && openingBalance.balance_amount > 0) {
      // Verificar quanto já foi pago deste saldo
      const { data: payments } = await supabase
        .from('accounting_entry_lines')
        .select('amount, entry_id!inner(description)')
        .eq('account_id', '1.1.2.01') // Clientes a Receber
        .eq('type', 'credit') // Créditos são baixas
        .ilike('entry_id.description', '%saldo abertura%');

      const totalPago = payments?.reduce((sum: number, p: any) => sum + Math.abs(p.amount || 0), 0) || 0;
      const saldoPendente = openingBalance.balance_amount - totalPago;

      return { temSaldo: saldoPendente > 0, saldo: Math.max(0, saldoPendente) };
    }

    return { temSaldo: false, saldo: 0 };
  } catch (error) {
    console.error('[Dr.Cícero] Erro ao verificar saldo de abertura:', error);
    return { temSaldo: false, saldo: 0 };
  }
}

interface ClassificationResult {
  confidence: number;
  debit_account: string;
  debit_account_name: string;
  credit_account: string;
  credit_account_name: string;
  entry_type: string;
  description: string;
  needs_confirmation: boolean;
  needs_account_creation?: boolean; // Indica que usuário quer criar nova conta
  question?: string;
  options?: string[];
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Supabase client com service role para consultas
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action } = body;

    console.log('[Dr.Cícero] Action:', action);

    // =====================================================
    // AÇÕES PÚBLICAS (não requerem autenticação de usuário)
    // =====================================================

    // AÇÃO: Identificar pagador pelo nome (busca em sócios/QSA dos clientes)
    if (action === 'identify_payer_by_name') {
      const { name, description } = body;
      const result = await identifyPayerByName(supabase, name || description);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Identificar cliente pelo CNPJ na descrição da transação
    if (action === 'identify_client_by_cnpj') {
      const { description } = body;
      const result = await identifyClientByCnpj(supabase, description);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Buscar membros do grupo econômico de um cliente
    if (action === 'get_economic_group_members') {
      const { client_id, cnpj } = body;
      const result = await getEconomicGroupMembers(supabase, client_id, cnpj);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Buscar boletos liquidados para reconciliação
    if (action === 'find_boletos_liquidados') {
      const { transaction_date, amount, tolerance } = body;
      const result = await findBoletosLiquidados(supabase, transaction_date, amount, tolerance || 0.50);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Carregar índice de sócios/clientes
    if (action === 'build_client_index') {
      const result = await buildClientIndex(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =====================================================
    // AÇÕES PROTEGIDAS (requerem autenticação de usuário)
    // =====================================================

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // AÇÃO: Inicializar tabela de padrões (se não existir)
    if (action === 'init_database') {
      const result = await initializeDatabase(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Analisar transação e classificar
    if (action === 'analyze_transaction') {
      const { transaction } = body;
      const result = await analyzeTransaction(supabase, transaction);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Criar lançamento após confirmação
    if (action === 'create_entry') {
      const { transaction, classification, user_confirmation } = body;
      const result = await createAccountingEntry(supabase, user.id, transaction, classification, user_confirmation);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Aprender com feedback do usuário
    if (action === 'learn_classification') {
      const { transaction, correct_classification, feedback } = body;
      const result = await learnFromFeedback(supabase, transaction, correct_classification, feedback);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Chat com Dr. Cícero
    if (action === 'chat') {
      const { message, context } = body;
      const result = await chatWithDrCicero(supabase, message, context);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Processar lote de transações
    if (action === 'process_batch') {
      const { transactions, auto_approve_threshold = 0.9 } = body;
      const result = await processBatch(supabase, user.id, transactions, auto_approve_threshold);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Validar e corrigir sinais das transações bancárias
    if (action === 'validate_transaction_signs') {
      const { bank_account_id, date_from, date_to, auto_fix = false } = body;
      const result = await validateTransactionSigns(supabase, bank_account_id, date_from, date_to, auto_fix);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Criar conta no plano de contas
    if (action === 'create_account') {
      const { code, name, account_type, nature, parent_code, description } = body;
      const result = await createChartAccount(supabase, user.id, {
        code, name, account_type, nature, parent_code, description
      });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Listar contas disponíveis por tipo
    if (action === 'list_accounts') {
      const { account_type, search } = body;
      const result = await listChartAccounts(supabase, account_type, search);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // AÇÃO: Sugerir código para nova conta
    if (action === 'suggest_account_code') {
      const { parent_code, account_type } = body;
      const result = await suggestNextAccountCode(supabase, parent_code, account_type);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Dr.Cícero] Error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Analisar transação usando IA
async function analyzeTransaction(supabase: any, transaction: Transaction): Promise<ClassificationResult> {
  console.log('[Dr.Cícero] Analyzing transaction:', transaction.description);

  // Buscar padrões aprendidos anteriormente
  const { data: patterns } = await supabase
    .from('ai_learned_patterns')
    .select('*')
    .or(`description_pattern.ilike.%${transaction.description.substring(0, 20)}%`);

  // Buscar cliente se tiver documento
  let clientInfo = null;
  if (transaction.document) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, name, cnpj, cpf')
      .or(`cnpj.eq.${transaction.document},cpf.eq.${transaction.document}`)
      .maybeSingle();
    clientInfo = client;
  }

  // Preparar contexto para IA
  const context = {
    transaction,
    clientInfo,
    patterns: patterns || [],
    plano_contas: PLANO_CONTAS_RESUMO,
  };

  // Se não tiver GEMINI_API_KEY, usar classificação baseada em regras
  // NOTA: Agora usamos a versão assíncrona que consulta os QSAs dos clientes
  if (!GEMINI_API_KEY) {
    console.log('[Dr.Cícero] No GEMINI_API_KEY, using rule-based classification with QSA lookup');
    return ruleBasedClassificationAsync(supabase, transaction, clientInfo, patterns);
  }

  // Chamar Gemini para classificação inteligente
  try {
    const prompt = buildClassificationPrompt(transaction, context);
    const geminiResponse = await callGemini(prompt);
    return parseGeminiResponse(geminiResponse, transaction);
  } catch (error) {
    console.error('[Dr.Cícero] Gemini error, falling back to rules:', error);
    return ruleBasedClassificationAsync(supabase, transaction, clientInfo, patterns);
  }
}

// Identificar membros da família Leão na descrição
function identificarFamiliaLeao(desc: string): { isFamilia: boolean; membro: string; conta: string; centroCusto: string } {
  const descLower = desc.toLowerCase();

  // Ampla Saúde - Investimento
  if (descLower.includes('ampla saude') || descLower.includes('ampla saúde') ||
      descLower.includes('clinica medica') || descLower.includes('clínica médica')) {
    return { isFamilia: true, membro: 'Ampla Saúde', conta: '1.2.1.01', centroCusto: 'AMPLA SAÚDE' };
  }

  // Sérgio Augusto (filho - Ampla Saúde)
  if (descLower.includes('sergio augusto') || descLower.includes('sérgio augusto')) {
    return { isFamilia: true, membro: 'Sérgio Augusto', conta: '1.1.3.03', centroCusto: 'SÉRGIO AUGUSTO' };
  }

  // Victor Hugo (filho)
  if (descLower.includes('victor hugo') || descLower.includes('victor leao') || descLower.includes('victor leão')) {
    return { isFamilia: true, membro: 'Victor Hugo', conta: '1.1.3.04', centroCusto: 'VICTOR HUGO' };
  }

  // Nayara (filha)
  if (descLower.includes('nayara')) {
    return { isFamilia: true, membro: 'Nayara', conta: '1.1.3.05', centroCusto: 'NAYARA' };
  }

  // Carla Leão (esposa)
  if (descLower.includes('carla leao') || descLower.includes('carla leão') || descLower.includes('carla carneiro')) {
    return { isFamilia: true, membro: 'Carla Leão', conta: '1.1.3.02', centroCusto: 'CARLA LEÃO' };
  }

  // Sérgio Carneiro Leão (fundador) - verificar por último pois "sergio" é muito comum
  if ((descLower.includes('sergio') || descLower.includes('sérgio')) &&
      (descLower.includes('carneiro') || descLower.includes('leao') || descLower.includes('leão'))) {
    return { isFamilia: true, membro: 'Sérgio Carneiro Leão', conta: '1.1.3.01', centroCusto: 'SÉRGIO CARNEIRO' };
  }

  // Babá (despesa da Nayara)
  if (descLower.includes('baba') || descLower.includes('babá')) {
    return { isFamilia: true, membro: 'Babá (Nayara)', conta: '1.1.3.05', centroCusto: 'NAYARA' };
  }

  // Sítio
  if (descLower.includes('sitio') || descLower.includes('sítio') || descLower.includes('fazenda') || descLower.includes('chacara') || descLower.includes('chácara')) {
    return { isFamilia: true, membro: 'Sítio Família', conta: '1.1.3.99', centroCusto: 'SÍTIO' };
  }

  return { isFamilia: false, membro: '', conta: '', centroCusto: '' };
}

// Classificação baseada em regras (fallback) - VERSÃO ASSÍNCRONA
async function ruleBasedClassificationAsync(
  supabase: any,
  transaction: Transaction,
  clientInfo: any,
  patterns: any[]
): Promise<ClassificationResult> {
  const desc = transaction.description.toLowerCase();
  const isCredit = transaction.type === 'credit' || transaction.amount < 0;
  const amount = Math.abs(transaction.amount);

  // Verificar se é período de abertura (Janeiro/2025)
  const isAbertura = isPeriodoAbertura(transaction.date);

  // PRIORIDADE 0: Se é crédito, verificar se há boletos liquidados importados para esta data
  // Isso resolve o problema de agregação bancária (vários boletos no mesmo dia = um crédito)
  if (isCredit) {
    const boletosResult = await findBoletosLiquidados(supabase, transaction.date, amount);

    if (boletosResult.found && boletosResult.boletos.length > 0) {
      console.log('[Dr.Cícero] Boletos liquidados encontrados:', boletosResult.total_boletos);

      // Verificar se todos são saldo de abertura
      const todosAbertura = boletosResult.boletos.every(b => b.is_opening_balance);
      const diferenca = Math.abs(amount - boletosResult.total_valor);

      // Se o valor bate exatamente (ou quase)
      if (diferenca <= 0.50) {
        const clientesList = boletosResult.boletos.map(b =>
          `• ${b.client_name}: R$ ${b.valor_pago.toFixed(2)} (${b.competencia})`
        ).join('\n');

        if (boletosResult.boletos.length === 1) {
          // Um único boleto - classificação automática
          const boleto = boletosResult.boletos[0];
          // Se é abertura OU Janeiro/2025, vai para Saldo de Abertura (5.2.1.02)
          const usarSaldoAbertura = todosAbertura || isAbertura;
          return {
            confidence: 0.98,
            debit_account: '1.1.1.02',
            debit_account_name: 'Banco Sicredi C/C',
            credit_account: usarSaldoAbertura ? '5.2.1.02' : '3.1.1.01',
            credit_account_name: usarSaldoAbertura ? 'Saldos de Abertura' : 'Honorários Contábeis',
            entry_type: usarSaldoAbertura ? 'saldo_abertura' : 'recebimento',
            description: usarSaldoAbertura
              ? `Saldo de Abertura Jan/2025: ${boleto.client_name} - ${boleto.competencia}`
              : `Recebimento boleto: ${boleto.client_name} - ${boleto.competencia}`,
            needs_confirmation: false,
            reasoning: `Dr. Cícero: Identifiquei este crédito através do relatório de boletos liquidados.\n\nCliente: ${boleto.client_name}\nCompetência: ${boleto.competencia}\nBoleto: ${boleto.numero_boleto}\n${usarSaldoAbertura ? '⚠️ SALDO DE ABERTURA - conta 5.2.1.02' : 'Receita de honorários'}`,
          };
        }

        // Múltiplos boletos - confirmar composição
        // Se é abertura OU Janeiro/2025, vai para Saldo de Abertura (5.2.1.02)
        const usarSaldoAberturaMulti = todosAbertura || isAbertura;
        return {
          confidence: 0.95,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: usarSaldoAberturaMulti ? '5.2.1.02' : '3.1.1.01',
          credit_account_name: usarSaldoAberturaMulti ? 'Saldos de Abertura' : 'Honorários Contábeis',
          entry_type: usarSaldoAberturaMulti ? 'saldo_abertura_multiplo' : 'recebimento_multiplo',
          description: usarSaldoAberturaMulti
            ? `Saldo de Abertura Jan/2025: ${boletosResult.total_boletos} boletos - R$ ${boletosResult.total_valor.toFixed(2)}`
            : `Recebimento de ${boletosResult.total_boletos} boletos - R$ ${boletosResult.total_valor.toFixed(2)}`,
          needs_confirmation: !usarSaldoAberturaMulti, // Se é abertura, não precisa confirmar
          question: usarSaldoAberturaMulti ? undefined : `Dr. Cícero: Identifiquei ${boletosResult.total_boletos} boleto(s) liquidado(s) que compõem este crédito de R$ ${amount.toFixed(2)}:\n\n${clientesList}\n\nTotal: R$ ${boletosResult.total_valor.toFixed(2)}\n\nConfirma a reconciliação?`,
          options: usarSaldoAberturaMulti ? undefined : [
            'Confirmar e reconciliar todos',
            'Selecionar boletos manualmente',
            'Não são esses boletos'
          ],
          reasoning: usarSaldoAberturaMulti
            ? `Dr. Cícero: JANEIRO/2025 = período de abertura. ${boletosResult.total_boletos} boletos classificados como SALDO DE ABERTURA. Conta: 5.2.1.02.`
            : boletosResult.reasoning,
        };
      }

      // Valor não bate - pedir seleção manual
      const clientesList = boletosResult.boletos.map(b =>
        `• ${b.client_name}: R$ ${b.valor_pago.toFixed(2)}`
      ).join('\n');

      return {
        confidence: 0.70,
        debit_account: '1.1.1.02',
        debit_account_name: 'Banco Sicredi C/C',
        credit_account: '1.1.2.01',
        credit_account_name: 'Clientes a Receber',
        entry_type: 'recebimento_parcial',
        description: `Crédito R$ ${amount.toFixed(2)} - boletos disponíveis: R$ ${boletosResult.total_valor.toFixed(2)}`,
        needs_confirmation: true,
        question: `Dr. Cícero: Encontrei ${boletosResult.total_boletos} boleto(s) nesta data totalizando R$ ${boletosResult.total_valor.toFixed(2)}, mas o crédito é de R$ ${amount.toFixed(2)} (diferença: R$ ${diferenca.toFixed(2)}).\n\nBoletos disponíveis:\n${clientesList}\n\nQual(is) boleto(s) corresponde(m) a este crédito?`,
        options: [
          'Abrir seleção manual de boletos',
          'Ignorar boletos e classificar manualmente'
        ],
        reasoning: boletosResult.reasoning,
      };
    }
  }

  // PRIORIDADE 1: Se é recebimento, tentar identificar cliente pelo CNPJ primeiro
  if (isCredit && !clientInfo) {
    const cnpjResult = await identifyClientByCnpj(supabase, transaction.description);

    if (cnpjResult.found) {
      console.log('[Dr.Cícero] Client found by CNPJ:', cnpjResult.client_nome_fantasia);

      // Se cliente pertence a grupo econômico ou tem empresas relacionadas
      if (cnpjResult.has_economic_group && cnpjResult.economic_group) {
        const group = cnpjResult.economic_group;

        // Construir lista de empresas do grupo para escolha
        const empresaOptions = group.members.map(m =>
          `${m.client_name} (R$ ${m.monthly_fee?.toFixed(2) || '0.00'})`
        );

        // Calcular valor total esperado do grupo
        const totalExpected = group.members.reduce((sum, m) => sum + (m.monthly_fee || 0), 0);

        return {
          confidence: 0.85,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '1.1.2.01',
          credit_account_name: 'Clientes a Receber',
          entry_type: 'recebimento_grupo',
          description: `Recebimento ${group.name}: R$ ${amount.toFixed(2)}`,
          needs_confirmation: true,
          question: `Dr. Cícero: Identifiquei o pagador ${cnpjResult.client_nome_fantasia} que é ${group.is_main_payer ? 'PAGADOR PRINCIPAL' : 'membro'} do ${group.name} (${group.members.length} empresas).\n\nValor recebido: R$ ${amount.toFixed(2)}\nValor total esperado do grupo: R$ ${totalExpected.toFixed(2)}\n\nComo devo ratear este pagamento?`,
          options: [
            `Ratear proporcionalmente entre as ${group.members.length} empresas`,
            'Aplicar ao cliente pagador apenas',
            'Selecionar empresas manualmente',
            ...empresaOptions.map(e => `Aplicar 100% a: ${e}`)
          ],
          reasoning: `Identificado CNPJ ${cnpjResult.cnpj} pertencente ao ${group.name}. O pagamento pode ser rateado entre: ${empresaOptions.join(', ')}.`,
        };
      }

      // Se tem empresas relacionadas (pelo QSA) mas não está em grupo formal
      if (cnpjResult.related_companies && cnpjResult.related_companies.length > 0) {
        const related = cnpjResult.related_companies;
        const empresaOptions = [
          `${cnpjResult.client_nome_fantasia} (pagador - R$ ${cnpjResult.monthly_fee?.toFixed(2) || '0.00'})`,
          ...related.map(r => `${r.client_name} (R$ ${r.monthly_fee?.toFixed(2) || '0.00'})`)
        ];

        return {
          confidence: 0.75,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '1.1.2.01',
          credit_account_name: `Clientes a Receber - ${cnpjResult.client_nome_fantasia}`,
          entry_type: 'recebimento',
          description: `Recebimento honorários: ${cnpjResult.client_nome_fantasia}`,
          needs_confirmation: true,
          question: `Dr. Cícero: Identifiquei o pagador ${cnpjResult.client_nome_fantasia} (CNPJ: ${cnpjResult.cnpj}). Encontrei ${related.length} empresa(s) relacionada(s) pelos sócios.\n\nValor recebido: R$ ${amount.toFixed(2)}\n\nEste pagamento é referente a qual(is) empresa(s)?`,
          options: [
            `Apenas ${cnpjResult.client_nome_fantasia} (pagador)`,
            'Ratear entre empresas relacionadas',
            ...empresaOptions.map(e => `100% para: ${e}`)
          ],
          reasoning: `Identificado CNPJ ${cnpjResult.cnpj}. Empresas relacionadas: ${related.map(r => r.client_name).join(', ')}.`,
        };
      }

      // Cliente encontrado sem grupo - classificação direta
      // JANEIRO/2025 = PERÍODO DE ABERTURA - TODOS vão para Saldo de Abertura (5.2.1.02)
      if (isAbertura) {
        return {
          confidence: 0.95,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '5.2.1.02',
          credit_account_name: 'Saldos de Abertura',
          entry_type: 'saldo_abertura',
          description: `Saldo de Abertura Jan/2025: ${cnpjResult.client_nome_fantasia} (CNPJ: ${cnpjResult.cnpj})`,
          needs_confirmation: false,
          reasoning: `Dr. Cícero: JANEIRO/2025 = período de abertura. Receita de R$ ${amount.toFixed(2)} de ${cnpjResult.client_nome_fantasia} classificada como SALDO DE ABERTURA. Conta: 5.2.1.02.`,
        };
      }

      // Verificar saldo de abertura pendente
      const saldoInfo = await clienteTemSaldoAbertura(supabase, cnpjResult.client_id!);

      if (saldoInfo.temSaldo) {
        return {
          confidence: 0.80,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '1.1.2.01',
          credit_account_name: `Clientes a Receber - ${cnpjResult.client_nome_fantasia}`,
          entry_type: 'recebimento',
          description: `Recebimento honorários: ${cnpjResult.client_nome_fantasia}`,
          needs_confirmation: true,
          question: `Dr. Cícero: Identifiquei ${cnpjResult.client_nome_fantasia} pelo CNPJ. O cliente tem saldo devedor de R$ ${saldoInfo.saldo.toFixed(2)} de períodos anteriores.\n\nEste pagamento de R$ ${amount.toFixed(2)} é:`,
          options: [
            `Pagamento de dívida antiga (baixa saldo de R$ ${saldoInfo.saldo.toFixed(2)})`,
            'Honorário da competência atual (receita nova)',
            'Dividir entre dívida antiga e competência atual'
          ],
          reasoning: `Identificado pelo CNPJ ${cnpjResult.cnpj}. Cliente tem saldo devedor antigo.`,
        };
      }

      // Recebimento normal
      return {
        confidence: 0.90,
        debit_account: '1.1.1.02',
        debit_account_name: 'Banco Sicredi C/C',
        credit_account: '1.1.2.01',
        credit_account_name: `Clientes a Receber - ${cnpjResult.client_nome_fantasia}`,
        entry_type: 'recebimento',
        description: `Recebimento honorários (CNPJ): ${cnpjResult.client_nome_fantasia}`,
        needs_confirmation: false,
        reasoning: `Dr. Cícero: Identifiquei ${cnpjResult.client_nome_fantasia} pelo CNPJ ${cnpjResult.cnpj}. Classificado como honorário regular.`,
      };
    }
  }

  // PRIORIDADE 0: Se é recebimento, tentar identificar pagador pelo nome no QSA
  if (isCredit && !clientInfo) {
    const payerResult = await identifyPayerByName(supabase, transaction.description);

    if (payerResult.found && payerResult.confidence >= 0.5) {
      // Se encontrou o pagador nos QSA dos clientes

      // Contar quantas empresas este sócio está vinculado
      const uniqueClients = payerResult.matches?.reduce((acc, m) => {
        if (!acc.find(c => c.client_id === m.client_id)) {
          acc.push(m);
        }
        return acc;
      }, [] as typeof payerResult.matches) || [];

      // Se tem APENAS UMA EMPRESA, classificar direto!
      if (uniqueClients.length === 1) {
        const match = uniqueClients[0];

        // JANEIRO/2025 = PERÍODO DE ABERTURA - TODOS vão para Saldo de Abertura (5.2.1.02)
        if (isAbertura) {
          return {
            confidence: 0.95,
            debit_account: '1.1.1.02',
            debit_account_name: 'Banco Sicredi C/C',
            credit_account: '5.2.1.02',
            credit_account_name: 'Saldos de Abertura',
            entry_type: 'saldo_abertura',
            description: `Saldo de Abertura Jan/2025: ${payerResult.payer_name} - ${match.client_name}`,
            needs_confirmation: false,
            reasoning: `Dr. Cícero: JANEIRO/2025 = período de abertura. Receita de R$ ${amount.toFixed(2)} de ${match.client_name} (pagador: ${payerResult.payer_name}) classificada como SALDO DE ABERTURA. Conta: 5.2.1.02.`,
          };
        }

        // Verificar se cliente tem saldo de abertura pendente (débitos antigos)
        const saldoInfo = await clienteTemSaldoAbertura(supabase, match.client_id);

        if (saldoInfo.temSaldo) {
          // Cliente tem débitos antigos - perguntar se é pagamento de dívida antiga ou competência atual
          return {
            confidence: 0.80,
            debit_account: '1.1.1.02',
            debit_account_name: 'Banco Sicredi C/C',
            credit_account: '1.1.2.01',
            credit_account_name: `Clientes a Receber - ${match.client_name}`,
            entry_type: 'recebimento',
            description: `Recebimento honorários: ${payerResult.payer_name} - ${match.client_name}`,
            needs_confirmation: true,
            question: `Dr. Cícero: O cliente ${match.client_name} tem um saldo devedor de R$ ${saldoInfo.saldo.toFixed(2)} de períodos anteriores. Este pagamento de R$ ${amount.toFixed(2)} é referente a:\n\n1. Pagamento de DÍVIDA ANTIGA (baixa do saldo de abertura)\n2. Honorário da COMPETÊNCIA ATUAL (gera receita nova)`,
            options: [
              `É pagamento de dívida antiga (baixa saldo de R$ ${saldoInfo.saldo.toFixed(2)})`,
              'É honorário da competência atual (receita nova)',
              'É um pouco de cada (preciso dividir o valor)'
            ],
            reasoning: `Identifiquei "${payerResult.payer_name}" como ${match.relationship} do cliente ${match.client_name}. O cliente tem saldo devedor de R$ ${saldoInfo.saldo.toFixed(2)} de períodos anteriores. Preciso saber se este pagamento é para quitar dívida antiga ou é receita nova.`,
          };
        }

        // Sem saldo antigo - é receita normal
        return {
          confidence: 0.85,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '1.1.2.01',
          credit_account_name: `Clientes a Receber - ${match.client_name}`,
          entry_type: 'recebimento',
          description: `Recebimento honorários (${match.relationship}): ${payerResult.payer_name} - ${match.client_name}`,
          needs_confirmation: false,
          reasoning: `Dr. Cícero: Identifiquei "${payerResult.payer_name}" como ${match.relationship} do cliente ${match.client_name}. Cliente sem débitos antigos - classificado como honorário regular.`,
        };
      }

      // Se tem MÚLTIPLAS EMPRESAS
      if (uniqueClients.length > 1) {
        const empresaOptions = uniqueClients.map(c =>
          `${c.client_name} (${c.relationship})`
        );

        // JANEIRO/2025 = PERÍODO DE ABERTURA - ir direto para saldo de abertura SEM PERGUNTAR
        if (isAbertura) {
          return {
            confidence: 0.90,
            debit_account: '1.1.1.02',
            debit_account_name: 'Banco Sicredi C/C',
            credit_account: '5.2.1.02',
            credit_account_name: 'Saldos de Abertura',
            entry_type: 'recebimento_abertura_generico',
            description: `Recebimento saldo abertura: ${payerResult.payer_name} - R$ ${amount.toFixed(2)}`,
            needs_confirmation: false,
            reasoning: `Dr. Cícero: JANEIRO/2025 = período de abertura. Receita de R$ ${amount.toFixed(2)} classificada como SALDO DE ABERTURA (competência anterior). Pagador: ${payerResult.payer_name}. Não é necessário identificar qual empresa pois vai para ajuste de PL.`,
          };
        }

        // Fora do período de abertura - perguntar qual empresa
        return {
          confidence: payerResult.confidence,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '1.1.2.01',
          credit_account_name: 'Clientes a Receber',
          entry_type: 'recebimento',
          description: `Recebimento honorários: ${payerResult.payer_name}`,
          needs_confirmation: true,
          question: `Dr. Cícero pergunta: Identifiquei "${payerResult.payer_name}" como sócio de ${uniqueClients.length} empresas. De qual empresa este pagamento de R$ ${amount.toFixed(2)} é honorário?`,
          options: [...empresaOptions, 'Nenhuma dessas - é outro tipo de receita'],
          reasoning: `Identificado "${payerResult.payer_name}" em ${uniqueClients.length} empresas: ${empresaOptions.join(', ')}. Preciso saber de qual empresa é o honorário.`,
        };
      }
    }
  }

  // PRIORIDADE 1: Verificar se é transação da família Leão
  const familiaCheck = identificarFamiliaLeao(transaction.description);
  if (familiaCheck.isFamilia) {
    if (isCredit) {
      // Recebimento de membro da família = devolução de adiantamento
      return {
        confidence: 0.85,
        debit_account: '1.1.1.02',
        debit_account_name: 'Banco Sicredi C/C',
        credit_account: familiaCheck.conta,
        credit_account_name: `Adiantamento - ${familiaCheck.membro}`,
        entry_type: 'devolucao_adiantamento',
        description: `Devolução adiantamento: ${familiaCheck.membro}`,
        needs_confirmation: true,
        question: `Dr. Cícero pergunta: Identifiquei um recebimento de R$ ${amount.toFixed(2)} relacionado a ${familiaCheck.membro}. É uma devolução de adiantamento?`,
        options: ['Sim, é devolução de adiantamento', 'Não, é outra coisa'],
        reasoning: `Identificado membro da família Leão: ${familiaCheck.membro}. Centro de Custo: ${familiaCheck.centroCusto}`,
      };
    } else {
      // Pagamento para membro da família = adiantamento a sócios (NÃO é despesa!)
      const isInvestimento = familiaCheck.membro === 'Ampla Saúde';
      return {
        confidence: 0.90,
        debit_account: familiaCheck.conta,
        debit_account_name: isInvestimento ? 'Investimento - Ampla Saúde' : `Adiantamento - ${familiaCheck.membro}`,
        credit_account: '1.1.1.02',
        credit_account_name: 'Banco Sicredi C/C',
        entry_type: isInvestimento ? 'investimento' : 'adiantamento_socio',
        description: isInvestimento ? `Investimento Ampla Saúde: ${transaction.description}` : `Adiantamento ${familiaCheck.membro}: ${transaction.description}`,
        needs_confirmation: true,
        question: isInvestimento
          ? `Dr. Cícero pergunta: Identifiquei uma transferência de R$ ${amount.toFixed(2)} para Ampla Saúde. É investimento na clínica?`
          : `Dr. Cícero pergunta: Identifiquei uma saída de R$ ${amount.toFixed(2)} para ${familiaCheck.membro}. É adiantamento a sócio/família?`,
        options: isInvestimento
          ? ['Sim, é investimento na Ampla Saúde', 'Não, é outra coisa']
          : ['Sim, é adiantamento', 'É despesa pessoal do sócio', 'É outra coisa'],
        reasoning: `ATENÇÃO: Identificado ${familiaCheck.membro} (família). NÃO classificar como despesa operacional! Centro de Custo: ${familiaCheck.centroCusto}`,
      };
    }
  }

  // Verificar padrões aprendidos
  const matchedPattern = patterns?.find(p =>
    desc.includes(p.description_pattern?.toLowerCase() || '')
  );

  if (matchedPattern) {
    return {
      confidence: 0.95,
      debit_account: matchedPattern.debit_account,
      debit_account_name: matchedPattern.debit_account_name,
      credit_account: matchedPattern.credit_account,
      credit_account_name: matchedPattern.credit_account_name,
      entry_type: matchedPattern.entry_type,
      description: `${matchedPattern.entry_description}: ${transaction.description}`,
      needs_confirmation: false,
      reasoning: `Padrão aprendido anteriormente: "${matchedPattern.description_pattern}"`,
    };
  }

  // Se é crédito (recebimento)
  if (isCredit) {
    // Verificar se é PIX ou boleto de cliente
    if (desc.includes('pix') || desc.includes('liq.cobranca')) {
      // JANEIRO/2025 = PERÍODO DE ABERTURA - TODOS vão para Saldo de Abertura (5.2.1.02)
      if (isAbertura) {
        return {
          confidence: 0.95,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '5.2.1.02',
          credit_account_name: 'Saldos de Abertura',
          entry_type: 'saldo_abertura',
          description: `Saldo de Abertura Jan/2025: ${transaction.description}`,
          needs_confirmation: false,
          reasoning: `Dr. Cícero: JANEIRO/2025 = período de abertura. Receita de R$ ${amount.toFixed(2)} classificada como SALDO DE ABERTURA. Conta: 5.2.1.02.`,
        };
      }

      if (clientInfo) {
        return {
          confidence: 0.85,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '1.1.2.01',
          credit_account_name: `Cliente: ${clientInfo.name}`,
          entry_type: 'recebimento',
          description: `Recebimento honorários: ${clientInfo.name}`,
          needs_confirmation: true,
          question: `Dr. Cícero pergunta: Este recebimento de R$ ${amount.toFixed(2)} via ${desc.includes('pix') ? 'PIX' : 'Boleto'} é referente a honorários do cliente ${clientInfo.name}?`,
          options: ['Sim, é honorário deste cliente', 'Não, é de outro cliente', 'É outro tipo de receita'],
          reasoning: `Identifiquei o cliente ${clientInfo.name} pelo CPF/CNPJ. Preciso confirmar se é honorário.`,
        };
      } else {
        // JANEIRO/2025 = Período de abertura - recebimentos são de competências anteriores
        // REGRA DECISÃO FINAL: ir DIRETO para saldo de abertura SEM PERGUNTAR
        if (isAbertura) {
          return {
            confidence: 0.95,
            debit_account: '1.1.1.02',
            debit_account_name: 'Banco Sicredi C/C',
            credit_account: '5.2.1.02',
            credit_account_name: 'Saldos de Abertura',
            entry_type: 'saldo_abertura',
            description: `Saldo de Abertura Jan/2025: ${transaction.description}`,
            needs_confirmation: false,
            reasoning: `Dr. Cícero: JANEIRO/2025 = período de abertura. Receita de R$ ${amount.toFixed(2)} classificada automaticamente como SALDO DE ABERTURA (competência anterior). Conta: 5.2.1.02.`,
          };
        }
        return {
          confidence: 0.5,
          debit_account: '1.1.1.02',
          debit_account_name: 'Banco Sicredi C/C',
          credit_account: '3.1.2.01',
          credit_account_name: 'Outras Receitas',
          entry_type: 'receita',
          description: `Recebimento: ${transaction.description}`,
          needs_confirmation: true,
          question: `Dr. Cícero pergunta: Recebi um crédito de R$ ${amount.toFixed(2)} mas não identifiquei o cliente. Qual é a natureza desta receita?`,
          options: ['É honorário de cliente (informar qual)', 'É receita financeira', 'É devolução/reembolso', 'Outro'],
          reasoning: 'Não consegui identificar o cliente pelo documento. Preciso de mais informações.',
        };
      }
    }
  } else {
    // Débitos (despesas)
    // Tarifas bancárias - Classificação analítica por tipo
    // IMPORTANTE: LIQ.COBRANCA NÃO é tarifa - é recebimento de cliente!
    if (!desc.includes('liq.cobranca') && !desc.includes('liq cobranca') &&
        (desc.includes('tarifa') || desc.includes('tar.') || desc.includes('manutencao de titulos') || desc.includes('cesta de relacionamento'))) {

      // Classificar na conta analítica correta
      let debitAccount = '4.1.3.02.99'; // Outras Tarifas Bancárias (fallback)
      let debitAccountName = 'Outras Tarifas Bancárias';

      if (desc.includes('manutencao de titulos')) {
        debitAccount = '4.1.3.02.01';
        debitAccountName = 'Manutenção de Títulos';
      } else if (desc.includes('tarifa com r liquidacao') || desc.includes('tarifa liquidacao')) {
        debitAccount = '4.1.3.02.02';
        debitAccountName = 'Tarifa Liquidação Cobrança';
      } else if (desc.includes('cesta de relacionamento')) {
        debitAccount = '4.1.3.02.03';
        debitAccountName = 'Cesta de Relacionamento';
      }

      return {
        confidence: 0.95,
        debit_account: debitAccount,
        debit_account_name: debitAccountName,
        credit_account: '1.1.1.05',
        credit_account_name: 'Banco Sicredi',
        entry_type: 'DESPESA_BANCARIA',
        description: `${debitAccountName}: ${transaction.description}`,
        needs_confirmation: false,
        reasoning: `Identificado como ${debitAccountName} pela descrição.`,
      };
    }

    // TED/DOC são tarifas genéricas
    if (desc.includes('ted') || desc.includes('doc')) {
      return {
        confidence: 0.90,
        debit_account: '4.1.3.02.99',
        debit_account_name: 'Outras Tarifas Bancárias',
        credit_account: '1.1.1.05',
        credit_account_name: 'Banco Sicredi',
        entry_type: 'DESPESA_BANCARIA',
        description: `Tarifa TED/DOC: ${transaction.description}`,
        needs_confirmation: false,
        reasoning: 'Identificado como tarifa de transferência (TED/DOC).',
      };
    }

    // Transferências e PIX - PERGUNTAR TIPO ESPECÍFICO
    if (desc.includes('transf') || desc.includes('pix enviado') || desc.includes('pix_deb') || desc.includes('pix')) {
      return {
        confidence: 0.4,
        debit_account: '4.1.2.05',
        debit_account_name: 'Serviços de Terceiros',
        credit_account: '1.1.1.05',
        credit_account_name: 'Banco Sicredi',
        entry_type: 'pagamento',
        description: `Transferência: ${transaction.description}`,
        needs_confirmation: true,
        question: `Dr. Cícero pergunta: Identifiquei uma saída de R$ ${amount.toFixed(2)} via ${desc.includes('pix') ? 'PIX' : 'Transferência'}.\n\n"${transaction.description}"\n\nQual a natureza deste pagamento?`,
        options: [
          '💼 ADIANTAMENTO A SÓCIO (não é despesa, vai para Ativo)',
          '🏢 DESPESA DA EMPRESA (vai para DRE)',
          '📋 PAGAMENTO DE FORNECEDOR (baixa de obrigação)',
          '💰 INVESTIMENTO (Ampla Saúde ou outro)',
          '🔄 TRANSFERÊNCIA ENTRE CONTAS',
          '➕ CRIAR NOVA CONTA (classificação específica)',
          '❓ OUTRO (especificar)'
        ],
        reasoning: 'IMPORTANTE: Adiantamento a sócio NÃO é despesa! Vai para conta 1.1.3.xx (Ativo). Despesa só se for gasto operacional da empresa.',
      };
    }
  }

  // PERÍODO DE ABERTURA (Janeiro/2025): Priorizar Saldo de Abertura para créditos
  if (isAbertura && isCredit) {
    return {
      confidence: 0.85,
      debit_account: '1.1.1.02',
      debit_account_name: 'Banco Sicredi C/C',
      credit_account: '5.2.1.02',
      credit_account_name: 'Saldos de Abertura',
      entry_type: 'saldo_abertura',
      description: `Saldo de Abertura Jan/2025: ${transaction.description}`,
      needs_confirmation: true,
      question: `Dr. Cícero: JANEIRO/2025 é o período de abertura do sistema. Este recebimento de R$ ${amount.toFixed(2)} é referente a competências anteriores.\n\nDevo classificar como SALDO DE ABERTURA?`,
      options: [
        'Sim, é saldo de abertura (competência anterior)',
        'Não, é receita nova de janeiro/2025',
        'É honorário de cliente específico'
      ],
      reasoning: `Dr. Cícero: Janeiro/2025 é mês de abertura. Recebimentos neste período são de competências anteriores → conta 5.2.1.02 (Saldos de Abertura).`,
    };
  }

  // Classificação genérica - sempre pedir confirmação
  return {
    confidence: 0.3,
    debit_account: isCredit ? '1.1.1.02' : '4.1.2.99',
    debit_account_name: isCredit ? 'Banco Sicredi C/C' : 'Outras Despesas',
    credit_account: isCredit ? '3.1.2.01' : '1.1.1.02',
    credit_account_name: isCredit ? 'Outras Receitas' : 'Banco Sicredi C/C',
    entry_type: isCredit ? 'receita_diversa' : 'despesa_diversa',
    description: transaction.description,
    needs_confirmation: true,
    question: isCredit
      ? `Dr. Cícero pergunta: Não consegui identificar a natureza desta receita de R$ ${amount.toFixed(2)}:\n\n"${transaction.description}"\n\nPode me ajudar a classificar?`
      : `Dr. Cícero pergunta: Identifiquei uma saída de R$ ${amount.toFixed(2)}:\n\n"${transaction.description}"\n\n⚠️ IMPORTANTE: Adiantamento a sócio NÃO é despesa!\n\nQual a natureza deste pagamento?`,
    options: isCredit
      ? ['Honorários de cliente', 'Receita financeira', 'Devolução/Reembolso', '➕ Criar nova conta', 'Outro']
      : [
          '💼 ADIANTAMENTO A SÓCIO (não é despesa, vai para Ativo)',
          '🏢 DESPESA DA EMPRESA (vai para DRE)',
          '📋 PAGAMENTO DE FORNECEDOR (baixa de obrigação)',
          '💰 INVESTIMENTO (Ampla Saúde ou outro)',
          '🔄 TRANSFERÊNCIA ENTRE CONTAS',
          '➕ CRIAR NOVA CONTA (classificação específica)',
          '❓ OUTRO (especificar)'
        ],
    reasoning: isCredit
      ? 'Não encontrei padrão conhecido. Preciso de ajuda para classificar corretamente.'
      : 'IMPORTANTE: Adiantamento a sócio NÃO é despesa! Vai para conta 1.1.3.xx (Ativo). Despesa só se for gasto operacional da empresa.',
  };
}

// Construir prompt para Gemini
function buildClassificationPrompt(transaction: Transaction, context: any): string {
  // Verificar se é transação da família antes de montar o prompt
  const familiaCheck = identificarFamiliaLeao(transaction.description);

  return `
${DR_CICERO_PERSONA}

${CONTEXTO_FAMILIA}

CONTEXTO DO SISTEMA:
Você está analisando transações bancárias da Ampla Contabilidade para criar lançamentos contábeis.
Este é o plano de contas disponível:
${context.plano_contas}

TRANSAÇÃO A ANALISAR:
- Descrição: ${transaction.description}
- Valor: R$ ${Math.abs(transaction.amount).toFixed(2)}
- Tipo: ${transaction.type === 'credit' || transaction.amount < 0 ? 'CRÉDITO (entrada)' : 'DÉBITO (saída)'}
- Data: ${transaction.date}
${context.clientInfo ? `- Cliente identificado: ${context.clientInfo.name} (${context.clientInfo.cnpj || context.clientInfo.cpf})` : '- Cliente: NÃO IDENTIFICADO'}
${familiaCheck.isFamilia ? `\n⚠️ ATENÇÃO: IDENTIFICADO MEMBRO DA FAMÍLIA LEÃO: ${familiaCheck.membro}\n   Conta sugerida: ${familiaCheck.conta}\n   Centro de Custo: ${familiaCheck.centroCusto}` : ''}

PADRÕES APRENDIDOS ANTERIORMENTE:
${context.patterns?.length > 0
  ? context.patterns.map((p: any) => `- "${p.description_pattern}" → ${p.entry_type}`).join('\n')
  : 'Nenhum padrão similar encontrado'}

TAREFA:
Analise esta transação e responda em JSON com a seguinte estrutura:
{
  "confidence": 0.0 a 1.0 (quão certo você está da classificação),
  "debit_account": "código da conta débito",
  "debit_account_name": "nome da conta débito",
  "credit_account": "código da conta crédito",
  "credit_account_name": "nome da conta crédito",
  "entry_type": "tipo do lançamento",
  "description": "descrição do lançamento contábil",
  "cost_center": "centro de custo (obrigatório para família/sócios)",
  "needs_confirmation": true/false (se precisa perguntar ao usuário),
  "question": "pergunta para o usuário se needs_confirmation=true",
  "options": ["opção1", "opção2"] se houver opções de resposta,
  "reasoning": "seu raciocínio contábil para esta classificação"
}

REGRAS IMPORTANTES:
1. Se confidence < 0.8, SEMPRE defina needs_confirmation=true
2. Honorários de clientes são a principal receita da empresa
3. Recebimentos de períodos anteriores devem ir para conta 5.2.1.02 (Saldos de Abertura)

⚠️ REGRA CRÍTICA - PERÍODO DE ABERTURA (JANEIRO/2025):
- Janeiro/2025 é o PRIMEIRO MÊS do sistema
- Os saldos dos clientes já foram registrados em Clientes a Receber (1.1.2.xx) via Saldo de Abertura
- Recebimentos em janeiro BAIXAM o Clientes a Receber, NÃO geram receita nova
- NÃO classificar como Receita (3.x.x.xx) - distorceria o resultado de 2025
- Lançamento correto: D: Banco (1.1.1.02) | C: Clientes a Receber (1.1.2.01)
- O efeito é: reduz o ativo (recebível) e aumenta outro ativo (banco)
- needs_confirmation: false (é regra fixa)

REGRAS ESPECIAIS PARA FAMÍLIA LEÃO:
4. NUNCA classificar transferências para membros da família como DESPESA operacional
5. Transferências PARA sócios/família = ADIANTAMENTO A SÓCIOS (conta 1.1.3.xx)
6. Transferências DA família = DEVOLUÇÃO DE ADIANTAMENTO (credita conta 1.1.3.xx)
7. Transferências para AMPLA SAÚDE = INVESTIMENTO (conta 1.2.1.01)
8. Recebimentos da AMPLA SAÚDE = DEVOLUÇÃO DE INVESTIMENTO (credita 1.2.1.01)
9. SEMPRE usar o Centro de Custo adequado para rastreabilidade
10. O controle de adiantamentos/investimentos permite cobrar devolução futura
4. Débito aumenta Ativo e Despesa, diminui Passivo e Receita
5. Crédito aumenta Passivo e Receita, diminui Ativo e Despesa

Responda APENAS com o JSON, sem explicações adicionais.
`;
}

// Chamar API do Gemini
async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Parsear resposta do Gemini
function parseGeminiResponse(response: string, transaction: Transaction): ClassificationResult {
  try {
    // Extrair JSON da resposta
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      confidence: parsed.confidence || 0.5,
      debit_account: parsed.debit_account || '4.1.2.99',
      debit_account_name: parsed.debit_account_name || 'Outras Despesas',
      credit_account: parsed.credit_account || '1.1.1.02',
      credit_account_name: parsed.credit_account_name || 'Banco',
      entry_type: parsed.entry_type || 'diverso',
      description: parsed.description || transaction.description,
      needs_confirmation: parsed.needs_confirmation ?? true,
      question: parsed.question,
      options: parsed.options,
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    console.error('[Dr.Cícero] Error parsing Gemini response:', error);
    // Fallback para classificação genérica (síncrona)
    return ruleBasedClassificationSync(transaction);
  }
}

// Classificação síncrona simplificada (para fallback do Gemini)
function ruleBasedClassificationSync(transaction: Transaction): ClassificationResult {
  const desc = transaction.description.toLowerCase();
  const isCredit = transaction.type === 'credit' || transaction.amount < 0;
  const amount = Math.abs(transaction.amount);

  // JANEIRO/2025 = PERÍODO DE ABERTURA
  // Todos os recebimentos são de competências anteriores e devem ir para Saldo de Abertura
  const isAbertura = isPeriodoAbertura(transaction.date);

  // Verificar família Leão
  const familiaCheck = identificarFamiliaLeao(transaction.description);
  if (familiaCheck.isFamilia) {
    if (isCredit) {
      return {
        confidence: 0.7,
        debit_account: '1.1.1.02',
        debit_account_name: 'Banco Sicredi C/C',
        credit_account: familiaCheck.conta,
        credit_account_name: `Adiantamento - ${familiaCheck.membro}`,
        entry_type: 'devolucao_adiantamento',
        description: `Devolução adiantamento: ${familiaCheck.membro}`,
        needs_confirmation: true,
        question: `Recebimento de R$ ${amount.toFixed(2)} de ${familiaCheck.membro}. É devolução de adiantamento?`,
        options: ['Sim', 'Não'],
        reasoning: `Identificado membro da família: ${familiaCheck.membro}`,
      };
    } else {
      return {
        confidence: 0.8,
        debit_account: familiaCheck.conta,
        debit_account_name: `Adiantamento - ${familiaCheck.membro}`,
        credit_account: '1.1.1.02',
        credit_account_name: 'Banco Sicredi C/C',
        entry_type: 'adiantamento_socio',
        description: `Adiantamento ${familiaCheck.membro}`,
        needs_confirmation: true,
        question: `Saída de R$ ${amount.toFixed(2)} para ${familiaCheck.membro}. É adiantamento a sócio?`,
        options: ['Sim', 'Não'],
        reasoning: `Identificado membro da família: ${familiaCheck.membro}`,
      };
    }
  }

  // PERÍODO DE ABERTURA (Janeiro/2025): Classificar como Saldo de Abertura
  if (isAbertura && isCredit) {
    return {
      confidence: 0.85,
      debit_account: '1.1.1.02',
      debit_account_name: 'Banco Sicredi C/C',
      credit_account: '5.2.1.02',
      credit_account_name: 'Saldos de Abertura',
      entry_type: 'saldo_abertura',
      description: `Saldo de Abertura Jan/2025: ${transaction.description}`,
      needs_confirmation: true,
      question: `Dr. Cícero: JANEIRO/2025 é o período de abertura do sistema. Este recebimento de R$ ${amount.toFixed(2)} é referente a competências anteriores.\n\nDevo classificar como SALDO DE ABERTURA (ajuste de exercícios anteriores)?`,
      options: [
        'Sim, é saldo de abertura (competência anterior)',
        'Não, é receita nova de janeiro/2025',
        'É honorário de cliente específico'
      ],
      reasoning: `Dr. Cícero: Janeiro/2025 é mês de abertura. Recebimentos neste período são de competências anteriores e devem ir para conta 5.2.1.02 (Saldos de Abertura), não para Receita.`,
    };
  }

  // Classificação genérica para outros meses
  return {
    confidence: 0.3,
    debit_account: isCredit ? '1.1.1.02' : '4.1.2.99',
    debit_account_name: isCredit ? 'Banco Sicredi C/C' : 'Outras Despesas',
    credit_account: isCredit ? '3.1.2.01' : '1.1.1.02',
    credit_account_name: isCredit ? 'Outras Receitas' : 'Banco Sicredi C/C',
    entry_type: isCredit ? 'receita_diversa' : 'despesa_diversa',
    description: transaction.description,
    needs_confirmation: true,
    question: `Não identifiquei a natureza desta ${isCredit ? 'receita' : 'despesa'} de R$ ${amount.toFixed(2)}. Pode me ajudar?`,
    options: isCredit
      ? ['Honorários de cliente', 'Receita financeira', 'Outro']
      : ['Despesa com pessoal', 'Despesa administrativa', 'Serviços de terceiros', 'Outro'],
    reasoning: 'Classificação genérica - aguardando confirmação do usuário.',
  };
}

// Criar lançamento contábil após confirmação
async function createAccountingEntry(
  supabase: any,
  userId: string,
  transaction: Transaction,
  classification: ClassificationResult,
  userConfirmation?: string
): Promise<any> {
  console.log('[Dr.Cícero] Creating entry for:', transaction.description);

  // Se usuário forneceu confirmação, ajustar classificação
  let finalClassification = { ...classification };
  if (userConfirmation) {
    // Processar resposta do usuário e ajustar classificação
    finalClassification = adjustClassificationBasedOnFeedback(classification, userConfirmation);
  }

  // Chamar smart-accounting para criar o lançamento
  const { data, error } = await supabase.functions.invoke('smart-accounting', {
    body: {
      action: 'create_entry',
      entry_type: finalClassification.entry_type,
      amount: Math.abs(transaction.amount),
      date: transaction.date,
      description: finalClassification.description,
      client_id: transaction.client_id,
      reference_type: 'bank_transaction',
      reference_id: transaction.id,
    }
  });

  if (error) {
    throw error;
  }

  // Marcar transação como processada
  await supabase
    .from('bank_transactions')
    .update({
      matched: true,
      ai_confidence: finalClassification.confidence,
      ai_suggestion: finalClassification.reasoning,
    })
    .eq('id', transaction.id);

  // Salvar padrão aprendido para futuras classificações
  await saveLearnedPattern(supabase, transaction, finalClassification);

  return {
    success: true,
    message: `Dr. Cícero: Lançamento contábil criado com sucesso!`,
    entry: data,
    classification: finalClassification,
  };
}

// Ajustar classificação baseado no feedback
function adjustClassificationBasedOnFeedback(
  classification: ClassificationResult,
  feedback: string
): ClassificationResult {
  const adjusted = { ...classification };
  const feedbackLower = feedback.toLowerCase();

  // PRIORIDADE 1: ADIANTAMENTO A SÓCIO (NÃO É DESPESA!)
  if (feedbackLower.includes('adiantamento') || feedbackLower.includes('sócio') || feedbackLower.includes('socio')) {
    adjusted.entry_type = 'adiantamento_socio';
    adjusted.debit_account = '1.1.3.04'; // Adiantamentos a Sócios (genérico)
    adjusted.debit_account_name = 'Adiantamentos a Sócios';
    adjusted.credit_account = '1.1.1.02';
    adjusted.credit_account_name = 'Banco Sicredi C/C';
    adjusted.description = `Adiantamento a Sócio: ${classification.description}`;
    console.log('[Dr.Cícero] Classificado como ADIANTAMENTO A SÓCIO - NÃO vai para DRE');
  }
  // PRIORIDADE 2: INVESTIMENTO (Ampla Saúde)
  else if (feedbackLower.includes('investimento') || feedbackLower.includes('ampla saúde') || feedbackLower.includes('ampla saude')) {
    adjusted.entry_type = 'investimento';
    adjusted.debit_account = '1.2.1.01';
    adjusted.debit_account_name = 'Investimentos - Ampla Saúde';
    adjusted.credit_account = '1.1.1.02';
    adjusted.credit_account_name = 'Banco Sicredi C/C';
    adjusted.description = `Investimento Ampla Saúde: ${classification.description}`;
    console.log('[Dr.Cícero] Classificado como INVESTIMENTO - NÃO vai para DRE');
  }
  // PRIORIDADE 3: TRANSFERÊNCIA ENTRE CONTAS
  else if (feedbackLower.includes('transferência entre') || feedbackLower.includes('transferencia entre')) {
    adjusted.entry_type = 'transferencia_interna';
    adjusted.debit_account = '1.1.1.01'; // Outra conta bancária
    adjusted.debit_account_name = 'Caixa Geral';
    adjusted.credit_account = '1.1.1.02';
    adjusted.credit_account_name = 'Banco Sicredi C/C';
    adjusted.description = `Transferência entre contas: ${classification.description}`;
    console.log('[Dr.Cícero] Classificado como TRANSFERÊNCIA ENTRE CONTAS - NÃO vai para DRE');
  }
  // PRIORIDADE 4: PAGAMENTO DE FORNECEDOR (baixa de passivo)
  else if (feedbackLower.includes('fornecedor') || feedbackLower.includes('pagamento')) {
    adjusted.entry_type = 'pagamento_fornecedor';
    adjusted.debit_account = '2.1.1.01';
    adjusted.debit_account_name = 'Fornecedores a Pagar';
    adjusted.credit_account = '1.1.1.02';
    adjusted.credit_account_name = 'Banco Sicredi C/C';
    adjusted.description = `Pagamento Fornecedor: ${classification.description}`;
    console.log('[Dr.Cícero] Classificado como PAGAMENTO DE FORNECEDOR - baixa de passivo');
  }
  // PRIORIDADE 5: DESPESA DA EMPRESA (vai para DRE)
  else if (feedbackLower.includes('despesa')) {
    adjusted.entry_type = 'despesa';
    adjusted.debit_account = '4.1.2.99';
    adjusted.debit_account_name = 'Outras Despesas Administrativas';
    adjusted.credit_account = '1.1.1.02';
    adjusted.credit_account_name = 'Banco Sicredi C/C';
    adjusted.description = `Despesa: ${classification.description}`;
    console.log('[Dr.Cícero] Classificado como DESPESA - vai para DRE');
  }
  // CRIAR NOVA CONTA - Usuário quer criar uma conta específica
  else if (feedbackLower.includes('criar nova conta') || feedbackLower.includes('nova conta')) {
    // Sinalizar que precisa criar conta - o frontend vai iniciar o fluxo de criação
    adjusted.needs_account_creation = true;
    adjusted.confidence = 0; // Força confirmação após criar conta
    adjusted.needs_confirmation = true;
    console.log('[Dr.Cícero] Usuário solicitou CRIAR NOVA CONTA - aguardando criação');
    return adjusted; // Retorna sem modificar classificação
  }
  // Ajustar baseado nas respostas antigas (compatibilidade)
  else if (feedbackLower.includes('honorário') || feedbackLower.includes('honorario')) {
    adjusted.entry_type = 'recebimento';
    adjusted.credit_account = '1.1.2.01';
    adjusted.credit_account_name = 'Clientes a Receber';
  } else if (feedbackLower.includes('funcionário') || feedbackLower.includes('funcionario') || feedbackLower.includes('salário')) {
    adjusted.entry_type = 'despesa_pessoal';
    adjusted.debit_account = '4.1.1.01';
    adjusted.debit_account_name = 'Salários e Ordenados';
  }

  adjusted.confidence = 1.0; // Confirmado pelo usuário
  adjusted.needs_confirmation = false;

  return adjusted;
}

// Salvar padrão aprendido
async function saveLearnedPattern(
  supabase: any,
  transaction: Transaction,
  classification: ClassificationResult
): Promise<void> {
  // Extrair padrão da descrição (primeiros 30 caracteres significativos)
  const pattern = transaction.description
    .replace(/\d+/g, '') // Remover números
    .replace(/\s+/g, ' ') // Normalizar espaços
    .trim()
    .substring(0, 30);

  if (pattern.length < 5) return; // Padrão muito curto

  try {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('ai_learned_patterns')
      .select('id, usage_count')
      .eq('description_pattern', pattern)
      .maybeSingle();

    if (existing) {
      // Atualizar contagem de uso
      await supabase
        .from('ai_learned_patterns')
        .update({
          usage_count: (existing.usage_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Criar novo padrão
      await supabase
        .from('ai_learned_patterns')
        .insert({
          description_pattern: pattern,
          entry_type: classification.entry_type,
          debit_account: classification.debit_account,
          debit_account_name: classification.debit_account_name,
          credit_account: classification.credit_account,
          credit_account_name: classification.credit_account_name,
          entry_description: classification.description,
          confidence: classification.confidence,
          usage_count: 1,
        });
    }
  } catch (error) {
    console.error('[Dr.Cícero] Error saving pattern:', error);
  }
}

// Aprender com feedback do usuário
async function learnFromFeedback(
  supabase: any,
  transaction: Transaction,
  correctClassification: ClassificationResult,
  feedback: string
): Promise<any> {
  console.log('[Dr.Cícero] Learning from feedback:', feedback);

  await saveLearnedPattern(supabase, transaction, correctClassification);

  return {
    success: true,
    message: 'Dr. Cícero: Obrigado pelo feedback! Vou lembrar dessa classificação para as próximas vezes.',
  };
}

// Chat com Dr. Cícero
async function chatWithDrCicero(
  supabase: any,
  message: string,
  context?: any
): Promise<any> {
  if (!GEMINI_API_KEY) {
    return {
      response: 'Dr. Cícero está offline no momento. Por favor, configure a GEMINI_API_KEY nos secrets do Supabase.',
    };
  }

  const prompt = `
${DR_CICERO_PERSONA}

Contexto da conversa:
${context ? JSON.stringify(context) : 'Conversa geral sobre contabilidade'}

Mensagem do usuário: ${message}

Responda de forma útil e profissional, como o Dr. Cícero responderia.
Se for sobre classificação contábil, explique seu raciocínio.
Se for sobre dúvidas tributárias ou fiscais, seja preciso e cite normas quando aplicável.
`;

  try {
    const response = await callGemini(prompt);
    return { response };
  } catch (error) {
    return {
      response: 'Dr. Cícero: Desculpe, estou com dificuldades técnicas no momento. Tente novamente em alguns instantes.',
    };
  }
}

// Processar lote de transações
async function processBatch(
  supabase: any,
  userId: string,
  transactions: Transaction[],
  autoApproveThreshold: number
): Promise<any> {
  const results = {
    auto_approved: 0,
    pending_review: 0,
    errors: 0,
    items: [] as any[],
  };

  for (const transaction of transactions) {
    try {
      const classification = await analyzeTransaction(supabase, transaction);

      if (classification.confidence >= autoApproveThreshold && !classification.needs_confirmation) {
        // Auto-aprovar
        await createAccountingEntry(supabase, userId, transaction, classification);
        results.auto_approved++;
        results.items.push({
          transaction_id: transaction.id,
          status: 'approved',
          classification,
        });
      } else {
        // Aguardar revisão
        results.pending_review++;
        results.items.push({
          transaction_id: transaction.id,
          status: 'pending_review',
          classification,
        });
      }
    } catch (error: any) {
      results.errors++;
      results.items.push({
        transaction_id: transaction.id,
        status: 'error',
        error: error.message,
      });
    }
  }

  return {
    success: true,
    message: `Dr. Cícero processou ${transactions.length} transações: ${results.auto_approved} aprovadas, ${results.pending_review} aguardando revisão, ${results.errors} erros.`,
    ...results,
  };
}

// ==========================================
// GERENCIAMENTO DE PLANO DE CONTAS
// ==========================================

interface CreateAccountParams {
  code: string;
  name: string;
  account_type: 'ATIVO' | 'PASSIVO' | 'PATRIMONIO_LIQUIDO' | 'RECEITA' | 'DESPESA';
  nature: 'DEVEDORA' | 'CREDORA';
  parent_code?: string;
  description?: string;
}

// Criar conta no plano de contas
async function createChartAccount(
  supabase: any,
  userId: string,
  params: CreateAccountParams
): Promise<any> {
  console.log('[Dr.Cícero] Criando conta no plano de contas:', params);

  const { code, name, account_type, nature, parent_code, description } = params;

  // Validar código
  if (!code || !code.match(/^\d+(\.\d+)*$/)) {
    return {
      success: false,
      error: 'Código inválido. Use formato: 1.1.3.04 ou similar'
    };
  }

  // Verificar se código já existe
  const { data: existing } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: `Código ${code} já existe: ${existing.name}`,
      existing_account: existing
    };
  }

  // Buscar conta pai se fornecida
  let parentId = null;
  if (parent_code) {
    const { data: parentAccount } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', parent_code)
      .maybeSingle();

    if (parentAccount) {
      parentId = parentAccount.id;
    }
  }

  // Calcular nível baseado no código
  const level = code.split('.').length;

  // Criar a conta
  const { data: newAccount, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code,
      name,
      account_type,
      nature,
      level,
      is_analytical: true, // Contas criadas pelo Dr. Cícero são analíticas
      is_active: true,
      parent_id: parentId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[Dr.Cícero] Erro ao criar conta:', error);
    return {
      success: false,
      error: `Erro ao criar conta: ${error.message}`
    };
  }

  console.log('[Dr.Cícero] Conta criada com sucesso:', newAccount);
  return {
    success: true,
    message: `Dr. Cícero: Conta "${name}" (${code}) criada com sucesso!`,
    account: newAccount
  };
}

// Listar contas do plano de contas
async function listChartAccounts(
  supabase: any,
  accountType?: string,
  search?: string
): Promise<any> {
  let query = supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, nature, level, is_analytical, is_active')
    .eq('is_active', true)
    .order('code');

  if (accountType) {
    query = query.eq('account_type', accountType.toUpperCase());
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    return {
      success: false,
      error: error.message
    };
  }

  // Organizar por tipo para facilitar a visualização
  const organized: Record<string, any[]> = {
    ATIVO: [],
    PASSIVO: [],
    PATRIMONIO_LIQUIDO: [],
    RECEITA: [],
    DESPESA: []
  };

  data?.forEach((account: any) => {
    if (organized[account.account_type]) {
      organized[account.account_type].push(account);
    }
  });

  return {
    success: true,
    accounts: data,
    organized,
    total: data?.length || 0
  };
}

// Sugerir próximo código disponível para uma conta
async function suggestNextAccountCode(
  supabase: any,
  parentCode?: string,
  accountType?: string
): Promise<any> {
  // Se tem código pai, buscar subcontas
  if (parentCode) {
    const { data: subAccounts } = await supabase
      .from('chart_of_accounts')
      .select('code')
      .like('code', `${parentCode}.%`)
      .order('code', { ascending: false })
      .limit(1);

    if (subAccounts && subAccounts.length > 0) {
      const lastCode = subAccounts[0].code;
      const parts = lastCode.split('.');
      const lastNum = parseInt(parts[parts.length - 1]) || 0;
      const nextNum = (lastNum + 1).toString().padStart(2, '0');
      parts[parts.length - 1] = nextNum;

      return {
        success: true,
        suggested_code: parts.join('.'),
        parent_code: parentCode,
        reasoning: `Próximo código disponível após ${lastCode}`
      };
    } else {
      return {
        success: true,
        suggested_code: `${parentCode}.01`,
        parent_code: parentCode,
        reasoning: `Primeira subconta de ${parentCode}`
      };
    }
  }

  // Se não tem pai, sugerir baseado no tipo
  const typePrefix: Record<string, string> = {
    'ATIVO': '1',
    'PASSIVO': '2',
    'RECEITA': '3',
    'DESPESA': '4',
    'PATRIMONIO_LIQUIDO': '5'
  };

  const prefix = typePrefix[accountType?.toUpperCase() || 'DESPESA'] || '4';

  // Buscar última conta do tipo
  const { data: lastAccounts } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .like('code', `${prefix}.%`)
    .order('code', { ascending: false })
    .limit(1);

  if (lastAccounts && lastAccounts.length > 0) {
    return {
      success: true,
      suggested_code: `${prefix}.1.2.99`, // Código genérico para outras
      parent_code: `${prefix}.1.2`,
      reasoning: `Sugestão para nova conta de ${accountType || 'DESPESA'}. Verifique o plano de contas para código mais específico.`
    };
  }

  return {
    success: true,
    suggested_code: `${prefix}.1.1.01`,
    reasoning: `Primeira conta de ${accountType || 'DESPESA'}`
  };
}

// Inicializar banco de dados (criar tabela de padrões se não existir)
async function initializeDatabase(supabase: any): Promise<any> {
  console.log('[Dr.Cícero] Initializing database...');

  try {
    // Tentar criar a tabela usando RPC (precisa de uma função SQL no Supabase)
    // Como não temos acesso direto ao SQL, vamos apenas verificar se a tabela existe
    const { data, error } = await supabase
      .from('ai_learned_patterns')
      .select('id')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      return {
        success: false,
        message: 'A tabela ai_learned_patterns não existe. Por favor, execute a migration manualmente no Dashboard do Supabase: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql',
        sql_file: 'supabase/migrations/20250110_ai_learned_patterns.sql',
        instructions: [
          '1. Acesse o Dashboard do Supabase',
          '2. Vá para o SQL Editor',
          '3. Cole o conteúdo do arquivo SQL',
          '4. Execute a query'
        ]
      };
    }

    // Se chegou aqui, a tabela existe
    // Verificar quantos padrões existem
    const { count } = await supabase
      .from('ai_learned_patterns')
      .select('*', { count: 'exact', head: true });

    return {
      success: true,
      message: `Dr. Cícero: Banco de dados inicializado! ${count || 0} padrões de classificação carregados.`,
      patterns_count: count || 0,
    };
  } catch (error: any) {
    console.error('[Dr.Cícero] Error initializing database:', error);
    return {
      success: false,
      message: `Erro ao inicializar banco: ${error.message}`,
    };
  }
}

// ==========================================
// IDENTIFICAÇÃO DE SÓCIOS/FAMILIARES
// ==========================================

// Interface para resultado da identificação
interface PayerIdentification {
  found: boolean;
  confidence: number;
  payer_name?: string;
  client_id?: string;
  client_name?: string;
  client_nome_fantasia?: string;
  client_cnpj?: string;
  relationship?: string; // Sócio, Administrador, etc.
  reasoning: string;
  matches?: Array<{
    name: string;
    client_name: string;
    client_id: string;
    relationship: string;
    score: number;
  }>;
}

// Normalizar nome para comparação (remover acentos, caixa baixa)
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')    // Remove caracteres especiais
    .replace(/\s+/g, ' ')            // Normaliza espaços
    .trim();
}

// Extrair possíveis nomes de uma descrição de transação bancária
function extractNamesFromDescription(description: string): string[] {
  const desc = description.toUpperCase();
  const names: string[] = [];

  // Padrões comuns de PIX
  // PIX RECEBIDO - JOAO DA SILVA
  // PIX - MARIA SANTOS CPF 12345678900
  // TRANSF PIX FULANO DE TAL
  // PIX_CRED SICREDI 99999999999 JOSE CARLOS

  // Remover prefixos comuns de PIX
  const cleanDesc = desc
    .replace(/PIX[\s_]?(RECEBIDO|ENVIADO|CRED|DEB)?[\s:-]*/gi, '')
    .replace(/TRANSF(ERENCIA)?[\s_]?(PIX)?[\s:-]*/gi, '')
    .replace(/TED[\s:-]*/gi, '')
    .replace(/DOC[\s:-]*/gi, '')
    .replace(/DEPOSITO[\s:-]*/gi, '')
    .replace(/SICREDI[\s]?\d*[\s:-]*/gi, '')
    .replace(/CPF[\s:]?\d{11}[\s:-]*/gi, '')
    .replace(/CNPJ[\s:]?\d{14}[\s:-]*/gi, '')
    .replace(/\d{11,14}/g, '') // Remove CPF/CNPJ
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '') // Remove datas
    .replace(/R\$[\s]?[\d,.]+/g, '') // Remove valores
    .replace(/[\s-]+$/, '') // Remove trailing
    .trim();

  // Se sobrou algo significativo, adicionar como possível nome
  if (cleanDesc.length >= 3) {
    names.push(cleanDesc);
  }

  // Também tentar extrair partes do nome original
  const parts = desc.split(/[\s/-]+/);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Se parece um nome (começa com letra, tem tamanho razoável)
    if (/^[A-Z]{2,}$/.test(part) && part.length >= 3) {
      // Verificar se não é palavra reservada
      const reserved = ['PIX', 'TRANSF', 'TED', 'DOC', 'CPF', 'CNPJ', 'SICREDI', 'ITAU', 'BRADESCO', 'CAIXA', 'BANCO', 'RECEBIDO', 'ENVIADO', 'CREDITO', 'DEBITO', 'PAGAMENTO'];
      if (!reserved.includes(part)) {
        names.push(part);
      }
    }
  }

  return [...new Set(names)]; // Remover duplicatas
}

// Identificar pagador pelo nome (busca nos QSA dos clientes)
async function identifyPayerByName(
  supabase: any,
  searchText: string
): Promise<PayerIdentification> {
  console.log('[Dr.Cícero] Identifying payer from:', searchText);

  // Extrair possíveis nomes da descrição
  const possibleNames = extractNamesFromDescription(searchText);
  console.log('[Dr.Cícero] Possible names extracted:', possibleNames);

  if (possibleNames.length === 0) {
    return {
      found: false,
      confidence: 0,
      reasoning: 'Dr. Cícero: Não consegui extrair um nome da descrição para busca.',
    };
  }

  // Buscar todos os clientes com QSA
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, nome_fantasia, cnpj, qsa')
    .not('qsa', 'is', null);

  if (error) {
    console.error('[Dr.Cícero] Error fetching clients:', error);
    return {
      found: false,
      confidence: 0,
      reasoning: `Dr. Cícero: Erro ao buscar clientes: ${error.message}`,
    };
  }

  // Construir índice de sócios
  const matches: Array<{
    name: string;
    client_name: string;
    client_id: string;
    client_nome_fantasia: string;
    client_cnpj: string;
    relationship: string;
    score: number;
  }> = [];

  // Para cada nome possível extraído
  for (const searchName of possibleNames) {
    const normalizedSearch = normalizeForSearch(searchName);
    const searchParts = normalizedSearch.split(' ').filter(p => p.length >= 3);

    // Para cada cliente
    for (const client of clients) {
      if (!client.qsa || !Array.isArray(client.qsa)) continue;

      // Para cada sócio do cliente
      for (const socio of client.qsa) {
        const socioNome = socio.nome || socio.name;
        if (!socioNome) continue;

        const normalizedSocio = normalizeForSearch(socioNome);
        const socioParts = normalizedSocio.split(' ').filter(p => p.length >= 2);

        // Calcular score de match
        let score = 0;

        // Match exato do nome completo
        if (normalizedSocio === normalizedSearch) {
          score = 100;
        } else {
          // Match parcial - verificar quantas partes do nome batem
          let matchedParts = 0;
          for (const searchPart of searchParts) {
            if (socioParts.some(sp => sp.includes(searchPart) || searchPart.includes(sp))) {
              matchedParts++;
            }
          }

          if (searchParts.length > 0 && matchedParts > 0) {
            // Score baseado na proporção de partes que bateram
            score = Math.round((matchedParts / Math.max(searchParts.length, socioParts.length)) * 80);

            // Bonus se o sobrenome bate (geralmente é mais distintivo)
            const lastSearchPart = searchParts[searchParts.length - 1];
            const lastSocioPart = socioParts[socioParts.length - 1];
            if (lastSearchPart && lastSocioPart &&
                (lastSearchPart.includes(lastSocioPart) || lastSocioPart.includes(lastSearchPart))) {
              score += 15;
            }
          }
        }

        // Se score é significativo, adicionar ao resultado
        // Score mínimo de 60 para evitar falsos positivos (ex: "SILVA" batendo com muitos)
        // Também exigir pelo menos 2 partes do nome coincidindo
        if (score >= 60 && matchedParts >= 2) {
          matches.push({
            name: socioNome,
            client_name: client.name,
            client_id: client.id,
            client_nome_fantasia: client.nome_fantasia || client.name,
            client_cnpj: client.cnpj,
            relationship: socio.qualificacao || socio.role || 'Sócio',
            score,
          });
        }
      }

      // Também verificar match com o próprio nome do cliente (empresa)
      // Mas exigir pelo menos 2 partes do nome coincidindo para evitar falsos positivos
      const normalizedClientName = normalizeForSearch(client.name);
      const clientParts = normalizedClientName.split(' ').filter(p => p.length >= 3);

      let clientMatchedParts = 0;
      for (const searchPart of searchParts) {
        if (clientParts.some(cp => cp.includes(searchPart) || searchPart.includes(cp))) {
          clientMatchedParts++;
        }
      }

      // Exigir pelo menos 2 partes coincidindo
      if (clientMatchedParts >= 2) {
        matches.push({
          name: client.name,
          client_name: client.name,
          client_id: client.id,
          client_nome_fantasia: client.nome_fantasia || client.name,
          client_cnpj: client.cnpj,
          relationship: 'Empresa (nome direto)',
          score: 85 + (clientMatchedParts * 3), // Score proporcional
        });
      }

      // Verificar nome fantasia também
      if (client.nome_fantasia) {
        const normalizedFantasy = normalizeForSearch(client.nome_fantasia);
        const fantasyParts = normalizedFantasy.split(' ').filter(p => p.length >= 3);

        let fantasyMatchedParts = 0;
        for (const searchPart of searchParts) {
          if (fantasyParts.some(fp => fp.includes(searchPart) || searchPart.includes(fp))) {
            fantasyMatchedParts++;
          }
        }

        // Exigir pelo menos 2 partes coincidindo
        if (fantasyMatchedParts >= 2) {
          matches.push({
            name: client.nome_fantasia,
            client_name: client.name,
            client_id: client.id,
            client_nome_fantasia: client.nome_fantasia,
            client_cnpj: client.cnpj,
            relationship: 'Empresa (nome fantasia)',
            score: 90 + (fantasyMatchedParts * 2),
          });
        }
      }
    }
  }

  // Ordenar por score e remover duplicatas
  const uniqueMatches = matches
    .sort((a, b) => b.score - a.score)
    .filter((match, index, self) =>
      index === self.findIndex(m => m.client_id === match.client_id && m.name === match.name)
    );

  // Se encontrou matches
  if (uniqueMatches.length > 0) {
    const bestMatch = uniqueMatches[0];
    const confidence = bestMatch.score / 100;

    return {
      found: true,
      confidence,
      payer_name: bestMatch.name,
      client_id: bestMatch.client_id,
      client_name: bestMatch.client_name,
      client_nome_fantasia: bestMatch.client_nome_fantasia,
      client_cnpj: bestMatch.client_cnpj,
      relationship: bestMatch.relationship,
      reasoning: `Dr. Cícero: Identifiquei "${bestMatch.name}" como ${bestMatch.relationship} do cliente ${bestMatch.client_nome_fantasia || bestMatch.client_name}. Este pagamento é provavelmente um honorário deste cliente.`,
      matches: uniqueMatches.slice(0, 5), // Retornar top 5 matches
    };
  }

  // Nenhum match encontrado
  return {
    found: false,
    confidence: 0,
    reasoning: `Dr. Cícero: Não encontrei nenhum sócio ou cliente correspondente a "${searchText}" no cadastro. Pode ser um novo cliente ou alguém não cadastrado nos QSAs.`,
  };
}

// Construir índice de clientes/sócios (para consultas rápidas)
async function buildClientIndex(supabase: any): Promise<any> {
  console.log('[Dr.Cícero] Building client index...');

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, nome_fantasia, cnpj, qsa, is_active')
    .order('name');

  if (error) {
    return {
      success: false,
      message: `Dr. Cícero: Erro ao construir índice: ${error.message}`,
    };
  }

  // Estatísticas
  const stats = {
    total_clients: clients.length,
    clients_with_qsa: 0,
    total_partners: 0,
    unique_partners: new Set<string>(),
    partner_index: {} as Record<string, Array<{ client_id: string; client_name: string; relationship: string }>>,
  };

  // Construir índice
  for (const client of clients) {
    if (client.qsa && Array.isArray(client.qsa)) {
      stats.clients_with_qsa++;

      for (const socio of client.qsa) {
        const nome = socio.nome || socio.name;
        if (!nome) continue;

        stats.total_partners++;
        stats.unique_partners.add(nome);

        const normalized = normalizeForSearch(nome);
        if (!stats.partner_index[normalized]) {
          stats.partner_index[normalized] = [];
        }

        stats.partner_index[normalized].push({
          client_id: client.id,
          client_name: client.nome_fantasia || client.name,
          relationship: socio.qualificacao || 'Sócio',
        });
      }
    }
  }

  return {
    success: true,
    message: `Dr. Cícero: Índice construído com sucesso!`,
    stats: {
      total_clients: stats.total_clients,
      clients_with_qsa: stats.clients_with_qsa,
      total_partners: stats.total_partners,
      unique_partners: stats.unique_partners.size,
    },
    sample_partners: Object.keys(stats.partner_index).slice(0, 20),
  };
}

// ==========================================
// IDENTIFICAÇÃO POR CNPJ E GRUPOS ECONÔMICOS
// ==========================================

// Extrair CNPJ de uma descrição de transação bancária
function extractCnpjFromDescription(description: string): string | null {
  // Formatos comuns de CNPJ em descrições:
  // 12345678000199
  // 12.345.678/0001-99
  // 12345678/0001-99

  // Primeiro, tentar formato sem pontuação (14 dígitos)
  const rawMatch = description.match(/\b(\d{14})\b/);
  if (rawMatch) {
    return rawMatch[1];
  }

  // Tentar formato com pontuação
  const formattedMatch = description.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/\?\d{4}-?\d{2})\b/);
  if (formattedMatch) {
    // Remover pontuação para normalizar
    return formattedMatch[1].replace(new RegExp('[./-]', 'g'), '');
  }

  return null;
}

// Interface para resultado da identificação por CNPJ
interface CnpjIdentification {
  found: boolean;
  cnpj?: string;
  client_id?: string;
  client_name?: string;
  client_nome_fantasia?: string;
  monthly_fee?: number;
  has_economic_group: boolean;
  economic_group?: {
    id: string;
    name: string;
    total_fee: number;
    is_main_payer: boolean;
    members: Array<{
      client_id: string;
      client_name: string;
      client_cnpj: string;
      monthly_fee: number;
      billing_share_percent?: number;
    }>;
  };
  related_companies?: Array<{
    client_id: string;
    client_name: string;
    client_cnpj: string;
    monthly_fee: number;
    relationship: string;
  }>;
  reasoning: string;
}

// Identificar cliente pelo CNPJ na descrição da transação
async function identifyClientByCnpj(
  supabase: any,
  description: string
): Promise<CnpjIdentification> {
  console.log('[Dr.Cícero] Identifying client by CNPJ from:', description);

  // Extrair CNPJ da descrição
  const cnpj = extractCnpjFromDescription(description);

  if (!cnpj) {
    return {
      found: false,
      has_economic_group: false,
      reasoning: 'Dr. Cícero: Não encontrei um CNPJ válido na descrição da transação.',
    };
  }

  console.log('[Dr.Cícero] CNPJ extracted:', cnpj);

  // Buscar cliente pelo CNPJ
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, nome_fantasia, cnpj, monthly_fee, qsa')
    .eq('cnpj', cnpj)
    .maybeSingle();

  if (error) {
    console.error('[Dr.Cícero] Error fetching client:', error);
    return {
      found: false,
      cnpj,
      has_economic_group: false,
      reasoning: `Dr. Cícero: Erro ao buscar cliente: ${error.message}`,
    };
  }

  if (!client) {
    return {
      found: false,
      cnpj,
      has_economic_group: false,
      reasoning: `Dr. Cícero: Não encontrei nenhum cliente cadastrado com o CNPJ ${cnpj}.`,
    };
  }

  // Cliente encontrado! Agora verificar se pertence a um grupo econômico
  const groupResult = await getEconomicGroupMembers(supabase, client.id, cnpj);

  // Se encontrou grupo econômico
  if (groupResult.found && groupResult.members && groupResult.members.length > 0) {
    return {
      found: true,
      cnpj,
      client_id: client.id,
      client_name: client.name,
      client_nome_fantasia: client.nome_fantasia,
      monthly_fee: client.monthly_fee,
      has_economic_group: true,
      economic_group: {
        id: groupResult.group_id || '',
        name: groupResult.group_name || 'Grupo Econômico',
        total_fee: groupResult.total_fee || 0,
        is_main_payer: groupResult.is_main_payer || false,
        members: groupResult.members,
      },
      reasoning: `Dr. Cícero: Encontrei o cliente ${client.nome_fantasia || client.name} (CNPJ: ${cnpj}). Este cliente é ${groupResult.is_main_payer ? 'o PAGADOR PRINCIPAL' : 'membro'} do ${groupResult.group_name || 'grupo econômico'} com ${groupResult.members.length} empresas.`,
    };
  }

  // Tentar encontrar empresas relacionadas pelo QSA (mesmo sem grupo formal)
  const relatedResult = await findRelatedCompaniesByQsa(supabase, client);

  if (relatedResult.length > 0) {
    return {
      found: true,
      cnpj,
      client_id: client.id,
      client_name: client.name,
      client_nome_fantasia: client.nome_fantasia,
      monthly_fee: client.monthly_fee,
      has_economic_group: false,
      related_companies: relatedResult,
      reasoning: `Dr. Cícero: Encontrei o cliente ${client.nome_fantasia || client.name} (CNPJ: ${cnpj}). Não está em um grupo econômico formal, mas encontrei ${relatedResult.length} empresas relacionadas pelos sócios em comum.`,
    };
  }

  // Cliente encontrado, mas sem grupo ou relacionamentos
  return {
    found: true,
    cnpj,
    client_id: client.id,
    client_name: client.name,
    client_nome_fantasia: client.nome_fantasia,
    monthly_fee: client.monthly_fee,
    has_economic_group: false,
    reasoning: `Dr. Cícero: Encontrei o cliente ${client.nome_fantasia || client.name} (CNPJ: ${cnpj}). Este cliente não pertence a nenhum grupo econômico.`,
  };
}

// Buscar boletos liquidados para uma data específica (resolve problema de agregação bancária)
interface BoletoLiquidadoMatch {
  found: boolean;
  boletos: Array<{
    id: string;
    numero_boleto: string;
    client_name: string;
    client_id: string | null;
    valor_pago: number;
    competencia: string;
    is_opening_balance: boolean;
    reconciled: boolean;
  }>;
  total_valor: number;
  total_boletos: number;
  reasoning: string;
}

async function findBoletosLiquidados(
  supabase: any,
  transactionDate: string,
  transactionAmount: number,
  tolerance: number = 0.50
): Promise<BoletoLiquidadoMatch> {
  console.log('[Dr.Cícero] Buscando boletos liquidados para:', transactionDate, 'valor:', transactionAmount);

  // Buscar boletos do mesmo dia que não foram reconciliados
  const { data: boletos, error } = await supabase
    .from('boletos_liquidados')
    .select('id, numero_boleto, client_name, client_id, valor_pago, competencia, is_opening_balance, reconciled')
    .eq('data_pagamento', transactionDate)
    .eq('reconciled', false)
    .order('client_name');

  if (error) {
    console.error('[Dr.Cícero] Erro ao buscar boletos:', error);
    return {
      found: false,
      boletos: [],
      total_valor: 0,
      total_boletos: 0,
      reasoning: `Erro ao buscar boletos: ${error.message}`,
    };
  }

  if (!boletos || boletos.length === 0) {
    return {
      found: false,
      boletos: [],
      total_valor: 0,
      total_boletos: 0,
      reasoning: `Não encontrei boletos liquidados na data ${transactionDate}.`,
    };
  }

  const totalValor = boletos.reduce((sum: number, b: any) => sum + Number(b.valor_pago), 0);
  const diferenca = Math.abs(transactionAmount - totalValor);

  // Verificar se os boletos correspondem ao valor da transação
  if (diferenca <= tolerance) {
    return {
      found: true,
      boletos: boletos.map((b: any) => ({
        id: b.id,
        numero_boleto: b.numero_boleto,
        client_name: b.client_name,
        client_id: b.client_id,
        valor_pago: Number(b.valor_pago),
        competencia: b.competencia,
        is_opening_balance: b.is_opening_balance,
        reconciled: b.reconciled,
      })),
      total_valor: totalValor,
      total_boletos: boletos.length,
      reasoning: `Dr. Cícero: Encontrei ${boletos.length} boleto(s) liquidado(s) na data ${transactionDate} totalizando R$ ${totalValor.toFixed(2)}. Diferença de R$ ${diferenca.toFixed(2)} do valor do extrato.`,
    };
  }

  // Tentar encontrar combinação de boletos que bata com o valor
  // (algoritmo simplificado - pegar boletos em ordem até atingir o valor)
  const boletosOrdenados = [...boletos].sort((a: any, b: any) => Number(b.valor_pago) - Number(a.valor_pago));
  let somaParcial = 0;
  const boletosMatch: any[] = [];

  for (const boleto of boletosOrdenados) {
    if (somaParcial + Number(boleto.valor_pago) <= transactionAmount + tolerance) {
      boletosMatch.push(boleto);
      somaParcial += Number(boleto.valor_pago);
      if (Math.abs(somaParcial - transactionAmount) <= tolerance) break;
    }
  }

  if (boletosMatch.length > 0 && Math.abs(somaParcial - transactionAmount) <= tolerance) {
    return {
      found: true,
      boletos: boletosMatch.map((b: any) => ({
        id: b.id,
        numero_boleto: b.numero_boleto,
        client_name: b.client_name,
        client_id: b.client_id,
        valor_pago: Number(b.valor_pago),
        competencia: b.competencia,
        is_opening_balance: b.is_opening_balance,
        reconciled: b.reconciled,
      })),
      total_valor: somaParcial,
      total_boletos: boletosMatch.length,
      reasoning: `Dr. Cícero: Encontrei ${boletosMatch.length} de ${boletos.length} boleto(s) que correspondem ao valor R$ ${transactionAmount.toFixed(2)} (soma: R$ ${somaParcial.toFixed(2)}).`,
    };
  }

  // Retornar todos os boletos do dia para o usuário decidir
  return {
    found: true,
    boletos: boletos.map((b: any) => ({
      id: b.id,
      numero_boleto: b.numero_boleto,
      client_name: b.client_name,
      client_id: b.client_id,
      valor_pago: Number(b.valor_pago),
      competencia: b.competencia,
      is_opening_balance: b.is_opening_balance,
      reconciled: b.reconciled,
    })),
    total_valor: totalValor,
    total_boletos: boletos.length,
    reasoning: `Dr. Cícero: Encontrei ${boletos.length} boleto(s) na data ${transactionDate} totalizando R$ ${totalValor.toFixed(2)}, mas não corresponde exatamente ao valor R$ ${transactionAmount.toFixed(2)} (diferença: R$ ${diferenca.toFixed(2)}). Preciso que você selecione quais boletos correspondem a este crédito.`,
  };
}

// Buscar membros do grupo econômico de um cliente
interface EconomicGroupResult {
  found: boolean;
  group_id?: string;
  group_name?: string;
  total_fee?: number;
  is_main_payer?: boolean;
  members?: Array<{
    client_id: string;
    client_name: string;
    client_cnpj: string;
    monthly_fee: number;
    billing_share_percent?: number;
  }>;
  reasoning: string;
}

async function getEconomicGroupMembers(
  supabase: any,
  clientId?: string,
  cnpj?: string
): Promise<EconomicGroupResult> {
  console.log('[Dr.Cícero] Getting economic group for:', clientId || cnpj);

  // Se não temos ID, buscar pelo CNPJ
  let targetClientId = clientId;
  if (!targetClientId && cnpj) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('cnpj', cnpj)
      .maybeSingle();

    if (client) {
      targetClientId = client.id;
    }
  }

  if (!targetClientId) {
    return {
      found: false,
      reasoning: 'Dr. Cícero: Não foi possível identificar o cliente para buscar o grupo econômico.',
    };
  }

  // Verificar se o cliente é o main_payer de algum grupo
  const { data: groupAsPayer } = await supabase
    .from('economic_groups')
    .select('*')
    .eq('main_payer_client_id', targetClientId)
    .eq('is_active', true)
    .maybeSingle();

  if (groupAsPayer) {
    // Este cliente é o pagador principal! Buscar todos os membros
    const { data: members } = await supabase
      .from('economic_group_members')
      .select('*, client:client_id(id, name, nome_fantasia, cnpj, monthly_fee)')
      .eq('economic_group_id', groupAsPayer.id)
      .eq('is_active', true);

    const memberList = members?.map((m: any) => ({
      client_id: m.client?.id || m.client_id,
      client_name: m.client?.nome_fantasia || m.client?.name || m.company_name,
      client_cnpj: m.client?.cnpj || m.cnpj,
      monthly_fee: m.individual_fee || m.client?.monthly_fee || 0,
      billing_share_percent: m.billing_share_percent,
    })) || [];

    return {
      found: true,
      group_id: groupAsPayer.id,
      group_name: groupAsPayer.name || groupAsPayer.group_name,
      total_fee: groupAsPayer.total_monthly_fee,
      is_main_payer: true,
      members: memberList,
      reasoning: `Dr. Cícero: Este cliente é o PAGADOR PRINCIPAL do grupo "${groupAsPayer.name}" com ${memberList.length} empresas.`,
    };
  }

  // Verificar se o cliente é membro de algum grupo
  const { data: membership } = await supabase
    .from('economic_group_members')
    .select('*, group:economic_group_id(*)')
    .eq('client_id', targetClientId)
    .eq('is_active', true)
    .maybeSingle();

  if (membership && membership.group) {
    // Encontrou o grupo! Buscar todos os membros
    const { data: allMembers } = await supabase
      .from('economic_group_members')
      .select('*, client:client_id(id, name, nome_fantasia, cnpj, monthly_fee)')
      .eq('economic_group_id', membership.group.id)
      .eq('is_active', true);

    const memberList = allMembers?.map((m: any) => ({
      client_id: m.client?.id || m.client_id,
      client_name: m.client?.nome_fantasia || m.client?.name || m.company_name,
      client_cnpj: m.client?.cnpj || m.cnpj,
      monthly_fee: m.individual_fee || m.client?.monthly_fee || 0,
      billing_share_percent: m.billing_share_percent,
    })) || [];

    // Buscar quem é o main_payer
    const { data: mainPayer } = await supabase
      .from('clients')
      .select('name, nome_fantasia')
      .eq('id', membership.group.main_payer_client_id)
      .maybeSingle();

    return {
      found: true,
      group_id: membership.group.id,
      group_name: membership.group.name || membership.group.group_name,
      total_fee: membership.group.total_monthly_fee,
      is_main_payer: false,
      members: memberList,
      reasoning: `Dr. Cícero: Este cliente é membro do grupo "${membership.group.name}". O pagador principal é ${mainPayer?.nome_fantasia || mainPayer?.name || 'não definido'}.`,
    };
  }

  return {
    found: false,
    reasoning: 'Dr. Cícero: Este cliente não pertence a nenhum grupo econômico cadastrado.',
  };
}

// Encontrar empresas relacionadas pelo QSA (mesmos sócios)
async function findRelatedCompaniesByQsa(
  supabase: any,
  client: any
): Promise<Array<{
  client_id: string;
  client_name: string;
  client_cnpj: string;
  monthly_fee: number;
  relationship: string;
}>> {
  if (!client.qsa || !Array.isArray(client.qsa) || client.qsa.length === 0) {
    return [];
  }

  // Extrair nomes dos sócios deste cliente
  const socioNames = client.qsa
    .map((s: any) => s.nome || s.name)
    .filter((n: string) => n && n.length > 3);

  if (socioNames.length === 0) {
    return [];
  }

  // Buscar todos os clientes com QSA
  const { data: allClients } = await supabase
    .from('clients')
    .select('id, name, nome_fantasia, cnpj, qsa, monthly_fee')
    .not('qsa', 'is', null)
    .neq('id', client.id); // Excluir o próprio cliente

  if (!allClients) return [];

  const related: Array<{
    client_id: string;
    client_name: string;
    client_cnpj: string;
    monthly_fee: number;
    relationship: string;
  }> = [];

  // Para cada cliente, verificar se tem sócios em comum
  for (const otherClient of allClients) {
    if (!otherClient.qsa || !Array.isArray(otherClient.qsa)) continue;

    const otherSocios = otherClient.qsa
      .map((s: any) => s.nome || s.name)
      .filter((n: string) => n);

    // Verificar sócios em comum
    const commonSocios = socioNames.filter((nome: string) => {
      const normalizedNome = normalizeForSearch(nome);
      return otherSocios.some((os: string) => {
        const normalizedOs = normalizeForSearch(os);
        // Match se tem 2+ partes do nome em comum
        const nomeParts = normalizedNome.split(' ').filter(p => p.length >= 3);
        const osParts = normalizedOs.split(' ').filter(p => p.length >= 3);
        const matches = nomeParts.filter(np => osParts.some(op => np.includes(op) || op.includes(np)));
        return matches.length >= 2;
      });
    });

    if (commonSocios.length > 0) {
      related.push({
        client_id: otherClient.id,
        client_name: otherClient.nome_fantasia || otherClient.name,
        client_cnpj: otherClient.cnpj,
        monthly_fee: otherClient.monthly_fee || 0,
        relationship: `Sócio em comum: ${commonSocios[0]}`,
      });
    }
  }

  return related;
}

// Validar e corrigir sinais das transações bancárias
// Dr. Cícero: "Os sinais devem estar corretos para a contabilidade funcionar!"
// Regra: CREDIT (entrada) = valor POSITIVO, DEBIT (saída) = valor NEGATIVO
async function validateTransactionSigns(
  supabase: any,
  bankAccountId?: string,
  dateFrom?: string,
  dateTo?: string,
  autoFix: boolean = false
): Promise<any> {
  console.log('[Dr.Cícero] Validating transaction signs...');

  // Construir query
  let query = supabase
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, type');

  if (bankAccountId) {
    query = query.eq('bank_account_id', bankAccountId);
  }

  if (dateFrom) {
    query = query.gte('transaction_date', dateFrom);
  }

  if (dateTo) {
    query = query.lte('transaction_date', dateTo);
  }

  const { data: transactions, error } = await query.order('transaction_date', { ascending: true });

  if (error) {
    return {
      success: false,
      message: `Dr. Cícero: Erro ao buscar transações: ${error.message}`,
    };
  }

  // Verificar sinais incorretos
  const problems: any[] = [];

  // CREDITS com valor negativo (errado - deveria ser positivo)
  const creditsWithNegative = transactions.filter((t: any) => t.type === 'credit' && t.amount < 0);

  // DEBITS com valor positivo (errado - deveria ser negativo)
  const debitsWithPositive = transactions.filter((t: any) => t.type === 'debit' && t.amount > 0);

  creditsWithNegative.forEach((t: any) => {
    problems.push({
      id: t.id,
      type: 'credit_with_negative',
      description: t.description,
      current_amount: t.amount,
      correct_amount: Math.abs(t.amount),
      message: `CREDIT "${t.description}" tem valor negativo (${t.amount}) - deveria ser positivo`,
    });
  });

  debitsWithPositive.forEach((t: any) => {
    problems.push({
      id: t.id,
      type: 'debit_with_positive',
      description: t.description,
      current_amount: t.amount,
      correct_amount: -Math.abs(t.amount),
      message: `DEBIT "${t.description}" tem valor positivo (${t.amount}) - deveria ser negativo`,
    });
  });

  // Se não há problemas
  if (problems.length === 0) {
    return {
      success: true,
      message: `Dr. Cícero: Excelente! Todas as ${transactions.length} transações estão com os sinais corretos.`,
      total_analyzed: transactions.length,
      problems_found: 0,
      fixed: 0,
    };
  }

  // Se auto_fix está habilitado, corrigir automaticamente
  let fixed = 0;
  if (autoFix) {
    console.log(`[Dr.Cícero] Auto-fixing ${problems.length} transactions...`);

    for (const problem of problems) {
      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({ amount: problem.correct_amount })
        .eq('id', problem.id);

      if (!updateError) {
        fixed++;
        problem.fixed = true;
      } else {
        problem.fixed = false;
        problem.fix_error = updateError.message;
      }
    }
  }

  const message = autoFix
    ? `Dr. Cícero: Encontrei ${problems.length} transações com sinais incorretos e corrigi ${fixed}.`
    : `Dr. Cícero: Encontrei ${problems.length} transações com sinais incorretos. Use auto_fix=true para corrigir automaticamente.`;

  return {
    success: true,
    message,
    total_analyzed: transactions.length,
    problems_found: problems.length,
    fixed,
    problems: problems.slice(0, 50), // Limitar para não sobrecarregar a resposta
    summary: {
      credits_with_negative: creditsWithNegative.length,
      debits_with_positive: debitsWithPositive.length,
    },
    recommendation: problems.length > 0
      ? 'Dr. Cícero recomenda: Verifique o parser do arquivo OFX. O padrão é CREDIT=positivo, DEBIT=negativo.'
      : null,
  };
}
