// ===========================================================================
// RAG SEARCH SERVICE - Dr. Cícero Knowledge Base
// ===========================================================================
import { supabase } from '../lib/supabase'

export interface RAGSearchResult {
  id: string
  source: 'documents' | 'document_catalog'
  title: string
  content: string
  category: string
  relevance: number
  metadata: Record<string, unknown>
}

/**
 * Busca unificada no Data Lake (documents + document_catalog)
 */
export async function searchKnowledgeBase(
  tenantId: string,
  query: string,
  options?: {
    category?: string
    limit?: number
    includeDocuments?: boolean
    includeCatalog?: boolean
  }
): Promise<RAGSearchResult[]> {
  const {
    category,
    limit = 10,
    includeDocuments = true,
    includeCatalog = true
  } = options || {}

  const results: RAGSearchResult[] = []
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

  // 1. Buscar em documents (documentação markdown)
  if (includeDocuments) {
    let docQuery = supabase
      .from('documents')
      .select('id, file_name, file_path, type, metadata')
      .eq('tenant_id', tenantId)
      .limit(limit)

    if (category) {
      docQuery = docQuery.eq('type', category)
    }

    const { data: docs, error: docError } = await docQuery

    if (!docError && docs) {
      for (const doc of docs) {
        const meta = doc.metadata as Record<string, unknown>
        const content = (meta?.content as string) || ''
        const title = (meta?.title as string) || doc.file_name
        
        // Calcular relevância baseada em correspondência de palavras
        let relevance = 0
        const contentLower = content.toLowerCase()
        const titleLower = (title || '').toLowerCase()
        
        for (const word of queryWords) {
          if (titleLower.includes(word)) relevance += 3
          if (contentLower.includes(word)) relevance += 1
        }
        
        if (relevance > 0) {
          results.push({
            id: doc.id,
            source: 'documents',
            title,
            content: content.slice(0, 2000),
            category: doc.type || meta?.category || 'knowledge',
            relevance,
            metadata: {
              file_path: doc.file_path,
              file_name: doc.file_name,
              ...meta
            }
          })
        }
      }
    }
  }

  // 2. Buscar em document_catalog (auditorias e decisões)
  if (includeCatalog) {
    let catQuery = supabase
      .from('document_catalog')
      .select('id, title, description, document_type, tags, metadata, content_summary')
      .eq('tenant_id', tenantId)
      .limit(limit)

    if (category) {
      catQuery = catQuery.eq('document_type', category)
    }

    const { data: catalog, error: catError } = await catQuery

    if (!catError && catalog) {
      for (const doc of catalog) {
        const content = doc.description || doc.content_summary || ''
        const meta = doc.metadata as Record<string, unknown>
        
        // Calcular relevância
        let relevance = 0
        const titleLower = (doc.title || '').toLowerCase()
        const contentLower = content.toLowerCase()
        const tagsStr = (doc.tags || []).join(' ').toLowerCase()
        
        for (const word of queryWords) {
          if (titleLower.includes(word)) relevance += 3
          if (contentLower.includes(word)) relevance += 1
          if (tagsStr.includes(word)) relevance += 2
        }
        
        if (relevance > 0) {
          results.push({
            id: doc.id,
            source: 'document_catalog',
            title: doc.title,
            content,
            category: doc.document_type || 'audit',
            relevance,
            metadata: {
              tags: doc.tags,
              ...meta
            }
          })
        }
      }
    }
  }

  // Ordenar por relevância e limitar
  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit)
}

/**
 * Busca documentação de regras contábeis (para classificação)
 */
export async function searchAccountingRules(
  tenantId: string,
  description: string
): Promise<RAGSearchResult[]> {
  return searchKnowledgeBase(tenantId, description, {
    category: 'contabil',
    limit: 5,
    includeDocuments: true,
    includeCatalog: false
  })
}

/**
 * Busca histórico de decisões para contexto
 */
export async function searchDecisionHistory(
  tenantId: string,
  context: string
): Promise<RAGSearchResult[]> {
  return searchKnowledgeBase(tenantId, context, {
    category: 'parecer',
    limit: 10,
    includeDocuments: false,
    includeCatalog: true
  })
}

/**
 * Busca prompts e instruções dos agentes
 */
export async function searchAgentPrompts(
  tenantId: string,
  topic: string
): Promise<RAGSearchResult[]> {
  return searchKnowledgeBase(tenantId, topic, {
    category: 'prompt',
    limit: 5,
    includeDocuments: true,
    includeCatalog: false
  })
}

/**
 * Busca rápida por categoria
 */
export async function getDocumentsByCategory(
  tenantId: string,
  category: string,
  limit: number = 20
): Promise<RAGSearchResult[]> {
  const results: RAGSearchResult[] = []
  
  // Documents
  const { data: docs } = await supabase
    .from('documents')
    .select('id, file_name, file_path, type, metadata')
    .eq('tenant_id', tenantId)
    .eq('type', category)
    .limit(limit)

  if (docs) {
    for (const doc of docs) {
      const meta = doc.metadata as Record<string, unknown>
      results.push({
        id: doc.id,
        source: 'documents',
        title: (meta?.title as string) || doc.file_name,
        content: ((meta?.content as string) || '').slice(0, 500),
        category,
        relevance: 1,
        metadata: meta
      })
    }
  }

  return results
}

/**
 * Obter estatísticas do Data Lake
 */
export async function getDataLakeStats(tenantId: string): Promise<{
  totalDocuments: number
  totalCatalog: number
  categories: Record<string, number>
}> {
  // Contar documents
  const { count: docCount } = await supabase
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  // Contar catalog
  const { count: catCount } = await supabase
    .from('document_catalog')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  // Contar por categoria em documents
  const { data: docTypes } = await supabase
    .from('documents')
    .select('type')
    .eq('tenant_id', tenantId)

  const categories: Record<string, number> = {}
  if (docTypes) {
    for (const d of docTypes) {
      const cat = d.type || 'outros'
      categories[cat] = (categories[cat] || 0) + 1
    }
  }

  return {
    totalDocuments: docCount || 0,
    totalCatalog: catCount || 0,
    categories
  }
}

export default {
  searchKnowledgeBase,
  searchAccountingRules,
  searchDecisionHistory,
  searchAgentPrompts,
  getDocumentsByCategory,
  getDataLakeStats
}
