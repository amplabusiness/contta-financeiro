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

const START_DATE = '2025-01-01';
const END_DATE = '2026-01-01';

const LEGACY_FILTER = {
  internal_code_like: 'payroll:%',
  source_type: 'payroll',
  description_like: 'Provisão Folha de Pagamento%',
  start_date: START_DATE,
  end_date: END_DATE,
};

function round2(n) {
  return Number((Number(n || 0)).toFixed(2));
}

function tsSafe() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function getAccountByCode(code) {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id,code,name,parent_id,is_analytical')
    .eq('tenant_id', TENANT_ID)
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error(`Erro conta ${code}: ${error.message}`);
  return data || null;
}

async function fetchLegacyPayrollEntries() {
  const { data, error } = await supabase
    .from('accounting_entries')
    .select('id,internal_code,description,source_type,reference_type,entry_date,competence_date,total_debit,total_credit,created_at')
    .eq('tenant_id', TENANT_ID)
    .like('internal_code', LEGACY_FILTER.internal_code_like)
    .eq('source_type', LEGACY_FILTER.source_type)
    .ilike('description', LEGACY_FILTER.description_like)
    .gte('competence_date', LEGACY_FILTER.start_date)
    .lt('competence_date', LEGACY_FILTER.end_date)
    .order('competence_date', { ascending: true })
    .order('internal_code', { ascending: true });

  if (error) throw new Error(`Erro buscando lancamentos legados: ${error.message}`);
  return data || [];
}

