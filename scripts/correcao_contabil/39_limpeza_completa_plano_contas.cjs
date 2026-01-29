// scripts/correcao_contabil/39_limpeza_completa_plano_contas.cjs
// LIMPEZA COMPLETA DO PLANO DE CONTAS - Baseado no relatório de duplicatas
//
// USO:
//   node scripts/correcao_contabil/39_limpeza_completa_plano_contas.cjs          # Simulação
//   node scripts/correcao_contabil/39_limpeza_completa_plano_contas.cjs --execute # Execução real

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTE = process.argv.includes('--execute');

// Mapeamento de contas duplicadas para mesclar
// Formato: { manter: 'codigo', desativar: ['codigo1', 'codigo2', ...] }
const MAPEAMENTO_DUPLICATAS = [
  // ELETROSOL
  { manter: '1.1.2.01.0083', desativar: ['1.1.2.01.0088', '1.1.2.01.0271', '1.1.2.01.0335', '1.1.2.01.0363'], nome: 'ELETROSOL' },
  // D'ANGE
  { manter: '1.1.2.01.0070', desativar: ['1.1.2.01.0082', '1.1.2.01.0248', '1.1.2.01.0263', '1.1.2.01.0386', '1.1.2.01.0388', '1.1.2.01.0398'], nome: 'D\'ANGE' },
  // RAMAYOLE
  { manter: '1.1.2.01.0066', desativar: ['1.1.2.01.0238', '1.1.2.01.0366', '1.1.2.01.10001'], nome: 'RAMAYOLE' },
  // UNICAIXAS
  { manter: '1.1.2.01.0101', desativar: ['1.1.2.01.0307', '1.1.2.01.0361', '1.1.2.01.10007'], nome: 'UNICAIXAS' },
  // COVAS PINTURAS
  { manter: '1.1.2.01.0080', desativar: ['1.1.2.01.0260', '1.1.2.01.0350'], nome: 'COVAS' },
  // PM ADMINISTRAÇÃO
  { manter: '1.1.2.01.0052', desativar: ['1.1.2.01.0208', '1.1.2.01.0360', '1.1.2.01.10004'], nome: 'PM ADMINISTRAÇÃO' },
  // FORMA COMUNICAÇÃO
  { manter: '1.1.2.01.0012', desativar: ['1.1.2.01.0118', '1.1.2.01.0409', '1.1.2.01.10000'], nome: 'FORMA COMUNICAÇÃO' },
  // HOLDINGS BCS
  { manter: '1.1.2.01.0013', desativar: ['1.1.2.01.0119', '1.1.2.01.0356'], nome: 'HOLDINGS BCS' },
  // KORSICA
  { manter: '1.1.2.01.0093', desativar: ['1.1.2.01.0328', '1.1.2.01.0357', '1.1.2.01.0410'], nome: 'KORSICA' },
];

