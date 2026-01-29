// scripts/corrigir_entries_orfaos.mjs
// Corrige entries de saldo de abertura que estão incompletos
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeamento dos entries órfãos
const ENTRIES_CORRIGIR = [
  {
    id: '4309a305-9366-49de-804f-b17ae2b97579',
    cliente: 'PM ADMINSTRAÇÃO E SERVIÇOS',
    contaCliente: '1.1.2.01.0052', // PM ADMINISTRACAO
    valor: 932.05
  },
  {
    id: 'ff660a5f-4d6c-4e09-9853-e73e30431184',
    cliente: 'UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA',
    contaCliente: '1.1.2.01.0101', // UNICAIXAS
    valor: 1604.67
  }
];

async function corrigirEntry(entry) {
  console.log(`\n📋 Corrigindo: ${entry.cliente}`);
  console.log(`   Entry ID: ${entry.id}`);
  console.log(`   Valor: R$ ${entry.valor.toFixed(2)}`);
  console.log(`   Conta Cliente: ${entry.contaCliente}`);

  // Buscar a conta do cliente
  const { data: contaCliente } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', entry.contaCliente)
    .single();

  if (!contaCliente) {
    console.log(`   ❌ Conta ${entry.contaCliente} não encontrada!`);
    return false;
  }

  console.log(`   Conta encontrada: ${contaCliente.name}`);

  // Verificar se já existe item de débito
  const { data: itemsExistentes } = await supabase
    .from('accounting_entry_items')
    .select('*')
    .eq('entry_id', entry.id)
    .gt('debit', 0);

  if (itemsExistentes && itemsExistentes.length > 0) {
    console.log(`   ⚠️  Já existe item de débito, pulando`);
    return true;
  }

  // Adicionar o item de débito faltante
  const { error } = await supabase
    .from('accounting_entry_items')
    .insert({
      entry_id: entry.id,
      account_id: contaCliente.id,
      debit: entry.valor,
      credit: 0,
      history: `Saldo devedor - 12/2024`
    });

  if (error) {
    console.log(`   ❌ Erro ao inserir item: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Item de débito adicionado!`);
  return true;
}

async function main() {
  console.log('='.repeat(80));
  console.log('CORREÇÃO DE ENTRIES ÓRFÃOS (SALDO DE ABERTURA)');
  console.log('='.repeat(80));

  let corrigidos = 0;

  for (const entry of ENTRIES_CORRIGIR) {
    if (await corrigirEntry(entry)) {
      corrigidos++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`RESULTADO: ${corrigidos}/${ENTRIES_CORRIGIR.length} entries corrigidos`);
  console.log('='.repeat(80));

  // Verificar se agora está balanceado
  console.log('\n📊 Verificando balanceamento após correção...');

  for (const entry of ENTRIES_CORRIGIR) {
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('entry_id', entry.id);

    const totalD = (items || []).reduce((s, i) => s + Number(i.debit || 0), 0);
    const totalC = (items || []).reduce((s, i) => s + Number(i.credit || 0), 0);

    if (Math.abs(totalD - totalC) < 0.01) {
      console.log(`   ✅ Entry ${entry.id.substring(0,8)}: D=${totalD.toFixed(2)} C=${totalC.toFixed(2)}`);
    } else {
      console.log(`   ❌ Entry ${entry.id.substring(0,8)}: D=${totalD.toFixed(2)} C=${totalC.toFixed(2)} (DESBALANCEADO)`);
    }
  }
}

main();
