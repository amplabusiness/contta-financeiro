/**
 * DR. CÍCERO - VERIFICAR RECEBIMENTOS DE JANEIRO
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(80));
  console.log('DR. CÍCERO - ANÁLISE DOS RECEBIMENTOS DE JANEIRO');
  console.log('='.repeat(80));

  // 1. Buscar conta Clientes a Receber
  const { data: contaClientes } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  // 2. Buscar todos os lançamentos
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit, credit, description,
      entry:accounting_entries(entry_date, description, reference_type)
    `)
    .eq('account_id', contaClientes.id)
    .order('entry(entry_date)');

  console.log('\n1. LANÇAMENTOS NA CONTA 1.1.2.01 (Clientes a Receber):\n');

  let totalDebitos = 0;
  let totalCreditos = 0;

  // Agrupar por tipo
  let saldoAbertura = { d: 0, c: 0 };
  let honorarios = { d: 0, c: 0 };
  let recebimentos = { d: 0, c: 0 };
  let outros = { d: 0, c: 0 };

  for (const l of linhas || []) {
    const d = parseFloat(l.debit || 0);
    const c = parseFloat(l.credit || 0);
    totalDebitos += d;
    totalCreditos += c;

    const desc = (l.description || l.entry?.description || '').toLowerCase();
    const refType = l.entry?.reference_type || '';

    if (desc.includes('saldo') && (desc.includes('abertura') || desc.includes('inicial'))) {
      saldoAbertura.d += d;
      saldoAbertura.c += c;
    } else if (desc.includes('honorário') || desc.includes('fatura') || refType === 'invoice') {
      honorarios.d += d;
      honorarios.c += c;
    } else if (desc.includes('recebimento') || desc.includes('pagamento') || desc.includes('liquidação') || desc.includes('pix') || refType === 'payment') {
      recebimentos.d += d;
      recebimentos.c += c;
    } else {
      outros.d += d;
      outros.c += c;
    }
  }

  console.log('   COMPOSIÇÃO:');
  console.log(`   - Saldo de Abertura:  D ${saldoAbertura.d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C ${saldoAbertura.c.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);
  console.log(`   - Honorários:         D ${honorarios.d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C ${honorarios.c.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);
  console.log(`   - Recebimentos:       D ${recebimentos.d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C ${recebimentos.c.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);
  console.log(`   - Outros:             D ${outros.d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C ${outros.c.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);
  console.log('   -'.repeat(40));
  console.log(`   TOTAL:                D ${totalDebitos.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C ${totalCreditos.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)}`);
  console.log(`   SALDO:                                          R$ ${(totalDebitos - totalCreditos).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 3. Verificar a conta 2.3.03.02 (Saldo de Abertura - Clientes)
  console.log('\n2. CONTA 2.3.03.02 (Saldo de Abertura - Clientes):\n');

  const { data: conta2302 } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '2.3.03.02')
    .single();

  const { data: linhas2302 } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit, credit, description,
      entry:accounting_entries(entry_date, description)
    `)
    .eq('account_id', conta2302?.id);

  let total2302D = 0, total2302C = 0;
  for (const l of linhas2302 || []) {
    const d = parseFloat(l.debit || 0);
    const c = parseFloat(l.credit || 0);
    total2302D += d;
    total2302C += c;
    console.log(`   ${l.entry?.entry_date} | D: ${d.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | C: ${c.toLocaleString('pt-BR', {minimumFractionDigits: 2}).padStart(12)} | ${l.entry?.description?.substring(0, 40)}`);
  }
  console.log(`   SALDO: R$ ${(total2302C - total2302D).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);

  // 4. Análise
  console.log(`

  ANÁLISE DR. CÍCERO:

  A conta 1.1.2.01 (Clientes a Receber) mostra:
  - Saldo de Abertura (Débito): R$ ${saldoAbertura.d.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
  - Honorários Janeiro (Débito): R$ ${honorarios.d.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
  - Recebimentos Janeiro (Crédito): R$ ${recebimentos.c.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
  - Outros (Crédito): R$ ${outros.c.toLocaleString('pt-BR', {minimumFractionDigits: 2})}

  Se os recebimentos de R$ 298.527,29 foram:

  D: 1.1.1.05 (Banco Sicredi)     R$ 298.527,29
  C: 1.1.2.01 (Clientes a Receber) R$ 298.527,29

  Então a conta 2.3.03.02 NÃO deveria ser afetada!
  O saldo de R$ 298.527,29 nessa conta é apenas a CONTRAPARTIDA
  do saldo de abertura inicial.

  O problema pode ser que os R$ 298.527,29 estão classificados
  como "Outros" em vez de "Recebimentos".
  `);

  // 5. Mostrar os "Outros" para ver o que são
  console.log('\n3. LANÇAMENTOS CLASSIFICADOS COMO "OUTROS":\n');

  for (const l of linhas || []) {
    const d = parseFloat(l.debit || 0);
    const c = parseFloat(l.credit || 0);
    const desc = (l.description || l.entry?.description || '').toLowerCase();
    const refType = l.entry?.reference_type || '';

    const ehSaldoAbertura = desc.includes('saldo') && (desc.includes('abertura') || desc.includes('inicial'));
    const ehHonorario = desc.includes('honorário') || desc.includes('fatura') || refType === 'invoice';
    const ehRecebimento = desc.includes('recebimento') || desc.includes('pagamento') || desc.includes('liquidação') || desc.includes('pix') || refType === 'payment';

    if (!ehSaldoAbertura && !ehHonorario && !ehRecebimento && (d > 0 || c > 0)) {
      console.log(`   ${l.entry?.entry_date} | D: ${d.toFixed(2).padStart(12)} | C: ${c.toFixed(2).padStart(12)} | ${(l.description || l.entry?.description || '').substring(0, 50)}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

verificar().catch(console.error);