async function fetchLegacyRelatedData(entryIds) {
  if (!entryIds.length) {
    return { items: [], lines: [], tracking: [], bankLinks: 0, payrollLinks: 0 };
  }

  const { data: items, error: itemsErr } = await supabase
    .from('accounting_entry_items')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .in('entry_id', entryIds);
  if (itemsErr) throw new Error(`Erro buscando items legados: ${itemsErr.message}`);

  const { data: lines, error: linesErr } = await supabase
    .from('accounting_entry_lines')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .in('entry_id', entryIds);
  if (linesErr) throw new Error(`Erro buscando lines legados: ${linesErr.message}`);

  const { data: tracking, error: trackErr } = await supabase
    .from('accounting_entry_tracking')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .in('entry_id', entryIds);
  if (trackErr) throw new Error(`Erro buscando tracking legado: ${trackErr.message}`);

  const { count: bankLinks, error: bankErr } = await supabase
    .from('bank_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .in('journal_entry_id', entryIds);
  if (bankErr) throw new Error(`Erro buscando vinculos bancarios: ${bankErr.message}`);

  const { count: payrollLinks, error: payErr } = await supabase
    .from('payroll_journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID)
    .in('journal_entry_id', entryIds);
  if (payErr) throw new Error(`Erro buscando vinculos payroll_journal_entries: ${payErr.message}`);

  return {
    items: items || [],
    lines: lines || [],
    tracking: tracking || [],
    bankLinks: bankLinks || 0,
    payrollLinks: payrollLinks || 0,
  };
}

async function summarizeLegacyByAccount(items) {
  const accountIds = [...new Set(items.map((i) => i.account_id))];
  if (!accountIds.length) return {};

  const { data: accts, error } = await supabase
    .from('chart_of_accounts')
    .select('id,code,name')
    .eq('tenant_id', TENANT_ID)
    .in('id', accountIds);
  if (error) throw new Error(`Erro resumo contas legado: ${error.message}`);

  const byId = Object.fromEntries((accts || []).map((a) => [a.id, a]));
  const summary = {};
  for (const it of items) {
    const a = byId[it.account_id];
    const code = a?.code || 'SEM_CONTA';
    if (!summary[code]) {
      summary[code] = { account_name: a?.name || 'Conta não encontrada', debit: 0, credit: 0, lines: 0 };
    }
    summary[code].debit = round2(summary[code].debit + round2(it.debit));
    summary[code].credit = round2(summary[code].credit + round2(it.credit));
    summary[code].lines += 1;
  }
  return summary;
}

async function backupLegacy(entries, related, summaryByAccount) {
  const payload = {
    generated_at: new Date().toISOString(),
    tenant_id: TENANT_ID,
    filter: LEGACY_FILTER,
    counts: {
      entries: entries.length,
      items: related.items.length,
      lines: related.lines.length,
      tracking: related.tracking.length,
      bank_links: related.bankLinks,
      payroll_links: related.payrollLinks,
    },
    summary_by_account: summaryByAccount,
    entries,
    items: related.items,
    lines: related.lines,
    tracking: related.tracking,
  };

  const file = `_backup_cleanup_legacy_payroll_${tsSafe()}.json`;
  fs.writeFileSync(path.resolve(process.cwd(), file), JSON.stringify(payload, null, 2), 'utf8');
  return file;
}

async function fixAccountHierarchy(dryRun) {
  const acc42 = await getAccountByCode('4.2');
  const acc421 = await getAccountByCode('4.2.1');
  let acc4211 = await getAccountByCode('4.2.11');

  if (!acc42 || !acc421) throw new Error('Contas sinteticas base (4.2/4.2.1) não encontradas.');

  if (!acc4211) {
    if (dryRun) {
      console.log('[dry-run] Criaria conta 4.2.11 Terceiros e Autônomos (MEI/PJ)');
      acc4211 = { id: 'DRY_RUN_ID', code: '4.2.11', name: 'Terceiros e Autônomos (MEI/PJ)' };
    } else {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert({
          tenant_id: TENANT_ID,
          code: '4.2.11',
          name: 'Terceiros e Autônomos (MEI/PJ)',
          parent_id: acc42.id,
          account_type: 'DESPESA',
          nature: 'DEBIT',
          is_analytical: false,
          is_active: true,
        })
        .select('id,code,name,parent_id,is_analytical')
        .single();
      if (error) throw new Error(`Erro criando 4.2.11: ${error.message}`);
      acc4211 = data;
      console.log('Criada conta 4.2.11');
    }
  }

  if (dryRun) {
    console.log('[dry-run] Atualizaria 4.2.1 para "Folha de Pagamento CLT"');
    console.log('[dry-run] Atualizaria 4.2.11 para parent=4.2 e nome "Terceiros e Autônomos (MEI/PJ)"');
  } else {
    const { error: upd421Err } = await supabase
      .from('chart_of_accounts')
      .update({ name: 'Folha de Pagamento CLT', parent_id: acc42.id })
      .eq('tenant_id', TENANT_ID)
      .eq('id', acc421.id);
    if (upd421Err) throw new Error(`Erro atualizando 4.2.1: ${upd421Err.message}`);

    const { error: upd4211Err } = await supabase
      .from('chart_of_accounts')
      .update({ name: 'Terceiros e Autônomos (MEI/PJ)', parent_id: acc42.id })
      .eq('tenant_id', TENANT_ID)
      .eq('id', acc4211.id);
    if (upd4211Err) throw new Error(`Erro atualizando 4.2.11: ${upd4211Err.message}`);
  }

  const { data: children, error: childErr } = await supabase
    .from('chart_of_accounts')
    .select('id,code,name,parent_id')
    .eq('tenant_id', TENANT_ID)
    .ilike('code', '4.2.11.%');
  if (childErr) throw new Error(`Erro listando filhas 4.2.11.*: ${childErr.message}`);

  const needFix = (children || []).filter((c) => c.parent_id !== acc4211.id);

  if (needFix.length > 0) {
    if (dryRun) {
      console.log(`[dry-run] Ajustaria parent_id de ${needFix.length} contas 4.2.11.* para 4.2.11`);
      for (const c of needFix) {
        console.log(`  - ${c.code} ${c.name}`);
      }
    } else {
      const ids = needFix.map((c) => c.id);
      const { error: fixErr } = await supabase
        .from('chart_of_accounts')
        .update({ parent_id: acc4211.id })
        .eq('tenant_id', TENANT_ID)
        .in('id', ids);
      if (fixErr) throw new Error(`Erro ajustando parent_id 4.2.11.*: ${fixErr.message}`);
      console.log(`Parent_id corrigido em ${ids.length} contas 4.2.11.*`);
    }
  }
}

async function cleanupLegacyPayrollEntries(dryRun) {
  const entries = await fetchLegacyPayrollEntries();
  const entryIds = entries.map((e) => e.id);

  const related = await fetchLegacyRelatedData(entryIds);
  const summaryByAccount = await summarizeLegacyByAccount(related.items);
  const backupFile = await backupLegacy(entries, related, summaryByAccount);

  console.log(`Backup legado salvo: ${backupFile}`);
  console.log(`Candidatos: ${entries.length} entries, ${related.items.length} items, ${related.lines.length} lines, ${related.tracking.length} tracking`);
  console.log(`Vínculos externos: bank=${related.bankLinks}, payroll_journal_entries=${related.payrollLinks}`);

  if (related.bankLinks > 0 || related.payrollLinks > 0) {
    throw new Error('Abortado: existem vínculos externos em lançamentos legados.');
  }

  console.log('Resumo por conta impactada (debitos/créditos nos legados):');
  for (const code of Object.keys(summaryByAccount).sort()) {
    const s = summaryByAccount[code];
    console.log(`  ${code} ${s.account_name} | D=${s.debit.toFixed(2)} C=${s.credit.toFixed(2)} lines=${s.lines}`);
  }

  if (dryRun || !entryIds.length) {
    if (dryRun) console.log('[dry-run] Não removeu lançamentos legados.');
    return;
  }

  if (related.tracking.length > 0) {
    const trackIds = related.tracking.map((t) => t.id);
    const { error: delTrackErr } = await supabase
      .from('accounting_entry_tracking')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .in('id', trackIds);
    if (delTrackErr) throw new Error(`Erro removendo tracking legado: ${delTrackErr.message}`);
  }

  if (related.items.length > 0) {
    const itemIds = related.items.map((i) => i.id);
    const { error: delItemsErr } = await supabase
      .from('accounting_entry_items')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .in('id', itemIds);
    if (delItemsErr) throw new Error(`Erro removendo items legados: ${delItemsErr.message}`);
  }

  if (related.lines.length > 0) {
    const lineIds = related.lines.map((l) => l.id);
    const { error: delLinesErr } = await supabase
      .from('accounting_entry_lines')
      .delete()
      .eq('tenant_id', TENANT_ID)
      .in('id', lineIds);
    if (delLinesErr) throw new Error(`Erro removendo lines legados: ${delLinesErr.message}`);
  }

  const { error: delEntriesErr } = await supabase
    .from('accounting_entries')
    .delete()
    .eq('tenant_id', TENANT_ID)
    .in('id', entryIds);
  if (delEntriesErr) throw new Error(`Erro removendo entries legados: ${delEntriesErr.message}`);

  console.log(`Removidos: ${entryIds.length} lançamentos legados payroll:*`);
}

async function validateNoSalaryEducation() {
  const acc = await getAccountByCode('4.2.2.05');
  if (!acc) {
    console.log('Conta 4.2.2.05 não encontrada após ajustes.');
    return;
  }

  const { data: items, error } = await supabase
    .from('accounting_entry_items')
    .select('id,entry_id,debit')
    .eq('tenant_id', TENANT_ID)
    .eq('account_id', acc.id)
    .gt('debit', 0);
  if (error) throw new Error(`Erro validando 4.2.2.05: ${error.message}`);

  const ids = [...new Set((items || []).map((i) => i.entry_id))];
  let total2025 = 0;

  if (ids.length > 0) {
    const { data: entries, error: eErr } = await supabase
      .from('accounting_entries')
      .select('id,competence_date')
      .eq('tenant_id', TENANT_ID)
      .in('id', ids)
      .gte('competence_date', START_DATE)
      .lt('competence_date', END_DATE);
    if (eErr) throw new Error(`Erro validando entries 4.2.2.05: ${eErr.message}`);
    const idSet = new Set((entries || []).map((e) => e.id));
    for (const it of items || []) {
      if (idSet.has(it.entry_id)) total2025 = round2(total2025 + round2(it.debit));
    }
  }

  console.log(`4.2.2.05 Salário Educação (2025) após limpeza: R$ ${total2025.toFixed(2)}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'EXECUÇÃO REAL'}`);
  console.log(`Tenant: ${TENANT_ID}`);

  await fixAccountHierarchy(dryRun);
  await cleanupLegacyPayrollEntries(dryRun);
  await validateNoSalaryEducation();

  console.log('Concluído.');
}

main().catch((err) => {
  console.error('Erro fatal:', err.message || err);
  process.exit(1);
});

