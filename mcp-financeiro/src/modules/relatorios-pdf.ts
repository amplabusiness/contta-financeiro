/**
 * Módulo Gerador de Relatórios PDF
 *
 * Este módulo gera relatórios contábeis em formato PDF,
 * incluindo DRE, Balanço Patrimonial, Balancete e outros.
 */

// ============================================
// TIPOS DE RELATÓRIOS
// ============================================

export type TipoRelatorio =
  | "dre"
  | "balanco_patrimonial"
  | "balancete"
  | "fluxo_caixa"
  | "razao_analitico"
  | "contas_receber"
  | "contas_pagar"
  | "faturamento_cliente"
  | "inadimplencia"
  | "rentabilidade";

export interface ConfiguracaoRelatorio {
  tipo: TipoRelatorio;
  titulo: string;
  periodo: {
    inicio: string;
    fim: string;
  };
  competencia?: string;
  clienteId?: string;
  formato?: "A4" | "A4_landscape";
  incluirGraficos?: boolean;
  incluirComparativos?: boolean;
}

// ============================================
// ESTRUTURA DOS RELATÓRIOS
// ============================================

export const estruturasRelatorios = {
  dre: {
    titulo: "Demonstração do Resultado do Exercício",
    secoes: [
      { codigo: "3", nome: "RECEITA OPERACIONAL BRUTA", tipo: "soma" },
      { codigo: "3.1", nome: "Receitas de Serviços", tipo: "detalhe" },
      { codigo: "-", nome: "(-) Deduções da Receita", tipo: "deducao" },
      { codigo: "=", nome: "RECEITA OPERACIONAL LÍQUIDA", tipo: "subtotal" },
      { codigo: "4", nome: "(-) DESPESAS OPERACIONAIS", tipo: "soma" },
      { codigo: "4.1", nome: "Despesas Administrativas", tipo: "detalhe" },
      { codigo: "4.2", nome: "Despesas com Pessoal", tipo: "detalhe" },
      { codigo: "4.3", nome: "Despesas Financeiras", tipo: "detalhe" },
      { codigo: "=", nome: "RESULTADO OPERACIONAL", tipo: "subtotal" },
      { codigo: "=", nome: "RESULTADO ANTES DO IR/CSLL", tipo: "subtotal" },
      { codigo: "-", nome: "(-) Provisão para IR/CSLL", tipo: "deducao" },
      { codigo: "=", nome: "RESULTADO LÍQUIDO DO EXERCÍCIO", tipo: "total" }
    ]
  },

  balanco_patrimonial: {
    titulo: "Balanço Patrimonial",
    secoes: [
      // ATIVO
      { codigo: "1", nome: "ATIVO", tipo: "grupo" },
      { codigo: "1.1", nome: "ATIVO CIRCULANTE", tipo: "subgrupo" },
      { codigo: "1.1.1", nome: "Disponibilidades", tipo: "conta" },
      { codigo: "1.1.2", nome: "Clientes a Receber", tipo: "conta" },
      { codigo: "1.1.3", nome: "Adiantamentos", tipo: "conta" },
      { codigo: "1.2", nome: "ATIVO NÃO CIRCULANTE", tipo: "subgrupo" },
      { codigo: "1.2.1", nome: "Investimentos", tipo: "conta" },
      { codigo: "1.2.2", nome: "Imobilizado", tipo: "conta" },
      // PASSIVO
      { codigo: "2", nome: "PASSIVO", tipo: "grupo" },
      { codigo: "2.1", nome: "PASSIVO CIRCULANTE", tipo: "subgrupo" },
      { codigo: "2.1.1", nome: "Fornecedores", tipo: "conta" },
      { codigo: "2.1.2", nome: "Obrigações Trabalhistas", tipo: "conta" },
      { codigo: "2.1.3", nome: "Obrigações Fiscais", tipo: "conta" },
      // PATRIMÔNIO LÍQUIDO
      { codigo: "5", nome: "PATRIMÔNIO LÍQUIDO", tipo: "grupo" },
      { codigo: "5.1", nome: "Capital Social", tipo: "conta" },
      { codigo: "5.2", nome: "Reservas", tipo: "conta" },
      { codigo: "5.3", nome: "Resultados Acumulados", tipo: "conta" }
    ]
  },

  fluxo_caixa: {
    titulo: "Demonstração do Fluxo de Caixa",
    secoes: [
      { codigo: "1", nome: "ATIVIDADES OPERACIONAIS", tipo: "grupo" },
      { codigo: "1.1", nome: "Recebimentos de Clientes", tipo: "entrada" },
      { codigo: "1.2", nome: "Pagamentos a Fornecedores", tipo: "saida" },
      { codigo: "1.3", nome: "Pagamentos de Salários", tipo: "saida" },
      { codigo: "1.4", nome: "Pagamentos de Impostos", tipo: "saida" },
      { codigo: "=", nome: "Caixa Gerado nas Operações", tipo: "subtotal" },
      { codigo: "2", nome: "ATIVIDADES DE INVESTIMENTO", tipo: "grupo" },
      { codigo: "2.1", nome: "Aquisição de Imobilizado", tipo: "saida" },
      { codigo: "=", nome: "Caixa Usado em Investimentos", tipo: "subtotal" },
      { codigo: "3", nome: "ATIVIDADES DE FINANCIAMENTO", tipo: "grupo" },
      { codigo: "3.1", nome: "Empréstimos Obtidos", tipo: "entrada" },
      { codigo: "3.2", nome: "Pagamento de Empréstimos", tipo: "saida" },
      { codigo: "3.3", nome: "Distribuição de Lucros", tipo: "saida" },
      { codigo: "=", nome: "Caixa de Financiamentos", tipo: "subtotal" },
      { codigo: "=", nome: "VARIAÇÃO LÍQUIDA DE CAIXA", tipo: "total" }
    ]
  }
};

