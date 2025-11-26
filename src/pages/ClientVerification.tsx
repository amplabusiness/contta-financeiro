import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

interface SpreadsheetClient {
  name: string;
  document: string;
}

interface DatabaseClient {
  name: string;
  cnpj: string | null;
  cpf: string | null;
  monthly_fee: number;
}

interface VerificationResult {
  spreadsheetClient: SpreadsheetClient;
  found: boolean;
  databaseClient?: DatabaseClient;
  isProBono?: boolean;
}

const ClientVerification = () => {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    found: 0,
    notFound: 0,
    proBono: 0,
    paid: 0,
  });

  const normalizeDocument = (doc: string): string => {
    return doc.replace(/[^0-9]/g, "");
  };

  const formatDocument = (doc: string): string => {
    const normalized = normalizeDocument(doc);
    if (normalized.length === 11) {
      return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (normalized.length === 14) {
      return normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    return doc;
  };

  useEffect(() => {
    const loadAndVerify = async () => {
      try {
        // 1. Carregar arquivo CSV
        const response = await fetch("/LISTA_DAS_ATIVAS.csv");
        const csvText = await response.text();
        
        // Parse CSV (separado por ponto-e-vírgula)
        const lines = csvText.split("\n").filter(line => line.trim());
        const spreadsheetClients: SpreadsheetClient[] = [];
        
        // Pular a primeira linha (cabeçalho)
        for (let i = 1; i < lines.length; i++) {
          const [name, document] = lines[i].split(";");
          if (name && document) {
            spreadsheetClients.push({
              name: name.trim(),
              document: document.trim(),
            });
          }
        }

        // 2. Buscar todos os clientes do banco
        const { data: dbClients, error } = await supabase
          .from("clients")
          .select("name, cnpj, cpf, monthly_fee")
          .eq("status", "active");

        if (error) throw error;

        // 3. Comparar
        const verificationResults: VerificationResult[] = [];
        let foundCount = 0;
        let proBonoCount = 0;
        let paidCount = 0;

        spreadsheetClients.forEach((spreadsheetClient) => {
          const normalizedSpreadsheetDoc = normalizeDocument(spreadsheetClient.document);
          
          const matchingDbClient = dbClients?.find((dbClient) => {
            const normalizedCnpj = dbClient.cnpj ? normalizeDocument(dbClient.cnpj) : "";
            const normalizedCpf = dbClient.cpf ? normalizeDocument(dbClient.cpf) : "";
            
            return normalizedCnpj === normalizedSpreadsheetDoc || 
                   normalizedCpf === normalizedSpreadsheetDoc;
          });

          const found = !!matchingDbClient;
          const isProBono = matchingDbClient ? matchingDbClient.monthly_fee === 0 : undefined;

          if (found) {
            foundCount++;
            if (isProBono) {
              proBonoCount++;
            } else {
              paidCount++;
            }
          }

          verificationResults.push({
            spreadsheetClient,
            found,
            databaseClient: matchingDbClient,
            isProBono,
          });
        });

        setResults(verificationResults);
        setStats({
          total: spreadsheetClients.length,
          found: foundCount,
          notFound: spreadsheetClients.length - foundCount,
          proBono: proBonoCount,
          paid: paidCount,
        });

        toast.success("Análise concluída!");
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao processar a verificação");
      } finally {
        setLoading(false);
      }
    };

    loadAndVerify();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 animate-pulse text-primary" />
          <p className="text-lg">Analisando clientes...</p>
        </div>
      </div>
    );
  }

  const notFoundClients = results.filter((r) => !r.found);
  const foundClients = results.filter((r) => r.found);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Verificação de Clientes</h1>
        <p className="text-muted-foreground">
          Comparação entre a planilha LISTA_DAS_ATIVAS.csv e os clientes cadastrados no sistema
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total na Planilha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.found}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((stats.found / stats.total) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Não Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.notFound}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {((stats.notFound / stats.total) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Clientes Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.paid}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.found > 0 ? ((stats.paid / stats.found) * 100).toFixed(1) : 0}% dos cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pro-Bono</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.proBono}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.found > 0 ? ((stats.proBono / stats.found) * 100).toFixed(1) : 0}% dos cadastrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Clientes NÃO Cadastrados */}
      {notFoundClients.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              Clientes NÃO Cadastrados ({notFoundClients.length})
            </CardTitle>
            <CardDescription>
              Os seguintes clientes estão na planilha mas não foram encontrados no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notFoundClients.map((result, idx) => (
                <div key={idx} className="flex items-start justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{result.spreadsheetClient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDocument(result.spreadsheetClient.document)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="ml-2">Não Encontrado</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clientes Cadastrados */}
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            Clientes Cadastrados ({foundClients.length})
          </CardTitle>
          <CardDescription>
            Clientes que foram encontrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {foundClients.map((result, idx) => (
              <div key={idx} className="flex items-start justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{result.spreadsheetClient.name}</p>
                    {result.isProBono ? (
                      <Badge variant="secondary" className="text-xs">Pro-Bono</Badge>
                    ) : (
                      <Badge variant="default" className="text-xs">Cliente Pago</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDocument(result.spreadsheetClient.document)}
                  </p>
                  {result.databaseClient && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Cadastrado como: <span className="font-medium">{result.databaseClient.name}</span>
                    </p>
                  )}
                </div>
                <Badge variant="default" className="ml-2 bg-green-600">Encontrado</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientVerification;
