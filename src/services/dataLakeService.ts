/**
 * Data Lake Service - Auditoria Contta
 * 
 * Gerencia armazenamento e indexação de documentos de auditoria
 * para uso em RAG (Retrieval-Augmented Generation) pelo Dr. Cícero.
 * 
 * Estrutura:
 * /auditoria/divergencias/{tenant_id}/{ano}/{mes}/
 *   - report_{timestamp}.pdf
 *   - metadata_{timestamp}.json
 * 
 * @author Dr. Cícero (via Contta)
 * @date 31/01/2026
 */

import { supabase } from "@/integrations/supabase/client";

// =====================================================
// TIPOS
// =====================================================

export interface DocumentMetadata {
  id: string;
  tenant_id: string;
  document_type: "divergence_report" | "balancete" | "dre" | "conciliacao";
  reference_month: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  
  // Conteúdo estruturado para RAG
  content_summary: string;
  key_values: Record<string, number | string>;
  tags: string[];
  
  // Auditoria
  generated_at: string;
  generated_by: string | null;
  version: number;
  previous_version_id: string | null;
  
  // Indexação
  is_indexed: boolean;
  indexed_at: string | null;
  chunk_count: number;
}

export interface DivergenceReportContent {
  tenantId: string;
  tenantName: string;
  tenantCnpj?: string | null;
  referenceMonth: string;
  generatedAt: string;
  
  // Valores principais
  operationalTotal: number;
  accountingTotal: number;
  divergenceAmount: number;
  
  // Status
  status: string;
  notes: string | null;
  
  // Detalhes (opcional)
  pendingInvoicesCount?: number;
  overdueInvoicesCount?: number;
  openingBalanceAmount?: number;
  
  // Análises
  analyses: Array<{
    date: string;
    status: string;
    notes: string | null;
    pendingInvoices?: number;
    overdueInvoices?: number;
    openingBalance?: number;
  }>;
}

export interface UploadResult {
  success: boolean;
  metadata?: DocumentMetadata;
  documentId?: string;
  pdfPath?: string;
  version?: number;
  chainHash?: string;
  previousVersionId?: string | null;
  error?: string;
}

// =====================================================
// CONSTANTES
// =====================================================

const BUCKET_NAME = "documents"; // Bucket existente
const BASE_PATH = "auditoria/divergencias";

// =====================================================
// FUNÇÕES DE HASH (para versionamento)
// =====================================================

/**
 * Gera hash SHA-256 de um conteúdo
 * Usado para verificar integridade e criar cadeia de versões
 */
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Gera hash do PDF (usando ArrayBuffer)
 */
