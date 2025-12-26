import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

async function mapearBancoDados() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🗺️  Mapeando banco de dados completo...\n');

    // Tabelas principais
    const tabelas = [
      'clients',
      'invoices',
      'expenses',
      'employees',
      'bank_accounts',
      'bank_transactions',
      'bank_imports',
      'chart_of_accounts',
      'accounting_entries',
      'accounting_entry_lines',
      'cost_center_mapping',
      'recurring_expenses',
      'revenue_categories',
      'expense_categories',
      'cost_centers',
      'debt_confessions'
    ];

    const mapeamento = {
      banco: 'Ampla Contabilidade - Supabase PostgreSQL',
      dataMapeamento: new Date().toISOString(),
      tabelas: {},
      relacionamentos: [],
      fluxosDados: {},
      metricas: {
        totalTabelas: 0,
        totalRegistros: 0,
        totalClientes: 0,
        totalDespesas: 0,
        totalReceitaNota: 0
      }
    };

    // Mapear cada tabela
    for (const tabela of tabelas) {
      try {
        console.log(`📋 Analisando tabela: ${tabela}...`);
        
        const { data, error, count } = await supabase
          .from(tabela)
          .select('*', { count: 'exact', head: true })
          .limit(1);

        if (error) {
          console.log(`   ⚠️  Erro ao acessar ${tabela}: ${error.message}`);
          continue;
        }

        // Contar registros
        const { count: totalReg } = await supabase
          .from(tabela)
          .select('id', { count: 'exact', head: true });

        mapeamento.tabelas[tabela] = {
          nome: tabela,
          totalRegistros: totalReg || 0,
          descricao: getDescricaoTabela(tabela),
          proposito: getProposito(tabela),
          colunas: data && data.length > 0 ? Object.keys(data[0]) : [],
          tiposColuna: {}
        };

        mapeamento.metricas.totalTabelas++;
        mapeamento.metricas.totalRegistros += totalReg || 0;

        // Detalhes específicos por tabela
        if (tabela === 'clients') {
          const { count: c } = await supabase
            .from(tabela)
            .select('id', { count: 'exact' });
          mapeamento.metricas.totalClientes = c || 0;
        }

        if (tabela === 'expenses') {
          const { count: d } = await supabase
            .from(tabela)
            .select('id', { count: 'exact' });
          mapeamento.metricas.totalDespesas = d || 0;
        }

        if (tabela === 'invoices') {
          const { data: invs } = await supabase
            .from(tabela)
            .select('amount')
            .not('amount', 'is', null);
          
          const total = invs?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
          mapeamento.metricas.totalReceitaNota = total;
        }

      } catch (e) {
        console.log(`   ❌ Erro ao processar ${tabela}`);
      }
    }

    // Adicionar relacionamentos
    mapeamento.relacionamentos = [
      {
        tabela1: 'clients',
        tabela2: 'invoices',
        relacao: '1-N',
        descricao: 'Um cliente pode ter múltiplas notas fiscais'
      },
      {
        tabela1: 'clients',
        tabela2: 'chart_of_accounts',
        relacao: 'N-1',
        descricao: 'Clientes vinculados a contas a receber'
      },
      {
        tabela1: 'expenses',
        tabela2: 'cost_centers',
        relacao: 'N-1',
        descricao: 'Despesas classificadas por centro de custo'
      },
      {
        tabela1: 'expenses',
        tabela2: 'accounting_entries',
        relacao: '1-N',
        descricao: 'Cada despesa gera lançamentos contábeis'
      },
      {
        tabela1: 'bank_transactions',
        tabela2: 'bank_accounts',
        relacao: 'N-1',
        descricao: 'Transações associadas a contas bancárias'
      },
      {
        tabela1: 'bank_transactions',
        tabela2: 'accounting_entries',
        relacao: '1-N',
        descricao: 'Transações bancárias geram lançamentos'
      },
      {
        tabela1: 'employees',
        tabela2: 'accounting_entries',
        relacao: '1-N',
        descricao: 'Folha de pagamento cria lançamentos contábeis'
      }
    ];

    // Fluxos de dados principais
    mapeamento.fluxosDados = {
      honorarios: {
        nome: 'Fluxo de Honorários',
        descricao: 'Processo completo de faturamento e recebimento',
        passos: [
          '1. Client registrado em clients (CNPJ, endereço, email)',
          '2. Invoice criada em invoices (RPS emitida)',
          '3. Lançamento: D: Cliente a Receber | C: Receita em accounting_entries',
          '4. Bank_transaction registra o pagamento',
          '5. Lançamento de recebimento feito automaticamente'
        ]
      },
      despesas: {
        nome: 'Fluxo de Despesas',
        descricao: 'Gestão de contas a pagar',
        passos: [
          '1. Despesa registrada em expenses',
          '2. Classificação em expense_categories e cost_centers',
          '3. Lançamento automático: D: Despesa | C: Contas a Pagar',
          '4. Ao pagar: D: Banco | C: Contas a Pagar',
          '5. Bank_transaction marca como processada'
        ]
      },
      folhaPagamento: {
        nome: 'Fluxo de Folha de Pagamento',
        descricao: 'Processamento de salários e encargos',
        passos: [
          '1. Employees cadastrados com dados de salário',
          '2. Folha mensal gerada',
          '3. Lançamentos em accounting_entries para salários',
          '4. Descontos (INSS, IR) registrados',
          '5. Bank_transactions para pagamento via transferência'
        ]
      },
      bancaria: {
        nome: 'Fluxo de Conciliação Bancária',
        descricao: 'Reconciliação de extratos bancários',
        passos: [
          '1. Bank_import recebe arquivo de extrato (OFX)',
          '2. Bank_transactions criadas para cada movimento',
          '3. Matching com despesas e receitas',
          '4. Lançamentos contábeis automáticos',
          '5. DRE atualizada em tempo real'
        ]
      }
    };

    // Adicionar informações de valor
    mapeamento.dicionarioDados = {
      clients: {
        descricao: 'Cadastro de clientes/leads que contratam serviços de contabilidade',
        campos: {
          id: 'UUID único do cliente',
          name: 'Razão social ou nome completo',
          cnpj: 'CNPJ ou CPF (14 ou 11 dígitos)',
          phone: 'Telefone para contato',
          email: 'Email para correspondência',
          status: 'ativo/inativo/prospect',
          opening_balance: 'Saldo inicial de contas a receber',
          opening_balance_date: 'Data de abertura da conta',
          monthly_revenue: 'Faturamento mensal estimado',
          contract_status: 'Situação do contrato',
          notes: 'Observações sobre o cliente'
        }
      },
      invoices: {
        descricao: 'Notas Fiscais Eletrônicas (NFS-e / RPS) emitidas',
        campos: {
          id: 'UUID único da nota',
          invoice_number: 'Número sequencial da RPS',
          client_id: 'Referência ao cliente',
          amount: 'Valor total do serviço',
          issued_date: 'Data de emissão',
          due_date: 'Data de vencimento',
          status: 'emitida/paga/cancelada',
          service_description: 'Descrição dos serviços prestados',
          tax_amount: 'ISS retido na fonte',
          created_at: 'Data de registro no sistema'
        }
      },
      expenses: {
        descricao: 'Despesas operacionais e investimentos',
        campos: {
          id: 'UUID único',
          description: 'O que foi gasto',
          category: 'Categoria (aluguel, energia, etc)',
          amount: 'Valor em reais',
          due_date: 'Data de vencimento',
          payment_date: 'Quando foi pago',
          status: 'aberta/paga/cancelada',
          is_recurring: 'Se é gasto mensal automático',
          cost_center: 'Centro de custo para departamentalização',
          supplier: 'Quem forneceu o serviço/produto'
        }
      },
      bank_accounts: {
        descricao: 'Contas bancárias da empresa',
        campos: {
          id: 'UUID',
          bank_name: 'Nome do banco (Sicredi, etc)',
          account_number: 'Número da conta',
          agency: 'Número da agência',
          account_type: 'Corrente ou poupança',
          balance: 'Saldo atualizado',
          currency: 'BRL, USD, etc',
          is_active: 'Conta ativa ou não'
        }
      },
      bank_transactions: {
        descricao: 'Movimentações bancárias (extratos)',
        campos: {
          id: 'UUID',
          transaction_date: 'Data do movimento',
          description: 'Descrição da transação',
          amount: 'Valor movimentado',
          type: 'débito ou crédito',
          reference: 'Número do cheque, PIX, etc',
          matched: 'Se foi conciliado com despesa/receita',
          created_at: 'Data de importação'
        }
      },
      chart_of_accounts: {
        descricao: 'Plano de contas - estrutura contábil completa',
        campos: {
          id: 'UUID',
          code: 'Código hierárquico (1.1.1.01)',
          name: 'Nome da conta',
          type: 'ativo/passivo/receita/despesa/patrimônio',
          is_synthetic: 'Se é conta de agrupamento',
          is_active: 'Se está em uso',
          description: 'Detalhamento da conta'
        }
      },
      accounting_entries: {
        descricao: 'Lançamentos contábeis (diário)',
        campos: {
          id: 'UUID',
          entry_date: 'Data do lançamento',
          competence_date: 'Mês ao qual pertence (para accrual)',
          description: 'Motivo do lançamento',
          reference_type: 'expense/invoice/bank_transaction/payroll',
          reference_id: 'ID do documento que originou',
          total_debit: 'Soma dos débitos',
          total_credit: 'Soma dos créditos'
        }
      },
      accounting_entry_lines: {
        descricao: 'Linhas individuais de cada lançamento (débito/crédito)',
        campos: {
          id: 'UUID',
          entry_id: 'Referência ao lançamento',
          account_id: 'Conta contábil afetada',
          debit: 'Valor débito (positivo)',
          credit: 'Valor crédito (positivo)',
          description: 'Descrição adicional'
        }
      },
      employees: {
        descricao: 'Funcionários/colaboradores',
        campos: {
          id: 'UUID',
          name: 'Nome completo',
          role: 'Cargo/função',
          cpf: 'CPF para ESOCIAL',
          hire_date: 'Data de admissão',
          monthly_salary: 'Salário bruto mensal',
          status: 'ativo/inativo/rescindido',
          department: 'Setor/departamento'
        }
      },
      cost_centers: {
        descricao: 'Centros de custo para departamentalização',
        campos: {
          id: 'UUID',
          code: 'Código do centro (CC-001)',
          name: 'Nome do departamento',
          manager: 'Responsável',
          budget: 'Orçamento mensal'
        }
      }
    };

    // Salvar mapeamento
    const dataDir = path.join(process.cwd(), 'mcp-financeiro', 'src', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(dataDir, 'mapeamento-banco-dados.json'),
      JSON.stringify(mapeamento, null, 2)
    );

    // Gerar relatório em markdown
    const relatorioMd = gerarRelatorioMarkdown(mapeamento);
    fs.writeFileSync(
      path.join(process.cwd(), 'MAPEAMENTO_BANCO_DADOS.md'),
      relatorioMd
    );

    console.log('\n✅ Mapeamento concluído!\n');
    console.log('📊 Estatísticas:');
    console.log(`   Total de tabelas: ${mapeamento.metricas.totalTabelas}`);
    console.log(`   Total de registros: ${mapeamento.metricas.totalRegistros.toLocaleString('pt-BR')}`);
    console.log(`   Clientes: ${mapeamento.metricas.totalClientes}`);
    console.log(`   Despesas: ${mapeamento.metricas.totalDespesas}`);
    console.log(`   Receita em Notas: R$ ${mapeamento.metricas.totalReceitaNota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    
    console.log('\n📁 Arquivos gerados:');
    console.log('   ✅ mcp-financeiro/src/data/mapeamento-banco-dados.json');
    console.log('   ✅ MAPEAMENTO_BANCO_DADOS.md');

  } catch (error) {
    console.error('❌ Erro ao mapear banco:', error);
    process.exit(1);
  }
}

function getDescricaoTabela(tabela) {
  const descricoes = {
    clients: 'Cadastro de clientes/empresas que contratam serviços',
    invoices: 'Notas Fiscais Eletrônicas (RPS) emitidas',
    expenses: 'Despesas operacionais e contas a pagar',
    employees: 'Funcionários e folha de pagamento',
    bank_accounts: 'Contas bancárias cadastradas',
    bank_transactions: 'Movimentações de extrato bancário',
    bank_imports: 'Importações de arquivos OFX/CSV',
    chart_of_accounts: 'Plano de contas contábil',
    accounting_entries: 'Lançamentos contábeis (diário)',
    accounting_entry_lines: 'Linhas de débito/crédito dos lançamentos',
    cost_center_mapping: 'Mapeamento despesa → centro de custo',
    recurring_expenses: 'Despesas que se repetem mensalmente',
    revenue_categories: 'Categorias de receita',
    expense_categories: 'Categorias de despesa',
    cost_centers: 'Centros de custo (departamentos)',
    debt_confessions: 'Acordos de renegociação de dívidas'
  };
  return descricoes[tabela] || '';
}

function getProposito(tabela) {
  const propositos = {
    clients: 'CRM - Gestão de relacionamento com clientes',
    invoices: 'Faturamento - Emissão de RPS e recebimento',
    expenses: 'Contas a pagar - Gestão de despesas',
    employees: 'Folha de pagamento - ESOCIAL',
    bank_accounts: 'Tesouraria - Controle de contas',
    bank_transactions: 'Conciliação bancária automática',
    bank_imports: 'Importação de extratos',
    chart_of_accounts: 'Estrutura contábil - Base para DRE e Balanço',
    accounting_entries: 'Diário contábil - Partidas dobradas',
    accounting_entry_lines: 'Linhas do diário',
    cost_center_mapping: 'Departamentalização de custos',
    recurring_expenses: 'Automação de despesas mensais',
    revenue_categories: 'Classificação de receitas',
    expense_categories: 'Classificação de despesas',
    cost_centers: 'Centros de responsabilidade',
    debt_confessions: 'Renegociação com devedores'
  };
  return propositos[tabela] || '';
}

function gerarRelatorioMarkdown(mapeamento) {
  let md = `# 🗺️ Mapeamento Completo do Banco de Dados\n\n`;
  md += `**Data:** ${new Date().toLocaleDateString('pt-BR')}\n\n`;

  md += `## 📊 Visão Geral\n\n`;
  md += `| Métrica | Valor |\n`;
  md += `|--------|-------|\n`;
  md += `| Total de Tabelas | ${mapeamento.metricas.totalTabelas} |\n`;
  md += `| Total de Registros | ${mapeamento.metricas.totalRegistros.toLocaleString('pt-BR')} |\n`;
  md += `| Clientes | ${mapeamento.metricas.totalClientes} |\n`;
  md += `| Despesas | ${mapeamento.metricas.totalDespesas} |\n`;
  md += `| Receita em Notas | R$ ${mapeamento.metricas.totalReceitaNota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} |\n\n`;

  md += `## 📋 Tabelas Mapeadas\n\n`;
  
  for (const [tabelaNome, tabela] of Object.entries(mapeamento.tabelas)) {
    md += `### ${tabela.nome} (${tabela.totalRegistros} registros)\n`;
    md += `**Descrição:** ${tabela.descricao}\n`;
    md += `**Propósito:** ${tabela.proposito}\n`;
    md += `**Colunas:** ${tabela.colunas.length}\n\n`;
  }

  md += `## 🔗 Relacionamentos\n\n`;
  for (const rel of mapeamento.relacionamentos) {
    md += `- **${rel.tabela1}** → **${rel.tabela2}** (${rel.relacao}): ${rel.descricao}\n`;
  }

  md += `\n## 📈 Fluxos de Dados\n\n`;
  for (const [fluxoKey, fluxo] of Object.entries(mapeamento.fluxosDados)) {
    md += `### ${fluxo.nome}\n`;
    md += `${fluxo.descricao}\n\n`;
    md += `**Passos:**\n`;
    for (const passo of fluxo.passos) {
      md += `${passo}\n`;
    }
    md += `\n`;
  }

  return md;
}

mapearBancoDados();
