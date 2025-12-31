import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * AI Web Search - Pesquisa externa usando Serper.dev
 *
 * Permite que os agentes de IA façam pesquisas na web para obter
 * informações atualizadas sobre empresas, legislação, etc.
 */

interface SearchRequest {
  query: string;
  type?: 'search' | 'news' | 'places' | 'images';
  num?: number;
  gl?: string; // País (br = Brasil)
  hl?: string; // Idioma (pt-br)
}

interface SearchResult {
  success: boolean;
  results?: any[];
  knowledge_graph?: any;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');

    if (!SERPER_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SERPER_API_KEY not configured'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const body: SearchRequest = await req.json();
    const {
      query,
      type = 'search',
      num = 10,
      gl = 'br',
      hl = 'pt-br'
    } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`[AI-WebSearch] Searching: "${query}" (type: ${type})`);

    // Determinar endpoint baseado no tipo
    let endpoint = 'https://google.serper.dev/search';
    if (type === 'news') endpoint = 'https://google.serper.dev/news';
    if (type === 'places') endpoint = 'https://google.serper.dev/places';
    if (type === 'images') endpoint = 'https://google.serper.dev/images';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num,
        gl,
        hl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-WebSearch] Serper error:', response.status, errorText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Serper API error: ${response.status}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();

    console.log(`[AI-WebSearch] Found ${data.organic?.length || 0} organic results`);

    // Formatar resultados para uso pelos agentes
    const formattedResults: SearchResult = {
      success: true,
      results: data.organic?.map((r: any) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet,
        position: r.position,
      })) || [],
      knowledge_graph: data.knowledgeGraph,
    };

    // Adicionar resultados específicos por tipo
    if (type === 'news' && data.news) {
      formattedResults.results = data.news.map((n: any) => ({
        title: n.title,
        link: n.link,
        snippet: n.snippet,
        date: n.date,
        source: n.source,
      }));
    }

    if (type === 'places' && data.places) {
      formattedResults.results = data.places.map((p: any) => ({
        title: p.title,
        address: p.address,
        rating: p.rating,
        reviews: p.reviews,
        phone: p.phone,
        website: p.website,
      }));
    }

    return new Response(
      JSON.stringify(formattedResults),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[AI-WebSearch] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
