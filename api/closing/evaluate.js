import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function stableJsonStringify(obj) {
  const seen = new WeakSet();
  const stringify = (value) => {
    if (value && typeof value === 'object') {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      if (Array.isArray(value)) return value.map(stringify);
      return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
          acc[key] = stringify(value[key]);
          return acc;
        }, {});
    }
    return value;
  };

  return JSON.stringify(stringify(obj));
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hashClosingInput(input) {
  return sha256(stableJsonStringify(input));
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados no servidor');
    }

    const input = await readJson(req);

    const inputHash = hashClosingInput(input);
    const modelName = process.env.DR_CICERO_MODEL || 'gpt-5.2-thinking';
    const promptVersion = process.env.DR_CICERO_PROMPT_VERSION || 'dr-cicero-v1';

    const errors = [];
    const mustFix = [];
    const recs = [];

    if (!input?.integrity?.ok) {
      if (Array.isArray(input?.integrity?.errors)) {
        errors.push(...input.integrity.errors);
      }
      mustFix.push('Corrigir erros de integridade contábil antes do fechamento.');
    }

    const pendingTransitories = Array.isArray(input?.transitory_balances)
      ? input.transitory_balances.filter((t) => Number(t?.balance) !== 0)
      : [];

    if (pendingTransitories.length > 0) {
      mustFix.push(
        `Zerar contas transitórias pendentes: ${pendingTransitories
          .map((t) => `${t.code} (saldo ${t.balance})`)
          .join(', ')}`
      );
    }

    if ((input?.bank_reconciliation?.not_reconciled || 0) > 0) {
      recs.push('Existem transações bancárias não conciliadas; justificar ou conciliar antes de fechar.');
    }

    const authorized = errors.length === 0 && mustFix.length === 0;

    const decision = {
      authorized,
      must_fix_before_close: mustFix,
      recommendations: recs,
      classification_plan: pendingTransitories.map((t) => ({
        action: 'RECLASSIFY',
        reference: t.code,
        description: `Classificar saldo pendente da transitória ${t.code}.`,
        amount: t.balance,
      })),
      reasoning: authorized
        ? 'Competência revisada: sem erros de integridade e sem saldo em transitórias. Libero fechamento.'
        : 'Não libero fechamento: existem pendências objetivas (integridade/transitórias).',
      confidence: authorized ? 0.85 : 0.9,
    };

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload = {
      tenant_id: input.tenant_id,
      year: input?.period?.year,
      month: input?.period?.month,
      status: authorized ? 'APPROVED' : 'DRAFT',
      input_hash: inputHash,
      model: modelName,
      prompt_version: promptVersion,
      decision,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      created_by: input.generated_by,
      approved_at: authorized ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('accounting_closures')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({
      decision_id: data.id,
      tenant_id: data.tenant_id,
      period: { year: data.year, month: data.month },
      input_hash: data.input_hash,
      model: data.model,
      prompt_version: data.prompt_version,
      created_at: data.created_at,
      created_by: data.created_by,
      decision: data.decision,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Unknown error' });
  }
}
