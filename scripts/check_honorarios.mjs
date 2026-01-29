import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Buscar conta 3.1.1.01
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '3.1.1.01')
    .single();

  // Buscar todas as linhas
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('credit, debit, entry_id')
    .eq('account_id', conta.id);

  // Buscar entries
  const entryIds = [...new Set(linhas.map(l => l.entry_id))];
  const { data: entries } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, description, source_type')
    .in('id', entryIds);

  const mapEntries = {};
  if (entries) entries.forEach(e => mapEntries[e.id] = e);

  // Agrupar por source_type e ano
  const porTipoAno = {};
  linhas.forEach(l => {
    const e = mapEntries[l.entry_id];
    if (!e) return;

    const tipo = e.source_type || 'null';
    const ano = e.entry_date ? e.entry_date.substring(0, 4) : 'sem_data';
    const key = `${tipo}|${ano}`;

    if (!porTipoAno[key]) porTipoAno[key] = { c: 0, d: 0, n: 0 };
    porTipoAno[key].c += parseFloat(l.credit) || 0;
    porTipoAno[key].d += parseFloat(l.debit) || 0;
    porTipoAno[key].n++;
  });

  console.log('LINHAS NA CONTA 3.1.1.01 (Honorários) por source_type e ano:');
  console.log('-'.repeat(100));
  console.log('Source Type'.padEnd(25) + 'Ano  | Linhas |    Créditos    |     Débitos');
  console.log('-'.repeat(100));

  Object.entries(porTipoAno).sort().forEach(([key, v]) => {
    const [tipo, ano] = key.split('|');
    const c = 'R$ ' + v.c.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const d = 'R$ ' + v.d.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    console.log(`${tipo.padEnd(25)} ${ano} | ${v.n.toString().padStart(6)} | ${c.padStart(14)} | ${d.padStart(14)}`);
  });

  // Totais
  let totalC = 0, totalD = 0, totalN = 0;
  Object.values(porTipoAno).forEach(v => {
    totalC += v.c;
    totalD += v.d;
    totalN += v.n;
  });

  console.log('-'.repeat(100));
  console.log(`${'TOTAL'.padEnd(25)} ---- | ${totalN.toString().padStart(6)} | ${'R$ ' + totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(11)} | ${'R$ ' + totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(11)}`);
  console.log(`\nSaldo (C-D): R$ ${(totalC - totalD).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Verificar boleto_sicredi
  const boleto = Object.entries(porTipoAno).find(([k]) => k.startsWith('boleto_sicredi'));
  if (boleto) {
    console.log('\n⚠️ ALERTA: boleto_sicredi está lançando na conta de Receita!');
    console.log('   Isso está ERRADO - boletos devem baixar Clientes a Receber, não Receita.');
  }
}

check().catch(console.error);
