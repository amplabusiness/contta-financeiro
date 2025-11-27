import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyData {
  name: string;
  document: string; // CNPJ ou CPF
}

interface GroupData {
  groupNumber: number;
  companies: CompanyData[];
  mainPayerDocument: string; // CNPJ ou CPF da empresa pagadora
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

    // Primeiro, limpar grupos existentes para evitar duplicação
    console.log('Cleaning existing economic groups...');
    const { error: deleteError } = await supabase
      .from('economic_groups')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('Error deleting existing groups:', deleteError);
    }

    // Grupos econômicos definidos (TODOS os 21 grupos) com CNPJ/CPF
    const groups: GroupData[] = [
      {
        groupNumber: 1,
        companies: [
          { name: 'A.I EMPREENDIMENTOS', document: '24.176.335/0001-94' },
          { name: 'A.I EMPREENDIMENTOS E PARTICIPACOES', document: '42.359.411/0001-40' },
          { name: 'CAMILI CORRETORA DE SEGUROS', document: '03.717.739/0001-06' },
          { name: 'I C OLIVEIRA EMPREENDIMENTOS', document: '41.542.399/0001-98' },
          { name: 'ISAC DE CAMILI', document: '439.710.281-91' }
        ],
        mainPayerDocument: '24.176.335/0001-94',
        totalFee: 506.00,
        paymentDay: 10
      },
      {
        groupNumber: 2,
        companies: [
          { name: 'ACTION SERVICOS ESPECIALIZADOS', document: '18.960.975/0001-02' },
          { name: 'ACTION SOLUCOES', document: '33.661.589/0001-94' },
          { name: 'NP SERVICOS', document: '34.740.624/0001-00' },
          { name: 'SOUSA & OLIVEIRA', document: '32.707.836/0001-40' }
        ],
        mainPayerDocument: '18.960.975/0001-02',
        totalFee: 8095.82,
        paymentDay: 10
      },
      {
        groupNumber: 3,
        companies: [
          { name: 'ADMIR DE OLIVEIRA ALVES', document: '753.798.906-68' },
          { name: 'D & A EMPREENDIMENTOS', document: '23.701.256/0001-32' },
          { name: 'DECIO DE CAMILI', document: '257.482.921-87' }
        ],
        mainPayerDocument: '753.798.906-68',
        totalFee: 766.82,
        paymentDay: 5
      },
      {
        groupNumber: 4,
        companies: [
          { name: 'AMG INDUSTRIA COMERCIO SERVICOS', document: '09.217.174/0001-90' },
          { name: 'AV INDUSTRIA', document: '09.253.815/0001-33' },
          { name: 'CENTRO AUTOMOTIVO MEGA', document: '33.538.326/0001-02' },
          { name: 'COSTA & OLIVEIRA TRANSPORTES', document: '14.933.968/0001-26' },
          { name: 'JF COMERCIO', document: '12.399.426/0001-84' },
          { name: 'MEGA COMBUSTIVEIS', document: '02.771.931/0001-53' },
          { name: 'MEGA INDUSTRIA', document: '02.762.847/0001-08' }
        ],
        mainPayerDocument: '09.217.174/0001-90',
        totalFee: 663.64,
        paymentDay: 10
      },
      {
        groupNumber: 5,
        companies: [
          { name: 'ANAPOLIS SERVICOS DE VISTORIAS', document: '39.321.997/0001-91' },
          { name: 'CF MATERIAIS DE CONSTRUCAO', document: '46.274.419/0001-00' },
          { name: 'GP CONSTRUCAO CIVIL', document: '46.207.819/0001-35' },
          { name: 'HR PARTICIPACOES', document: '44.881.728/0001-52' },
          { name: 'MARQUES CORREA TRANSPORTE', document: '08.684.819/0001-26' },
          { name: 'MV PARTICIPACOES EMPREENDIMENTOS', document: '23.424.542/0001-83' }
        ],
        mainPayerDocument: '39.321.997/0001-91',
        totalFee: 833.33,
        paymentDay: 21
      },
      {
        groupNumber: 6,
        companies: [
          { name: 'ARANTES NEGOCIOS IMOBILIARIOS', document: '12.496.621/0001-08' },
          { name: 'RAQUEL CRISTINA COSTA DIAS BONFIM', document: '012.886.651-86' }
        ],
        mainPayerDocument: '12.496.621/0001-08',
        totalFee: 379.50,
        paymentDay: 10
      },
      {
        groupNumber: 7,
        companies: [
          { name: 'BOA VISTA AGROPECUARIA', document: '26.309.013/0001-42' },
          { name: 'BONUCCE INDUSTRIA', document: '02.991.093/0001-11' },
          { name: 'DINUCCI INVESTIMENTOS', document: '22.489.820/0001-02' },
          { name: 'EFS EMPREENDIMENTOS', document: '47.091.644/0001-80' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 8,
        companies: [
          { name: 'C D C OLIVEIRA ASSESSORIA EMPRESARIAL', document: '39.303.622/0001-66' },
          { name: 'ESTACAO ALEGRIA EVENTOS', document: '09.267.598/0001-39' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 10,
        companies: [
          { name: 'CONTRONWEB TECNOLOGIA', document: '32.754.670/0001-50' },
          { name: 'JCP NEGOCIOS IMOBILIARIOS', document: '27.476.584/0001-33' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 11,
        companies: [
          { name: 'ELETROMETALURGICA ITAMBE', document: '00.352.712/0001-07' },
          { name: 'LG INDUSTRIA METALURGICA', document: '15.391.744/0001-64' },
          { name: 'PRO AMBIENTAL', document: '38.050.176/0001-74' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 12,
        companies: [
          { name: 'GA ELOHIM PRESTADORA DE SERVICOS', document: '30.779.086/0001-30' },
          { name: 'GARIBALDI ADRIANO DE CAMILI', document: '231.944.871-34' },
          { name: 'MARIAH PARTICIPACOES E EMPREENDIMENTOS', document: '09.219.952/0001-57' }
        ],
        mainPayerDocument: '09.219.952/0001-57',
        totalFee: 3036.00,
        paymentDay: 10
      },
      {
        groupNumber: 13,
        companies: [
          { name: 'IMOBILIARIS TIMES NEGOCIOS IMOBILIARIOS', document: '30.782.636/0001-08' },
          { name: 'TIMES NEGOCIOS IMOBILIARIOS', document: '08.660.928/0001-85' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 14,
        companies: [
          { name: 'JPL AGROPECUARIA', document: '23.430.949/0001-05' },
          { name: 'PASQUALOTTO TRANSPORTES', document: '04.219.855/0001-48' },
          { name: 'PASQUALOTTO E CIA', document: '00.352.673/0001-90' },
          { name: 'PASQUALOTTO E PASQUALOTTO SERVICOS', document: '41.756.506/0001-90' },
          { name: 'SEMENTES PASQUALOTTO', document: '00.352.673/0002-71' },
          { name: 'TRADING PASQUALOTTO', document: '43.704.716/0001-44' },
          { name: 'V M PARTICIPACOES', document: '41.732.399/0001-40' },
          { name: 'W P PARTICIPACOES', document: '41.732.513/0001-86' },
          { name: 'WP PASQUALOTTO', document: '37.115.939/0001-42' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 15,
        companies: [
          { name: 'JR SOLUCOES INDUSTRIAIS', document: '30.751.028/0001-27' },
          { name: 'R & R OBRAS E SERVICOS', document: '42.259.948/0001-90' }
        ],
        mainPayerDocument: '30.751.028/0001-27',
        totalFee: 1518.00,
        paymentDay: 5
      },
      {
        groupNumber: 16,
        companies: [
          { name: 'LEK COLLOR COMERCIO DE VEICULOS', document: '18.172.568/0001-81' },
          { name: 'CASA NOVA TINTAS E ACABAMENTOS', document: '30.784.044/0001-45' },
          { name: 'MDL EMPREENDIMENTOS', document: '47.053.847/0001-66' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 17,
        companies: [
          { name: 'MG ALTERNATIVA', document: '02.985.853/0001-77' },
          { name: 'MG MECANICA INDUSTRIAL', document: '02.896.486/0001-81' },
          { name: 'MVA CONSTRUCOES', document: '18.966.823/0001-24' },
          { name: 'AGROSYSTEM', document: '06.018.084/0001-18' },
          { name: 'GRUPO MINASGRAOS TRADING', document: '02.985.853/0002-58' },
          { name: 'RV MECANICA INDUSTRIAL', document: '22.508.806/0001-74' },
          { name: 'TERENAS AGRO INDUSTRIAL', document: '05.987.992/0001-27' },
          { name: 'VALE DO SAO FRANCISCO CONSULTORIA', document: '21.432.664/0001-93' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 18,
        companies: [
          { name: 'MURANO MOVEIS', document: '03.026.656/0001-39' },
          { name: 'TCC COMERCIO DE COMPONENTES ELETRONICOS', document: '26.196.976/0001-74' },
          { name: 'TCC CONSTRUCOES', document: '01.006.652/0001-44' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 19,
        companies: [
          { name: 'PAES AGROPECUARIA', document: '23.433.055/0001-79' },
          { name: 'DEL PAPA INDUSTRIA', document: '02.985.852/0001-21' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      },
      {
        groupNumber: 20,
        companies: [
          { name: 'PET SHOP E CAOPANHIA', document: '07.995.969/0001-10' },
          { name: 'RL CONSULTORIA E ASSESSORIA EMPRESARIAL', document: '39.305.029/0001-72' }
        ],
        mainPayerDocument: '07.995.969/0001-10',
        totalFee: 1518.00,
        paymentDay: 5
      },
      {
        groupNumber: 21,
        companies: [
          { name: 'QUELUZ ADMINISTRADORA DE BENS', document: '12.494.695/0001-84' },
          { name: 'NUTRYMED SUPLEMENTOS ALIMENTARES', document: '30.783.960/0001-64' }
        ],
        mainPayerDocument: '',
        totalFee: 0,
        paymentDay: 0
      }
    ];

    const results = [];

    for (const group of groups) {
      console.log(`Processing Group ${group.groupNumber}: ${group.companies.length} companies`);

      // Buscar clientes pelo nome (mais confiável que documento)
      const companyNames = group.companies.map(c => c.name);
      
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, cnpj, cpf, monthly_fee, payment_day')
        .in('name', companyNames)
        .eq('status', 'active');

      if (clientsError) {
        console.error(`Error fetching clients for group ${group.groupNumber}:`, clientsError);
        results.push({ group: group.groupNumber, error: clientsError.message });
        continue;
      }

      if (!clients || clients.length === 0) {
        console.error(`No clients found for group ${group.groupNumber}. Searched for: ${companyNames.join(', ')}`);
        results.push({ 
          group: group.groupNumber, 
          error: 'No clients found',
          searchedNames: companyNames
        });
        continue;
      }

      // Determinar empresa pagadora
      let mainPayerClient;
      let totalFee = group.totalFee;
      let paymentDay = group.paymentDay;

      // Tentar encontrar pelo documento da pagadora
      if (group.mainPayerDocument) {
        const normalizedMainDoc = group.mainPayerDocument.replace(/[^\d]/g, '');
        mainPayerClient = clients.find(c => {
          const clientDoc = (c.cnpj || c.cpf || '').replace(/[^\d]/g, '');
          return clientDoc === normalizedMainDoc;
        });
      }

      // Se não encontrou pela documento, tentar pelo nome
      if (!mainPayerClient) {
        const mainPayerCompany = group.companies.find(c => c.document === group.mainPayerDocument);
        if (mainPayerCompany) {
          mainPayerClient = clients.find(c => c.name === mainPayerCompany.name);
        }
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
