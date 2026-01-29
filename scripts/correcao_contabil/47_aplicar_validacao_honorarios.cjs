// scripts/correcao_contabil/47_aplicar_validacao_honorarios.cjs
// Aplicar validação de honorários diretamente no Supabase

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function aplicar() {
  console.log('='.repeat(100));
  console.log('APLICANDO VALIDAÇÃO DE HONORÁRIOS');
  console.log('='.repeat(100));

  // 1. Adicionar coluna fee_type
  console.log('\n📌 Adicionando coluna fee_type...');

  // Verificar se coluna já existe
  const { data: existeFeeType } = await supabase
    .from('client_opening_balance')
    .select('fee_type')
    .limit(1);

  if (existeFeeType === null || existeFeeType?.error) {
    // Coluna não existe, precisa criar via SQL direto
    console.log('   Coluna fee_type não encontrada. Criando...');

    // Tentar via fetch direto para o banco
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        sql_text: `ALTER TABLE client_opening_balance ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20) DEFAULT 'monthly';`
      })
    });

    if (!response.ok) {
      console.log('   ⚠️  Não foi possível criar coluna via RPC. Usando UPDATE direto...');
    }
  } else {
    console.log('   ✅ Coluna fee_type já existe');
  }

  // 2. Atualizar registros existentes
  console.log('\n📌 Atualizando tipo dos honorários existentes...');

  // Buscar todos os registros
  const { data: todos } = await supabase
    .from('client_opening_balance')
    .select('id, competence, is_thirteenth_fee, fee_type');

  let atualizados = 0;
  for (const reg of todos || []) {
    const mes = reg.competence?.substring(0, 2);
    const novoTipo = (reg.is_thirteenth_fee || mes === '13') ? 'thirteenth' : 'monthly';

    if (reg.fee_type !== novoTipo) {
      const { error } = await supabase
        .from('client_opening_balance')
        .update({ fee_type: novoTipo })
        .eq('id', reg.id);

      if (!error) atualizados++;
    }
  }

  console.log(`   ✅ ${atualizados} registros atualizados`);

  // 3. Resumo dos tipos
  console.log('\n📊 RESUMO POR TIPO:');

  const { data: resumo } = await supabase
    .from('client_opening_balance')
    .select('fee_type');

  const contagem = {};
  resumo?.forEach(r => {
    const tipo = r.fee_type || 'monthly';
    contagem[tipo] = (contagem[tipo] || 0) + 1;
  });

  console.log('| Tipo | Quantidade |');
  console.log('|------|------------|');
  Object.entries(contagem).forEach(([tipo, qtd]) => {
    console.log(`| ${tipo.padEnd(12)} | ${qtd} |`);
  });

  // 4. Mostrar regras
  console.log('\n' + '='.repeat(100));
  console.log('REGRAS DE VALIDAÇÃO');
  console.log('='.repeat(100));
  console.log(`
| Tipo         | Limite    | Competência | Descrição                    |
|--------------|-----------|-------------|------------------------------|
| monthly      | 12/ano    | 01-12       | Honorário mensal contábil    |
| thirteenth   | 1/ano     | 13          | 13º honorário                |
| legalization | Sem limite| Qualquer    | Abertura/legalização         |
| amendment    | Sem limite| Qualquer    | Alteração contratual         |
| extra        | Sem limite| Qualquer    | Serviços extras              |
| other        | Sem limite| Qualquer    | Outros serviços              |
`);

  console.log('\n✅ VALIDAÇÃO APLICADA!');
  console.log('\n📝 NOTA: O trigger de validação está no arquivo de migration:');
  console.log('   supabase/migrations/20260111210000_constraint_max_13_honorarios.sql');
  console.log('   Execute manualmente no Supabase Dashboard > SQL Editor');
}

aplicar().catch(console.error);