// ============================================
// CABEÇALHO DO RELATÓRIO
// ============================================

export interface CabecalhoRelatorio {
  empresa: {
    razaoSocial: string;
    cnpj: string;
    endereco: string;
    telefone: string;
    email: string;
  };
  titulo: string;
  periodo: string;
  dataGeracao: string;
  responsavel: {
    nome: string;
    crc: string;
  };
}

export function gerarCabecalho(config: ConfiguracaoRelatorio): CabecalhoRelatorio {
  return {
    empresa: {
      razaoSocial: "AMPLA ASSESSORIA CONTABIL LTDA",
      cnpj: "21.565.040/0001-07",
      endereco: "Rua 1, Qd. 24, Lt. 08, S/N - Setor Maracanã - CEP 74.680-320 - Goiânia/GO",
      telefone: "(62) 3932-1365",
      email: "contato@amplabusiness.com.br"
    },
    titulo: estruturasRelatorios[config.tipo as keyof typeof estruturasRelatorios]?.titulo || config.titulo,
    periodo: `${formatarData(config.periodo.inicio)} a ${formatarData(config.periodo.fim)}`,
    dataGeracao: new Date().toLocaleDateString("pt-BR"),
    responsavel: {
      nome: "Sergio Carneiro Leão",
      crc: "CRC/GO 008074"
    }
  };
}

// ============================================
// DADOS DO RELATÓRIO DRE
// ============================================

export interface LinhaDRE {
  codigo: string;
  descricao: string;
  valorAtual: number;
  valorAnterior?: number;
  variacao?: number;
  tipo: "grupo" | "conta" | "subtotal" | "total";
  nivel: number;
}

export interface RelatorioDRE {
  cabecalho: CabecalhoRelatorio;
  linhas: LinhaDRE[];
  resumo: {
    receitaTotal: number;
    despesaTotal: number;
    resultado: number;
    margemLiquida: number;
  };
}

// ============================================
// DADOS DO BALANCETE
// ============================================

export interface LinhaBalancete {
  codigo: string;
  conta: string;
  saldoAnterior: {
    debito: number;
    credito: number;
  };
  movimento: {
    debito: number;
    credito: number;
  };
  saldoAtual: {
    debito: number;
    credito: number;
  };
  nivel: number;
}

export interface RelatorioBalancete {
  cabecalho: CabecalhoRelatorio;
  linhas: LinhaBalancete[];
  totais: {
    saldoAnteriorDebito: number;
    saldoAnteriorCredito: number;
    movimentoDebito: number;
    movimentoCredito: number;
    saldoAtualDebito: number;
    saldoAtualCredito: number;
  };
  validacao: {
    partidaDobrada: boolean;
    diferenca: number;
  };
}

// ============================================
// DADOS DE INADIMPLÊNCIA
// ============================================

export interface LinhaInadimplencia {
  cliente: string;
  cnpj: string;
  competencias: string[];
  valorOriginal: number;
  diasAtraso: number;
  faseCobranca: string;
  ultimaCobranca?: string;
}

export interface RelatorioInadimplencia {
  cabecalho: CabecalhoRelatorio;
  linhas: LinhaInadimplencia[];
  resumo: {
    totalClientes: number;
    totalValor: number;
    mediaAtraso: number;
    porFase: Record<string, { quantidade: number; valor: number }>;
  };
}

// ============================================
// GERAÇÃO DO HTML DO RELATÓRIO
// ============================================

