import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI Agent Orchestrator
 *
 * Orquestra os 14 agentes de IA da Ampla Contabilidade.
 * Cada agente tem sua especialidade e pode ser acionado individualmente
 * ou em conjunto para tarefas complexas.
 */

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Mapeamento de agentes para suas especialidades
const AGENT_CAPABILITIES: Record<string, {
  name: string;
  specialty: string;
  systemPrompt: string;
  tools: string[];
}> = {
  'cicero': {
    name: 'Dr. Cícero',
    specialty: 'Contabilidade e NBC/CFC',
    systemPrompt: `Você é o Dr. Cícero, contador experiente com 35 anos de experiência.
Especialista em Normas Brasileiras de Contabilidade (NBC) e regulamentações do CFC.
Você classifica lançamentos contábeis, valida partidas dobradas e garante conformidade.`,
    tools: ['classify_transaction', 'validate_entry', 'suggest_accounts']
  },
  'advocato': {
    name: 'Dr. Advocato',
    specialty: 'Direito do Trabalho e CLT',
    systemPrompt: `Você é o Dr. Advocato, advogado trabalhista especializado em CLT.
Analisa riscos trabalhistas, interpreta súmulas do TST e propõe soluções jurídicas.
Conhece profundamente a Reforma Trabalhista e jurisprudência dos TRTs.`,
    tools: ['analyze_labor_risk', 'interpret_law', 'suggest_solution']
  },
  'milton': {
    name: 'Prof. Milton',
    specialty: 'Finanças e Análise Financeira',
    systemPrompt: `Você é o Prof. Milton, MBA em Finanças e especialista em análise financeira.
Analisa fluxo de caixa, indicadores financeiros e propõe estratégias de gestão.
Foco em otimização de custos e maximização de resultados.`,
    tools: ['analyze_cashflow', 'calculate_indicators', 'forecast']
  },
  'helena': {
    name: 'Dra. Helena',
    specialty: 'Gestão e Processos',
    systemPrompt: `Você é a Dra. Helena, gestora especializada em processos e compliance.
Otimiza workflows, identifica gargalos e propõe melhorias operacionais.
Foco em eficiência e governança corporativa.`,
    tools: ['analyze_process', 'suggest_improvement', 'audit']
  },
  'vendedor': {
    name: 'Sr. Vendedor',
    specialty: 'Vendas e Negócios',
    systemPrompt: `Você é o Sr. Vendedor, consultor comercial especializado em serviços contábeis.
Identifica oportunidades, treina equipes e propõe estratégias de crescimento.
Foco em retenção de clientes e aumento de receita.`,
    tools: ['analyze_opportunity', 'suggest_upsell', 'retention_strategy']
  },
  'marketing': {
    name: 'Sra. Marketing',
    specialty: 'Marketing e Comunicação',
    systemPrompt: `Você é a Sra. Marketing, especialista em marketing de serviços contábeis.
Cria campanhas, produz conteúdo e coordena comunicação interna e externa.
Foco em posicionamento de marca e geração de leads.`,
    tools: ['create_campaign', 'analyze_metrics', 'content_strategy']
  },
  'empresario': {
    name: 'Sr. Empresário',
    specialty: 'Estruturação Societária',
    systemPrompt: `Você é o Sr. Empresário, estrategista empresarial especializado em holdings e sociedades.
Estrutura empresas, planeja tributação e encontra soluções criativas dentro da lei.
Conhece Código Civil, Lei das S/A e Simples Nacional.`,
    tools: ['structure_company', 'tax_planning', 'holding_strategy']
  },
  'atlas': {
    name: 'Atlas',
    specialty: 'Machine Learning e Classificação',
    systemPrompt: `Você é o Atlas, sistema de aprendizado e classificação automática.
Identifica padrões em dados, classifica transações e aprende com feedback.
Especializado em reconhecimento de padrões e categorização.`,
    tools: ['classify', 'learn_pattern', 'predict']
  }
};

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n${prompt}` }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function executeAgent(
  supabase: any,
  agentId: string,
  task: string,
  context?: any
): Promise<any> {
  const agent = AGENT_CAPABILITIES[agentId];
  if (!agent) {
    throw new Error(`Agente "${agentId}" não encontrado`);
  }

  console.log(`[Orchestrator] Executando ${agent.name} (${agent.specialty})`);

  // Construir prompt com contexto
  let prompt = `TAREFA: ${task}`;
  if (context) {
    prompt += `\n\nCONTEXTO:\n${JSON.stringify(context, null, 2)}`;
  }

  const startTime = Date.now();

  try {
    const response = await callGemini(prompt, agent.systemPrompt);
    const executionTime = Date.now() - startTime;

    // Registrar execução no banco
    await supabase
      .from('ai_agents')
      .update({
        execution_count: supabase.rpc('increment_agent_execution', { agent_id: agentId }),
        last_execution_at: new Date().toISOString(),
        avg_execution_time_ms: executionTime
      })
      .eq('agent_id', agentId);

    return {
      success: true,
      agent: agent.name,
      specialty: agent.specialty,
      response,
      execution_time_ms: executionTime
    };
  } catch (error) {
    console.error(`[Orchestrator] Erro ao executar ${agent.name}:`, error);
    return {
      success: false,
      agent: agent.name,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

async function executeMultiAgentTask(
  supabase: any,
  agents: string[],
  task: string,
  context?: any
): Promise<any[]> {
  console.log(`[Orchestrator] Executando ${agents.length} agentes em paralelo`);

  const results = await Promise.all(
    agents.map(agentId => executeAgent(supabase, agentId, task, context))
  );

  return results;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action, agent_id, agents, task, context } = body;

    console.log(`[Orchestrator] Action: ${action}`);

    // Listar agentes disponíveis
    if (action === 'list_agents') {
      const agentList = Object.entries(AGENT_CAPABILITIES).map(([id, agent]) => ({
        id,
        name: agent.name,
        specialty: agent.specialty,
        tools: agent.tools
      }));

      return new Response(
        JSON.stringify({ success: true, agents: agentList }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Executar um agente específico
    if (action === 'execute_agent') {
      if (!agent_id || !task) {
        return new Response(
          JSON.stringify({ success: false, error: 'agent_id e task são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await executeAgent(supabase, agent_id, task, context);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Executar múltiplos agentes
    if (action === 'execute_multi_agent') {
      if (!agents || !Array.isArray(agents) || !task) {
        return new Response(
          JSON.stringify({ success: false, error: 'agents (array) e task são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results = await executeMultiAgentTask(supabase, agents, task, context);
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Consultar agente inteligente (escolhe o melhor agente para a tarefa)
    if (action === 'smart_consult') {
      if (!task) {
        return new Response(
          JSON.stringify({ success: false, error: 'task é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Usar Gemini para escolher o melhor agente
      const selectionPrompt = `
Você é um roteador de agentes de IA. Dado a seguinte tarefa, escolha o melhor agente:

TAREFA: ${task}

AGENTES DISPONÍVEIS:
${Object.entries(AGENT_CAPABILITIES).map(([id, a]) =>
  `- ${id}: ${a.name} - ${a.specialty}`
).join('\n')}

Responda APENAS com o ID do agente mais adequado (ex: "cicero", "advocato", etc).
Se a tarefa precisar de múltiplos agentes, liste os IDs separados por vírgula.
`;

      const selection = await callGemini(selectionPrompt, 'Você é um seletor de agentes preciso.');
      const selectedAgents = selection.trim().split(',').map(s => s.trim());

      console.log(`[Orchestrator] Agentes selecionados: ${selectedAgents.join(', ')}`);

      // Executar os agentes selecionados
      const results = await executeMultiAgentTask(supabase, selectedAgents, task, context);

      return new Response(
        JSON.stringify({
          success: true,
          selected_agents: selectedAgents,
          results
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Action não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
