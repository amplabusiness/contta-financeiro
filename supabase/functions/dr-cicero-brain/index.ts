import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * DR. CÍCERO BRAIN - Sistema de Inteligência Contábil
 *
 * O cérebro do Dr. Cícero, com conhecimento completo das normas
 * brasileiras de contabilidade e capacidade de aprendizado contínuo.
 * 
 * Provedores de IA (em ordem de prioridade):
 * 1. Claude (Anthropic) - Mais robusto para textos longos
 * 2. OpenAI (ChatGPT) - Fallback
 * 3. Gemini (Google) - Fallback secundário
 */

// API Keys - Múltiplos provedores para redundância
const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('claude_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('chatgpt_api_key');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');

// URLs das APIs
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// =============================================================================
// CONHECIMENTO BASE DO DR. CÍCERO
// =============================================================================

const NBC_KNOWLEDGE = `
# NORMAS BRASILEIRAS DE CONTABILIDADE (NBC)

## ESTRUTURA CONCEITUAL (NBC TG 00)

### Características Qualitativas da Informação Contábil
1. **RELEVÂNCIA**: Informação capaz de fazer diferença nas decisões
   - Valor preditivo: ajuda a prever resultados futuros
   - Valor confirmatório: confirma ou altera avaliações anteriores
   - Materialidade: omissão/distorção pode influenciar decisões

2. **REPRESENTAÇÃO FIDEDIGNA**:
   - Completa: inclui todas as informações necessárias
   - Neutra: sem viés na seleção ou apresentação
   - Livre de erro: sem erros ou omissões materiais

3. **COMPARABILIDADE**: Permite comparação entre entidades e períodos

4. **VERIFICABILIDADE**: Observadores independentes podem concordar

5. **TEMPESTIVIDADE**: Informação disponível a tempo de influenciar decisões

6. **COMPREENSIBILIDADE**: Clara e concisa para usuário razoável

## NBC TG 26 (R5) - APRESENTAÇÃO DAS DEMONSTRAÇÕES CONTÁBEIS

### Demonstrações Obrigatórias
1. Balanço Patrimonial (BP)
2. Demonstração do Resultado do Exercício (DRE)
3. Demonstração do Resultado Abrangente (DRA)
4. Demonstração das Mutações do Patrimônio Líquido (DMPL)
5. Demonstração dos Fluxos de Caixa (DFC)
6. Notas Explicativas

### Estrutura do Balanço Patrimonial
ATIVO (bens e direitos - natureza DEVEDORA)
├── ATIVO CIRCULANTE (realizável até 12 meses)
│   ├── Caixa e Equivalentes
│   ├── Contas a Receber
│   ├── Estoques
│   └── Despesas Antecipadas
└── ATIVO NÃO CIRCULANTE
    ├── Realizável a Longo Prazo
    ├── Investimentos
    ├── Imobilizado
    └── Intangível

PASSIVO (obrigações - natureza CREDORA)
├── PASSIVO CIRCULANTE (exigível até 12 meses)
│   ├── Fornecedores
│   ├── Empréstimos
│   ├── Obrigações Trabalhistas
│   └── Obrigações Tributárias
└── PASSIVO NÃO CIRCULANTE
    └── Empréstimos de Longo Prazo

PATRIMÔNIO LÍQUIDO (natureza CREDORA)
├── Capital Social
├── Reservas de Capital
├── Reservas de Lucros
├── Ajustes de Avaliação Patrimonial
└── Prejuízos Acumulados

## NBC TG 03 - DEMONSTRAÇÃO DOS FLUXOS DE CAIXA

### Métodos
1. **Método Direto**: Apresenta recebimentos e pagamentos brutos
2. **Método Indireto**: Parte do lucro líquido e ajusta

### Classificação das Atividades
- **Operacionais**: Relacionadas às operações principais
- **Investimento**: Aquisição/venda de ativos de longo prazo
- **Financiamento**: Alterações no capital próprio e empréstimos

## NBC TG 27 - ATIVO IMOBILIZADO

### Depreciação
- Método linear: (Custo - Valor Residual) / Vida Útil
- Taxas anuais da Receita Federal:
  - Edificações: 4% (25 anos)
  - Máquinas: 10% (10 anos)
  - Móveis: 10% (10 anos)
  - Veículos: 20% (5 anos)
  - Computadores: 20% (5 anos)

## NBC TG 25 - PROVISÕES E CONTINGÊNCIAS

### Reconhecimento de Provisão
1. Obrigação presente (legal ou construtiva)
2. Provável saída de recursos
3. Estimativa confiável do valor

## REGIME DE COMPETÊNCIA vs CAIXA

### Regime de COMPETÊNCIA (obrigatório pela NBC)
- Receitas: reconhecidas quando AUFERIDAS (independente do recebimento)
- Despesas: reconhecidas quando INCORRIDAS (independente do pagamento)

### Regime de CAIXA (apenas para microentidades)
- Receitas: quando RECEBIDAS
- Despesas: quando PAGAS

## PARTIDAS DOBRADAS

### Regra Fundamental
TODO DÉBITO = TODO CRÉDITO (sempre!)

### Natureza das Contas
| Tipo | Natureza | Aumenta com | Diminui com |
|------|----------|-------------|-------------|
| ATIVO | Devedora | DÉBITO | Crédito |
| DESPESA | Devedora | DÉBITO | Crédito |
| PASSIVO | Credora | CRÉDITO | Débito |
| PL | Credora | CRÉDITO | Débito |
| RECEITA | Credora | CRÉDITO | Débito |

### Exemplos de Lançamentos

**1. Pagamento de despesa à vista:**
D - Despesas (aumenta despesa)
C - Banco (diminui ativo)

**2. Recebimento de cliente:**
D - Banco (aumenta ativo)
C - Clientes a Receber (diminui ativo)

**3. Compra a prazo de fornecedor:**
D - Estoque (aumenta ativo)
C - Fornecedores (aumenta passivo)

**4. Apropriação de receita:**
D - Clientes a Receber (aumenta ativo)
C - Receita de Serviços (aumenta receita)

## PLANO DE CONTAS PADRÃO (Lei 6.404/76)

1 - ATIVO
  1.1 - Ativo Circulante
    1.1.1 - Disponibilidades
      1.1.1.01 - Caixa
      1.1.1.02 - Bancos
    1.1.2 - Clientes
      1.1.2.01 - Clientes a Receber
      1.1.2.02 - (-) PCLD
    1.1.3 - Outros Créditos
      1.1.3.01 - Adiantamento a Fornecedores
      1.1.3.02 - Adiantamento a Funcionários
      1.1.3.03 - Adiantamento a Sócios

2 - PASSIVO
  2.1 - Passivo Circulante
    2.1.1 - Obrigações Trabalhistas
      2.1.1.01 - Salários a Pagar
      2.1.1.02 - FGTS a Recolher
      2.1.1.03 - INSS a Recolher
    2.1.2 - Obrigações Tributárias
      2.1.2.01 - ISS a Recolher
      2.1.2.02 - IR a Recolher
      2.1.2.03 - CSLL a Recolher

3 - RECEITAS
  3.1 - Receitas Operacionais
    3.1.1 - Receitas de Serviços
      3.1.1.01 - Honorários Contábeis
      3.1.1.02 - Honorários Trabalhistas
      3.1.1.03 - Honorários Fiscais

4 - DESPESAS
  4.1 - Despesas Operacionais
    4.1.1 - Despesas Administrativas
      4.1.1.01 - Aluguel
      4.1.1.02 - Energia Elétrica
      4.1.1.03 - Telefone/Internet
    4.1.2 - Despesas com Pessoal
      4.1.2.01 - Salários e Ordenados
      4.1.2.02 - FGTS
      4.1.2.03 - INSS

5 - PATRIMÔNIO LÍQUIDO
  5.1 - Capital Social
    5.1.1.01 - Capital Subscrito
    5.1.1.02 - (-) Capital a Integralizar
  5.2 - Reservas
    5.2.1.01 - Reserva Legal
    5.2.1.02 - Reserva de Lucros

## TABELAS FISCAIS 2025

### INSS Empregado (alíquotas progressivas)
| Faixa Salarial | Alíquota |
|----------------|----------|
| Até R$ 1.518,00 | 7,5% |
| R$ 1.518,01 a R$ 2.793,88 | 9% |
| R$ 2.793,89 a R$ 4.190,83 | 12% |
| R$ 4.190,84 a R$ 8.157,41 | 14% |

### INSS Patronal
- Empresas em geral: 20% sobre folha
- RAT: 1% a 3% (conforme risco)
- Terceiros: cerca de 5,8%

### FGTS
- 8% sobre remuneração

### ISS
- 2% a 5% sobre serviços (varia por município)

### Simples Nacional 2025
- Anexo III (Serviços): 6% a 33%
- Anexo V (Serviços profissionais): 15,5% a 30,5%

### Lucro Presumido
- IRPJ: 15% sobre base presumida + 10% adicional
- CSLL: 9% sobre base presumida
- PIS: 0,65%
- COFINS: 3%
`;

