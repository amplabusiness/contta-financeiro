import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('📊 ANÁLISE DETALHADA DAS LINHAS NAS CONTAS 3 E 4\n');

  // Buscar contas do grupo 3 e 4
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, type, nature');

  const contasGrupo3 = contas?.filter(c => c.code.startsWith('3.')) || [];
  const contasGrupo4 = contas?.filter(c => c.code.startsWith('4.')) || [];

  console.log(`Contas grupo 3 (Receitas): ${contasGrupo3.length}`);
  console.log(`Contas grupo 4 (Despesas): ${contasGrupo4.length}`);

  // Buscar TODAS as linhas
  const { data: todasLinhas, error } = await supabase
    .from('accounting_entry_lines')
    .select('id, entry_id, account_id, debit, credit, description');

  if (error) {
    console.log('Erro:', error);
    return;
  }

  console.log(`\nTotal de linhas no sistema: ${todasLinhas?.length}`);

  // Buscar todos os entries
  const { data: todosEntries } = await supabase
    .from('accounting_entries')
    .select('id, source_type, entry_date, description');

  const mapEntries = {};
  todosEntries?.forEach(e => mapEntries[e.id] = e);

  // Analisar linhas do grupo 3
  const idsGrupo3 = contasGrupo3.map(c => c.id);
  const idsGrupo4 = contasGrupo4.map(c => c.id);

  const linhasG3 = todasLinhas?.filter(l => idsGrupo3.includes(l.account_id)) || [];
  const linhasG4 = todasLinhas?.filter(l => idsGrupo4.includes(l.account_id)) || [];

  console.log(`\nLinhas em contas grupo 3: ${linhasG3.length}`);
  console.log(`Linhas em contas grupo 4: ${linhasG4.length}`);

  // Agrupar por source_type
  console.log('\n\n📋 LINHAS GRUPO 3 (RECEITAS) POR SOURCE_TYPE:');
  console.log('='.repeat(70));

  const porTipoG3 = {};
  linhasG3.forEach(l => {
    const entry = mapEntries[l.entry_id];
    const tipo = entry?.source_type || 'null';
    if (!porTipoG3[tipo]) porTipoG3[tipo] = { linhas: 0, debitos: 0, creditos: 0, exemplos: [] };
    porTipoG3[tipo].linhas++;
    porTipoG3[tipo].debitos += parseFloat(l.debit) || 0;
    porTipoG3[tipo].creditos += parseFloat(l.credit) || 0;
    if (porTipoG3[tipo].exemplos.length < 3) {
      porTipoG3[tipo].exemplos.push({
        data: entry?.entry_date,
        desc: entry?.description?.substring(0, 50),
        d: l.debit,
        c: l.credit
      });
    }
  });

  Object.entries(porTipoG3).sort((a, b) => b[1].linhas - a[1].linhas).forEach(([tipo, vals]) => {
    const saldo = vals.creditos - vals.debitos;
    console.log(`\n${tipo}:`);
    console.log(`   ${vals.linhas} linhas | D: R$ ${vals.debitos.toLocaleString('pt-BR')} | C: R$ ${vals.creditos.toLocaleString('pt-BR')} | Saldo: R$ ${saldo.toLocaleString('pt-BR')}`);
    console.log('   Exemplos:');
    vals.exemplos.forEach(ex => {
      console.log(`      ${ex.data} | D: ${ex.d} C: ${ex.c} | ${ex.desc}`);
    });
  });

  // Agrupar por source_type para grupo 4
  console.log('\n\n📋 LINHAS GRUPO 4 (DESPESAS) POR SOURCE_TYPE:');
  console.log('='.repeat(70));

  const porTipoG4 = {};
  linhasG4.forEach(l => {
    const entry = mapEntries[l.entry_id];
    const tipo = entry?.source_type || 'null';
    if (!porTipoG4[tipo]) porTipoG4[tipo] = { linhas: 0, debitos: 0, creditos: 0, exemplos: [] };
    porTipoG4[tipo].linhas++;
    porTipoG4[tipo].debitos += parseFloat(l.debit) || 0;
    porTipoG4[tipo].creditos += parseFloat(l.credit) || 0;
    if (porTipoG4[tipo].exemplos.length < 3) {
      porTipoG4[tipo].exemplos.push({
        data: entry?.entry_date,
        desc: entry?.description?.substring(0, 50),
        d: l.debit,
        c: l.credit
      });
    }
  });

  Object.entries(porTipoG4).sort((a, b) => b[1].linhas - a[1].linhas).forEach(([tipo, vals]) => {
    const saldo = vals.debitos - vals.creditos; // Despesas são devedoras
    console.log(`\n${tipo}:`);
    console.log(`   ${vals.linhas} linhas | D: R$ ${vals.debitos.toLocaleString('pt-BR')} | C: R$ ${vals.creditos.toLocaleString('pt-BR')} | Saldo: R$ ${saldo.toLocaleString('pt-BR')}`);
    console.log('   Exemplos:');
    vals.exemplos.forEach(ex => {
      console.log(`      ${ex.data} | D: ${ex.d} C: ${ex.c} | ${ex.desc}`);
    });
  });

  // Resumo final
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 RESUMO PARA DRE:');
  console.log('='.repeat(70));

  let totalReceitas = 0;
  linhasG3.forEach(l => {
    totalReceitas += (parseFloat(l.credit) || 0) - (parseFloat(l.debit) || 0);
  });

  let totalDespesas = 0;
  linhasG4.forEach(l => {
    totalDespesas += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
  });

  console.log(`Total Receitas (Grupo 3): R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Total Despesas (Grupo 4): R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`Resultado: R$ ${(totalReceitas - totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

check().catch(console.error);
