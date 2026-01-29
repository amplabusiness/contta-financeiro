// scripts/fechamento_012025_reprocess.mjs
// FECHAMENTO CONTÁBIL 01/2025 - Dr. Cícero (ESTORNO + RELANÇAMENTO)
// Regras: não alterar lançamentos originais, criar estorno e recriar correto.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const START_DATE = '2025-01-01';
const END_DATE = '2025-01-31';
const SKIP_ESTORNO = process.argv.includes('--skip-estorno');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const fmt = (n) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

const isUuid = (value) => typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value);

async function rpcCreateEntry({
  entryDate,
  description,
  internalCode,
  sourceType,
  entryType,
  referenceType,
  referenceId,
  lines
}) {
  const payload = {
    p_tenant_id: TENANT_ID,
    p_entry_date: entryDate,
    p_description: description,
    p_internal_code: internalCode,
    p_source_type: sourceType,
    p_entry_type: entryType,
    p_reference_type: referenceType || null,
    p_reference_id: isUuid(referenceId) ? referenceId : null,
    p_lines: lines
  };

  const { data, error } = await supabase.rpc('rpc_create_accounting_entry', payload);
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Falha ao criar lançamento');
  return data.entry_id;
}

async function getAccountIdByCode(code) {
  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .eq('tenant_id', TENANT_ID)
    .single();
  if (error) throw new Error(`Conta ${code} não encontrada: ${error.message}`);
  return data.id;
}

async function getBankAccountingAccountId(bankAccountId) {
  if (!bankAccountId) return null;
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, accounting_account_id')
    .eq('id', bankAccountId)
    .eq('tenant_id', TENANT_ID)
    .maybeSingle();

  if (error) return null;
  return data?.accounting_account_id || null;
}

async function fetchEntryLines(entryId) {
  const { data, error } = await supabase
    .from('accounting_entry_lines')
    .select('id, account_id, debit, credit, description')
    .eq('entry_id', entryId)
    .eq('tenant_id', TENANT_ID);

  if (error) throw new Error(`Erro ao buscar linhas: ${error.message}`);
  return data || [];
}

function sumLines(lines) {
  const totalD = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalC = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  return { totalD, totalC };
}

async function createReversalEntry(entry, lines) {
  const reversedLines = lines.map((l) => ({
    account_id: l.account_id,
    debit: Number(l.credit || 0),
    credit: Number(l.debit || 0),
    description: `ESTORNO - ${l.description || entry.description || ''}`
  }));

  return await rpcCreateEntry({
    entryDate: entry.entry_date,
    description: `ESTORNO ${entry.description || entry.id}`,
    internalCode: `ESTORNO_${entry.id}`,
    sourceType: 'reversal',
    entryType: 'reversal',
    referenceType: 'reversal_of',
    referenceId: entry.id,
    lines: reversedLines
  });
}

async function resolveClientAccountId(entry) {
  const ref = entry.reference_id || '';
  const match = String(ref).match(/^hon_([0-9a-fA-F-]{36})_/);
  if (match) {
    const parsedClientId = match[1];
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, accounting_account_id')
      .eq('id', parsedClientId)
      .eq('tenant_id', TENANT_ID)
      .single();

    if (!error && client?.accounting_account_id) {
      return { clientId: parsedClientId, clientName: client.name, accountId: client.accounting_account_id };
    }

    if (!error && client?.name) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .ilike('name', `%${client.name}%`)
        .ilike('code', '1.1.2.01.%')
        .eq('tenant_id', TENANT_ID)
        .maybeSingle();

      if (conta?.id) return { clientId: parsedClientId, clientName: client.name, accountId: conta.id };
    }
  }

  const desc = String(entry.description || '');
  const parts = desc.split(' - ');
  const candidateName = parts.length > 1 ? parts[parts.length - 1].trim() : null;

  if (candidateName && candidateName.length >= 3) {
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, accounting_account_id')
      .ilike('name', `%${candidateName}%`)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();

    if (!error && client?.accounting_account_id) {
      return { clientId: client.id, clientName: client.name, accountId: client.accounting_account_id };
    }

    if (!error && client?.name) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .ilike('name', `%${client.name}%`)
        .ilike('code', '1.1.2.01.%')
        .eq('tenant_id', TENANT_ID)
        .maybeSingle();

      if (conta?.id) return { clientId: client.id, clientName: client.name, accountId: conta.id };
    }
  }

  return { clientId: null, clientName: null, accountId: null };
}

