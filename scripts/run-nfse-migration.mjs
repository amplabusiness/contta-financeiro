// Script para executar migration do sistema NFS-e via Supabase REST API
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

async function runMigration() {
  console.log('🚀 Executando migrations do sistema NFS-e...\n');

  // Criar cliente com service role para ter acesso total
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Verificar tabela nfse
  console.log('1. Verificando tabela nfse...');
  const { error: nfseError } = await supabase.from('nfse').select('id').limit(1);
  if (!nfseError) {
    console.log('   ✅ Tabela nfse existe');
  } else {
    console.log('   ❌ Tabela nfse NÃO existe - precisa criar manualmente');
  }

  // Verificar tabela nfse_config
  console.log('2. Verificando tabela nfse_config...');
  const { data: configData, error: configError } = await supabase.from('nfse_config').select('*').limit(1);
  if (!configError) {
    console.log('   ✅ Tabela nfse_config existe');
    if (configData && configData.length > 0) {
      console.log('   📊 Config atual:', configData[0].prestador_razao_social);
    }
  } else {
    console.log('   ❌ Tabela nfse_config NÃO existe - precisa criar manualmente');
  }

  // Verificar tabela codigos_servico_lc116
  console.log('3. Verificando tabela codigos_servico_lc116...');
  const { data: codigosData, error: codigosError } = await supabase.from('codigos_servico_lc116').select('*').limit(1);
  if (!codigosError) {
    console.log('   ✅ Tabela codigos_servico_lc116 existe');
    const { count } = await supabase.from('codigos_servico_lc116').select('*', { count: 'exact', head: true });
    console.log(`   📊 ${count || 0} códigos cadastrados`);

    // Se não tiver códigos, inserir
    if (!count || count === 0) {
      console.log('\n4. Inserindo códigos de serviço da LC 116/2003...');
      await insertCodigosServico(supabase);
    }
  } else {
    console.log('   ❌ Tabela codigos_servico_lc116 NÃO existe');
    console.log('   ⚠️ Execute o SQL no Supabase Dashboard:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS codigos_servico_lc116 (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    cnae_principal VARCHAR(10),
    aliquota_minima DECIMAL(5,4) DEFAULT 0.02,
    aliquota_maxima DECIMAL(5,4) DEFAULT 0.05,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE codigos_servico_lc116 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public access" ON codigos_servico_lc116 FOR ALL USING (true) WITH CHECK (true);
    `);
  }

  // Verificar nfse_log
  console.log('\n4. Verificando tabela nfse_log...');
  const { error: logError } = await supabase.from('nfse_log').select('id').limit(1);
  if (!logError) {
    console.log('   ✅ Tabela nfse_log existe');
  } else {
    console.log('   ❌ Tabela nfse_log NÃO existe - precisa criar manualmente');
  }

  console.log('\n✅ Verificação concluída!');
  console.log('\n📝 Se alguma tabela estiver faltando, execute o SQL do arquivo:');
  console.log('   supabase/migrations/EXECUTAR_NFSE_COMPLETO.sql');
  console.log('   no Dashboard: https://supabase.com/dashboard/project/xdtlhzysrpoinqtsglmr/sql/new');
}

async function insertCodigosServico(supabase) {
  const codigos = [
    // Informática
    { codigo: '1.01', descricao: 'Análise e desenvolvimento de sistemas', cnae_principal: '6201500', ativo: true },
    { codigo: '1.02', descricao: 'Programação', cnae_principal: '6201500', ativo: true },
    { codigo: '1.03', descricao: 'Processamento, armazenamento ou hospedagem de dados', cnae_principal: '6311900', ativo: true },
    { codigo: '1.04', descricao: 'Elaboração de programas de computadores', cnae_principal: '6201500', ativo: true },
    { codigo: '1.05', descricao: 'Licenciamento ou cessão de direito de uso de programas', cnae_principal: '6203100', ativo: true },
    { codigo: '1.06', descricao: 'Assessoria e consultoria em informática', cnae_principal: '6204000', ativo: true },
    { codigo: '1.07', descricao: 'Suporte técnico em informática', cnae_principal: '6209100', ativo: true },
    { codigo: '1.08', descricao: 'Planejamento, confecção, manutenção de páginas eletrônicas', cnae_principal: '6319400', ativo: true },

    // Apoio técnico, administrativo, contábil (principais)
    { codigo: '17.01', descricao: 'Assessoria ou consultoria de qualquer natureza', cnae_principal: '7020400', ativo: true },
    { codigo: '17.02', descricao: 'Datilografia, digitação, estenografia, expediente, secretaria em geral', cnae_principal: '8211300', ativo: true },
    { codigo: '17.03', descricao: 'Planejamento, coordenação, programação ou organização técnica', cnae_principal: '7020400', ativo: true },
    { codigo: '17.04', descricao: 'Recrutamento, agenciamento, seleção e colocação de mão-de-obra', cnae_principal: '7810800', ativo: true },
    { codigo: '17.05', descricao: 'Fornecimento de mão-de-obra, mesmo em caráter temporário', cnae_principal: '7820500', ativo: true },
    { codigo: '17.06', descricao: 'Propaganda e publicidade', cnae_principal: '7311400', ativo: true },
    { codigo: '17.07', descricao: 'Franquia (franchising)', cnae_principal: '7740300', ativo: true },
    { codigo: '17.08', descricao: 'Perícias, laudos, exames técnicos e análises técnicas', cnae_principal: '7490101', ativo: true },
    { codigo: '17.09', descricao: 'Planejamento, organização e administração de feiras', cnae_principal: '8230002', ativo: true },
    { codigo: '17.10', descricao: 'Organização de festas e recepções; bufê', cnae_principal: '5620102', ativo: true },
    { codigo: '17.11', descricao: 'Administração em geral, inclusive de bens e negócios de terceiros', cnae_principal: '8299799', ativo: true },
    { codigo: '17.12', descricao: 'Leilão e congêneres', cnae_principal: '8299704', ativo: true },
    { codigo: '17.13', descricao: 'Advocacia', cnae_principal: '6911701', ativo: true },
    { codigo: '17.14', descricao: 'Arbitragem de qualquer espécie, inclusive jurídica', cnae_principal: '6911703', ativo: true },
    { codigo: '17.15', descricao: 'Auditoria', cnae_principal: '6920601', ativo: true },
    { codigo: '17.16', descricao: 'Análise de Organização e Métodos', cnae_principal: '7020400', ativo: true },
    { codigo: '17.17', descricao: 'Atuária e cálculos técnicos de qualquer natureza', cnae_principal: '6621502', ativo: true },
    { codigo: '17.18', descricao: 'Contabilidade, inclusive serviços técnicos e auxiliares', cnae_principal: '6920602', ativo: true },
    { codigo: '17.19', descricao: 'Consultoria e assessoria econômica ou financeira', cnae_principal: '7020400', ativo: true },
    { codigo: '17.20', descricao: 'Estatística', cnae_principal: '6399200', ativo: true },
    { codigo: '17.21', descricao: 'Cobrança em geral', cnae_principal: '8291100', ativo: true },
    { codigo: '17.22', descricao: 'Assessoria relacionada a operações de faturização (factoring)', cnae_principal: '6499999', ativo: true },
    { codigo: '17.23', descricao: 'Apresentação de palestras, conferências, seminários', cnae_principal: '8230002', ativo: true },
    { codigo: '17.24', descricao: 'Inserção de textos, desenhos e materiais de propaganda', cnae_principal: '7319002', ativo: true },
    { codigo: '17.25', descricao: 'Serviços de apoio e infraestrutura administrativa', cnae_principal: '8211300', ativo: true },

    // Outros importantes
    { codigo: '7.01', descricao: 'Engenharia, agronomia, arquitetura, geologia, urbanismo', cnae_principal: '7112000', ativo: true },
    { codigo: '7.02', descricao: 'Execução de obras de construção civil', cnae_principal: '4120400', ativo: true },
    { codigo: '7.03', descricao: 'Elaboração de planos diretores, estudos de viabilidade', cnae_principal: '7112000', ativo: true },
    { codigo: '8.01', descricao: 'Ensino regular pré-escolar, fundamental, médio e superior', cnae_principal: '8512100', ativo: true },
    { codigo: '8.02', descricao: 'Instrução, treinamento, orientação pedagógica', cnae_principal: '8599603', ativo: true },
    { codigo: '10.01', descricao: 'Agenciamento, corretagem ou intermediação de câmbio, seguros', cnae_principal: '6622300', ativo: true },
    { codigo: '10.05', descricao: 'Agenciamento, corretagem ou intermediação de bens móveis ou imóveis', cnae_principal: '6821801', ativo: true },
  ];

  for (const cod of codigos) {
    const { error } = await supabase.from('codigos_servico_lc116').upsert(cod, { onConflict: 'codigo' });
    if (error) {
      console.log(`   ❌ Erro ao inserir ${cod.codigo}: ${error.message}`);
    } else {
      console.log(`   ✅ Inserido: ${cod.codigo}`);
    }
  }

  console.log('\n✅ Códigos de serviço inseridos!');
}

runMigration().catch(console.error);
