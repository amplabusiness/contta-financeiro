// scripts/correcao_contabil/38_limpar_plano_contas.cjs
// Limpeza COMPLETA do Plano de Contas
//
// USO:
//   node scripts/correcao_contabil/38_limpar_plano_contas.cjs          # Simulação
//   node scripts/correcao_contabil/38_limpar_plano_contas.cjs --execute # Execução real

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTE = process.argv.includes('--execute');

async function limparPlanoContas() {
  console.log('='.repeat(100));
  console.log(EXECUTE ? '🔴 EXECUTANDO LIMPEZA DO PLANO DE CONTAS' : '🔵 SIMULANDO LIMPEZA DO PLANO DE CONTAS');
  console.log('='.repeat(100));

  if (!EXECUTE) {
    console.log('\n⚠️  MODO SIMULAÇÃO - Nenhuma alteração será feita');
    console.log('    Para executar de verdade, use: --execute\n');
  }

  // Buscar todas as contas
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .order('code');

  // Buscar contas que têm lançamentos
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('account_id');

  const idsComLancamentos = new Set(linhas?.map(l => l.account_id) || []);

  let totalDesativadas = 0;
  let totalMescladas = 0;
  let totalCorrigidas = 0;

  // ============================================
  // 1. DESATIVAR CONTAS [CONSOLIDADO]
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('1. DESATIVAR CONTAS [CONSOLIDADO]');
  console.log('='.repeat(80));

  const contasConsolidado = contas.filter(c => c.name?.includes('[CONSOLIDADO]'));
  console.log(`Encontradas: ${contasConsolidado.length} contas`);

  for (const conta of contasConsolidado) {
    const temLancamentos = idsComLancamentos.has(conta.id);

    if (temLancamentos) {
      console.log(`  ⚠️  ${conta.code} TEM LANÇAMENTOS - verificar manualmente`);
      continue;
    }

    console.log(`  ✓ ${conta.code} - ${conta.name?.substring(0, 50)} → DESATIVAR`);

    if (EXECUTE) {
      await supabase
        .from('chart_of_accounts')
        .update({ is_active: false })
        .eq('id', conta.id);
    }
    totalDesativadas++;
  }

  // ============================================
  // 2. DESATIVAR CONTAS OBSOLETAS
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('2. DESATIVAR CONTAS OBSOLETAS');
  console.log('='.repeat(80));

  const contasObsoletas = contas.filter(c =>
    c.name?.includes('OBSOLETO') ||
    c.name?.includes('obsoleto') ||
    c.name?.includes('(antigo)')
  );
  console.log(`Encontradas: ${contasObsoletas.length} contas`);

  for (const conta of contasObsoletas) {
    const temLancamentos = idsComLancamentos.has(conta.id);

    if (temLancamentos) {
      console.log(`  ⚠️  ${conta.code} TEM LANÇAMENTOS - reclassificar manualmente`);
      continue;
    }

    console.log(`  ✓ ${conta.code} - ${conta.name?.substring(0, 50)} → DESATIVAR`);

    if (EXECUTE) {
      await supabase
        .from('chart_of_accounts')
        .update({ is_active: false })
        .eq('id', conta.id);
    }
    totalDesativadas++;
  }

  // ============================================
  // 3. CORRIGIR CONTA Dr. Cicero MAL POSICIONADA
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('3. CORRIGIR CONTA Dr. Cicero: CUSTOS_PESSOAL');
  console.log('='.repeat(80));

  const contaCustosPessoal = contas.find(c => c.code === '5.1.01.0001');
  if (contaCustosPessoal) {
    console.log(`  Encontrada: ${contaCustosPessoal.code} - ${contaCustosPessoal.name}`);
    console.log(`  Problema: Está no grupo 5 (PL) mas deveria estar no grupo 4 (Despesas)`);

    const temLancamentos = idsComLancamentos.has(contaCustosPessoal.id);
    if (temLancamentos) {
      console.log(`  ⚠️  TEM LANÇAMENTOS - precisa reclassificar os lançamentos primeiro`);
    } else {
      console.log(`  ✓ Não tem lançamentos → DESATIVAR`);
      if (EXECUTE) {
        await supabase
          .from('chart_of_accounts')
          .update({ is_active: false })
          .eq('id', contaCustosPessoal.id);
      }
      totalDesativadas++;
    }
  }

  // ============================================
  // 4. DESATIVAR PL DUPLICADO (GRUPO 2.3)
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('4. DESATIVAR PL DUPLICADO (GRUPO 2.3)');
  console.log('='.repeat(80));

  const contasPL_2_3 = contas.filter(c => c.code?.startsWith('2.3'));
  console.log(`Encontradas: ${contasPL_2_3.length} contas no grupo 2.3`);
  console.log('(O PL correto está no grupo 5, conforme NBC TG 26)');

  for (const conta of contasPL_2_3) {
    const temLancamentos = idsComLancamentos.has(conta.id);

    if (temLancamentos) {
      console.log(`  ⚠️  ${conta.code} TEM LANÇAMENTOS - reclassificar para grupo 5`);
      continue;
    }

    console.log(`  ✓ ${conta.code} - ${conta.name?.substring(0, 50)} → DESATIVAR`);

    if (EXECUTE) {
      await supabase
        .from('chart_of_accounts')
        .update({ is_active: false })
        .eq('id', conta.id);
    }
    totalDesativadas++;
  }

  // ============================================
  // 5. DESATIVAR DUPLICATAS POR VARIAÇÃO DE NOME
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('5. MESCLAR DUPLICATAS POR VARIAÇÃO DE NOME');
  console.log('='.repeat(80));

  // Casos específicos identificados
  const duplicatasEspecificas = [
    // [código a manter, códigos a desativar]
    { manter: '1.1.2.01.0093', desativar: ['1.1.2.01.0328', '1.1.2.01.0357', '1.1.2.01.0410'], nome: 'KORSICA' },
    { manter: '1.1.2.01.0012', desativar: ['1.1.2.01.0118', '1.1.2.01.0409', '1.1.2.01.10000'], nome: 'FORMA COMUNICAÇÃO' },
    { manter: '1.1.2.01.0013', desativar: ['1.1.2.01.0119', '1.1.2.01.0356'], nome: 'HOLDINGS BCS' },
    { manter: '1.1.2.01.0045', desativar: ['1.1.2.01.0175', '1.1.2.01.0354'], nome: 'ANAPOLIS VISTORIAS' },
  ];

  for (const caso of duplicatasEspecificas) {
    console.log(`\n  ${caso.nome}:`);
    console.log(`    Manter: ${caso.manter}`);

    for (const codigo of caso.desativar) {
      const conta = contas.find(c => c.code === codigo);
      if (!conta) continue;

      const temLancamentos = idsComLancamentos.has(conta.id);
      if (temLancamentos) {
        console.log(`    ⚠️  ${codigo} TEM LANÇAMENTOS - precisa mesclar manualmente`);
        continue;
      }

      console.log(`    ✓ ${codigo} → DESATIVAR`);

      if (EXECUTE) {
        await supabase
          .from('chart_of_accounts')
          .update({ is_active: false })
          .eq('id', conta.id);
      }
      totalDesativadas++;
    }
  }

  // ============================================
  // 6. DESATIVAR CÓDIGOS INCONSISTENTES SEM LANÇAMENTOS
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('6. DESATIVAR CÓDIGOS INCONSISTENTES (5+ dígitos) SEM LANÇAMENTOS');
  console.log('='.repeat(80));

  const contasInconsistentes = contas.filter(c => {
    if (!c.code?.startsWith('1.1.2.01.')) return false;
    const sufixo = c.code.split('1.1.2.01.')[1];
    return sufixo && sufixo.length > 4;
  });

  console.log(`Encontradas: ${contasInconsistentes.length} contas com código > 4 dígitos`);

  for (const conta of contasInconsistentes) {
    const temLancamentos = idsComLancamentos.has(conta.id);

    if (temLancamentos) {
      console.log(`  ⚠️  ${conta.code} TEM LANÇAMENTOS - verificar manualmente`);
      continue;
    }

    console.log(`  ✓ ${conta.code} - ${conta.name?.substring(0, 40)} → DESATIVAR`);

    if (EXECUTE) {
      await supabase
        .from('chart_of_accounts')
        .update({ is_active: false })
        .eq('id', conta.id);
    }
    totalDesativadas++;
  }

  // ============================================
  // RESUMO
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('RESUMO DA LIMPEZA');
  console.log('='.repeat(100));

  console.log(`\n| Ação | Quantidade |`);
  console.log(`|------|------------|`);
  console.log(`| Contas DESATIVADAS | ${totalDesativadas} |`);
  console.log(`| Contas MESCLADAS | ${totalMescladas} |`);
  console.log(`| Contas CORRIGIDAS | ${totalCorrigidas} |`);

  if (!EXECUTE) {
    console.log('\n⚠️  NENHUMA ALTERAÇÃO FOI FEITA (modo simulação)');
    console.log('    Para executar de verdade, use:');
    console.log('    node scripts/correcao_contabil/38_limpar_plano_contas.cjs --execute');
  } else {
    console.log('\n✅ LIMPEZA CONCLUÍDA!');
  }

  // Verificar estado final
  if (EXECUTE) {
    const { data: contasAtivas } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('is_active', true);

    const { data: contasInativas } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('is_active', false);

    console.log(`\nEstado final:`);
    console.log(`  Contas ATIVAS: ${contasAtivas?.length || 0}`);
    console.log(`  Contas INATIVAS: ${contasInativas?.length || 0}`);
  }
}

limparPlanoContas().catch(console.error);
