import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isValidOFX, parseOFX } from "../_shared/ofx-parser.ts";

// A função buildInternalCode foi removida, pois a lógica agora está no trigger do banco de dados.


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const ofx_content = payload.ofx_content || payload.ofxContent

    if (!ofx_content) {
      throw new Error('OFX content is required')
    }

    // Validate OFX
    if (!isValidOFX(ofx_content)) {
      throw new Error('Invalid OFX format')
    }

    // Parse OFX
    const parsedData = parseOFX(ofx_content)
    const transactions = parsedData.transactions
    const bankInfo = parsedData.bankInfo

    // Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    let user = null;

    if (authHeader) {
      const { data, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      
      if (authError || !data.user) {
        throw new Error('Unauthorized: Invalid token')
      }
      
      user = data.user;
    } else {
      throw new Error('Unauthorized: Missing Authorization header')
    }

    // Comentário: Código de fallback removido para produção segura.
    // O usuário DEVE estar autenticado para realizar uploads.

    // Cadastrar banco se tiver informações
    let bankAccountId = null
    if (bankInfo?.bankId && bankInfo?.accountId) {
      // Buscar conta bancária existente na tabela CORRETA: bank_accounts
      const { data: existingBank } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('account_number', bankInfo.accountId)
        // Tentar casar pelo código do banco ou nome
        .or(`bank_code.eq.${bankInfo.bankId},bank_name.eq.${bankInfo.bankId}`)
        .maybeSingle()

      if (existingBank) {
        bankAccountId = existingBank.id
      } else {
        // Criar nova conta bancária
        const { data: newBank, error: bankError } = await supabase
          .from('bank_accounts')
          .insert({
            name: `Conta ${bankInfo.accountType || 'Corrente'} - ${bankInfo.bankId}`,
            account_number: bankInfo.accountId,
            bank_code: bankInfo.bankId,
            bank_name: `Banco ${bankInfo.bankId}`,
            account_type: bankInfo.accountType === 'SAVINGS' ? 'savings' : 'checking',
            initial_balance: bankInfo.balance || 0,
            current_balance: bankInfo.balance || 0,
            is_active: true
            // created_by não existe no schema de bank_accounts
          })
          .select()
          .single()

        if (!bankError && newBank) {
          bankAccountId = newBank.id
          console.log('Conta bancária criada:', newBank)
        } else if (bankError) {
             console.error('Erro ao criar conta bancária:', bankError);
        }
      }
    }

    // Adicionar informações do banco nas transações
    const transactionsWithBank = transactions.map((t: any) => {
      
      // Construir objeto seguro apenas com colunas que sabemos existir
      const cleanTransaction: any = {
        transaction_date: t.transaction_date,
        amount: t.amount,
        description: t.description, // parseOFX já coloca memo na description se necessário
        transaction_type: t.transaction_type,
        bank_reference: t.bank_reference // mapeia para FITID ou ID único
      };

      // Adicionar bank_account_id se disponível (obrigatório pelo schema original, mas pode ter mudado)
      if (bankAccountId) {
        cleanTransaction.bank_account_id = bankAccountId;
      }

      // Adicionar category se disponível (visto via ALTER TABLE)
      if (t.category) {
        cleanTransaction.category = t.category;
      }
      
      // Campos opcionais arriscados (comentados por falha de schema cache)
      // if (t.memo) cleanTransaction.memo = t.memo;
      // if (t.notes) cleanTransaction.notes = t.notes;
      // cleanTransaction.imported_from = 'OFX'; 

      return cleanTransaction;
    });

    // Insert transactions
    // Usamos 'bank_reference' (FITID do OFX) para detectar duplicatas.
    // Se a transação já existe (mesmo FITID), ignoramos.
    // Se é nova, o trigger do banco gerará o internal_code automaticamente.
    const { data, error } = await supabase
      .from('bank_transactions')
      .upsert(transactionsWithBank, {
        onConflict: 'bank_reference',
        ignoreDuplicates: true
      })
      .select()

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      imported: data?.length || 0,
      total_parsed: transactions.length,
      bank_account_id: bankAccountId,
      bank_info: bankInfo,
      transactions: data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error parsing OFX:', error)

    const errorMessage = error?.message || (typeof error === 'string' ? error : JSON.stringify(error))
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      details: error
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
