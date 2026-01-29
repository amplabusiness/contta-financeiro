import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('🔍 VERIFICANDO DRE JANEIRO/2025\n');

  // 1. Contar lançamentos por source_type
  const { data: lancamentos } = await supabase
    .from('accounting_entries')
    .select('id, source_type, description')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const porTipo = {};
  lancamentos?.forEach(e => {
    const tipo = e.source_type || 'null';
    porTipo[tipo] = (porTipo[tipo] || 0) + 1;
  });

  console.log('📊 Lançamentos por source_type em Jan/2025:');
  Object.entries(porTipo).sort((a, b) => b[1] - a[1]).forEach(([tipo, qtd]) => {
    console.log(`   ${tipo}: ${qtd}`);
  });

  // 2. Buscar contas de receita (tipo RECEITA ou código começando com 3)
  const { data: contasReceita } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '3.%');

  console.log('\n📋 Contas de Receita (3.x):');
  contasReceita?.forEach(c => console.log(`   ${c.code} - ${c.name}`));

  const idsReceita = contasReceita?.map(c => c.id) || [];

  // 3. Buscar linhas com contas de receita em Janeiro
  const { data: linhasReceita } = await supabase
    .from('accounting_entry_lines')
    .select('id, debit, credit, description, account_id, entry_id')
    .in('account_id', idsReceita);

  // Filtrar apenas Janeiro
  const { data: entriesJan } = await supabase
    .from('accounting_entries')
    .select('id')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const idsJan = new Set(entriesJan?.map(e => e.id) || []);
  const linhasJan = linhasReceita?.filter(l => idsJan.has(l.entry_id)) || [];

  let totalCredito = 0;
  let totalDebito = 0;

  linhasJan.forEach(l => {
    totalCredito += parseFloat(l.credit) || 0;
    totalDebito += parseFloat(l.debit) || 0;
  });

  console.log('\n💰 RECEITAS JANEIRO/2025:');
  console.log(`   Linhas encontradas: ${linhasJan.length}`);
  console.log(`   Total Créditos: R$ ${totalCredito.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Total Débitos: R$ ${totalDebito.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Receita Líquida (C-D): R$ ${(totalCredito - totalDebito).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 4. Verificar lançamentos boleto_sicredi
  const { data: boletoEntries } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('source_type', 'boleto_sicredi')
    .gte('entry_date', '2025-01-01')
    .lte('entry_date', '2025-01-31');

  const idsBoleto = new Set(boletoEntries?.map(e => e.id) || []);

  // Linhas de boleto que afetam receita
  const linhasBoletoReceita = linhasJan.filter(l => idsBoleto.has(l.entry_id));

  let boletoCredito = 0;
  let boletoDebito = 0;
  linhasBoletoReceita.forEach(l => {
    boletoCredito += parseFloat(l.credit) || 0;
    boletoDebito += parseFloat(l.debit) || 0;
  });

  console.log('\n🎫 BOLETOS SICREDI afetando Receita:');
  console.log(`   Linhas: ${linhasBoletoReceita.length}`);
  console.log(`   Créditos: R$ ${boletoCredito.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`   Débitos: R$ ${boletoDebito.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 5. Verificar se boletos estão usando conta errada
  console.log('\n🔍 VERIFICANDO CONTAS USADAS NOS BOLETOS:');

  const { data: linhasBoleto } = await supabase
    .from('accounting_entry_lines')
    .select('account_id, debit, credit')
    .in('entry_id', Array.from(idsBoleto));

  const porConta = {};
  linhasBoleto?.forEach(l => {
    if (!porConta[l.account_id]) porConta[l.account_id] = { d: 0, c: 0 };
    porConta[l.account_id].d += parseFloat(l.debit) || 0;
    porConta[l.account_id].c += parseFloat(l.credit) || 0;
  });

  // Buscar nomes das contas
  const { data: todasContas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name');

  const mapContas = {};
  todasContas?.forEach(c => mapContas[c.id] = `${c.code} - ${c.name}`);

  console.log('   Conta                                      | Débitos        | Créditos');
  console.log('   ' + '-'.repeat(80));
  Object.entries(porConta).forEach(([id, vals]) => {
    const nome = (mapContas[id] || id).substring(0, 40).padEnd(42);
    const d = ('R$ ' + vals.d.toLocaleString('pt-BR', {minimumFractionDigits: 2})).padStart(14);
    const c = ('R$ ' + vals.c.toLocaleString('pt-BR', {minimumFractionDigits: 2})).padStart(14);
    console.log(`   ${nome} | ${d} | ${c}`);
  });
}

check().catch(console.error);
