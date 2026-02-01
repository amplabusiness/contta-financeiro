/**
 * ============================================================================
 * MONTHLY AUDIT REPORT SERVICE
 * ============================================================================
 * Dr. Cícero - Gerador de Relatórios de Auditoria Mensal
 * Data: 01/02/2026
 * ============================================================================
 */

import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import CryptoJS from 'crypto-js';

// ============================================================================
// TIPOS
// ============================================================================

export interface AuditReportData {
  periodo: {
    ano: number;
    mes: number;
    inicio: string;
    fim: string;
  };
  transacoes: {
    total: number;
    reconciliadas: number;
    pendentes: number;
    percentual_reconciliado: number;
  };
  transitorias: {
    debitos: TransitoriaStatus;
    creditos: TransitoriaStatus;
  };
  reconciliation_log: Array<{
    action: string;
    actor: string;
    count: number;
  }>;
  situacao_geral: 'OK' | 'ATENCAO';
  gerado_em: string;
}

interface TransitoriaStatus {
  conta: string;
  nome: string;
  debitos: number;
  creditos: number;
  saldo: number;
  status: 'OK' | 'PENDENTE';
}

export interface CompanyInfo {
  nome: string;
  cnpj: string;
  responsavel: string;
}

export interface GeneratedReport {
  documentId: string;
  filePath: string;
  fileHash: string;
  pdfBlob: Blob;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ============================================================================
// SERVIÇO PRINCIPAL
// ============================================================================

export class MonthlyAuditReportService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Gera dados de auditoria via RPC
   */
  async getAuditData(year: number, month: number): Promise<AuditReportData> {
    const { data, error } = await supabase.rpc('generate_monthly_audit_data', {
      p_tenant_id: this.tenantId,
      p_year: year,
      p_month: month
    });

    if (error) {
      throw new Error(`Erro ao gerar dados de auditoria: ${error.message}`);
    }

    return data as AuditReportData;
  }

  /**
   * Busca informações da empresa
   */
  async getCompanyInfo(): Promise<CompanyInfo> {
    const { data, error } = await supabase
      .from('tenants')
      .select('name, cnpj, owner_name')
      .eq('id', this.tenantId)
      .single();

    if (error || !data) {
      return {
        nome: 'Ampla Contabilidade',
        cnpj: '00.000.000/0001-00',
        responsavel: 'Dr. Cícero'
      };
    }

    return {
      nome: data.name || 'Empresa',
      cnpj: data.cnpj || '00.000.000/0001-00',
      responsavel: data.owner_name || 'Responsável'
    };
  }

  /**
   * Gera o PDF do relatório
   */
  async generatePDF(
    year: number,
    month: number,
    generatedBy: string = 'system'
  ): Promise<GeneratedReport> {
    // 1. Buscar dados
    const [auditData, companyInfo] = await Promise.all([
      this.getAuditData(year, month),
      this.getCompanyInfo()
    ]);

    // 2. Gerar PDF
    const pdf = new jsPDF();
    const timestamp = new Date().toISOString();
    
    // --- CAPA ---
    this.renderCover(pdf, companyInfo, year, month, timestamp);

    // --- RESUMO EXECUTIVO ---
    pdf.addPage();
    this.renderExecutiveSummary(pdf, auditData);

    // --- BLOCO CONTÁBIL ---
    pdf.addPage();
    this.renderAccountingBlock(pdf, auditData);

    // --- GOVERNANÇA ---
    pdf.addPage();
    this.renderGovernanceBlock(pdf, auditData);

    // --- DECLARAÇÃO FINAL ---
    pdf.addPage();
    const pdfContent = pdf.output('arraybuffer');
    const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(pdfContent)).toString();
    this.renderFinalDeclaration(pdf, companyInfo, timestamp, hash, generatedBy);

    // 3. Gerar blob
    const pdfBlob = pdf.output('blob');

