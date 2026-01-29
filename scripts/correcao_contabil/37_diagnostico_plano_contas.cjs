// scripts/correcao_contabil/37_diagnostico_plano_contas.cjs
// Diagnóstico COMPLETO do Plano de Contas
// Identifica: duplicações, contas obsoletas, códigos inconsistentes

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnosticar() {
  console.log('='.repeat(100));
  console.log('DIAGNÓSTICO COMPLETO DO PLANO DE CONTAS');
  console.log('='.repeat(100));

  // 1. Buscar TODAS as contas
  const { data: contas, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .order('code');

  if (error) {
    console.log('ERRO:', error.message);
    return;
  }

  console.log('\nTotal de contas:', contas.length);

  // ============================================
  // 1. DUPLICATAS [CONSOLIDADO]
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('1. DUPLICATAS [CONSOLIDADO]');
  console.log('='.repeat(100));

  const contasConsolidado = contas.filter(c => c.name?.includes('[CONSOLIDADO]'));
  console.log('Contas com [CONSOLIDADO]:', contasConsolidado.length);

  // Encontrar a conta original para cada consolidada
  const duplicatasConsolidado = [];
  for (const consolidada of contasConsolidado) {
    const nomeOriginal = consolidada.name.replace('[CONSOLIDADO]', '').trim();
    const original = contas.find(c =>
      !c.name?.includes('[CONSOLIDADO]') &&
      c.name?.toUpperCase().includes(nomeOriginal.toUpperCase().substring(0, 20))
    );

    duplicatasConsolidado.push({
      consolidada_id: consolidada.id,
      consolidada_code: consolidada.code,
      consolidada_name: consolidada.name,
      original_id: original?.id,
      original_code: original?.code,
      original_name: original?.name
    });
  }

  console.log('\nExemplos de duplicatas:');
  duplicatasConsolidado.slice(0, 10).forEach(d => {
    console.log(`  ${d.original_code || 'N/A'} ${d.original_name?.substring(0, 40) || 'N/A'}`);
    console.log(`  ${d.consolidada_code} ${d.consolidada_name?.substring(0, 40)}`);
    console.log('');
  });

  // ============================================
  // 2. CONTAS OBSOLETAS
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('2. CONTAS OBSOLETAS');
  console.log('='.repeat(100));

  const contasObsoletas = contas.filter(c =>
    c.name?.includes('OBSOLETO') ||
    c.name?.includes('obsoleto') ||
    c.name?.includes('(antigo)') ||
    c.name?.includes('(antiga)')
  );

  console.log('Contas obsoletas encontradas:', contasObsoletas.length);
  contasObsoletas.forEach(c => {
    console.log(`  ${c.code} - ${c.name}`);
  });

  // ============================================
  // 3. CONTAS "Dr. Cicero" MAL POSICIONADAS
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('3. CONTAS "Dr. Cicero" MAL POSICIONADAS');
  console.log('='.repeat(100));

  const contasDrCicero = contas.filter(c => c.name?.includes('Dr. Cicero'));
  console.log('Contas Dr. Cicero:', contasDrCicero.length);
  contasDrCicero.forEach(c => {
    const grupo = c.code.charAt(0);
    let problema = '';
    if (c.name?.includes('CUSTOS_PESSOAL') && grupo === '5') {
      problema = '⚠️ ERRO: Custos de Pessoal deveria estar no grupo 4 (Despesas)';
    }
    if (c.name?.includes('ADIANTAMENTO_SOCIO') && !c.code.startsWith('1.1.3')) {
      problema = '⚠️ ERRO: Adiantamento deveria estar em 1.1.3.xx';
    }
    console.log(`  ${c.code} - ${c.name} ${problema}`);
  });

  // ============================================
  // 4. CÓDIGOS INCONSISTENTES (fora do padrão 4 dígitos)
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('4. CÓDIGOS INCONSISTENTES');
  console.log('='.repeat(100));

  const contasClientesAnaliticas = contas.filter(c => c.code?.startsWith('1.1.2.01.'));
  const codigosInconsistentes = contasClientesAnaliticas.filter(c => {
    const sufixo = c.code.split('1.1.2.01.')[1];
    return sufixo && (sufixo.length !== 4 || isNaN(parseInt(sufixo)));
  });

  console.log('Códigos fora do padrão (4 dígitos):', codigosInconsistentes.length);
  codigosInconsistentes.slice(0, 20).forEach(c => {
    console.log(`  ${c.code} - ${c.name?.substring(0, 50)}`);
  });

  // ============================================
  // 5. DUPLICAÇÕES POR VARIAÇÃO DE NOME
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('5. DUPLICAÇÕES POR VARIAÇÃO DE NOME');
  console.log('='.repeat(100));

  // Normalizar nomes para comparação
  function normalizarNome(nome) {
    if (!nome) return '';
    return nome
      .toUpperCase()
      .replace(/[CONSOLIDADO]/g, '')
      .replace(/[\[\]]/g, '')
      .replace(/LTDA?\.?/g, '')
      .replace(/S\/?A/g, '')
      .replace(/EIRELI/g, '')
      .replace(/ME$/g, '')
      .replace(/EPP$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 25); // Primeiros 25 caracteres
  }

  const contasClientes = contas.filter(c => c.code?.startsWith('1.1.2.01.'));
  const grupos = {};

  contasClientes.forEach(c => {
    const chave = normalizarNome(c.name);
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(c);
  });

  const duplicacoesPorNome = Object.entries(grupos)
    .filter(([_, arr]) => arr.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('Grupos com possíveis duplicatas:', duplicacoesPorNome.length);
  console.log('\nMaiores duplicações:');
  duplicacoesPorNome.slice(0, 15).forEach(([chave, arr]) => {
    console.log(`\n  "${chave}" (${arr.length} contas):`);
    arr.forEach(c => {
      console.log(`    ${c.code} - ${c.name?.substring(0, 60)}`);
    });
  });

  // ============================================
  // 6. PATRIMÔNIO LÍQUIDO DUPLICADO
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('6. PATRIMÔNIO LÍQUIDO DUPLICADO');
  console.log('='.repeat(100));

  const contasPL_grupo2 = contas.filter(c => c.code?.startsWith('2.3'));
  const contasPL_grupo5 = contas.filter(c => c.code?.startsWith('5.'));

  console.log('PL no grupo 2.3 (dentro do Passivo):', contasPL_grupo2.length);
  contasPL_grupo2.forEach(c => console.log(`  ${c.code} - ${c.name}`));

  console.log('\nPL no grupo 5 (grupo raiz):', contasPL_grupo5.length);
  contasPL_grupo5.slice(0, 10).forEach(c => console.log(`  ${c.code} - ${c.name}`));

  // ============================================
  // 7. CONTAS COM LANÇAMENTOS vs SEM LANÇAMENTOS
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('7. CONTAS DE CLIENTES SEM LANÇAMENTOS');
  console.log('='.repeat(100));

  // Buscar contas que têm lançamentos
  const { data: contasComLancamentos } = await supabase
    .from('accounting_entry_lines')
    .select('account_id')
    .not('account_id', 'is', null);

  const idsComLancamentos = new Set(contasComLancamentos?.map(l => l.account_id) || []);

  const clientesSemLancamentos = contasClientes.filter(c => !idsComLancamentos.has(c.id));
  const clientesComLancamentos = contasClientes.filter(c => idsComLancamentos.has(c.id));

  console.log('Contas de clientes COM lançamentos:', clientesComLancamentos.length);
  console.log('Contas de clientes SEM lançamentos:', clientesSemLancamentos.length);

  // ============================================
  // RESUMO
  // ============================================
  console.log('\n' + '='.repeat(100));
  console.log('RESUMO DO DIAGNÓSTICO');
  console.log('='.repeat(100));

  const resumo = {
    total_contas: contas.length,
    contas_clientes: contasClientes.length,
    duplicatas_consolidado: contasConsolidado.length,
    contas_obsoletas: contasObsoletas.length,
    contas_dr_cicero: contasDrCicero.length,
    codigos_inconsistentes: codigosInconsistentes.length,
    grupos_duplicados_nome: duplicacoesPorNome.length,
    pl_grupo_2_3: contasPL_grupo2.length,
    pl_grupo_5: contasPL_grupo5.length,
    clientes_sem_lancamentos: clientesSemLancamentos.length,
    clientes_com_lancamentos: clientesComLancamentos.length
  };

  console.log('\n| Problema | Quantidade |');
  console.log('|----------|------------|');
  console.log(`| Total de contas | ${resumo.total_contas} |`);
  console.log(`| Contas de clientes (1.1.2.01.xxxx) | ${resumo.contas_clientes} |`);
  console.log(`| Duplicatas [CONSOLIDADO] | ${resumo.duplicatas_consolidado} |`);
  console.log(`| Contas OBSOLETAS | ${resumo.contas_obsoletas} |`);
  console.log(`| Contas Dr. Cicero | ${resumo.contas_dr_cicero} |`);
  console.log(`| Códigos fora do padrão | ${resumo.codigos_inconsistentes} |`);
  console.log(`| Grupos com nomes duplicados | ${resumo.grupos_duplicados_nome} |`);
  console.log(`| PL duplicado (2.3 + 5) | ${resumo.pl_grupo_2_3} + ${resumo.pl_grupo_5} |`);
  console.log(`| Clientes SEM lançamentos | ${resumo.clientes_sem_lancamentos} |`);
  console.log(`| Clientes COM lançamentos | ${resumo.clientes_com_lancamentos} |`);

  console.log('\n' + '='.repeat(100));
  console.log('RECOMENDAÇÕES');
  console.log('='.repeat(100));
  console.log('1. Desativar/mesclar contas [CONSOLIDADO] com as originais');
  console.log('2. Desativar contas OBSOLETAS');
  console.log('3. Mover contas Dr. Cicero para grupos corretos');
  console.log('4. Padronizar códigos para 4 dígitos');
  console.log('5. Mesclar contas duplicadas por nome (manter a que tem lançamentos)');
  console.log('6. Decidir sobre PL: usar grupo 5 (padrão NBC TG 26)');
  console.log('7. Desativar contas de clientes sem lançamentos (se não forem necessárias)');

  return resumo;
}

diagnosticar().catch(console.error);
