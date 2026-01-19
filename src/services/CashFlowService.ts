
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

    console.log('[CashFlowService] Fetching projection from', today.toISOString().split('T')[0], 'to', limitDateStr);

    // 1. Get Current Bank Balance
    const { data: accounts, error: errBank } = await supabase
      .from('bank_accounts')
      .select('balance')
      .eq('is_active', true);

    if (errBank) throw errBank;

    const currentBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance), 0) || 0;
    console.log('[CashFlowService] Current balance:', currentBalance);

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
        console.error('[CashFlowService] Error fetching unified cash flow:', error);
        throw error;
      }

      if (data && data.length > 0) {
        console.log(`[CashFlowService] Fetched ${data.length} records from v_cash_flow_daily (range ${from}-${from + step - 1})`);
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

    console.log(`[CashFlowService] Total unified data fetched: ${allUnifiedData.length} records`);

    // Debug: Check if we have custom projections
    const customProjectionTypes = ['RECEITA', 'DESPESA_FOLHA', 'DESPESA_PJ', 'DESPESA_IMPOSTO', 'DESPESA_OUTROS', 'DESPESA_RECORRENTE'];
    const customProjections = allUnifiedData.filter(item => customProjectionTypes.includes(item.type));
    console.log('[CashFlowService] Custom projections found:', customProjections.length);
    if (customProjections.length > 0) {
      console.log('[CashFlowService] Sample custom projection:', customProjections[0]);
    }

    // 3. Map to Internal Event Structure
    const allEvents: CashFlowEvent[] = allUnifiedData.map((item: any) => {
      let type: CashFlowEvent['type'] = 'DESPESA_OUTROS';

      // Map DB types to Frontend Types
      // Handles both legacy types (RECEIVABLE, PAYROLL, etc.) and direct projection types (RECEITA, DESPESA_FOLHA, etc.)
      switch(item.type) {
        case 'RECEIVABLE':
        case 'RECEITA':
          type = 'RECEITA';
          break;
        case 'PAYROLL':
        case 'DESPESA_FOLHA':
          type = 'DESPESA_FOLHA';
          break;
        case 'CONTRACTOR':
        case 'DESPESA_PJ':
          type = 'DESPESA_PJ';
          break;
        case 'TAX':
        case 'DESPESA_IMPOSTO':
          type = 'DESPESA_IMPOSTO';
          break;
        case 'RECURRING':
        case 'DESPESA_RECORRENTE':
          type = 'DESPESA_RECORRENTE';
          break;
        case 'DESPESA_OUTROS':
          type = 'DESPESA_OUTROS';
          break;
        default:
          console.warn('[CashFlowService] Unknown type from DB:', item.type, 'for item:', item);
          type = 'DESPESA_OUTROS';
      }

      return {
        date: item.due_date,
        type: type,
        description: item.description,
        amount: Number(item.value), // Value comes signed from View (+ for income, - for expense)
        status: item.status === 'CONFIRMED' ? 'realizado' : 'previsto' // 'realizado' implies certain/confirmed here
      };
    });

    console.log('[CashFlowService] Total events mapped:', allEvents.length);
    console.log('[CashFlowService] Event types breakdown:',
      allEvents.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    );

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
