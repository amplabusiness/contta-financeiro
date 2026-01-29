// scripts/correcao_contabil/40_padronizar_nomes_clientes.cjs
// Padronizar nomes de contas de clientes (remover prefixo "Cliente: ")
//
// USO:
//   node scripts/correcao_contabil/40_padronizar_nomes_clientes.cjs          # Simulação
//   node scripts/correcao_contabil/40_padronizar_nomes_clientes.cjs --execute # Execução real

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXECUTE = process.argv.includes('--execute');

async function padronizarNomes() {
  console.log('='.repeat(100));
  console.log(EXECUTE ? '🔴 EXECUTANDO PADRONIZAÇÃO DE NOMES' : '🔵 SIMULANDO PADRONIZAÇÃO DE NOMES');
  console.log('='.repeat(100));

  if (!EXECUTE) {
    console.log('\n⚠️  MODO SIMULAÇÃO - Nenhuma alteração será feita');
    console.log('    Para executar de verdade, use: --execute\n');
  }

  // Buscar todas as contas de clientes (1.1.2.01.xxxx)
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

  console.log(`\nTotal de contas de clientes ativas: ${contas.length}`);

  // Separar por padrão
  const comPrefixo = contas.filter(c => c.name?.startsWith('Cliente: '));
  const semPrefixo = contas.filter(c => !c.name?.startsWith('Cliente: ') && !c.name?.startsWith('[CONSOLIDADO]'));
  const consolidado = contas.filter(c => c.name?.startsWith('[CONSOLIDADO]'));

  console.log(`\nDistribuição atual:`);
  console.log(`  Com prefixo "Cliente: ": ${comPrefixo.length}`);
  console.log(`  Sem prefixo: ${semPrefixo.length}`);
  console.log(`  [CONSOLIDADO]: ${consolidado.length}`);

  // Decidir qual padrão usar - sem prefixo é mais limpo
  console.log('\n' + '='.repeat(80));
  console.log('PADRONIZAÇÃO: Remover prefixo "Cliente: " de todas as contas');
  console.log('='.repeat(80));

  let totalCorrigidas = 0;

  for (const conta of comPrefixo) {
    const novoNome = conta.name.replace('Cliente: ', '').trim();

    console.log(`  ${conta.code}: "${conta.name}" → "${novoNome}"`);

    if (EXECUTE) {
      const { error: updateError } = await supabase
        .from('chart_of_accounts')
        .update({ name: novoNome })
        .eq('id', conta.id);

      if (updateError) {
        console.log(`    ❌ Erro: ${updateError.message}`);
      } else {
        totalCorrigidas++;
      }
    } else {
      totalCorrigidas++;
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
  console.log(`| Contas com prefixo removido | ${totalCorrigidas} |`);

  if (!EXECUTE) {
    console.log('\n⚠️  NENHUMA ALTERAÇÃO FOI FEITA (modo simulação)');
    console.log('    Para executar de verdade, use:');
    console.log('    node scripts/correcao_contabil/40_padronizar_nomes_clientes.cjs --execute');
  } else {
    console.log('\n✅ PADRONIZAÇÃO CONCLUÍDA!');
  }
}

padronizarNomes().catch(console.error);