async function createHonorariosEntry(entry, lines) {
  const { totalD, totalC } = sumLines(lines);
  const amount = Math.max(totalD, totalC);

  const debitLine = lines.find((l) => Number(l.debit || 0) > 0);
  let debitAccountId = debitLine?.account_id || null;

  if (!debitAccountId) {
    const resolved = await resolveClientAccountId(entry);
    debitAccountId = resolved.accountId;
  }

  if (!debitAccountId) throw new Error('Conta do cliente não encontrada para honorários');

  const creditAccountId = await getAccountIdByCode('3.1.1.01');

  return await rpcCreateEntry({
    entryDate: entry.entry_date,
    description: `REPROCESSADO ${entry.description || 'Honorários'}`,
    internalCode: `REPROC_HON_${entry.id}`,
    sourceType: 'honorarios',
    entryType: 'receita_honorarios',
    referenceType: entry.reference_type || 'honorarios',
    referenceId: entry.reference_id,
    lines: [
      {
        account_id: debitAccountId,
        debit: amount,
        credit: 0,
        description: 'D - Cliente (reprocessado)'
      },
      {
        account_id: creditAccountId,
        debit: 0,
        credit: amount,
        description: 'C - Receita Honorários (reprocessado)'
      }
    ]
  });
}

function pickCounterpartAccount(lines, bankAccountId) {
  const candidates = lines.filter((l) => l.account_id && l.account_id !== bankAccountId);
  if (candidates.length === 0) return lines[0]?.account_id || null;

  const byAmount = candidates.map((l) => ({
    id: l.account_id,
    amount: Math.max(Number(l.debit || 0), Number(l.credit || 0))
  }));

  byAmount.sort((a, b) => b.amount - a.amount);
  return byAmount[0]?.id || null;
}

async function createBankTransactionEntry(entry, lines) {
  let tx = null;
  if (entry.reference_id) {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, fitid, transaction_date, amount, description, bank_account_id')
      .or(`fitid.eq.${entry.reference_id},id.eq.${entry.reference_id}`)
      .eq('tenant_id', TENANT_ID)
      .maybeSingle();
    if (!error) tx = data;
  }

  const { totalD, totalC } = sumLines(lines);
  const amount = tx ? Math.abs(Number(tx.amount || 0)) : Math.max(totalD, totalC);

  const bankAccountId = await getBankAccountingAccountId(tx?.bank_account_id);
  const fallbackBankAccountId = await getAccountIdByCode('1.1.1.05');
  const bankAccount = bankAccountId || fallbackBankAccountId;

  const counterpart = pickCounterpartAccount(lines, bankAccount);
  if (!counterpart) throw new Error('Conta contrapartida não encontrada para bank_transaction');

  const isCredit = tx ? Number(tx.amount || 0) > 0 : totalC > totalD;
  const entryType = isCredit ? 'recebimento' : 'pagamento_despesa';

  const debitAccountId = isCredit ? bankAccount : counterpart;
  const creditAccountId = isCredit ? counterpart : bankAccount;

  return await rpcCreateEntry({
    entryDate: tx?.transaction_date || entry.entry_date,
    description: `REPROCESSADO ${tx?.description || entry.description || 'Bank Tx'}`,
    internalCode: `REPROC_BANK_${entry.id}`,
    sourceType: 'bank_transaction',
    entryType: entryType,
    referenceType: entry.reference_type || 'bank_transaction',
    referenceId: entry.reference_id,
    lines: [
      {
        account_id: debitAccountId,
        debit: amount,
        credit: 0,
        description: `D - ${isCredit ? 'Banco' : 'Contrapartida'} (reprocessado)`
      },
      {
        account_id: creditAccountId,
        debit: 0,
        credit: amount,
        description: `C - ${isCredit ? 'Contrapartida' : 'Banco'} (reprocessado)`
      }
    ]
  });
}

async function validarTotais() {
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select('total_debit, total_credit')
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', START_DATE)
    .lte('entry_date', END_DATE);

  if (error) throw new Error(`Erro ao buscar entries: ${error.message}`);

  const totalD = entries.reduce((s, e) => s + Number(e.total_debit || 0), 0);
  const totalC = entries.reduce((s, e) => s + Number(e.total_credit || 0), 0);
  return { totalD, totalC };
}

