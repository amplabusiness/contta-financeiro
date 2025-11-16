import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BoletoRow {
  pagador: string;
  dataVencimento: string;
  dataLiquidacao: string;
  valor: number;
  liquidacao: number;
  situacao: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the file from the request
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log('Processing file:', file.name);

    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    console.log('Total rows:', data.length);

    // Process and group by client
    const clientData = new Map<string, BoletoRow[]>();

    for (const row of data) {
      const pagador = (row['Pagador'] || '').toString().trim().toUpperCase();
      
      if (!pagador) continue;

      // Parse value (handle Brazilian format: 1.234,56)
      const valorStr = (row['Valor (R$)'] || '0').toString().replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(valorStr) || 0;

      const boletoRow: BoletoRow = {
        pagador,
        dataVencimento: (row['Data Vencimento'] || '').toString(),
        dataLiquidacao: (row['Data Liquidação'] || '').toString(),
        valor,
        liquidacao: parseFloat((row['Liquidação (R$)'] || '0').toString().replace(/\./g, '').replace(',', '.')) || 0,
        situacao: (row['Situação do Boleto'] || '').toString()
      };

      if (!clientData.has(pagador)) {
        clientData.set(pagador, []);
      }
      clientData.get(pagador)!.push(boletoRow);
    }

    console.log('Unique clients found:', clientData.size);

    const results = {
      processed: 0,
      updated: 0,
      notFound: [] as string[],
      errors: [] as any[]
    };

    // Process each client
    for (const [pagadorName, boletos] of clientData) {
      try {
        results.processed++;

        // Calculate most common monthly fee (from liquidated boletos)
        const liquidatedBoletos = boletos.filter(b => 
          b.situacao.includes('LIQUIDADO') && b.valor > 0
        );

        if (liquidatedBoletos.length === 0) {
          console.log(`No liquidated boletos for ${pagadorName}`);
          continue;
        }

        // Get most frequent value
        const valueFrequency = new Map<number, number>();
        for (const b of liquidatedBoletos) {
          valueFrequency.set(b.valor, (valueFrequency.get(b.valor) || 0) + 1);
        }
        
        const mostCommonValue = Array.from(valueFrequency.entries())
          .sort((a, b) => b[1] - a[1])[0][0];

        // Get most common payment day
        const paymentDays = liquidatedBoletos
          .map(b => {
            const match = b.dataVencimento.match(/^(\d{2})\//);
            return match ? parseInt(match[1]) : null;
          })
          .filter(d => d !== null) as number[];

        const dayFrequency = new Map<number, number>();
        for (const day of paymentDays) {
          dayFrequency.set(day, (dayFrequency.get(day) || 0) + 1);
        }

        const mostCommonDay = Array.from(dayFrequency.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 10;

        console.log(`Processing ${pagadorName}: monthly_fee=${mostCommonValue}, payment_day=${mostCommonDay}`);

        // Find client by normalized name
        const normalizedSearch = pagadorName.replace(/\s+/g, ' ');
        
        const { data: clients, error: searchError } = await supabase
          .from('clients')
          .select('id, name, cnpj, monthly_fee, payment_day')
          .eq('status', 'active')
          .ilike('name', `%${normalizedSearch}%`)
          .limit(5);

        if (searchError) {
          console.error('Search error:', searchError);
          results.errors.push({ client: pagadorName, error: searchError.message });
          continue;
        }

        if (!clients || clients.length === 0) {
          console.log(`Client not found: ${pagadorName}`);
          results.notFound.push(pagadorName);
          continue;
        }

        // Find best match
        let bestMatch = clients[0];
        if (clients.length > 1) {
          // Prefer exact match or closest match
          const exactMatch = clients.find(c => 
            c.name.toUpperCase().trim() === pagadorName
          );
          if (exactMatch) {
            bestMatch = exactMatch;
          }
        }

        console.log(`Matched to client: ${bestMatch.name} (ID: ${bestMatch.id})`);

        // Update client
        const { error: updateError } = await supabase
          .from('clients')
          .update({
            monthly_fee: mostCommonValue,
            payment_day: mostCommonDay,
            updated_at: new Date().toISOString()
          })
          .eq('id', bestMatch.id);

        if (updateError) {
          console.error('Update error:', updateError);
          results.errors.push({ client: pagadorName, error: updateError.message });
        } else {
          results.updated++;
          console.log(`✓ Updated ${pagadorName}: R$ ${mostCommonValue} - Day ${mostCommonDay}`);
        }

      } catch (error) {
        console.error(`Error processing ${pagadorName}:`, error);
        results.errors.push({ 
          client: pagadorName, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    console.log('Processing complete:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});