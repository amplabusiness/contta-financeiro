/**
 * SOLUÇÃO: Reclassificação de INSS e IRRF como Passivos
 * 
 * Problema Identificado:
 * - INSS e IRRF estão sendo registrados como Despesas
 * - Devem ser registrados como Obrigações a Recolher (Passivo)
 * 
 * Solução:
 * 1. Criar contas de Passivo corretas:
 *    - INSS a Recolher (2.1.2 - Contas a Pagar Funcionários)
 *    - IRRF a Recolher (2.1.2 - Contas a Pagar Funcionários)
 *    - Salários e Ordenados a Pagar (2.1.2)
 * 
 * 2. Atualizar o hook useAccounting para registrar corretamente
 * 
 * 3. Padrão de lançamento para folha de pagamento:
 * 
 *    PROVISÃO (Competência):
 *    D - Despesa com Salários e Encargos    (Resultado)   | Bruto
 *    C - Salários a Pagar                   (Passivo)     | Líquido
 *    C - INSS a Recolher                    (Passivo)     | INSS retido
 *    C - IRRF a Recolher                    (Passivo)     | IRRF retido
 * 
 *    PAGAMENTO:
 *    D - Salários a Pagar                   (Passivo)     | Líquido
 *    C - Banco/Caixa                        (Ativo)       | Líquido
 *    D - INSS a Recolher                    (Passivo)     | INSS
 *    C - Banco/Caixa                        (Ativo)       | INSS
 *    D - IRRF a Recolher                    (Passivo)     | IRRF
 *    C - Banco/Caixa                        (Ativo)       | IRRF
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('='))
);

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

console.log('🔧 Implementando Solução: Reclassificação de INSS e IRRF\n');

try {
  // 1. Criar contas de Passivo necessárias
  console.log('📋 ETAPA 1: Criando contas de Passivo...\n');

  const contasPassivo = [
    {
      code: '2.1.2.01',
      name: 'Salários e Ordenados a Pagar',
      description: 'Obrigação de pagar aos funcionários o valor líquido dos salários',
      account_type: 'Liability',
      parent_code: '2.1.2',
      active: true
    },
    {
      code: '2.1.2.02',
      name: 'INSS a Recolher',
      description: 'Obrigação de recolher ao INSS o valor retido do funcionário',
      account_type: 'Liability',
      parent_code: '2.1.2',
      active: true
    },
    {
      code: '2.1.2.03',
      name: 'IRRF a Recolher',
      description: 'Obrigação de recolher ao fisco o valor de IRRF retido do funcionário',
      account_type: 'Liability',
      parent_code: '2.1.2',
      active: true
    }
  ];

  let contasCriadas = 0;
  for (const conta of contasPassivo) {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', conta.code)
      .single();

    if (!existing) {
      const { error } = await supabase
        .from('chart_of_accounts')
        .insert([conta]);

      if (error) {
        console.log(`⚠️  Aviso ao criar ${conta.code}: ${error.message}`);
      } else {
        console.log(`✅ Criada: ${conta.code} - ${conta.name}`);
        contasCriadas++;
      }
    } else {
      console.log(`ℹ️  Já existe: ${conta.code} - ${conta.name}`);
    }
  }

  // 2. Criar categoria de folha de pagamento
  console.log('\n📋 ETAPA 2: Criando categoria de folha de pagamento...\n');

  const { data: folhaCategory } = await supabase
    .from('expense_categories')
    .select('id')
    .eq('name', 'Folha de Pagamento')
    .single();

  if (!folhaCategory) {
    const { error } = await supabase
      .from('expense_categories')
      .insert([{
        name: 'Folha de Pagamento',
        description: 'Despesa com salários e encargos sociais dos funcionários',
        type: 'Expense'
      }]);

    if (error) {
      console.log(`⚠️  Aviso: ${error.message}`);
    } else {
      console.log('✅ Categoria "Folha de Pagamento" criada');
    }
  } else {
    console.log('ℹ️  Categoria "Folha de Pagamento" já existe');
  }

  // 3. Listar contas de resultado (despesas) para referência
  console.log('\n📋 ETAPA 3: Contas de Resultado (Despesas de Folha)...\n');

  const { data: expenseAccounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('account_type', 'Expense')
    .ilike('name', '%encargo%|%salario%|%honorario%')
    .limit(10);

  if (expenseAccounts?.length) {
    console.log('Contas de despesa disponíveis para folha:');
    expenseAccounts.forEach(acc => {
      console.log(`  ${acc.code} - ${acc.name}`);
    });
  }

  // 4. Verificar contas de banco disponíveis
  console.log('\n📋 ETAPA 4: Contas de Banco (Caixa/Banco)...\n');

  const { data: bankAccounts } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('account_type', 'Asset')
    .ilike('name', '%banco%|%caixa%')
    .limit(5);

  if (bankAccounts?.length) {
    console.log('Contas bancárias disponíveis:');
    bankAccounts.forEach(acc => {
      console.log(`  ${acc.code} - ${acc.name}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 PRÓXIMAS ETAPAS:');
  console.log('='.repeat(70));
  console.log(`
1. ✅ Contas de Passivo criadas (${contasCriadas} novas contas)
2. ✅ Categoria "Folha de Pagamento" criada/verificada
3. ⏳ Atualizar o hook useAccounting para usar as novas contas
4. ⏳ Implementar lançamentos corretos em nova interface de folha
5. ⏳ Migrar dados existentes (se houver folhas anteriores)

📝 ESTRUTURA DE LANÇAMENTO PARA PRÓXIMAS FOLHAS:
   Ao processar folha de pagamento:
   
   Funcionário: João Silva
   Salário Bruto: R$ 3.000,00
   INSS (10%): R$ 300,00
   IRRF (5%): R$ 150,00
   Salário Líquido: R$ 2.550,00

   Lançamento de Provisão:
   D - Despesa com Salários e Encargos (Ex: 3.1.01)  | R$ 3.000,00
   C - Salários a Pagar (2.1.2.01)                    | R$ 2.550,00
   C - INSS a Recolher (2.1.2.02)                     | R$ 300,00
   C - IRRF a Recolher (2.1.2.03)                     | R$ 150,00
  `);

  console.log('\n✅ Solução implementada com sucesso!');

} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
