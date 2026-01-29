import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  const tenant = 'a53a4957-fe97-4856-b3ca-70045157b421';
  const bancoId = '10d5892d-a843-4034-8d62-9fec95b8fd56';
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('VERIFICANDO SALDO APÓS DELEÇÃO');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Verificar se o lançamento foi deletado
  const { data: check } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('id', '93ace5df-d999-41ce-bd44-df71004afa93');
  
  console.log('\nLançamento deletado?', check?.length === 0 ? '✅ SIM' : '❌ NÃO');
  
  // Calcular novo saldo
  const { data: lines } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', bancoId)
    .eq('tenant_id', tenant);
  
  let debits = 0, credits = 0;
  (lines||[]).forEach(l => {
    debits += parseFloat(l.debit)||0;
    credits += parseFloat(l.credit)||0;
  });
  
  const saldo = debits - credits;
  console.log('\nDébitos: R$', debits.toFixed(2));
  console.log('Créditos: R$', credits.toFixed(2));
  console.log('NOVO SALDO BANCO: R$', saldo.toFixed(2));
  console.log('Saldo esperado (extrato): R$ 18.553,54');
  console.log('Diferença: R$', (saldo - 18553.54).toFixed(2));
  
  if (Math.abs(saldo - 18553.54) < 0.01) {
    console.log('\n✅ SUCESSO! Saldo do banco agora bate com o extrato!');
  } else {
    console.log('\n⚠️ Ainda há diferença. Investigar...');
  }
}

verify();
