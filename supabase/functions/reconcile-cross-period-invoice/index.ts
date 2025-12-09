import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReconcileRequest {
  action:
    | "find_invoices"
    | "reconcile_transaction"
    | "get_reconciliation_details";
  data: {
    transactionId?: string;
    transactionAmount?: number;
    transactionDate?: string;
    transactionDescription?: string;
    invoiceId?: string;
    bankAccountId?: string;
    clientId?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, data } = (await req.json()) as ReconcileRequest;

    if (action === "find_invoices") {
      const result = await findPendingInvoices(supabase, data);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "reconcile_transaction") {
      const result = await reconcileTransaction(supabase, data);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "get_reconciliation_details") {
      const result = await getReconciliationDetails(supabase, data);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (error: unknown) {
    console.error("Erro na reconciliação:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

interface Invoice {
  id: string;
  client_id: string;
  client_name?: string;
  amount: number;
  competence: string;
  status: string;
  due_date: string;
  created_at: string;
  clients?: { name: string; cnpj?: string };
}

interface FindInvoicesResponse {
  success: boolean;
  invoices?: Array<{
    id: string;
    client_name: string;
    amount: number;
    competence: string;
    status: string;
    due_date: string;
    confidence: number;
    reason: string;
  }>;
  error?: string;
}

async function findPendingInvoices(
  supabase: any,
  data: {
    transactionAmount?: number;
    transactionDate?: string;
    transactionDescription?: string;
    clientId?: string;
  }
): Promise<FindInvoicesResponse> {
  try {
    // Buscar todas as faturas (pendentes e recentemente pagas)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let query = supabase
      .from("invoices")
      .select("*, clients(name, cnpj)")
      .or(
        `status.eq.pending,and(status.eq.paid,payment_date.gte.${ninetyDaysAgo.toISOString()})`
      );

    // Filtrar por cliente se informado
    if (data.clientId) {
      query = query.eq("client_id", data.clientId);
    }

    const { data: invoices, error } = await query.order("due_date", { ascending: false });

    if (error) throw error;

    if (!invoices || invoices.length === 0) {
      return {
        success: true,
        invoices: [],
      };
    }

    // Calcular confiança de match
    const txAmount = data.transactionAmount || 0;
    const txDate = data.transactionDate ? new Date(data.transactionDate) : new Date();
    const txDesc = (data.transactionDescription || "").toLowerCase();

    const results = (invoices as Invoice[])
      .map((inv) => {
        let confidence = 0;
        let reasons: string[] = [];

        // 1. Match por valor exato
        if (Math.abs(inv.amount - txAmount) < 0.01) {
          confidence = 0.95;
          reasons.push("Valor exato");
        } else if (
          Math.abs(inv.amount - txAmount) / txAmount < 0.05
        ) {
          confidence = 0.7;
          reasons.push("Valor muito próximo");
        }

        // 2. Match por cliente
        const clientName = (inv.clients?.name || "").toLowerCase();
        if (clientName && txDesc.includes(clientName.split(" ")[0])) {
          confidence = Math.max(confidence, 0.8);
          reasons.push("Cliente encontrado");
        }

        // 3. Match por CNPJ
        const cnpj = (inv.clients?.cnpj || "").replace(/\D/g, "");
        if (cnpj && cnpj.length > 8 && txDesc.includes(cnpj.slice(0, 8))) {
          confidence = Math.max(confidence, 0.85);
          reasons.push("CNPJ encontrado");
        }

        // 4. Penalidade por data (se fatura é de mês anterior)
        const txMonth = txDate.getMonth() + 1;
        const txYear = txDate.getFullYear();
        const [invMonth, invYear] = (inv.competence || "").split("/").map(Number);
        const monthDiff =
          (txYear - invYear) * 12 + (txMonth - invMonth);

        if (monthDiff > 0) {
          reasons.push(`Fatura de ${monthDiff} mês(es) atrás`);
          // Aplicar pequeno ajuste na confiança por período anterior
          if (monthDiff <= 3 && confidence > 0.5) {
            confidence += 0.05;
          }
        }

        // 5. Status da fatura
        if (inv.status === "paid") {
          reasons.push("Já foi registrada como paga");
        }

        return {
          id: inv.id,
          client_name: inv.clients?.name || "Cliente",
          amount: inv.amount,
          competence: inv.competence,
          status: inv.status,
          due_date: inv.due_date,
          confidence: Math.min(confidence, 0.99),
          reason: reasons.join(" | "),
        };
      })
      .filter((inv) => inv.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    return {
      success: true,
      invoices: results,
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro ao buscar faturas";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

interface ReconcileResponse {
  success: boolean;
  message?: string;
  data?: {
    invoice_id: string;
    transaction_date: string;
    invoice_competence: string;
    amount: number;
    status: string;
  };
  error?: string;
}

async function reconcileTransaction(
  supabase: any,
  data: {
    transactionId?: string;
    invoiceId?: string;
    transactionDate?: string;
    transactionAmount?: number;
    bankAccountId?: string;
  }
): Promise<ReconcileResponse> {
  try {
    if (!data.invoiceId) {
      throw new Error("invoiceId é obrigatório");
    }

    // Buscar fatura
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, clients(name)")
      .eq("id", data.invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Fatura não encontrada");
    }

    // Marcar fatura como paga
    const paymentDate = data.transactionDate || new Date().toISOString().split("T")[0];
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        payment_date: paymentDate,
      })
      .eq("id", data.invoiceId);

    if (updateError) throw updateError;

    // Registrar lançamento contábil (recebimento)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user && data.bankAccountId) {
      // Chamar o hook useAccounting para registrar recebimento
      // Este passo é feito no frontend, mas aqui documentamos a intenção
      console.log(
        `[Reconciliação] Registrar recebimento: Fatura ${data.invoiceId} recebida em ${paymentDate}`
      );
    }

    return {
      success: true,
      message: `Fatura reconciliada com sucesso. Competência: ${invoice.competence}, Data do Pagamento: ${paymentDate}`,
      data: {
        invoice_id: data.invoiceId,
        transaction_date: paymentDate,
        invoice_competence: invoice.competence,
        amount: invoice.amount,
        status: "paid",
      },
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro ao reconciliar";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function getReconciliationDetails(
  supabase: any,
  data: { invoiceId?: string }
): Promise<any> {
  try {
    if (!data.invoiceId) {
      throw new Error("invoiceId é obrigatório");
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*, clients(name, cnpj), accounting_entries(*)")
      .eq("id", data.invoiceId)
      .single();

    if (error) throw error;

    return {
      success: true,
      invoice: {
        id: invoice.id,
        client_name: invoice.clients?.name,
        amount: invoice.amount,
        competence: invoice.competence,
        status: invoice.status,
        due_date: invoice.due_date,
        payment_date: invoice.payment_date,
        created_at: invoice.created_at,
      },
      accounting_entries: invoice.accounting_entries || [],
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro ao buscar detalhes";
    return {
      success: false,
      error: errorMessage,
    };
  }
}
