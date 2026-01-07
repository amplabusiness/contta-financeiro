
import { supabase } from '../supabaseClient';

export interface DRELine {
  code: string;
  name: string;
  level: number;
  nature: string;
  val: number; // Signed value for display (Revenue +, Expense -)
  children?: DRELine[];
}

export interface DREReport {
  revenue: number;
  expenses: number;
  result: number;
  tree: DRELine[];
}

export const FinancialReportsService = {
  async getDRE(startDate: string, endDate: string): Promise<DREReport> {
    const size = 1000;
    let from = 0;
    let allRows: any[] = [];
    
    // Recursive Fetching for Pagination
    while (true) {
        const { data: rawData, error: fetchError } = await supabase
            .from('accounting_entry_lines')
            .select(`
                debit, 
                credit,
                chart_of_accounts!inner (code, name, level, nature),
                accounting_entries!inner (entry_date, entry_type)
            `)
            .gte('accounting_entries.entry_date', startDate)
            .lte('accounting_entries.entry_date', endDate)
            .or('code.ilike.3%,code.ilike.4%', { foreignTable: 'chart_of_accounts' })
            .range(from, from + size - 1);

        if (fetchError) throw fetchError;
        
        if (rawData) {
            allRows = allRows.concat(rawData);
            if (rawData.length < size) break;
        } else {
            break;
        }
        from += size;
    }

    // Aggregation Logic (In-Memory)
    const accMap = new Map<string, DRELine>();

    allRows.forEach((row: any) => {
      const ca = row.chart_of_accounts;
      const debit = Number(row.debit) || 0;
      const credit = Number(row.credit) || 0;
      
      // Calculate Net Value based on Nature
      // CREDORA (Revenue): Credit - Debit
      // DEVEDORA (Expense): Debit - Credit
      let val = 0;
      if (ca.nature === 'CREDORA') val = credit - debit;
      else if (ca.nature === 'DEVEDORA') val = debit - credit;
      else {
          // Fallback based on Group
          if (ca.code.startsWith('3')) val = credit - debit;
          else val = debit - credit;
      }

      // If Expense (Group 4), we usually display as Negative in DRE for math?
      // Or we display Positive and substract?
      // Standard DRE: Revenue (+), Expenses (-).
      // If result of (Debit - Credit) is positive (Expense occurred), we should treat it as a Deduction.
      // So let's flip the sign for Group 4.
      if (ca.code.startsWith('4')) {
          val = -val; 
      }

      if (!accMap.has(ca.code)) {
        accMap.set(ca.code, {
          code: ca.code,
          name: ca.name,
          level: ca.level,
          nature: ca.nature,
          val: 0,
          children: []
        });
      }
      
      const entry = accMap.get(ca.code)!;
      entry.val += val;
    });

    // Build Trees and Summaries
    // ... (Complex tree building can be done later, for now flat list or simple Aggs)
    
    let revenue = 0;
    let expenses = 0;

    Array.from(accMap.values()).forEach(acc => {
        // Only count Leaf nodes? No, we aggregated by Code.
        // Wait, chart_of_accounts entries in `lines` are ONLY Analytical (Leaves).
        // Synthetic accounts are not in `lines` (because of my trigger).
        // So simple sum is safe.
        
        if (acc.code.startsWith('3')) revenue += acc.val; // Already positive
        if (acc.code.startsWith('4')) expenses += Math.abs(acc.val); // Convert back to positive for summary
    });

    return {
      revenue,
      expenses,
      result: revenue - expenses,
      tree: Array.from(accMap.values()).sort((a,b) => a.code.localeCompare(b.code))
    };
  }
};
