// scripts/correcao_contabil/56_diagnostico_creditos_faltantes.cjs
// Verificar se os créditos (pagamentos) estão sendo registrados

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnosticar() {
  console.log('='.repeat(100));
  console.log('DIAGNÓSTICO: CRÉDITOS (PAGAMENTOS) NAS CONTAS DE CLIENTES');
  console.log('='.repeat(100));

  // 1. Buscar subcontas de clientes (sem CONSOLIDADO)
  const { data: subcontas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .not('name', 'ilike', '%[CONSOLIDADO]%')
    .order('code');

  console.log(`\n📋 Subcontas de clientes: ${subcontas?.length || 0}`);

  // 2. Para cada subconta com saldo, verificar se tem créditos
  let totalDebitos = 0;
  let totalCreditos = 0;
  let contasSemCredito = 0;

  for (const conta of subcontas || []) {
    // Buscar em ambas as tabelas
    const { data: items } = await supabase
      .from('accounting_entry_items')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', conta.id);

    const debitos = (items?.reduce((s, i) => s + Number(i.debit || 0), 0) || 0) +
                   (lines?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0);
    const creditos = (items?.reduce((s, i) => s + Number(i.credit || 0), 0) || 0) +
                    (lines?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0);
    const saldo = debitos - creditos;

    if (debitos > 0) {
      totalDebitos += debitos;
      totalCreditos += creditos;

      if (creditos === 0 && saldo > 0) {
        contasSemCredito++;
        console.log(`   ⚠️  ${conta.code} - ${conta.name.substring(0, 35)}`);
        console.log(`      Débitos: R$ ${debitos.toFixed(2)} | Créditos: R$ ${creditos.toFixed(2)} | Saldo: R$ ${saldo.toFixed(2)}`);
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('📌 RESUMO:');
  console.log('='.repeat(100));
  console.log(`   Total Débitos (honorários lançados): R$ ${totalDebitos.toFixed(2)}`);
  console.log(`   Total Créditos (pagamentos registrados): R$ ${totalCreditos.toFixed(2)}`);
  console.log(`   Saldo A Receber (D - C): R$ ${(totalDebitos - totalCreditos).toFixed(2)}`);
  console.log(`   Contas SEM créditos (sem pagamento registrado): ${contasSemCredito}`);

  // 3. Comparar com client_opening_balance
  console.log('\n📊 COMPARAÇÃO COM client_opening_balance:');

  const { data: honorarios } = await supabase
    .from('client_opening_balance')
    .select('amount, paid_amount, status');

  const totalHonorarios = honorarios?.reduce((s, h) => s + Number(h.amount || 0), 0) || 0;
  const totalPagoOB = honorarios?.reduce((s, h) => s + Number(h.paid_amount || 0), 0) || 0;
  const totalPendenteOB = honorarios?.reduce((s, h) => {
    if (h.status === 'paid') return s;
    return s + (Number(h.amount || 0) - Number(h.paid_amount || 0));
  }, 0) || 0;

  console.log(`   Total honorários: R$ ${totalHonorarios.toFixed(2)}`);
  console.log(`   Total pago (paid_amount): R$ ${totalPagoOB.toFixed(2)}`);
  console.log(`   Total pendente (status != paid): R$ ${totalPendenteOB.toFixed(2)}`);

  // 4. Diagnóstico
  console.log('\n' + '='.repeat(100));
  console.log('🔍 DIAGNÓSTICO:');
  console.log('='.repeat(100));

  const saldoContabil = totalDebitos - totalCreditos;
  const diferenca = saldoContabil - totalPendenteOB;

  if (Math.abs(diferenca) < 100) {
    console.log('✅ Saldos batem! A contabilidade está correta.');
  } else if (totalCreditos === 0) {
    console.log('❌ PROBLEMA: Nenhum crédito (pagamento) registrado na contabilidade!');
    console.log('   Os pagamentos marcados em client_opening_balance NÃO estão gerando');
    console.log('   lançamentos de CRÉDITO nas contas de clientes.');
    console.log('');
    console.log('   SOLUÇÃO: Ao marcar um honorário como PAGO, deve-se fazer o lançamento:');
    console.log('   D - Banco (1.1.1.05)');
    console.log('   C - Cliente a Receber (1.1.2.01.xxxx)');
  } else {
    console.log(`⚠️  Diferença de R$ ${diferenca.toFixed(2)} entre contabilidade e client_opening_balance`);
    console.log('   Pode haver pagamentos parciais ou honorários sem lançamento contábil.');
  }

  console.log('\n' + '='.repeat(100));
}

diagnosticar().catch(console.error);
