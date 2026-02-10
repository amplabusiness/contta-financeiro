#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
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

const PERSONAL_RULES = {
  RAIMUNDO: {
    mode: 'adiantamento',
    debitCode: '1.1.3.01.01',
    reason: 'Funcionario da casa de lazer do proprietario',
  },
  SERGIO_AUGUSTO: {
    mode: 'skip',
    reason: 'Ajuda de custo lancada somente via extrato bancario',
  },
};

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
  const lastDay = new Date(Date.UTC(nextYear, nextMonth - 1, 0)).toISOString().slice(0, 10);
  return { start, end, lastDay };
}

function personalRuleForName(name) {
  const n = norm(name);
  if (n === 'RAIMUNDO PEREIRA MOREIRA') return PERSONAL_RULES.RAIMUNDO;
  if (n === 'SERGIO AUGUSTO DE OLIVEIRA LEAO') return PERSONAL_RULES.SERGIO_AUGUSTO;
  return null;
}

async function getAccountIdByCode(code) {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id,code,name')
    .eq('tenant_id', TENANT_ID)
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error(`Erro buscando conta ${code}: ${error.message}`);
  if (!data?.id) throw new Error(`Conta nao encontrada: ${code}`);
  return data.id;
}

async function fetchPayrollMonth(ym) {
  const { start, end } = monthBounds(ym);

  const { data: rows, error } = await supabase
    .from('payroll')
    .select(
      'id,employee_id,competencia,total_proventos_oficial,total_descontos_oficial,liquido_oficial,fgts_valor,employees(name,department)'
    )
    .eq('tenant_id', TENANT_ID)
    .gte('competencia', start)
    .lt('competencia', end)
    .order('employee_id', { ascending: true });

  if (error) throw new Error(`Erro payroll ${ym}: ${error.message}`);

  const payrollRows = rows || [];
  const payrollIds = payrollRows.map((r) => r.id);
  const adiantByPayroll = {};

  if (payrollIds.length > 0) {
    const { data: evRows, error: evErr } = await supabase
      .from('payroll_events')
      .select('payroll_id,rubrica_codigo,descricao,valor,is_desconto')
      .eq('tenant_id', TENANT_ID)
      .in('payroll_id', payrollIds);
    if (evErr) throw new Error(`Erro payroll_events ${ym}: ${evErr.message}`);

    for (const ev of evRows || []) {
      const code = String(ev.rubrica_codigo || '');
      const desc = String(ev.descricao || '').toUpperCase();
      const isAdiant =
        code === '2040' ||
        code === '4020' ||
        desc.includes('ADIANT');
      if (!isAdiant) continue;
      const value = round2(ev.valor);
      if (value <= 0) continue;
      adiantByPayroll[ev.payroll_id] = round2((adiantByPayroll[ev.payroll_id] || 0) + value);
    }
  }

  return payrollRows.map((r) => {
    const employeeName = r.employees?.name || 'Sem Nome';
    const rule = personalRuleForName(employeeName);
    const adiantamento = round2(adiantByPayroll[r.id] || 0);
    const liquido = round2(r.liquido_oficial || 0);
    const fgts = round2(r.fgts_valor || 0);
    return {
      payrollId: r.id,
      employeeId: r.employee_id,
      employeeName,
      department: r.employees?.department || null,
      totalProventos: round2(r.total_proventos_oficial || 0),
      totalDescontos: round2(r.total_descontos_oficial || 0),
      liquido,
      fgts,
      adiantamento,
      valorProvisao: round2(liquido + adiantamento),
      rule,
    };
  });
}

async function ensureSingleEntryByCode(code, payload) {
  const { data: existingRows, error: findErr } = await supabase
    .from('accounting_entries')
    .select('id,created_at')
    .eq('tenant_id', TENANT_ID)
    .eq('internal_code', code)
    .order('created_at', { ascending: true });

  if (findErr) throw new Error(`Erro lookup ${code}: ${findErr.message}`);

  let keepId = null;
  const rows = existingRows || [];
  if (rows.length > 0) {
    keepId = rows[0].id;
    const { error: updErr } = await supabase
      .from('accounting_entries')
      .update(payload)
      .eq('id', keepId)
      .eq('tenant_id', TENANT_ID);
    if (updErr) throw new Error(`Erro update ${code}: ${updErr.message}`);
  } else {
    const { data: ins, error: insErr } = await supabase
      .from('accounting_entries')
      .insert(payload)
      .select('id')
      .single();
    if (insErr) throw new Error(`Erro insert ${code}: ${insErr.message}`);
    keepId = ins.id;
  }

  if (rows.length > 1) {
    const dupIds = rows.slice(1).map((r) => r.id);
    if (dupIds.length > 0) {
      const { error: delItemsErr } = await supabase
        .from('accounting_entry_items')
        .delete()
        .eq('tenant_id', TENANT_ID)
        .in('entry_id', dupIds);
      if (delItemsErr) throw new Error(`Erro deletar duplicados items ${code}: ${delItemsErr.message}`);

      const { error: delLinesErr } = await supabase
        .from('accounting_entry_lines')
        .delete()
        .eq('tenant_id', TENANT_ID)
        .in('entry_id', dupIds);
      if (delLinesErr) throw new Error(`Erro deletar duplicados lines ${code}: ${delLinesErr.message}`);

      const { error: delEntriesErr } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('tenant_id', TENANT_ID)
        .in('id', dupIds);
      if (delEntriesErr) throw new Error(`Erro deletar duplicados entries ${code}: ${delEntriesErr.message}`);
    }
  }

  return keepId;
}

