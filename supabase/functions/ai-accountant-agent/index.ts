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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

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

    switch (type) {
      case 'analyze_transaction':
        systemPrompt = `Você é um contador especialista em contabilidade brasileira. 
        Analise transações bancárias e sugira os lançamentos contábeis corretos seguindo o regime de competência.
        
        Plano de Contas disponível:
        ${accounts?.map(a => `${a.code} - ${a.name} (${a.type})`).join('\n')}
        
        Retorne uma análise completa incluindo:
        - Natureza da operação (receita, despesa, transferência, etc)
        - Contas contábeis envolvidas (débito e crédito)
        - Histórico sugerido para o lançamento
        - Regime de competência aplicável
        - Observações importantes`;

        userPrompt = `Analise esta transação:
        Descrição: ${data.description}
        Valor: R$ ${data.amount?.toFixed(2)}
        Data: ${data.date}
        Tipo: ${data.transaction_type || 'não especificado'}
        
        Forneça uma análise contábil completa.`;
        break;

      case 'suggest_accounts':
        systemPrompt = `Você é um contador especialista. Sugira as contas contábeis mais adequadas 
        para lançamentos baseado na descrição da operação.
        
        Plano de Contas:
        ${accounts?.filter(a => !a.is_synthetic).map(a => `${a.code} - ${a.name} (${a.type})`).join('\n')}`;

        userPrompt = `Para esta operação:
        Descrição: ${data.description}
        Categoria: ${data.category}
        Valor: R$ ${data.amount?.toFixed(2)}
        
        Sugira as contas de débito e crédito mais apropriadas.`;
        break;

      case 'validate_entry':
        systemPrompt = `Você é um auditor contábil. Valide se o lançamento contábil está correto 
        seguindo as normas brasileiras de contabilidade e o método das partidas dobradas.`;

        userPrompt = `Valide este lançamento:
        ${JSON.stringify(data.entry, null, 2)}
        
        Verifique:
        - Partidas dobradas (débito = crédito)
        - Contas corretas
        - Histórico adequado
        - Regime de competência
        - Conformidade com normas contábeis`;
        break;

      default:
        throw new Error('Invalid request type');
    }

    // Chamar Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
    const analysis = aiResult.choices[0].message.content;

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