async function generateBlobHash(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// =====================================================
// FUNÇÕES DE ARMAZENAMENTO
// =====================================================

/**
 * Faz upload de um relatório de divergências para o Data Lake
 * Com suporte a versionamento e hash encadeado para compliance
 */
export async function uploadDivergenceReport(
  pdfBlob: Blob,
  content: DivergenceReportContent,
  tenantId: string,
  versionReason: string = "Nova análise"
): Promise<UploadResult> {
  try {
    const timestamp = Date.now();
    const [year, month] = content.referenceMonth.split("-");
    
    // Gerar hash do conteúdo para versionamento
    const contentHash = await generateBlobHash(pdfBlob);
    
    // Gerar caminhos
    const basePath = `${BASE_PATH}/${tenantId}/${year}/${month}`;
    const pdfFileName = `report_${timestamp}.pdf`;
    const metadataFileName = `metadata_${timestamp}.json`;
    
    const pdfPath = `${basePath}/${pdfFileName}`;
    const metadataPath = `${basePath}/${metadataFileName}`;

    // 1. Upload do PDF
    const { error: pdfError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(pdfPath, pdfBlob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (pdfError) {
      console.error("Erro ao fazer upload do PDF:", pdfError);
      throw new Error(`Falha no upload do PDF: ${pdfError.message}`);
    }

    // 2. Criar metadata estruturada
    const contentSummary = generateContentSummary(content);
    const tags = generateTags(content);
    const keyValues = {
      operational_total: content.operationalTotal,
      accounting_total: content.accountingTotal,
      divergence_amount: content.divergenceAmount,
      pending_count: content.pendingInvoicesCount || 0,
      overdue_count: content.overdueInvoicesCount || 0,
      opening_balance: content.openingBalanceAmount || 0,
    };

    // 3. Tentar usar RPC de versionamento (se disponível)
    let versionResult: {
      newId: string;
      newVersion: number;
      chainHash: string;
      previousVersionId: string | null;
    } | null = null;

    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc("create_document_version", {
          p_tenant_id: tenantId,
          p_document_type: "divergence_report",
          p_reference_month: content.referenceMonth,
          p_file_path: pdfPath,
          p_file_size: pdfBlob.size,
          p_content_summary: contentSummary,
          p_key_values: keyValues,
          p_tags: tags,
          p_content_hash: contentHash,
          p_version_reason: versionReason,
        });

      if (!rpcError && rpcData && rpcData.length > 0) {
        versionResult = {
          newId: rpcData[0].new_id,
          newVersion: rpcData[0].new_version,
          chainHash: rpcData[0].chain_hash,
          previousVersionId: rpcData[0].previous_version_id,
        };
        console.log(`[Data Lake] Versão ${versionResult.newVersion} criada com hash: ${versionResult.chainHash?.substring(0, 16)}...`);
      }
    } catch (rpcErr) {
      // RPC pode não existir ainda - fallback para método antigo
      console.warn("[Data Lake] RPC de versionamento não disponível, usando método legado");
    }

    // 4. Fallback: registrar sem versionamento se RPC falhou
    if (!versionResult) {
      const metadata: DocumentMetadata = {
        id: `div_${timestamp}`,
        tenant_id: tenantId,
        document_type: "divergence_report",
        reference_month: content.referenceMonth,
        file_name: pdfFileName,
        file_path: pdfPath,
        file_size: pdfBlob.size,
        mime_type: "application/pdf",
        content_summary: contentSummary,
        key_values: keyValues,
        tags: tags,
        generated_at: new Date().toISOString(),
        generated_by: null,
        version: 1,
        previous_version_id: null,
        is_indexed: false,
        indexed_at: null,
        chunk_count: 0,
      };

      await registerInCatalog(metadata, content);

      versionResult = {
        newId: metadata.id,
        newVersion: 1,
        chainHash: contentHash,
        previousVersionId: null,
      };
    }

    // 5. Upload do metadata como JSON
    const metadataForStorage = {
      id: versionResult.newId,
      tenant_id: tenantId,
      document_type: "divergence_report",
      reference_month: content.referenceMonth,
      file_path: pdfPath,
      file_size: pdfBlob.size,
      content_summary: contentSummary,
      key_values: keyValues,
      tags: tags,
      version: versionResult.newVersion,
      chain_hash: versionResult.chainHash,
      previous_version_id: versionResult.previousVersionId,
      generated_at: new Date().toISOString(),
    };

    const metadataBlob = new Blob(
      [JSON.stringify(metadataForStorage, null, 2)],
      { type: "application/json" }
    );

    const { error: metaError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(metadataPath, metadataBlob, {
        contentType: "application/json",
        upsert: false,
      });

    if (metaError) {
      console.warn("Erro ao fazer upload do metadata:", metaError);
    }

    console.log(`[Data Lake] Documento salvo: ${pdfPath} (v${versionResult.newVersion})`);

    return {
      success: true,
      documentId: versionResult.newId,
      pdfPath: pdfPath,
      version: versionResult.newVersion,
      chainHash: versionResult.chainHash,
      previousVersionId: versionResult.previousVersionId,
    };
  } catch (error) {
    console.error("Erro no upload para Data Lake:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

/**
 * Gera resumo textual para RAG
 */
function generateContentSummary(content: DivergenceReportContent): string {
  const parts: string[] = [];

  parts.push(`Relatório de Divergências - ${content.tenantName}`);
  parts.push(`Período: ${formatMonth(content.referenceMonth)}`);
  parts.push(`Gerado em: ${new Date(content.generatedAt).toLocaleDateString("pt-BR")}`);
  parts.push("");
  
  parts.push("VALORES:");
  parts.push(`- Visão Operacional: R$ ${content.operationalTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  parts.push(`- Visão Contábil (OFICIAL): R$ ${content.accountingTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  parts.push(`- Divergência: R$ ${content.divergenceAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  parts.push("");

  const hasDivergence = content.divergenceAmount > 0.01;
  const allResolved = content.analyses.every(a => a.status === "resolvido");
  
  if (hasDivergence) {
    parts.push("CAUSAS IDENTIFICADAS:");
    if (content.pendingInvoicesCount && content.pendingInvoicesCount > 0) {
      parts.push(`- ${content.pendingInvoicesCount} faturas pendentes de pagamento`);
    }
    if (content.overdueInvoicesCount && content.overdueInvoicesCount > 0) {
      parts.push(`- ${content.overdueInvoicesCount} faturas em atraso`);
    }
    if (content.openingBalanceAmount && content.openingBalanceAmount > 0) {
      parts.push(`- Saldo de abertura pendente: R$ ${content.openingBalanceAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    }
    parts.push("");
  }

  parts.push("STATUS:");
  parts.push(`- Status atual: ${content.status}`);
  if (allResolved) {
    parts.push("- Todas as divergências foram resolvidas");
  } else if (hasDivergence) {
    parts.push("- Existem divergências pendentes de resolução");
  } else {
    parts.push("- Sem divergências no período");
  }

  if (content.notes) {
    parts.push("");
    parts.push(`OBSERVAÇÕES: ${content.notes}`);
  }

  if (content.analyses.length > 0) {
    parts.push("");
    parts.push(`ANÁLISES REGISTRADAS: ${content.analyses.length}`);
    content.analyses.forEach((a, i) => {
      parts.push(`  ${i + 1}. ${a.status} - ${new Date(a.date).toLocaleDateString("pt-BR")}`);
      if (a.notes) {
        parts.push(`     Observação: ${a.notes.substring(0, 100)}${a.notes.length > 100 ? '...' : ''}`);
      }
    });
  }

  return parts.join("\n");
}

/**
 * Gera tags para busca e classificação
 */
function generateTags(content: DivergenceReportContent): string[] {
  const tags: string[] = [
    "auditoria",
    "divergencia",
    content.referenceMonth,
    content.referenceMonth.split("-")[0], // ano
  ];

  const hasDivergence = content.divergenceAmount > 0.01;
  const allResolved = content.analyses.every(a => a.status === "resolvido");

  if (hasDivergence) {
    tags.push("com_divergencia");
    
    if (content.divergenceAmount > 10000) {
      tags.push("divergencia_alta");
    } else if (content.divergenceAmount > 1000) {
      tags.push("divergencia_media");
    } else {
      tags.push("divergencia_baixa");
    }
  } else {
    tags.push("sem_divergencia");
  }

  // Status atual
  tags.push(content.status);

  if (allResolved) {
    tags.push("resolvido");
  } else if (hasDivergence) {
    tags.push("pendente");
  }

  if (content.openingBalanceAmount && content.openingBalanceAmount > 0) {
    tags.push("saldo_abertura");
  }

  if (content.overdueInvoicesCount && content.overdueInvoicesCount > 0) {
    tags.push("faturas_atrasadas");
  }

  return tags;
}

/**
 * Registra documento no catálogo do banco de dados
 */
async function registerInCatalog(
  metadata: DocumentMetadata,
  content: DivergenceReportContent
): Promise<void> {
  try {
    // Inserir na tabela de catálogo (se existir)
    const { error } = await supabase
      .from("document_catalog")
      .insert({
        id: metadata.id,
        tenant_id: metadata.tenant_id,
        document_type: metadata.document_type,
        reference_month: metadata.reference_month,
        file_path: metadata.file_path,
        file_size: metadata.file_size,
        content_summary: metadata.content_summary,
        key_values: metadata.key_values,
        tags: metadata.tags,
        generated_at: metadata.generated_at,
        version: metadata.version,
        is_indexed: false,
      });

    if (error) {
      // Tabela pode não existir ainda - não é crítico
      console.warn("Catálogo não disponível:", error.code);
    }
  } catch (error) {
    console.warn("Erro ao registrar no catálogo:", error);
  }
}

// =====================================================
// FUNÇÕES DE CONSULTA
// =====================================================

/**
 * Lista documentos de um tenant por período
 */
export async function listDocuments(
  tenantId: string,
  year?: string,
  month?: string
): Promise<DocumentMetadata[]> {
  try {
    let path = `${BASE_PATH}/${tenantId}`;
    if (year) path += `/${year}`;
    if (month) path += `/${month}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(path, {
        search: "metadata_",
      });

    if (error) {
      console.error("Erro ao listar documentos:", error);
      return [];
    }

    // Carregar cada metadata
    const metadataFiles = data?.filter(f => f.name.startsWith("metadata_")) || [];
    const documents: DocumentMetadata[] = [];

    for (const file of metadataFiles) {
      const { data: fileData } = await supabase.storage
        .from(BUCKET_NAME)
        .download(`${path}/${file.name}`);

      if (fileData) {
        const text = await fileData.text();
        documents.push(JSON.parse(text));
      }
    }

    return documents.sort((a, b) => 
      new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
    );
  } catch (error) {
    console.error("Erro ao listar documentos:", error);
    return [];
  }
}

/**
 * Busca documentos por tags (para RAG)
 */
export async function searchByTags(
  tenantId: string,
  tags: string[]
): Promise<DocumentMetadata[]> {
  try {
    // Se a tabela de catálogo existir, usar ela
    const { data, error } = await supabase
      .from("document_catalog")
      .select("*")
      .eq("tenant_id", tenantId)
      .contains("tags", tags)
      .order("generated_at", { ascending: false })
      .limit(20);

    if (error) {
      console.warn("Catálogo não disponível para busca:", error.code);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Erro na busca por tags:", error);
    return [];
  }
}

/**
 * Obtém URL de download de um documento
 */
export async function getDocumentUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error("Erro ao gerar URL:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Erro ao obter URL:", error);
    return null;
  }
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return `${months[parseInt(month) - 1]}/${year}`;
}

// =====================================================
// FUNÇÕES DE VERSIONAMENTO
// =====================================================

export interface DocumentVersion {
  id: string;
  version: number;
  generatedAt: string;
  versionReason: string | null;
  contentHash: string | null;
  chainHash: string | null;
  isCurrent: boolean;
  keyValues: Record<string, number | string>;
  filePath: string;
}

export interface ChainVerificationResult {
  version: number;
  expectedChainHash: string;
  actualChainHash: string;
  isValid: boolean;
}

/**
 * Obtém histórico de versões de um documento
 */
export async function getDocumentVersions(
  tenantId: string,
  documentType: string,
  referenceMonth: string
): Promise<DocumentVersion[]> {
  try {
    const { data, error } = await supabase
      .rpc("get_document_versions", {
        p_tenant_id: tenantId,
        p_document_type: documentType,
        p_reference_month: referenceMonth,
      });

    if (error) {
      console.error("Erro ao buscar versões:", error);
      return [];
    }

    return (data || []).map((v: any) => ({
      id: v.id,
      version: v.version,
      generatedAt: v.generated_at,
      versionReason: v.version_reason,
      contentHash: v.content_hash,
      chainHash: v.chain_hash,
      isCurrent: v.is_current,
      keyValues: v.key_values,
      filePath: v.file_path,
    }));
  } catch (error) {
    console.error("Erro ao buscar versões:", error);
    return [];
  }
}

/**
 * Verifica integridade da cadeia de versões
 * Retorna array com resultado de cada versão
 */
export async function verifyVersionChain(
  tenantId: string,
  documentType: string,
  referenceMonth: string
): Promise<ChainVerificationResult[]> {
  try {
    const { data, error } = await supabase
      .rpc("verify_version_chain", {
        p_tenant_id: tenantId,
        p_document_type: documentType,
        p_reference_month: referenceMonth,
      });

    if (error) {
      console.error("Erro ao verificar cadeia:", error);
      return [];
    }

    return (data || []).map((v: any) => ({
      version: v.version,
      expectedChainHash: v.expected_chain_hash,
      actualChainHash: v.actual_chain_hash,
      isValid: v.is_valid,
    }));
  } catch (error) {
    console.error("Erro ao verificar cadeia:", error);
    return [];
  }
}

/**
 * Obtém timeline de decisões (para Dr. Cícero)
 */
export interface DecisionTimelineEntry {
  referenceMonth: string;
  versionCount: number;
  firstAnalysis: string;
  lastAnalysis: string;
  finalStatus: string;
  divergenceAmount: number;
  decisionSummary: string;
}

export async function getDecisionTimeline(
  tenantId: string,
  monthsBack: number = 12
): Promise<DecisionTimelineEntry[]> {
  try {
    const { data, error } = await supabase
      .rpc("get_decision_timeline", {
        p_tenant_id: tenantId,
        p_months_back: monthsBack,
      });

    if (error) {
      console.error("Erro ao buscar timeline:", error);
      return [];
    }

    return (data || []).map((d: any) => ({
      referenceMonth: d.reference_month,
      versionCount: d.version_count,
      firstAnalysis: d.first_analysis,
      lastAnalysis: d.last_analysis,
      finalStatus: d.final_status,
      divergenceAmount: d.divergence_amount || 0,
      decisionSummary: d.decision_summary,
    }));
  } catch (error) {
    console.error("Erro ao buscar timeline:", error);
    return [];
  }
}

/**
 * Formata resposta com fonte (para Dr. Cícero)
 * Adiciona transparência sobre de onde veio a informação
 */
export function formatResponseWithSource(
  response: string,
  sources: { type: string; count: number; period?: string }[]
): string {
  if (sources.length === 0) return response;

  const sourceText = sources
    .map(s => {
      if (s.period) {
        return `${s.type} (${s.count} ocorrências, período: ${s.period})`;
      }
      return `${s.type} (${s.count} ocorrências)`;
    })
    .join("; ");

  return `${response}\n\n(Fonte: ${sourceText})`;
}

// =====================================================
// PREPARAÇÃO PARA RAG (FUTURO)
// =====================================================

/**
 * Prepara chunks de um documento para embedding
 * (Será usado quando integrar com OpenAI/Anthropic embeddings)
 */
export function prepareForEmbedding(metadata: DocumentMetadata): string[] {
  const chunks: string[] = [];

  // Chunk 1: Identificação
  chunks.push(`
Documento: Relatório de Divergências
Empresa: ${metadata.tenant_id}
Período: ${metadata.reference_month}
Tipo: ${metadata.document_type}
  `.trim());

  // Chunk 2: Resumo
  chunks.push(metadata.content_summary);

  // Chunk 3: Valores-chave
  const values = metadata.key_values;
  chunks.push(`
Valores do período ${metadata.reference_month}:
- Total Operacional: R$ ${values.operational_total}
- Total Contábil: R$ ${values.accounting_total}
- Divergência: R$ ${values.divergence_amount}
- Faturas Pendentes: ${values.pending_count}
- Faturas Atrasadas: ${values.overdue_count}
- Saldo Abertura: R$ ${values.opening_balance}
  `.trim());

  // Chunk 4: Classificação
  chunks.push(`
Tags: ${metadata.tags.join(", ")}
Versão: ${metadata.version}
Indexado: ${metadata.is_indexed ? "Sim" : "Não"}
  `.trim());

  return chunks;
}
