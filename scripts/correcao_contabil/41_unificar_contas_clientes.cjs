// scripts/correcao_contabil/41_unificar_contas_clientes.cjs
// Unificar contas de clientes duplicadas e padronizar nomes
// - Remove prefixo "Cliente: "
// - Transfere lançamentos de contas duplicadas
// - Desativa contas duplicadas
//
// USO:
//   node scripts/correcao_contabil/41_unificar_contas_clientes.cjs          # Simulação
//   node scripts/correcao_contabil/41_unificar_contas_clientes.cjs --execute # Execução real

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTE = process.argv.includes('--execute');

// Normalizar nome para comparação
function normalizarNome(nome) {
  if (!nome) return '';
  return nome
    .replace(/^Cliente:\s*/i, '')
    .replace(/\[CONSOLIDADO\]\s*/gi, '')
    .toUpperCase()
    .replace(/LTDA[\.\s-]*ME$/i, 'LTDA')
    .replace(/LTDA[\.\s-]*EPP$/i, 'LTDA')
    .replace(/EIRELI[\.\s-]*ME$/i, 'EIRELI')
    .replace(/EIRELI[\.\s-]*EPP$/i, 'EIRELI')
    .replace(/\s+/g, ' ')
    .trim();
}

async function unificarContas() {
  console.log('='.repeat(100));
  console.log(EXECUTE ? '🔴 EXECUTANDO UNIFICAÇÃO DE CONTAS' : '🔵 SIMULANDO UNIFICAÇÃO DE CONTAS');
  console.log('='.repeat(100));

  if (!EXECUTE) {
    console.log('\n⚠️  MODO SIMULAÇÃO - Nenhuma alteração será feita');
    console.log('    Para executar de verdade, use: --execute\n');
  }

  // Buscar todas as contas de clientes ativas
  const { data: contas, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .like('code', '1.1.2.01.%')
    .eq('is_active', true)
    .order('code');

  if (error) {
    console.error('Erro ao buscar contas:', error.message);
    return;
  }

  // Buscar lançamentos
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('id, account_id, debit_amount, credit_amount');

  const lancamentosPorConta = {};
  linhas?.forEach(l => {
    if (!lancamentosPorConta[l.account_id]) {
      lancamentosPorConta[l.account_id] = { linhas: [], debitos: 0, creditos: 0 };
    }
    lancamentosPorConta[l.account_id].linhas.push(l);
    lancamentosPorConta[l.account_id].debitos += Number(l.debit_amount) || 0;
    lancamentosPorConta[l.account_id].creditos += Number(l.credit_amount) || 0;
  });

  console.log(`\nTotal de contas de clientes ativas: ${contas.length}`);

  // Agrupar por nome normalizado
  const grupos = {};
  contas.forEach(c => {
    const chave = normalizarNome(c.name);
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(c);
  });

  // Encontrar duplicatas
  const duplicatas = Object.entries(grupos).filter(([_, arr]) => arr.length > 1);
  console.log(`Grupos com duplicatas: ${duplicatas.length}`);

  let totalTransferidos = 0;
  let totalDesativadas = 0;
  let totalRenomeadas = 0;

  // ============================================
  // PARTE 1: RESOLVER DUPLICATAS
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('PARTE 1: RESOLVER DUPLICATAS');
  console.log('='.repeat(80));

  for (const [nomeNorm, contasGrupo] of duplicatas) {
    console.log(`\n📌 ${nomeNorm} (${contasGrupo.length} contas):`);

    // Ordenar: preferir conta com código menor e sem prefixo
    contasGrupo.sort((a, b) => {
      // Preferir sem prefixo "Cliente:"
      const aTemPrefixo = a.name?.startsWith('Cliente: ') ? 1 : 0;
      const bTemPrefixo = b.name?.startsWith('Cliente: ') ? 1 : 0;
      if (aTemPrefixo !== bTemPrefixo) return aTemPrefixo - bTemPrefixo;

      // Preferir código menor
      return a.code.localeCompare(b.code);
    });

    const contaPrincipal = contasGrupo[0];
    const contasSecundarias = contasGrupo.slice(1);

    const lancPrincipal = lancamentosPorConta[contaPrincipal.id];
    const saldoPrincipal = lancPrincipal
      ? (lancPrincipal.debitos - lancPrincipal.creditos)
      : 0;

    console.log(`   ✓ MANTER: ${contaPrincipal.code} - ${contaPrincipal.name?.substring(0, 50)}`);
    console.log(`     Lançamentos: ${lancPrincipal?.linhas.length || 0}, Saldo: R$ ${saldoPrincipal.toFixed(2)}`);

    for (const contaSec of contasSecundarias) {
      const lancSec = lancamentosPorConta[contaSec.id];
      const saldoSec = lancSec ? (lancSec.debitos - lancSec.creditos) : 0;

      console.log(`   → DESATIVAR: ${contaSec.code} - ${contaSec.name?.substring(0, 50)}`);
      console.log(`     Lançamentos: ${lancSec?.linhas.length || 0}, Saldo: R$ ${saldoSec.toFixed(2)}`);

      // Transferir lançamentos se houver
      if (lancSec && lancSec.linhas.length > 0) {
        console.log(`     📦 Transferindo ${lancSec.linhas.length} lançamentos para ${contaPrincipal.code}`);

        if (EXECUTE) {
          const { error: transferError } = await supabase
            .from('accounting_entry_lines')
            .update({ account_id: contaPrincipal.id })
            .eq('account_id', contaSec.id);

          if (transferError) {
            console.log(`     ❌ Erro ao transferir: ${transferError.message}`);
            continue;
          }
        }
        totalTransferidos += lancSec.linhas.length;
      }

      // Desativar conta secundária
      if (EXECUTE) {
        await supabase
          .from('chart_of_accounts')
          .update({ is_active: false })
          .eq('id', contaSec.id);
      }
      totalDesativadas++;
    }
  }

  // ============================================
  // PARTE 2: PADRONIZAR NOMES (remover prefixo)
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('PARTE 2: PADRONIZAR NOMES (remover prefixo "Cliente: ")');
  console.log('='.repeat(80));

  // Buscar contas atualizadas (após desativações)
  const { data: contasAtuais } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .like('code', '1.1.2.01.%')
    .eq('is_active', true)
    .order('code');

  const contasComPrefixo = contasAtuais?.filter(c => c.name?.startsWith('Cliente: ')) || [];
  console.log(`\nContas com prefixo "Cliente: ": ${contasComPrefixo.length}`);

  for (const conta of contasComPrefixo) {
    const novoNome = conta.name.replace('Cliente: ', '').trim();

    // Verificar se já existe outra conta ativa com esse nome
    const duplicada = contasAtuais?.find(c =>
      c.id !== conta.id &&
      normalizarNome(c.name) === normalizarNome(novoNome)
    );

    if (duplicada) {
      console.log(`  ⚠️  ${conta.code}: Já existe "${duplicada.code}" com nome similar`);
      // Desativar esta e transferir para a existente
      const lancConta = lancamentosPorConta[conta.id];

      if (lancConta && lancConta.linhas.length > 0) {
        console.log(`      📦 Transferindo ${lancConta.linhas.length} lançamentos para ${duplicada.code}`);
        if (EXECUTE) {
          await supabase
            .from('accounting_entry_lines')
            .update({ account_id: duplicada.id })
            .eq('account_id', conta.id);
        }
        totalTransferidos += lancConta.linhas.length;
      }

      if (EXECUTE) {
        await supabase
          .from('chart_of_accounts')
          .update({ is_active: false })
          .eq('id', conta.id);
      }
      totalDesativadas++;
    } else {
      // Apenas renomear
      console.log(`  ✓ ${conta.code}: "${conta.name}" → "${novoNome}"`);
      if (EXECUTE) {
        await supabase
          .from('chart_of_accounts')
          .update({ name: novoNome })
          .eq('id', conta.id);
      }
      totalRenomeadas++;
    }
  }

  // ============================================
  // VERIFICAR EQUAÇÃO CONTÁBIL
  // ============================================
  if (EXECUTE) {
    console.log('\n' + '='.repeat(80));
    console.log('VERIFICAÇÃO DA EQUAÇÃO CONTÁBIL');
    console.log('='.repeat(80));

    const { data: linhasVerif } = await supabase
      .from('accounting_entry_lines')
      .select('debit_amount, credit_amount');

    let totalDebitos = 0;
    let totalCreditos = 0;
    linhasVerif?.forEach(l => {
      totalDebitos += Number(l.debit_amount) || 0;
      totalCreditos += Number(l.credit_amount) || 0;
    });

    const diferenca = Math.abs(totalDebitos - totalCreditos);
    console.log(`\n  Total Débitos:  R$ ${totalDebitos.toFixed(2)}`);
    console.log(`  Total Créditos: R$ ${totalCreditos.toFixed(2)}`);
    console.log(`  Diferença:      R$ ${diferenca.toFixed(2)}`);

    if (diferenca < 0.01) {
      console.log('\n  ✅ EQUAÇÃO CONTÁBIL BALANCEADA!');
    } else {
      console.log('\n  ⚠️ DIFERENÇA DETECTADA! Verificar manualmente.');
    }
  }

  // ============================================
  // RESUMO
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('RESUMO');
  console.log('='.repeat(100));

  console.log(`\n| Ação | Quantidade |`);
  console.log(`|------|------------|`);
  console.log(`| Lançamentos TRANSFERIDOS | ${totalTransferidos} |`);
  console.log(`| Contas DESATIVADAS | ${totalDesativadas} |`);
  console.log(`| Contas RENOMEADAS | ${totalRenomeadas} |`);

  if (!EXECUTE) {
    console.log('\n⚠️  NENHUMA ALTERAÇÃO FOI FEITA (modo simulação)');
    console.log('    Para executar de verdade, use:');
    console.log('    node scripts/correcao_contabil/41_unificar_contas_clientes.cjs --execute');
  } else {
    console.log('\n✅ UNIFICAÇÃO CONCLUÍDA!');

    // Contar estado final
    const { data: contasFinais } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .like('code', '1.1.2.01.%')
      .eq('is_active', true);

    console.log(`\nContas de clientes ativas: ${contasFinais?.length || 0}`);
  }
}

unificarContas().catch(console.error);
