// scripts/correcao_contabil/13_gerar_honorarios.mjs
// Gera honorarios para uma competencia especifica

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parametros - competencia no formato MM/YYYY
const COMPETENCIA = process.argv[2] || '01/2025';
const CONTA_RECEITA_HONORARIOS = '3.1.1.01';

function formatMoney(valor) {
  return 'R$ ' + (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function gerarHonorarios() {
  console.log('\n' + '='.repeat(70));
  console.log('GERANDO HONORARIOS - COMPETENCIA', COMPETENCIA);
  console.log('='.repeat(70));

  // Extrair mes/ano para data
  const [mes, ano] = COMPETENCIA.split('/');
  const dataLancamento = `${ano}-${mes}-28`;
  const mesVenc = parseInt(mes) + 1;
  const anoVenc = mesVenc > 12 ? parseInt(ano) + 1 : ano;
  const mesVencStr = mesVenc > 12 ? '01' : String(mesVenc).padStart(2, '0');
  const dataVencimento = `${anoVenc}-${mesVencStr}-10`;

  console.log('Data lancamento:', dataLancamento);
  console.log('Data vencimento:', dataVencimento);

  // 1. Buscar clientes ativos
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name, monthly_fee, status')
    .eq('status', 'active')
    .gt('monthly_fee', 0);

  console.log('\nClientes ativos:', clientes.length);

  // 2. Buscar conta de receita
  const { data: contaReceita } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', CONTA_RECEITA_HONORARIOS)
    .single();

  if (!contaReceita) {
    console.log('ERRO: Conta', CONTA_RECEITA_HONORARIOS, 'nao encontrada!');
    return;
  }

  // 3. Buscar contas analiticas existentes
  const { data: contasExistentes } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('code', '1.1.2.01.%');

  console.log('Contas analiticas existentes:', contasExistentes?.length || 0);

  const contasPorNome = new Map();
  for (const c of contasExistentes || []) {
    const nomeNorm = c.name.toUpperCase()
      .replace(/^CLIENTE:\s*/i, '')
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 20);
    contasPorNome.set(nomeNorm, c);
  }

  // 4. Verificar invoices existentes
  const { data: invoicesExistentes } = await supabase
    .from('invoices')
    .select('client_id')
    .eq('competence', COMPETENCIA);

  const clientesComInvoice = new Set((invoicesExistentes || []).map(i => i.client_id));
  console.log('Clientes ja com invoice:', clientesComInvoice.size);

  // 5. Preparar proximo numero de conta
  const { data: ultimaConta } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .ilike('code', '1.1.2.01.%')
    .order('code', { ascending: false })
    .limit(1);

  let proximoNumero = ultimaConta?.[0]?.code
    ? parseInt(ultimaConta[0].code.split('.').pop() || '0') + 1
    : 1;

  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  // 6. Processar clientes
  let gerados = 0;
  let jaExistiam = 0;
  let erros = 0;
  let valorTotal = 0;

  for (const cliente of clientes) {
    const valor = parseFloat(cliente.monthly_fee) || 0;

    if (clientesComInvoice.has(cliente.id)) {
      jaExistiam++;
      continue;
    }

    // Buscar conta do cliente
    const nomeNorm = cliente.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 20);
    let contaCliente = contasPorNome.get(nomeNorm);

    if (!contaCliente) {
      for (const [key, conta] of contasPorNome) {
        if (key.includes(nomeNorm.substring(0, 10)) || nomeNorm.includes(key.substring(0, 10))) {
          contaCliente = conta;
          break;
        }
      }
    }

    if (!contaCliente) {
      const novoCodigo = '1.1.2.01.' + String(proximoNumero).padStart(4, '0');
      proximoNumero++;

      const { data: novaConta, error: errConta } = await supabase
        .from('chart_of_accounts')
        .insert({
          code: novoCodigo,
          name: cliente.name.substring(0, 100),
          account_type: 'ATIVO',
          nature: 'DEVEDORA',
          parent_id: contaPai?.id,
          level: 5,
          is_analytical: true,
          is_synthetic: false,
          is_active: true,
          accepts_entries: true
        })
        .select('id, code, name')
        .single();

      if (errConta) {
        console.log('Erro conta', cliente.name.substring(0, 30), ':', errConta.message);
        erros++;
        continue;
      }

      contaCliente = novaConta;
      contasPorNome.set(nomeNorm, novaConta);
    }

    // Criar invoice
    const { data: invoice, error: errInv } = await supabase
      .from('invoices')
      .insert({
        client_id: cliente.id,
        amount: valor,
        due_date: dataVencimento,
        status: 'pending',
        competence: COMPETENCIA,
        type: 'honorario_mensal',
        description: 'Honorarios Mensais - ' + COMPETENCIA
      })
      .select('id')
      .single();

    if (errInv) {
      console.log('Erro invoice', cliente.name.substring(0, 30), ':', errInv.message);
      erros++;
      continue;
    }

    // Criar entry
    const { data: entry, error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: dataLancamento,
        competence_date: dataLancamento,
        entry_type: 'receita_honorarios',
        description: 'Honorarios ' + COMPETENCIA + ' - ' + cliente.name.substring(0, 60),
        reference_type: 'invoice',
        invoice_id: invoice.id,
        source_type: 'invoices'
      })
      .select('id')
      .single();

    if (errEntry) {
      console.log('Erro entry', cliente.name.substring(0, 30), ':', errEntry.message);
      await supabase.from('invoices').delete().eq('id', invoice.id);
      erros++;
      continue;
    }

    // Atualizar invoice com journal_entry_id
    await supabase
      .from('invoices')
      .update({ journal_entry_id: entry.id })
      .eq('id', invoice.id);

    // Criar linhas
    const { error: errLinhas } = await supabase
      .from('accounting_entry_lines')
      .insert([
        {
          entry_id: entry.id,
          account_id: contaCliente.id,
          debit: valor,
          credit: 0
        },
        {
          entry_id: entry.id,
          account_id: contaReceita.id,
          debit: 0,
          credit: valor
        }
      ]);

    if (errLinhas) {
      await supabase.from('accounting_entries').delete().eq('id', entry.id);
      await supabase.from('invoices').delete().eq('id', invoice.id);
      console.log('Erro linhas', cliente.name.substring(0, 30), ':', errLinhas.message);
      erros++;
      continue;
    }

    gerados++;
    valorTotal += valor;

    if (gerados % 20 === 0) {
      console.log('  ...', gerados, 'gerados');
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('RESUMO');
  console.log('='.repeat(70));
  console.log('  Honorarios gerados:', gerados);
  console.log('  Ja existiam:', jaExistiam);
  console.log('  Erros:', erros);
  console.log('  Valor total:', formatMoney(valorTotal));

  // Verificar integridade
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  if (linhas) {
    const totalD = linhas.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
    const totalC = linhas.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);
    const diff = Math.abs(totalD - totalC);

    console.log('\n  Total Debitos:', formatMoney(totalD));
    console.log('  Total Creditos:', formatMoney(totalC));
    console.log('  Diferenca:', formatMoney(diff));

    if (diff < 0.01) {
      console.log('\n  OK - EQUACAO CONTABIL BALANCEADA!');
    } else {
      console.log('\n  ERRO - Equacao desbalanceada!');
    }
  }

  console.log('\n' + '='.repeat(70));
}

gerarHonorarios().catch(console.error);
