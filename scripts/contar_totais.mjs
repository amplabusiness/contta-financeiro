import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function contar() {
  const { count: entries } = await supabase.from('accounting_entries').select('id', { count: 'exact', head: true });
  const { count: linhas } = await supabase.from('accounting_entry_lines').select('id', { count: 'exact', head: true });

  console.log('Total entries:', entries);
  console.log('Total linhas:', linhas);

  // Verificar equação com paginação
  let totalD = 0, totalC = 0;
  let page = 0;
  while (true) {
    const { data } = await supabase.from('accounting_entry_lines').select('debit, credit').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(l => {
      totalD += parseFloat(l.debit) || 0;
      totalC += parseFloat(l.credit) || 0;
    });
    if (data.length < 1000) break;
    page++;
  }

  console.log('');
  console.log('Total Debitos: R$', totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('Total Creditos: R$', totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  console.log('Diferenca: R$', (totalD - totalC).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
}

contar();