async function limparPlanoContas() {
  console.log('='.repeat(100));
  console.log(EXECUTE ? '🔴 EXECUTANDO LIMPEZA COMPLETA DO PLANO DE CONTAS' : '🔵 SIMULANDO LIMPEZA COMPLETA DO PLANO DE CONTAS');
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

  // Criar índice por código
  const contasPorCodigo = {};
  contas.forEach(c => { contasPorCodigo[c.code] = c; });

  // Buscar contas que têm lançamentos
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('account_id, debit, credit');

  const lancamentosPorConta = {};
  linhas?.forEach(l => {
    if (!lancamentosPorConta[l.account_id]) {
      lancamentosPorConta[l.account_id] = { count: 0, debitos: 0, creditos: 0 };
    }
    lancamentosPorConta[l.account_id].count++;
    lancamentosPorConta[l.account_id].debitos += parseFloat(l.debit) || 0;
    lancamentosPorConta[l.account_id].creditos += parseFloat(l.credit) || 0;
  });

  const idsComLancamentos = new Set(Object.keys(lancamentosPorConta));

  let stats = {
    desativadas: 0,
    lancamentosTransferidos: 0,
    erros: 0
  };

  // ============================================
  // FASE 1: DESATIVAR CONTAS OBSOLETAS
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('FASE 1: DESATIVAR CONTAS OBSOLETAS');
  console.log('='.repeat(80));

  const contasObsoletas = contas.filter(c =>
    c.name?.includes('OBSOLETO') ||
    c.name?.includes('obsoleto')
  );

  for (const conta of contasObsoletas) {
    const temLanc = idsComLancamentos.has(conta.id);
    if (temLanc) {
      console.log(`  ⚠️  ${conta.code} ${conta.name?.substring(0, 40)} → TEM LANÇAMENTOS`);
      stats.erros++;
    } else {
      console.log(`  ✓ ${conta.code} ${conta.name?.substring(0, 40)} → DESATIVAR`);
      if (EXECUTE) {
        await supabase.from('chart_of_accounts').update({ is_active: false }).eq('id', conta.id);
      }
      stats.desativadas++;
    }
  }

  // ============================================
  // FASE 2: DESATIVAR PL DUPLICADO (GRUPO 2.3)
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('FASE 2: DESATIVAR PL DUPLICADO (GRUPO 2.3)');
  console.log('(O PL correto está no grupo 5 conforme NBC TG 26)');
  console.log('='.repeat(80));

  const contasPL_2_3 = contas.filter(c => c.code?.startsWith('2.3'));
  for (const conta of contasPL_2_3) {
    const temLanc = idsComLancamentos.has(conta.id);
    if (temLanc) {
      console.log(`  ⚠️  ${conta.code} ${conta.name?.substring(0, 40)} → TEM LANÇAMENTOS (reclassificar!)`);
      stats.erros++;
    } else {
      console.log(`  ✓ ${conta.code} ${conta.name?.substring(0, 40)} → DESATIVAR`);
      if (EXECUTE) {
        await supabase.from('chart_of_accounts').update({ is_active: false }).eq('id', conta.id);
      }
      stats.desativadas++;
    }
  }

  // ============================================
  // FASE 3: DESATIVAR CONTA Dr. Cicero MAL POSICIONADA
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('FASE 3: DESATIVAR CONTA Dr. Cicero MAL POSICIONADA');
  console.log('='.repeat(80));

  const conta5101 = contasPorCodigo['5.1.01.0001'];
  if (conta5101) {
    const temLanc = idsComLancamentos.has(conta5101.id);
    if (temLanc) {
      console.log(`  ⚠️  ${conta5101.code} CUSTOS_PESSOAL → TEM LANÇAMENTOS (reclassificar para 4.2.xx)`);
      stats.erros++;
    } else {
      console.log(`  ✓ ${conta5101.code} CUSTOS_PESSOAL → DESATIVAR (conta no grupo errado)`);
      if (EXECUTE) {
        await supabase.from('chart_of_accounts').update({ is_active: false }).eq('id', conta5101.id);
      }
      stats.desativadas++;
    }
  }

  // ============================================
  // FASE 4: DESATIVAR TODAS AS CONTAS [CONSOLIDADO]
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('FASE 4: DESATIVAR CONTAS [CONSOLIDADO]');
  console.log('='.repeat(80));

  const contasConsolidado = contas.filter(c => c.name?.includes('[CONSOLIDADO]'));
  console.log(`Total de contas [CONSOLIDADO]: ${contasConsolidado.length}`);

  let consolidadoComLancamentos = 0;
  let consolidadoSemLancamentos = 0;

  for (const conta of contasConsolidado) {
    const temLanc = idsComLancamentos.has(conta.id);
    if (temLanc) {
      consolidadoComLancamentos++;
      // Encontrar a conta original para transferir
      const nomeOriginal = conta.name.replace('[CONSOLIDADO]', '').trim();
      const contaOriginal = contas.find(c =>
        !c.name?.includes('[CONSOLIDADO]') &&
        c.code !== conta.code &&
        c.name?.toUpperCase().includes(nomeOriginal.toUpperCase().substring(0, 15))
      );

      if (contaOriginal) {
        console.log(`  📦 ${conta.code} → TRANSFERIR para ${contaOriginal.code}`);
        if (EXECUTE) {
          // Transferir lançamentos
          const { error } = await supabase
            .from('accounting_entry_lines')
            .update({ account_id: contaOriginal.id })
            .eq('account_id', conta.id);

          if (!error) {
            stats.lancamentosTransferidos += lancamentosPorConta[conta.id]?.count || 0;
            // Desativar a conta consolidada
            await supabase.from('chart_of_accounts').update({ is_active: false }).eq('id', conta.id);
            stats.desativadas++;
          } else {
            console.log(`    ERRO: ${error.message}`);
            stats.erros++;
          }
        }
      } else {
        console.log(`  ⚠️  ${conta.code} → NÃO encontrou conta original para transferir`);
        stats.erros++;
      }
    } else {
      consolidadoSemLancamentos++;
      if (EXECUTE) {
        await supabase.from('chart_of_accounts').update({ is_active: false }).eq('id', conta.id);
      }
      stats.desativadas++;
    }
  }

  console.log(`\n  Com lançamentos (transferir): ${consolidadoComLancamentos}`);
  console.log(`  Sem lançamentos (desativar): ${consolidadoSemLancamentos}`);

  // ============================================
  // FASE 5: MESCLAR DUPLICATAS ESPECÍFICAS
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('FASE 5: MESCLAR DUPLICATAS ESPECÍFICAS');
  console.log('='.repeat(80));

  for (const grupo of MAPEAMENTO_DUPLICATAS) {
    console.log(`\n  📁 ${grupo.nome}`);
    console.log(`     Manter: ${grupo.manter}`);

    const contaManter = contasPorCodigo[grupo.manter];
    if (!contaManter) {
      console.log(`     ⚠️  Conta ${grupo.manter} não encontrada!`);
      continue;
    }

    for (const codigoDesativar of grupo.desativar) {
      const contaDesativar = contasPorCodigo[codigoDesativar];
      if (!contaDesativar) continue;

      const temLanc = idsComLancamentos.has(contaDesativar.id);
      if (temLanc) {
        console.log(`     📦 ${codigoDesativar} → TRANSFERIR para ${grupo.manter}`);
        if (EXECUTE) {
          const { error } = await supabase
            .from('accounting_entry_lines')
            .update({ account_id: contaManter.id })
            .eq('account_id', contaDesativar.id);

          if (!error) {
            stats.lancamentosTransferidos += lancamentosPorConta[contaDesativar.id]?.count || 0;
            await supabase.from('chart_of_accounts').update({ is_active: false }).eq('id', contaDesativar.id);
            stats.desativadas++;
          } else {
            console.log(`        ERRO: ${error.message}`);
            stats.erros++;
          }
        }
      } else {
        console.log(`     ✓ ${codigoDesativar} → DESATIVAR (sem lançamentos)`);
        if (EXECUTE) {
          await supabase.from('chart_of_accounts').update({ is_active: false }).eq('id', contaDesativar.id);
        }
        stats.desativadas++;
      }
    }
  }

  // ============================================
  // FASE 6: DESATIVAR CÓDIGOS COM 5+ DÍGITOS
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('FASE 6: DESATIVAR CÓDIGOS COM 5+ DÍGITOS (OVERFLOW)');
  console.log('='.repeat(80));

  const contasOverflow = contas.filter(c => {
    if (!c.code?.startsWith('1.1.2.01.')) return false;
    const sufixo = c.code.split('1.1.2.01.')[1];
    return sufixo && sufixo.length >= 5;
  });

  console.log(`Total de contas com 5+ dígitos: ${contasOverflow.length}`);

  for (const conta of contasOverflow) {
    const temLanc = idsComLancamentos.has(conta.id);
    if (temLanc) {
      const info = lancamentosPorConta[conta.id];
      const saldo = info.debitos - info.creditos;
      console.log(`  ⚠️  ${conta.code} ${conta.name?.substring(0, 30)} → R$ ${saldo.toFixed(2)} (${info.count} lanç.)`);
      stats.erros++;
    } else {
      console.log(`  ✓ ${conta.code} → DESATIVAR`);
      if (EXECUTE) {
        await supabase.from('chart_of_accounts').update({ is_active: false }).eq('id', conta.id);
      }
      stats.desativadas++;
    }
  }

  // ============================================
  // RESUMO FINAL
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('RESUMO DA LIMPEZA');
  console.log('='.repeat(100));

  console.log(`
| Métrica | Quantidade |
|---------|------------|
| Contas DESATIVADAS | ${stats.desativadas} |
| Lançamentos TRANSFERIDOS | ${stats.lancamentosTransferidos} |
| Casos com ERRO/ATENÇÃO | ${stats.erros} |
`);

  if (!EXECUTE) {
    console.log('\n⚠️  NENHUMA ALTERAÇÃO FOI FEITA (modo simulação)');
    console.log('    Para executar de verdade, use:');
    console.log('    node scripts/correcao_contabil/39_limpeza_completa_plano_contas.cjs --execute\n');
  } else {
    // Verificação final
    const { data: contasAtivas } = await supabase
      .from('chart_of_accounts')
      .select('id', { count: 'exact' })
      .eq('is_active', true);

    const { data: todasLinhas } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit');

    let totalDebitos = 0;
    let totalCreditos = 0;
    todasLinhas?.forEach(l => {
      totalDebitos += parseFloat(l.debit) || 0;
      totalCreditos += parseFloat(l.credit) || 0;
    });

    console.log('\n✅ LIMPEZA CONCLUÍDA!');
    console.log(`\nEstado final:`);
    console.log(`  Contas ATIVAS: ${contasAtivas?.length || 0}`);
    console.log(`\nVerificação da Equação Contábil:`);
    console.log(`  Total Débitos:  R$ ${totalDebitos.toFixed(2)}`);
    console.log(`  Total Créditos: R$ ${totalCreditos.toFixed(2)}`);
    console.log(`  Diferença:      R$ ${Math.abs(totalDebitos - totalCreditos).toFixed(2)}`);
    console.log(`  Status: ${Math.abs(totalDebitos - totalCreditos) < 0.01 ? '✅ OK' : '⚠️ ATENÇÃO'}`);
  }
}

limparPlanoContas().catch(console.error);
