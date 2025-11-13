import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  reference?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Não autenticado');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileType = formData.get('fileType') as string;

    if (!file) {
      throw new Error('Nenhum arquivo fornecido');
    }

    console.log(`Processando arquivo: ${file.name}, tipo: ${fileType}`);

    const content = await file.text();
    let transactions: Transaction[] = [];

    // Parse baseado no tipo de arquivo
    if (fileType === 'ofx') {
      transactions = parseOFX(content);
    } else if (fileType === 'csv') {
      transactions = parseCSV(content);
    } else if (fileType === 'zebrinha') {
      transactions = parseZebrinha(content);
    } else {
      throw new Error('Formato de arquivo não suportado');
    }

    console.log(`${transactions.length} transações encontradas`);

    // Buscar despesas e honorários pendentes para matching
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id, description, amount, due_date, category')
      .eq('status', 'pending');

    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, client_id, amount, due_date, clients(name)')
      .eq('status', 'pending');

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, cnpj');

    const { data: rules } = await supabase
      .from('reconciliation_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    // Processar cada transação com IA
    const results = [];
    for (const transaction of transactions) {
      const aiMatch = await matchTransactionWithAI(
        transaction,
        expenses || [],
        invoices || [],
        clients || [],
        rules || []
      );

      // Inserir transação bancária
      const { data: bankTx, error: bankError } = await supabase
        .from('bank_transactions')
        .insert({
          transaction_date: transaction.date,
          description: transaction.description,
          amount: Math.abs(transaction.amount),
          transaction_type: transaction.type,
          bank_reference: transaction.reference,
          imported_from: file.name,
          matched: aiMatch.matched,
          matched_expense_id: aiMatch.expenseId,
          matched_invoice_id: aiMatch.invoiceId,
          ai_confidence: aiMatch.confidence,
          ai_suggestion: aiMatch.suggestion,
          category: aiMatch.category,
          created_by: user.id,
        })
        .select()
        .single();

      if (bankError) {
        console.error('Erro ao inserir transação:', bankError);
        continue;
      }

      // Se for pagamento de cliente, atualizar razão e honorário
      if (aiMatch.matched && aiMatch.invoiceId && aiMatch.clientId) {
        // Buscar dados da invoice
        const { data: invoice } = await supabase
          .from('invoices')
          .select('amount, description, client_id')
          .eq('id', aiMatch.invoiceId)
          .single();

        // Atualizar honorário para pago
        await supabase
          .from('invoices')
          .update({
            status: 'paid',
            payment_date: transaction.date,
          })
          .eq('id', aiMatch.invoiceId);

        // Criar lançamento contábil de baixa (recebimento)
        if (invoice) {
          await supabase.functions.invoke('create-accounting-entry', {
            body: {
              type: 'invoice',
              operation: 'payment',
              referenceId: aiMatch.invoiceId,
              amount: invoice.amount,
              date: transaction.date,
              description: invoice.description || 'Recebimento de honorários',
              clientId: invoice.client_id,
            },
          });
        }

        // Lançar no razão do cliente
        const { data: lastBalance } = await supabase
          .from('client_ledger')
          .select('balance')
          .eq('client_id', aiMatch.clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const previousBalance = lastBalance?.balance || 0;
        const newBalance = previousBalance + Math.abs(transaction.amount);

        await supabase
          .from('client_ledger')
          .insert({
            client_id: aiMatch.clientId,
            transaction_date: transaction.date,
            description: `Pagamento recebido - ${transaction.description}`,
            credit: Math.abs(transaction.amount),
            debit: 0,
            balance: newBalance,
            invoice_id: aiMatch.invoiceId,
            reference_type: 'bank_transaction',
            reference_id: bankTx.id,
            created_by: user.id,
          });
      }

      // Se for despesa, atualizar para paga
      if (aiMatch.matched && aiMatch.expenseId) {
        // Buscar dados da despesa
        const { data: expense } = await supabase
          .from('expenses')
          .select('amount, description')
          .eq('id', aiMatch.expenseId)
          .single();

        // Atualizar despesa para paga
        await supabase
          .from('expenses')
          .update({
            status: 'paid',
            payment_date: transaction.date,
          })
          .eq('id', aiMatch.expenseId);

        // Criar lançamento contábil de baixa (pagamento)
        if (expense) {
          await supabase.functions.invoke('create-accounting-entry', {
            body: {
              type: 'expense',
              operation: 'payment',
              referenceId: aiMatch.expenseId,
              amount: expense.amount,
              date: transaction.date,
              description: expense.description || 'Pagamento de despesa',
            },
          });
        }
      }

      results.push({
        transaction,
        match: aiMatch,
        status: 'processed',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: transactions.length,
        matched: results.filter((r) => r.match.matched).length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseOFX(content: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = content.split('\n');

  let currentTx: any = {};
  for (const line of lines) {
    if (line.includes('<STMTTRN>')) {
      currentTx = {};
    } else if (line.includes('</STMTTRN>')) {
      if (currentTx.date && currentTx.amount) {
        transactions.push({
          date: formatOFXDate(currentTx.date),
          description: currentTx.memo || currentTx.payee || 'Transação',
          amount: parseFloat(currentTx.amount),
          type: parseFloat(currentTx.amount) < 0 ? 'debit' : 'credit',
          reference: currentTx.fitid,
        });
      }
    } else if (line.includes('<DTPOSTED>')) {
      currentTx.date = line.replace(/<DTPOSTED>|<\/DTPOSTED>/g, '').trim();
    } else if (line.includes('<TRNAMT>')) {
      currentTx.amount = line.replace(/<TRNAMT>|<\/TRNAMT>/g, '').trim();
    } else if (line.includes('<MEMO>')) {
      currentTx.memo = line.replace(/<MEMO>|<\/MEMO>/g, '').trim();
    } else if (line.includes('<PAYEE>')) {
      currentTx.payee = line.replace(/<PAYEE>|<\/PAYEE>/g, '').trim();
    } else if (line.includes('<FITID>')) {
      currentTx.fitid = line.replace(/<FITID>|<\/FITID>/g, '').trim();
    }
  }

  return transactions;
}

function parseCSV(content: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = content.split('\n');
  
  // Pular cabeçalho
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
    if (parts.length >= 3) {
      const amount = parseFloat(parts[2].replace(/[^\d.,-]/g, '').replace(',', '.'));
      transactions.push({
        date: parts[0],
        description: parts[1],
        amount: Math.abs(amount),
        type: amount < 0 ? 'debit' : 'credit',
      });
    }
  }

  return transactions;
}

function parseZebrinha(content: string): Transaction[] {
  // Zebrinha geralmente é um arquivo TXT/CSV com detalhes de pagamentos
  // Formato típico: Data|CNPJ/CPF|Nome|Valor|Nosso Número|Seu Número
  const transactions: Transaction[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;

    // Tentar diferentes delimitadores
    const delimiter = line.includes('|') ? '|' : line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map(p => p.trim());
    
    if (parts.length >= 4) {
      const dateStr = parts[0];
      const payerDoc = parts[1]; // CNPJ/CPF
      const payerName = parts[2];
      const amountStr = parts[3].replace(/[^\d.,-]/g, '').replace(',', '.');
      const amount = parseFloat(amountStr);
      
      if (!isNaN(amount) && amount > 0) {
        transactions.push({
          date: formatZebrinhaDate(dateStr),
          description: `${payerName} - ${payerDoc}`,
          amount: Math.abs(amount),
          type: 'credit',
          reference: parts[4] || parts[5] || undefined, // Nosso número ou Seu número
        });
      }
    }
  }

  return transactions;
}

function formatZebrinhaDate(dateStr: string): string {
  // Zebrinha pode vir em vários formatos: DD/MM/YYYY, DDMMYYYY, etc
  const cleaned = dateStr.replace(/[^\d]/g, '');
  
  if (cleaned.length === 8) {
    const day = cleaned.substring(0, 2);
    const month = cleaned.substring(2, 4);
    const year = cleaned.substring(4, 8);
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}

function formatOFXDate(ofxDate: string): string {
  // OFX format: YYYYMMDD ou YYYYMMDDHHMMSS
  const year = ofxDate.substring(0, 4);
  const month = ofxDate.substring(4, 6);
  const day = ofxDate.substring(6, 8);
  return `${year}-${month}-${day}`;
}

async function matchTransactionWithAI(
  transaction: Transaction,
  expenses: any[],
  invoices: any[],
  clients: any[],
  rules: any[]
): Promise<any> {
  try {
    // Primeiro, aplicar regras automáticas
    for (const rule of rules) {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(transaction.description)) {
        if (rule.rule_type === 'expense' && rule.auto_match) {
          // Tentar match com despesa similar
          const matchedExpense = expenses.find(
            (e) =>
              Math.abs(e.amount - transaction.amount) < 1 &&
              e.category === rule.target_category
          );
          if (matchedExpense) {
            return {
              matched: true,
              expenseId: matchedExpense.id,
              confidence: 0.95,
              suggestion: `Matched automaticamente via regra: ${rule.rule_name}`,
              category: rule.target_category,
            };
          }
        } else if (rule.rule_type === 'revenue' && rule.auto_match) {
          // Tentar match com honorário
          const matchedInvoice = invoices.find(
            (inv) => Math.abs(inv.amount - transaction.amount) < 1
          );
          if (matchedInvoice) {
            return {
              matched: true,
              invoiceId: matchedInvoice.id,
              clientId: matchedInvoice.client_id,
              confidence: 0.95,
              suggestion: `Pagamento de honorário via regra: ${rule.rule_name}`,
              category: 'Receita',
            };
          }
        }
      }
    }

    // Se não houver match automático, usar IA
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente de conciliação bancária. Analise a transação e encontre o melhor match com despesas ou receitas pendentes. Considere valor, data próxima, e descrição similar. Retorne JSON com: {"matched": boolean, "type": "expense|invoice|none", "id": "uuid", "confidence": 0-1, "suggestion": "texto", "category": "categoria"}`,
          },
          {
            role: 'user',
            content: `Transação: ${JSON.stringify(transaction)}
Despesas pendentes: ${JSON.stringify(expenses.slice(0, 10))}
Honorários pendentes: ${JSON.stringify(invoices.slice(0, 10))}
Clientes: ${JSON.stringify(clients.slice(0, 20))}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('Erro na chamada da IA:', await aiResponse.text());
      return { matched: false, confidence: 0, suggestion: 'Não foi possível processar com IA' };
    }

    const aiResult = await aiResponse.json();
    const aiContent = JSON.parse(aiResult.choices[0].message.content);

    return {
      matched: aiContent.matched,
      expenseId: aiContent.type === 'expense' ? aiContent.id : null,
      invoiceId: aiContent.type === 'invoice' ? aiContent.id : null,
      clientId: aiContent.type === 'invoice' ? invoices.find((i) => i.id === aiContent.id)?.client_id : null,
      confidence: aiContent.confidence,
      suggestion: aiContent.suggestion,
      category: aiContent.category,
    };
  } catch (error) {
    console.error('Erro no matching com IA:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      matched: false,
      confidence: 0,
      suggestion: `Erro no processamento: ${errorMessage}`,
    };
  }
}