const AMPLA_CONTEXT = `
# CONTEXTO DA AMPLA CONTABILIDADE

## Dados da Empresa
- Razão Social: AMPLA CONTABILIDADE LTDA
- CNPJ: 23.893.032/0001-69
- Regime: Lucro Presumido
- Fundador: Dr. Sérgio Carneiro Leão (Contador e Advogado)

## Especialidades
- Contabilidade Empresarial
- Departamento Pessoal
- Departamento Fiscal
- Legalização de Empresas
- Assessoria Tributária

## Família Leão (Sócios)
1. SÉRGIO CARNEIRO LEÃO - Fundador
2. CARLA LEÃO - Esposa
3. SÉRGIO AUGUSTO DE OLIVEIRA LEÃO - Filho (dono Ampla Saúde)
4. VICTOR HUGO LEÃO - Filho (Legalização)
5. NAYARA LEÃO - Filha (Administração)

## REGRA DE OURO: Separação Empresa/Família
- Gastos PESSOAIS = Adiantamento a Sócios (NUNCA despesa!)
- Gastos da EMPRESA = Despesa Operacional
- Pagamentos para FAMÍLIA = Verificar natureza

## Plano de Contas Específico
- 1.1.1.05 - Banco Sicredi C/C
- 1.1.2.01 - Clientes a Receber
- 1.1.3.01 a 1.1.3.99 - Adiantamentos a Sócios (por pessoa)
- 4.1.1.xx - Despesas Administrativas
- 4.1.2.xx - Despesas com Pessoal
`;

