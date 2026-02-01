/**
 * Divergence Report Service
 * 
 * Gera Relatório Oficial de Divergências Contábil x Operacional
 * Documento de auditoria para fins fiscais e compliance.
 * Integrado com Data Lake para indexação RAG.
 * 
 * @author Dr. Cícero (via Contta)
 * @date 31/01/2026
 */

import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { uploadDivergenceReport, DivergenceReportContent } from "./dataLakeService";

// =====================================================
// TIPOS
// =====================================================

interface DivergenceRecord {
  id: string;
  reference_month: string;
  operational_total: number;
  accounting_total: number;
  divergence_amount: number;
  status: string;
  notes: string | null;
  resolution_notes: string | null;
  pending_invoices_count: number;
  overdue_invoices_count: number;
  opening_balance_amount: number;
  analyzed_at: string;
  resolved_at: string | null;
}

interface TenantInfo {
  id: string;
  name: string;
  cnpj: string | null;
}

interface ReportParams {
  tenantId: string;
  referenceMonth: string;
  accountantName?: string;
  accountantCRC?: string;
  indexInDataLake?: boolean; // Nova opção para indexação
  versionReason?: string; // Motivo da versão (para versionamento)
}

interface ReportResult {
  success: boolean;
  pdfBlob?: Blob;
  fileName?: string;
  error?: string;
  dataLakeId?: string; // ID do documento no Data Lake
  dataLakePath?: string; // Caminho do documento no Storage
  version?: number; // Número da versão
  chainHash?: string; // Hash da cadeia (para verificação)
}

// =====================================================
// CONSTANTES
// =====================================================

const COLORS = {
  primary: [30, 58, 95] as [number, number, number],      // Azul escuro
  secondary: [100, 116, 139] as [number, number, number], // Slate
  success: [34, 197, 94] as [number, number, number],     // Verde
  warning: [234, 179, 8] as [number, number, number],     // Amarelo
  danger: [239, 68, 68] as [number, number, number],      // Vermelho
  light: [241, 245, 249] as [number, number, number],     // Cinza claro
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
};

