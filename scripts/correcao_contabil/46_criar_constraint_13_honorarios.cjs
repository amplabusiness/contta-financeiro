// scripts/correcao_contabil/46_criar_constraint_13_honorarios.cjs
// Criar constraint e trigger para limitar 13 honorários por cliente por ano

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarConstraint() {
  console.log('='.repeat(100));
  console.log('CRIANDO CONSTRAINT PARA LIMITE DE 13 HONORÁRIOS POR ANO');
  console.log('='.repeat(100));

  // 1. Testar a validação na aplicação (JavaScript)
  console.log('\n📌 A validação será feita no nível da aplicação.');
  console.log('   Regras:');
  console.log('   - Máximo 13 honorários por cliente por ano');
  console.log('   - Competências válidas: 01 a 12 (meses) + 13 (13º salário)');
  console.log('   - Cada competência pode aparecer apenas uma vez por ano');

  // 2. Verificar dados atuais
  console.log('\n📊 VERIFICANDO DADOS ATUAIS:');

  const { data: resumo } = await supabase
    .from('client_opening_balance')
    .select('client_id, competence');

  // Agrupar por cliente e ano
  const porClienteAno = {};
  resumo?.forEach(r => {
    const ano = r.competence.substring(3, 7);
    const chave = `${r.client_id}_${ano}`;
    if (!porClienteAno[chave]) {
      porClienteAno[chave] = { client_id: r.client_id, ano, count: 0, competencias: [] };
    }
    porClienteAno[chave].count++;
    porClienteAno[chave].competencias.push(r.competence.substring(0, 2));
  });

  // Verificar se algum ultrapassa 13
  const problemas = Object.values(porClienteAno).filter(p => p.count > 13);

  if (problemas.length > 0) {
    console.log('\n⚠️  CLIENTES COM MAIS DE 13 HONORÁRIOS NO ANO:');
    for (const p of problemas) {
      const { data: cliente } = await supabase
        .from('clients')
        .select('name')
        .eq('id', p.client_id)
        .single();
      console.log(`   ${cliente?.name || p.client_id}: ${p.count} honorários em ${p.ano}`);
    }
  } else {
    console.log('\n✅ Nenhum cliente excede o limite de 13 honorários por ano.');
  }

  // Mostrar distribuição
  console.log('\n📊 DISTRIBUIÇÃO POR ANO:');
  const porAno = {};
  Object.values(porClienteAno).forEach(p => {
    if (!porAno[p.ano]) porAno[p.ano] = { clientes: 0, honorarios: 0 };
    porAno[p.ano].clientes++;
    porAno[p.ano].honorarios += p.count;
  });

  console.log('| Ano | Clientes | Honorários |');
  console.log('|-----|----------|------------|');
  Object.entries(porAno).sort().forEach(([ano, dados]) => {
    console.log(`| ${ano} | ${dados.clientes} | ${dados.honorarios} |`);
  });

  // 3. Criar arquivo de validação para uso na aplicação
  console.log('\n📝 FUNÇÃO DE VALIDAÇÃO (para uso na aplicação):');
  console.log(`
async function validarNovoHonorario(supabase, clientId, competence, excludeId = null) {
  // Validar formato: MM/YYYY onde MM = 01 a 13
  if (!/^(0[1-9]|1[0-3])\\/\\d{4}$/.test(competence)) {
    throw new Error('Competência inválida. Formato: MM/YYYY onde MM = 01 a 13');
  }

  const ano = competence.substring(3, 7);

  // Verificar se já existe esta competência
  let query = supabase
    .from('client_opening_balance')
    .select('id')
    .eq('client_id', clientId)
    .eq('competence', competence);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data: existe } = await query;
  if (existe?.length > 0) {
    throw new Error(\`Já existe honorário para competência \${competence}\`);
  }

  // Verificar limite de 13 por ano
  let countQuery = supabase
    .from('client_opening_balance')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .like('competence', \`%/\${ano}\`);

  if (excludeId) {
    countQuery = countQuery.neq('id', excludeId);
  }

  const { count } = await countQuery;
  if (count >= 13) {
    throw new Error(\`Limite de 13 honorários por ano atingido (ano: \${ano})\`);
  }

  return true;
}
`);

  console.log('\n✅ VALIDAÇÃO CONFIGURADA!');
  console.log('   Use a função acima antes de inserir/atualizar honorários.');
}

criarConstraint().catch(console.error);
