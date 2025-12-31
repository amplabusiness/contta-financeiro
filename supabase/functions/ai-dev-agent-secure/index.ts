import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI Dev Agent Secure - Agente com Acesso Seguro a Serviços Externos
 *
 * CREDENCIAIS (armazenadas em Supabase Secrets):
 * - GITHUB_TOKEN: Token de acesso ao GitHub
 * - VERCEL_TOKEN: Token de acesso à Vercel
 * - GEMINI_API_KEY: Chave da API Gemini (IA)
 * - SERPER_API_KEY: Chave da API Serper (busca)
 *
 * SEGURANÇA:
 * - Credenciais nunca expostas ao frontend
 * - Validação de usuário autenticado
 * - Rate limiting
 * - Audit log de todas as ações
 */

// Cache de rate limiting
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

// Verificar rate limit
function checkRateLimit(userId: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const key = `${userId}`;
  const entry = rateLimitCache.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitCache.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// GitHub API
async function githubAPI(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const token = Deno.env.get('GITHUB_TOKEN');
  if (!token) throw new Error('GitHub token não configurado');

  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Ampla-AI-Agent'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Vercel API
async function vercelAPI(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<any> {
  const token = Deno.env.get('VERCEL_TOKEN');
  if (!token) throw new Error('Vercel token não configurado');

  const response = await fetch(`https://api.vercel.com${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vercel API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Gemini API para processamento de linguagem natural
async function askGemini(prompt: string, context: string = ''): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    // Fallback para processamento local se não tiver Gemini
    return processLocalNLP(prompt);
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${context}\n\nUsuário: ${prompt}\n\nResponda de forma clara e objetiva em português.`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      })
    }
  );

  if (!response.ok) {
    return processLocalNLP(prompt);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não consegui processar sua mensagem.';
}

// Processamento local quando não tem API externa
function processLocalNLP(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes('saldo')) {
    return 'INTENT:query_saldo';
  } else if (lower.includes('cliente')) {
    return 'INTENT:query_clients';
  } else if (lower.includes('deploy')) {
    return 'INTENT:deploy';
  } else if (lower.includes('commit')) {
    return 'INTENT:git_commit';
  } else if (lower.includes('migração') || lower.includes('migration')) {
    return 'INTENT:create_migration';
  }

  return 'INTENT:general';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair user do token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Limite de requisições excedido. Aguarde 1 minuto.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, message, payload } = body;

    console.log(`[AI Agent] User: ${user.email}, Action: ${action}`);

    // Registrar ação no audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: `ai_agent:${action}`,
      details: { message, payload },
      ip_address: req.headers.get('x-forwarded-for') || 'unknown'
    }).catch(() => {}); // Ignorar erro se tabela não existir

    let response: any = { success: true, message: '', data: null };

    switch (action) {
      // =============================================================================
      // GITHUB - Listar Repos
      // =============================================================================
      case 'github_list_repos': {
        const repos = await githubAPI('/user/repos?sort=updated&per_page=10');
        response.message = `${repos.length} repositórios encontrados`;
        response.data = repos.map((r: any) => ({
          name: r.name,
          full_name: r.full_name,
          url: r.html_url,
          updated_at: r.updated_at
        }));
        break;
      }

      // =============================================================================
      // GITHUB - Ver Commits Recentes
      // =============================================================================
      case 'github_recent_commits': {
        const { owner, repo } = payload || {};
        if (!owner || !repo) {
          throw new Error('owner e repo são obrigatórios');
        }

        const commits = await githubAPI(`/repos/${owner}/${repo}/commits?per_page=10`);
        response.message = `Últimos ${commits.length} commits de ${repo}`;
        response.data = commits.map((c: any) => ({
          sha: c.sha.substring(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date
        }));
        break;
      }

      // =============================================================================
      // GITHUB - Criar Commit (via API - requer arquivo no repo)
      // =============================================================================
      case 'github_create_file': {
        const { owner, repo, path, content, message: commitMessage, branch } = payload || {};

        if (!owner || !repo || !path || !content) {
          throw new Error('owner, repo, path e content são obrigatórios');
        }

        // Codificar conteúdo em base64
        const contentBase64 = btoa(unescape(encodeURIComponent(content)));

        const result = await githubAPI(`/repos/${owner}/${repo}/contents/${path}`, 'PUT', {
          message: commitMessage || `AI Agent: ${path}`,
          content: contentBase64,
          branch: branch || 'main'
        });

        response.message = `Arquivo criado: ${path}`;
        response.data = {
          path: result.content.path,
          sha: result.commit.sha.substring(0, 7),
          url: result.content.html_url
        };
        break;
      }

      // =============================================================================
      // VERCEL - Listar Projetos
      // =============================================================================
      case 'vercel_list_projects': {
        const projects = await vercelAPI('/v9/projects');
        response.message = `${projects.projects?.length || 0} projetos na Vercel`;
        response.data = projects.projects?.map((p: any) => ({
          name: p.name,
          id: p.id,
          framework: p.framework,
          url: `https://${p.name}.vercel.app`
        }));
        break;
      }

      // =============================================================================
      // VERCEL - Ver Deployments
      // =============================================================================
      case 'vercel_deployments': {
        const { projectId } = payload || {};

        const endpoint = projectId
          ? `/v6/deployments?projectId=${projectId}&limit=5`
          : '/v6/deployments?limit=10';

        const deployments = await vercelAPI(endpoint);
        response.message = `${deployments.deployments?.length || 0} deployments`;
        response.data = deployments.deployments?.map((d: any) => ({
          id: d.uid,
          url: d.url,
          state: d.state,
          created: d.created
        }));
        break;
      }

      // =============================================================================
      // VERCEL - Trigger Deploy
      // =============================================================================
      case 'vercel_deploy': {
        const { projectId } = payload || {};
        if (!projectId) {
          throw new Error('projectId é obrigatório');
        }

        // Criar deployment via webhook ou API
        const result = await vercelAPI(`/v13/deployments`, 'POST', {
          name: projectId,
          target: 'production'
        });

        response.message = `Deploy iniciado: ${result.url}`;
        response.data = result;
        break;
      }

      // =============================================================================
      // CHAT - Processamento de Linguagem Natural
      // =============================================================================
      case 'chat': {
        // Contexto do sistema
        const systemContext = `
Você é o assistente de desenvolvimento da Ampla Contabilidade.
Você tem acesso a: Supabase (banco de dados), GitHub (código), Vercel (deploy).
Pode executar: consultas SQL, commits, deploys, criar migrations.
Responda de forma objetiva e execute as ações quando solicitado.
        `;

        const aiResponse = await askGemini(message, systemContext);

        // Verificar se é uma intenção específica
        if (aiResponse.startsWith('INTENT:')) {
          const intent = aiResponse.replace('INTENT:', '');

          switch (intent) {
            case 'query_saldo': {
              const { data: contaBanco } = await supabase
                .from('chart_of_accounts')
                .select('id')
                .eq('code', '1.1.1.05')
                .single();

              if (contaBanco) {
                const { data: linhas } = await supabase
                  .from('accounting_entry_lines')
                  .select('debit, credit')
                  .eq('account_id', contaBanco.id);

                let saldo = 0;
                linhas?.forEach(l => saldo += (l.debit || 0) - (l.credit || 0));

                response.message = `💰 **Saldo Banco Sicredi:** R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
              }
              break;
            }

            case 'query_clients': {
              const { data: clientes } = await supabase
                .from('clients')
                .select('id, name, nome_fantasia, status')
                .eq('status', 'active')
                .limit(10);

              response.message = `👥 **Clientes Ativos:** ${clientes?.length || 0}`;
              response.data = clientes;
              break;
            }

            case 'deploy': {
              response.message = `🚀 Para fazer deploy:\n\n1. Vou verificar se há mudanças pendentes no GitHub\n2. Fazer commit das alterações\n3. Disparar deploy na Vercel\n\nConfirma?`;
              response.data = { action: 'confirm_deploy' };
              break;
            }

            default:
              response.message = `Entendi sua solicitação. Como posso ajudar?\n\n` +
                `- 📊 Consultar banco de dados\n` +
                `- 🔧 Criar migrações\n` +
                `- 💾 Fazer commits\n` +
                `- 🚀 Deploy na Vercel`;
          }
        } else {
          response.message = aiResponse;
        }
        break;
      }

      // =============================================================================
      // SUPABASE - Executar Query
      // =============================================================================
      case 'supabase_query': {
        const { table, select, filters, limit } = payload || {};
        if (!table) throw new Error('table é obrigatório');

        let query = supabase.from(table).select(select || '*');

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        if (limit) query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;

        response.message = `Consulta em ${table}: ${data?.length || 0} registros`;
        response.data = data;
        break;
      }

      // =============================================================================
      // VERIFICAR STATUS DOS SERVIÇOS
      // =============================================================================
      case 'check_services': {
        const services = {
          supabase: { status: 'ok', message: 'Conectado' },
          github: { status: 'unknown', message: 'Não verificado' },
          vercel: { status: 'unknown', message: 'Não verificado' },
          gemini: { status: 'unknown', message: 'Não verificado' }
        };

        // Verificar GitHub
        try {
          await githubAPI('/user');
          services.github = { status: 'ok', message: 'Conectado' };
        } catch (e: any) {
          services.github = { status: 'error', message: e.message };
        }

        // Verificar Vercel
        try {
          await vercelAPI('/v9/projects?limit=1');
          services.vercel = { status: 'ok', message: 'Conectado' };
        } catch (e: any) {
          services.vercel = { status: 'error', message: e.message };
        }

        // Verificar Gemini
        if (Deno.env.get('GEMINI_API_KEY')) {
          services.gemini = { status: 'ok', message: 'Configurado' };
        } else {
          services.gemini = { status: 'warning', message: 'Não configurado (usando fallback)' };
        }

        response.message = 'Status dos serviços';
        response.data = services;
        break;
      }

      default:
        response.success = false;
        response.message = `Ação não reconhecida: ${action}`;
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Agent] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Erro interno',
        data: null
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
