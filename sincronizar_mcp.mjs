import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

async function sincronizarDados() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔄 Sincronizando dados da Supabase para o MCP...\n');

    // 1. Buscar clientes com saldo de abertura
    console.log('📊 1. Carregando clientes e contas a receber...');
    const { data: clients } = await supabase
      .from('clients')
      .select(`
        id,
        name,
        cnpj,
        phone,
        email,
        status,
        opening_balance,
        opening_balance_date,
        monthly_revenue
      `);

    // 2. Buscar plano de contas
    console.log('📊 2. Carregando plano de contas completo...');
    const { data: chartAccounts } = await supabase
      .from('chart_of_accounts')
      .select(`
        id,
        code,
        name,
        type,
        is_active,
        is_synthetic,
        description
      `)
      .eq('is_active', true)
      .order('code');

    // 3. Buscar saldos de contas a receber
    console.log('📊 3. Calculando saldos de contas a receber...');
    const { data: arLines } = await supabase
      .from('accounting_entry_lines')
      .select(`
        debit,
        credit,
        account_id,
        entry_id(entry_date, competence_date, description)
      `)
      .in('account_id', chartAccounts
        .filter(acc => acc.code.startsWith('1.1.2')) // Contas a receber
        .map(acc => acc.id));

    // Calcular saldo por cliente
    const saldosReceber = new Map();
    if (clients) {
      for (const client of clients) {
        const saldo = client.opening_balance || 0;
        saldosReceber.set(client.id, {
          cliente: client.name,
          cnpj: client.cnpj,
          saldoAbertura: saldo,
          dataAbertura: client.opening_balance_date,
          email: client.email,
          phone: client.phone,
          status: client.status
        });
      }
    }

    // 4. Buscar todas as despesas
    console.log('📊 4. Carregando despesas...');
    const { data: expenses } = await supabase
      .from('expenses')
      .select(`
        id,
        description,
        category,
        amount,
        due_date,
        payment_date,
        status,
        is_recurring,
        cost_center
      `)
      .eq('status', 'paid');

    // 5. Buscar invoices
    console.log('📊 5. Carregando notas fiscais...');
    const { data: invoices } = await supabase
      .from('invoices')
      .select(`
        id,
        invoice_number,
        client_id,
        amount,
        issued_date,
        due_date,
        status,
        service_description
      `);

    // 6. Buscar employees
    console.log('📊 6. Carregando folha de pagamento...');
    const { data: employees } = await supabase
      .from('employees')
      .select(`
        id,
        name,
        role,
        status,
        monthly_salary,
        hire_date
      `);

    // Gerar relatório com dados consolidados
    const relatorio = {
      dataSincronizacao: new Date().toISOString(),
      resumo: {
        totalClientes: clients?.length || 0,
        totalContasAtivas: chartAccounts?.length || 0,
        totalDespesas: expenses?.length || 0,
        totalNotas: invoices?.length || 0,
        totalFuncionarios: employees?.length || 0
      },
      dados: {
        clientes: saldosReceber.size > 0 ? Array.from(saldosReceber.values()) : [],
        planoContas: chartAccounts || [],
        despesas: expenses || [],
        notas: invoices || [],
        funcionarios: employees || []
      }
    };

    // Salvar arquivo de sincronização
    const syncDir = path.join(process.cwd(), 'mcp-financeiro', 'src', 'data');
    if (!fs.existsSync(syncDir)) {
      fs.mkdirSync(syncDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(syncDir, 'dados-sincronizados.json'),
      JSON.stringify(relatorio, null, 2)
    );

    console.log('\n✅ Dados sincronizados com sucesso!\n');
    console.log('📊 Resumo:');
    console.log(`   Clientes: ${relatorio.resumo.totalClientes}`);
    console.log(`   Contas Contábeis: ${relatorio.resumo.totalContasAtivas}`);
    console.log(`   Despesas: ${relatorio.resumo.totalDespesas}`);
    console.log(`   Notas Fiscais: ${relatorio.resumo.totalNotas}`);
    console.log(`   Funcionários: ${relatorio.resumo.totalFuncionarios}`);

    // Exibir top clientes por saldo de abertura
    if (relatorio.dados.clientes.length > 0) {
      console.log('\n💰 Top Clientes por Saldo de Abertura:');
      const topClientes = relatorio.dados.clientes
        .sort((a, b) => (b.saldoAbertura || 0) - (a.saldoAbertura || 0))
        .slice(0, 5);
      
      topClientes.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.cliente} - R$ ${(c.saldoAbertura || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      });
    }

    console.log(`\n📁 Arquivo salvo em: mcp-financeiro/src/data/dados-sincronizados.json`);
    return relatorio;

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    process.exit(1);
  }
}

sincronizarDados();