// =============================================================================
// FUNÇÕES AUXILIARES
// =============================================================================

async function searchWeb(query: string): Promise<any[]> {
  if (!SERPER_API_KEY) return [];

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query + ' contabilidade brasil',
        num: 5,
        gl: 'br',
        hl: 'pt-br',
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.organic?.map((r: any) => ({
      title: r.title,
      snippet: r.snippet,
    })) || [];
  } catch (error) {
    console.error('[DrCicero] Web search error:', error);
    return [];
  }
}

// System prompt compartilhado para todos os provedores
const SYSTEM_PROMPT = `Você é o Dr. Cícero, contador brasileiro com 35 anos de experiência.
Especialista em NBC (Normas Brasileiras de Contabilidade) e CFC.
Você trabalha na Ampla Contabilidade LTDA (CNPJ: 23.893.032/0001-69).

SUAS CARACTERÍSTICAS:
- Rigoroso e metódico
- Explica conceitos técnicos de forma acessível
- NUNCA faz lançamentos sem certeza
- Sempre valida partidas dobradas
- Conhece profundamente a legislação brasileira

${NBC_KNOWLEDGE}

${AMPLA_CONTEXT}

IMPORTANTE:
- Sempre responda em português brasileiro
- Use o plano de contas da Ampla quando aplicável
- Cite a NBC relevante quando pertinente
- Se não tiver certeza, pergunte ao usuário
`;

