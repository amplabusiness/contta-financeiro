import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(msg, obj) {
  if (obj !== undefined) console.log(msg, obj);
  else console.log(msg);
}

function parseDateBR(s) {
  // Expect dd/MM/yyyy
  const [d, m, y] = s.split('/').map((t) => parseInt(t, 10));
  return new Date(y, m - 1, d);
}

function parseMoneyBR(s) {
  // Handles formats like "1.412,00" or "300"
  if (typeof s !== 'string') return Number(s) || 0;
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toISODateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    .toISOString()
    .slice(0, 10);
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_service_role ||
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Configure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // CSV path (banco/clientes boletos jan.csv)
  const csvPath = path.resolve(
    path.join(__dirname, '..', 'banco', 'clientes boletos jan.csv')
  );
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Arquivo não encontrado: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) {
    console.error('❌ CSV vazio ou inválido');
    process.exit(1);
  }

  const alvoDocumento = process.env.COB || 'COB000005';
  const alvoDataExtratoEnv = process.env.COB_DATE; // YYYY-MM-DD opcional

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(';').map((p) => p.trim());
    if (parts.length < 8) continue;

    const [documento, numeroboleto, pagador, dataVencStr, dataLiqStr, valorBolStr, valorRecStr, dataExtratoStr] = parts;
    if (documento !== alvoDocumento) continue;

    records.push({
      documento,
      numeroboleto,
      pagador,
      dataVencimento: parseDateBR(dataVencStr),
      dataLiquidacao: parseDateBR(dataLiqStr),
      valorBoleto: parseMoneyBR(valorBolStr),
      valorRecebido: parseMoneyBR(valorRecStr),
      dataExtrato: parseDateBR(dataExtratoStr),
    });
  }

  if (records.length === 0) {
    console.warn(`⚠️ Nenhum registro encontrado para ${alvoDocumento}`);
    process.exit(0);
  }

  // Se fornecida, filtrar por data de extrato alvo; senão, usar a data mais frequente
  let filtered = records;
  if (alvoDataExtratoEnv) {
    filtered = records.filter((r) => toISODateOnly(r.dataExtrato) === alvoDataExtratoEnv);
  } else {
    const counts = new Map();
    for (const r of records) {
      const key = toISODateOnly(r.dataExtrato);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let best = null;
    let bestCount = -1;
    for (const [k, v] of counts.entries()) {
      if (v > bestCount) {
        best = k;
        bestCount = v;
      }
    }
    filtered = records.filter((r) => toISODateOnly(r.dataExtrato) === best);
  }

  // Aggregate do conjunto filtrado
  const totalRecebido = filtered.reduce((s, r) => s + r.valorRecebido, 0);
  const dataExtrato = filtered[0].dataExtrato; // todos os filtrados compartilham a data alvo

  log(`▶️ Repostando cobrança ${alvoDocumento}`);
  log(` - Clientes: ${records.length}`);
  log(` - Total: R$ ${totalRecebido.toFixed(2)}`);
  log(` - Data Extrato (alvo): ${dataExtrato.toISOString().slice(0, 10)}`);

  let clientesLinked = 0;
  let invoicesCreated = 0; // manter para auditoria, mas não iremos inserir novas invoices
  const clienteResultados = [];

  for (const rec of filtered) {
    // Buscar cliente por nome (busca direta por substring, sem normalizar a consulta)
    const { data: clients, error: cErr } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', `%${rec.pagador}%`)
      .limit(1);

    if (cErr) throw cErr;
    if (!clients || clients.length === 0) {
      log(`⚠️ Cliente não encontrado: ${rec.pagador}`);
      clienteResultados.push({ nome: rec.pagador, valor: rec.valorRecebido, invoiceId: undefined, invoiceCreated: false });
      continue;
    }

    const clientId = clients[0].id;

    // Tenta localizar invoice existente por valor e período (mês do vencimento)
    const mes = rec.dataVencimento.getMonth() + 1;
    const ano = rec.dataVencimento.getFullYear();
    const inicioMes = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0);
    const { data: existing, error: eErr } = await supabase
      .from('invoices')
      .select('id, status, paid_date, payment_date, due_date, competence')
      .eq('client_id', clientId)
      .eq('amount', rec.valorRecebido)
      .gte('due_date', toISODateOnly(inicioMes))
      .lte('due_date', toISODateOnly(fimMes))
      .order('created_at', { ascending: false })
      .limit(1);

    if (eErr) throw eErr;

    if (existing && existing.length > 0) {
      const inv = existing[0];
      // Atualiza para pago se necessário, tentando setar paid_date e fallbacks
      if (!inv.paid_date && !inv.payment_date) {
        const payDate = toISODateOnly(rec.dataLiquidacao);
        let upErrFinal = null;
        // Tenta com paid_date
        let { error: upErr1 } = await supabase
          .from('invoices')
          .update({ status: 'paid', paid_date: payDate })
          .eq('id', inv.id);
        if (upErr1) {
          // Se falhar por coluna inexistente, tenta com payment_date
          let { error: upErr2 } = await supabase
            .from('invoices')
            .update({ status: 'paid', payment_date: payDate })
            .eq('id', inv.id);
          if (upErr2) upErrFinal = upErr2;
        }
        if (upErrFinal) throw upErrFinal;
      }
      clientesLinked += 1;
      clienteResultados.push({ nome: rec.pagador, valor: rec.valorRecebido, invoiceId: inv.id, invoiceCreated: false });
    } else {
      // Não vamos criar nova invoice automaticamente para evitar violar regras contábeis
      clienteResultados.push({ nome: rec.pagador, valor: rec.valorRecebido, invoiceId: undefined, invoiceCreated: false, motivo: 'invoice_nao_encontrada_mes_vencimento' });
    }
  }

  // Procurar bank_transaction correspondente
  const start = new Date(dataExtrato.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(dataExtrato.getTime() + 24 * 60 * 60 * 1000);
  const { data: bankTxs, error: bErr } = await supabase
    .from('bank_transactions')
    .select('id, reference_id, amount, transaction_date, description')
    .ilike('description', `%${alvoDocumento}%`)
    .eq('amount', totalRecebido)
    .gte('transaction_date', start.toISOString())
    .lte('transaction_date', end.toISOString())
    .order('transaction_date', { ascending: true })
    .limit(1);

  if (bErr) throw bErr;
  const bankTx = bankTxs && bankTxs[0] ? bankTxs[0] : null;

  log('✅ Repost concluído:');
  log(` - Documento: ${alvoDocumento}`);
  log(` - Clientes vinculados: ${clientesLinked}/${filtered.length}`);
  log(` - Invoices criadas: ${invoicesCreated}`);
  if (bankTx) {
    log(` - Bank Tx: ${bankTx.id} (${bankTx.description}) em ${bankTx.transaction_date}`);
  } else {
    log(' - Bank Tx: não localizada no período ±1 dia');
  }

  // Saída em JSON para auditoria
  const output = {
    documento: alvoDocumento,
    dataExtrato: dataExtrato.toISOString(),
    totalRecebido,
    clientesCount: records.length,
    clientesLinked,
    invoicesCreated,
    bankTransactionMatched: !!bankTx,
    matchedBankTransactionId: bankTx?.id || null,
    clientes: clienteResultados,
  };

  const outPath = path.resolve(path.join(__dirname, '..', `_repost_${alvoDocumento}.json`));
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  log(`📝 Resumo salvo em: ${outPath}`);
}

main().catch((err) => {
  console.error('❌ Erro ao repostar cobrança:', err);
  process.exit(1);
});
