/**
 * DR. CÍCERO - RECLASSIFICAÇÃO AUTOMÁTICA v3
 *
 * Versão que lida com linhas órfãs (entries deletados) e extrai
 * cliente da descrição da linha.
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

async function main() {
  console.log('═'.repeat(80));
  console.log(`🤖 DR. CÍCERO - RECLASSIFICAÇÃO v3 (com órfãos)`);
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

  // 2. Buscar TODAS as linhas
  console.log('\n   Buscando lançamentos...');
  let linhas = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('accounting_entry_lines')
      .select('id, entry_id, debit, credit, description')
      .eq('account_id', contaSintetica.id)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    linhas.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`   ${linhas.length} lançamentos encontrados`);

  if (linhas.length === 0) {
    console.log('\n✅ Nenhum lançamento na sintética. Já está correto!');
    return;
  }

  // 3. Buscar contas analíticas existentes
  const { data: analiticas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .eq('is_analytical', true);

  console.log(`   ${analiticas?.length || 0} contas analíticas existentes`);

  // Mapear por nome normalizado
  const mapaContas = {};
  for (const c of analiticas || []) {
    // Remover prefixo "Cliente: " se existir
    const nome = c.name.replace(/^Cliente:\s*/i, '');
    mapaContas[normalizar(nome)] = c;
  }

  // 4. Processar cada linha extraindo cliente da description
  console.log('\n   Processando lançamentos...');
  const reclassificacoes = [];
  const naoIdentificados = [];
  const contasParaCriar = new Map();

  for (const linha of linhas) {
    const clienteNome = extrairCliente(linha.description || '');

    if (clienteNome && clienteNome !== 'NAO_IDENTIFICADO') {
      const norm = normalizar(clienteNome);
      let conta = mapaContas[norm];

      if (!conta && !contasParaCriar.has(norm)) {
        contasParaCriar.set(norm, { nome: clienteNome });
      }

      reclassificacoes.push({
        linha_id: linha.id,
        cliente: clienteNome,
        norm,
        conta,
        d: linha.debit,
        c: linha.credit
      });
    } else {
      naoIdentificados.push({
        linha_id: linha.id,
        desc: (linha.description || '').substring(0, 70),
        d: linha.debit,
        c: linha.credit
      });
    }
  }

  // 5. Mostrar resultados
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 RESULTADO DA ANÁLISE');
  console.log('═'.repeat(80));

  console.log(`\n✅ Identificados: ${reclassificacoes.length}`);
  console.log(`❌ Não identificados: ${naoIdentificados.length}`);
  console.log(`🆕 Contas a criar: ${contasParaCriar.size}`);

  let totalD = 0, totalC = 0;
  reclassificacoes.forEach(r => { totalD += parseFloat(r.d) || 0; totalC += parseFloat(r.c) || 0; });
  console.log('\n📊 VALORES A RECLASSIFICAR:');
  console.log(`   Débitos: R$ ${totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Créditos: R$ ${totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Mostrar alguns não identificados
  if (naoIdentificados.length > 0) {
    console.log('\n📋 AMOSTRA NÃO IDENTIFICADOS:');
    for (const ni of naoIdentificados.slice(0, 15)) {
      console.log(`   D:${ni.d} C:${ni.c} | ${ni.desc}`);
    }
  }

  // Mostrar contas a criar
  if (contasParaCriar.size > 0 && contasParaCriar.size <= 50) {
    console.log('\n📋 CONTAS A CRIAR:');
    let i = 0;
    for (const [norm, info] of contasParaCriar) {
      if (i++ >= 20) { console.log('   ...'); break; }
      console.log(`   ${info.nome}`);
    }
  }

  // 6. Aplicar se modo aplicar
  if (MODO === 'aplicar') {
    console.log('\n\n' + '═'.repeat(80));
    console.log('🔄 APLICANDO...');
    console.log('═'.repeat(80));

    // Criar contas novas
    console.log(`\n   Criando ${contasParaCriar.size} contas...`);
    for (const [norm, info] of contasParaCriar) {
      const nova = await criarConta(contaSintetica, info.nome);
      if (nova) {
        mapaContas[norm] = nova;
      }
    }
    console.log('   Contas criadas.');

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

      if ((ok + err) % 500 === 0) console.log(`   ${ok + err}/${reclassificacoes.length}...`);
    }

    console.log(`\n   ✅ OK: ${ok}`);
    console.log(`   ❌ Erros: ${err}`);

    const { count } = await supabase.from('accounting_entry_lines').select('id', { count: 'exact', head: true }).eq('account_id', contaSintetica.id);
    console.log(`\n📊 Restantes na sintética: ${count || 0}`);
  } else {
    console.log('\n\n' + '═'.repeat(80));
    console.log('ℹ️  SIMULAÇÃO - Nenhuma alteração');
    console.log('═'.repeat(80));
    console.log('\nPara aplicar: node scripts/dr_cicero_reclassificacao_v3.mjs aplicar');
  }

  // Razão
  await razao(PERIODO);
}

function normalizar(s) {
  return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '').substring(0, 100);
}

function extrairCliente(desc) {
  if (!desc) return 'NAO_IDENTIFICADO';

  // Padrão: "C - Clientes a Receber - NOME_CLIENTE"
  let m = desc.match(/Clientes a Receber\s*-\s*(.+?)$/i);
  if (m) return limpar(m[1]);

  // Padrão: "Débito: NOME_CLIENTE"
  m = desc.match(/Débito:\s*(.+?)$/i);
  if (m && !m[1].toLowerCase().includes('clientes')) return limpar(m[1]);

  // Padrão: "Crédito: NOME_CLIENTE"
  m = desc.match(/Crédito:\s*(.+?)$/i);
  if (m && !m[1].toLowerCase().includes('clientes')) return limpar(m[1]);

  // Padrão: "D - NOME" ou "C - NOME" (sem "Clientes a Receber")
  m = desc.match(/^[DC]\s*-\s*(.+?)$/i);
  if (m && !m[1].toLowerCase().includes('clientes')) return limpar(m[1]);

  // Padrão: "Receita Honorarios: NOME"
  m = desc.match(/Receita Honorarios:\s*(.+?)(?:\s*-\s*COB|\s*$)/i);
  if (m) return limpar(m[1]);

  // Padrão: "Recebimento NOME - COB"
  m = desc.match(/Recebimento\s+(.+?)\s*-\s*COB/i);
  if (m) return limpar(m[1]);

  // Padrão: "Saldo Abertura - NOME"
  m = desc.match(/Saldo Abertura(?:\s+13º)?\s*-\s*(.+?)$/i);
  if (m) return limpar(m[1]);

  return 'NAO_IDENTIFICADO';
}

function limpar(s) {
  return s.replace(/^\s*-\s*/, '').replace(/\s+/g, ' ').trim().toUpperCase();
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

  // Buscar todos os lançamentos de uma vez
  const accountIds = contas.map(c => c.id);
  let todasLinhas = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('accounting_entry_lines')
      .select('account_id, debit, credit, accounting_entries(entry_date)')
      .in('account_id', accountIds)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    todasLinhas.push(...data);
    if (data.length < 1000) break;
    page++;
  }

  // Agrupar por conta
  const porConta = {};
  for (const l of todasLinhas) {
    if (!porConta[l.account_id]) porConta[l.account_id] = { ant: 0, d: 0, c: 0 };
    const entryDate = l.accounting_entries?.entry_date;
    if (!entryDate) continue;
    if (entryDate < ini) {
      porConta[l.account_id].ant += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
    } else if (entryDate >= ini && entryDate <= fim) {
      porConta[l.account_id].d += parseFloat(l.debit) || 0;
      porConta[l.account_id].c += parseFloat(l.credit) || 0;
    }
  }

  console.log(`   ${contas.length} contas, ${todasLinhas.length} lançamentos\n`);
  console.log('   ' + '─'.repeat(95));
  console.log('   Código          | Nome                                     | Saldo Ant.    | Débitos       | Créditos      | Saldo Final');
  console.log('   ' + '─'.repeat(95));

  let tA = 0, tD = 0, tC = 0, tF = 0;
  let contasMostradas = 0;
  for (const conta of contas) {
    const mov = porConta[conta.id] || { ant: 0, d: 0, c: 0 };
    const sF = mov.ant + mov.d - mov.c;
    if (mov.ant !== 0 || mov.d !== 0 || mov.c !== 0) {
      tA += mov.ant; tD += mov.d; tC += mov.c; tF += sF;
      if (contasMostradas < 30) {
        const f = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
        console.log(`   ${conta.code.padEnd(16)} | ${conta.name.substring(0, 40).padEnd(40)} | ${f(mov.ant)} | ${f(mov.d)} | ${f(mov.c)} | ${f(sF)}`);
        contasMostradas++;
      }
    }
  }

  if (contasMostradas === 30) console.log('   ... e mais contas');

  console.log('   ' + '─'.repeat(95));
  const f = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(13);
  console.log(`   ${'TOTAL'.padEnd(16)} | ${''.padEnd(40)} | ${f(tA)} | ${f(tD)} | ${f(tC)} | ${f(tF)}`);
  console.log('   ' + '─'.repeat(95));
}

main().catch(console.error);
