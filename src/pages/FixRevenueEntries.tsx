import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wrench, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ProcessingResult {
  success: boolean;
  message: string;
  stats?: {
    total: number;
    processed: number;
    skipped: number;
    errors: number;
    remaining?: number;
  };
  errors?: string[];
}

const FixRevenueEntries = () => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);

  const handleFix = async () => {
    setProcessing(true);
    setResult(null);

    try {
      console.log("🔧 Iniciando correção de lançamentos...");
      
      const { data, error } = await supabase.functions.invoke('fix-revenue-entries', {
        body: {},
      });

      if (error) {
        throw error;
      }

      console.log("✅ Resultado:", data);
      setResult(data);

      if (data.success) {
        const message = data.stats.remaining && data.stats.remaining > 0
          ? `${data.stats.processed} lançamentos criados, ${data.stats.skipped} já existiam. ${data.stats.remaining} faturas restantes - execute novamente.`
          : `${data.stats.processed} lançamentos criados, ${data.stats.skipped} já existiam.`;
        
        toast.success(data.stats.remaining && data.stats.remaining > 0 ? "Lote processado!" : "Correção concluída!", {
          description: message,
          duration: 5000,
        });
      } else {
        toast.error("Erro na correção", {
          description: data.message || "Erro desconhecido",
        });
      }
    } catch (error: any) {
      console.error("❌ Erro:", error);
      toast.error("Erro ao executar correção", {
        description: error.message,
      });
      setResult({
        success: false,
        message: error.message,
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Corrigir Lançamentos de Receita</h1>
          <p className="text-muted-foreground">
            Ferramenta para criar lançamentos de receita retroativos
          </p>
        </div>

        {/* Explicação */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>O que esta ferramenta faz?</AlertTitle>
          <AlertDescription>
            Esta função analisa todas as faturas pagas e cria os lançamentos de receita que estão faltando.
            <br /><br />
            <strong>Lançamentos criados:</strong>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Débito: 1.1.3 - Clientes a Receber</li>
              <li>Crédito: 3.1.1 - Receita de Honorários Contábeis</li>
            </ul>
            <br />
            A ferramenta não duplica lançamentos - se já existe um lançamento de receita para uma fatura, ele será ignorado.
          </AlertDescription>
        </Alert>

        {/* Card de ação */}
        <Card>
          <CardHeader>
            <CardTitle>Executar Correção</CardTitle>
            <CardDescription>
              Clique no botão abaixo para processar todas as faturas pagas e criar os lançamentos de receita faltantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleFix}
              disabled={processing}
              size="lg"
              className="w-full md:w-auto"
            >
              <Wrench className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
              {processing ? 'Processando...' : 'Corrigir Lançamentos'}
            </Button>
          </CardContent>
        </Card>

        {/* Resultado */}
        {result && (
          <Card className={result.success ? "border-green-500" : "border-red-500"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                Resultado do Processamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{result.message}</p>

              {result.stats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">{result.stats.total}</p>
                    </div>
                    <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Criados</p>
                      <p className="text-2xl font-bold text-green-600">{result.stats.processed}</p>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Já Existiam</p>
                      <p className="text-2xl font-bold text-blue-600">{result.stats.skipped}</p>
                    </div>
                    <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground">Erros</p>
                      <p className="text-2xl font-bold text-red-600">{result.stats.errors}</p>
                    </div>
                  </div>
                  
                  {result.stats.remaining && result.stats.remaining > 0 && (
                    <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                        Mais faturas para processar
                      </AlertTitle>
                      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                        Ainda restam <strong>{result.stats.remaining} faturas</strong> para processar.
                        <br />
                        Clique em "Corrigir Lançamentos" novamente para continuar.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Erros encontrados:</h4>
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {result.errors.map((error, idx) => (
                      <p key={idx} className="text-xs text-red-600 dark:text-red-400">
                        • {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instruções pós-processamento */}
        {result?.success && result.stats && result.stats.processed > 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Próximos Passos</AlertTitle>
            <AlertDescription>
              Os lançamentos foram criados com sucesso! Agora você pode:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Verificar o <strong>Balancete</strong> para ver os novos saldos</li>
                <li>Consultar a <strong>DRE</strong> para ver as receitas lançadas</li>
                <li>Revisar o <strong>Balanço Patrimonial</strong> para confirmar o equilíbrio</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  );
};

export default FixRevenueEntries;