async function replaceEntryLines(entryId, items) {
  const totalDebit = round2(items.reduce((s, i) => s + round2(i.debit), 0));
  const totalCredit = round2(items.reduce((s, i) => s + round2(i.credit), 0));
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const { error: delItemsErr } = await supabase
    .from('accounting_entry_items')
    .delete()
    .eq('tenant_id', TENANT_ID)
    .eq('entry_id', entryId);
  if (delItemsErr) throw new Error(`Erro limpar accounting_entry_items ${entryId}: ${delItemsErr.message}`);

  if (items.length > 0) {
    const { error: insItemsErr } = await supabase
      .from('accounting_entry_items')
      .insert(items);
    if (insItemsErr) throw new Error(`Erro inserir accounting_entry_items ${entryId}: ${insItemsErr.message}`);
  }

  const lineRows = items.map((i) => ({
    tenant_id: TENANT_ID,
    entry_id: entryId,
    account_id: i.account_id,
    debit: i.debit,
    credit: i.credit,
    description: i.description,
  }));

  const { error: delLinesErr } = await supabase
    .from('accounting_entry_lines')
    .delete()
    .eq('tenant_id', TENANT_ID)
    .eq('entry_id', entryId);
  if (delLinesErr) throw new Error(`Erro limpar accounting_entry_lines ${entryId}: ${delLinesErr.message}`);

  if (lineRows.length > 0) {
    const { error: insLinesErr } = await supabase
      .from('accounting_entry_lines')
      .insert(lineRows);
    if (insLinesErr) throw new Error(`Erro inserir accounting_entry_lines ${entryId}: ${insLinesErr.message}`);
  }

  const { error: updErr } = await supabase
    .from('accounting_entries')
    .update({
      total_debit: totalDebit,
      total_credit: totalCredit,
      balanced,
    })
    .eq('tenant_id', TENANT_ID)
    .eq('id', entryId);
  if (updErr) throw new Error(`Erro atualizar totais entry ${entryId}: ${updErr.message}`);
}

