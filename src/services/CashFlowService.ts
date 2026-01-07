
import { supabase } from "@/integrations/supabase/client";

export interface CashFlowEvent {
  date: string;
  type: 'RECEITA' | 'DESPESA_FOLHA' | 'DESPESA_PJ' | 'DESPESA_OUTROS';
  description: string;
  amount: number;
  status: 'previsto' | 'realizado';
}

export interface CashFlowProjection {
  currentBalance: number;
  events: CashFlowEvent[];
  dailyBalances: { date: string; balance: number }[];
}

export const CashFlowService = {
  async getProjection(daysToProject: number = 45): Promise<CashFlowProjection> {
    const today = new Date();
    const limitDate = new Date();
    limitDate.setDate(today.getDate() + daysToProject);
    const limitDateStr = limitDate.toISOString().split('T')[0];

    // 1. Get Current Bank Balance
    const { data: accounts, error: errBank } = await supabase
      .from('bank_accounts')
      .select('balance')
      .eq('is_active', true);

    if (errBank) throw errBank;

    const currentBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;

    // 2. Receivables (Invoices Pending)
    const { data: invoices, error: errInv } = await supabase
      .from('invoices')
      .select('due_date, amount, client:clients(name)')
      .eq('status', 'pending')
      .lte('due_date', limitDateStr);

    if (errInv) throw errInv;

    const receivables: CashFlowEvent[] = (invoices || []).map(inv => ({
      date: inv.due_date,
      type: 'RECEITA',
      description: `Honorário - ${(inv.client as any)?.name || 'Cliente'}`,
      amount: Number(inv.amount),
      status: 'previsto'
    }));

    // 3. Payables (Projections Views)
    // Payroll
    const { data: payroll, error: errPay } = await supabase
      .from('v_projections_payroll')
      .select('*')
      .lte('due_date', limitDateStr);

    // Contractors
    const { data: contractors, error: errCont } = await supabase
      .from('v_projections_contractors')
      .select('*')
      .lte('due_date', limitDateStr);

    if (errPay) console.error('Error fetching payroll projection', errPay);
    if (errCont) console.error('Error fetching contractors projection', errCont);

    const payables: CashFlowEvent[] = [];

    (payroll || []).forEach(p => {
      payables.push({
        date: p.due_date,
        type: 'DESPESA_FOLHA',
        description: p.description,
        amount: -Number(p.amount), // Negative for display logic or calculation
        status: 'previsto'
      });
    });

    (contractors || []).forEach(c => {
      payables.push({
        date: c.due_date,
        type: 'DESPESA_PJ',
        description: c.description,
        amount: -Number(c.amount),
        status: 'previsto'
      });
    });

    // 4. Merge and Calculate Daily Balances
    const allEvents = [...receivables, ...payables].sort((a, b) => a.date.localeCompare(b.date));
    
    const dailyBalances: { date: string; balance: number }[] = [];
    let runningBalance = currentBalance;

    // We want a clear timeline.
    // Let's populate daily balances map
    const eventsByDate: Record<string, number> = {};

    allEvents.forEach(e => {
      eventsByDate[e.date] = (eventsByDate[e.date] || 0) + e.amount;
    });

    // Fill dates from Today to Limit
    const cursor = new Date(today);
    while (cursor <= limitDate) {
      const dStr = cursor.toISOString().split('T')[0];
      const dayChange = eventsByDate[dStr] || 0;
      runningBalance += dayChange;
      dailyBalances.push({ date: dStr, balance: runningBalance });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      currentBalance,
      events: allEvents,
      dailyBalances
    };
  }
};
