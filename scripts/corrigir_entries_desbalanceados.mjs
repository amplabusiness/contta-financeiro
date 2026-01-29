// Script para corrigir entries desbalanceados adicionando débitos faltantes
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Mapeamento de descrições para contas de despesa
const MAPEAMENTO_DESPESAS = {
  'FGTS': { code: '4.1.1.02.01', name: 'FGTS' },
  'INSS': { code: '4.1.1.02.02', name: 'INSS Patronal' },
  'Taxas e Licenças': { code: '4.1.3.01.01', name: 'Taxas e Licenças' },
  'Softwares e Sistemas': { code: '4.1.3.01.02', name: 'Softwares e Sistemas' },
  'Vale Transporte': { code: '4.1.1.03.01', name: 'Vale Transporte' },
  'Vale Refeição': { code: '4.1.1.03.02', name: 'Vale Refeição/Alimentação' },
  'Adiantamento Sérgio': { code: '1.1.2.05', name: 'Adiantamentos a Funcionários' },
  'Adiantamento Victor': { code: '1.1.2.05', name: 'Adiantamentos a Funcionários' },
  'Adiantamentos - Nayara': { code: '1.1.2.05', name: 'Adiantamentos a Funcionários' },
  'Adiantamentos': { code: '1.1.2.05', name: 'Adiantamentos a Funcionários' },
  'Empréstimos de Sócios': { code: '2.1.2.01', name: 'Empréstimos de Sócios' },
  'Energia': { code: '4.1.2.02', name: 'Energia Elétrica' },
  'Telefone': { code: '4.1.2.03', name: 'Telefone e Internet' },
  'Aluguel': { code: '4.1.2.01', name: 'Aluguel' },
  'Material de Escritório': { code: '4.1.2.04', name: 'Material de Escritório' },
  'Contador': { code: '4.1.3.03', name: 'Serviços Contábeis' },
  'Honorários': { code: '4.1.3.03', name: 'Honorários Profissionais' },
  'default': { code: '4.1.9.99', name: 'Outras Despesas' }
};

function identificarContaDespesa(descricao) {
  const desc = descricao.toLowerCase();

  for (const [pattern, conta] of Object.entries(MAPEAMENTO_DESPESAS)) {
    if (pattern !== 'default' && desc.includes(pattern.toLowerCase())) {
      return conta;
    }
  }

  return MAPEAMENTO_DESPESAS.default;
}

async function buscarContaId(code) {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', code)
    .single();
  return data;
}

async function criarContaSeNaoExiste(code, name) {
  // Verificar se existe
  let conta = await buscarContaId(code);
  if (conta) return conta;

  // Determinar parent_id
  const parentCode = code.split('.').slice(0, -1).join('.');
  const { data: parent } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', parentCode)
    .single();

  // Determinar tipo
  let type = 'expense';
  if (code.startsWith('1.')) type = 'asset';
  else if (code.startsWith('2.')) type = 'liability';
  else if (code.startsWith('3.')) type = 'revenue';
  else if (code.startsWith('5.')) type = 'equity';

  // Criar conta
  const { data: novaConta, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code,
      name,
      type,
      parent_id: parent?.id || null,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.log(`   ⚠️ Erro ao criar conta ${code}: ${error.message}`);
    return null;
  }

  console.log(`   ✅ Conta criada: ${code} - ${name}`);
  return novaConta;
}

async function corrigir() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  CORREÇÃO DE ENTRIES DESBALANCEADOS                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  // 1. Buscar entries desbalanceados
  console.log('1. Buscando entries desbalanceados...');
  const { data: entries, error } = await supabase
    .from('accounting_entries')
    .select(`
      id,
      entry_date,
      description,
      source_type,
      source_id,
      items:accounting_entry_items(id, debit, credit, account_id)
    `)
    .eq('source_type', 'bank_transaction')
    .eq('is_draft', false);

  if (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return;
  }

  const desbalanceados = (entries || []).filter(e => {
    const d = e.items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const c = e.items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    return Math.abs(d - c) > 0.01 && c > d; // Só corrigir os que têm mais crédito que débito
  });

  console.log(`   Total desbalanceados: ${desbalanceados.length}\n`);

  // 2. Cache de contas
  const cacheContas = {};

  // 3. Corrigir cada entry
  console.log('2. Corrigindo entries...\n');
  let corrigidos = 0;
  let erros = 0;

  for (const entry of desbalanceados) {
    const totalCredito = entry.items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
    const totalDebito = entry.items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
    const valorFaltante = totalCredito - totalDebito;

    // Identificar conta de despesa
    const contaInfo = identificarContaDespesa(entry.description || '');

    // Buscar ou criar conta
    if (!cacheContas[contaInfo.code]) {
      cacheContas[contaInfo.code] = await criarContaSeNaoExiste(contaInfo.code, contaInfo.name);
    }
    const conta = cacheContas[contaInfo.code];

    if (!conta) {
      console.log(`   ⚠️ Não foi possível obter conta para: ${entry.description}`);
      erros++;
      continue;
    }

    // Inserir item de débito faltante
    const { error: insertError } = await supabase
      .from('accounting_entry_items')
      .insert({
        entry_id: entry.id,
        account_id: conta.id,
        debit: valorFaltante,
        credit: 0,
        history: `Débito corretivo - ${entry.description}`
      });

    if (insertError) {
      console.log(`   ❌ Erro ao inserir item: ${insertError.message}`);
      erros++;
    } else {
      console.log(`   ✅ ${entry.entry_date} | R$ ${valorFaltante.toFixed(2).padStart(10)} | ${conta.code} | ${entry.description?.substring(0, 40)}`);
      corrigidos++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`   RESUMO: ${corrigidos} corrigidos | ${erros} erros`);

  // 4. Verificar resultado
  console.log('\n3. Verificando resultado final...');
  const { data: todosItems } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit, entry:accounting_entries!inner(is_draft)')
    .eq('entry.is_draft', false);

  const totalDebitos = todosItems?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0;
  const totalCreditos = todosItems?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0;
  const diferenca = Math.abs(totalDebitos - totalCreditos);

  console.log(`   Total Débitos: R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Total Créditos: R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Diferença: R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Status: ${diferenca < 0.01 ? '✅ BALANCEADO' : '⚠️ AINDA DESBALANCEADO'}`);

  console.log('\n╚════════════════════════════════════════════════════════════════════╝');
}

corrigir().catch(console.error);
