import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigirSaldoAbertura() {
  console.log('='.repeat(70));
  console.log('CORREÇÃO DE SALDO DE ABERTURA - DR. CÍCERO');
  console.log('Movendo contas do grupo 5 (Resultado) para grupo 2 (Patrimônio Líquido)');
  console.log('='.repeat(70));

  // 1. Verificar se já existem contas no grupo 2.3
  console.log('\n1. Verificando contas existentes no grupo 2.3...');
  const { data: contas23, error: err23 } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '2.3%')
    .order('code');

  if (err23) {
    console.log('Erro:', err23.message);
    return;
  }

  console.log('Contas 2.3.xx existentes:', contas23?.length || 0);
  for (const c of contas23 || []) {
    console.log('  -', c.code, c.name);
  }

  // 2. Buscar o usuário para created_by
  const { data: { user } } = await supabase.auth.getUser();
  const createdBy = user?.id || null;

  // 3. Criar estrutura do grupo 2.3 se não existir
  console.log('\n2. Criando estrutura do Patrimônio Líquido (2.3)...');

  const contasParaCriar = [
    { code: '2', name: 'PASSIVO', account_type: 'PASSIVO', nature: 'CREDORA', level: 1, is_analytical: false },
    { code: '2.3', name: 'PATRIMÔNIO LÍQUIDO', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 2, is_analytical: false },
    { code: '2.3.01', name: 'Capital Social', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 3, is_analytical: false },
    { code: '2.3.01.01', name: 'Capital Social Integralizado', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
    { code: '2.3.02', name: 'Lucros ou Prejuízos Acumulados', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 3, is_analytical: false },
    { code: '2.3.02.01', name: 'Lucros Acumulados', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
    { code: '2.3.02.02', name: 'Prejuízos Acumulados', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
    { code: '2.3.03', name: 'Saldos de Abertura', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 3, is_analytical: false },
    { code: '2.3.03.01', name: 'Saldo de Abertura - Disponibilidades', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
    { code: '2.3.03.02', name: 'Saldo de Abertura - Clientes', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
    { code: '2.3.03.03', name: 'Saldo de Abertura - Outros Ativos', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true },
    { code: '2.3.03.99', name: 'Saldos de Abertura - Diversos', account_type: 'PATRIMONIO_LIQUIDO', nature: 'CREDORA', level: 4, is_analytical: true }
  ];

  for (const conta of contasParaCriar) {
    // Verificar se já existe
    const { data: existe } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', conta.code)
      .maybeSingle();

    if (existe) {
      console.log('  ✓', conta.code, 'já existe');
      continue;
    }

    // Criar a conta
    const { error: insertErr } = await supabase
      .from('chart_of_accounts')
      .insert({
        ...conta,
        is_active: true,
        created_by: createdBy
      });

    if (insertErr) {
      console.log('  ✗ Erro ao criar', conta.code, ':', insertErr.message);
    } else {
      console.log('  ✓ Criada:', conta.code, '-', conta.name);
    }
  }

  // 4. Buscar IDs das contas antigas e novas
  console.log('\n3. Buscando IDs das contas para reclassificação...');

  const contasAntigas = [
    { antiga: '5.2.1.02', nova: '2.3.03.99' },
    { antiga: '5.3.02.01', nova: '2.3.03.01' },
    { antiga: '5.3.02.02', nova: '2.3.03.02' },
    { antiga: '5.3.02.03', nova: '2.3.03.03' }
  ];

  const mapeamento = [];

  for (const map of contasAntigas) {
    const { data: antigaData } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', map.antiga)
      .maybeSingle();

    const { data: novaData } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name')
      .eq('code', map.nova)
      .maybeSingle();

    if (antigaData && novaData) {
      mapeamento.push({
        antigaId: antigaData.id,
        antigaCodigo: antigaData.code,
        novaId: novaData.id,
        novaCodigo: novaData.code
      });
      console.log('  Mapeamento:', antigaData.code, '→', novaData.code);
    } else if (antigaData) {
      console.log('  ⚠️', map.antiga, 'existe, mas', map.nova, 'não foi encontrada');
    }
  }

  // 5. Atualizar os lançamentos
  console.log('\n4. Reclassificando lançamentos...');

  let totalLinhasAtualizadas = 0;

  for (const map of mapeamento) {
    // Contar linhas afetadas
    const { count: countBefore } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', map.antigaId);

    console.log('  ', map.antigaCodigo, '→', map.novaCodigo, ':', countBefore || 0, 'linhas');

    if (countBefore && countBefore > 0) {
      // Atualizar as linhas
      const { error: updateErr } = await supabase
        .from('accounting_entry_lines')
        .update({ account_id: map.novaId })
        .eq('account_id', map.antigaId);

      if (updateErr) {
        console.log('    ✗ Erro:', updateErr.message);
      } else {
        console.log('    ✓ Atualizado!');
        totalLinhasAtualizadas += countBefore;
      }
    }
  }

  console.log('\nTotal de linhas reclassificadas:', totalLinhasAtualizadas);

  // 6. Desativar contas antigas
  console.log('\n5. Desativando contas antigas do grupo 5...');

  for (const map of mapeamento) {
    const { error: deactivateErr } = await supabase
      .from('chart_of_accounts')
      .update({ is_active: false })
      .eq('code', map.antigaCodigo);

    if (deactivateErr) {
      console.log('  ✗ Erro ao desativar', map.antigaCodigo, ':', deactivateErr.message);
    } else {
      console.log('  ✓ Desativada:', map.antigaCodigo);
    }
  }

  // 7. Verificar resultado
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICAÇÃO FINAL');
  console.log('='.repeat(70));

  // Verificar saldos nas novas contas
  const { data: novosSaldos, error: saldoErr } = await supabase
    .from('accounting_entry_lines')
    .select(`
      debit, credit,
      chart_of_accounts!inner(code, name)
    `)
    .like('chart_of_accounts.code', '2.3%');

  if (saldoErr) {
    console.log('Erro ao verificar saldos:', saldoErr.message);
    return;
  }

  let totalDebito = 0;
  let totalCredito = 0;

  const saldosPorConta = new Map();

  for (const l of novosSaldos || []) {
    const code = l.chart_of_accounts?.code || 'N/A';
    const d = Number(l.debit) || 0;
    const c = Number(l.credit) || 0;

    if (!saldosPorConta.has(code)) {
      saldosPorConta.set(code, { debito: 0, credito: 0 });
    }
    saldosPorConta.get(code).debito += d;
    saldosPorConta.get(code).credito += c;

    totalDebito += d;
    totalCredito += c;
  }

  console.log('\nSaldos nas contas 2.3.xx (Patrimônio Líquido):');
  for (const [code, saldo] of saldosPorConta) {
    console.log('  ', code.padEnd(15), 'D:', saldo.debito.toFixed(2).padStart(12), 'C:', saldo.credito.toFixed(2).padStart(12));
  }

  console.log('\nTotal Débitos:', totalDebito.toFixed(2));
  console.log('Total Créditos:', totalCredito.toFixed(2));

  console.log('\n✅ CORREÇÃO CONCLUÍDA!');
  console.log('Os saldos de abertura agora estão no Patrimônio Líquido (grupo 2.3)');
  console.log('O DRE não será mais afetado por estes valores.');
}

corrigirSaldoAbertura().catch(console.error);
