import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI Dev Agent - Agente de Desenvolvimento Autônomo
 *
 * Tem acesso a:
 * - Supabase (banco de dados, storage, functions)
 * - GitHub (commits, PRs, issues)
 * - Vercel (deploys, logs)
 *
 * Pode executar:
 * - Migrações SQL
 * - Deploy de functions
 * - Commits e PRs
 * - Deploy para produção
 */

// Contexto do sistema (MEMORY.md carregado)
const SYSTEM_MEMORY = `
# AMPLA CONTABILIDADE - CONTEXTO DO SISTEMA

## BANCO DE DADOS
Tabelas principais: clients, invoices, expenses, bank_transactions,
accounting_entries, accounting_entry_lines, chart_of_accounts, cost_centers

## PLANO DE CONTAS
- 1.1.1.05 = Banco Sicredi
- 1.1.2.01 = Clientes a Receber
- 1.1.3.xx = Adiantamentos a Sócios
- 3.1.1.01 = Receita de Honorários
- 4.x.x.xx = Despesas

## REGRAS
- Despesas pessoais = SEMPRE Adiantamento (1.1.3.x)
- Recebimento = D: Banco C: Clientes
- Pagamento = D: Despesa C: Banco

## JANEIRO/2025
- Saldo Banco: R$ 18.553,54
- Clientes a Receber: R$ 136.821,59
- Partidas dobradas: OK (diferença R$ 0,00)
`;

interface AgentAction {
  type: 'sql' | 'function_deploy' | 'github_commit' | 'vercel_deploy' | 'query' | 'analyze';
  description: string;
  payload: any;
}

interface AgentResponse {
  success: boolean;
  message: string;
  actions: AgentAction[];
  results: any[];
  suggestions?: string[];
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
    const { action, message, context, file_content } = body;

    console.log('[AI Dev Agent] Action:', action, 'Message:', message?.substring(0, 100));

    const response: AgentResponse = {
      success: true,
      message: '',
      actions: [],
      results: [],
      suggestions: []
    };

