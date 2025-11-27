import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, FileSearch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  is_active: boolean;
}

interface MissingClient {
  dbClient: DatabaseClient;
  foundInSpreadsheet: boolean;
}

export default function ClientComparisonVerification() {
  const [loading, setLoading] = useState(true);
  const [missingClients, setMissingClients] = useState<MissingClient[]>([]);
  const [stats, setStats] = useState({
    totalInApp: 0,
    notInSpreadsheet: 0,
    inSpreadsheet: 0,
  });
  const { toast } = useToast();

  const normalizeDocument = (doc: string): string => {
    return doc.replace(/[^\d]/g, '');
  };

  const formatDocument = (doc: string): string => {
    const normalized = normalizeDocument(doc);
    if (normalized.length === 11) {
      return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (normalized.length === 14) {
      return normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  useEffect(() => {
    const performVerification = async () => {
      try {
        setLoading(true);

        // Fetch spreadsheet data
        const response = await fetch('/PLANILHA_FINAL.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim());
        
        const spreadsheetClients: SpreadsheetClient[] = lines.slice(1).map(line => {
          const [name, document] = line.split(';');
          return {
            name: name?.trim() || '',
            document: normalizeDocument(document?.trim() || ''),
          };
        }).filter(client => client.name && client.document);

        console.log('Spreadsheet clients loaded:', spreadsheetClients.length);

        // Fetch all active clients from database
        const { data: dbClients, error } = await supabase
          .from('clients')
          .select('id, name, cnpj, cpf, is_pro_bono, is_active')
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching clients:', error);
          toast({
            title: "Erro ao buscar clientes",
            description: "Não foi possível carregar os clientes do banco de dados.",
            variant: "destructive",
          });
          return;
        }

        console.log('Database clients loaded:', dbClients?.length);

        // Compare: find clients in DB that are NOT in spreadsheet
        const results: MissingClient[] = [];
        let notInSpreadsheetCount = 0;
        let inSpreadsheetCount = 0;

        dbClients?.forEach((dbClient: DatabaseClient) => {
          const dbDocument = normalizeDocument(dbClient.cnpj || dbClient.cpf || '');
          
          const foundInSpreadsheet = spreadsheetClients.some(
            spreadsheetClient => spreadsheetClient.document === dbDocument
          );

          results.push({
            dbClient,
            foundInSpreadsheet,
          });

          if (!foundInSpreadsheet) {
            notInSpreadsheetCount++;
          } else {
            inSpreadsheetCount++;
          }
        });

        setMissingClients(results);
        setStats({
          totalInApp: dbClients?.length || 0,
          notInSpreadsheet: notInSpreadsheetCount,
          inSpreadsheet: inSpreadsheetCount,
        });

        toast({
          title: "Verificação concluída",
          description: `Encontrados ${notInSpreadsheetCount} clientes na aplicação que não estão na planilha.`,
        });

      } catch (error) {
        console.error('Error during verification:', error);
        toast({
          title: "Erro na verificação",
          description: "Ocorreu um erro ao processar a verificação.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    performVerification();
  }, [toast]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Analisando clientes...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const clientsNotInSpreadsheet = missingClients.filter(m => !m.foundInSpreadsheet);
  const clientsInSpreadsheet = missingClients.filter(m => m.foundInSpreadsheet);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <FileSearch className="h-6 w-6" />
          <div>
            <h1 className="text-3xl font-bold">Comparação com Planilha</h1>
            <p className="text-muted-foreground">
              Clientes cadastrados na aplicação que não estão na planilha fornecida
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total na Aplicação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInApp}</div>
              <p className="text-xs text-muted-foreground">Clientes ativos cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Não Estão na Planilha</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.notInSpreadsheet}</div>
              <p className="text-xs text-muted-foreground">Clientes ausentes da planilha</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estão na Planilha</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.inSpreadsheet}</div>
              <p className="text-xs text-muted-foreground">Clientes presentes na planilha</p>
            </CardContent>
          </Card>
        </div>

        {/* Clients NOT in Spreadsheet */}
        {clientsNotInSpreadsheet.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Clientes NÃO Encontrados na Planilha
                <Badge variant="secondary">{clientsNotInSpreadsheet.length}</Badge>
              </CardTitle>
              <CardDescription>
                Estes clientes estão cadastrados na aplicação mas não constam na planilha fornecida
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clientsNotInSpreadsheet.map((result) => (
                  <div
                    key={result.dbClient.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{result.dbClient.name}</p>
                        {result.dbClient.is_pro_bono && (
                          <Badge variant="outline" className="text-xs">Pro-Bono</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDocument(result.dbClient.cnpj || result.dbClient.cpf || 'N/A')}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                      Ausente
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clients IN Spreadsheet */}
        {clientsInSpreadsheet.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Clientes Encontrados na Planilha
                <Badge variant="secondary">{clientsInSpreadsheet.length}</Badge>
              </CardTitle>
              <CardDescription>
                Estes clientes estão corretamente cadastrados tanto na aplicação quanto na planilha
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clientsInSpreadsheet.map((result) => (
                  <div
                    key={result.dbClient.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-950/20"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{result.dbClient.name}</p>
                        {result.dbClient.is_pro_bono && (
                          <Badge variant="outline" className="text-xs">Pro-Bono</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDocument(result.dbClient.cnpj || result.dbClient.cpf || 'N/A')}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      OK
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