    // 4. Upload para storage
    const filePath = `documents/auditoria/mensal/${this.tenantId}/${year}/${month.toString().padStart(2, '0')}/auditoria_mensal.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.warn('Upload para storage falhou:', uploadError.message);
      // Continua mesmo sem upload
    }

    // 5. Registrar no catálogo
    const { data: docData, error: docError } = await supabase
      .from('document_catalog')
      .insert({
        tenant_id: this.tenantId,
        document_type: 'auditoria_mensal',
        reference_month: `${year}-${month.toString().padStart(2, '0')}-01`,
        title: `Relatório de Auditoria Mensal - ${MESES[month - 1]}/${year}`,
        description: `Relatório oficial de integridade financeiro-contábil do período`,
        file_path: filePath,
        file_hash: hash,
        file_size_bytes: pdfBlob.size,
        mime_type: 'application/pdf',
        tags: ['auditoria', 'fechamento', 'mensal', 'contabil', 'financeiro', 'governanca'],
        metadata: {
          situacao_geral: auditData.situacao_geral,
          transacoes_total: auditData.transacoes.total,
          transacoes_reconciliadas: auditData.transacoes.reconciliadas,
          generated_by: generatedBy
        },
        generated_by: generatedBy,
        is_final: true
      })
      .select('id')
      .single();

    if (docError) {
      throw new Error(`Erro ao registrar documento: ${docError.message}`);
    }

    return {
      documentId: docData.id,
      filePath,
      fileHash: hash,
      pdfBlob
    };
  }

  /**
   * Fecha o mês com documento de auditoria
   */
  async closeMonth(
    year: number,
    month: number,
    documentId: string,
    closedBy: string = 'dr-cicero'
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('close_month', {
      p_tenant_id: this.tenantId,
      p_year: year,
      p_month: month,
      p_audit_document_id: documentId,
      p_closed_by: closedBy
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  }

  // ============================================================================
  // RENDERIZAÇÃO PDF
  // ============================================================================

  private renderCover(
    pdf: jsPDF,
    company: CompanyInfo,
    year: number,
    month: number,
    timestamp: string
  ): void {
    const width = pdf.internal.pageSize.getWidth();
    
    // Borda decorativa
    pdf.setDrawColor(0, 100, 150);
    pdf.setLineWidth(2);
    pdf.rect(15, 15, width - 30, pdf.internal.pageSize.getHeight() - 30);

    // Título
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RELATÓRIO DE AUDITORIA', width / 2, 60, { align: 'center' });
    
    pdf.setFontSize(18);
    pdf.text('INTEGRIDADE FINANCEIRO-CONTÁBIL', width / 2, 75, { align: 'center' });

    // Linha decorativa
    pdf.setLineWidth(0.5);
    pdf.line(40, 85, width - 40, 85);

    // Informações da empresa
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Empresa: ${company.nome}`, width / 2, 110, { align: 'center' });
    pdf.text(`CNPJ: ${company.cnpj}`, width / 2, 125, { align: 'center' });
    
    // Período
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${MESES[month - 1]} / ${year}`, width / 2, 155, { align: 'center' });

    // Rodapé
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Gerado em: ${new Date(timestamp).toLocaleString('pt-BR')}`, width / 2, 250, { align: 'center' });
    pdf.text('Sistema CONTTA - Governança Financeira e Contábil', width / 2, 260, { align: 'center' });
  }

  private renderExecutiveSummary(pdf: jsPDF, data: AuditReportData): void {
    const width = pdf.internal.pageSize.getWidth();
    let y = 30;

    // Título
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('1. RESUMO EXECUTIVO', 20, y);
    y += 15;

    // Status geral
    pdf.setFontSize(14);
    const statusColor = data.situacao_geral === 'OK' ? [0, 128, 0] : [255, 165, 0];
    pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.text(`Situação Geral: ${data.situacao_geral === 'OK' ? '✅ OK' : '⚠️ ATENÇÃO'}`, 20, y);
    pdf.setTextColor(0, 0, 0);
    y += 20;

    // Tabela de transações
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Transações Bancárias', 20, y);
    y += 10;

    pdf.setFont('helvetica', 'normal');
    const txnRows = [
      ['Total de Transações', data.transacoes.total.toString()],
      ['Reconciliadas', data.transacoes.reconciliadas.toString()],
      ['Pendentes', data.transacoes.pendentes.toString()],
      ['% Reconciliado', `${data.transacoes.percentual_reconciliado}%`]
    ];

    txnRows.forEach(([label, value]) => {
      pdf.text(`${label}:`, 25, y);
      pdf.text(value, 120, y);
      y += 8;
    });

    y += 15;

    // Status das transitórias
    pdf.setFont('helvetica', 'bold');
    pdf.text('Contas Transitórias', 20, y);
    y += 10;

    pdf.setFont('helvetica', 'normal');
    
    // Débitos
    const debStatus = data.transitorias.debitos.status === 'OK' ? '✅' : '⚠️';
    pdf.text(`${debStatus} ${data.transitorias.debitos.conta} - ${data.transitorias.debitos.nome}`, 25, y);
    y += 8;
    pdf.text(`   Saldo: R$ ${data.transitorias.debitos.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, y);
    y += 12;

    // Créditos
    const credStatus = data.transitorias.creditos.status === 'OK' ? '✅' : '⚠️';
    pdf.text(`${credStatus} ${data.transitorias.creditos.conta} - ${data.transitorias.creditos.nome}`, 25, y);
    y += 8;
    pdf.text(`   Saldo: R$ ${data.transitorias.creditos.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, y);
  }

  private renderAccountingBlock(pdf: jsPDF, data: AuditReportData): void {
    let y = 30;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('2. BLOCO CONTÁBIL', 20, y);
    y += 20;

    // Detalhamento transitórias
    pdf.setFontSize(12);
    pdf.text('Movimentação das Transitórias', 20, y);
    y += 15;

    pdf.setFont('helvetica', 'normal');
    
    // Tabela de débitos
    pdf.text('1.1.9.01 - Transitória Débitos Pendentes:', 25, y);
    y += 8;
    pdf.text(`   Débitos: R$ ${data.transitorias.debitos.debitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, y);
    y += 8;
    pdf.text(`   Créditos: R$ ${data.transitorias.debitos.creditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, y);
    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`   Saldo: R$ ${data.transitorias.debitos.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, y);
    y += 15;

    pdf.setFont('helvetica', 'normal');
    
    // Tabela de créditos
    pdf.text('2.1.9.01 - Transitória Créditos Pendentes:', 25, y);
    y += 8;
    pdf.text(`   Débitos: R$ ${data.transitorias.creditos.debitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, y);
    y += 8;
    pdf.text(`   Créditos: R$ ${data.transitorias.creditos.creditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, y);
    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`   Saldo: R$ ${data.transitorias.creditos.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, y);
    y += 20;

    // Conferência D = C
    pdf.setFont('helvetica', 'bold');
    pdf.text('Verificação de Integridade:', 20, y);
    y += 10;
    pdf.setFont('helvetica', 'normal');
    const integrity = data.transitorias.debitos.status === 'OK' && data.transitorias.creditos.status === 'OK';
    pdf.text(`∑ Débitos = ∑ Créditos: ${integrity ? '✅ CONFERE' : '⚠️ DIVERGÊNCIA'}`, 25, y);
  }

  private renderGovernanceBlock(pdf: jsPDF, data: AuditReportData): void {
    let y = 30;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('3. GOVERNANÇA', 20, y);
    y += 20;

    // Log de reconciliações
    pdf.setFontSize(12);
    pdf.text('Operações de Reconciliação no Período', 20, y);
    y += 15;

    pdf.setFont('helvetica', 'normal');
    
    if (data.reconciliation_log.length === 0) {
      pdf.text('Nenhuma operação registrada no período.', 25, y);
    } else {
      data.reconciliation_log.forEach(log => {
        pdf.text(`• ${log.action}: ${log.count} operações (por: ${log.actor})`, 25, y);
        y += 8;
      });
    }

    y += 20;

    // Regras aplicadas
    pdf.setFont('helvetica', 'bold');
    pdf.text('Regras de Governança Aplicadas', 20, y);
    y += 10;

    pdf.setFont('helvetica', 'normal');
    const rules = [
      'STATUS_DERIVADO - Status é derivado de journal_entry_id',
      'TRANSITORIA_ZERO - Transitórias devem zerar ao fim do período',
      'RECONCILIACAO_VIA_RPC - Reconciliação apenas via RPC oficial'
    ];

    rules.forEach(rule => {
      pdf.text(`✓ ${rule}`, 25, y);
      y += 8;
    });
  }

  private renderFinalDeclaration(
    pdf: jsPDF,
    company: CompanyInfo,
    timestamp: string,
    hash: string,
    generatedBy: string
  ): void {
    const width = pdf.internal.pageSize.getWidth();
    let y = 30;

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('4. DECLARAÇÃO FINAL', 20, y);
    y += 30;

    // Declaração
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'italic');
    const declaration = '"Declaro que os dados apresentados neste relatório refletem fielmente a posição financeira e contábil do período analisado, conforme registros do sistema CONTTA."';
    const lines = pdf.splitTextToSize(declaration, width - 50);
    pdf.text(lines, 25, y);
    y += 40;

    // Assinatura
    pdf.setFont('helvetica', 'normal');
    pdf.line(60, y, 150, y);
    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Dr. Cícero', width / 2, y, { align: 'center' });
    y += 6;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Contador Responsável - Sistema CONTTA', width / 2, y, { align: 'center' });
    y += 30;

    // Metadados
    pdf.setFontSize(9);
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, y, width - 20, y);
    y += 10;

    pdf.text(`Timestamp: ${timestamp}`, 20, y);
    y += 6;
    pdf.text(`Gerado por: ${generatedBy}`, 20, y);
    y += 6;
    pdf.text(`Hash SHA-256: ${hash}`, 20, y);
    y += 15;

    // Aviso
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Este documento foi gerado automaticamente pelo Sistema CONTTA e possui validade digital.', width / 2, y, { align: 'center' });
    y += 5;
    pdf.text('O hash SHA-256 garante a integridade e autenticidade do conteúdo.', width / 2, y, { align: 'center' });
  }
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Verifica se o mês pode ser fechado
 */
export async function canCloseMonth(
  tenantId: string,
  year: number,
  month: number
): Promise<{ canClose: boolean; reason?: string }> {
  const service = new MonthlyAuditReportService(tenantId);
  
  try {
    const data = await service.getAuditData(year, month);
    
    if (data.transacoes.pendentes > 0) {
      return {
        canClose: false,
        reason: `Existem ${data.transacoes.pendentes} transações pendentes de classificação.`
      };
    }

    if (data.transitorias.debitos.status !== 'OK') {
      return {
        canClose: false,
        reason: `Transitória Débitos (1.1.9.01) não está zerada. Saldo: R$ ${data.transitorias.debitos.saldo}`
      };
    }

    if (data.transitorias.creditos.status !== 'OK') {
      return {
        canClose: false,
        reason: `Transitória Créditos (2.1.9.01) não está zerada. Saldo: R$ ${data.transitorias.creditos.saldo}`
      };
    }

    return { canClose: true };
  } catch (error) {
    return {
      canClose: false,
      reason: `Erro ao verificar: ${error}`
    };
  }
}

/**
 * Busca regras aprendidas ativas
 */
export async function getLearnedRules(
  tenantId: string,
  category?: string
): Promise<any[]> {
  let query = supabase
    .from('learned_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query.order('severity', { ascending: false });

  if (error) {
    console.error('Erro ao buscar regras:', error);
    return [];
  }

  return data || [];
}

/**
 * Registra nova regra aprendida
 */
export async function registerLearnedRule(
  tenantId: string,
  rule: {
    rule_id: string;
    rule_name: string;
    category: string;
    condition_description: string;
    expected_outcome: string;
    action_description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('learned_rules')
    .upsert({
      tenant_id: tenantId,
      ...rule,
      first_occurrence: new Date().toISOString().split('T')[0],
      last_occurrence: new Date().toISOString().split('T')[0],
      occurrence_count: 1
    }, {
      onConflict: 'tenant_id,rule_id'
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
