import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

export default function BoletoReconciliation() {
  const [loading, setLoading] = useState(false);
  const [boletoFile, setBoletoFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);

  const onDropBoleto = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setBoletoFile(acceptedFiles[0]);
      toast.success("Relatório de boletos carregado");
    }
  };

  const onDropBank = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setBankFile(acceptedFiles[0]);
      toast.success("Extrato bancário carregado");
    }
  };

  const { getRootProps: getBoletoRootProps, getInputProps: getBoletoInputProps, isDragActive: isBoletoActive } = useDropzone({
    onDrop: onDropBoleto,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });

  const { getRootProps: getBankRootProps, getInputProps: getBankInputProps, isDragActive: isBankActive } = useDropzone({
    onDrop: onDropBank,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
      'application/ofx': ['.ofx'],
    },
    multiple: false,
  });

  const handleReconcile = async () => {
    if (!boletoFile || !bankFile) {
      toast.error("Selecione ambos os arquivos para conciliar");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Ler arquivo de boletos
      const boletoFormData = new FormData();
      boletoFormData.append('file', boletoFile);

      // Primeiro processar o relatório de boletos
      const { data: boletoData, error: boletoError } = await supabase.functions.invoke(
        'process-boleto-report',
        {
          body: boletoFormData,
        }
      );

      if (boletoError) throw boletoError;

      // Processar extrato bancário
      const bankFormData = new FormData();
      bankFormData.append('file', bankFile);

      const { data: bankData, error: bankError } = await supabase.functions.invoke(
        'process-bank-statement',
        {
          body: bankFormData,
        }
      );

      if (bankError) throw bankError;

      // Executar conciliação automática
      const { data: reconcileData, error: reconcileError } = await supabase.functions.invoke(
        'auto-reconciliation'
      );

      if (reconcileError) throw reconcileError;

      setResult({
        success: true,
        boletoReport: boletoData,
        bankStatement: bankData,
        reconciliation: reconcileData,
      });

      toast.success("Conciliação realizada com sucesso!");
    } catch (error: any) {
      console.error("Erro na conciliação:", error);
      toast.error(error.message || "Erro ao conciliar arquivos");
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conciliação de Boletos e Extrato</h1>
          <p className="text-muted-foreground mt-2">
            Importe o relatório de boletos do banco e o extrato bancário para conciliação automática
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload Relatório de Boletos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Relatório de Boletos
              </CardTitle>
              <CardDescription>
                Arquivo XLS/XLSX do banco com os boletos pagos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getBoletoRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isBoletoActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <input {...getBoletoInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                {boletoFile ? (
                  <div>
                    <p className="font-semibold text-sm">{boletoFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(boletoFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium">
                      Arraste o arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos aceitos: XLS, XLSX
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upload Extrato Bancário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Extrato Bancário
              </CardTitle>
              <CardDescription>
                Arquivo OFX, CSV ou XLS/XLSX do extrato
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getBankRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isBankActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <input {...getBankInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                {bankFile ? (
                  <div>
                    <p className="font-semibold text-sm">{bankFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(bankFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium">
                      Arraste o arquivo ou clique para selecionar
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos aceitos: OFX, CSV, XLS, XLSX
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botão de Conciliação */}
        <Card>
          <CardContent className="pt-6">
            <Button
              onClick={handleReconcile}
              disabled={loading || !boletoFile || !bankFile}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando Conciliação...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Conciliar Arquivos
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Resultado */}
        {result && (
          <Card className={result.success ? "border-success" : "border-destructive"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Conciliação Concluída
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Erro na Conciliação
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.success ? (
                <>
                  <Alert>
                    <AlertDescription>
                      <div className="grid gap-3">
                        <div>
                          <strong>Relatório de Boletos:</strong>
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.boletoReport?.total_boletos || 0} boletos processados
                          </p>
                        </div>
                        <div>
                          <strong>Extrato Bancário:</strong>
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.bankStatement?.transactions || 0} transações importadas
                          </p>
                        </div>
                        <div>
                          <strong>Conciliação:</strong>
                          <p className="text-sm text-muted-foreground mt-1">
                            {result.reconciliation?.matched || 0} correspondências encontradas
                          </p>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-3">
                    <Button variant="outline" asChild>
                      <a href="/reconciliation-dashboard">Ver Dashboard</a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="/invoices">Ver Faturas</a>
                    </Button>
                  </div>
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {result.error || "Erro ao processar conciliação"}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
