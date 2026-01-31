/**
 * useDataLake.ts
 * 
 * Hook para gerenciar o Data Lake local e integração com RAG.
 * Permite upload, indexação e busca de documentos para a IA.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 31/01/2026
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from './useTenantConfig';
import {
  DataLakeConfig,
  FileMetadata,
  DEFAULT_DATA_LAKE_CONFIG,
  generateFilePath,
  findDestinationFolder,
  isFileTypeSupported,
  generateSimpleChecksum
} from '@/config/dataLakeConfig';

// ============================================================================
// TYPES
// ============================================================================

export interface UploadResult {
  success: boolean;
  metadata?: FileMetadata;
  error?: string;
}

export interface SearchResult {
  file: FileMetadata;
  score: number;
  highlight?: string;
  context?: string;
}

export interface IndexingProgress {
  total: number;
  processed: number;
  current?: string;
  errors: string[];
}

export interface DataLakeStats {
  totalFiles: number;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
  lastIndexed?: Date;
  pendingIndex: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'contta_datalake_files';
const INDEX_KEY = 'contta_datalake_index';

// Padrões para extração de texto de diferentes tipos de arquivo
const TEXT_EXTRACTORS: Record<string, (content: string) => string> = {
  '.json': (c) => JSON.stringify(JSON.parse(c), null, 2),
  '.txt': (c) => c,
  '.md': (c) => c,
  '.csv': (c) => c,
  '.xml': (c) => c.replace(/<[^>]*>/g, ' ').trim(),
  '.ofx': (c) => c.replace(/<[^>]*>/g, '\n').trim()
};

// ============================================================================
// HOOK
// ============================================================================

export function useDataLake(customConfig?: Partial<DataLakeConfig>) {
  const { tenant } = useTenantConfig();
  const tenantId = tenant?.id;

  const [config] = useState<DataLakeConfig>(() => ({
    ...DEFAULT_DATA_LAKE_CONFIG,
    ...customConfig
  }));

  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<IndexingProgress | null>(null);
  const [stats, setStats] = useState<DataLakeStats | null>(null);

  // ============================================================================
  // PERSISTENCE (LocalStorage + Supabase)
  // ============================================================================

  /**
   * Carrega arquivos do storage
   */
  const loadFiles = useCallback(async () => {
    if (!tenantId) return;

    // Primeiro, tenta carregar do Supabase
    const { data: dbFiles } = await supabase
      .from('datalake_files')
      .select('*')
      .eq('tenant_id', tenantId);

    if (dbFiles && dbFiles.length > 0) {
      const mapped = dbFiles.map(f => ({
        id: f.id,
        originalName: f.original_name,
        storedPath: f.stored_path,
        category: f.category,
        subcategory: f.subcategory,
        mimeType: f.mime_type,
        size: f.size,
        checksum: f.checksum,
        createdAt: new Date(f.created_at),
        indexedAt: f.indexed_at ? new Date(f.indexed_at) : undefined,
        extractedText: f.extracted_text,
        embeddingId: f.embedding_id,
        tags: f.tags || [],
        linkedTo: f.linked_to
      })) as FileMetadata[];
      
      setFiles(mapped);
      return;
    }

    // Fallback para localStorage
    const stored = localStorage.getItem(`${STORAGE_KEY}_${tenantId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      setFiles(parsed.map((f: any) => ({
        ...f,
        createdAt: new Date(f.createdAt),
        indexedAt: f.indexedAt ? new Date(f.indexedAt) : undefined
      })));
    }
  }, [tenantId]);

  /**
   * Salva arquivos no storage
   */
  const saveFiles = useCallback(async (newFiles: FileMetadata[]) => {
    if (!tenantId) return;

    // Salva no localStorage como backup
    localStorage.setItem(`${STORAGE_KEY}_${tenantId}`, JSON.stringify(newFiles));

    // Tenta salvar no Supabase
    for (const file of newFiles) {
      await supabase
        .from('datalake_files')
        .upsert({
          id: file.id,
          tenant_id: tenantId,
          original_name: file.originalName,
          stored_path: file.storedPath,
          category: file.category,
          subcategory: file.subcategory,
          mime_type: file.mimeType,
          size: file.size,
          checksum: file.checksum,
          created_at: file.createdAt.toISOString(),
          indexed_at: file.indexedAt?.toISOString(),
          extracted_text: file.extractedText,
          embedding_id: file.embeddingId,
          tags: file.tags,
          linked_to: file.linkedTo
        }, { onConflict: 'id' });
    }

    setFiles(newFiles);
  }, [tenantId]);

  // Carregar ao montar
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // ============================================================================
  // UPLOAD
  // ============================================================================

  /**
   * Faz upload de um arquivo para o Data Lake
   */
  const uploadFile = useCallback(async (
    file: File,
    category?: string,
    subcategory?: string,
    linkedTo?: FileMetadata['linkedTo'],
    tags?: string[]
  ): Promise<UploadResult> => {
    if (!tenantId) {
      return { success: false, error: 'Tenant não definido' };
    }

    setLoading(true);

    try {
      // Verificar tipo de arquivo
      if (!isFileTypeSupported(config, file.name)) {
        return { success: false, error: `Tipo de arquivo não suportado: ${file.name}` };
      }

      // Verificar tamanho
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > config.indexing.maxFileSize) {
        return { 
          success: false, 
          error: `Arquivo muito grande (${sizeMB.toFixed(1)}MB). Máximo: ${config.indexing.maxFileSize}MB` 
        };
      }

      // Auto-detectar categoria se não fornecida
      let targetCategory = category;
      let targetSubcategory = subcategory;

      if (!targetCategory) {
        const folder = findDestinationFolder(config, file.name);
        if (folder) {
          const pathParts = folder.path.split('/');
          targetCategory = pathParts[0];
          targetSubcategory = pathParts.slice(1).join('/') || undefined;
        } else {
          targetCategory = 'outros';
        }
      }

      // Ler conteúdo do arquivo
      const content = await file.text();
      const checksum = generateSimpleChecksum(content);

      // Verificar duplicata
      const existingFile = files.find(f => f.checksum === checksum);
      if (existingFile) {
        return { 
          success: false, 
          error: 'Arquivo já existe no Data Lake',
        };
      }

      // Gerar caminho de armazenamento
      const storedPath = generateFilePath(
        config,
        targetCategory,
        targetSubcategory || null,
        file.name
      );

      // Extrair texto se suportado
      let extractedText: string | undefined;
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (config.indexing.extractText && TEXT_EXTRACTORS[ext]) {
        try {
          extractedText = TEXT_EXTRACTORS[ext](content);
        } catch {
          extractedText = content.substring(0, 10000); // Fallback
        }
      }

      // Criar metadata
      const metadata: FileMetadata = {
        id: crypto.randomUUID(),
        originalName: file.name,
        storedPath,
        category: targetCategory,
        subcategory: targetSubcategory,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        checksum,
        createdAt: new Date(),
        extractedText,
        tags: tags || [],
        linkedTo
      };

      // Upload para Supabase Storage (se configurado)
      const storagePath = `${tenantId}/${metadata.storedPath}`;
      const { error: uploadError } = await supabase.storage
        .from('datalake')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      // Continua mesmo se storage falhar (salva metadados)
      if (uploadError) {
        console.warn('Storage upload failed, saving metadata only:', uploadError);
      }

      // Salvar metadados
      const newFiles = [...files, metadata];
      await saveFiles(newFiles);

      return { success: true, metadata };

    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao fazer upload' };
    } finally {
      setLoading(false);
    }
  }, [tenantId, config, files, saveFiles]);

  // ============================================================================
  // INDEXING
  // ============================================================================

  /**
   * Indexa arquivos pendentes (gera embeddings para RAG)
   */
  const indexPendingFiles = useCallback(async () => {
    if (!tenantId) return;

    const pendingFiles = files.filter(f => !f.indexedAt && f.extractedText);
    if (pendingFiles.length === 0) return;

    setIndexingProgress({
      total: pendingFiles.length,
      processed: 0,
      errors: []
    });

    const updatedFiles = [...files];
    const errors: string[] = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      setIndexingProgress(prev => ({
        ...prev!,
        processed: i,
        current: file.originalName
      }));

      try {
        // Gerar embedding via Edge Function
        const { data: embeddingResult, error: embError } = await supabase.functions
          .invoke('generate-embedding', {
            body: {
              text: file.extractedText?.substring(0, 8000), // Limite do modelo
              metadata: {
                file_id: file.id,
                category: file.category,
                filename: file.originalName
              }
            }
          });

        if (embError) throw embError;

        // Atualizar arquivo
        const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
        if (fileIndex >= 0) {
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            indexedAt: new Date(),
            embeddingId: embeddingResult?.embedding_id
          };
        }

      } catch (err: any) {
        errors.push(`${file.originalName}: ${err.message}`);
      }
    }

    await saveFiles(updatedFiles);

    setIndexingProgress({
      total: pendingFiles.length,
      processed: pendingFiles.length,
      errors
    });

    // Limpar progresso após 3 segundos
    setTimeout(() => setIndexingProgress(null), 3000);

  }, [tenantId, files, saveFiles]);

  // ============================================================================
  // SEARCH
  // ============================================================================

  /**
   * Busca semântica nos documentos indexados
   */
  const searchDocuments = useCallback(async (
    query: string,
    options?: {
      category?: string;
      limit?: number;
      minScore?: number;
    }
  ): Promise<SearchResult[]> => {
    if (!tenantId || !query.trim()) return [];

    const limit = options?.limit || 10;
    const minScore = options?.minScore || 0.5;

    try {
      // Busca via Edge Function (RAG)
      const { data: results, error } = await supabase.functions
        .invoke('search-datalake', {
          body: {
            tenant_id: tenantId,
            query,
            category: options?.category,
            limit,
            min_score: minScore
          }
        });

      if (error) throw error;

      // Mapear resultados para FileMetadata
      const searchResults: SearchResult[] = (results || []).map((r: any) => {
        const file = files.find(f => f.id === r.file_id);
        if (!file) return null;

        return {
          file,
          score: r.score,
          highlight: r.highlight,
          context: r.context
        };
      }).filter(Boolean) as SearchResult[];

      return searchResults;

    } catch (err) {
      console.error('Search error:', err);
      
      // Fallback para busca local simples
      const queryLower = query.toLowerCase();
      const localResults = files
        .filter(f => {
          if (options?.category && f.category !== options.category) return false;
          
          const nameMatch = f.originalName.toLowerCase().includes(queryLower);
          const textMatch = f.extractedText?.toLowerCase().includes(queryLower);
          const tagMatch = f.tags.some(t => t.toLowerCase().includes(queryLower));
          
          return nameMatch || textMatch || tagMatch;
        })
        .map(file => ({
          file,
          score: 0.7,
          context: file.extractedText?.substring(0, 200)
        }))
        .slice(0, limit);

      return localResults;
    }
  }, [tenantId, files]);

  // ============================================================================
  // STATS
  // ============================================================================

  /**
   * Calcula estatísticas do Data Lake
   */
  const calculateStats = useCallback((): DataLakeStats => {
    const byCategory: Record<string, { count: number; size: number }> = {};
    
    for (const file of files) {
      if (!byCategory[file.category]) {
        byCategory[file.category] = { count: 0, size: 0 };
      }
      byCategory[file.category].count++;
      byCategory[file.category].size += file.size;
    }

    const lastIndexed = files
      .filter(f => f.indexedAt)
      .sort((a, b) => (b.indexedAt?.getTime() || 0) - (a.indexedAt?.getTime() || 0))[0]
      ?.indexedAt;

    const pendingIndex = files.filter(f => !f.indexedAt && f.extractedText).length;

    return {
      totalFiles: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      byCategory,
      lastIndexed,
      pendingIndex
    };
  }, [files]);

  // Atualizar stats quando arquivos mudam
  useEffect(() => {
    setStats(calculateStats());
  }, [calculateStats]);

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  /**
   * Obtém arquivos por categoria
   */
  const getFilesByCategory = useCallback((category: string): FileMetadata[] => {
    return files.filter(f => f.category === category);
  }, [files]);

  /**
   * Obtém arquivos vinculados a uma entidade
   */
  const getLinkedFiles = useCallback((
    type: FileMetadata['linkedTo']['type'],
    id: string
  ): FileMetadata[] => {
    return files.filter(f => 
      f.linkedTo?.type === type && f.linkedTo?.id === id
    );
  }, [files]);

  /**
   * Remove um arquivo do Data Lake
   */
  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    const file = files.find(f => f.id === fileId);
    if (!file) return false;

    try {
      // Remover do Supabase Storage
      const storagePath = `${tenantId}/${file.storedPath}`;
      await supabase.storage.from('datalake').remove([storagePath]);

      // Remover metadados
      await supabase.from('datalake_files').delete().eq('id', fileId);

      // Atualizar estado local
      const newFiles = files.filter(f => f.id !== fileId);
      await saveFiles(newFiles);

      return true;
    } catch (err) {
      console.error('Delete error:', err);
      return false;
    }
  }, [tenantId, files, saveFiles]);

  /**
   * Atualiza tags de um arquivo
   */
  const updateFileTags = useCallback(async (
    fileId: string,
    tags: string[]
  ): Promise<boolean> => {
    const fileIndex = files.findIndex(f => f.id === fileId);
    if (fileIndex < 0) return false;

    const updatedFiles = [...files];
    updatedFiles[fileIndex] = {
      ...updatedFiles[fileIndex],
      tags
    };

    await saveFiles(updatedFiles);
    return true;
  }, [files, saveFiles]);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Config
    config,
    
    // State
    files,
    loading,
    indexingProgress,
    stats,
    
    // Actions
    uploadFile,
    searchDocuments,
    indexPendingFiles,
    deleteFile,
    updateFileTags,
    
    // Queries
    getFilesByCategory,
    getLinkedFiles,
    
    // Utils
    isFileTypeSupported: (filename: string) => isFileTypeSupported(config, filename)
  };
}

export default useDataLake;
