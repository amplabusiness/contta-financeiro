/**
 * DR. CÍCERO - RECLASSIFICAÇÃO AUTOMÁTICA v2 (OTIMIZADA)
 *
 * Versão otimizada que faz batch de queries para melhor performance.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MODO = process.argv[2] || 'simulacao';
const PERIODO = process.argv[3] || '2025-01';

async function buscarTodos(tabela, campos = '*', filtros = null) {
  const todos = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase.from(tabela).select(campos).range(page * pageSize, (page + 1) * pageSize - 1);
    if (filtros) {
      for (const [key, value] of Object.entries(filtros)) {
        query = query.eq(key, value);
      }
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return todos;
}

async function main() {
  console.log('═'.repeat(80));
  console.log(`🤖 DR. CÍCERO - RECLASSIFICAÇÃO AUTOMÁTICA v2`);
  console.log(`   Modo: ${MODO.toUpperCase()} | Período: ${PERIODO}`);
  console.log('═'.repeat(80));

  // 1. Buscar conta sintética
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.2.01')
    .single();

  if (!contaSintetica) {
    console.log('❌ Conta 1.1.2.01 não encontrada');
    return;
  }

  console.log(`\n📌 Conta Sintética: ${contaSintetica.code} - ${contaSintetica.name}`);

  // 2. Buscar lançamentos na sintética
  console.log('\n   Buscando lançamentos...');
  const linhas = await buscarTodos('accounting_entry_lines', 'id, entry_id, debit, credit, description', { account_id: contaSintetica.id });
  console.log(`   ${linhas.length} lançamentos encontrados`);

  if (linhas.length === 0) {
    console.log('\n✅ Nenhum lançamento na sintética. Já está correto!');
    return;
  }

  // 3. Buscar entries em batch
  console.log('\n   Buscando entries...');
  const entryIds = [...new Set(linhas.map(l => l.entry_id))];
  const entries = [];
  for (let i = 0; i < entryIds.length; i += 500) {
    const lote = entryIds.slice(i, i + 500);
    const { data } = await supabase.from('accounting_entries').select('id, source_type, reference_id, description').in('id', lote);
    if (data) entries.push(...data);
  }
  const mapEntries = Object.fromEntries(entries.map(e => [e.id, e]));
  console.log(`   ${entries.length} entries carregados`);

  // 4. Buscar contas analíticas
  const { data: analiticas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .eq('is_analytical', true);

  console.log(`   ${analiticas?.length || 0} contas analíticas existentes`);

  // Mapear por nome normalizado
  const mapaContas = {};
  for (const c of analiticas || []) {
    mapaContas[normalizar(c.name.replace('Cliente: ', ''))] = c;
  }

  // 5. Agrupar por source_type e buscar client_id em batch
  console.log('\n   Identificando clientes...');
  const porTipo = {};
  for (const linha of linhas) {
    const entry = mapEntries[linha.entry_id];
    const tipo = entry?.source_type || 'null';
    if (!porTipo[tipo]) porTipo[tipo] = [];
    porTipo[tipo].push({ linha, entry });
  }

  console.log('   Tipos encontrados:', Object.keys(porTipo).map(t => `${t}(${porTipo[t].length})`).join(', '));

  // Buscar todos os clientes de invoices em batch
  const invoiceRefIds = (porTipo['invoice'] || []).map(x => x.entry?.reference_id).filter(Boolean);
  const invoicesMap = {};
  if (invoiceRefIds.length > 0) {
    console.log(`   Buscando ${invoiceRefIds.length} invoices...`);
    for (let i = 0; i < invoiceRefIds.length; i += 500) {
      const lote = invoiceRefIds.slice(i, i + 500);
      const { data, error } = await supabase.from('invoices').select('id, client_id, clients(name)').in('id', lote);
      if (error) console.log('   Erro invoices:', error.message);
      data?.forEach(inv => invoicesMap[inv.id] = inv);
    }
  }
  console.log(`   ${Object.keys(invoicesMap).length} invoices mapeados`);

  // Buscar boletos em batch
  const boletoRefIds = [...(porTipo['boleto_sicredi'] || []).map(x => x.entry?.reference_id), ...(porTipo['sicredi_boleto'] || []).map(x => x.entry?.reference_id)].filter(Boolean);
  const boletosMap = {};
  if (boletoRefIds.length > 0) {
    console.log(`   Buscando ${boletoRefIds.length} boletos...`);
    for (let i = 0; i < boletoRefIds.length; i += 500) {
      const lote = boletoRefIds.slice(i, i + 500);
      const { data, error } = await supabase.from('boleto_payments').select('id, client_id, clients(name)').in('id', lote);
      if (error) console.log('   Erro boletos:', error.message);
      data?.forEach(b => boletosMap[b.id] = b);
    }
  }
  console.log(`   ${Object.keys(boletosMap).length} boletos mapeados`);

  // Buscar saldos de abertura em batch
  const obRefIds = (porTipo['client_opening_balance'] || []).map(x => x.entry?.reference_id).filter(Boolean);
  const obMap = {};
  if (obRefIds.length > 0) {
    console.log(`   Buscando ${obRefIds.length} saldos de abertura...`);
    for (let i = 0; i < obRefIds.length; i += 500) {
      const lote = obRefIds.slice(i, i + 500);
      const { data, error } = await supabase.from('client_opening_balances').select('id, client_id, clients(name)').in('id', lote);
      if (error) console.log('   Erro saldos:', error.message);
      data?.forEach(ob => obMap[ob.id] = ob);
    }
  }
  console.log(`   ${Object.keys(obMap).length} saldos de abertura mapeados`);

  // 6. Processar e classificar
  console.log('\n   Processando lançamentos...');
  const reclassificacoes = [];
  const naoIdentificados = [];
  const contasParaCriar = new Map();
  const stats = {};

  for (const linha of linhas) {
    const entry = mapEntries[linha.entry_id];
    const tipo = entry?.source_type || 'null';

    if (!stats[tipo]) stats[tipo] = { total: 0, ok: 0 };
    stats[tipo].total++;

    let clienteNome = null;
    let clientId = null;

    // Identificar cliente baseado no tipo
    if (tipo === 'invoice' && entry.reference_id) {
      const inv = invoicesMap[entry.reference_id];
      if (inv?.clients?.name) {
        clienteNome = inv.clients.name;
        clientId = inv.client_id;
      }
    } else if ((tipo === 'boleto_sicredi' || tipo === 'sicredi_boleto') && entry.reference_id) {
      const bol = boletosMap[entry.reference_id];
      if (bol?.clients?.name) {
        clienteNome = bol.clients.name;
        clientId = bol.client_id;
      }
    } else if (tipo === 'client_opening_balance' && entry.reference_id) {
      const ob = obMap[entry.reference_id];
      if (ob?.clients?.name) {
        clienteNome = ob.clients.name;
        clientId = ob.client_id;
      }
    }

    // Fallback: extrair do description
    if (!clienteNome) {
      clienteNome = extrairNome(entry?.description || linha.description || '');
    }

    if (clienteNome && clienteNome !== 'NAO_IDENTIFICADO') {
      stats[tipo].ok++;
      const norm = normalizar(clienteNome);
      let conta = mapaContas[norm];

      if (!conta && !contasParaCriar.has(norm)) {
        contasParaCriar.set(norm, { nome: clienteNome, client_id: clientId });
      }

      reclassificacoes.push({
        linha_id: linha.id,
        cliente: clienteNome,
        norm,
        client_id: clientId,
        conta,
        d: linha.debit,
        c: linha.credit
      });
    } else {
      naoIdentificados.push({
        linha_id: linha.id,
        tipo,
        desc: (entry?.description || '').substring(0, 60),
        d: linha.debit,
        c: linha.credit
      });
    }
  }

  // 7. Mostrar resultados
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 RESULTADO DA ANÁLISE');
  console.log('═'.repeat(80));

  console.log(`\n✅ Identificados: ${reclassificacoes.length}`);
  console.log(`❌ Não identificados: ${naoIdentificados.length}`);
  console.log(`🆕 Contas a criar: ${contasParaCriar.size}`);

  console.log('\n📋 Por source_type:');
  for (const [tipo, s] of Object.entries(stats).sort((a, b) => b[1].total - a[1].total)) {
    const pct = s.total > 0 ? ((s.ok / s.total) * 100).toFixed(1) : '0';
    console.log(`   ${tipo}: ${s.ok}/${s.total} (${pct}%)`);
  }

  let totalD = 0, totalC = 0;
  reclassificacoes.forEach(r => { totalD += parseFloat(r.d) || 0; totalC += parseFloat(r.c) || 0; });
  console.log('\n📊 VALORES:');
  console.log(`   Débitos: R$ ${totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Créditos: R$ ${totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Mostrar não identificados
  if (naoIdentificados.length > 0 && naoIdentificados.length <= 20) {
    console.log('\n📋 NÃO IDENTIFICADOS:');
    for (const ni of naoIdentificados.slice(0, 20)) {
      console.log(`   ${ni.tipo}: ${ni.desc}`);
    }
  }

  // 8. Aplicar se modo aplicar
  if (MODO === 'aplicar') {
    console.log('\n\n' + '═'.repeat(80));
    console.log('🔄 APLICANDO...');
    console.log('═'.repeat(80));

    // Criar contas
    console.log(`\n   Criando ${contasParaCriar.size} contas...`);
    for (const [norm, info] of contasParaCriar) {
      const nova = await criarConta(contaSintetica, info.nome);
      if (nova) {
        mapaContas[norm] = nova;
        console.log(`   ✅ ${nova.code} - ${nova.name}`);
      }
    }

    // Reclassificar
    console.log(`\n   Reclassificando ${reclassificacoes.length} lançamentos...`);
    let ok = 0, err = 0;
    for (const r of reclassificacoes) {
      const conta = r.conta || mapaContas[r.norm];
      if (!conta) { err++; continue; }

      const { error } = await supabase
        .from('accounting_entry_lines')
        .update({ account_id: conta.id })
        .eq('id', r.linha_id);

      if (error) err++;
      else ok++;

      if ((ok + err) % 200 === 0) console.log(`   ${ok + err}/${reclassificacoes.length}...`);
    }

    console.log(`\n   ✅ OK: ${ok}`);
    console.log(`   ❌ Erros: ${err}`);

    const { count } = await supabase.from('accounting_entry_lines').select('id', { count: 'exact', head: true }).eq('account_id', contaSintetica.id);
    console.log(`\n📊 Restantes na sintética: ${count || 0}`);
  } else {
    console.log('\n\n' + '═'.repeat(80));
    console.log('ℹ️  SIMULAÇÃO - Nenhuma alteração');
    console.log('═'.repeat(80));
    console.log('\nPara aplicar: node scripts/dr_cicero_reclassificacao_v2.mjs aplicar');
  }

  // Razão
  await razao(PERIODO);
}

function normalizar(s) {
  return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '').substring(0, 100);
}

function extrairNome(desc) {
  if (!desc) return 'NAO_IDENTIFICADO';
  let m;
  m = desc.match(/Receita Honorarios:\s*(.+?)(?:\s*-\s*COB|\s*$)/i);
  if (m) return m[1].trim().toUpperCase();
  m = desc.match(/Recebimento\s+(.+?)\s*-\s*COB/i);
  if (m) return m[1].trim().toUpperCase();
  m = desc.match(/Saldo Abertura(?:\s+13º)?\s*-\s*(.+?)$/i);
  if (m) return m[1].trim().toUpperCase();
  m = desc.match(/Clientes a Receber\s*-\s*(.+?)$/i);
  if (m) return m[1].trim().toUpperCase();
  m = desc.match(/Débito:\s*(.+?)$/i);
  if (m && !m[1].toLowerCase().includes('clientes')) return m[1].trim().toUpperCase();
  return 'NAO_IDENTIFICADO';
}

async function criarConta(pai, nome) {
  const { data: ultima } = await supabase.from('chart_of_accounts').select('code').like('code', `${pai.code}.%`).order('code', { ascending: false }).limit(1).single();
  let prox = 1;
  if (ultima) {
    const p = ultima.code.split('.');
    prox = (parseInt(p[p.length - 1]) || 0) + 1;
  }
  const codigo = `${pai.code}.${prox.toString().padStart(4, '0')}`;
  const { data, error } = await supabase.from('chart_of_accounts').insert({
    code: codigo, name: nome.substring(0, 100), account_type: 'ATIVO', nature: 'DEVEDORA',
    parent_id: pai.id, level: 5, is_analytical: true, is_synthetic: false, is_active: true, accepts_entries: true
  }).select().single();
  if (error) { console.log(`   ⚠️ ${codigo}: ${error.message}`); return null; }
  return data;
}

async function razao(periodo) {
  console.log('\n\n' + '═'.repeat(80));
  console.log('📚 RAZÃO CONTÁBIL - CLIENTES');
  console.log('═'.repeat(80));

  const [ano, mes] = periodo.split('-');
  const ini = `${ano}-${mes}-01`;
  const fim = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0];
  console.log(`\n   Período: ${ini} a ${fim}`);

  const { data: contas } = await supabase.from('chart_of_accounts').select('id, code, name').like('code', '1.1.2.01.%').eq('is_analytical', true).order('code');
  if (!contas?.length) { console.log('   Nenhuma conta.'); return; }

  // Buscar todos os lançamentos de todas as contas de uma vez
  const accountIds = contas.map(c => c.id);
  const { data: todasLinhas } = await supabase
    .from('accounting_entry_lines')
    .select('account_id, debit, credit, accounting_entries!inner(entry_date)')
    .in('account_id', accountIds);

  // Agrupar por conta
  const porConta = {};
  for (const l of todasLinhas || []) {
    if (!porConta[l.account_id]) porConta[l.account_id] = { ant: 0, d: 0, c: 0 };
    const entryDate = l.accounting_entries?.entry_date;
    if (entryDate < ini) {
      porConta[l.account_id].ant += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
    } else if (entryDate >= ini && entryDate <= fim) {
      porConta[l.account_id].d += parseFloat(l.debit) || 0;
      porConta[l.account_id].c += parseFloat(l.credit) || 0;
    }
  }

  console.log(`   ${contas.length} contas\n`);
  console.log('   ' + '─'.repeat(95));
  console.log('   Código          | Nome                                     | Saldo Ant.    | Débitos       | Créditos      | Saldo Final');
  console.log('   ' + '─'.repeat(95));

  let tA = 0, tD = 0, tC = 0, tF = 0;
  for (const conta of contas.slice(0, 30)) {
    const mov = porConta[conta.id] || { ant: 0, d: 0, c: 0 };
    const sF = mov.ant + mov.d - mov.c;
    if (mov.ant !== 0 || mov.d !== 0 || mov.c !== 0) {
      tA += mov.ant; tD += mov.d; tC += mov.c; tF += sF;
      const f = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
      console.log(`   ${conta.code.padEnd(16)} | ${conta.name.substring(0, 40).padEnd(40)} | ${f(mov.ant)} | ${f(mov.d)} | ${f(mov.c)} | ${f(sF)}`);
    }
  }

  console.log('   ' + '─'.repeat(95));
  const f = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
  console.log(`   ${'TOTAL'.padEnd(16)} | ${''.padEnd(40)} | ${f(tA)} | ${f(tD)} | ${f(tC)} | ${f(tF)}`);
  console.log('   ' + '─'.repeat(95));
}

main().catch(console.error);
