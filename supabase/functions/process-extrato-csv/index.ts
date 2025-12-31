import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransacaoInput {
  data: string | null;
  descricao: string;
  valor: number;
  tipo: 'credit' | 'debit';
  raw: Record<string, string>;
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

    const { transacoes } = await req.json() as { transacoes: TransacaoInput[] };

    if (!transacoes || !Array.isArray(transacoes)) {
      throw new Error('Dados de transações inválidos');
    }

    console.log(`Processando ${transacoes.length} transações...`);

    // Buscar conta do Banco
    const { data: contaBanco } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '1.1.1.05')
      .single();

    // Buscar conta de despesas gerais para classificação pendente
    const { data: contaDespesas } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '4.1.1.99')
      .single();

    // Buscar conta de receitas gerais
    const { data: contaReceitas } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '3.1.1.99')
      .single();

    if (!contaBanco) {
      throw new Error('Conta bancária não encontrada');
    }

    let imported = 0;
    let classified = 0;
    const errors: string[] = [];

    // Regras de classificação automática
    const classificationRules = [
      { pattern: /energia|cemig|copel|luz/i, code: '4.1.2.01', name: 'Energia Elétrica' },
      { pattern: /água|copasa|sanepar/i, code: '4.1.2.02', name: 'Água' },
      { pattern: /telefone|vivo|claro|tim|oi|net|internet/i, code: '4.1.2.03', name: 'Telecomunicações' },
      { pattern: /aluguel/i, code: '4.1.2.04', name: 'Aluguel' },
      { pattern: /iptu/i, code: '4.1.3.01', name: 'IPTU' },
      { pattern: /ipva/i, code: '4.1.3.02', name: 'IPVA' },
      { pattern: /simples|das|darf/i, code: '4.1.3.03', name: 'Impostos' },
      { pattern: /salário|folha|inss|fgts|férias|13|rescisão/i, code: '4.1.4.01', name: 'Folha de Pagamento' },
      { pattern: /vale.*(transporte|refeição|alimentação)/i, code: '4.1.4.02', name: 'Benefícios' },
      { pattern: /combustível|posto|gasolina|etanol|diesel/i, code: '4.1.5.01', name: 'Combustível' },
      { pattern: /estacionamento/i, code: '4.1.5.02', name: 'Estacionamento' },
      { pattern: /uber|99|taxi|transporte/i, code: '4.1.5.03', name: 'Transporte' },
      { pattern: /material.*(escritório|expediente)/i, code: '4.1.6.01', name: 'Material de Escritório' },
      { pattern: /limpeza/i, code: '4.1.6.02', name: 'Material de Limpeza' },
      { pattern: /manutenção|reparo|conserto/i, code: '4.1.7.01', name: 'Manutenção' },
      { pattern: /tarifa|ted|doc|pix|banco/i, code: '4.1.8.01', name: 'Tarifas Bancárias' },
      { pattern: /honorário|cliente|receb/i, code: '3.1.1.01', name: 'Honorários', isRevenue: true },
    ];

    for (const transacao of transacoes) {
      try {
        if (transacao.valor <= 0) continue;

        const dataLancamento = transacao.data
          ? new Date(transacao.data).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        // Tentar classificar automaticamente
        let contaContrapartida = transacao.tipo === 'credit'
          ? (contaReceitas?.id || contaDespesas?.id)
          : (contaDespesas?.id);
        let contaCode = transacao.tipo === 'credit' ? '3.1.1.99' : '4.1.1.99';
        let wasClassified = false;

        for (const rule of classificationRules) {
          if (rule.pattern.test(transacao.descricao)) {
            // Buscar conta específica
            const { data: contaEspecifica } = await supabase
              .from('chart_of_accounts')
              .select('id')
              .eq('code', rule.code)
              .single();

            if (contaEspecifica) {
              contaContrapartida = contaEspecifica.id;
              contaCode = rule.code;
              wasClassified = true;
              classified++;
              break;
            }
          }
        }

        // Criar lançamento contábil
        const { data: entry, error: entryError } = await supabase
          .from('accounting_entries')
          .insert({
            entry_date: dataLancamento,
            competence_date: dataLancamento,
            description: transacao.descricao || 'Transação bancária',
            entry_type: transacao.tipo === 'credit' ? 'recebimento' : 'pagamento',
            status: wasClassified ? 'posted' : 'draft'
          })
          .select()
          .single();

        if (entryError) throw entryError;

        // Criar linhas
        const lines = transacao.tipo === 'credit'
          ? [
              // Entrada: D: Banco, C: Receita
              { entry_id: entry.id, account_id: contaBanco.id, debit: transacao.valor, credit: 0, description: 'D: Banco Sicredi' },
              { entry_id: entry.id, account_id: contaContrapartida, debit: 0, credit: transacao.valor, description: `C: ${contaCode}` }
            ]
          : [
              // Saída: D: Despesa, C: Banco
              { entry_id: entry.id, account_id: contaContrapartida, debit: transacao.valor, credit: 0, description: `D: ${contaCode}` },
              { entry_id: entry.id, account_id: contaBanco.id, debit: 0, credit: transacao.valor, description: 'C: Banco Sicredi' }
            ];

        const { error: linesError } = await supabase
          .from('accounting_entry_lines')
          .insert(lines);

        if (linesError) throw linesError;

        imported++;

      } catch (error: any) {
        console.error(`Erro ao processar transação:`, error);
        errors.push(error.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        classified,
        total: transacoes.length,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
