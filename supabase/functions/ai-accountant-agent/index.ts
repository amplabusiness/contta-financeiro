import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccountingRequest {
  type: 'analyze_transaction' | 'suggest_accounts' | 'validate_entry';
  data: {
    description?: string;
    amount?: number;
    date?: string;
    category?: string;
    transaction_type?: string;
    entry?: any;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    // Suporte a múltiplas APIs de IA - prioriza Gemini
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const aiProvider = geminiApiKey ? 'gemini' : 'lovable';
    const aiKey = geminiApiKey || geminiApiKey;

    if (!aiKey) {
      throw new Error('AI API key not configured (GEMINI_API_KEY or GEMINI_API_KEY)');
    }

    console.log(`[AI-Accountant] Using ${aiProvider} provider`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { type, data } = await req.json() as AccountingRequest;

    // Buscar plano de contas
    const { data: accounts, error: accountsError } = await supabase
      .from('chart_of_accounts')
      .select('code, name, type, is_synthetic')
      .eq('is_active', true)
      .order('code');

    if (accountsError) throw accountsError;

    let systemPrompt = '';
    let userPrompt = '';

    // Conhecimento das Normas Brasileiras de Contabilidade (NBC)
    const nbcKnowledge = `
## NORMAS BRASILEIRAS DE CONTABILIDADE (NBC) - CFC

### NBC TG (Técnicas Gerais) - Principais
- **NBC TG 00 (R2)** - Estrutura Conceitual: Características qualitativas da informação contábil (relevância, representação fidedigna)
- **NBC TG 01** - Redução ao Valor Recuperável de Ativos
- **NBC TG 02** - Efeitos das Mudanças nas Taxas de Câmbio
- **NBC TG 03 (R3)** - Demonstração dos Fluxos de Caixa
- **NBC TG 04 (R4)** - Ativo Intangível
- **NBC TG 06 (R3)** - Arrendamentos (Leasing)
- **NBC TG 09 (R2)** - Demonstração do Valor Adicionado
- **NBC TG 16 (R2)** - Estoques (Custeio por absorção)
- **NBC TG 25 (R2)** - Provisões, Passivos Contingentes e Ativos Contingentes
- **NBC TG 26 (R5)** - Apresentação das Demonstrações Contábeis
- **NBC TG 27 (R4)** - Ativo Imobilizado (Depreciação, vida útil)
- **NBC TG 28 (R4)** - Propriedade para Investimento
- **NBC TG 46 (R2)** - Mensuração do Valor Justo
- **NBC TG 47** - Receita de Contrato com Cliente
- **NBC TG 1000 (R1)** - Contabilidade para PMEs

### NBC TSP (Setor Público)
- Normas para contabilidade do setor público

### NBC TP (Perícia)
- Normas para perícia contábil

### NBC PA (Auditoria Independente)
- Normas de auditoria

### Princípios Fundamentais da Contabilidade
1. **Entidade**: Patrimônio da empresa separado do dos sócios
2. **Continuidade**: Pressupõe que a empresa continuará operando
3. **Oportunidade**: Registro tempestivo das transações
4. **Competência**: Receitas e despesas no período em que ocorrem (independente de pagamento/recebimento)
5. **Prudência**: Em caso de dúvida, menor ativo e maior passivo
6. **Registro pelo Valor Original**: Valores históricos com atualização quando permitido

### Estrutura do Plano de Contas (Lei 6.404/76)
1. **ATIVO**
   - 1.1 Ativo Circulante (realizável em até 12 meses)
   - 1.2 Ativo Não Circulante
     - 1.2.1 Realizável a Longo Prazo
     - 1.2.2 Investimentos
     - 1.2.3 Imobilizado
     - 1.2.4 Intangível

2. **PASSIVO**
   - 2.1 Passivo Circulante (exigível em até 12 meses)
   - 2.2 Passivo Não Circulante

3. **PATRIMÔNIO LÍQUIDO**
   - 5.1 Capital Social
   - 5.2 Reservas de Capital
   - 5.3 Reservas de Lucros
   - 5.4 Lucros/Prejuízos Acumulados
   - 5.5 Ajustes de Avaliação Patrimonial

4. **RECEITAS** (Contas de Resultado - natureza credora)
   - 3.x Receitas Operacionais

5. **DESPESAS** (Contas de Resultado - natureza devedora)
   - 4.x Custos e Despesas Operacionais

### Regras de Débito e Crédito
- **Contas de natureza DEVEDORA** (Ativo, Despesas): Aumentam com DÉBITO, diminuem com CRÉDITO
- **Contas de natureza CREDORA** (Passivo, PL, Receitas): Aumentam com CRÉDITO, diminuem com DÉBITO

### Contas Sintéticas vs Analíticas
- **Sintéticas**: Apenas agrupam valores (ex: 1.1 Ativo Circulante) - NÃO recebem lançamentos
- **Analíticas**: Recebem lançamentos diretos (ex: 1.1.1.02 Banco Sicredi)

### PARTIDAS MÚLTIPLAS (Lançamentos Compostos)
Um lançamento contábil pode ter MÚLTIPLAS linhas de débito e/ou crédito.
**Regra fundamental: SOMA DOS DÉBITOS = SOMA DOS CRÉDITOS**

**Tipos de Partidas Múltiplas:**

1. **Partida Simples** (1D + 1C):
   - D - Despesa de Aluguel     R$ 1.000,00
   - C - Banco c/ Movimento     R$ 1.000,00

2. **Partida Composta - Múltiplos Débitos** (ND + 1C - ex: rateio de despesas):
   - D - Despesa Administrativa R$ 500,00
   - D - Despesa Comercial      R$ 300,00
   - D - Despesa Financeira     R$ 200,00
   - C - Banco c/ Movimento     R$ 1.000,00

3. **Partida Composta - Múltiplos Créditos** (1D + NC - ex: pagamento a fornecedores):
   - D - Banco c/ Movimento     R$ 800,00
   - C - Fornecedor A           R$ 500,00
   - C - Fornecedor B           R$ 300,00

4. **Partida Composta Mista** (ND + NC - ex: folha de pagamento):
   - D - Salários               R$ 10.000,00
   - D - INSS Patronal          R$ 2.000,00
   - D - FGTS                   R$ 800,00
   - C - Salários a Pagar       R$ 10.000,00
   - C - INSS a Recolher        R$ 2.000,00
   - C - FGTS a Recolher        R$ 800,00

5. **Com Desconto/Juros** (operação complexa):
   - D - Banco c/ Movimento     R$ 950,00
   - D - Descontos Concedidos   R$ 50,00
   - C - Clientes a Receber     R$ 1.000,00

**Validações Obrigatórias:**
- TOTAL DÉBITOS deve ser IGUAL a TOTAL CRÉDITOS
- Cada linha pode ter APENAS débito OU crédito (nunca ambos)
- Mínimo de 2 linhas por lançamento

### Livros Obrigatórios
1. **Livro Diário**: Registro cronológico de todos os lançamentos
2. **Livro Razão**: Movimentação por conta
3. **Livro Registro de Inventário** (empresas comerciais)

### Demonstrações Contábeis Obrigatórias
1. Balanço Patrimonial
2. Demonstração do Resultado do Exercício (DRE)
3. Demonstração de Lucros ou Prejuízos Acumulados (DLPA)
4. Demonstração dos Fluxos de Caixa (DFC)
5. Demonstração do Valor Adicionado (DVA) - S/A de capital aberto
`;

    switch (type) {
      case 'analyze_transaction':
        systemPrompt = `Você é um contador brasileiro CRC especialista em contabilidade seguindo as Normas Brasileiras de Contabilidade (NBC) do CFC.

${nbcKnowledge}

### Plano de Contas Disponível:
${accounts?.map(a => `${a.code} - ${a.name} (${a.type}${a.is_synthetic ? ' - SINTÉTICA' : ''})`).join('\n')}

### Regras Importantes:
1. NUNCA faça lançamentos em contas SINTÉTICAS
2. Use SEMPRE o regime de COMPETÊNCIA
3. Todo lançamento deve ter DÉBITO = CRÉDITO
4. Descreva o histórico de forma clara e objetiva
5. Indique a NBC aplicável quando relevante

Analise a transação e forneça:
- Natureza da operação
- Contas contábeis envolvidas (APENAS ANALÍTICAS)
- Histórico sugerido
- NBC aplicável (se houver)
- Observações importantes`;

        userPrompt = `Analise esta transação seguindo as NBC:
        Descrição: ${data.description}
        Valor: R$ ${data.amount?.toFixed(2)}
        Data: ${data.date}
        Tipo: ${data.transaction_type || 'não especificado'}

        Forneça uma análise contábil completa conforme as normas brasileiras.`;
        break;

      case 'suggest_accounts':
        systemPrompt = `Você é um contador brasileiro especialista. Sugira as contas contábeis mais adequadas
        para lançamentos baseado na descrição da operação.

${nbcKnowledge}

### IMPORTANTE: Use APENAS contas ANALÍTICAS (que aceitam lançamentos)

Plano de Contas Analíticas:
${accounts?.filter(a => !a.is_synthetic).map(a => `${a.code} - ${a.name} (${a.type})`).join('\n')}`;

        userPrompt = `Para esta operação:
        Descrição: ${data.description}
        Categoria: ${data.category}
        Valor: R$ ${data.amount?.toFixed(2)}
        
        Sugira as contas de débito e crédito mais apropriadas.`;
        break;

      case 'validate_entry':
        systemPrompt = `Você é um auditor contábil CRC brasileiro especialista em NBC.

${nbcKnowledge}

### Plano de Contas:
${accounts?.map(a => `${a.code} - ${a.name} (${a.type}${a.is_synthetic ? ' - SINTÉTICA' : ''})`).join('\n')}

Valide o lançamento contábil seguindo rigorosamente as normas brasileiras.`;

        userPrompt = `Valide este lançamento conforme as NBC:
        ${JSON.stringify(data.entry, null, 2)}

        Verifique rigorosamente:
        1. **Partidas dobradas** (SOMA DÉBITOS = SOMA CRÉDITOS obrigatório)
           - Pode ser partida simples (1D + 1C) ou partida múltipla (ND + NC)
           - Cada linha deve ter APENAS débito OU crédito, nunca ambos
        2. Contas são ANALÍTICAS (não pode ser sintética)
        3. Histórico é claro e descritivo
        4. Regime de COMPETÊNCIA está correto
        5. Classificação contábil adequada conforme a natureza da operação
        6. Conformidade com as NBC aplicáveis

        Retorne um parecer detalhado indicando se está VÁLIDO ou INVÁLIDO, e quais correções são necessárias.`;
        break;

      default:
        throw new Error('Invalid request type');
    }

    // Chamar IA (Gemini direto ou Lovable Gateway)
    let analysis = '';

    if (aiProvider === 'gemini') {
      // Chamar Gemini diretamente via API do Google
      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('Gemini API error:', aiResponse.status, errorText);
        throw new Error(`Gemini API error: ${aiResponse.status}`);
      }

      const result = await aiResponse.json();
      analysis = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Chamar via Lovable Gateway
      const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${geminiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // model moved to URL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Payment required. Please add credits to your Lovable workspace.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await aiResponse.text();
        console.error('AI Gateway error:', aiResponse.status, errorText);
        throw new Error('AI Gateway error');
      }

      const aiResult = await aiResponse.json();
      analysis = aiResult.choices[0].message.content;
    }

    console.log('AI Accountant Analysis:', analysis);

    return new Response(
      JSON.stringify({ 
        success: true,
        analysis,
        type,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in ai-accountant-agent:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