export function gerarHTMLRelatorio(
  tipo: TipoRelatorio,
  cabecalho: CabecalhoRelatorio,
  conteudo: string
): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${cabecalho.titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', sans-serif; font-size: 10pt; line-height: 1.4; color: #333; }

    .container { max-width: 210mm; margin: 0 auto; padding: 15mm; }

    /* Cabeçalho */
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1a365d; padding-bottom: 10px; }
    .header h1 { font-size: 14pt; color: #1a365d; margin-bottom: 5px; }
    .header h2 { font-size: 12pt; color: #2d3748; margin-bottom: 5px; }
    .header .empresa { font-size: 11pt; font-weight: bold; }
    .header .info { font-size: 9pt; color: #4a5568; }

    /* Tabelas */
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background-color: #1a365d; color: white; font-weight: bold; font-size: 9pt; }
    tr:nth-child(even) { background-color: #f7fafc; }
    tr:hover { background-color: #edf2f7; }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }

    /* Níveis de hierarquia */
    .nivel-0 { font-weight: bold; background-color: #e2e8f0 !important; }
    .nivel-1 { padding-left: 20px; }
    .nivel-2 { padding-left: 40px; font-size: 9pt; }
    .nivel-3 { padding-left: 60px; font-size: 9pt; color: #4a5568; }

    /* Totais */
    .total { font-weight: bold; background-color: #1a365d !important; color: white !important; }
    .subtotal { font-weight: bold; background-color: #4a5568 !important; color: white !important; }

    /* Valores */
    .valor-positivo { color: #22543d; }
    .valor-negativo { color: #c53030; }

    /* Rodapé */
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 8pt; color: #4a5568; }
    .footer .assinatura { margin-top: 50px; text-align: center; }
    .footer .linha-assinatura { border-top: 1px solid #333; width: 200px; margin: 0 auto 5px; }

    /* Resumo */
    .resumo { background-color: #f7fafc; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .resumo h3 { color: #1a365d; margin-bottom: 10px; }
    .resumo-item { display: flex; justify-content: space-between; padding: 5px 0; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .container { padding: 10mm; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="empresa">${cabecalho.empresa.razaoSocial}</div>
      <div class="info">CNPJ: ${cabecalho.empresa.cnpj}</div>
      <div class="info">${cabecalho.empresa.endereco}</div>
      <h1>${cabecalho.titulo}</h1>
      <h2>Período: ${cabecalho.periodo}</h2>
    </div>

    ${conteudo}

    <div class="footer">
      <div class="assinatura">
        <div class="linha-assinatura"></div>
        <div>${cabecalho.responsavel.nome}</div>
        <div>${cabecalho.responsavel.crc}</div>
      </div>
      <div style="text-align: center; margin-top: 20px;">
        Gerado em ${cabecalho.dataGeracao} | ${cabecalho.empresa.email} | ${cabecalho.empresa.telefone}
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

export function formatarData(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR");
}

export function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export function formatarPercentual(valor: number): string {
  return (valor * 100).toFixed(2) + "%";
}

export function calcularVariacao(atual: number, anterior: number): number {
  if (anterior === 0) return 0;
  return ((atual - anterior) / anterior) * 100;
}

// ============================================
// GERAÇÃO DE TABELA DRE
// ============================================

export function gerarTabelaDRE(linhas: LinhaDRE[]): string {
  const rows = linhas.map((linha) => {
    const classeNivel = `nivel-${linha.nivel}`;
    const classeTipo = linha.tipo === "total" ? "total" : linha.tipo === "subtotal" ? "subtotal" : "";
    const classeValor = linha.valorAtual >= 0 ? "valor-positivo" : "valor-negativo";

    return `
      <tr class="${classeNivel} ${classeTipo}">
        <td>${linha.codigo}</td>
        <td>${linha.descricao}</td>
        <td class="text-right ${classeValor}">${formatarMoeda(linha.valorAtual)}</td>
        ${linha.valorAnterior !== undefined ? `<td class="text-right">${formatarMoeda(linha.valorAnterior)}</td>` : ""}
        ${linha.variacao !== undefined ? `<td class="text-right">${linha.variacao.toFixed(2)}%</td>` : ""}
      </tr>
    `;
  }).join("");

  return `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Descrição</th>
          <th class="text-right">Valor Atual</th>
          ${linhas[0]?.valorAnterior !== undefined ? '<th class="text-right">Valor Anterior</th>' : ""}
          ${linhas[0]?.variacao !== undefined ? '<th class="text-right">Variação</th>' : ""}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// ============================================
// GERAÇÃO DE RESUMO
// ============================================

export function gerarResumo(dados: Record<string, number | string>): string {
  const itens = Object.entries(dados).map(([chave, valor]) => {
    const valorFormatado = typeof valor === "number"
      ? formatarMoeda(valor)
      : valor;

    return `
      <div class="resumo-item">
        <span>${chave}</span>
        <span class="font-bold">${valorFormatado}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="resumo">
      <h3>Resumo</h3>
      ${itens}
    </div>
  `;
}

export default {
  estruturasRelatorios,
  gerarCabecalho,
  gerarHTMLRelatorio,
  gerarTabelaDRE,
  gerarResumo,
  formatarMoeda,
  formatarPercentual,
  calcularVariacao
};
