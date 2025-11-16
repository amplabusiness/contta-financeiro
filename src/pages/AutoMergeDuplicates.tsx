import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GitMerge, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DuplicateGroup {
  normalizedName: string;
  clients: Array<{
    id: string;
    name: string;
    cnpj: string | null;
    invoiceCount: number;
  }>;
}

interface PreviewResult {
  success: boolean;
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
}

interface MergeResult {
  success: boolean;
  results: {
    merged: number;
    deleted: number;
    errors: string[];
  };
}

export default function AutoMergeDuplicates() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setPreview(null);
      setMergeResult(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const response = await supabase.functions.invoke('merge-duplicate-clients', {
        body: { mode: 'preview' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      
      setPreview(response.data as PreviewResult);
      toast.success(`Encontrados ${response.data.totalDuplicates} grupos de clientes duplicados`);
    } catch (error) {
      console.error('Erro ao carregar preview:', error);
      toast.error("Erro ao carregar duplicados");
    } finally {
      setLoading(false);
    }
  };

  const executeMerge = async () => {
    if (!confirm(`Tem certeza que deseja mesclar ${preview?.totalDuplicates} grupos de clientes duplicados?\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const response = await supabase.functions.invoke('merge-duplicate-clients', {
        body: { mode: 'merge' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      
      const result = response.data as MergeResult;
      setMergeResult(result);
      
      toast.success(`Mesclados ${result.results.merged} grupos, deletados ${result.results.deleted} clientes duplicados`);
      
      // Limpar preview após mesclagem bem-sucedida
      setPreview(null);
    } catch (error) {
      console.error('Erro ao mesclar:', error);
      toast.error("Erro ao mesclar clientes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mesclar Clientes Duplicados</h1>
          <p className="text-muted-foreground mt-2">
            Identifique e mescle automaticamente clientes duplicados no sistema
          </p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Como funciona:</strong>
            <br />
            • Agrupa clientes pelo mesmo nome (normalizado)
            <br />
            • Mantém o cliente que possui CNPJ (quando disponível)
            <br />
            • Transfere todas as faturas e dados para o cliente mantido
            <br />
            • Deleta os clientes duplicados
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Analisar Duplicados</CardTitle>
            <CardDescription>
              Clique no botão abaixo para identificar clientes duplicados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={loadPreview} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Analisar Duplicados
                  </>
                )}
              </Button>

              {preview && preview.totalDuplicates > 0 && (
                <Button 
                  onClick={executeMerge} 
                  disabled={loading}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <GitMerge className="h-4 w-4" />
                  Mesclar {preview.totalDuplicates} Grupos
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {preview && preview.totalDuplicates > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Duplicados Encontrados ({preview.totalDuplicates} grupos)
              </CardTitle>
              <CardDescription>
                Review dos clientes que serão mesclados. O primeiro de cada grupo será mantido.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {preview.duplicateGroups.map((group, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-medium">{group.normalizedName}</h3>
                      <Badge variant="outline">
                        {group.clients.length} duplicatas
                      </Badge>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ação</TableHead>
                          <TableHead>Nome Original</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Faturas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.clients.map((client, clientIndex) => (
                          <TableRow key={client.id}>
                            <TableCell>
                              {clientIndex === 0 ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Manter
                                </Badge>
                              ) : (
                                <Badge variant="destructive">
                                  Deletar
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {client.name}
                            </TableCell>
                            <TableCell>
                              {client.cnpj ? (
                                <Badge variant="outline">{client.cnpj}</Badge>
                              ) : (
                                <span className="text-muted-foreground">Sem CNPJ</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {client.invoiceCount} faturas
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {preview && preview.totalDuplicates === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Nenhum cliente duplicado encontrado!</p>
              <p className="text-muted-foreground mt-2">
                Todos os clientes no sistema são únicos.
              </p>
            </CardContent>
          </Card>
        )}

        {mergeResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Mesclagem Concluída
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Grupos Mesclados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {mergeResult.results.merged}
                  </p>
                </div>
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Clientes Deletados</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {mergeResult.results.deleted}
                  </p>
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Erros</p>
                  <p className="text-2xl font-bold text-red-600">
                    {mergeResult.results.errors.length}
                  </p>
                </div>
              </div>

              {mergeResult.results.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600">Erros encontrados:</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {mergeResult.results.errors.map((error, index) => (
                      <p key={index} className="text-sm text-muted-foreground bg-red-500/5 p-2 rounded">
                        • {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={loadPreview} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Analisar Novamente
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
