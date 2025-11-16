import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Invoice {
  id: string;
  client_id: string;
  amount: number;
  due_date: string;
  status: string;
  clients: {
    name: string;
    email: string;
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

    console.log("Starting auto-create collection orders process...");

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    // Find overdue invoices (status = pending, due_date >= 30 days ago)
    const { data: overdueInvoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id,
        client_id,
        amount,
        due_date,
        status,
        clients (
          name,
          email
        )
      `)
      .eq("status", "pending")
      .lte("due_date", thirtyDaysAgoStr);

    if (invoicesError) {
      console.error("Error fetching overdue invoices:", invoicesError);
      throw invoicesError;
    }

    console.log(`Found ${overdueInvoices?.length || 0} overdue invoices`);

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No overdue invoices found",
          created: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createdOrders = [];
    const errors = [];

    // For each overdue invoice, check if there's already a work order
    for (const invoice of overdueInvoices as Invoice[]) {
      try {
        // Check if work order already exists for this invoice
        const { data: existingOrders } = await supabase
          .from("collection_work_orders")
          .select("id")
          .eq("invoice_id", invoice.id)
          .eq("status", "pending");

        if (existingOrders && existingOrders.length > 0) {
          console.log(`Work order already exists for invoice ${invoice.id}`);
          continue;
        }

        // Calculate days overdue
        const dueDate = new Date(invoice.due_date);
        const today = new Date();
        const daysOverdue = Math.floor(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Create work order
        const { data: newOrder, error: orderError } = await supabase
          .from("collection_work_orders")
          .insert({
            client_id: invoice.client_id,
            invoice_id: invoice.id,
            action_type: "phone_call",
            priority: "high",
            status: "pending",
            description: `Fatura vencida há ${daysOverdue} dias. Valor: R$ ${invoice.amount.toFixed(
              2
            )}. Cliente: ${(invoice.clients as any)?.name || "N/A"}`,
            assigned_to: "Sistema Automático",
            next_action_date: new Date().toISOString().split("T")[0],
          })
          .select()
          .single();

        if (orderError) {
          console.error(`Error creating work order for invoice ${invoice.id}:`, orderError);
          errors.push({
            invoice_id: invoice.id,
            error: orderError.message,
          });
          continue;
        }

        console.log(`Created work order ${newOrder.id} for invoice ${invoice.id}`);
        createdOrders.push(newOrder);

        // Create initial log entry
        await supabase.from("collection_work_order_logs").insert({
          work_order_id: newOrder.id,
          action: "work_order_created",
          result: "pending",
          description: `Ordem de serviço criada automaticamente pelo sistema. Fatura vencida há ${daysOverdue} dias.`,
          next_step: "Entrar em contato com o cliente por telefone",
          next_contact_date: new Date().toISOString().split("T")[0],
        });
      } catch (error) {
        console.error(`Error processing invoice ${invoice.id}:`, error);
        errors.push({
          invoice_id: invoice.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    console.log(`Successfully created ${createdOrders.length} work orders`);
    if (errors.length > 0) {
      console.error(`Encountered ${errors.length} errors:`, errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${createdOrders.length} work orders`,
        created: createdOrders.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-create-collection-orders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
