// scripts/correcao_contabil/19_limpar_2025_2026.mjs
// Apaga todos os saldos de abertura de 2025 e 2026
// Mantém apenas os saldos de 2024 (saldo de abertura real)

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function formatMoney(valor) {
  return 'R$ ' + (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function limpar2025e2026() {
  console.log('='.repeat(80));
  console.log('LIMPEZA DE SALDOS 2025 E 2026');
  console.log('Mantendo apenas saldos de 2024 (abertura)');
  console.log('='.repeat(80));

  // 1. Buscar todos os saldos
  const { data: todosSaldos, error } = await supabase
    .from('client_opening_balance')
    .select('*')
    .order('competence');

  if (error) {
    console.error('Erro ao buscar saldos:', error);
    return;
  }

  console.log('\nTotal de saldos no banco:', todosSaldos?.length || 0);

  // 2. Separar por ano
  const saldos2024 = [];
  const saldos2025 = [];
  const saldos2026 = [];
  const saldosOutros = [];

  for (const s of todosSaldos || []) {
    const comp = s.competence || '';
    // Formato: MM/YYYY
    const ano = comp.split('/')[1];

    if (ano === '2024') {
      saldos2024.push(s);
    } else if (ano === '2025') {
      saldos2025.push(s);
    } else if (ano === '2026') {
      saldos2026.push(s);
    } else {
      saldosOutros.push(s);
    }
  }

  // Calcular totais
  const total2024 = saldos2024.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const total2025 = saldos2025.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const total2026 = saldos2026.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const totalOutros = saldosOutros.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);

  console.log('\n' + '-'.repeat(80));
  console.log('DISTRIBUIÇÃO POR ANO:');
  console.log('-'.repeat(80));
  console.log('  2024:', saldos2024.length, 'registros |', formatMoney(total2024), '| MANTER');
  console.log('  2025:', saldos2025.length, 'registros |', formatMoney(total2025), '| APAGAR');
  console.log('  2026:', saldos2026.length, 'registros |', formatMoney(total2026), '| APAGAR');
  if (saldosOutros.length > 0) {
    console.log('  Outros:', saldosOutros.length, 'registros |', formatMoney(totalOutros));
  }

  // 3. IDs para deletar (2025 + 2026)
  const idsParaDeletar = [
    ...saldos2025.map(s => s.id),
    ...saldos2026.map(s => s.id)
  ];

  console.log('\n' + '-'.repeat(80));
  console.log('AÇÃO: Deletando', idsParaDeletar.length, 'registros de 2025 e 2026');
  console.log('-'.repeat(80));

  if (idsParaDeletar.length === 0) {
    console.log('Nenhum registro para deletar.');
    return;
  }

  // 4. Deletar em lotes
  let deletados = 0;
  for (let i = 0; i < idsParaDeletar.length; i += 100) {
    const lote = idsParaDeletar.slice(i, i + 100);
    const { count, error: errDel } = await supabase
      .from('client_opening_balance')
      .delete({ count: 'exact' })
      .in('id', lote);

    if (errDel) {
      console.error('Erro ao deletar lote:', errDel);
    } else {
      deletados += count || 0;
      console.log('  Lote', Math.floor(i / 100) + 1, '- Deletados:', count);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESULTADO:');
  console.log('='.repeat(80));
  console.log('  Total deletado:', deletados);
  console.log('  Registros mantidos (2024):', saldos2024.length);
  console.log('  Valor mantido:', formatMoney(total2024));

  // 5. Verificar resultado
  const { data: saldosRestantes } = await supabase
    .from('client_opening_balance')
    .select('*');

  console.log('\n  Verificação - Registros restantes:', saldosRestantes?.length || 0);

  // Mostrar resumo dos saldos 2024
  console.log('\n' + '-'.repeat(80));
  console.log('SALDOS 2024 MANTIDOS:');
  console.log('-'.repeat(80));

  // Agrupar por competência
  const porCompetencia = {};
  for (const s of saldos2024) {
    const comp = s.competence;
    if (!porCompetencia[comp]) {
      porCompetencia[comp] = { qtd: 0, total: 0 };
    }
    porCompetencia[comp].qtd++;
    porCompetencia[comp].total += parseFloat(s.amount) || 0;
  }

  for (const [comp, dados] of Object.entries(porCompetencia).sort()) {
    console.log('  ', comp, ':', dados.qtd, 'clientes |', formatMoney(dados.total));
  }

  console.log('\n' + '='.repeat(80));
}

limpar2025e2026().catch(console.error);
