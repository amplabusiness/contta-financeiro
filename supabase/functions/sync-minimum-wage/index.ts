import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// API do Banco Central - Série 1619 (Salário Mínimo)
const BCB_API_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1619/dados?formato=json";

interface BCBMinimumWage {
  data: string; // formato DD/MM/YYYY
  valor: string;
}

interface MinimumWageRecord {
  effective_date: string;
  end_date: string | null;
  value: number;
  source: string;
  notes: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action } = await req.json().catch(() => ({ action: 'sync' }));

    // Buscar dados do Banco Central
    console.log("Buscando salários mínimos do Banco Central...");
    const bcbResponse = await fetch(BCB_API_URL);

    if (!bcbResponse.ok) {
      throw new Error(`Erro ao buscar dados do BCB: ${bcbResponse.status}`);
    }

    const bcbData: BCBMinimumWage[] = await bcbResponse.json();
    console.log(`Recebidos ${bcbData.length} registros do BCB`);

    // Agrupar por valor para identificar períodos de vigência
    const wageChanges: MinimumWageRecord[] = [];
    let currentValue: number | null = null;
    let startDate: string | null = null;

    for (let i = 0; i < bcbData.length; i++) {
      const item = bcbData[i];
      const value = parseFloat(item.valor);

      // Converter data DD/MM/YYYY para YYYY-MM-DD
      const [day, month, year] = item.data.split('/');
      const dateStr = `${year}-${month}-${day}`;

      if (currentValue !== value) {
        // Novo valor encontrado - fechar período anterior se existir
        if (currentValue !== null && startDate !== null) {
          // Data de fim é um dia antes da nova data
          const prevDate = new Date(dateStr);
          prevDate.setDate(prevDate.getDate() - 1);
          const endDate = prevDate.toISOString().split('T')[0];

          wageChanges[wageChanges.length - 1].end_date = endDate;
        }

        // Iniciar novo período
        startDate = dateStr;
        currentValue = value;

        // Determinar ano para as notas
        const yearNum = parseInt(year);

        wageChanges.push({
          effective_date: startDate,
          end_date: null, // Será preenchido quando mudar
          value: value,
          source: 'BCB_SGS_1619',
          notes: `Salário Mínimo ${yearNum} - Atualização automática via API BCB`
        });
      }
    }

    // Filtrar apenas alterações reais de valor (ignorar repetições mensais)
    // Manter apenas o primeiro registro de cada valor único
    const uniqueWages: MinimumWageRecord[] = [];
    const seenValues = new Set<number>();

    for (const wage of wageChanges) {
      const key = `${wage.value}-${wage.effective_date.substring(0, 4)}`; // valor + ano
      if (!seenValues.has(wage.value) ||
          // Permitir mesmo valor em anos diferentes (caso de congelamento)
          !uniqueWages.some(w => w.value === wage.value &&
            w.effective_date.substring(0, 4) === wage.effective_date.substring(0, 4))) {
        uniqueWages.push(wage);
        seenValues.add(wage.value);
      }
    }

    console.log(`Identificadas ${uniqueWages.length} alterações de salário mínimo`);

    // Buscar registros existentes
    const { data: existingWages, error: fetchError } = await supabase
      .from('minimum_wage_history')
      .select('effective_date, value')
      .order('effective_date', { ascending: false });

    if (fetchError) throw fetchError;

    const existingDates = new Set(existingWages?.map(w => w.effective_date) || []);

    // Inserir apenas novos registros
    const newWages = uniqueWages.filter(w => !existingDates.has(w.effective_date));

    let inserted = 0;
    let updated = 0;

    if (newWages.length > 0) {
      console.log(`Inserindo ${newWages.length} novos registros...`);

      for (const wage of newWages) {
        const { error: insertError } = await supabase
          .from('minimum_wage_history')
          .upsert({
            effective_date: wage.effective_date,
            end_date: wage.end_date,
            value: wage.value,
            source: wage.source,
            notes: wage.notes
          }, {
            onConflict: 'effective_date'
          });

        if (insertError) {
          console.error(`Erro ao inserir ${wage.effective_date}:`, insertError);
        } else {
          inserted++;
        }
      }
    }

    // Atualizar end_dates dos registros existentes
    for (let i = 0; i < uniqueWages.length - 1; i++) {
      const current = uniqueWages[i];
      const next = uniqueWages[i + 1];

      // Calcular end_date (dia anterior ao próximo)
      const nextDate = new Date(next.effective_date);
      nextDate.setDate(nextDate.getDate() - 1);
      const endDate = nextDate.toISOString().split('T')[0];

      const { error: updateError } = await supabase
        .from('minimum_wage_history')
        .update({ end_date: endDate })
        .eq('effective_date', current.effective_date)
        .is('end_date', null);

      if (!updateError) {
        updated++;
      }
    }

    // Obter valor atual
    const currentMinWage = uniqueWages[uniqueWages.length - 1];

    // Retornar resultado
    const result = {
      success: true,
      message: `Sincronização concluída`,
      stats: {
        total_from_bcb: bcbData.length,
        unique_changes: uniqueWages.length,
        inserted: inserted,
        updated: updated,
        current_minimum_wage: currentMinWage?.value,
        current_effective_date: currentMinWage?.effective_date
      },
      recent_wages: uniqueWages.slice(-10).reverse()
    };

    console.log("Resultado:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Erro na sincronização:", error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
