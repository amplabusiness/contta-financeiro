
import { supabase } from "@/integrations/supabase/client";

export interface CashFlowEvent {
  date: string;
  type: 'RECEITA' | 'DESPESA_FOLHA' | 'DESPESA_PJ' | 'DESPESA_IMPOSTO' | 'DESPESA_OUTROS' | 'DESPESA_RECORRENTE';
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

    // 2. Get Unified Cash Flow View (Source of Truth)
    // The view v_cash_flow_daily already consolidates Invoices, Payroll, Contractors, Taxes, and Recurring
    // We implement pagination to ensure we fetch ALL items, even if > 1000 (e.g. many overdue invoices)
    let allUnifiedData: any[] = [];
    let from = 0;
    const step = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const { data, error } = await supabase
        .from('v_cash_flow_daily')
        .select('*')
        .lte('due_date', limitDateStr)
        .order('due_date', { ascending: true })
        .range(from, from + step - 1);

      if (error) {
        console.error('Error fetching unified cash flow:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allUnifiedData = [...allUnifiedData, ...data];
        if (data.length < step) {
          fetchMore = false;
        } else {
          from += step;
        }
      } else {
        fetchMore = false;
      }
    }

    // 3. Map to Internal Event Structure
    const allEvents: CashFlowEvent[] = allUnifiedData.map((item: any) => {
      let type: CashFlowEvent['type'] = 'DESPESA_OUTROS';
      
      // Map DB types to Frontend Types
      switch(item.type) {
        case 'RECEIVABLE': type = 'RECEITA'; break;
        case 'PAYROLL': type = 'DESPESA_FOLHA'; break;
        case 'CONTRACTOR': type = 'DESPESA_PJ'; break;
        case 'TAX': type = 'DESPESA_IMPOSTO'; break;
        case 'RECURRING': type = 'DESPESA_RECORRENTE'; break;
        default: type = 'DESPESA_OUTROS';
      }

      return {
        date: item.due_date,
        type: type,
        description: item.description,
        amount: Number(item.value), // Value comes signed from View (+ for income, - for expense)
        status: item.status === 'CONFIRMED' ? 'realizado' : 'previsto' // 'realizado' implies certain/confirmed here
      };
    });

    // 4. Calculate Daily Balances
    const dailyBalances: { date: string; balance: number }[] = [];
    let runningBalance = currentBalance;

    // Map events by date for timeline construction
    const eventsByDate: Record<string, number> = {};
    allEvents.forEach(e => {
      eventsByDate[e.date] = (eventsByDate[e.date] || 0) + e.amount;
    });

    // Fill dates from Today to Limit
    const cursor = new Date(today);
    while (cursor <= limitDate) {
      const dStr = cursor.toISOString().split('T')[0];
      const dayChange = eventsByDate[dStr] || 0;
      
      // Only update running balance if date is >= today? 
      // Actually the view returns future items. Running balance starts today.
      // If there are overdue items in the view (dates < today), they should affect current balance 
      // IF they are not already reconciled. The view filters 'pending' invoices, so they are effectively "future cash impact" even if date is past.
      
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