// Função para chamar Claude (Anthropic)
async function callClaude(prompt: string): Promise<string> {
  console.log('[DrCicero] Calling Claude API...');
  
  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  console.log('[DrCicero] Claude response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('[DrCicero] Claude API error:', response.status, error);
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const text = result.content?.[0]?.text || '';
  console.log('[DrCicero] Claude response length:', text.length);
  return text;
}

// Função para chamar OpenAI (ChatGPT)
async function callOpenAI(prompt: string): Promise<string> {
  console.log('[DrCicero] Calling OpenAI API...');
  
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    })
  });

  console.log('[DrCicero] OpenAI response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('[DrCicero] OpenAI API error:', response.status, error);
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || '';
  console.log('[DrCicero] OpenAI response length:', text.length);
  return text;
}

// Função para chamar Gemini (Google)
async function callGemini(prompt: string): Promise<string> {
  console.log('[DrCicero] Calling Gemini API...');
  
  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4000
      }
    })
  });

  console.log('[DrCicero] Gemini response status:', response.status);

  if (!response.ok) {
    const error = await response.text();
    console.error('[DrCicero] Gemini API error:', response.status, error);
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('[DrCicero] Gemini response length:', text.length);
  return text;
}

// Função principal que tenta múltiplos provedores
async function callAI(prompt: string): Promise<string> {
  const errors: string[] = [];
  
  // 1. Tentar Claude primeiro (melhor para textos longos)
  if (CLAUDE_API_KEY) {
    try {
      return await callClaude(prompt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[DrCicero] Claude failed:', msg);
      errors.push(`Claude: ${msg}`);
    }
  } else {
    console.log('[DrCicero] Claude API key not configured');
  }
  
  // 2. Tentar OpenAI como fallback
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[DrCicero] OpenAI failed:', msg);
      errors.push(`OpenAI: ${msg}`);
    }
  } else {
    console.log('[DrCicero] OpenAI API key not configured');
  }
  
  // 3. Tentar Gemini como último recurso
  if (GEMINI_API_KEY) {
    try {
      return await callGemini(prompt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('[DrCicero] Gemini failed:', msg);
      errors.push(`Gemini: ${msg}`);
    }
  } else {
    console.log('[DrCicero] Gemini API key not configured');
  }
  
  // Se todos falharam
  throw new Error(`Todos os provedores de IA falharam: ${errors.join('; ')}`);
}

// =============================================================================
// HANDLERS
// =============================================================================

async function handleClassifyTransaction(supabase: any, transaction: any) {
  const { description, amount, date, type, payer, payee } = transaction;

  // Buscar contexto adicional se necessário
  let webContext = '';
  if (description.toLowerCase().includes('inss') || description.toLowerCase().includes('fgts')) {
    const webResults = await searchWeb('tabela INSS FGTS 2025 alíquotas');
    if (webResults.length > 0) {
      webContext = `\n\nINFORMAÇÕES ATUALIZADAS DA WEB:\n${webResults.map(r => r.snippet).join('\n')}`;
    }
  }

  const prompt = `CLASSIFIQUE ESTA TRANSAÇÃO:

Descrição: ${description}
Valor: R$ ${amount?.toFixed(2)}
Data: ${date}
Tipo: ${type || 'não especificado'}
${payer ? `Pagador: ${payer}` : ''}
${payee ? `Beneficiário: ${payee}` : ''}
${webContext}

RETORNE UM JSON ESTRUTURADO:
{
  "conta_debito": "código da conta",
  "conta_debito_nome": "nome da conta",
  "conta_credito": "código da conta",
  "conta_credito_nome": "nome da conta",
  "historico": "descrição clara do lançamento",
  "centro_custo": "se aplicável",
  "confidence": 0.0 a 1.0,
  "justificativa": "explicação técnica",
  "nbc_aplicavel": "NBC relevante, se houver"
}`;

  const response = await callAI(prompt);

  // Tentar extrair JSON da resposta
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Se não conseguir parsear, retornar resposta como texto
  }

  return { response, raw: true };
}

