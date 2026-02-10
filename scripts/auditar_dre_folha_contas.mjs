#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltam variaveis Supabase no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const YEAR = Number(process.argv[2] || 2025);

const TARGET_PREFIXES = ['4.2.1', '4.2.11', '4.2.2'];
const TARGET_CODES = ['4.2.1', '4.2.1.01', '4.2.1.03', '4.2.1.04', '4.2.1.05', '4.2.11', '4.2.2', '4.2.2.05'];

function round2(n) {
  return Number((Number(n || 0)).toFixed(2));
}

function ymList(year) {
  const out = [];
  for (let m = 1; m <= 12; m += 1) out.push(`${year}-${String(m).padStart(2, '0')}`);
  return out;
}

function nextYm(ym) {
  const [y0, m0] = ym.split('-').map(Number);
  let y = y0;
  let m = m0 + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

async function loadAccounts() {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id,code,name,parent_id,is_analytical,is_active')
    .eq('tenant_id', TENANT_ID)
    .ilike('code', '4.2.%')
    .order('code', { ascending: true });
  if (error) throw new Error(`Erro contas 4.2: ${error.message}`);
  return data || [];
}

async function monthlyTotalByAccountId(accountId, ym) {
  const start = `${ym}-01`;
  const end = `${nextYm(ym)}-01`;

  const { data: items, error: iErr } = await supabase
    .from('accounting_entry_items')
    .select('entry_id,debit')
    .eq('tenant_id', TENANT_ID)
    .eq('account_id', accountId)
    .gt('debit', 0);
  if (iErr) throw new Error(`Erro items ${accountId} ${ym}: ${iErr.message}`);

  const entryIds = [...new Set((items || []).map((i) => i.entry_id))];
  if (!entryIds.length) return 0;

  const { data: entries, error: eErr } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .in('id', entryIds)
    .gte('competence_date', start)
    .lt('competence_date', end);
  if (eErr) throw new Error(`Erro entries ${accountId} ${ym}: ${eErr.message}`);

  const validIds = new Set((entries || []).map((e) => e.id));
  let total = 0;
  for (const it of items || []) {
    if (validIds.has(it.entry_id)) total += Number(it.debit || 0);
  }
  return round2(total);
}

async function hasSalaryEducationEvent() {
  const { data, error } = await supabase
    .from('esocial_rubricas')
    .select('codigo,descricao,is_active')
    .eq('tenant_id', TENANT_ID)
    .ilike('descricao', '%salário educação%');
  if (error) throw new Error(`Erro rubricas salário educação: ${error.message}`);
  return data || [];
}

async function main() {
  const accounts = await loadAccounts();
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const months = ymList(YEAR);

  const roots = accounts.filter((a) => TARGET_CODES.includes(a.code) || a.code.startsWith('4.2.11.'));
  const synthetic = accounts.filter((a) => TARGET_PREFIXES.some((p) => a.code === p));

  console.log(`AUDITORIA DRE FOLHA - ${YEAR}`);
  console.log(`Tenant: ${TENANT_ID}`);
  console.log('');

  console.log('Estrutura de contas:');
  for (const a of roots) {
    const parentCode = byId[a.parent_id]?.code || 'null';
    console.log(`  ${a.code} | ${a.name} | anal=${a.is_analytical} | parent=${parentCode}`);
  }
  console.log('');

  console.log('Totais mensais por conta analítica:');
  const analytic = accounts.filter((a) => a.is_analytical && TARGET_PREFIXES.some((p) => a.code.startsWith(`${p}.`)));
  for (const a of analytic) {
    const vals = [];
    let annual = 0;
    for (const ym of months) {
      const v = await monthlyTotalByAccountId(a.id, ym);
      vals.push(`${ym}:${v.toFixed(2)}`);
      annual = round2(annual + v);
    }
    console.log(`\n${a.code} ${a.name} | anual=${annual.toFixed(2)}`);
    console.log(vals.join(' '));
  }
  console.log('');

  console.log('Totais mensais sintéticos (soma das filhas analíticas):');
  for (const s of synthetic) {
    const daughters = analytic.filter((a) => a.code.startsWith(`${s.code}.`));
    let annual = 0;
    const parts = [];
    for (const ym of months) {
      let mTotal = 0;
      for (const d of daughters) {
        // eslint-disable-next-line no-await-in-loop
        mTotal = round2(mTotal + (await monthlyTotalByAccountId(d.id, ym)));
      }
      annual = round2(annual + mTotal);
      parts.push(`${ym}:${mTotal.toFixed(2)}`);
    }
    console.log(`\n${s.code} ${s.name} | anual=${annual.toFixed(2)} | filhas=${daughters.length}`);
    console.log(parts.join(' '));
  }
  console.log('');

  const salaryEduRubricas = await hasSalaryEducationEvent();
  if (salaryEduRubricas.length === 0) {
    console.log('Rubrica "Salário Educação": NÃO existe no eSocial (ok para manter conta zerada).');
  } else {
    console.log('Rubricas "Salário Educação" encontradas no eSocial:');
    for (const r of salaryEduRubricas) {
      console.log(`  - ${r.codigo} ${r.descricao} active=${r.is_active}`);
    }
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err.message || err);
  process.exit(1);
});