async function backupEntries(codes) {
  const { data: entries, error: entriesErr } = await supabase
    .from('accounting_entries')
    .select('id,internal_code,description,entry_date,competence_date,total_debit,total_credit,source_type,reference_type,entry_type,created_at')
    .eq('tenant_id', TENANT_ID)
    .in('internal_code', codes)
    .order('internal_code', { ascending: true })
    .order('created_at', { ascending: true });
  if (entriesErr) throw new Error(`Erro backup entries: ${entriesErr.message}`);

  const entryIds = (entries || []).map((e) => e.id);
  let items = [];
  let lines = [];

  if (entryIds.length > 0) {
    const { data: itemRows, error: itemsErr } = await supabase
      .from('accounting_entry_items')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .in('entry_id', entryIds);
    if (itemsErr) throw new Error(`Erro backup items: ${itemsErr.message}`);
    items = itemRows || [];

    const { data: lineRows, error: linesErr } = await supabase
      .from('accounting_entry_lines')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .in('entry_id', entryIds);
    if (linesErr) throw new Error(`Erro backup lines: ${linesErr.message}`);
    lines = lineRows || [];
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `_backup_folha_base_sistema_${stamp}.json`;
  const payload = {
    generated_at: new Date().toISOString(),
    tenant_id: TENANT_ID,
    codes,
    counts: {
      entries: entries?.length || 0,
      items: items.length,
      lines: lines.length,
    },
    entries: entries || [],
    items,
    lines,
  };

  fs.writeFileSync(path.resolve(process.cwd(), file), JSON.stringify(payload, null, 2), 'utf8');
  return file;
}

async function main() {
  const startYm = process.argv[2] || DEFAULT_START;
  const endYm = process.argv[3] || DEFAULT_END;
  const dryRun = process.argv.includes('--dry-run');
  const competencias = monthRange(startYm, endYm);

  const contaSalarios = await getAccountIdByCode('4.2.1.01');
  const contaFolhaPagar = await getAccountIdByCode('2.1.2.01');
  const contaFgtsDespesa = await getAccountIdByCode('4.2.1.03');
  const contaFgtsPagar = await getAccountIdByCode('2.1.2.02');
  const contaAdiantSergio = await getAccountIdByCode('1.1.3.01.01');

  const codes = [];
  for (const ym of competencias) {
    const yyyymm = ym.replace('-', '');
    codes.push(`FOLHA_${yyyymm}_APROPRIACAO`);
    codes.push(`FOLHA_${yyyymm}_FGTS`);
  }

  const backupFile = await backupEntries(codes);
  console.log(`Backup salvo: ${backupFile}`);

  let totalApropriacao = 0;
  let totalFgts = 0;
  let totalFuncionarios = 0;
  const skipped = [];

  for (const ym of competencias) {
    const baseRows = await fetchPayrollMonth(ym);
    const { lastDay } = monthBounds(ym);
    const yyyymm = ym.replace('-', '');

    const aproCode = `FOLHA_${yyyymm}_APROPRIACAO`;
    const fgtsCode = `FOLHA_${yyyymm}_FGTS`;

    const aproDescription =
      `Apropriacao Folha Sistema ${ym} - por funcionario (liquido + adiantamento)`;
    const fgtsDescription = `Provisao FGTS Folha Sistema ${ym}`;

    const aproItems = [];
    let fgtsTotalMes = 0;
    let validEmployees = 0;

    for (const row of baseRows) {
      const rule = row.rule;
      const provisionValue = round2(row.valorProvisao);
      const rowFgts = round2(row.fgts);

      if (rule?.mode === 'skip') {
        skipped.push({ competencia: ym, employee: row.employeeName, reason: rule.reason });
        continue;
      }

      if (provisionValue <= 0) continue;

      let debitAccountId = contaSalarios;
      let debitLabel = 'Salarios';
      if (rule?.mode === 'adiantamento') {
        debitAccountId = contaAdiantSergio;
        debitLabel = 'Adiantamento Sergio Carneiro';
      } else {
        fgtsTotalMes = round2(fgtsTotalMes + rowFgts);
      }

      const desc = `Folha ${row.employeeName} - ${ym} (base sistema)`;
      aproItems.push({
        tenant_id: TENANT_ID,
        entry_id: '',
        account_id: debitAccountId,
        debit: provisionValue,
        credit: 0,
        description: `${desc} [D:${debitLabel}]`,
      });
      aproItems.push({
        tenant_id: TENANT_ID,
        entry_id: '',
        account_id: contaFolhaPagar,
        debit: 0,
        credit: provisionValue,
        description: `${desc} [C:Salarios a Pagar]`,
      });

      validEmployees += 1;
      totalFuncionarios += 1;
    }

    const fgtsItems =
      fgtsTotalMes > 0
        ? [
            {
              tenant_id: TENANT_ID,
              entry_id: '',
              account_id: contaFgtsDespesa,
              debit: fgtsTotalMes,
              credit: 0,
              description: `FGTS folha ${ym} [D:FGTS]`,
            },
            {
              tenant_id: TENANT_ID,
              entry_id: '',
              account_id: contaFgtsPagar,
              debit: 0,
              credit: fgtsTotalMes,
              description: `FGTS folha ${ym} [C:FGTS a Recolher]`,
            },
          ]
        : [];

    const aproTotalMes = round2(
      aproItems.filter((i) => i.debit > 0).reduce((s, i) => s + i.debit, 0)
    );

    if (!dryRun) {
      const aproId = await ensureSingleEntryByCode(aproCode, {
        tenant_id: TENANT_ID,
        entry_date: lastDay,
        competence_date: lastDay,
        description: aproDescription,
        internal_code: aproCode,
        source_type: 'payroll_system',
        reference_type: 'payroll',
        entry_type: 'MOVIMENTO',
      });
      await replaceEntryLines(
        aproId,
        aproItems.map((i) => ({ ...i, entry_id: aproId }))
      );

      const fgtsId = await ensureSingleEntryByCode(fgtsCode, {
        tenant_id: TENANT_ID,
        entry_date: lastDay,
        competence_date: lastDay,
        description: fgtsDescription,
        internal_code: fgtsCode,
        source_type: 'payroll_system',
        reference_type: 'payroll',
        entry_type: 'MOVIMENTO',
      });
      await replaceEntryLines(
        fgtsId,
        fgtsItems.map((i) => ({ ...i, entry_id: fgtsId }))
      );
    }

    totalApropriacao = round2(totalApropriacao + aproTotalMes);
    totalFgts = round2(totalFgts + fgtsTotalMes);

    console.log(
      `${ym}: payroll=${baseRows.length} considerados=${validEmployees} apropr=${aproTotalMes.toFixed(2)} fgts=${fgtsTotalMes.toFixed(2)}`
    );
  }

  console.log('');
  console.log(`Concluido ${dryRun ? '(dry-run)' : ''}`.trim());
  console.log(`Competencias: ${competencias.length}`);
  console.log(`Funcionarios considerados: ${totalFuncionarios}`);
  console.log(`Total apropriacao: R$ ${totalApropriacao.toFixed(2)}`);
  console.log(`Total FGTS: R$ ${totalFgts.toFixed(2)}`);
  if (skipped.length > 0) {
    console.log(`Ignorados por regra pessoal: ${skipped.length}`);
    for (const s of skipped) {
      console.log(`  - ${s.competencia}: ${s.employee} (${s.reason})`);
    }
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err.message || err);
  process.exit(1);
});

