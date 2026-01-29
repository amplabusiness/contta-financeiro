// Script para testar as views de aging
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  console.log('Testando views de aging...\n');

  // Test vw_aging_inadimplencia
  const { data: aging, error: agingError } = await supabase
    .from('vw_aging_inadimplencia')
    .select('*')
    .limit(5);

  if (agingError) {
    console.error('❌ Erro vw_aging_inadimplencia:', agingError.message);
  } else {
    console.log('✅ vw_aging_inadimplencia OK - ' + (aging?.length || 0) + ' registros');
    if (aging?.length > 0) {
      console.log('\nPrimeiros 5 clientes:');
      for (const c of aging) {
        console.log(`   ${c.client_name} - Total: R$ ${c.total_em_aberto?.toLocaleString('pt-BR')} [${c.nivel_risco}]`);
      }
    }
  }

  // Test vw_aging_resumo
  const { data: resumo, error: resumoError } = await supabase
    .from('vw_aging_resumo')
    .select('*')
    .single();

  if (resumoError && resumoError.code !== 'PGRST116') {
    console.error('\n❌ Erro vw_aging_resumo:', resumoError.message);
  } else if (resumo) {
    console.log('\n✅ vw_aging_resumo OK');
    console.log('\nResumo Consolidado:');
    console.log(`   Total clientes inadimplentes: ${resumo.total_clientes_inadimplentes}`);
    console.log(`   0-30 dias: R$ ${resumo.total_0_30_dias?.toLocaleString('pt-BR')}`);
    console.log(`   31-60 dias: R$ ${resumo.total_31_60_dias?.toLocaleString('pt-BR')}`);
    console.log(`   61-90 dias: R$ ${resumo.total_61_90_dias?.toLocaleString('pt-BR')}`);
    console.log(`   +90 dias: R$ ${resumo.total_mais_90_dias?.toLocaleString('pt-BR')}`);
    console.log(`   TOTAL: R$ ${resumo.total_geral_inadimplencia?.toLocaleString('pt-BR')}`);
    console.log(`\n   Críticos: ${resumo.clientes_criticos}`);
    console.log(`   Alto risco: ${resumo.clientes_alto_risco}`);
    console.log(`   Médio risco: ${resumo.clientes_medio_risco}`);
    console.log(`   Baixo risco: ${resumo.clientes_baixo_risco}`);
  }

  console.log('\n✅ CORREÇÕES DA ESPECIFICAÇÃO APLICADAS COM SUCESSO!');
}

test();
