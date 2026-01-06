import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function consultaDrCicero() {
  console.log('='.repeat(70));
  console.log('CONSULTA DR. CÍCERO - SALDO DE ABERTURA DE CLIENTES A RECEBER');
  console.log('='.repeat(70));

  console.log(`
QUESTÃO CONTÁBIL:
-----------------
O saldo de abertura de Clientes a Receber (R$ 298.527,29) foi lançado com
contrapartida na conta 5.3.02.02 (Saldo de Abertura - Clientes).

O usuário questiona que esta contrapartida está incorreta, pois:
- Conta do grupo 5 é RESULTADO (Receitas/Despesas)
- Saldo de abertura de ATIVO deveria ter contrapartida em PATRIMÔNIO LÍQUIDO
  (Lucros ou Prejuízos Acumulados)

ANÁLISE DO DR. CÍCERO (NBC TG):
-------------------------------

1. NATUREZA DAS CONTAS:
   - Grupo 1 (Ativo): Natureza DEVEDORA
   - Grupo 2 (Passivo): Natureza CREDORA
   - Grupo 3 (Patrimônio Líquido): Natureza CREDORA
   - Grupo 4 (Receitas): Natureza CREDORA
   - Grupo 5 (Despesas/Custos): Natureza DEVEDORA

2. SALDO DE ABERTURA:
   O saldo de abertura representa a posição patrimonial no início do exercício.
   Conforme NBC TG 26 (Apresentação das Demonstrações Contábeis):

   "O balanço patrimonial deve apresentar, no mínimo, as seguintes contas:
   (a) ativos: imobilizado, propriedades para investimento, ativos intangíveis...
   (b) passivos: provisões, passivos financeiros...
   (c) patrimônio líquido: capital social, reservas, lucros acumulados"

3. LANÇAMENTO CORRETO DE SALDO DE ABERTURA:

   Para transportar saldos de um exercício para outro, a contrapartida
   dos ATIVOS e PASSIVOS deve ser em conta do PATRIMÔNIO LÍQUIDO:

   INCORRETO (como está):
   D: 1.1.2.01 Clientes a Receber     R$ 298.527,29
   C: 5.3.02.02 Saldo de Abertura     R$ 298.527,29  ← CONTA DE RESULTADO!

   CORRETO (como deveria ser):
   D: 1.1.2.01 Clientes a Receber     R$ 298.527,29
   C: 2.3.01 Lucros/Prejuízos Acum.   R$ 298.527,29  ← PATRIMÔNIO LÍQUIDO

4. IMPACTO DO ERRO:
   - A conta 5.3.02.02 está INFLANDO o resultado (como se fosse receita)
   - Isso afeta o DRE, mostrando resultado maior do que o real
   - O Patrimônio Líquido está SUBESTIMADO

5. CORREÇÃO NECESSÁRIA:
   Reclassificar a conta de contrapartida de saldo de abertura:
   - De: 5.3.02.xx (Resultado)
   - Para: 2.3.01.xx (Patrimônio Líquido - Lucros/Prejuízos Acumulados)
`);

  // Verificar as contas de saldo de abertura no plano
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICANDO CONTAS DE SALDO DE ABERTURA NO PLANO');
  console.log('='.repeat(70));

  const { data: contas5, error: err5 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, nature')
    .like('code', '5.%')
    .order('code');

  if (err5) {
    console.log('Erro:', err5.message);
    return;
  }

  console.log('\nContas do Grupo 5 (Resultado):');
  for (const c of contas5 || []) {
    if (c.code.includes('abertura') || c.name.toLowerCase().includes('abertura')) {
      console.log('  ⚠️', c.code, '-', c.name, '| Tipo:', c.account_type, '| Natureza:', c.nature);
    }
  }

  // Verificar se existe conta de Lucros Acumulados
  console.log('\n\nContas do Grupo 2.3 (Patrimônio Líquido):');
  const { data: contas23, error: err23 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name, account_type, nature')
    .or('code.like.2.3%,code.like.3.%')
    .order('code');

  if (err23) {
    console.log('Erro:', err23.message);
  } else {
    for (const c of contas23 || []) {
      console.log(' ', c.code, '-', c.name, '| Tipo:', c.account_type);
    }
  }

  // Calcular impacto
  console.log('\n' + '='.repeat(70));
  console.log('IMPACTO NO DRE');
  console.log('='.repeat(70));

  const { data: saldosAbertura, error: saErr } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit, credit,
      chart_of_accounts!inner(code, name)
    `)
    .like('chart_of_accounts.code', '5.3%');

  if (saErr) {
    console.log('Erro:', saErr.message);
    return;
  }

  let totalCreditos5 = 0;
  for (const l of saldosAbertura || []) {
    totalCreditos5 += Number(l.credit) || 0;
  }

  console.log(`
Total de créditos em contas 5.3.xx (Saldo de Abertura): R$ ${totalCreditos5.toFixed(2)}

Este valor está INFLANDO o resultado do exercício!
Se não for corrigido, o DRE mostrará lucro R$ ${totalCreditos5.toFixed(2)} maior que o real.

RECOMENDAÇÃO DO DR. CÍCERO:
---------------------------
1. Criar conta 2.3.01 "Lucros ou Prejuízos Acumulados" (se não existir)
2. Reclassificar os lançamentos de saldo de abertura:
   - Estornar créditos em 5.3.xx
   - Lançar créditos em 2.3.01 (Patrimônio Líquido)
3. Verificar se a estrutura do plano de contas está conforme NBC TG 26

Fundamentação Legal:
- NBC TG 26 - Apresentação das Demonstrações Contábeis
- NBC TG ESTRUTURA CONCEITUAL - Estrutura Conceitual para Elaboração e Divulgação
  de Relatório Contábil-Financeiro
- ITG 2000 - Escrituração Contábil
`);
}

consultaDrCicero().catch(console.error);
