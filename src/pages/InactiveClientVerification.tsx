import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileX, CheckCircle, XCircle, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";

interface SpreadsheetClient {
  name: string;
  document: string;
}

interface DatabaseClient {
  name: string;
  cnpj: string | null;
  cpf: string | null;
  id: string;
  is_pro_bono: boolean;
  status: string;
}

interface VerificationResult {
  spreadsheetClient: SpreadsheetClient;
  found: boolean;
  databaseClient?: DatabaseClient;
}

const InactiveClientVerification = () => {
  const [loading, setLoading] = useState(true);
  const [inactivating, setInactivating] = useState(false);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    stillActive: 0,
    alreadyInactive: 0,
  });

  const normalizeDocument = (doc: string): string => {
    return doc.replace(/[^\d]/g, "");
  };

  const formatDocument = (doc: string): string => {
    const cleaned = normalizeDocument(doc);
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return doc;
  };

  const handleInactivateClients = async () => {
    setInactivating(true);
    try {
      const activeClients = results.filter(r => r.found && r.databaseClient?.is_active === true);
      
      if (activeClients.length === 0) {
        toast.info("Nenhum cliente ativo para inativar");
        setInactivating(false);
        return;
      }

      const clientIds = activeClients.map(r => r.databaseClient!.id);

      const { error } = await supabase
        .from('clients')
        .update({ is_active: false })
        .in('id', clientIds);

      if (error) throw error;

      toast.success(`${activeClients.length} cliente(s) inativado(s) com sucesso!`);
      
      // Recarrega a página para mostrar os resultados atualizados
      window.location.reload();
    } catch (error) {
      console.error('Erro ao inativar clientes:', error);
      toast.error("Erro ao inativar clientes");
    } finally {
      setInactivating(false);
    }
  };

  useEffect(() => {
    const loadAndVerify = async () => {
      try {
        // 1. Carregar CSV
        const response = await fetch('/LISTA_DAS_INATIVAS.csv');
        const text = await response.text();
        const lines = text.split('\n').slice(1); // Remove header
        
        const spreadsheetClients: SpreadsheetClient[] = lines
          .filter(line => line.trim())
          .map(line => {
            const [name, document] = line.split(';');
            return { name: name?.trim() || '', document: document?.trim() || '' };
          })
          .filter(client => client.name && client.document);

        // 2. Buscar todos os clientes no banco (ativos e inativos)
        const { data: dbClients, error } = await supabase
          .from('clients')
          .select('id, name, cnpj, cpf, is_pro_bono, status');

        if (error) throw error;

        // 3. Criar mapa de clientes por documento normalizado
        const dbClientMap = new Map<string, DatabaseClient>();
        dbClients?.forEach(client => {
          const doc = client.cnpj || client.cpf;
          if (doc) {
            dbClientMap.set(normalizeDocument(doc), {
              name: client.name,
              cnpj: client.cnpj,
              cpf: client.cpf,
              id: client.id,
              is_pro_bono: client.is_pro_bono,
              status: client.status,
            });
          }
        });

        // 4. Verificar cada cliente da planilha
        const verificationResults: VerificationResult[] = spreadsheetClients.map(spreadsheetClient => {
          const normalizedDoc = normalizeDocument(spreadsheetClient.document);
          const dbClient = dbClientMap.get(normalizedDoc);
          
          return {
            spreadsheetClient,
            found: !!dbClient,
            databaseClient: dbClient,
          };
        });

        setResults(verificationResults);

        // 5. Calcular estatísticas
        const stillActive = verificationResults.filter(r => r.found && r.databaseClient?.is_active === true).length;
        const alreadyInactive = verificationResults.filter(r => r.found && r.databaseClient?.is_active === false).length;

        setStats({
          total: spreadsheetClients.length,
          stillActive,
          alreadyInactive,
        });

      } catch (error) {
        console.error('Erro ao verificar ex-clientes:', error);
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };

    loadAndVerify();
  }, []);

  const stillActiveClients = results.filter(r => r.found && r.databaseClient?.is_active === true);
  const alreadyInactiveClients = results.filter(r => r.found && r.databaseClient?.is_active === false);
  const notFoundClients = results.filter(r => !r.found);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Verificando ex-clientes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verificação de Ex-Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Análise de ex-clientes da planilha que ainda estão cadastrados como ativos no sistema
          </p>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Ex-Clientes</CardTitle>
              <FileX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Ex-clientes na planilha
              </p>
            </CardContent>
          </Card>

          <Card className="border-yellow-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ainda Ativos</CardTitle>
              <XCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.stillActive}</div>
              <p className="text-xs text-muted-foreground">
                Precisam ser inativados
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Já Inativos</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.alreadyInactive}</div>
              <p className="text-xs text-muted-foreground">
                Situação correta
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Clientes ainda ATIVOS (precisam ser inativados) */}
        {stillActiveClients.length > 0 && (
          <Card className="border-yellow-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-yellow-700">
                    Ex-Clientes Ainda ATIVOS no Sistema
                  </CardTitle>
                  <CardDescription>
                    Estes {stillActiveClients.length} cliente(s) estão marcados como ex-clientes na planilha mas ainda estão ativos no sistema
                  </CardDescription>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="lg" disabled={inactivating}>
                      {inactivating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Inativando...
                        </>
                      ) : (
                        <>
                          <UserX className="mr-2 h-4 w-4" />
                          Inativar Todos
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Inativar {stillActiveClients.length} cliente(s)?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá marcar como <strong>inativos</strong> todos os {stillActiveClients.length} ex-clientes que ainda estão ativos no sistema.
                        <br/><br/>
                        Os clientes não serão deletados, apenas terão seu status alterado para "inactive".
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleInactivateClients}>
                        Confirmar Inativação
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stillActiveClients.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{result.spreadsheetClient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDocument(result.spreadsheetClient.document)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.databaseClient?.is_pro_bono && (
                        <Badge variant="secondary">Pro-Bono</Badge>
                      )}
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                        Ativo
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clientes já INATIVOS (situação correta) */}
        {alreadyInactiveClients.length > 0 && (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="text-green-700">
                Ex-Clientes Já INATIVOS no Sistema
              </CardTitle>
              <CardDescription>
                Estes {alreadyInactiveClients.length} cliente(s) já estão corretamente marcados como inativos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alreadyInactiveClients.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg bg-green-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{result.spreadsheetClient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDocument(result.spreadsheetClient.document)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.databaseClient?.is_pro_bono && (
                        <Badge variant="secondary">Pro-Bono</Badge>
                      )}
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        Inativo
                      </Badge>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clientes NÃO ENCONTRADOS */}
        {notFoundClients.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ex-Clientes NÃO Encontrados</CardTitle>
              <CardDescription>
                Estes {notFoundClients.length} cliente(s) da planilha não foram encontrados no sistema (nunca foram cadastrados ou já foram deletados)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notFoundClients.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{result.spreadsheetClient.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDocument(result.spreadsheetClient.document)}
                      </p>
                    </div>
                    <Badge variant="outline">Não Encontrado</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default InactiveClientVerification;
