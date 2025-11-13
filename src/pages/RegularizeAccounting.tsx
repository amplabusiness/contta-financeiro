import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { PlayCircle, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const RegularizeAccounting = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRegularize = async () => {
    if (!confirm("Confirma a regularização dos lançamentos contábeis de todos os boletos importados?\n\nSerão criados:\n- Provisionamentos (competência)\n- Baixas/Recebimentos (para boletos pagos)")) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('regularize-accounting');

      if (error) throw error;

      setResult(data);

      if (data.success) {
        toast.success(`Regularização concluída! ${data.provisionsCreated} provisionamentos e ${data.paymentsCreated} recebimentos criados.`);
      } else {
        toast.error("Erro na regularização");
      }
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao regularizar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Regularização Contábil</h1>
          <p className="text-muted-foreground mt-2">
            Processar lançamentos contábeis retroativos de boletos importados
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Processar Lançamentos em Lote</CardTitle>
            <CardDescription>
              Esta ferramenta irá processar todos os boletos importados que ainda não possuem lançamentos contábeis:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Provisionamento (Competência)</p>
                  <p className="text-sm text-muted-foreground">
                    Débito: Clientes a Receber (1.1.3) | Crédito: Receita de Honorários (3.1.1)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Baixa/Recebimento (Pagamento)</p>
                  <p className="text-sm text-muted-foreground">
                    Débito: Caixa (1.1.1) | Crédito: Clientes a Receber (1.1.3)
                  </p>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Atenção</AlertTitle>
              <AlertDescription>
                Este processo irá criar lançamentos contábeis para todos os boletos que não possuem
                lançamentos registrados. O processo pode demorar alguns minutos dependendo da quantidade
                de registros.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleRegularize}
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Iniciar Regularização
                </>
              )}
            </Button>

            {result && (
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Total de Boletos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{result.totalInvoices}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Provisionamentos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {result.provisionsCreated}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Recebimentos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {result.paymentsCreated}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erros encontrados</AlertTitle>
                    <AlertDescription>
                      <div className="mt-2 space-y-1">
                        {result.errors.slice(0, 10).map((error: string, index: number) => (
                          <div key={index} className="text-sm">
                            {error}
                          </div>
                        ))}
                        {result.errors.length > 10 && (
                          <div className="text-sm font-medium">
                            ... e mais {result.errors.length - 10} erros
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {(!result.errors || result.errors.length === 0) && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Sucesso!</AlertTitle>
                    <AlertDescription>
                      Todos os lançamentos contábeis foram criados com sucesso.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default RegularizeAccounting;
