// src/services/RelatorioService.ts
// Serviço para geração de relatórios PDF premium

import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.pdfMake.vfs;

// ============================================
// ESTILOS DO RELATÓRIO
// ============================================

const ESTILOS = {
  header: {
    fontSize: 22,
    bold: true,
    color: '#1e293b',
    margin: [0, 0, 0, 10] as [number, number, number, number],
  },
  subheader: {
    fontSize: 14,
    color: '#64748b',
    margin: [0, 0, 0, 20] as [number, number, number, number],
  },
  sectionTitle: {
    fontSize: 14,
    bold: true,
    color: '#1e293b',
    margin: [0, 20, 0, 10] as [number, number, number, number],
  },
  tableHeader: {
    fontSize: 10,
    bold: true,
    color: '#ffffff',
    fillColor: '#3b82f6',
    margin: [0, 5, 0, 5] as [number, number, number, number],
  },
  tableCell: {
    fontSize: 10,
    color: '#334155',
    margin: [0, 4, 0, 4] as [number, number, number, number],
  },
  tableCellRight: {
    fontSize: 10,
    color: '#334155',
    alignment: 'right' as const,
    margin: [0, 4, 0, 4] as [number, number, number, number],
  },
  summaryValue: {
    fontSize: 24,
    bold: true,
    color: '#1e293b',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  footer: {
    fontSize: 8,
    color: '#94a3b8',
    alignment: 'center' as const,
  },
  observation: {
    fontSize: 9,
    italics: true,
    color: '#64748b',
    margin: [0, 10, 0, 0] as [number, number, number, number],
  },
};

// ============================================
// TEMPLATES DE RELATÓRIO
// ============================================

interface DadosRelatorio {
  titulo: string;
  subtitulo?: string;
  periodo?: { inicio: string; fim: string };
  resumo?: Array<{ label: string; valor: string | number; variacao?: number }>;
  tabelas?: Array<{
    titulo: string;
    colunas: string[];
    dados: any[][];
    totais?: string[];
  }>;
  observacoes?: string[];
  empresa: {
    nome: string;
    cnpj: string;
    endereco?: string;
    telefone?: string;
  };
}

export class RelatorioService {
  
  // ==========================================
  // RELATÓRIO DE RECEBIMENTOS
  // ==========================================
  
  static async gerarRelatorioRecebimentos(dados: {
    periodo: { inicio: string; fim: string };
    recebimentos: Array<{
      cliente: string;
      valor: number;
      data: string;
      forma: string;
    }>;
    empresa: DadosRelatorio['empresa'];
  }) {
    const total = dados.recebimentos.reduce((s, r) => s + r.valor, 0);
    const porForma = dados.recebimentos.reduce((acc, r) => {
      acc[r.forma] = (acc[r.forma] || 0) + r.valor;
      return acc;
    }, {} as Record<string, number>);
    
    const docDefinition = {
      pageSize: 'A4' as const,
      pageMargins: [40, 80, 40, 60] as [number, number, number, number],
      
      header: {
        columns: [
          {
            text: dados.empresa.nome,
            style: 'header',
            margin: [40, 30, 0, 0] as [number, number, number, number],
          },
          {
            text: new Date().toLocaleDateString('pt-BR'),
            alignment: 'right' as const,
            margin: [0, 35, 40, 0] as [number, number, number, number],
            color: '#64748b',
          },
        ],
      },
      
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `CNPJ: ${dados.empresa.cnpj}`, style: 'footer', margin: [40, 0, 0, 0] as [number, number, number, number] },
          { text: `Página ${currentPage} de ${pageCount}`, style: 'footer', alignment: 'right' as const, margin: [0, 0, 40, 0] as [number, number, number, number] },
        ],
        margin: [0, 20, 0, 0] as [number, number, number, number],
      }),
      
      content: [
        { text: 'RELATÓRIO DE RECEBIMENTOS', style: 'header' },
        { text: `Período: ${dados.periodo.inicio} a ${dados.periodo.fim}`, style: 'subheader' },
        
        // Resumo
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'summaryValue' },
                { text: 'Total Recebido', style: 'summaryLabel' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: dados.recebimentos.length.toString(), style: 'summaryValue' },
                { text: 'Transações', style: 'summaryLabel' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: new Set(dados.recebimentos.map(r => r.cliente)).size.toString(), style: 'summaryValue' },
                { text: 'Clientes', style: 'summaryLabel' },
              ],
            },
          ],
          margin: [0, 0, 0, 30] as [number, number, number, number],
        },
        
        // Linha divisória
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 20] as [number, number, number, number] },
        
        // Por forma de pagamento
        { text: 'Detalhamento por Forma de Recebimento', style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 100, 80, 80],
            body: [
              [
                { text: 'Forma', style: 'tableHeader' },
                { text: 'Valor', style: 'tableHeader' },
                { text: 'Qtd', style: 'tableHeader' },
                { text: 'Part.', style: 'tableHeader' },
              ],
              ...Object.entries(porForma).map(([forma, valor]) => [
                { text: forma, style: 'tableCell' },
                { text: `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'tableCellRight' },
                { text: dados.recebimentos.filter(r => r.forma === forma).length.toString(), style: 'tableCellRight' },
                { text: `${((valor / total) * 100).toFixed(1)}%`, style: 'tableCellRight' },
              ]),
              [
                { text: 'TOTAL', style: 'tableHeader' },
                { text: `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'tableHeader' },
                { text: dados.recebimentos.length.toString(), style: 'tableHeader' },
                { text: '100%', style: 'tableHeader' },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingTop: () => 8,
            paddingBottom: () => 8,
          },
        },
        
        // Detalhamento por cliente
        { text: 'Detalhamento por Cliente', style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 80, 80, 60],
            body: [
              [
                { text: 'Cliente', style: 'tableHeader' },
                { text: 'Valor', style: 'tableHeader' },
                { text: 'Data', style: 'tableHeader' },
                { text: 'Forma', style: 'tableHeader' },
              ],
              ...dados.recebimentos.slice(0, 50).map(r => [
                { text: r.cliente, style: 'tableCell' },
                { text: `R$ ${r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'tableCellRight' },
                { text: r.data, style: 'tableCell' },
                { text: r.forma, style: 'tableCell' },
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingTop: () => 6,
            paddingBottom: () => 6,
            fillColor: (rowIndex: number) => rowIndex % 2 === 0 ? null : '#f8fafc',
          },
        },
        
        // Rodapé
        { text: `Relatório gerado em ${new Date().toLocaleString('pt-BR')}`, style: 'observation' },
      ],
      
      styles: ESTILOS,
    };
    
    return pdfMake.createPdf(docDefinition);
  }
  
  // ==========================================
  // RELATÓRIO DE INADIMPLÊNCIA
  // ==========================================
  
  static async gerarRelatorioInadimplencia(dados: {
    clientes: Array<{
      nome: string;
      valor: number;
      diasAtraso: number;
      telefone?: string;
      email?: string;
    }>;
    empresa: DadosRelatorio['empresa'];
  }) {
    const total = dados.clientes.reduce((s, c) => s + c.valor, 0);
    const diasMedio = dados.clientes.length > 0
      ? Math.round(dados.clientes.reduce((s, c) => s + c.diasAtraso, 0) / dados.clientes.length)
      : 0;
    
    const docDefinition = {
      pageSize: 'A4' as const,
      pageMargins: [40, 80, 40, 60] as [number, number, number, number],
      
      header: {
        columns: [
          { text: dados.empresa.nome, style: 'header', margin: [40, 30, 0, 0] as [number, number, number, number] },
          { text: new Date().toLocaleDateString('pt-BR'), alignment: 'right' as const, margin: [0, 35, 40, 0] as [number, number, number, number], color: '#64748b' },
        ],
      },
      
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `CNPJ: ${dados.empresa.cnpj}`, style: 'footer', margin: [40, 0, 0, 0] as [number, number, number, number] },
          { text: `Página ${currentPage} de ${pageCount}`, style: 'footer', alignment: 'right' as const, margin: [0, 0, 40, 0] as [number, number, number, number] },
        ],
        margin: [0, 20, 0, 0] as [number, number, number, number],
      }),
      
      content: [
        { text: 'RELATÓRIO DE INADIMPLÊNCIA', style: 'header' },
        { text: `Posição em ${new Date().toLocaleDateString('pt-BR')}`, style: 'subheader' },
        
        // Resumo
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'summaryValue', color: '#ef4444' },
                { text: 'Total em Atraso', style: 'summaryLabel' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: dados.clientes.length.toString(), style: 'summaryValue' },
                { text: 'Clientes Inadimplentes', style: 'summaryLabel' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: `${diasMedio} dias`, style: 'summaryValue' },
                { text: 'Atraso Médio', style: 'summaryLabel' },
              ],
            },
          ],
          margin: [0, 0, 0, 30] as [number, number, number, number],
        },
        
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 20] as [number, number, number, number] },
        
        // Tabela
        { text: 'Detalhamento de Clientes', style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 80, 50, 100, 100],
            body: [
              [
                { text: 'Cliente', style: 'tableHeader' },
                { text: 'Valor', style: 'tableHeader' },
                { text: 'Dias', style: 'tableHeader' },
                { text: 'Telefone', style: 'tableHeader' },
                { text: 'Email', style: 'tableHeader' },
              ],
              ...dados.clientes.sort((a, b) => b.diasAtraso - a.diasAtraso).map(c => [
                { text: c.nome, style: 'tableCell' },
                { text: `R$ ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'tableCellRight' },
                { text: c.diasAtraso.toString(), style: 'tableCellRight', color: c.diasAtraso > 30 ? '#ef4444' : c.diasAtraso > 15 ? '#f59e0b' : '#64748b' },
                { text: c.telefone || '-', style: 'tableCell' },
                { text: c.email || '-', style: 'tableCell' },
              ]),
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
            paddingTop: () => 6,
            paddingBottom: () => 6,
          },
        },
        
        { text: `Relatório gerado em ${new Date().toLocaleString('pt-BR')}`, style: 'observation' },
      ],
      
      styles: ESTILOS,
    };
    
    return pdfMake.createPdf(docDefinition);
  }
  
  // ==========================================
  // RELATÓRIO DE DESPESAS
  // ==========================================
  
  static async gerarRelatorioDespesas(dados: {
    periodo: { inicio: string; fim: string };
    despesas: Array<{
      descricao: string;
      categoria: string;
      valor: number;
      data: string;
    }>;
    empresa: DadosRelatorio['empresa'];
  }) {
    const total = dados.despesas.reduce((s, d) => s + d.valor, 0);
    const porCategoria = dados.despesas.reduce((acc, d) => {
      acc[d.categoria] = (acc[d.categoria] || 0) + d.valor;
      return acc;
    }, {} as Record<string, number>);
    
    const docDefinition = {
      pageSize: 'A4' as const,
      pageMargins: [40, 80, 40, 60] as [number, number, number, number],
      
      header: {
        columns: [
          { text: dados.empresa.nome, style: 'header', margin: [40, 30, 0, 0] as [number, number, number, number] },
          { text: new Date().toLocaleDateString('pt-BR'), alignment: 'right' as const, margin: [0, 35, 40, 0] as [number, number, number, number], color: '#64748b' },
        ],
      },
      
      content: [
        { text: 'RELATÓRIO DE DESPESAS', style: 'header' },
        { text: `Período: ${dados.periodo.inicio} a ${dados.periodo.fim}`, style: 'subheader' },
        
        // Resumo
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'summaryValue' },
                { text: 'Total de Despesas', style: 'summaryLabel' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: Object.keys(porCategoria).length.toString(), style: 'summaryValue' },
                { text: 'Categorias', style: 'summaryLabel' },
              ],
            },
            {
              width: '*',
              stack: [
                { text: dados.despesas.length.toString(), style: 'summaryValue' },
                { text: 'Lançamentos', style: 'summaryLabel' },
              ],
            },
          ],
          margin: [0, 0, 0, 30] as [number, number, number, number],
        },
        
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 20] as [number, number, number, number] },
        
        // Por categoria
        { text: 'Resumo por Categoria', style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 100, 80],
            body: [
              [
                { text: 'Categoria', style: 'tableHeader' },
                { text: 'Valor', style: 'tableHeader' },
                { text: 'Part.', style: 'tableHeader' },
              ],
              ...Object.entries(porCategoria)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, valor]) => [
                  { text: cat, style: 'tableCell' },
                  { text: `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'tableCellRight' },
                  { text: `${((valor / total) * 100).toFixed(1)}%`, style: 'tableCellRight' },
                ]),
              [
                { text: 'TOTAL', style: 'tableHeader' },
                { text: `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, style: 'tableHeader' },
                { text: '100%', style: 'tableHeader' },
              ],
            ],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#e2e8f0',
          },
        },
        
        { text: `Relatório gerado em ${new Date().toLocaleString('pt-BR')}`, style: 'observation' },
      ],
      
      styles: ESTILOS,
    };
    
    return pdfMake.createPdf(docDefinition);
  }
  
  // ==========================================
  // HELPER: DOWNLOAD PDF
  // ==========================================
  
  static download(pdf: any, nomeArquivo: string) {
    pdf.download(`${nomeArquivo}_${new Date().toISOString().split('T')[0]}.pdf`);
  }
  
  static abrir(pdf: any) {
    pdf.open();
  }
  
  static async getBase64(pdf: any): Promise<string> {
    return new Promise((resolve) => {
      pdf.getBase64((data: string) => resolve(data));
    });
  }
}

export default RelatorioService;
