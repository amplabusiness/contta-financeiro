// scripts/correcao_contabil/42_verificar_honorarios_times.cjs
// Verificar honorários do cliente TIMES NEGOCIOS IMOBILIARIOS

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('='.repeat(100));
  console.log('VERIFICANDO HONORÁRIOS - TIMES NEGOCIOS IMOBILIARIOS');
  console.log('='.repeat(100));

  // 1. Buscar cliente
  const { data: clientes, error: errCliente } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%TIMES%NEGOCIO%IMOBILI%');

  if (errCliente) {
    console.error('Erro ao buscar cliente:', errCliente.message);
    return;
  }

  console.log('\n📌 CLIENTES ENCONTRADOS:');
  clientes?.forEach(c => {
    console.log(`  ID: ${c.id}`);
    console.log(`  Nome: ${c.name}`);
    console.log(`  Valor Honorário Atual: R$ ${c.monthly_fee || 'N/A'}`);
    console.log('');
  });

  if (!clientes || clientes.length === 0) {
    console.log('  Nenhum cliente encontrado com esse nome');
    return;
  }

  const cliente = clientes[0];

  // 2. Buscar honorários do cliente (tabela invoices)
  console.log('\n' + '='.repeat(80));
  console.log('HONORÁRIOS CADASTRADOS (2023) - Tabela invoices');
  console.log('='.repeat(80));

  const { data: honorarios, error: errHon } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', cliente.id)
    .gte('competence_date', '2023-01-01')
    .lte('competence_date', '2023-12-31')
    .order('competence_date');

  if (errHon) {
    console.error('Erro ao buscar honorários:', errHon.message);
    return;
  }

  console.log(`\nTotal de honorários em 2023: ${honorarios?.length || 0}`);

  if (honorarios && honorarios.length > 0) {
    console.log('\n| # | Competência | Vencimento | Valor | Status | Pagamento |');
    console.log('|---|-------------|------------|-------|--------|-----------|');

    honorarios.forEach((h, i) => {
      const compDate = new Date(h.competence_date);
      const comp = compDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const venc = new Date(h.due_date).toLocaleDateString('pt-BR');
      const valor = `R$ ${Number(h.amount).toFixed(2)}`;
      const status = h.status || 'pending';
      const pag = h.payment_date ? new Date(h.payment_date).toLocaleDateString('pt-BR') : '-';

      console.log(`| ${(i+1).toString().padStart(2)} | ${comp.padEnd(11)} | ${venc.padEnd(10)} | ${valor.padEnd(10)} | ${status.padEnd(6)} | ${pag.padEnd(9)} |`);
    });

    // Verificar competências existentes
    const competencias = honorarios.map(h => {
      const d = new Date(h.competence_date);
      return d.getMonth() + 1; // 1-12
    });

    console.log('\n  Competências encontradas:', competencias.join(', '));

    // Verificar se tem 13º
    const tem13 = honorarios.some(h => h.is_13th || h.description?.includes('13'));
    console.log(`  Tem 13º salário: ${tem13 ? 'SIM' : 'NÃO'}`);
  } else {
    console.log('  Nenhum honorário cadastrado em 2023');
  }

  // 3. Buscar honorários de 2024
  console.log('\n' + '='.repeat(80));
  console.log('HONORÁRIOS CADASTRADOS (2024)');
  console.log('='.repeat(80));

  const { data: honorarios2024 } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', cliente.id)
    .gte('competence_date', '2024-01-01')
    .lte('competence_date', '2024-12-31')
    .order('competence_date');

  console.log(`\nTotal de honorários em 2024: ${honorarios2024?.length || 0}`);

  if (honorarios2024 && honorarios2024.length > 0) {
    console.log('\n| # | Competência | Vencimento | Valor | Status |');
    console.log('|---|-------------|------------|-------|--------|');

    honorarios2024.forEach((h, i) => {
      const comp = new Date(h.competence_date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const venc = new Date(h.due_date).toLocaleDateString('pt-BR');
      const valor = `R$ ${Number(h.amount).toFixed(2)}`;
      const status = h.status || 'pending';

      console.log(`| ${(i+1).toString().padStart(2)} | ${comp.padEnd(11)} | ${venc.padEnd(10)} | ${valor.padEnd(10)} | ${status.padEnd(6)} |`);
    });
  }

  // 4. Buscar honorários de 2025
  console.log('\n' + '='.repeat(80));
  console.log('HONORÁRIOS CADASTRADOS (2025)');
  console.log('='.repeat(80));

  const { data: honorarios2025 } = await supabase
    .from('invoices')
    .select('*')
    .eq('client_id', cliente.id)
    .gte('competence_date', '2025-01-01')
    .lte('competence_date', '2025-12-31')
    .order('competence_date');

  console.log(`\nTotal de honorários em 2025: ${honorarios2025?.length || 0}`);

  if (honorarios2025 && honorarios2025.length > 0) {
    console.log('\n| # | Competência | Vencimento | Valor | Status |');
    console.log('|---|-------------|------------|-------|--------|');

    honorarios2025.forEach((h, i) => {
      const comp = new Date(h.competence_date).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const venc = new Date(h.due_date).toLocaleDateString('pt-BR');
      const valor = `R$ ${Number(h.amount).toFixed(2)}`;
      const status = h.status || 'pending';

      console.log(`| ${(i+1).toString().padStart(2)} | ${comp.padEnd(11)} | ${venc.padEnd(10)} | ${valor.padEnd(10)} | ${status.padEnd(6)} |`);
    });
  }

  // 5. Verificar conta contábil
  console.log('\n' + '='.repeat(80));
  console.log('CONTA CONTÁBIL');
  console.log('='.repeat(80));

  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .ilike('name', '%TIMES%NEGOCIO%')
    .eq('is_active', true);

  conta?.forEach(c => {
    console.log(`  ${c.code} - ${c.name}`);
  });

  // 6. Resumo do que deveria existir (conforme planilha do usuário)
  console.log('\n' + '='.repeat(80));
  console.log('RESUMO - O QUE DEVERIA EXISTIR EM 2023 (conforme planilha)');
  console.log('='.repeat(80));

  const honorariosEsperados = [
    { comp: 'jan/23', venc: '05/02/2023', valor: 969.54, status: 'PAGO', pag: 'PIX C6 29/03/2023' },
    { comp: 'fev/23', venc: '05/03/2023', valor: 969.54, status: 'PAGO', pag: 'PIX C6 29/03/2023' },
    { comp: 'mar/23', venc: '05/04/2023', valor: 969.54, status: 'PAGO', pag: 'PIX C6 26/04/2023' },
    { comp: 'abr/23', venc: '05/05/2023', valor: 969.54, status: 'DEVENDO', pag: '' },
    { comp: 'mai/23', venc: '05/06/2023', valor: 969.54, status: 'PAGO', pag: 'PIX C6 14/06/2023' },
    { comp: 'jun/23', venc: '05/07/2023', valor: 969.54, status: 'PAGO', pag: 'BOLETO SICREDI 05/07/2023' },
    { comp: 'jul/23', venc: '05/08/2023', valor: 969.54, status: 'PAGO', pag: 'BOLETO SICREDI 05/08/2023' },
    { comp: 'ago/23', venc: '05/09/2023', valor: 969.54, status: 'DEVENDO', pag: '' },
    { comp: 'set/23', venc: '05/10/2023', valor: 969.54, status: 'PAGO', pag: 'BOLETO SICREDI 05/10/2023' },
    { comp: 'out/23', venc: '06/11/2023', valor: 969.54, status: 'PAGO', pag: 'BOLETO SICREDI 06/11/2023' },
    { comp: 'nov/23', venc: '05/12/2023', valor: 982.94, status: 'DEVENDO', pag: '' },
    { comp: '13/23', venc: '20/12/2023', valor: 982.94, status: 'DEVENDO', pag: '13º SALÁRIO' },
    { comp: 'dez/23', venc: '05/01/2024', valor: 969.54, status: 'PAGO', pag: 'PIX SICREDI 04/01/2024' },
  ];

  console.log('\n| # | Competência | Valor Base | Status | Observação |');
  console.log('|---|-------------|------------|--------|------------|');

  let totalDevendo = 0;
  let totalPago = 0;
  honorariosEsperados.forEach((h, i) => {
    if (h.status === 'DEVENDO') totalDevendo += h.valor;
    else totalPago += h.valor;
    console.log(`| ${(i+1).toString().padStart(2)} | ${h.comp.padEnd(11)} | R$ ${h.valor.toFixed(2).padStart(7)} | ${h.status.padEnd(6)} | ${h.pag.substring(0, 25)} |`);
  });

  console.log('\n📊 RESUMO FINANCEIRO 2023:');
  console.log(`   Total Honorários: R$ ${(totalDevendo + totalPago).toFixed(2)}`);
  console.log(`   Total PAGO: R$ ${totalPago.toFixed(2)}`);
  console.log(`   Total DEVENDO: R$ ${totalDevendo.toFixed(2)}`);
  console.log('   (abr/23 + ago/23 + nov/23 + 13º/23 = R$ 3.904,96)');
}

verificar().catch(console.error);
