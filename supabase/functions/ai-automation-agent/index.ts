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

  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[AI-Automation] ${msg}`);
    logs.push(`${new Date().toISOString()} - ${msg}`);
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Suporte a múltiplas APIs de IA - prioriza Gemini
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const AI_PROVIDER = GEMINI_API_KEY ? 'gemini' : 'lovable';
    const AI_KEY = GEMINI_API_KEY || LOVABLE_API_KEY;

    log(`🤖 AI Automation Agent started (using ${AI_PROVIDER})`);

    const { action } = await req.json();

    let result: any = { success: true, action };

    switch (action) {
      case 'generate_recurring_expenses':
        result = await generateRecurringExpenses(supabase, AI_KEY, AI_PROVIDER, log);
        break;

      case 'generate_invoices':
        result = await generateInvoices(supabase, AI_KEY, AI_PROVIDER, log);
        break;

      case 'generate_missing_contracts':
        result = await generateMissingContracts(supabase, AI_KEY, AI_PROVIDER, log);
        break;

      case 'check_company_status':
        result = await checkCompanyStatusAndGenerateDistracts(supabase, AI_KEY, AI_PROVIDER, log);
        break;

      case 'detect_recurring_patterns':
        result = await detectRecurringPatterns(supabase, AI_KEY, AI_PROVIDER, log);
        break;

      case 'full_automation':
        // Executa todas as automações
        const recurring = await generateRecurringExpenses(supabase, AI_KEY, AI_PROVIDER, log);
        const invoices = await generateInvoices(supabase, AI_KEY, AI_PROVIDER, log);
        const contracts = await generateMissingContracts(supabase, AI_KEY, AI_PROVIDER, log);
        const status = await checkCompanyStatusAndGenerateDistracts(supabase, AI_KEY, AI_PROVIDER, log);

        result = {
          success: true,
          action: 'full_automation',
          recurring_expenses: recurring,
          invoices: invoices,
          contracts: contracts,
          company_status: status
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const executionTime = Date.now() - startTime;
    log(`✅ Completed in ${executionTime}ms`);

    // Logar execução
    try {
      await supabase.from('ai_automation_logs').insert({
        automation_type: action,
        status: 'success',
        message: `Executed ${action} successfully`,
        details: result,
        ai_model: AI_PROVIDER,
        ai_response_time_ms: executionTime
      });
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ ...result, executionTime, logs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log(`❌ Error: ${errorMsg}`);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg, logs }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Helper: Chamar IA (Gemini ou Lovable)
 */
async function callAI(apiKey: string, provider: string, systemPrompt: string, userPrompt: string) {
  if (provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4000 }
        })
      }
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!response.ok) throw new Error(`Lovable API error: ${response.status}`);
    const result = await response.json();
    return result.choices[0].message.content;
  }
}

/**
 * GERAR DESPESAS RECORRENTES
 */
async function generateRecurringExpenses(supabase: any, aiKey: string | undefined, provider: string, log: Function) {
  log('📋 Generating recurring expenses...');

  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

  // Buscar despesas recorrentes ativas que precisam ser geradas
  const { data: recurringExpenses, error } = await supabase
    .from('recurring_expenses')
    .select('*')
    .eq('is_active', true)
    .or(`next_due_date.is.null,next_due_date.lte.${today.toISOString().slice(0, 10)}`);

  if (error) throw error;

  log(`Found ${recurringExpenses?.length || 0} recurring expenses to process`);

  let generated = 0;
  const results: any[] = [];

  for (const recurring of recurringExpenses || []) {
    try {
      // Calcular próxima data de vencimento
      let dueDate: Date;
      if (recurring.next_due_date) {
        dueDate = new Date(recurring.next_due_date);
      } else {
        dueDate = new Date(today.getFullYear(), today.getMonth(), recurring.due_day || 10);
        if (dueDate < today) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
      }

      // Verificar se já existe despesa para esta data
      const competence = dueDate.toISOString().slice(0, 7);
      const { data: existing } = await supabase
        .from('accounts_payable')
        .select('id')
        .eq('parent_expense_id', recurring.id)
        .gte('due_date', `${competence}-01`)
        .lte('due_date', `${competence}-31`)
        .limit(1);

      if (existing && existing.length > 0) {
        log(`Skipping ${recurring.description} - already exists for ${competence}`);
        continue;
      }

      // Criar despesa
      const { error: insertError } = await supabase
        .from('accounts_payable')
        .insert({
          description: recurring.description,
          supplier_name: recurring.supplier_name,
          supplier_document: recurring.supplier_document,
          category: recurring.category,
          amount: recurring.is_installment ? recurring.installment_amount : recurring.amount,
          due_date: dueDate.toISOString().slice(0, 10),
          status: 'pending',
          is_recurring: true,
          parent_expense_id: recurring.id,
          notes: recurring.is_installment
            ? `Parcela ${recurring.current_installment}/${recurring.total_installments}`
            : `Despesa recorrente gerada automaticamente`,
          created_by: '00000000-0000-0000-0000-000000000000' // System
        });

      if (insertError) throw insertError;

      // Calcular próxima data
      let nextDue = new Date(dueDate);
      switch (recurring.frequency) {
        case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1); break;
        case 'bimonthly': nextDue.setMonth(nextDue.getMonth() + 2); break;
        case 'quarterly': nextDue.setMonth(nextDue.getMonth() + 3); break;
        case 'semiannual': nextDue.setMonth(nextDue.getMonth() + 6); break;
        case 'annual': nextDue.setFullYear(nextDue.getFullYear() + 1); break;
      }

      // Atualizar despesa recorrente
      const updateData: any = {
        last_generated_date: dueDate.toISOString().slice(0, 10),
        next_due_date: nextDue.toISOString().slice(0, 10)
      };

      // Se é parcelamento, incrementar parcela
      if (recurring.is_installment) {
        const newInstallment = (recurring.current_installment || 1) + 1;
        updateData.current_installment = newInstallment;

        // Verificar se terminou
        if (newInstallment > recurring.total_installments) {
          updateData.is_active = false;
          updateData.end_date = dueDate.toISOString().slice(0, 10);
        }
      }

      await supabase
        .from('recurring_expenses')
        .update(updateData)
        .eq('id', recurring.id);

      generated++;
      results.push({
        id: recurring.id,
        description: recurring.description,
        due_date: dueDate.toISOString().slice(0, 10),
        amount: recurring.is_installment ? recurring.installment_amount : recurring.amount
      });

      log(`✅ Generated: ${recurring.description} - R$ ${recurring.amount} - Due: ${dueDate.toISOString().slice(0, 10)}`);

    } catch (err: any) {
      log(`❌ Error generating ${recurring.description}: ${err.message}`);
    }
  }

  return { success: true, generated, results };
}

/**
 * GERAR BOLETOS/FATURAS RESPEITANDO DATA DE ABERTURA
 */
async function generateInvoices(supabase: any, aiKey: string | undefined, provider: string, log: Function) {
  log('💰 Generating invoices...');

  const today = new Date();
  const currentCompetence = today.toISOString().slice(0, 7);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextCompetence = nextMonth.toISOString().slice(0, 7);

  // Buscar configurações de automação
  const { data: settings } = await supabase
    .from('office_settings')
    .select('value')
    .eq('key', 'automation_settings')
    .single();

  const autoSettings = settings?.value || {};
  const generationDay = autoSettings.invoice_generation_day || 1;

  // Verificar se é dia de gerar
  if (today.getDate() < generationDay) {
    log(`Not generation day yet (day ${generationDay})`);
    return { success: true, generated: 0, message: `Generation day is ${generationDay}` };
  }

  // Buscar clientes ativos que precisam de fatura
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true)
    .eq('is_pro_bono', false)
    .eq('is_barter', false)
    .gt('monthly_fee', 0);

  if (error) throw error;

  log(`Found ${clients?.length || 0} clients to check`);

  let generated = 0;
  let skipped = 0;
  const results: any[] = [];

  for (const client of clients || []) {
    try {
      // Validar se pode gerar fatura para este cliente
      const validation = await validateInvoiceGeneration(supabase, client, nextCompetence);

      if (!validation.valid) {
        log(`⏭️ Skipping ${client.name}: ${validation.reason}`);
        skipped++;
        results.push({
          client_id: client.id,
          client_name: client.name,
          status: 'skipped',
          reason: validation.reason
        });
        continue;
      }

      // Verificar se já existe fatura para a competência
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('client_id', client.id)
        .eq('competence', nextCompetence)
        .limit(1);

      if (existingInvoice && existingInvoice.length > 0) {
        log(`⏭️ Invoice already exists for ${client.name} - ${nextCompetence}`);
        skipped++;
        continue;
      }

      // Calcular data de vencimento
      const paymentDay = client.payment_day || 10;
      const dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), paymentDay);

      // Criar fatura
      const { error: insertError } = await supabase
        .from('invoices')
        .insert({
          client_id: client.id,
          amount: client.monthly_fee,
          due_date: dueDate.toISOString().slice(0, 10),
          competence: nextCompetence,
          status: 'pending',
          description: `Honorários contábeis - ${nextCompetence}`,
          created_by: '00000000-0000-0000-0000-000000000000' // System
        });

      if (insertError) throw insertError;

      generated++;
      results.push({
        client_id: client.id,
        client_name: client.name,
        status: 'generated',
        competence: nextCompetence,
        amount: client.monthly_fee,
        due_date: dueDate.toISOString().slice(0, 10)
      });

      log(`✅ Generated invoice: ${client.name} - R$ ${client.monthly_fee} - ${nextCompetence}`);

    } catch (err: any) {
      log(`❌ Error generating invoice for ${client.name}: ${err.message}`);
    }
  }

  return { success: true, generated, skipped, results };
}

/**
 * Validar se pode gerar fatura para o cliente
 */
async function validateInvoiceGeneration(supabase: any, client: any, competence: string) {
  // 1. Verificar data de abertura
  if (client.data_abertura) {
    const openingDate = new Date(client.data_abertura);
    const competenceDate = new Date(competence + '-01');

    // Primeiro mês válido é o mês de abertura
    const firstValidMonth = new Date(openingDate.getFullYear(), openingDate.getMonth(), 1);

    if (competenceDate < firstValidMonth) {
      return {
        valid: false,
        reason: `Competência ${competence} é anterior à abertura da empresa (${client.data_abertura})`
      };
    }
  }

  // 2. Verificar situação cadastral
  if (client.situacao_cadastral && ['SUSPENSA', 'INAPTA', 'BAIXADA', 'NULA'].includes(client.situacao_cadastral)) {
    return {
      valid: false,
      reason: `Empresa com situação irregular: ${client.situacao_cadastral}`
    };
  }

  // 3. Verificar se tem contrato ativo (opcional)
  // const { data: contract } = await supabase
  //   .from('client_contracts')
  //   .select('id')
  //   .eq('client_id', client.id)
  //   .eq('status', 'active')
  //   .limit(1);

  return { valid: true };
}

/**
 * GERAR CONTRATOS FALTANTES
 */
async function generateMissingContracts(supabase: any, aiKey: string | undefined, provider: string, log: Function) {
  log('📄 Generating missing contracts...');

  // Buscar clientes sem contrato ativo
  const { data: clientsWithoutContract, error } = await supabase
    .from('clients')
    .select(`
      *,
      client_contracts!left(id, status)
    `)
    .eq('is_active', true)
    .eq('is_pro_bono', false)
    .eq('is_barter', false);

  if (error) throw error;

  // Filtrar clientes sem contrato ativo
  const clientsNeedingContract = (clientsWithoutContract || []).filter((c: any) => {
    const contracts = c.client_contracts || [];
    return !contracts.some((ct: any) => ct.status === 'active');
  });

  log(`Found ${clientsNeedingContract.length} clients without active contract`);

  if (clientsNeedingContract.length === 0) {
    return { success: true, generated: 0, message: 'All clients have contracts' };
  }

  // Buscar template padrão
  const { data: template } = await supabase
    .from('document_templates')
    .select('*')
    .eq('type', 'contract')
    .eq('is_default', true)
    .eq('is_active', true)
    .single();

  if (!template) {
    log('❌ No default contract template found');
    return { success: false, error: 'No default contract template' };
  }

  // Buscar configurações do escritório
  const { data: officeSettings } = await supabase
    .from('office_settings')
    .select('value')
    .eq('key', 'company_info')
    .single();

  const officeInfo = officeSettings?.value || {};

  let generated = 0;
  const results: any[] = [];

  for (const client of clientsNeedingContract) {
    try {
      // Gerar número do contrato
      const contractNumber = `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      // Determinar data de início
      const startDate = client.data_abertura || new Date().toISOString().slice(0, 10);

      // Gerar conteúdo do contrato com IA
      let contractContent = template.content;

      if (aiKey) {
        try {
          const aiContent = await callAI(
            aiKey,
            provider,
            `Você é um advogado especializado em contratos. Gere um contrato de prestação de serviços contábeis personalizado.`,
            `Dados do contrato:
            - Número: ${contractNumber}
            - Escritório: ${officeInfo.name || 'Escritório Contábil'}
            - CNPJ Escritório: ${officeInfo.cnpj || 'XX.XXX.XXX/0001-XX'}
            - Cliente: ${client.name}
            - CNPJ Cliente: ${client.cnpj || 'N/A'}
            - Razão Social: ${client.razao_social || client.name}
            - Endereço Cliente: ${client.address || 'N/A'}
            - Data Início: ${startDate}
            - Prazo: Indeterminado
            - Honorário Mensal: R$ ${client.monthly_fee || 0}
            - Dia de Pagamento: ${client.payment_day || 10}

            Use o template base e personalize com os dados acima. Retorne APENAS o texto do contrato, sem explicações.

            Template base:
            ${template.content}`
          );

          // Limpar resposta da IA
          contractContent = aiContent
            .replace(/```[\s\S]*?```/g, '')
            .replace(/^\s*#.*$/gm, '')
            .trim();

        } catch (aiErr) {
          log(`AI contract generation failed, using template: ${aiErr}`);
          // Usar substituição simples se IA falhar
          contractContent = substituteTemplateVariables(template.content, {
            contract_number: contractNumber,
            office_name: officeInfo.name || 'Escritório Contábil',
            office_cnpj: officeInfo.cnpj || '',
            office_address: officeInfo.address || '',
            office_city: officeInfo.city || '',
            office_state: officeInfo.state || '',
            office_zip: officeInfo.zip || '',
            client_name: client.name,
            client_cnpj: client.cnpj || '',
            client_address: client.address || '',
            client_city: client.city || '',
            client_state: client.state || '',
            client_zip: client.zip || '',
            start_date: formatDate(startDate),
            contract_duration: 'indeterminado',
            termination_notice_days: '30',
            monthly_fee: formatCurrency(client.monthly_fee || 0),
            monthly_fee_text: numberToWords(client.monthly_fee || 0),
            payment_day: client.payment_day || 10,
            signature_date: formatDate(new Date().toISOString().slice(0, 10))
          });
        }
      }

      // Inserir contrato
      const { data: newContract, error: insertError } = await supabase
        .from('client_contracts')
        .insert({
          client_id: client.id,
          template_id: template.id,
          contract_number: contractNumber,
          type: 'service',
          status: 'active',
          start_date: startDate,
          end_date: null,
          monthly_fee: client.monthly_fee,
          payment_day: client.payment_day || 10,
          content: contractContent,
          ai_generated: !!aiKey,
          ai_generation_date: aiKey ? new Date().toISOString() : null,
          created_by: '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      generated++;
      results.push({
        client_id: client.id,
        client_name: client.name,
        contract_number: contractNumber,
        status: 'generated'
      });

      log(`✅ Generated contract: ${contractNumber} for ${client.name}`);

      // Logar automação
      await supabase.from('ai_automation_logs').insert({
        automation_type: 'contract_generation',
        entity_type: 'contract',
        entity_id: newContract.id,
        client_id: client.id,
        status: 'success',
        message: `Contract ${contractNumber} generated for ${client.name}`,
        ai_model: aiKey ? provider : null
      });

    } catch (err: any) {
      log(`❌ Error generating contract for ${client.name}: ${err.message}`);
      results.push({
        client_id: client.id,
        client_name: client.name,
        status: 'error',
        error: err.message
      });
    }
  }

  return { success: true, generated, results };
}

