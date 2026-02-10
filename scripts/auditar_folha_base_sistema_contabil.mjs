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

const DEFAULT_START = '2025-01';
const DEFAULT_END = '2025-12';

const norm = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const round2 = (n) => Number((Number(n || 0)).toFixed(2));

function parseYm(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
  if (!m) throw new Error(`Competencia invalida: ${ym}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`Competencia invalida: ${ym}`);
  return { year, month };
}

function monthRange(startYm, endYm) {
  const start = parseYm(startYm);
  const end = parseYm(endYm);
  const out = [];
  let y = start.year;
  let m = start.month;
  while (y < end.year || (y === end.year && m <= end.month)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function monthBounds(ym) {
  const { year, month } = parseYm(ym);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, end };
}

function personalRuleForName(name) {
  const n = norm(name);
  if (n === 'RAIMUNDO PEREIRA MOREIRA') {
    return { mode: 'adiantamento', debitCode: '1.1.3.01.01' };
  }
  if (n === 'SERGIO AUGUSTO DE OLIVEIRA LEAO') {
    return { mode: 'skip' };
  }
  return null;
}

async function getAccountId(code) {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id,code,name')
    .eq('tenant_id', TENANT_ID)
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error(`Erro conta ${code}: ${error.message}`);
  if (!data?.id) throw new Error(`Conta nao encontrada: ${code}`);
  return data.id;
}

async function fetchExpectedMonth(ym) {
  const { start, end } = monthBounds(ym);
  const { data: payrollRows, error } = await supabase
    .from('payroll')
    .select('id,liquido_oficial,fgts_valor,employees(name)')
    .eq('tenant_id', TENANT_ID)
    .gte('competencia', start)
    .lt('competencia', end);
  if (error) throw new Error(`Erro payroll ${ym}: ${error.message}`);

  const rows = payrollRows || [];
  const payrollIds = rows.map((r) => r.id);
  const adiantByPayroll = {};

  if (payrollIds.length > 0) {
    const { data: events, error: evErr } = await supabase
      .from('payroll_events')
      .select('payroll_id,rubrica_codigo,descricao,valor')
      .eq('tenant_id', TENANT_ID)
      .in('payroll_id', payrollIds);
    if (evErr) throw new Error(`Erro payroll_events ${ym}: ${evErr.message}`);

    for (const ev of events || []) {
      const code = String(ev.rubrica_codigo || '');
      const desc = String(ev.descricao || '').toUpperCase();
      const isAdiant = code === '2040' || code === '4020' || desc.includes('ADIANT');
      if (!isAdiant) continue;
      const v = round2(ev.valor);
      if (v <= 0) continue;
      adiantByPayroll[ev.payroll_id] = round2((adiantByPayroll[ev.payroll_id] || 0) + v);
    }
  }

  const expected = [];
  let expectedFgts = 0;

  for (const row of rows) {
    const name = row.employees?.name || 'Sem Nome';
    const rule = personalRuleForName(name);

    if (rule?.mode === 'skip') {
      continue;
    }

    const valor = round2(row.liquido_oficial || 0) + round2(adiantByPayroll[row.id] || 0);
    if (valor <= 0) continue;

    expected.push({
      name,
      amount: round2(valor),
      debitCode: rule?.debitCode || '4.2.1.01',
    });

    if (!rule) {
      expectedFgts = round2(expectedFgts + round2(row.fgts_valor || 0));
    }
  }

  return { expected, expectedFgts };
}

async function fetchEntryByCode(code) {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('id,internal_code,description')
    .eq('tenant_id', TENANT_ID)
    .eq('internal_code', code)
    .maybeSingle();
  if (error) throw new Error(`Erro entry ${code}: ${error.message}`);
  return data || null;
}

async function fetchItems(entryId) {
  const { data, error } = await supabase
    .from('accounting_entry_items')
    .select('account_id,debit,credit,description')
    .eq('tenant_id', TENANT_ID)
    .eq('entry_id', entryId);
  if (error) throw new Error(`Erro items ${entryId}: ${error.message}`);
  return data || [];
}

function money(n) {
  return round2(n).toFixed(2);
}

async function main() {
  const startYm = process.argv[2] || DEFAULT_START;
  const endYm = process.argv[3] || DEFAULT_END;
  const competencias = monthRange(startYm, endYm);

  const contaSalarios = await getAccountId('4.2.1.01');
  const contaAdiantSergio = await getAccountId('1.1.3.01.01');
  const contaSalariosPagar = await getAccountId('2.1.2.01');
  const contaFgtsDespesa = await getAccountId('4.2.1.03');

  let statusGeral = 'OK';

  for (const ym of competencias) {
    const yyyymm = ym.replace('-', '');
    const aproCode = `FOLHA_${yyyymm}_APROPRIACAO`;
    const fgtsCode = `FOLHA_${yyyymm}_FGTS`;

    const { expected, expectedFgts } = await fetchExpectedMonth(ym);
    const expectedTotal = round2(expected.reduce((s, e) => s + e.amount, 0));

    const aproEntry = await fetchEntryByCode(aproCode);
    const fgtsEntry = await fetchEntryByCode(fgtsCode);

    if (!aproEntry) {
      statusGeral = 'PENDENCIAS';
      console.log(`${ym} | APROPRIACAO ausente (${aproCode})`);
      continue;
    }

    const aproItems = await fetchItems(aproEntry.id);
    const debitItems = aproItems.filter(
      (i) =>
        round2(i.debit) > 0 &&
        (i.account_id === contaSalarios || i.account_id === contaAdiantSergio)
    );
    const creditItems = aproItems.filter(
      (i) => round2(i.credit) > 0 && i.account_id === contaSalariosPagar
    );

    const actualDebitTotal = round2(debitItems.reduce((s, i) => s + round2(i.debit), 0));
    const actualCreditTotal = round2(creditItems.reduce((s, i) => s + round2(i.credit), 0));

    const missingEmployees = [];
    const valueDiffEmployees = [];

    for (const exp of expected) {
      const found = debitItems.find((i) => norm(i.description || '').includes(norm(exp.name)));
      if (!found) {
        missingEmployees.push(exp.name);
        continue;
      }
      const v = round2(found.debit);
      if (Math.abs(v - exp.amount) >= 0.01) {
        valueDiffEmployees.push(`${exp.name} exp=${money(exp.amount)} atual=${money(v)}`);
      }
    }

    const extraEmployees = [];
    for (const it of debitItems) {
      const desc = String(it.description || '');
      const match = expected.some((exp) => norm(desc).includes(norm(exp.name)));
      if (!match) extraEmployees.push(desc || 'sem descricao');
    }

    let fgtsStatus = 'OK';
    let fgtsActual = 0;
    if (!fgtsEntry) {
      fgtsStatus = 'AUSENTE';
    } else {
      const fgtsItems = await fetchItems(fgtsEntry.id);
      fgtsActual = round2(
        fgtsItems
          .filter((i) => i.account_id === contaFgtsDespesa && round2(i.debit) > 0)
          .reduce((s, i) => s + round2(i.debit), 0)
      );
      if (Math.abs(fgtsActual - expectedFgts) >= 0.01) {
        fgtsStatus = `DIFF exp=${money(expectedFgts)} atual=${money(fgtsActual)}`;
      }
    }

    const totalOk =
      Math.abs(expectedTotal - actualDebitTotal) < 0.01 &&
      Math.abs(expectedTotal - actualCreditTotal) < 0.01;
    const employeesOk = missingEmployees.length === 0 && valueDiffEmployees.length === 0 && extraEmployees.length === 0;
    const fgtsOk = fgtsStatus === 'OK';
    const monthOk = totalOk && employeesOk && fgtsOk;

    if (!monthOk) statusGeral = 'PENDENCIAS';

    const label = monthOk ? 'OK' : 'PEND';
    console.log(
      `${ym} | ${label} | exp=${money(expectedTotal)} deb=${money(actualDebitTotal)} cred=${money(actualCreditTotal)} funcionarios=${expected.length}/${debitItems.length} fgts=${fgtsStatus}`
    );

    if (missingEmployees.length > 0) {
      console.log(`  missing: ${missingEmployees.join(' | ')}`);
    }
    if (valueDiffEmployees.length > 0) {
      console.log(`  val_diff: ${valueDiffEmployees.join(' | ')}`);
    }
    if (extraEmployees.length > 0) {
      console.log(`  extras: ${extraEmployees.join(' | ')}`);
    }
  }

  console.log('');
  console.log(`STATUS_GERAL ${statusGeral}`);
}

main().catch((err) => {
  console.error('Erro fatal:', err.message || err);
  process.exit(1);
});