async function handleValidateEntry(supabase: any, entry: any) {
  const prompt = `VALIDE ESTE LANÇAMENTO CONTÁBIL:

${JSON.stringify(entry, null, 2)}

VERIFIQUE:
1. Partidas dobradas (Débito = Crédito)
2. Contas são analíticas (não sintéticas)
3. Histórico é claro
4. Regime de competência está correto
5. Classificação está adequada

RETORNE:
{
  "valid": true/false,
  "errors": ["lista de erros, se houver"],
  "warnings": ["lista de alertas"],
  "suggestions": ["sugestões de melhoria"],
  "nbc_compliance": "comentário sobre conformidade com NBC"
}`;

  const response = await callAI(prompt);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Se não conseguir parsear, retornar resposta como texto
  }

  return { response, raw: true };
}

async function handleConsult(
  supabase: any, 
  question: string, 
  context?: string, 
  history?: string,
  useRag?: boolean
) {
  console.log('[DrCicero] handleConsult - question:', question);
  console.log('[DrCicero] handleConsult - context length:', context?.length || 0);
  console.log('[DrCicero] handleConsult - history length:', history?.length || 0);
  console.log('[DrCicero] handleConsult - useRag:', useRag);
  
  // LIMITAR HISTÓRICO para evitar exceder limite de tokens
  // Gemini 1.5 Flash tem limite de ~30k tokens de input
  // Limitamos o histórico aos últimos 2000 caracteres (~500 tokens)
  const MAX_HISTORY_LENGTH = 2000;
  let truncatedHistory = history || '';
  if (truncatedHistory.length > MAX_HISTORY_LENGTH) {
    console.log('[DrCicero] Truncating history from', truncatedHistory.length, 'to', MAX_HISTORY_LENGTH);
    truncatedHistory = '...(histórico anterior omitido)...\n\n' + truncatedHistory.slice(-MAX_HISTORY_LENGTH);
  }
  
  // LIMITAR CONTEXTO também
  const MAX_CONTEXT_LENGTH = 3000;
  let truncatedContext = context || '';
  if (truncatedContext.length > MAX_CONTEXT_LENGTH) {
    console.log('[DrCicero] Truncating context from', truncatedContext.length, 'to', MAX_CONTEXT_LENGTH);
    truncatedContext = truncatedContext.slice(0, MAX_CONTEXT_LENGTH) + '...(contexto truncado)';
  }
  
  // Verificar se precisa buscar informações atualizadas da web
  let webContext = '';
  const keywords = ['tabela', 'alíquota', '2025', 'lei', 'portaria', 'instrução normativa', 'nova', 'atualiz'];
  if (keywords.some(k => question.toLowerCase().includes(k))) {
    try {
      const webResults = await searchWeb(question);
      if (webResults.length > 0) {
        webContext = `\n\nINFORMAÇÕES ATUALIZADAS DA WEB (Serper.dev):\n${webResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}`;
      }
    } catch (webError) {
      console.error('[DrCicero] Web search failed:', webError);
      // Continua sem web context
    }
  }

  // Construir prompt completo com contexto (usando versões truncadas)
  const prompt = `CONSULTA DO USUÁRIO:

${question}

${context ? `CONTEXTO ADICIONAL:
${context}` : ''}

${history ? `HISTÓRICO DA CONVERSA:
${history}` : ''}
${webContext}

INSTRUÇÕES:
1. Responda de forma clara e técnica
2. Cite a NBC ou legislação relevante quando aplicável
3. Se for sobre classificação de transação, sugira os lançamentos em formato:
   D - [código] [nome da conta] R$ valor
   C - [código] [nome da conta] R$ valor
4. Se envolver Família Leão (Sérgio, Carla, Victor Hugo, Nayara, Sérgio Augusto), lembre da regra:
   - Gastos PESSOAIS = Adiantamento a Sócios (conta 1.1.3.xx)
   - Gastos da EMPRESA = Despesa Operacional (conta 4.x.x.xx)
5. Se for ENTRADA no banco (crédito no extrato):
   - Importação: D Banco / C Transitória Créditos (2.1.9.01)
   - Classificação: D Transitória Créditos / C [Origem]
6. Se for SAÍDA do banco (débito no extrato):
   - Importação: D Transitória Débitos (1.1.9.01) / C Banco
   - Classificação: D [Destino] / C Transitória Débitos
7. Ao final da classificação, as transitórias devem ZERAR`;

  const response = await callAI(prompt);
  
  return { response };
}

