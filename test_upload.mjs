import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
  console.log('🧪 Iniciando teste de upload manual da Edge Function...');

  const filePath = path.join(process.cwd(), 'banco', 'fev 2025.ofx');
  
  try {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`📄 Arquivo lido: ${fileContent.length} bytes`);

    console.log('🚀 Invocando função parse-ofx-statement...');
    
    // Invocar diretamente a função via Supabase Client
    const { data, error } = await supabase.functions.invoke('parse-ofx-statement', {
        body: { ofx_content: fileContent }
    });

    if (error) {
        console.error('❌ ERRO NA FUNÇÃO (Client Error):');
        console.error(error);
        
        // Tentar ler o corpo da resposta se disponível
        if (error.context && typeof error.context.json === 'function') {
             try {
                 const bodyError = await error.context.json();
                 console.error('⚠️ Detalhes do Erro 400:', JSON.stringify(bodyError, null, 2));
             } catch (e) {
                 console.error('Não foi possível ler o body do erro:', e);
             }
        }
    } else {
        console.log('✅ SUCESSO!');
        console.log('Dados recebidos:', JSON.stringify(data, null, 2));
    }

  } catch (err) {
    console.error('❌ ERRO LOCAL:', err.message);
  }
}

testUpload();