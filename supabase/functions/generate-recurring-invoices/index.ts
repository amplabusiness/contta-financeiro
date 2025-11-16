import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Client {
  id: string;
  name: string;
  monthly_fee: number;
  payment_day: number | null;
  status: string;
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

    // Buscar clientes ativos
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, monthly_fee, payment_day, status')
      .eq('status', 'active')
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

    const invoices: any[] = [];
    let totalGenerated = 0;
    const errors: string[] = [];

    // Para cada cliente
    for (const client of clients as Client[]) {
      try {
        const paymentDay = client.payment_day || 10; // Dia padrão: 10

        // Gerar 12 faturas mensais (janeiro a dezembro)
        for (let month = 1; month <= 12; month++) {
          const competence = `${String(month).padStart(2, '0')}/2025`;
          
          // Calcular data de vencimento
          let dueDate = new Date(2025, month - 1, paymentDay);
          
          // Se o dia do pagamento for maior que o último dia do mês, usar o último dia
          const lastDayOfMonth = new Date(2025, month, 0).getDate();
          if (paymentDay > lastDayOfMonth) {
            dueDate = new Date(2025, month - 1, lastDayOfMonth);
          }

          // Verificar se já existe fatura para este cliente e competência
          const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('client_id', client.id)
            .eq('competence', competence)
            .eq('description', 'Honorários Contábeis')
            .single();

          if (!existingInvoice) {
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
          } else {
            console.log(`Fatura já existe para ${client.name} - ${competence}`);
          }
        }

        // Gerar fatura de 13º salário (Honorários de Balanço)
        const balanceCompetence = '13/2025';
        const balanceDueDate = '2025-12-20';

        const { data: existingBalance } = await supabase
          .from('invoices')
          .select('id')
          .eq('client_id', client.id)
          .eq('competence', balanceCompetence)
          .eq('description', 'Honorários de Balanço')
          .single();

        if (!existingBalance) {
          invoices.push({
            client_id: client.id,
            amount: client.monthly_fee,
            due_date: balanceDueDate,
            competence: balanceCompetence,
            description: 'Honorários de Balanço',
            status: 'pending',
            created_by: user.id,
          });
          totalGenerated++;
        } else {
          console.log(`Honorários de Balanço já existe para ${client.name}`);
        }

      } catch (clientError) {
        console.error(`Erro ao processar cliente ${client.name}:`, clientError);
        errors.push(`${client.name}: ${clientError.message}`);
      }
    }

    // Inserir todas as faturas de uma vez
    if (invoices.length > 0) {
      console.log(`Inserindo ${invoices.length} faturas...`);
      
      const { error: insertError } = await supabase
        .from('invoices')
        .insert(invoices);

      if (insertError) {
        console.error('Erro ao inserir faturas:', insertError);
        throw insertError;
      }

      console.log(`${totalGenerated} faturas geradas com sucesso`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Honorários recorrentes gerados com sucesso para ${clients.length} clientes`,
        generated: totalGenerated,
        clients_processed: clients.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao gerar honorários recorrentes:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Erro ao gerar honorários recorrentes de 2025'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
