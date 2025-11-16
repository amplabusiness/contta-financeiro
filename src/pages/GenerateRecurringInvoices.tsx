import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, DollarSign, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function GenerateRecurringInvoices() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-recurring-invoices');

      if (error) {
        throw error;
      }

      setResult(data);
      
      if (data.success) {
        toast.success(`${data.generated} honorários gerados com sucesso!`);
      } else {
        toast.error(data.error || "Erro ao gerar honorários");
      }
    } catch (error: any) {
      console.error("Erro ao gerar honorários:", error);
      toast.error(error.message || "Erro ao gerar honorários recorrentes");
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gerar Honorários Recorrentes 2025</h1>
          <p className="text-muted-foreground mt-2">
            Gera automaticamente as contas a receber de honorários contábeis para todo o ano de 2025
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Honorários de 2025
            </CardTitle>
            <CardDescription>
              Esta ferramenta criará automaticamente 13 faturas para cada cliente ativo:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">12 Honorários Mensais</h3>
                  <p className="text-sm text-muted-foreground">
                    Competências de 01/2025 a 12/2025, usando o valor de honorário mensal e dia de vencimento cadastrados para cada cliente
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">1 Honorário de Balanço (13º)</h3>
                  <p className="text-sm text-muted-foreground">
                    Competência 13/2025 com vencimento em 20/12/2025, no valor do honorário mensal
                  </p>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Apenas clientes com status "Ativo" e com valor de honorário mensal maior que zero serão incluídos. Faturas já existentes para as mesmas competências serão ignoradas.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={loading}
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Gerar Honorários 2025
                  </>
                )}
              </Button>
            </div>

            {result && (
              <Card className={result.success ? "border-success" : "border-destructive"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {result.success ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-success" />
                        Honorários Gerados com Sucesso
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        Erro ao Gerar Honorários
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.success ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Faturas Geradas</p>
                          <p className="text-2xl font-bold text-success">{result.generated}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Clientes Processados</p>
                          <p className="text-2xl font-bold">{result.clients_processed}</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {result.message}
                      </p>
                      {result.errors && result.errors.length > 0 && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Erros encontrados:</strong>
                            <ul className="list-disc list-inside mt-2">
                              {result.errors.map((error: string, index: number) => (
                                <li key={index} className="text-sm">{error}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <p className="text-destructive">{result.error || "Erro desconhecido"}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
