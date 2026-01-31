import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Database, 
  Search, 
  Upload, 
  FileText, 
  FolderTree,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Filter,
  Eye,
  Download,
  HardDrive,
  Brain,
  FileJson,
  FileSpreadsheet,
  File
} from "lucide-react";
import { useDataLake } from "@/hooks/useDataLake";
import { DEFAULT_DATA_LAKE_STRUCTURE } from "@/config/dataLakeConfig";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Simulated documents for demo
const DEMO_DOCUMENTS = [
  {
    id: "1",
    name: "Extrato_Sicredi_Jan2025.ofx",
    type: "ofx",
    folder: "extratos/sicredi/2025",
    size: 45320,
    uploadedAt: new Date(2025, 0, 15),
    indexed: true,
    chunks: 12
  },
  {
    id: "2",
    name: "Relatorio_Cobranca_Jan2025.xlsx",
    type: "xlsx",
    folder: "cobrancas/relatorios/2025",
    size: 128450,
    uploadedAt: new Date(2025, 0, 20),
    indexed: true,
    chunks: 45
  },
  {
    id: "3",
    name: "NF_00012345.pdf",
    type: "pdf",
    folder: "notas_fiscais/emitidas/2025",
    size: 234567,
    uploadedAt: new Date(2025, 0, 22),
    indexed: false,
    chunks: 0
  },
  {
    id: "4",
    name: "Contrato_ClienteXYZ.pdf",
    type: "pdf",
    folder: "contratos/ativos",
    size: 567890,
    uploadedAt: new Date(2025, 0, 10),
    indexed: true,
    chunks: 28
  }
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(type: string) {
  switch (type) {
    case "ofx": return <FileJson className="h-5 w-5 text-blue-500" />;
    case "xlsx": return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    case "pdf": return <FileText className="h-5 w-5 text-red-500" />;
    default: return <File className="h-5 w-5 text-gray-500" />;
  }
}

export default function DataLakePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{documentName: string; content: string; similarity: number}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const { 
    files, 
    loading,
    stats,
    uploadFile, 
    searchDocuments,
    indexPendingFiles,
    config
  } = useDataLake();

  // Use demo documents if no real documents
  const displayDocuments = files.length > 0 ? files.map(f => ({
    id: f.id,
    name: f.originalName,
    type: f.originalName.split('.').pop() || '',
    folder: f.storedPath,
    size: f.size,
    uploadedAt: f.createdAt,
    indexed: !!f.indexedAt,
    chunks: f.extractedText ? Math.ceil(f.extractedText.length / 500) : 0
  })) : DEMO_DOCUMENTS;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const results = await searchDocuments(searchQuery);
      setSearchResults(results.map(r => ({
        documentName: r.file.originalName,
        content: r.highlight || r.context || '',
        similarity: r.score
      })));
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    const totalFiles = filesList.length;
    let completed = 0;
    
    for (const file of Array.from(filesList)) {
      const result = await uploadFile(file, selectedFolder || 'outros');
      completed++;
      setUploadProgress(Math.round((completed / totalFiles) * 100));
    }
    
    setIsUploading(false);
  };
  
  const handleIndexDocument = async (docId: string) => {
    // O indexamento é feito automaticamente via indexPendingFiles
    await indexPendingFiles();
  };

  // Statistics
  const totalDocs = displayDocuments.length;
  const indexedDocs = displayDocuments.filter(d => d.indexed).length;
  const totalChunks = displayDocuments.reduce((sum, d) => sum + (d.chunks || 0), 0);
  const totalSize = displayDocuments.reduce((sum, d) => sum + d.size, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-100 rounded-lg">
            <Database className="h-8 w-8 text-violet-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Data Lake + RAG</h1>
            <p className="text-muted-foreground">
              Central de documentos com indexação inteligente para IA
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-2">
          <Brain className="h-4 w-4" />
          {indexedDocs}/{totalDocs} Indexados
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documentos</p>
                <p className="text-2xl font-bold">{totalDocs}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Indexados</p>
                <p className="text-2xl font-bold text-green-600">{indexedDocs}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Chunks RAG</p>
                <p className="text-2xl font-bold text-violet-600">{totalChunks}</p>
              </div>
              <Sparkles className="h-8 w-8 text-violet-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Armazenamento</p>
                <p className="text-2xl font-bold">{formatBytes(totalSize)}</p>
              </div>
              <HardDrive className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Upload */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar nos documentos indexados... (busca semântica com RAG)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={isSearching}>
                <Sparkles className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </form>
            
            <div className="flex gap-2">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                accept=".pdf,.ofx,.xlsx,.xls,.csv,.json,.txt"
                onChange={handleFileUpload}
                aria-label="Upload de arquivos para o Data Lake"
              />
              <Button 
                variant="outline" 
                onClick={() => document.getElementById("file-upload")?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>
          
          {isUploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Fazendo upload...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folder Tree */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Estrutura de Pastas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-1">
                  <Button
                    variant={selectedFolder === null ? "secondary" : "ghost"}
                    className="w-full justify-start h-8 text-sm"
                    onClick={() => setSelectedFolder(null)}
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Todos os documentos
                  </Button>
                  
                  {DEFAULT_DATA_LAKE_STRUCTURE.map((folder) => {
                    const Icon = {
                      banco: FileJson,
                      clientes: FileSpreadsheet,
                      fiscal: FileText,
                      contabil: FileText,
                      rh: FileText,
                      contratos: FileText,
                      backup: HardDrive
                    }[folder.path as keyof typeof folder] || File;
                    
                    return (
                      <div key={folder.path}>
                        <Button
                          variant={selectedFolder === folder.path ? "secondary" : "ghost"}
                          className="w-full justify-start h-8 text-sm"
                          onClick={() => setSelectedFolder(folder.path)}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {folder.name}
                        </Button>
                        
                        {folder.subfolders && selectedFolder === folder.path && (
                          <div className="ml-4 mt-1 space-y-1">
                            {folder.subfolders.map((sub) => (
                              <Button
                                key={sub.path}
                                variant="ghost"
                                className="w-full justify-start h-7 text-xs"
                                onClick={() => setSelectedFolder(sub.path)}
                              >
                                <div className="w-4 h-4 mr-2 border-l border-b border-muted-foreground/30" />
                                {sub.name}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Document List */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {selectedFolder ? `Documentos em /${selectedFolder}` : "Todos os Documentos"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtrar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {displayDocuments
                    .filter(doc => !selectedFolder || doc.folder.startsWith(selectedFolder))
                    .map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getFileIcon(doc.type)}
                          <div>
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.folder} • {formatBytes(doc.size)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {doc.indexed ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {doc.chunks} chunks
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Não indexado
                            </Badge>
                          )}
                          
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(doc.uploadedAt, { locale: ptBR, addSuffix: true })}
                          </span>
                          
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="h-4 w-4" />
                            </Button>
                            {!doc.indexed && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleIndexDocument(doc.id)}
                              >
                                <Sparkles className="h-4 w-4 text-violet-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Search Results */}
          {searchResults && searchResults.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" />
                  Resultados da Busca Semântica
                </CardTitle>
                <CardDescription>
                  {searchResults.length} resultados encontrados para "{searchQuery}"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <div 
                      key={index}
                      className="p-4 border rounded-lg bg-violet-50/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{result.documentName}</span>
                        <Badge variant="outline">
                          {Math.round(result.similarity * 100)}% relevante
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {result.content}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