async function handleLearn(supabase: any, topic: string) {
  // Buscar informações atualizadas sobre o tópico
  const webResults = await searchWeb(topic);

  const prompt = `APRENDA SOBRE: ${topic}

INFORMAÇÕES ENCONTRADAS NA WEB:
${webResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

Crie um resumo estruturado deste conhecimento para uso futuro em classificações contábeis.
Inclua:
1. Conceito principal
2. Regras e normas aplicáveis
3. Exemplos práticos
4. Implicações contábeis`;

  const knowledge = await callAI(prompt);

  // Salvar conhecimento aprendido
  try {
    await supabase
      .from('dr_cicero_knowledge')
      .insert({
        topic,
        knowledge,
        sources: webResults.map(r => r.title),
        learned_at: new Date().toISOString()
      });
  } catch (e) {
    console.log('[DrCicero] Tabela dr_cicero_knowledge não existe, conhecimento não persistido');
  }

  return { topic, knowledge, sources: webResults };
}

// =============================================================================
// SERVIDOR
// =============================================================================

serve(async (req) => {
  console.log('[DrCicero Brain] Request received:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // Verificar se a API Key está configurada
    if (!GEMINI_API_KEY) {
      console.error('[DrCicero Brain] GEMINI_API_KEY não configurada');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GEMINI_API_KEY não configurada. Configure a secret no Supabase.',
          response: 'Desculpe, estou temporariamente indisponível. A chave da API não está configurada.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[DrCicero Brain] JSON parse error:', parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          response: 'Desculpe, não consegui processar sua solicitação. O formato da requisição está incorreto.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action } = body;

    console.log('[DrCicero Brain] Action:', action);
    console.log('[DrCicero Brain] Body keys:', Object.keys(body));

    let result;

    switch (action) {
      case 'classify':
        result = await handleClassifyTransaction(supabase, body.transaction);
        break;

      case 'validate':
        result = await handleValidateEntry(supabase, body.entry);
        break;

      case 'consult':
        result = await handleConsult(supabase, body.question, body.context, body.history, body.use_rag);
        break;

      case 'learn':
        result = await handleLearn(supabase, body.topic);
        break;

      case 'get_nbc':
        result = { nbc_knowledge: NBC_KNOWLEDGE };
        break;

      case 'get_context':
        result = { ampla_context: AMPLA_CONTEXT };
        break;

      default:
        result = { error: 'Action não reconhecida. Use: classify, validate, consult, learn, get_nbc, get_context' };
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[DrCicero Brain] Error:', errorMessage);
    console.error('[DrCicero Brain] Stack:', errorStack);
    
    // Retornar 200 com erro no body para evitar problemas de CORS
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        response: `Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage}. Por favor, tente novamente.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