/**
 * VERIFICAR STATUS DAS EMPRESAS E GERAR DISTRATOS
 */
async function checkCompanyStatusAndGenerateDistracts(supabase: any, aiKey: string | undefined, provider: string, log: Function) {
  log('🔍 Checking company status...');

  // Buscar clientes com situação irregular que ainda têm contrato ativo
  const { data: irregularClients, error } = await supabase
    .from('clients')
    .select(`
      *,
      client_contracts!inner(id, status, contract_number)
    `)
    .in('situacao_cadastral', ['SUSPENSA', 'INAPTA', 'BAIXADA', 'NULA'])
    .eq('client_contracts.status', 'active');

  if (error) throw error;

  log(`Found ${irregularClients?.length || 0} clients with irregular status and active contract`);

  if (!irregularClients || irregularClients.length === 0) {
    return { success: true, generated: 0, message: 'No distracts needed' };
  }

  // Buscar template de distrato
  const { data: template } = await supabase
    .from('document_templates')
    .select('*')
    .eq('type', 'distract')
    .eq('is_default', true)
    .eq('is_active', true)
    .single();

  // Buscar configurações do escritório
  const { data: officeSettings } = await supabase
    .from('office_settings')
    .select('value')
    .eq('key', 'company_info')
    .single();

  const officeInfo = officeSettings?.value || {};

  let generated = 0;
  const results: any[] = [];

  for (const client of irregularClients) {
    const contract = client.client_contracts[0];

    try {
      // Verificar se já existe distrato para este contrato
      const { data: existingDistract } = await supabase
        .from('client_distracts')
        .select('id')
        .eq('contract_id', contract.id)
        .limit(1);

      if (existingDistract && existingDistract.length > 0) {
        log(`⏭️ Distract already exists for contract ${contract.contract_number}`);
        continue;
      }

      // Gerar número do distrato
      const distractNumber = `DST-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      // Determinar motivo
      const reason = client.situacao_cadastral === 'SUSPENSA' ? 'company_suspended' : 'company_inactive';
      const reasonText = {
        'company_suspended': 'Suspensão da empresa junto aos órgãos competentes',
        'company_inactive': 'Baixa/Inativação da empresa junto aos órgãos competentes'
      }[reason] || 'Encerramento das atividades';

      // Calcular pendências
      const { data: pendingInvoices } = await supabase
        .from('invoices')
        .select('amount')
        .eq('client_id', client.id)
        .eq('status', 'pending');

      const pendingAmount = (pendingInvoices || []).reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);

      // Gerar conteúdo do distrato
      let distractContent = template?.content || '';

      if (template && aiKey) {
        try {
          const aiContent = await callAI(
            aiKey,
            provider,
            `Você é um advogado especializado. Gere um distrato de contrato de prestação de serviços.`,
            `Dados do distrato:
            - Número do Distrato: ${distractNumber}
            - Número do Contrato: ${contract.contract_number}
            - Escritório: ${officeInfo.name || 'Escritório Contábil'}
            - Cliente: ${client.name}
            - CNPJ: ${client.cnpj}
            - Motivo: ${reasonText}
            - Situação Cadastral: ${client.situacao_cadastral}
            - Data de Encerramento: ${new Date().toISOString().slice(0, 10)}
            - Valor Pendente: R$ ${pendingAmount}

            Use tom formal e jurídico. Retorne APENAS o texto do distrato.`
          );

          distractContent = aiContent
            .replace(/```[\s\S]*?```/g, '')
            .trim();
        } catch {
          distractContent = substituteTemplateVariables(template.content, {
            distract_number: distractNumber,
            contract_number: contract.contract_number,
            office_name: officeInfo.name || '',
            office_cnpj: officeInfo.cnpj || '',
            office_address: officeInfo.address || '',
            office_city: officeInfo.city || '',
            office_state: officeInfo.state || '',
            client_name: client.name,
            client_cnpj: client.cnpj || '',
            client_address: client.address || '',
            client_city: client.city || '',
            client_state: client.state || '',
            reason_text: reasonText,
            reason_details: `Situação cadastral: ${client.situacao_cadastral}`,
            termination_date: formatDate(new Date().toISOString().slice(0, 10)),
            pending_amount: formatCurrency(pendingAmount),
            pending_amount_text: numberToWords(pendingAmount),
            signature_date: formatDate(new Date().toISOString().slice(0, 10))
          });
        }
      }

      // Inserir distrato
      const { data: newDistract, error: insertError } = await supabase
        .from('client_distracts')
        .insert({
          client_id: client.id,
          contract_id: contract.id,
          template_id: template?.id,
          distract_number: distractNumber,
          reason,
          reason_details: `Situação cadastral: ${client.situacao_cadastral}`,
          termination_date: new Date().toISOString().slice(0, 10),
          notification_date: new Date().toISOString().slice(0, 10),
          pending_amount: pendingAmount,
          content: distractContent,
          ai_generated: !!aiKey,
          ai_generation_date: aiKey ? new Date().toISOString() : null,
          status: 'draft',
          created_by: '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Atualizar status do contrato
      await supabase
        .from('client_contracts')
        .update({ status: 'terminated', updated_at: new Date().toISOString() })
        .eq('id', contract.id);

      generated++;
      results.push({
        client_id: client.id,
        client_name: client.name,
        distract_number: distractNumber,
        reason: client.situacao_cadastral,
        pending_amount: pendingAmount
      });

      log(`✅ Generated distract: ${distractNumber} for ${client.name} (${client.situacao_cadastral})`);

    } catch (err: any) {
      log(`❌ Error generating distract for ${client.name}: ${err.message}`);
    }
  }

  return { success: true, generated, results };
}

/**
 * DETECTAR PADRÕES DE DESPESAS RECORRENTES
 */
async function detectRecurringPatterns(supabase: any, aiKey: string | undefined, provider: string, log: Function) {
  if (!aiKey) {
    return { success: false, error: 'AI key required for pattern detection' };
  }

  log('🔍 Detecting recurring expense patterns...');

  // Buscar despesas dos últimos 6 meses
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: expenses, error } = await supabase
    .from('accounts_payable')
    .select('*')
    .gte('created_at', sixMonthsAgo.toISOString())
    .eq('is_recurring', false)
    .order('supplier_name');

  if (error) throw error;

  log(`Analyzing ${expenses?.length || 0} expenses for patterns...`);

  if (!expenses || expenses.length < 10) {
    return { success: true, patterns: [], message: 'Not enough data for pattern detection' };
  }

  // Agrupar por fornecedor
  const bySupplier: Record<string, any[]> = {};
  for (const exp of expenses) {
    const key = (exp.supplier_name || '').toLowerCase().trim();
    if (!bySupplier[key]) bySupplier[key] = [];
    bySupplier[key].push(exp);
  }

  // Filtrar fornecedores com múltiplas ocorrências
  const potentialRecurring = Object.entries(bySupplier)
    .filter(([_, exps]) => exps.length >= 2)
    .map(([supplier, exps]) => ({
      supplier,
      count: exps.length,
      amounts: exps.map(e => e.amount),
      dates: exps.map(e => e.due_date),
      category: exps[0].category,
      avgAmount: exps.reduce((s, e) => s + e.amount, 0) / exps.length
    }));

  if (potentialRecurring.length === 0) {
    return { success: true, patterns: [], message: 'No recurring patterns found' };
  }

  // Usar IA para analisar padrões
  const aiAnalysis = await callAI(
    aiKey,
    provider,
    `Você é um analista financeiro especializado em identificar despesas recorrentes.
    Analise os dados e identifique padrões de despesas que se repetem mensalmente ou periodicamente.`,
    `Dados de despesas agrupadas por fornecedor:
    ${JSON.stringify(potentialRecurring, null, 2)}

    Para cada despesa que pareça recorrente, retorne em JSON:
    {
      "patterns": [
        {
          "supplier": "nome do fornecedor",
          "frequency": "monthly|bimonthly|quarterly|annual",
          "typical_amount": 0,
          "typical_day": 0,
          "confidence": 0.0 a 1.0,
          "category": "categoria sugerida"
        }
      ]
    }`
  );

  try {
    const jsonMatch = aiAnalysis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const analysis = JSON.parse(jsonMatch[0]);
    const patterns = analysis.patterns || [];

    // Criar despesas recorrentes para padrões com alta confiança
    let created = 0;
    for (const pattern of patterns.filter((p: any) => p.confidence >= 0.7)) {
      const { error: insertError } = await supabase
        .from('recurring_expenses')
        .insert({
          description: `Despesa recorrente - ${pattern.supplier}`,
          supplier_name: pattern.supplier,
          category: pattern.category || 'Outras',
          amount: pattern.typical_amount,
          frequency: pattern.frequency,
          due_day: pattern.typical_day || 10,
          start_date: new Date().toISOString().slice(0, 10),
          is_active: true,
          ai_detected: true,
          ai_confidence: pattern.confidence,
          created_by: '00000000-0000-0000-0000-000000000000'
        });

      if (!insertError) created++;
    }

    log(`✅ Detected ${patterns.length} patterns, created ${created} recurring expenses`);

    return { success: true, patterns, created };

  } catch (parseErr) {
    log(`❌ Error parsing AI response: ${parseErr}`);
    return { success: false, error: 'Failed to parse AI analysis' };
  }
}

// ==================== HELPERS ====================

function substituteTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value || ''));
  }
  return result;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numberToWords(value: number): string {
  // Simplificado - em produção usar biblioteca como extenso.js
  const formatted = formatCurrency(value);
  return `${formatted} reais`;
}
