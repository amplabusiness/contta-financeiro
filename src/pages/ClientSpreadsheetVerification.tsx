import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface SpreadsheetClient {
  name: string;
  document: string;
}

interface DatabaseClient {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  status: string;
  is_pro_bono: boolean;
  monthly_fee: number;
}

interface ComparisonResult {
  client: DatabaseClient;
  foundInSpreadsheet: boolean;
  matchedName?: string;
  matchedDocument?: string;
}

const ClientSpreadsheetVerification = () => {
  const [loading, setLoading] = useState(true);
  const [spreadsheetClients, setSpreadsheetClients] = useState<SpreadsheetClient[]>([]);
  const [databaseClients, setDatabaseClients] = useState<DatabaseClient[]>([]);
  const [missingInApp, setMissingInApp] = useState<SpreadsheetClient[]>([]);
  const [missingInSpreadsheet, setMissingInSpreadsheet] = useState<ComparisonResult[]>([]);
  const [matched, setMatched] = useState<ComparisonResult[]>([]);

  const normalizeDocument = (doc: string): string => {
    return doc.replace(/[^\d]/g, '');
  };

  const normalizeName = (name: string): string => {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  const formatDocument = (doc: string): string => {
    const cleaned = normalizeDocument(doc);
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Carregar planilha
        const response = await fetch('/PLANILHA_FINAL.csv');
        const text = await response.text();
        const lines = text.split('\n').slice(1); // Skip header
        
        const spreadsheetData: SpreadsheetClient[] = lines
          .filter(line => line.trim())
          .map(line => {
            const [name, document] = line.split(';');
            return {
              name: name?.trim() || '',
              document: document?.trim() || ''
            };
          })
          .filter(client => client.name && client.document);

        setSpreadsheetClients(spreadsheetData);

        // Carregar todos os clientes do banco (regulares + pro-bono)
        const { data: dbClients, error: dbError } = await supabase
          .from('clients')
          .select('id, name, cnpj, cpf, status, is_pro_bono, monthly_fee')
          .eq('status', 'active');

        if (dbError) throw dbError;

        setDatabaseClients(dbClients || []);

        // Comparar dados
        const spreadsheetDocuments = new Set(
          spreadsheetData.map(c => normalizeDocument(c.document))
        );

        const spreadsheetNames = new Map(
          spreadsheetData.map(c => [normalizeName(c.name), c])
        );

        // Clientes no banco que não estão na planilha
        const notInSpreadsheet: ComparisonResult[] = [];
        const foundClients: ComparisonResult[] = [];

        dbClients?.forEach(client => {
          const clientDoc = normalizeDocument(client.cnpj || client.cpf || '');
          const clientName = normalizeName(client.name);
          
          const foundByDocument = spreadsheetDocuments.has(clientDoc);
          const foundByName = spreadsheetNames.has(clientName);

          if (foundByDocument || foundByName) {
            foundClients.push({
              client,
              foundInSpreadsheet: true,
              matchedName: foundByName ? spreadsheetNames.get(clientName)?.name : undefined,
              matchedDocument: foundByDocument ? client.cnpj || client.cpf || undefined : undefined
            });
          } else {
            notInSpreadsheet.push({
              client,
              foundInSpreadsheet: false
            });
          }
        });

        setMissingInSpreadsheet(notInSpreadsheet);
        setMatched(foundClients);

        // Clientes na planilha que não estão no banco
        const dbDocuments = new Set(
          dbClients?.map(c => normalizeDocument(c.cnpj || c.cpf || '')) || []
        );

        const notInDatabase = spreadsheetData.filter(
          spreadsheetClient => !dbDocuments.has(normalizeDocument(spreadsheetClient.document))
        );

        setMissingInApp(notInDatabase);

        toast.success('Análise concluída!');
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar dados para comparação');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Verificação de Clientes vs Planilha</h1>
          <p className="text-muted-foreground mt-2">
            Comparação entre clientes cadastrados no sistema e a planilha fornecida
          </p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total na Planilha</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{spreadsheetClients.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total no Sistema</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{databaseClients.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Correspondências</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{matched.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Divergências</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {missingInApp.length + missingInSpreadsheet.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {missingInApp.length} faltam no sistema • {missingInSpreadsheet.length} faltam na planilha
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Clientes que Faltam no Sistema */}
        {missingInApp.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Clientes na Planilha mas NÃO no Sistema ({missingInApp.length})
              </CardTitle>
              <CardDescription>
                Estes clientes estão na planilha mas não foram encontrados no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ/CPF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingInApp.map((client, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{formatDocument(client.document)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Clientes no Sistema mas não na Planilha */}
        {missingInSpreadsheet.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-orange-500" />
                Clientes no Sistema mas NÃO na Planilha ({missingInSpreadsheet.length})
              </CardTitle>
              <CardDescription>
                Estes clientes estão cadastrados no sistema mas não aparecem na planilha
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ/CPF</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingInSpreadsheet.map((result) => (
                    <TableRow key={result.client.id}>
                      <TableCell className="font-medium">{result.client.name}</TableCell>
                      <TableCell>{formatDocument(result.client.cnpj || result.client.cpf || '')}</TableCell>
                      <TableCell>
                        {result.client.monthly_fee === 0 ? (
                          <Badge variant="secondary">Pro-Bono</Badge>
                        ) : (
                          <Badge>Regular</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={result.client.status === 'active' ? 'default' : 'outline'}>
                          {result.client.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Clientes Correspondentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Clientes Correspondentes ({matched.length})
            </CardTitle>
            <CardDescription>
              Clientes encontrados tanto na planilha quanto no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matched.map((result) => (
                  <TableRow key={result.client.id}>
                    <TableCell className="font-medium">{result.client.name}</TableCell>
                    <TableCell>{formatDocument(result.client.cnpj || result.client.cpf || '')}</TableCell>
                    <TableCell>
                      {result.client.monthly_fee === 0 ? (
                        <Badge variant="secondary">Pro-Bono</Badge>
                      ) : (
                        <Badge>Regular</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={result.client.status === 'active' ? 'default' : 'outline'}>
                        {result.client.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ClientSpreadsheetVerification;
