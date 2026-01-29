// scripts/correcao_contabil/01_criar_conta_transitoria.mjs
// Cria a conta transitória 1.1.9.01 para recebimentos a conciliar

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarContaTransitoria() {
  console.log('\n' + '='.repeat(60));
  console.log('🔧 CRIAÇÃO DA CONTA TRANSITÓRIA');
  console.log('='.repeat(60));

  // 1. Verificar/criar conta pai 1.1.9
  console.log('\n📍 Verificando conta pai 1.1.9...');

  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.9')
    .maybeSingle();

  if (!contaPai) {
    console.log('   Conta pai não existe, criando...');

    const { error: errPai } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: '1.1.9',
        name: 'Valores Transitórios',
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        is_synthetic: true,
        parent_code: '1.1',
        is_active: true,
        description: 'Contas transitórias para valores aguardando classificação/conciliação'
      });

    if (errPai) {
      console.error('❌ Erro ao criar conta pai 1.1.9:', errPai);
      return { success: false, error: errPai };
    }
    console.log('   ✅ Conta pai 1.1.9 criada');
  } else {
    console.log(`   ℹ️ Conta pai já existe: ${contaPai.code} - ${contaPai.name}`);
  }

  // 2. Criar conta transitória 1.1.9.01
  console.log('\n📍 Verificando conta transitória 1.1.9.01...');

  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.9.01')
    .maybeSingle();

  if (!contaTransitoria) {
    console.log('   Conta transitória não existe, criando...');

    const { data: novaConta, error: errTrans } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: '1.1.9.01',
        name: 'Recebimentos a Conciliar',
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        is_synthetic: false,
        parent_code: '1.1.9',
        is_active: true,
        description: 'Conta transitória para recebimentos do OFX aguardando conciliação e desmembramento por cliente. Saldo deve ser ZERO após conciliação completa.'
      })
      .select('id, code, name')
      .single();

    if (errTrans) {
      console.error('❌ Erro ao criar conta 1.1.9.01:', errTrans);
      return { success: false, error: errTrans };
    }
    console.log(`   ✅ Conta criada: ${novaConta.code} - ${novaConta.name}`);
    console.log(`   ID: ${novaConta.id}`);
  } else {
    console.log(`   ℹ️ Conta já existe: ${contaTransitoria.code} - ${contaTransitoria.name}`);
    console.log(`   ID: ${contaTransitoria.id}`);
  }

  // 3. Verificar estrutura final
  console.log('\n📊 Estrutura de contas transitórias:');

  const { data: estrutura } = await supabase
    .from('chart_of_accounts')
    .select('code, name, is_synthetic')
    .or('code.eq.1.1.9,code.ilike.1.1.9.%')
    .order('code');

  for (const conta of estrutura || []) {
    const tipo = conta.is_synthetic ? '(Sintética)' : '(Analítica)';
    const indent = conta.code.split('.').length > 3 ? '   ' : '';
    console.log(`${indent}${conta.code} - ${conta.name} ${tipo}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ CONTA TRANSITÓRIA CONFIGURADA COM SUCESSO!');
  console.log('='.repeat(60));
  console.log('\nPróximo passo: Execute o script 02_limpar_duplicatas_banco_sicredi.mjs');

  return { success: true };
}

criarContaTransitoria().catch(console.error);
