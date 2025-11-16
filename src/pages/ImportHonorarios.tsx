import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export default function ImportHonorarios() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(xls|xlsx)$/i)) {
        toast({
          title: "Erro",
          description: "Por favor, selecione um arquivo Excel (.xls ou .xlsx)",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo primeiro",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Call edge function
      const { data, error } = await supabase.functions.invoke('process-honorarios-spreadsheet', {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results);
        toast({
          title: "Processamento Concluído",
          description: `${data.results.updated} clientes atualizados com sucesso!`,
        });
      } else {
        throw new Error(data.error || 'Erro ao processar planilha');
      }

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Erro ao Processar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Importar Honorários</h1>
          <p className="text-muted-foreground">
            Faça upload da planilha de honorários para atualizar os valores e datas de vencimento dos clientes
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Planilha de Honorários (.xls ou .xlsx)</Label>
              <div className="mt-2 flex items-center gap-4">
                <Input
                  id="file"
                  type="file"
                  accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="min-w-[120px]"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Processar
                    </>
                  )}
                </Button>
              </div>
              {file && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>

            {loading && (
              <div className="space-y-2">
                <Progress value={50} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Processando planilha e atualizando clientes...
                </p>
              </div>
            )}
          </div>
        </Card>

        {results && (
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">Resultados do Processamento</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>Processados:</strong> {results.processed} clientes
                </AlertDescription>
              </Alert>

              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong>Atualizados:</strong> {results.updated} clientes
                </AlertDescription>
              </Alert>

              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-900">
                  <strong>Não Encontrados:</strong> {results.notFound.length} clientes
                </AlertDescription>
              </Alert>
            </div>

            {results.notFound.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  Clientes Não Encontrados
                </h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 max-h-48 overflow-y-auto">
                  <ul className="text-sm space-y-1">
                    {results.notFound.map((name: string, idx: number) => (
                      <li key={idx} className="text-yellow-900">• {name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {results.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Erros Durante Processamento
                </h3>
                <div className="bg-red-50 border border-red-200 rounded-md p-3 max-h-48 overflow-y-auto">
                  <ul className="text-sm space-y-2">
                    {results.errors.map((err: any, idx: number) => (
                      <li key={idx} className="text-red-900">
                        <strong>{err.client}:</strong> {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        )}

        <Card className="p-6">
          <h3 className="font-semibold mb-3">ℹ️ Instruções</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• A planilha deve conter as colunas: Pagador, Data Vencimento, Valor (R$), Situação do Boleto</li>
            <li>• O sistema identificará o valor de honorário mais frequente para cada cliente</li>
            <li>• O dia de vencimento mais comum será definido como dia de pagamento padrão</li>
            <li>• Clientes serão identificados pelo nome (correspondência automática)</li>
            <li>• Apenas boletos liquidados serão considerados para cálculo</li>
          </ul>
        </Card>
      </div>
    </Layout>
  );
}