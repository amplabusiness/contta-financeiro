import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI Context Provider
 *
 * Fornece contexto atualizado para todos os agentes de IA.
 * Contém informações sobre Janeiro/2025, saldos, clientes, sócios, etc.
 */

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
    const { type, competencia = '2025-01' } = body;

    console.log('[Context] Providing context for:', type);

    // =============================================================================
    // CONTEXTO GERAL DA AMPLA
    // =============================================================================

    const AMPLA_INFO = {
      razao_social: 'AMPLA CONTABILIDADE LTDA',
      cnpj: '23.893.032/0001-69',
      regime: 'Lucro Presumido',
      fundador: 'Dr. Sérgio Carneiro Leão',
      especialidades: [
        'Contabilidade Empresarial',
        'Departamento Pessoal',
        'Departamento Fiscal',
        'Legalização de Empresas',
        'Assessoria Tributária'
      ]
    };

    // =============================================================================
    // FAMÍLIA LEÃO (Sócios e Relacionados)
    // =============================================================================

    const FAMILIA_LEAO = {
      membros: [
        {
          nome: 'SÉRGIO CARNEIRO LEÃO',
          cpf: '***',
          papel: 'Fundador, Contador e Advogado',
          conta_adiantamento: '1.1.3.01',
          centro_custo: 'SÉRGIO CARNEIRO',
          observacoes: 'Despesas da casa dele são pagas pela Ampla = ADIANTAMENTO'
        },
        {
          nome: 'CARLA LEÃO',
          cpf: '***',
          papel: 'Sócia, Esposa do fundador',
          conta_adiantamento: '1.1.3.01',
          centro_custo: 'SÉRGIO CARNEIRO',
          observacoes: 'Esposa do fundador'
        },
        {
          nome: 'SÉRGIO AUGUSTO DE OLIVEIRA LEÃO',
          cpf: '***',
          papel: 'Filho, Proprietário Ampla Saúde',
          conta_adiantamento: '1.1.3.03',
          centro_custo: 'SÉRGIO AUGUSTO',
          observacoes: 'Faculdade de medicina paga pela Ampla = ADIANTAMENTO'
        },
        {
          nome: 'VICTOR HUGO LEÃO',
          cpf: '***',
          papel: 'Filho, Legalização de empresas',
          conta_adiantamento: '1.1.3.02',
          centro_custo: 'VICTOR HUGO',
          observacoes: 'Trabalha com abertura e legalização'
        },
        {
          nome: 'NAYARA LEÃO',
          cpf: '***',
          papel: 'Filha, Administradora',
          conta_adiantamento: '1.1.3.05',
          centro_custo: 'NAYARA',
          observacoes: 'Tem 2 filhos - despesas com babá = ADIANTAMENTO'
        }
      ],
      regras: {
        despesas_pessoais: 'SEMPRE classificar como ADIANTAMENTO A SÓCIOS, NUNCA como despesa',
        contas_casa: 'Luz, água, gás, internet residencial = ADIANTAMENTO',
        reformas: 'Reformas em imóveis particulares = ADIANTAMENTO',
        sitio: 'Despesas do sítio de lazer = ADIANTAMENTO',
        faculdade: 'Mensalidades de escola/faculdade = ADIANTAMENTO',
        baba: 'Babá dos netos = ADIANTAMENTO'
      },
      investimentos: {
        ampla_saude: {
          nome: 'AMPLA SAÚDE - Clínica Médica do Trabalho',
          proprietario: 'Sérgio Augusto',
          conta: '1.2.1.01',
          centro_custo: 'AMPLA SAÚDE',
          tipo: 'Investimento em Participação Societária'
        }
      }
    };

    // =============================================================================
    // BUSCAR DADOS ATUAIS DO BANCO
    // =============================================================================

    // Saldo do Banco Sicredi
    const { data: contaBanco } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '1.1.1.05')
      .single();

    let saldoBanco = 0;
    if (contaBanco) {
      const { data: bancoLinhas } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('account_id', contaBanco.id);
      bancoLinhas?.forEach(l => saldoBanco += Number(l.debit || 0) - Number(l.credit || 0));
    }

    // Contas a Receber
    const { data: contaReceber } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '1.1.2.01')
      .single();

    let saldoReceber = 0;
    if (contaReceber) {
      const { data: receberLinhas } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('account_id', contaReceber.id);
      receberLinhas?.forEach(l => saldoReceber += Number(l.debit || 0) - Number(l.credit || 0));
    }

    // Clientes ativos
    const { count: totalClientes } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Clientes inadimplentes
    const { data: inadimplentes } = await supabase
      .from('invoices')
      .select('client_id, amount, due_date, clients!inner(name, nome_fantasia)')
      .eq('status', 'overdue')
      .order('amount', { ascending: false })
      .limit(20);

    // Top 10 clientes por honorário
    const { data: topClientes } = await supabase
      .from('invoices')
      .select('client_id, amount, clients!inner(name, nome_fantasia)')
      .gte('due_date', competencia + '-01')
      .lte('due_date', competencia + '-31')
      .order('amount', { ascending: false })
      .limit(10);

    // Saldos de abertura
    const { data: saldosAbertura } = await supabase
      .from('accounting_entries')
      .select('id, description, accounting_entry_lines(debit, credit)')
      .eq('entry_type', 'saldo_abertura')
      .lte('entry_date', '2024-12-31');

    // Resumo do DRE
    const { data: receitas } = await supabase
      .from('accounting_entry_lines')
      .select('credit, account:chart_of_accounts!inner(code)')
      .gt('credit', 0)
      .like('account.code', '3%');

    const { data: despesas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, account:chart_of_accounts!inner(code)')
      .gt('debit', 0)
      .like('account.code', '4%');

    const totalReceitas = receitas?.reduce((acc, r) => acc + Number(r.credit), 0) || 0;
    const totalDespesas = despesas?.reduce((acc, d) => acc + Number(d.debit), 0) || 0;

    // =============================================================================
    // CONTEXTO JANEIRO/2025
    // =============================================================================

    const CONTEXTO_JANEIRO = {
      competencia: '2025-01',
      status: 'FECHADO E AUDITADO',
      saldos_finais: {
        banco_sicredi: saldoBanco,
        clientes_receber: saldoReceber,
        total_clientes: totalClientes,
        receitas_mes: totalReceitas,
        despesas_mes: totalDespesas,
        resultado: totalReceitas - totalDespesas
      },
      observacoes: [
        'Janeiro/2025 foi o período de abertura da contabilidade',
        'Saldos iniciais foram lançados em 31/12/2024',
        'R$ 136.821,59 em Clientes a Receber são honorários de janeiro pagos em fevereiro',
        'Banco Sicredi terminou com saldo de R$ 18.553,54'
      ]
    };

    // =============================================================================
    // REGRAS DE CLASSIFICAÇÃO
    // =============================================================================

    const REGRAS_CLASSIFICACAO = {
      recebimentos: {
        pix_cliente: {
          debito: '1.1.1.05 - Banco Sicredi',
          credito: '1.1.2.01 - Clientes a Receber',
          descricao: 'Baixa de honorários recebidos via PIX',
          centro_custo: 'Por cliente'
        },
        boleto_liquidado: {
          debito: '1.1.1.05 - Banco Sicredi',
          credito: '1.1.2.01 - Clientes a Receber',
          descricao: 'Baixa de boleto liquidado',
          centro_custo: 'Por cliente'
        }
      },
      despesas: {
        aluguel: {
          debito: '4.1.1.01 - Aluguel',
          credito: '1.1.1.05 - Banco Sicredi',
          descricao: 'Pagamento aluguel sede',
          centro_custo: 'EMPRESA/SEDE'
        },
        energia: {
          sede: {
            debito: '4.1.1.02 - Energia Elétrica',
            credito: '1.1.1.05 - Banco',
            centro_custo: 'EMPRESA/SEDE'
          },
          casa_sergio: {
            debito: '1.1.3.01 - Adiantamento Sérgio',
            credito: '1.1.1.05 - Banco',
            centro_custo: 'SÉRGIO CARNEIRO'
          }
        },
        folha: {
          salarios: {
            debito: '4.1.2.01 - Salários',
            credito: '2.1.1.01 - Salários a Pagar',
            centro_custo: 'DP'
          },
          fgts: {
            debito: '4.1.2.02 - FGTS',
            credito: '2.1.1.02 - FGTS a Recolher',
            centro_custo: 'DP'
          },
          inss: {
            debito: '4.1.2.03 - INSS',
            credito: '2.1.1.03 - INSS a Recolher',
            centro_custo: 'DP'
          }
        },
        familia: {
          regra: 'SEMPRE ADIANTAMENTO A SÓCIOS',
          debito: '1.1.3.XX - Conta do Sócio',
          credito: '1.1.1.05 - Banco',
          centro_custo: 'Nome do sócio/familiar'
        }
      }
    };

    // =============================================================================
    // COMO IDENTIFICAR CLIENTES PELO EXTRATO
    // =============================================================================

    const IDENTIFICACAO_CLIENTES = {
      por_cnpj: 'Buscar CNPJ na descrição do PIX e cruzar com cadastro',
      por_nome: 'Buscar nome do pagador no QSA dos clientes',
      por_valor: 'Comparar valor exato com faturas em aberto',
      por_boleto: 'Nosso Número do boleto identifica a fatura',
      ambiguidade: 'Se sócio paga para múltiplas empresas, perguntar qual'
    };

    // =============================================================================
    // RETORNAR CONTEXTO SOLICITADO
    // =============================================================================

    let response: any = {};

    switch (type) {
      case 'full':
        response = {
          ampla: AMPLA_INFO,
          familia: FAMILIA_LEAO,
          janeiro: CONTEXTO_JANEIRO,
          regras: REGRAS_CLASSIFICACAO,
          identificacao: IDENTIFICACAO_CLIENTES,
          inadimplentes: inadimplentes?.map(i => ({
            cliente: i.clients?.nome_fantasia || i.clients?.name,
            valor: i.amount,
            vencimento: i.due_date
          })),
          top_clientes: topClientes?.map(c => ({
            cliente: c.clients?.nome_fantasia || c.clients?.name,
            honorario: c.amount
          }))
        };
        break;

      case 'familia':
        response = FAMILIA_LEAO;
        break;

      case 'saldos':
        response = CONTEXTO_JANEIRO.saldos_finais;
        break;

      case 'regras':
        response = REGRAS_CLASSIFICACAO;
        break;

      case 'inadimplentes':
        response = {
          total: inadimplentes?.length || 0,
          lista: inadimplentes?.map(i => ({
            cliente: i.clients?.nome_fantasia || i.clients?.name,
            valor: i.amount,
            vencimento: i.due_date
          }))
        };
        break;

      case 'janeiro':
        response = CONTEXTO_JANEIRO;
        break;

      default:
        response = {
          available_types: ['full', 'familia', 'saldos', 'regras', 'inadimplentes', 'janeiro'],
          description: 'Use type para especificar qual contexto deseja'
        };
    }

    return new Response(
      JSON.stringify({ success: true, context: response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Context] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
