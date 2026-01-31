import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {auth:{autoRefreshToken:false,persistSession:false}}
);

const TENANT = 'a53a4957-fe97-4856-b3ca-70045157b421';

async function investigar() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  INVESTIGAÇÃO: Desbalanceados Restantes');
  console.log('═══════════════════════════════════════════════════════════════');

  const {data: entries} = await s.from('accounting_entries')
    .select('id,internal_code,source_type,accounting_entry_lines(debit,credit)')
    .eq('tenant_id', TENANT)
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  let bySource = {};
  let desbalanceados = [];
  
  for(const e of entries || []) {
    const lines = e.accounting_entry_lines || [];
    const d = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const c = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    const diff = d - c;
    
    if(Math.abs(diff) > 0.01) {
      const k = e.source_type || 'null';
      bySource[k] = bySource[k] || {count: 0, diff: 0};
      bySource[k].count++;
      bySource[k].diff += diff;
      
      desbalanceados.push({
        id: e.id,
        code: e.internal_code,
        source: e.source_type,
        d, c, diff
      });
    }
  }

  console.log('\nTotal desbalanceados:', desbalanceados.length);
  
  console.log('\nPor source_type:');
  Object.entries(bySource).forEach(([k, v]) => {
    console.log(`  ${k}: ${v.count} lançamentos, diff total: R$ ${v.diff.toFixed(2)}`);
  });

  const totalDiff = desbalanceados.reduce((s, e) => s + e.diff, 0);
  console.log('\nSoma das diferenças individuais:', totalDiff.toFixed(2));

  // Mostrar alguns exemplos
  console.log('\nExemplos (primeiros 10):');
  desbalanceados.slice(0, 10).forEach(e => {
    console.log(`  ${e.code?.substring(0,30) || e.id.substring(0,8)} | ${e.source} | D:${e.d.toFixed(2)} C:${e.c.toFixed(2)} Diff:${e.diff.toFixed(2)}`);
  });
}

investigar();