    switch (action) {
      // =============================================================================
      // CONSULTA AO BANCO DE DADOS
      // =============================================================================
      case 'query': {
        const { table, select, filters, limit } = body;

        let query = supabase.from(table).select(select || '*');

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            if (typeof value === 'string' && value.includes('%')) {
              query = query.ilike(key, value);
            } else {
              query = query.eq(key, value);
            }
          });
        }

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        response.message = `Consulta em ${table}: ${data?.length || 0} registros`;
        response.results = data || [];
        response.actions.push({
          type: 'query',
          description: `SELECT ${select || '*'} FROM ${table}`,
          payload: { table, select, filters, count: data?.length }
        });
        break;
      }

      // =============================================================================
      // EXECUTAR SQL (MIGRATION)
      // =============================================================================
      case 'execute_sql': {
        const { sql, description } = body;

        // Validar SQL perigoso
        const sqlUpper = sql.toUpperCase();
        if (sqlUpper.includes('DROP DATABASE') || sqlUpper.includes('TRUNCATE')) {
          throw new Error('Operação SQL não permitida por segurança');
        }

        // Executar via RPC ou diretamente
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
          // Se a função não existe, tentar criar
          if (error.message.includes('function') && error.message.includes('does not exist')) {
            response.message = 'Função exec_sql não encontrada. Crie uma migration para executar SQL.';
            response.suggestions = [
              'Criar arquivo em supabase/migrations/',
              'Usar npx supabase db push para aplicar'
            ];
          } else {
            throw error;
          }
        } else {
          response.message = `SQL executado: ${description || 'Sem descrição'}`;
          response.results = [data];
        }

        response.actions.push({
          type: 'sql',
          description: description || 'Execução SQL',
          payload: { sql: sql.substring(0, 200) }
        });
        break;
      }

      // =============================================================================
      // CRIAR MIGRATION
      // =============================================================================
      case 'create_migration': {
        const { name, sql_content } = body;

        // Gerar timestamp
        const timestamp = new Date().toISOString()
          .replace(/[-:T]/g, '')
          .substring(0, 14);

        const fileName = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
        const fullPath = `supabase/migrations/${fileName}`;

        // Salvar no storage ou retornar para o cliente salvar
        response.message = `Migration criada: ${fileName}`;
        response.results = [{
          fileName,
          fullPath,
          content: sql_content,
          command: 'npx supabase db push'
        }];
        response.suggestions = [
          `Salve o arquivo em: ${fullPath}`,
          'Execute: npx supabase db push'
        ];

        response.actions.push({
          type: 'sql',
          description: `Criar migration: ${name}`,
          payload: { fileName, sql: sql_content.substring(0, 200) }
        });
        break;
      }

      // =============================================================================
      // LISTAR TABELAS E ESTRUTURA
      // =============================================================================
      case 'describe_database': {
        // Buscar todas as tabelas públicas
        const { data: tables, error: tablesError } = await supabase
          .from('information_schema.tables' as any)
          .select('table_name')
          .eq('table_schema', 'public');

        // Alternativa: buscar de cada tabela conhecida
        const knownTables = [
          'clients', 'invoices', 'expenses', 'bank_transactions',
          'accounting_entries', 'accounting_entry_lines', 'chart_of_accounts',
          'cost_centers', 'accounting_periods', 'bank_accounts', 'employees'
        ];

        const tableInfo: any[] = [];

        for (const tableName of knownTables) {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

          if (!error && data) {
            tableInfo.push({
              name: tableName,
              columns: data[0] ? Object.keys(data[0]) : [],
              sample: data[0]
            });
          }
        }

        response.message = `${tableInfo.length} tabelas encontradas no banco`;
        response.results = tableInfo;
        break;
      }

      // =============================================================================
      // ANALISAR E SUGERIR MELHORIAS
      // =============================================================================
      case 'analyze': {
        const { target } = body; // 'database', 'code', 'performance'

        if (target === 'database') {
          // Verificar integridade
          const checks: any[] = [];

          // 1. Partidas dobradas
          const { data: totais } = await supabase
            .from('accounting_entry_lines')
            .select('debit, credit');

          let totalDebitos = 0;
          let totalCreditos = 0;
          totais?.forEach(l => {
            totalDebitos += Number(l.debit) || 0;
            totalCreditos += Number(l.credit) || 0;
          });

          checks.push({
            check: 'Partidas Dobradas',
            status: Math.abs(totalDebitos - totalCreditos) < 0.01 ? 'OK' : 'ERRO',
            debitos: totalDebitos,
            creditos: totalCreditos,
            diferenca: Math.abs(totalDebitos - totalCreditos)
          });

          // 2. Lançamentos em contas sintéticas
          const { data: sinteticas } = await supabase
            .from('chart_of_accounts')
            .select('id')
            .eq('is_synthetic', true);

          const sinteticasIds = sinteticas?.map(c => c.id) || [];

          if (sinteticasIds.length > 0) {
            const { count } = await supabase
              .from('accounting_entry_lines')
              .select('*', { count: 'exact', head: true })
              .in('account_id', sinteticasIds.slice(0, 50));

            checks.push({
              check: 'Lançamentos em Contas Sintéticas',
              status: (count || 0) === 0 ? 'OK' : 'ERRO',
              count: count || 0
            });
          }

          // 3. Períodos
          const { data: periodos } = await supabase
            .from('accounting_periods')
            .select('year, month, status')
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(3);

          checks.push({
            check: 'Controle de Períodos',
            status: periodos && periodos.length > 0 ? 'OK' : 'PENDENTE',
            periodos
          });

          response.message = 'Análise do banco de dados concluída';
          response.results = checks;
          response.suggestions = checks
            .filter(c => c.status !== 'OK')
            .map(c => `Corrigir: ${c.check}`);
        }
        break;
      }

      // =============================================================================
      // PROCESSAR MENSAGEM NATURAL
      // =============================================================================
      case 'chat': {
        // Analisar intenção
        const lowerMsg = message.toLowerCase();

        let intent = 'unknown';
        const params: Record<string, unknown> = {};

        // Detectar intenções
        if (lowerMsg.includes('migração') || lowerMsg.includes('migration') || lowerMsg.includes('criar tabela')) {
          intent = 'create_migration';
        } else if (lowerMsg.includes('deploy') || lowerMsg.includes('publicar')) {
          intent = 'deploy';
        } else if (lowerMsg.includes('commit') || lowerMsg.includes('salvar')) {
          intent = 'git_commit';
        } else if (lowerMsg.includes('saldo') || lowerMsg.includes('quanto')) {
          intent = 'query_saldo';
        } else if (lowerMsg.includes('cliente') || lowerMsg.includes('buscar')) {
          intent = 'query_clients';
        } else if (lowerMsg.includes('lançamento') || lowerMsg.includes('contabil')) {
          intent = 'create_entry';
        } else if (lowerMsg.includes('analisa') || lowerMsg.includes('verifica')) {
          intent = 'analyze';
        }

        // Executar baseado na intenção
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

              response.message = `💰 Saldo Banco Sicredi: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
              response.results = [{ saldo }];
            }
            break;
          }

          case 'query_clients': {
            // Extrair termo de busca
            const match = message.match(/cliente\s+(\w+)/i) || message.match(/buscar\s+(\w+)/i);
            const termo = match?.[1] || '';

            const { data: clientes } = await supabase
              .from('clients')
              .select('id, name, nome_fantasia, cnpj, status')
              .or(`name.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`)
              .limit(10);

            response.message = `Encontrados ${clientes?.length || 0} clientes`;
            response.results = clientes || [];
            break;
          }

          case 'analyze': {
            // Executar análise
            const { data: totais } = await supabase
              .from('accounting_entry_lines')
              .select('debit, credit');

            let totalD = 0, totalC = 0;
            totais?.forEach(l => {
              totalD += Number(l.debit) || 0;
              totalC += Number(l.credit) || 0;
            });

            response.message = `📊 Análise:\n- Débitos: R$ ${totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Créditos: R$ ${totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Diferença: R$ ${Math.abs(totalD - totalC).toFixed(2)}`;
            response.results = [{ debitos: totalD, creditos: totalC }];
            break;
          }

          default:
            response.message = `Entendi sua mensagem. Posso ajudar com:\n\n` +
              `- 📊 Consultas ao banco (saldo, clientes, etc.)\n` +
              `- 🔧 Criar migrações SQL\n` +
              `- 📝 Criar lançamentos contábeis\n` +
              `- 🚀 Deploy de funções\n` +
              `- 📈 Análise do sistema\n\n` +
              `O que você precisa?`;
            response.suggestions = [
              'Qual o saldo do banco?',
              'Buscar cliente XPTO',
              'Analisar integridade do banco',
              'Criar migration para nova tabela'
            ];
        }
        break;
      }

      // =============================================================================
      // INSERIR/ATUALIZAR DADOS
      // =============================================================================
      case 'insert': {
        const { table, data } = body;

        const { data: result, error } = await supabase
          .from(table)
          .insert(data)
          .select();

        if (error) throw error;

        response.message = `Inserido em ${table}: ${result?.length || 0} registro(s)`;
        response.results = result || [];
        response.actions.push({
          type: 'query',
          description: `INSERT INTO ${table}`,
          payload: { table, count: result?.length }
        });
        break;
      }

      case 'update': {
        const { table, data, filters } = body;

        let query = supabase.from(table).update(data);

        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }

        const { data: result, error } = await query.select();

        if (error) throw error;

        response.message = `Atualizado em ${table}: ${result?.length || 0} registro(s)`;
        response.results = result || [];
        break;
      }

      default:
        response.message = 'Ação não reconhecida';
        response.success = false;
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI Dev Agent] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        actions: [],
        results: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
