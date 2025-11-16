import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting automated file processing...');

    // Get pending files from queue
    const { data: pendingFiles, error: queueError } = await supabase
      .from('file_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('uploaded_at', { ascending: true })
      .limit(10);

    if (queueError) throw queueError;

    if (!pendingFiles || pendingFiles.length === 0) {
      console.log('✅ No pending files to process');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending files', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📁 Found ${pendingFiles.length} files to process`);

    const results = [];

    for (const file of pendingFiles) {
      try {
        // Mark as processing
        await supabase
          .from('file_processing_queue')
          .update({ status: 'processing' })
          .eq('id', file.id);

        console.log(`⚙️ Processing ${file.file_type}: ${file.file_path}`);

        // Download file from storage
        const { data: fileData, error: downloadError } = await supabase
          .storage
          .from(file.file_type === 'boleto_report' ? 'boleto-reports' : 'bank-statements')
          .download(file.file_path);

        if (downloadError) throw downloadError;

        // Convert blob to base64
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const base64 = btoa(String.fromCharCode(...uint8Array));

        let processingResult: any = {};

        // Process based on file type
        if (file.file_type === 'boleto_report') {
          // Process boleto report
          const { data: boletoResult, error: boletoError } = await supabase.functions.invoke(
            'process-boleto-report',
            {
              body: {
                fileContent: base64,
                fileName: file.file_path.split('/').pop()
              }
            }
          );

          if (boletoError) throw boletoError;
          processingResult.boleto = boletoResult;
          console.log('✅ Boleto report processed');

        } else if (file.file_type === 'bank_statement') {
          // Process bank statement
          const { data: statementResult, error: statementError } = await supabase.functions.invoke(
            'process-bank-statement',
            {
              body: {
                fileContent: base64,
                fileName: file.file_path.split('/').pop()
              }
            }
          );

          if (statementError) throw statementError;
          processingResult.statement = statementResult;
          console.log('✅ Bank statement processed');
        }

        // Run auto-reconciliation after processing
        console.log('🔄 Running auto-reconciliation...');
        const { data: reconResult, error: reconError } = await supabase.functions.invoke(
          'auto-reconciliation',
          { body: { action: 'reconcile_bank_statement' } }
        );

        if (reconError) {
          console.error('⚠️ Reconciliation error:', reconError);
        } else {
          processingResult.reconciliation = reconResult;
          console.log('✅ Auto-reconciliation completed');
        }

        // Mark as completed
        await supabase
          .from('file_processing_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            processing_result: processingResult
          })
          .eq('id', file.id);

        results.push({
          file_id: file.id,
          file_path: file.file_path,
          status: 'success',
          result: processingResult
        });

      } catch (error: any) {
        console.error(`❌ Error processing file ${file.id}:`, error);

        // Mark as failed
        await supabase
          .from('file_processing_queue')
          .update({
            status: 'failed',
            processed_at: new Date().toISOString(),
            error_message: error.message || 'Unknown error'
          })
          .eq('id', file.id);

        results.push({
          file_id: file.id,
          file_path: file.file_path,
          status: 'failed',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} files`,
        processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-file-queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
