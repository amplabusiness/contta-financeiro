import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interface para resposta da CNPJa API
interface CNPJaResponse {
  taxId: string;
  updated: string;
  company: {
    id: number;
    name: string;
    equity: number;
    nature: {
      id: number;
      text: string;
    };
    size: {
      id: number;
      acronym: string;
      text: string;
    };
    simples?: {
      optant: boolean;
      since?: string;
    };
    simei?: {
      optant: boolean;
      since?: string;
    };
    members?: Array<{
      since: string;
      role: {
        id: number;
        text: string;
      };
      person: {
        id: string;
        name: string;
        type: string;
        taxId?: string;
        age?: string;
      };
    }>;
  };
  alias?: string;
  founded: string;
  head: boolean;
  statusDate: string;
  status: {
    id: number;
    text: string;
  };
  address: {
    municipality: number;
    street: string;
    number: string;
    details?: string;
    district: string;
    city: string;
    state: string;
    zip: string;
    country: {
      id: number;
      name: string;
    };
  };
  phones?: Array<{
    area: string;
    number: string;
  }>;
  emails?: Array<{
    address: string;
    domain: string;
  }>;
  mainActivity: {
    id: number;
    text: string;
  };
  sideActivities?: Array<{
    id: number;
    text: string;
  }>;
  registrations?: Array<{
    state: string;
    number: string;
    enabled: boolean;
    statusDate?: string;
    status?: {
      id: number;
      text: string;
    };
    type?: {
      id: number;
      text: string;
    };
  }>;
}

// Interface para resposta da Brasil API (fallback)
interface BrasilAPIResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  ddd_telefone_1: string;
  porte: string;
  natureza_juridica: string;
  capital_social: string;
  data_inicio_atividade: string;
  descricao_situacao_cadastral: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  qsa?: Array<{
    nome_socio?: string;
    nome?: string;
    qualificacao_socio?: string;
    qual?: string;
    data_entrada_sociedade?: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();

    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Limpar CNPJ (remover pontuação)
    const cleanCnpj = cnpj.replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      return new Response(
        JSON.stringify({ error: 'CNPJ deve ter 14 dígitos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Buscando dados do CNPJ: ${cleanCnpj}`);

    // Tentar primeiro a CNPJa API (mais completa)
    const cnpjaApiKey = Deno.env.get('CNPJA_API_KEY');
    const cnpjaBaseUrl = Deno.env.get('CNPJA_BASE_URL') || 'https://api.cnpja.com';

    let companyData = null;

    if (cnpjaApiKey) {
      try {
        console.log('Tentando CNPJa API...');
        const cnpjaResponse = await fetch(`${cnpjaBaseUrl}/office/${cleanCnpj}`, {
          headers: {
            'Authorization': cnpjaApiKey,
          },
        });

        if (cnpjaResponse.ok) {
          const cnpjaData: CNPJaResponse = await cnpjaResponse.json();
          console.log('Dados recebidos da CNPJa:', JSON.stringify(cnpjaData).substring(0, 500));

          // Formatar telefone
          let phone = '';
          if (cnpjaData.phones && cnpjaData.phones.length > 0) {
            const p = cnpjaData.phones[0];
            phone = `(${p.area}) ${p.number}`;
          }

          // Formatar email
          let email = '';
          if (cnpjaData.emails && cnpjaData.emails.length > 0) {
            email = cnpjaData.emails[0].address;
          }

          // Extrair sócios
          const socios = cnpjaData.company.members?.map(m => ({
            nome: m.person.name,
            qualificacao: m.role.text,
            data_entrada: m.since,
            cpf: m.person.taxId,
          })) || [];

          companyData = {
            source: 'cnpja',
            cnpj: cleanCnpj,
            razao_social: cnpjaData.company.name,
            nome_fantasia: cnpjaData.alias || cnpjaData.company.name,
            logradouro: cnpjaData.address.street,
            numero: cnpjaData.address.number,
            complemento: cnpjaData.address.details || '',
            bairro: cnpjaData.address.district,
            municipio: cnpjaData.address.city,
            uf: cnpjaData.address.state,
            cep: cnpjaData.address.zip,
            email: email,
            telefone: phone,
            porte: cnpjaData.company.size?.text || '',
            natureza_juridica: cnpjaData.company.nature?.text || '',
            capital_social: cnpjaData.company.equity || 0,
            data_abertura: cnpjaData.founded,
            situacao: cnpjaData.status?.text || '',
            atividade_principal: {
              codigo: cnpjaData.mainActivity?.id,
              descricao: cnpjaData.mainActivity?.text,
            },
            simples_nacional: cnpjaData.company.simples?.optant || false,
            mei: cnpjaData.company.simei?.optant || false,
            socios: socios,
            inscricao_estadual: cnpjaData.registrations?.find(r => r.state === cnpjaData.address.state)?.number || '',
          };
        } else {
          console.log(`CNPJa retornou status ${cnpjaResponse.status}, tentando Brasil API...`);
        }
      } catch (cnpjaError) {
        console.error('Erro ao consultar CNPJa:', cnpjaError);
      }
    }

    // Fallback para Brasil API se CNPJa falhar
    if (!companyData) {
      console.log('Usando Brasil API como fallback...');
      const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);

      if (!brasilApiResponse.ok) {
        const errorText = await brasilApiResponse.text();
        console.error(`Erro da BrasilAPI (${brasilApiResponse.status}):`, errorText);

        if (brasilApiResponse.status === 404 || brasilApiResponse.status === 400) {
          return new Response(
            JSON.stringify({ error: 'CNPJ não encontrado na Receita Federal' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
          );
        }

        throw new Error(`Erro ao consultar CNPJ: ${brasilApiResponse.status}`);
      }

      const brasilData: BrasilAPIResponse = await brasilApiResponse.json();
      console.log('Dados recebidos da BrasilAPI:', JSON.stringify(brasilData).substring(0, 500));

      // Formatar telefone
      let phone = '';
      if (brasilData.ddd_telefone_1) {
        const phoneClean = brasilData.ddd_telefone_1.replace(/\D/g, '');
        if (phoneClean.length >= 10) {
          phone = `(${phoneClean.slice(0, 2)}) ${phoneClean.slice(2, 6)}-${phoneClean.slice(6)}`;
        }
      }

      // Extrair sócios
      const socios = brasilData.qsa?.map(s => ({
        nome: s.nome_socio || s.nome || '',
        qualificacao: s.qualificacao_socio || s.qual || '',
        data_entrada: s.data_entrada_sociedade || '',
      })) || [];

      companyData = {
        source: 'brasilapi',
        cnpj: cleanCnpj,
        razao_social: brasilData.razao_social,
        nome_fantasia: brasilData.nome_fantasia || brasilData.razao_social,
        logradouro: brasilData.logradouro,
        numero: brasilData.numero,
        complemento: brasilData.complemento || '',
        bairro: brasilData.bairro,
        municipio: brasilData.municipio,
        uf: brasilData.uf,
        cep: brasilData.cep,
        email: brasilData.email || '',
        telefone: phone,
        porte: brasilData.porte || '',
        natureza_juridica: brasilData.natureza_juridica || '',
        capital_social: parseFloat(brasilData.capital_social || '0'),
        data_abertura: brasilData.data_inicio_atividade,
        situacao: brasilData.descricao_situacao_cadastral || '',
        atividade_principal: {
          codigo: brasilData.cnae_fiscal,
          descricao: brasilData.cnae_fiscal_descricao,
        },
        socios: socios,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: companyData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao buscar CNPJ:', error);

    let errorMessage = 'Erro ao buscar dados do CNPJ';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
