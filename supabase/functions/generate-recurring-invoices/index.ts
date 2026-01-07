import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Client {
  id: string;
  name: string;
  monthly_fee: number;
  payment_day: number | null;
  is_active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Sem autorização');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    console.log(`Iniciando geração de honorários recorrentes para 2025 pelo usuário ${user.id}`);

    // Buscar clientes ativos (is_active = true e monthly_fee > 0)
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, monthly_fee, payment_day, is_active')
      .eq('is_active', true)
      .gt('monthly_fee', 0);

    if (clientsError) {
      console.error('Erro ao buscar clientes:', clientsError);
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum cliente ativo com honorário mensal encontrado',
          generated: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontrados ${clients.length} clientes ativos`);

    // OTIMIZAÇÃO: Buscar TODAS as faturas existentes de 2025 em UMA única query
    // Isso reduz de N*13 queries para apenas 1 query
    const clientIds = clients.map(c => c.id);
    const { data: existingInvoices, error: existingError } = await supabase
      .from('invoices')
      .select('client_id, competence, description')
      .in('client_id', clientIds)
      .like('competence', '%/2025')
      .in('description', ['Honorários Contábeis', 'Honorários de Balanço']);

    if (existingError) {
      console.error('Erro ao buscar faturas existentes:', existingError);
      throw existingError;
    }

    // Criar Set para verificação rápida O(1) em vez de query O(n)
    const existingSet = new Set(
      (existingInvoices || []).map(inv =>
        `${inv.client_id}|${inv.competence}|${inv.description}`
      )
    );

    console.log(`Encontradas ${existingSet.size} faturas já existentes`);

    const invoices: any[] = [];
    let totalGenerated = 0;
    let skipped = 0;

    // Para cada cliente - agora sem queries no loop!
    for (const client of clients as Client[]) {
      const paymentDay = client.payment_day || 10; // Dia padrão: 10

      // Gerar 12 faturas mensais (janeiro a dezembro)
      for (let month = 1; month <= 12; month++) {
        const competence = `${String(month).padStart(2, '0')}/2025`;
        const key = `${client.id}|${competence}|Honorários Contábeis`;

        // Verificação em memória O(1) em vez de query ao banco
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        // Calcular data de vencimento
        let dueDate = new Date(2025, month - 1, paymentDay);

        // Se o dia do pagamento for maior que o último dia do mês, usar o último dia
        const lastDayOfMonth = new Date(2025, month, 0).getDate();
        if (paymentDay > lastDayOfMonth) {
          dueDate = new Date(2025, month - 1, lastDayOfMonth);
        }

        invoices.push({
          client_id: client.id,
          amount: client.monthly_fee,
          due_date: dueDate.toISOString().split('T')[0],
          competence: competence,
          description: 'Honorários Contábeis',
          status: 'pending',
          created_by: user.id,
        });
        totalGenerated++;
      }

      // Gerar fatura de 13º salário (Honorários de Balanço)
      const balanceKey = `${client.id}|13/2025|Honorários de Balanço`;

      if (!existingSet.has(balanceKey)) {
        invoices.push({
          client_id: client.id,
          amount: client.monthly_fee,
          due_date: '2025-12-20',
          competence: '13/2025',
          description: 'Honorários de Balanço',
          status: 'pending',
          created_by: user.id,
        });
        totalGenerated++;
      } else {
        skipped++;
      }
    }

    // Inserir todas as faturas de uma vez (batch insert)
    if (invoices.length > 0) {
      console.log(`Inserindo ${invoices.length} faturas em batch...`);

      // Inserir em lotes de 500 para evitar limite do Supabase
      const batchSize = 500;
      for (let i = 0; i < invoices.length; i += batchSize) {
        const batch = invoices.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('invoices')
          .insert(batch);

        if (insertError) {
          console.error(`Erro ao inserir lote ${i / batchSize + 1}:`, insertError);
          throw insertError;
        }
        console.log(`Lote ${i / batchSize + 1} inserido: ${batch.length} faturas`);
      }

      console.log(`${totalGenerated} faturas geradas com sucesso`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Honorários recorrentes gerados com sucesso para ${clients.length} clientes`,
        generated: totalGenerated,
        skipped: skipped,
        clients_processed: clients.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar honorários recorrentes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: 'Erro ao gerar honorários recorrentes de 2025'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