async function validarTransitoria() {
  const contaDebitos = await getAccountIdByCode('1.1.9.01');
  const contaCreditos = await getAccountIdByCode('2.1.9.01');

  const { data: lines, error } = await supabase
    .from('accounting_entry_lines')
    .select('account_id, debit, credit, entry_id')
    .eq('tenant_id', TENANT_ID);

  if (error) throw new Error(`Erro ao buscar linhas transitórias: ${error.message}`);

  const sumFor = (accountId) => {
    const filtered = lines.filter((l) => l.account_id === accountId);
    const debit = filtered.reduce((s, l) => s + Number(l.debit || 0), 0);
    const credit = filtered.reduce((s, l) => s + Number(l.credit || 0), 0);
    return debit - credit;
  };

  return {
    saldoDebitos: sumFor(contaDebitos),
    saldoCreditos: sumFor(contaCreditos)
  };
}

async function run() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  FECHAMENTO CONTÁBIL 01/2025 - DR. CÍCERO                          ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  console.log('1) Pré-validação totals...');
  const before = await validarTotais();
  console.log(`   Débitos: ${fmt(before.totalD)} | Créditos: ${fmt(before.totalC)} | Diferença: ${fmt(Math.abs(before.totalD - before.totalC))}`);

  console.log('\n2) Buscando entries desbalanceados (bank_transaction/honorarios)...');
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, competence_date, description, entry_type, source_type, reference_type, reference_id')
    .eq('tenant_id', TENANT_ID)
    .gte('entry_date', START_DATE)
    .lte('entry_date', END_DATE)
    .in('source_type', ['bank_transaction', 'honorarios']);

  if (error) throw new Error(`Erro ao buscar entries: ${error.message}`);

  const unbalanced = [];

  for (const entry of entries || []) {
    const lines = await fetchEntryLines(entry.id);
    const { totalD, totalC } = sumLines(lines);
    if (Math.abs(totalD - totalC) > 0.01) {
      unbalanced.push({ entry, lines, totalD, totalC });
    }
  }

  console.log(`   Encontrados: ${unbalanced.length}\n`);

  console.log('3) Executando ESTORNO + RELANÇAMENTO...');
  let estornos = 0;
  let recriados = 0;
  let erros = 0;

  for (const item of unbalanced) {
    const { entry, lines, totalD, totalC } = item;
    try {
      let estornoId = null;
      if (!SKIP_ESTORNO) {
        estornoId = await createReversalEntry(entry, lines);
        estornos++;
      }

      let novoId = null;
      if (entry.source_type === 'honorarios') {
        novoId = await createHonorariosEntry(entry, lines);
      } else if (entry.source_type === 'bank_transaction') {
        novoId = await createBankTransactionEntry(entry, lines);
      }

      recriados++;
      const estornoMsg = SKIP_ESTORNO ? 'Estorno SKIP' : `Estorno ${estornoId}`;
      console.log(`   ✅ ${entry.id} (D=${fmt(totalD)} C=${fmt(totalC)}) → ${estornoMsg} | Novo ${novoId}`);
    } catch (err) {
      erros++;
      console.log(`   ❌ ${entry.id} → ${err.message}`);
    }
  }

  console.log(`\n   Resumo: ${estornos} estornos | ${recriados} reprocessados | ${erros} erros\n`);

  console.log('4) Pós-validação totals...');
  const after = await validarTotais();
  console.log(`   Débitos: ${fmt(after.totalD)} | Créditos: ${fmt(after.totalC)} | Diferença: ${fmt(Math.abs(after.totalD - after.totalC))}`);

  console.log('\n5) Verificando transitória 1.1.9.01 / 2.1.9.01...');
  try {
    const trans = await validarTransitoria();
    console.log(`   1.1.9.01 (Débitos): ${fmt(trans.saldoDebitos)}`);
    console.log(`   2.1.9.01 (Créditos): ${fmt(trans.saldoCreditos)}`);
  } catch (err) {
    console.log(`   ⚠️ Falha ao validar transitória: ${err.message}`);
  }

  console.log('\n╚════════════════════════════════════════════════════════════════════╝');
}

run().catch((err) => {
  console.error('❌ ERRO FATAL:', err.message || err);
  process.exit(1);
});
