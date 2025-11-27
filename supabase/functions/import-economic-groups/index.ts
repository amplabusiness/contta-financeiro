import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GroupData {
  groupNumber: number;
  companies: string[];
  mainPayer: string;
  totalFee: number;
  paymentDay: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Grupos econômicos definidos (TODOS os 21 grupos)
    const groups: GroupData[] = [
      {
        groupNumber: 1,
        companies: ['A.I EMPREENDIMENTOS', 'A.I EMPREENDIMENTOS E PARTICIPACOES', 'CAMILI CORRETORA DE SEGUROS', 'I C OLIVEIRA EMPREENDIMENTOS', 'ISAC DE CAMILI'],
        mainPayer: 'A.I EMPREENDIMENTOS',
        totalFee: 506.00,
        paymentDay: 10
      },
      {
        groupNumber: 2,
        companies: ['ACTION SERVICOS ESPECIALIZADOS', 'ACTION SOLUCOES', 'NP SERVICOS', 'SOUSA & OLIVEIRA'],
        mainPayer: 'ACTION SERVICOS ESPECIALIZADOS',
        totalFee: 8095.82,
        paymentDay: 10
      },
      {
        groupNumber: 3,
        companies: ['ADMIR DE OLIVEIRA ALVES', 'D & A EMPREENDIMENTOS', 'DECIO DE CAMILI'],
        mainPayer: 'ADMIR DE OLIVEIRA ALVES',
        totalFee: 766.82,
        paymentDay: 5
      },
      {
        groupNumber: 4,
        companies: ['AMG INDUSTRIA COMERCIO SERVICOS', 'AV INDUSTRIA', 'CENTRO AUTOMOTIVO MEGA', 'COSTA & OLIVEIRA TRANSPORTES', 'JF COMERCIO', 'MEGA COMBUSTIVEIS', 'MEGA INDUSTRIA'],
        mainPayer: 'AMG INDUSTRIA COMERCIO SERVICOS',
        totalFee: 663.64,
        paymentDay: 10
      },
      {
        groupNumber: 5,
        companies: ['ANAPOLIS SERVICOS DE VISTORIAS', 'CF MATERIAIS DE CONSTRUCAO', 'GP CONSTRUCAO CIVIL', 'HR PARTICIPACOES', 'MARQUES CORREA TRANSPORTE', 'MV PARTICIPACOES EMPREENDIMENTOS'],
        mainPayer: 'ANAPOLIS SERVICOS DE VISTORIAS',
        totalFee: 833.33,
        paymentDay: 21
      },
      {
        groupNumber: 6,
        companies: ['ARANTES NEGOCIOS IMOBILIARIOS', 'RAQUEL CRISTINA COSTA DIAS BONFIM'],
        mainPayer: 'ARANTES NEGOCIOS IMOBILIARIOS',
        totalFee: 379.50,
        paymentDay: 10
      },
      {
        groupNumber: 7,
        companies: ['BOA VISTA AGROPECUARIA', 'BONUCCE INDUSTRIA', 'DINUCCI INVESTIMENTOS', 'EFS EMPREENDIMENTOS'],
        mainPayer: '', // Será determinado automaticamente
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 8,
        companies: ['C D C OLIVEIRA ASSESSORIA EMPRESARIAL', 'ESTACAO ALEGRIA EVENTOS'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 10,
        companies: ['CONTRONWEB TECNOLOGIA', 'JCP NEGOCIOS IMOBILIARIOS'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 11,
        companies: ['ELETROMETALURGICA ITAMBE', 'LG INDUSTRIA METALURGICA', 'PRO AMBIENTAL'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 12,
        companies: ['GA ELOHIM PRESTADORA DE SERVICOS', 'GARIBALDI ADRIANO DE CAMILI', 'MARIAH PARTICIPACOES E EMPREENDIMENTOS'],
        mainPayer: 'MARIAH PARTICIPACOES E EMPREENDIMENTOS',
        totalFee: 3036.00,
        paymentDay: 10
      },
      {
        groupNumber: 13,
        companies: ['IMOBILIARIS TIMES NEGOCIOS IMOBILIARIOS', 'TIMES NEGOCIOS IMOBILIARIOS'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 14,
        companies: ['JPL AGROPECUARIA', 'PASQUALOTTO TRANSPORTES', 'PASQUALOTTO E CIA', 'PASQUALOTTO E PASQUALOTTO SERVICOS', 'SEMENTES PASQUALOTTO', 'TRADING PASQUALOTTO', 'V M PARTICIPACOES', 'W P PARTICIPACOES', 'WP PASQUALOTTO'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 15,
        companies: ['JR SOLUCOES INDUSTRIAIS', 'R & R OBRAS E SERVICOS'],
        mainPayer: 'JR SOLUCOES INDUSTRIAIS',
        totalFee: 1518.00,
        paymentDay: 5
      },
      {
        groupNumber: 16,
        companies: ['LEK COLLOR COMERCIO DE VEICULOS', 'CASA NOVA TINTAS E ACABAMENTOS', 'MDL EMPREENDIMENTOS'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 17,
        companies: ['MG ALTERNATIVA', 'MG MECANICA INDUSTRIAL', 'MVA CONSTRUCOES', 'AGROSYSTEM', 'GRUPO MINASGRAOS TRADING', 'RV MECANICA INDUSTRIAL', 'TERENAS AGRO INDUSTRIAL', 'VALE DO SAO FRANCISCO CONSULTORIA'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 18,
        companies: ['MURANO MOVEIS', 'TCC COMERCIO DE COMPONENTES ELETRONICOS', 'TCC CONSTRUCOES'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 19,
        companies: ['PAES AGROPECUARIA', 'DEL PAPA INDUSTRIA'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 20,
        companies: ['PET SHOP E CAOPANHIA', 'RL CONSULTORIA E ASSESSORIA EMPRESARIAL'],
        mainPayer: 'PET SHOP E CAOPANHIA',
        totalFee: 1518.00,
        paymentDay: 5
      },
      {
        groupNumber: 21,
        companies: ['QUELUZ ADMINISTRADORA DE BENS', 'NUTRYMED SUPLEMENTOS ALIMENTARES'],
        mainPayer: '',
        totalFee: 0,
        paymentDay: 0
      }
    ];

    const results = [];

    for (const group of groups) {
      console.log(`Processing Group ${group.groupNumber}: ${group.companies.length} companies`);

      // Buscar IDs dos clientes pelo nome
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, cnpj, cpf, monthly_fee, payment_day')
        .in('name', group.companies)
        .eq('status', 'active');

      if (clientsError) {
        console.error(`Error fetching clients for group ${group.groupNumber}:`, clientsError);
        results.push({ group: group.groupNumber, error: clientsError.message });
        continue;
      }

      if (!clients || clients.length === 0) {
        console.error(`No clients found for group ${group.groupNumber}`);
        results.push({ group: group.groupNumber, error: 'No clients found' });
        continue;
      }

      // Se não tiver pagadora definida, usar a primeira empresa com monthly_fee > 0
      // Se nenhuma tiver, usar a primeira empresa
      let mainPayerClient;
      let totalFee = group.totalFee;
      let paymentDay = group.paymentDay;

      if (group.mainPayer) {
        mainPayerClient = clients.find(c => c.name === group.mainPayer);
      }

      if (!mainPayerClient) {
        // Tentar encontrar uma empresa com honorário cadastrado
        mainPayerClient = clients.find(c => c.monthly_fee && c.monthly_fee > 0);
        
        if (mainPayerClient) {
          // Usar o honorário já cadastrado
          totalFee = mainPayerClient.monthly_fee * clients.length;
          paymentDay = mainPayerClient.payment_day || 10;
        } else {
          // Se nenhuma empresa tem honorário, usar a primeira e definir valores padrão
          mainPayerClient = clients[0];
          totalFee = 1518.00; // Valor padrão
          paymentDay = 10;
        }
      }

      if (!mainPayerClient) {
        console.error(`Could not determine main payer for group ${group.groupNumber}`);
        results.push({ group: group.groupNumber, error: 'Could not determine main payer' });
        continue;
      }

      // Calcular honorário individual
      const individualFee = totalFee / clients.length;

      // Criar o grupo econômico
      const { data: economicGroup, error: groupError } = await supabase
        .from('economic_groups')
        .insert({
          name: `Grupo ${group.groupNumber}`,
          main_payer_client_id: mainPayerClient.id,
          total_monthly_fee: totalFee,
          payment_day: paymentDay,
          created_by: user.id,
          is_active: true
        })
        .select()
        .single();

      if (groupError) {
        console.error(`Error creating group ${group.groupNumber}:`, groupError);
        results.push({ group: group.groupNumber, error: groupError.message });
        continue;
      }

      // Adicionar membros do grupo
      const members = clients.map(client => ({
        economic_group_id: economicGroup.id,
        client_id: client.id,
        individual_fee: individualFee
      }));

      const { error: membersError } = await supabase
        .from('economic_group_members')
        .insert(members);

      if (membersError) {
        console.error(`Error adding members to group ${group.groupNumber}:`, membersError);
        results.push({ group: group.groupNumber, error: membersError.message });
        continue;
      }

      // Atualizar o main payer para cliente pagante com o total fee
      const { error: mainPayerUpdateError } = await supabase
        .from('clients')
        .update({
          monthly_fee: totalFee,
          payment_day: paymentDay,
          is_pro_bono: false,
          pro_bono_start_date: null,
          pro_bono_end_date: null,
          pro_bono_reason: null
        })
        .eq('id', mainPayerClient.id);

      if (mainPayerUpdateError) {
        console.error(`Error updating main payer ${mainPayerClient.name}:`, mainPayerUpdateError);
      }

      // Atualizar demais clientes do grupo com honorário individual
      const nonPayerClients = clients.filter(c => c.id !== mainPayerClient.id);
      
      for (const client of nonPayerClients) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            monthly_fee: individualFee,
            payment_day: paymentDay,
            is_pro_bono: false,
            pro_bono_start_date: null,
            pro_bono_end_date: null,
            pro_bono_reason: null
          })
          .eq('id', client.id);

        if (updateError) {
          console.error(`Error updating client ${client.name}:`, updateError);
        }
      }

      results.push({
        group: group.groupNumber,
        success: true,
        groupId: economicGroup.id,
        companiesCount: clients.length,
        individualFee: individualFee.toFixed(2)
      });

      console.log(`Successfully created Group ${group.groupNumber} with ${clients.length} companies`);
    }

    const successCount = results.filter(r => r.success).length;
    const totalMembersCount = results.reduce((sum, r) => sum + (r.companiesCount || 0), 0);

    return new Response(
      JSON.stringify({
        message: 'Economic groups import completed',
        groupsCreated: successCount,
        membersCreated: totalMembersCount,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in import-economic-groups:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
