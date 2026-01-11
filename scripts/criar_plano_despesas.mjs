/**
 * Script: criar_plano_despesas.mjs
 *
 * Cria estrutura completa de contas de despesas conforme FLUXO_VISUAL_AUTOMATIZADO.md
 * Cada despesa terá sua própria conta para classificação correta.
 *
 * @author Dr. Cícero + Ampla Contabilidade
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Estrutura de contas de despesas a criar
const CONTAS_DESPESAS = [
  // 4.1 DESPESAS OPERACIONAIS
  { code: '4.1', name: 'DESPESAS OPERACIONAIS', level: 2, is_analytical: false, parent_code: '4' },

  // 4.1.1 Utilidades
  { code: '4.1.1', name: 'Utilidades', level: 3, is_analytical: false, parent_code: '4.1' },
  { code: '4.1.1.01', name: 'Energia Elétrica', level: 4, is_analytical: true, parent_code: '4.1.1' },
  { code: '4.1.1.02', name: 'Água e Esgoto', level: 4, is_analytical: true, parent_code: '4.1.1' },
  { code: '4.1.1.03', name: 'Telefone e Internet', level: 4, is_analytical: true, parent_code: '4.1.1' },
  { code: '4.1.1.04', name: 'Gás', level: 4, is_analytical: true, parent_code: '4.1.1' },

  // 4.1.2 Consumo
  { code: '4.1.2', name: 'Consumo', level: 3, is_analytical: false, parent_code: '4.1' },
  { code: '4.1.2.01', name: 'Material de Escritório', level: 4, is_analytical: true, parent_code: '4.1.2' },
  { code: '4.1.2.02', name: 'Material de Limpeza', level: 4, is_analytical: true, parent_code: '4.1.2' },
  { code: '4.1.2.03', name: 'Combustível', level: 4, is_analytical: true, parent_code: '4.1.2' },
  { code: '4.1.2.04', name: 'Alimentação e Refeições', level: 4, is_analytical: true, parent_code: '4.1.2' },
  { code: '4.1.2.05', name: 'Insumos Diversos', level: 4, is_analytical: true, parent_code: '4.1.2' },

  // 4.1.3 Serviços de Terceiros
  { code: '4.1.3', name: 'Serviços de Terceiros', level: 3, is_analytical: false, parent_code: '4.1' },
  { code: '4.1.3.01', name: 'Serviços de TI e Software', level: 4, is_analytical: true, parent_code: '4.1.3' },
  { code: '4.1.3.02', name: 'Honorários Advocatícios', level: 4, is_analytical: true, parent_code: '4.1.3' },
  { code: '4.1.3.03', name: 'Serviços Contábeis', level: 4, is_analytical: true, parent_code: '4.1.3' },
  { code: '4.1.3.04', name: 'Marketing e Publicidade', level: 4, is_analytical: true, parent_code: '4.1.3' },
  { code: '4.1.3.05', name: 'Manutenção e Reparos', level: 4, is_analytical: true, parent_code: '4.1.3' },
  { code: '4.1.3.06', name: 'Serviços de Segurança', level: 4, is_analytical: true, parent_code: '4.1.3' },
  { code: '4.1.3.07', name: 'Serviços de Limpeza', level: 4, is_analytical: true, parent_code: '4.1.3' },
  { code: '4.1.3.08', name: 'Correios e Entregas', level: 4, is_analytical: true, parent_code: '4.1.3' },
  { code: '4.1.3.09', name: 'Consultorias', level: 4, is_analytical: true, parent_code: '4.1.3' },

  // 4.1.4 Ocupação
  { code: '4.1.4', name: 'Ocupação', level: 3, is_analytical: false, parent_code: '4.1' },
  { code: '4.1.4.01', name: 'Aluguel', level: 4, is_analytical: true, parent_code: '4.1.4' },
  { code: '4.1.4.02', name: 'Condomínio', level: 4, is_analytical: true, parent_code: '4.1.4' },
  { code: '4.1.4.03', name: 'IPTU', level: 4, is_analytical: true, parent_code: '4.1.4' },
  { code: '4.1.4.04', name: 'Seguro do Imóvel', level: 4, is_analytical: true, parent_code: '4.1.4' },

  // 4.1.5 Transporte
  { code: '4.1.5', name: 'Transporte', level: 3, is_analytical: false, parent_code: '4.1' },
  { code: '4.1.5.01', name: 'Combustível Veículos', level: 4, is_analytical: true, parent_code: '4.1.5' },
  { code: '4.1.5.02', name: 'Manutenção Veículos', level: 4, is_analytical: true, parent_code: '4.1.5' },
  { code: '4.1.5.03', name: 'Seguro Veículos', level: 4, is_analytical: true, parent_code: '4.1.5' },
  { code: '4.1.5.04', name: 'Estacionamento', level: 4, is_analytical: true, parent_code: '4.1.5' },
  { code: '4.1.5.05', name: 'Uber/Taxi/99', level: 4, is_analytical: true, parent_code: '4.1.5' },

  // 4.2 DESPESAS COM PESSOAL
  { code: '4.2', name: 'DESPESAS COM PESSOAL', level: 2, is_analytical: false, parent_code: '4' },
  { code: '4.2.1', name: 'Folha de Pagamento', level: 3, is_analytical: false, parent_code: '4.2' },
  { code: '4.2.1.01', name: 'Salários', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.02', name: 'INSS Patronal', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.03', name: 'FGTS', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.04', name: 'Vale Transporte', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.05', name: 'Vale Alimentação', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.06', name: 'Pró-labore', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.07', name: 'Férias', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.08', name: '13º Salário', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.09', name: 'PLR/Bônus', level: 4, is_analytical: true, parent_code: '4.2.1' },
  { code: '4.2.1.10', name: 'Plano de Saúde', level: 4, is_analytical: true, parent_code: '4.2.1' },

  // 4.3 DESPESAS FINANCEIRAS
  { code: '4.3', name: 'DESPESAS FINANCEIRAS', level: 2, is_analytical: false, parent_code: '4' },
  { code: '4.3.1', name: 'Encargos Bancários', level: 3, is_analytical: false, parent_code: '4.3' },
  { code: '4.3.1.01', name: 'Juros Bancários', level: 4, is_analytical: true, parent_code: '4.3.1' },
  { code: '4.3.1.02', name: 'Tarifas Bancárias', level: 4, is_analytical: true, parent_code: '4.3.1' },
  { code: '4.3.1.03', name: 'IOF', level: 4, is_analytical: true, parent_code: '4.3.1' },
  { code: '4.3.1.04', name: 'Multas e Juros Pagos', level: 4, is_analytical: true, parent_code: '4.3.1' },
  { code: '4.3.1.05', name: 'Taxas de Cartão', level: 4, is_analytical: true, parent_code: '4.3.1' },

  // 4.4 IMPOSTOS E TAXAS
  { code: '4.4', name: 'IMPOSTOS E TAXAS', level: 2, is_analytical: false, parent_code: '4' },
  { code: '4.4.1', name: 'Impostos Federais', level: 3, is_analytical: false, parent_code: '4.4' },
  { code: '4.4.1.01', name: 'ISS', level: 4, is_analytical: true, parent_code: '4.4.1' },
  { code: '4.4.1.02', name: 'PIS', level: 4, is_analytical: true, parent_code: '4.4.1' },
  { code: '4.4.1.03', name: 'COFINS', level: 4, is_analytical: true, parent_code: '4.4.1' },
  { code: '4.4.1.04', name: 'IRPJ', level: 4, is_analytical: true, parent_code: '4.4.1' },
  { code: '4.4.1.05', name: 'CSLL', level: 4, is_analytical: true, parent_code: '4.4.1' },
  { code: '4.4.1.06', name: 'Simples Nacional (DAS)', level: 4, is_analytical: true, parent_code: '4.4.1' },

  // 4.9 OUTRAS DESPESAS
  { code: '4.9', name: 'OUTRAS DESPESAS', level: 2, is_analytical: false, parent_code: '4' },
  { code: '4.9.9', name: 'Despesas Diversas', level: 3, is_analytical: false, parent_code: '4.9' },
  { code: '4.9.9.01', name: 'Despesas a Classificar', level: 4, is_analytical: true, parent_code: '4.9.9' },
  { code: '4.9.9.02', name: 'Despesas Eventuais', level: 4, is_analytical: true, parent_code: '4.9.9' },
];

async function criarPlanoDespesas() {
  console.log('='.repeat(80));
  console.log('📊 CRIANDO PLANO DE CONTAS DE DESPESAS');
  console.log('   Conforme FLUXO_VISUAL_AUTOMATIZADO.md');
  console.log('='.repeat(80));

  let criadas = 0;
  let jaExistentes = 0;
  let erros = 0;

  // Primeiro, garantir que a conta 4 (DESPESAS) existe
  const { data: contaPrincipal } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4')
    .single();

  if (!contaPrincipal) {
    console.log('❌ Conta principal 4 (DESPESAS) não encontrada. Criando...');
    await supabase.from('chart_of_accounts').insert({
      code: '4',
      name: 'DESPESAS',
      account_type: 'DESPESA',
      nature: 'DEVEDORA',
      level: 1,
      is_analytical: false,
      is_synthetic: true,
      accepts_entries: false
    });
  }

  // Criar cada conta
  for (const conta of CONTAS_DESPESAS) {
    try {
      // Verificar se já existe
      const { data: existente } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', conta.code)
        .maybeSingle();

      if (existente) {
        jaExistentes++;
        continue;
      }

      // Buscar ID do pai
      let parentId = null;
      if (conta.parent_code) {
        const { data: pai } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('code', conta.parent_code)
          .single();
        parentId = pai?.id;
      }

      // Criar conta
      const { error } = await supabase.from('chart_of_accounts').insert({
        code: conta.code,
        name: conta.name,
        account_type: 'DESPESA',
        nature: 'DEVEDORA',
        level: conta.level,
        is_analytical: conta.is_analytical,
        is_synthetic: !conta.is_analytical,
        accepts_entries: conta.is_analytical,
        parent_id: parentId
      });

      if (error) {
        console.log(`❌ Erro ao criar ${conta.code}: ${error.message}`);
        erros++;
      } else {
        console.log(`✅ Criada: ${conta.code} - ${conta.name}`);
        criadas++;
      }
    } catch (err) {
      console.log(`❌ Erro em ${conta.code}:`, err.message);
      erros++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 RESUMO');
  console.log('='.repeat(80));
  console.log(`   ✅ Contas criadas: ${criadas}`);
  console.log(`   ⏭️  Já existentes: ${jaExistentes}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log(`   📊 Total processadas: ${CONTAS_DESPESAS.length}`);
  console.log('='.repeat(80));
}

criarPlanoDespesas();
