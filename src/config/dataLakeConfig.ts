/**
 * dataLakeConfig.ts
 * 
 * Configuração do Data Lake local para RAG (Retrieval-Augmented Generation).
 * Define estrutura de diretórios e regras de armazenamento de documentos.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 31/01/2026
 */

// ============================================================================
// TYPES
// ============================================================================

export interface DataLakeConfig {
  basePath: string;
  structure: DataLakeFolder[];
  retention: RetentionPolicy;
  indexing: IndexingConfig;
}

export interface DataLakeFolder {
  name: string;
  path: string;
  description: string;
  fileTypes: string[];
  subfolders?: DataLakeFolder[];
  autoOrganize?: AutoOrganizeRule;
}

export interface RetentionPolicy {
  defaultDays: number;
  byType: Record<string, number>;
  neverDelete: string[];
}

export interface IndexingConfig {
  enabled: boolean;
  autoIndex: boolean;
  indexInterval: number; // minutos
  supportedTypes: string[];
  maxFileSize: number; // MB
  extractText: boolean;
  embeddings: boolean;
}

export interface AutoOrganizeRule {
  pattern: RegExp | string;
  destination: string;
  renamePattern?: string;
}

export interface FileMetadata {
  id: string;
  originalName: string;
  storedPath: string;
  category: string;
  subcategory?: string;
  mimeType: string;
  size: number;
  checksum: string;
  createdAt: Date;
  indexedAt?: Date;
  extractedText?: string;
  embeddingId?: string;
  tags: string[];
  linkedTo?: {
    type: 'transaction' | 'client' | 'contract' | 'invoice' | 'entry';
    id: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Estrutura padrão do Data Lake
 * Baseada na organização recomendada pelo Dr. Cícero
 */
export const DEFAULT_DATA_LAKE_STRUCTURE: DataLakeFolder[] = [
  {
    name: 'Banco',
    path: 'banco',
    description: 'Extratos e documentos bancários',
    fileTypes: ['.ofx', '.csv', '.pdf', '.xls', '.xlsx'],
    subfolders: [
      {
        name: 'OFX',
        path: 'banco/ofx',
        description: 'Arquivos OFX importados',
        fileTypes: ['.ofx'],
        autoOrganize: {
          pattern: /\.ofx$/i,
          destination: 'banco/ofx/{year}/{month}',
          renamePattern: '{bank}_{date}_extrato.ofx'
        }
      },
      {
        name: 'CSV',
        path: 'banco/csv',
        description: 'Extratos em CSV',
        fileTypes: ['.csv'],
        autoOrganize: {
          pattern: /extrato.*\.csv$/i,
          destination: 'banco/csv/{year}/{month}'
        }
      },
      {
        name: 'Comprovantes',
        path: 'banco/comprovantes',
        description: 'Comprovantes de transferência',
        fileTypes: ['.pdf', '.png', '.jpg']
      }
    ]
  },
  {
    name: 'Clientes',
    path: 'clientes',
    description: 'Documentos de clientes',
    fileTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.xml'],
    subfolders: [
      {
        name: 'Boletos',
        path: 'clientes/boletos',
        description: 'Boletos gerados e pagos',
        fileTypes: ['.pdf'],
        autoOrganize: {
          pattern: /boleto.*\.pdf$/i,
          destination: 'clientes/boletos/{year}/{month}'
        }
      },
      {
        name: 'Comprovantes',
        path: 'clientes/comprovantes',
        description: 'Comprovantes de pagamento de clientes',
        fileTypes: ['.pdf', '.png', '.jpg']
      },
      {
        name: 'Cadastros',
        path: 'clientes/cadastros',
        description: 'Documentos de cadastro',
        fileTypes: ['.pdf', '.doc', '.docx']
      },
      {
        name: 'NFSe',
        path: 'clientes/nfse',
        description: 'Notas fiscais de serviço emitidas',
        fileTypes: ['.pdf', '.xml'],
        autoOrganize: {
          pattern: /nfs?e?.*\.(?:pdf|xml)$/i,
          destination: 'clientes/nfse/{year}/{month}'
        }
      }
    ]
  },
  {
    name: 'Honorários',
    path: 'honorarios',
    description: 'Documentos relacionados a honorários',
    fileTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
    subfolders: [
      {
        name: 'Contratos',
        path: 'honorarios/contratos',
        description: 'Contratos de prestação de serviços',
        fileTypes: ['.pdf', '.doc', '.docx']
      },
      {
        name: 'Reajustes',
        path: 'honorarios/reajustes',
        description: 'Documentos de reajuste anual',
        fileTypes: ['.pdf', '.xls', '.xlsx']
      },
      {
        name: 'Exceções',
        path: 'honorarios/excecoes',
        description: 'Acordos especiais e exceções',
        fileTypes: ['.pdf', '.doc', '.docx']
      },
      {
        name: 'Propostas',
        path: 'honorarios/propostas',
        description: 'Propostas comerciais',
        fileTypes: ['.pdf', '.doc', '.docx']
      }
    ]
  },
  {
    name: 'Fornecedores',
    path: 'fornecedores',
    description: 'Documentos de fornecedores',
    fileTypes: ['.pdf', '.xml', '.xls', '.xlsx'],
    subfolders: [
      {
        name: 'NFe',
        path: 'fornecedores/nfe',
        description: 'Notas fiscais de entrada',
        fileTypes: ['.pdf', '.xml'],
        autoOrganize: {
          pattern: /nf-?e?.*\.(?:pdf|xml)$/i,
          destination: 'fornecedores/nfe/{year}/{month}'
        }
      },
      {
        name: 'Boletos',
        path: 'fornecedores/boletos',
        description: 'Boletos a pagar',
        fileTypes: ['.pdf']
      },
      {
        name: 'Comprovantes',
        path: 'fornecedores/comprovantes',
        description: 'Comprovantes de pagamento',
        fileTypes: ['.pdf', '.png', '.jpg']
      }
    ]
  },
  {
    name: 'Fiscal',
    path: 'fiscal',
    description: 'Documentos fiscais e obrigações',
    fileTypes: ['.pdf', '.txt', '.xml'],
    subfolders: [
      {
        name: 'SPED',
        path: 'fiscal/sped',
        description: 'Arquivos SPED (ECD, ECF, etc)',
        fileTypes: ['.txt'],
        autoOrganize: {
          pattern: /sped.*\.txt$/i,
          destination: 'fiscal/sped/{year}'
        }
      },
      {
        name: 'Guias',
        path: 'fiscal/guias',
        description: 'Guias de impostos (DARF, GPS, etc)',
        fileTypes: ['.pdf']
      },
      {
        name: 'Certidões',
        path: 'fiscal/certidoes',
        description: 'Certidões negativas',
        fileTypes: ['.pdf']
      }
    ]
  },
  {
    name: 'Folha',
    path: 'folha',
    description: 'Documentos de folha de pagamento',
    fileTypes: ['.pdf', '.txt', '.xls', '.xlsx'],
    subfolders: [
      {
        name: 'Holerites',
        path: 'folha/holerites',
        description: 'Contracheques',
        fileTypes: ['.pdf']
      },
      {
        name: 'eSocial',
        path: 'folha/esocial',
        description: 'Eventos eSocial',
        fileTypes: ['.txt', '.xml']
      },
      {
        name: 'Férias',
        path: 'folha/ferias',
        description: 'Avisos e recibos de férias',
        fileTypes: ['.pdf']
      },
      {
        name: 'Rescisões',
        path: 'folha/rescisoes',
        description: 'Documentos de rescisão',
        fileTypes: ['.pdf']
      }
    ]
  },
  {
    name: 'Auditoria',
    path: 'auditoria',
    description: 'Documentos de auditoria e parecer',
    fileTypes: ['.pdf', '.doc', '.docx', '.json'],
    subfolders: [
      {
        name: 'Pareceres',
        path: 'auditoria/pareceres',
        description: 'Pareceres contábeis',
        fileTypes: ['.pdf', '.doc', '.docx']
      },
      {
        name: 'Logs',
        path: 'auditoria/logs',
        description: 'Logs de auditoria do sistema',
        fileTypes: ['.json', '.txt']
      },
      {
        name: 'Conciliações',
        path: 'auditoria/conciliacoes',
        description: 'Relatórios de conciliação',
        fileTypes: ['.pdf', '.xlsx']
      }
    ]
  },
  {
    name: 'Relatórios',
    path: 'relatorios',
    description: 'Relatórios gerados pelo sistema',
    fileTypes: ['.pdf', '.xlsx', '.json'],
    subfolders: [
      {
        name: 'Balancetes',
        path: 'relatorios/balancetes',
        description: 'Balancetes mensais',
        fileTypes: ['.pdf', '.xlsx']
      },
      {
        name: 'DRE',
        path: 'relatorios/dre',
        description: 'Demonstrações de resultado',
        fileTypes: ['.pdf', '.xlsx']
      },
      {
        name: 'Fluxo de Caixa',
        path: 'relatorios/fluxo-caixa',
        description: 'Relatórios de fluxo de caixa',
        fileTypes: ['.pdf', '.xlsx']
      }
    ]
  },
  {
    name: 'IA',
    path: 'ia',
    description: 'Dados para treinamento e RAG da IA',
    fileTypes: ['.json', '.txt', '.md'],
    subfolders: [
      {
        name: 'Knowledge Base',
        path: 'ia/knowledge',
        description: 'Base de conhecimento estruturado',
        fileTypes: ['.json', '.md']
      },
      {
        name: 'Embeddings',
        path: 'ia/embeddings',
        description: 'Vetores de embeddings',
        fileTypes: ['.json']
      },
      {
        name: 'Feedback',
        path: 'ia/feedback',
        description: 'Feedback de classificações',
        fileTypes: ['.json']
      }
    ]
  }
];

/**
 * Política de retenção padrão
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  defaultDays: 365 * 6, // 6 anos (padrão fiscal brasileiro)
  byType: {
    'banco/ofx': 365 * 6,
    'banco/comprovantes': 365 * 6,
    'fiscal/sped': 365 * 10, // SPED: 10 anos
    'fiscal/guias': 365 * 6,
    'honorarios/contratos': 365 * 10, // Contratos: 10 anos
    'auditoria/logs': 365 * 2, // Logs: 2 anos
    'ia/embeddings': 365, // Embeddings: 1 ano (regenerável)
    'relatorios': 365 * 3 // Relatórios: 3 anos
  },
  neverDelete: [
    'fiscal/sped',
    'honorarios/contratos',
    'auditoria/pareceres',
    'folha/rescisoes'
  ]
};

/**
 * Configuração de indexação padrão
 */
export const DEFAULT_INDEXING_CONFIG: IndexingConfig = {
  enabled: true,
  autoIndex: true,
  indexInterval: 15, // 15 minutos
  supportedTypes: [
    '.pdf', '.txt', '.doc', '.docx',
    '.xls', '.xlsx', '.csv', '.json',
    '.xml', '.ofx', '.md'
  ],
  maxFileSize: 50, // 50 MB
  extractText: true,
  embeddings: true
};

/**
 * Configuração completa padrão do Data Lake
 */
export const DEFAULT_DATA_LAKE_CONFIG: DataLakeConfig = {
  basePath: getDefaultBasePath(),
  structure: DEFAULT_DATA_LAKE_STRUCTURE,
  retention: DEFAULT_RETENTION_POLICY,
  indexing: DEFAULT_INDEXING_CONFIG
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Obtém o caminho base padrão do Data Lake
 * Considera o sistema operacional
 */
function getDefaultBasePath(): string {
  // No navegador, usamos localStorage para configuração
  // Em produção, isso seria configurado pelo Electron/Tauri
  const stored = typeof localStorage !== 'undefined' 
    ? localStorage.getItem('contta_datalake_path') 
    : null;
  
  if (stored) return stored;
  
  // Fallback para Windows
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows')) {
    return 'C:\\contta-datalake';
  }
  
  // Fallback para Mac/Linux
  return '~/contta-datalake';
}

/**
 * Gera o caminho completo para um arquivo
 */
export function generateFilePath(
  config: DataLakeConfig,
  category: string,
  subcategory: string | null,
  filename: string,
  date?: Date
): string {
  const now = date || new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  let path = `${config.basePath}/${category}`;
  if (subcategory) {
    path += `/${subcategory}`;
  }
  
  // Substituir placeholders
  path = path
    .replace('{year}', year)
    .replace('{month}', month);
  
  return `${path}/${filename}`;
}

/**
 * Encontra a pasta correta para um arquivo baseado em regras de auto-organização
 */
export function findDestinationFolder(
  config: DataLakeConfig,
  filename: string
): DataLakeFolder | null {
  function searchFolders(folders: DataLakeFolder[]): DataLakeFolder | null {
    for (const folder of folders) {
      if (folder.autoOrganize) {
        const pattern = typeof folder.autoOrganize.pattern === 'string'
          ? new RegExp(folder.autoOrganize.pattern, 'i')
          : folder.autoOrganize.pattern;
        
        if (pattern.test(filename)) {
          return folder;
        }
      }
      
      if (folder.subfolders) {
        const found = searchFolders(folder.subfolders);
        if (found) return found;
      }
    }
    return null;
  }
  
  return searchFolders(config.structure);
}

/**
 * Valida se um tipo de arquivo é suportado
 */
export function isFileTypeSupported(
  config: DataLakeConfig,
  filename: string
): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return config.indexing.supportedTypes.includes(ext);
}

/**
 * Gera hash MD5 simplificado para checksum
 */
export function generateSimpleChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Cria estrutura de diretórios inicial (para uso com API de arquivos)
 */
export function generateDirectoryStructure(
  config: DataLakeConfig
): string[] {
  const paths: string[] = [];
  
  function collectPaths(folders: DataLakeFolder[], prefix: string = '') {
    for (const folder of folders) {
      const fullPath = prefix ? `${prefix}/${folder.path}` : folder.path;
      paths.push(`${config.basePath}/${fullPath}`);
      
      if (folder.subfolders) {
        collectPaths(folder.subfolders, '');
      }
    }
  }
  
  collectPaths(config.structure);
  return paths;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DEFAULT_DATA_LAKE_CONFIG;