const STATUS_LABELS: Record<string, { label: string; color: [number, number, number] }> = {
  em_analise: { label: "Em Análise", color: COLORS.warning },
  justificado: { label: "Justificado", color: [59, 130, 246] }, // Blue
  em_correcao: { label: "Em Correção", color: [249, 115, 22] }, // Orange
  resolvido: { label: "Resolvido", color: COLORS.success },
};

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("pt-BR");
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${months[parseInt(month) - 1]}/${year}`;
};

// =====================================================
// BUSCA DE DADOS
// =====================================================

async function fetchDivergences(
  tenantId: string,
  referenceMonth: string
): Promise<DivergenceRecord[]> {
  const { data, error } = await supabase
    .from("divergence_audit_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("reference_month", referenceMonth)
    .order("analyzed_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar divergências:", error);
    return [];
  }

  return data || [];
}

async function fetchTenantInfo(tenantId: string): Promise<TenantInfo | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, cnpj")
    .eq("id", tenantId)
    .single();

  if (error) {
    console.error("Erro ao buscar tenant:", error);
    return null;
  }

  return data;
}

// =====================================================
// GERAÇÃO DO PDF
// =====================================================

export async function generateDivergenceReport(
  params: ReportParams
): Promise<ReportResult> {
  try {
    const { tenantId, referenceMonth, accountantName, accountantCRC } = params;

    // Buscar dados
    const [divergences, tenant] = await Promise.all([
      fetchDivergences(tenantId, referenceMonth),
      fetchTenantInfo(tenantId),
    ]);

    if (!tenant) {
      return { success: false, error: "Empresa não encontrada" };
    }

    // Criar PDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    // =====================================================
    // CAPA
    // =====================================================
    
    // Fundo do header
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, pageWidth, 60, "F");

    // Logo/Título
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("CONTTA", pageWidth / 2, 25, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Sistema de Gestão Financeira", pageWidth / 2, 33, { align: "center" });

    // Título do Relatório
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DE DIVERGÊNCIAS", pageWidth / 2, 48, { align: "center" });
    doc.setFontSize(11);
    doc.text("Contábil × Operacional", pageWidth / 2, 55, { align: "center" });

    y = 75;

    // =====================================================
    // CABEÇALHO TÉCNICO
    // =====================================================
    
    doc.setTextColor(...COLORS.black);
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 45, 3, 3, "F");

    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMAÇÕES DO RELATÓRIO", margin + 5, y);

    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    // Coluna 1
    doc.text(`Empresa: ${tenant.name}`, margin + 5, y);
    doc.text(`CNPJ: ${tenant.cnpj || "Não informado"}`, margin + 5, y + 6);
    doc.text(`Período: ${formatMonth(referenceMonth)}`, margin + 5, y + 12);

    // Coluna 2
    const col2X = pageWidth / 2;
    doc.text(`Data de Emissão: ${formatDate(new Date().toISOString())}`, col2X, y);
    doc.text(`Assistente: Dr. Cícero (Auditor IA)`, col2X, y + 6);
    
    // Status geral
    const hasDivergences = divergences.some(d => d.divergence_amount > 0.01);
    const allResolved = divergences.every(d => d.status === "resolvido");
    
    let statusText = "Sem divergências";
    let statusColor = COLORS.success;
    if (hasDivergences && !allResolved) {
      statusText = "Com divergências pendentes";
      statusColor = COLORS.warning;
    } else if (hasDivergences && allResolved) {
      statusText = "Divergências resolvidas";
      statusColor = COLORS.success;
    }
    
    doc.setTextColor(...statusColor);
    doc.setFont("helvetica", "bold");
    doc.text(`Status: ${statusText}`, col2X, y + 12);

    y += 35;

    // =====================================================
    // RESUMO EXECUTIVO
    // =====================================================

    doc.setTextColor(...COLORS.black);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMO EXECUTIVO", margin, y);

    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    if (divergences.length === 0) {
      doc.text("Nenhuma divergência registrada para o período analisado.", margin, y);
      y += 10;
    } else {
      const totalOperacional = divergences[0]?.operational_total || 0;
      const totalContabil = divergences[0]?.accounting_total || 0;
      const divergenciaTotal = Math.abs(totalOperacional - totalContabil);

      // Box de resumo
      doc.setFillColor(...COLORS.light);
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 30, 2, 2, "F");

      y += 7;
      const boxMargin = margin + 5;
      const thirdWidth = (pageWidth - 2 * margin - 20) / 3;

      // Operacional
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.secondary);
      doc.text("Visão Operacional", boxMargin, y);
      doc.setTextColor(...COLORS.black);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(formatCurrency(totalOperacional), boxMargin, y + 7);

      // Contábil
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.secondary);
      doc.text("Visão Contábil (OFICIAL)", boxMargin + thirdWidth, y);
      doc.setTextColor(...COLORS.success);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(formatCurrency(totalContabil), boxMargin + thirdWidth, y + 7);

      // Divergência
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.secondary);
      doc.text("Divergência", boxMargin + 2 * thirdWidth, y);
      const divColor = divergenciaTotal > 0.01 ? COLORS.warning : COLORS.success;
      doc.setTextColor(divColor[0], divColor[1], divColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(formatCurrency(divergenciaTotal), boxMargin + 2 * thirdWidth, y + 7);

      y += 28;
    }

    // =====================================================
    // ANÁLISES REGISTRADAS
    // =====================================================

    if (divergences.length > 0) {
      y += 5;
      doc.setTextColor(...COLORS.black);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("ANÁLISES REGISTRADAS", margin, y);

      y += 8;

      for (const div of divergences) {
        // Verificar se precisa nova página
        if (y > pageHeight - 60) {
          doc.addPage();
          y = margin;
        }

        // Card da divergência
        doc.setDrawColor(...COLORS.secondary);
        doc.setFillColor(...COLORS.white);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 45, 2, 2, "FD");

        y += 7;
        
        // Header do card
        const statusConfig = STATUS_LABELS[div.status] || STATUS_LABELS.em_analise;
        doc.setFillColor(...statusConfig.color);
        doc.roundedRect(pageWidth - margin - 30, y - 4, 25, 6, 1, 1, "F");
        doc.setTextColor(...COLORS.white);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(statusConfig.label, pageWidth - margin - 17.5, y, { align: "center" });

        doc.setTextColor(...COLORS.black);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`Análise de ${formatDateTime(div.analyzed_at)}`, margin + 5, y);

        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        // Valores
        doc.text(`Operacional: ${formatCurrency(div.operational_total)}`, margin + 5, y);
        doc.text(`Contábil: ${formatCurrency(div.accounting_total)}`, margin + 60, y);
        doc.setTextColor(...COLORS.warning);
        doc.text(`Divergência: ${formatCurrency(div.divergence_amount)}`, margin + 115, y);

        y += 6;
        doc.setTextColor(...COLORS.black);

        // Detalhes
        const details: string[] = [];
        if (div.pending_invoices_count > 0) {
          details.push(`${div.pending_invoices_count} faturas pendentes`);
        }
        if (div.overdue_invoices_count > 0) {
          details.push(`${div.overdue_invoices_count} faturas atrasadas`);
        }
        if (div.opening_balance_amount > 0) {
          details.push(`Saldo abertura: ${formatCurrency(div.opening_balance_amount)}`);
        }

        if (details.length > 0) {
          doc.text(`Detalhes: ${details.join(" | ")}`, margin + 5, y);
          y += 5;
        }

        // Notas
        if (div.notes) {
          y += 2;
          doc.setTextColor(...COLORS.secondary);
          doc.text("Observações:", margin + 5, y);
          y += 4;
          doc.setTextColor(...COLORS.black);
          
          // Quebrar texto longo
          const maxWidth = pageWidth - 2 * margin - 15;
          const lines = doc.splitTextToSize(div.notes, maxWidth);
          doc.text(lines.slice(0, 2), margin + 5, y);
          y += lines.slice(0, 2).length * 4;
        }

        // Resolução
        if (div.resolution_notes && div.status === "resolvido") {
          doc.setTextColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
          doc.text(`✓ Resolvido em ${formatDateTime(div.resolved_at || div.analyzed_at)}`, margin + 5, y);
        }

        y += 12;
      }
    }

    // =====================================================
    // RODAPÉ - VALIDAÇÃO FORMAL
    // =====================================================

    // Ir para última página se necessário
    if (y > pageHeight - 70) {
      doc.addPage();
      y = margin;
    }

    y = pageHeight - 65;

    // Linha separadora
    doc.setDrawColor(...COLORS.secondary);
    doc.line(margin, y, pageWidth - margin, y);

    y += 8;

    // Declaração
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.secondary);
    const declaracao = "As divergências acima foram analisadas conforme as regras de governança do sistema Contta, " +
      "tendo como fonte oficial a contabilidade (conta 1.1.2.01 - Clientes a Receber). " +
      "Este relatório é gerado automaticamente e representa o estado das divergências no momento da emissão.";
    const declLines = doc.splitTextToSize(declaracao, pageWidth - 2 * margin);
    doc.text(declLines, margin, y);

    y += declLines.length * 4 + 8;

    // Assinatura
    doc.setTextColor(...COLORS.black);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    if (accountantName) {
      doc.text("_".repeat(40), margin, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text(accountantName, margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      if (accountantCRC) {
        doc.text(`CRC: ${accountantCRC}`, margin, y);
      }
    }

    // Hash do documento (simulado)
    const hash = `CONTTA-${referenceMonth}-${Date.now().toString(36).toUpperCase()}`;
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.secondary);
    doc.text(`Documento: ${hash}`, pageWidth - margin, pageHeight - 10, { align: "right" });

    // Número da página
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.secondary);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    // =====================================================
    // FINALIZAÇÃO
    // =====================================================

    const pdfBlob = doc.output("blob");
    const fileName = `divergencias_${tenant.name.replace(/\s+/g, "_")}_${referenceMonth}.pdf`;

    // Registrar geração no log
    await logReportGeneration(tenantId, referenceMonth, fileName);

    // =====================================================
    // INDEXAÇÃO NO DATA LAKE (opcional, default: true)
    // Com suporte a versionamento
    // =====================================================
    
    let dataLakeId: string | undefined;
    let dataLakePath: string | undefined;
    let version: number | undefined;
    let chainHash: string | undefined;

    if (params.indexInDataLake !== false) {
      try {
        // Preparar conteúdo para indexação
        const latestDivergence = divergences[0];
        const reportContent: DivergenceReportContent = {
          referenceMonth,
          tenantId,
          tenantName: tenant.name,
          generatedAt: new Date().toISOString(),
          operationalTotal: latestDivergence?.operational_total || 0,
          accountingTotal: latestDivergence?.accounting_total || 0,
          divergenceAmount: latestDivergence?.divergence_amount || 0,
          status: latestDivergence?.status || "sem_divergencia",
          notes: latestDivergence?.notes || null,
          analyses: divergences.map(d => ({
            date: d.analyzed_at,
            status: d.status,
            notes: d.notes,
            pendingInvoices: d.pending_invoices_count,
            overdueInvoices: d.overdue_invoices_count,
            openingBalance: d.opening_balance_amount,
          })),
        };

        // Upload para Data Lake com versionamento
        const uploadResult = await uploadDivergenceReport(
          pdfBlob,
          reportContent,
          tenantId,
          params.versionReason || "Nova análise"
        );

        if (uploadResult.success) {
          dataLakeId = uploadResult.documentId;
          dataLakePath = uploadResult.pdfPath;
          version = uploadResult.version;
          chainHash = uploadResult.chainHash;
          console.log(`[DataLake] Documento indexado: ${dataLakeId} (v${version})`);
        } else {
          console.warn(`[DataLake] Falha na indexação: ${uploadResult.error}`);
        }
      } catch (dataLakeError) {
        // Não falhar a geração do relatório por erro no Data Lake
        console.error("[DataLake] Erro na indexação:", dataLakeError);
      }
    }

    return {
      success: true,
      pdfBlob,
      fileName,
      dataLakeId,
      dataLakePath,
      version,
      chainHash,
    };
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

// =====================================================
// LOG DE GERAÇÃO
// =====================================================

async function logReportGeneration(
  tenantId: string,
  referenceMonth: string,
  fileName: string
): Promise<void> {
  try {
    // Pode ser expandido para salvar em tabela específica
    console.log(`[Audit] Relatório gerado: ${fileName} para tenant ${tenantId}, período ${referenceMonth}`);
  } catch (error) {
    console.error("Erro ao registrar geração:", error);
  }
}

// =====================================================
// DOWNLOAD HELPER
// =====================================================

export function downloadPDF(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
