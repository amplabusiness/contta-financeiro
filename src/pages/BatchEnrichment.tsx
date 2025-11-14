import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, CheckCircle, AlertCircle, Download, Zap } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BatchEnrichment = () => {
  const [processing, setProcessing] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      toast.success('Arquivo carregado! Clique em "Processar Planilha" para iniciar.');
    }
  };

  const processBillingFile = async () => {
    if (!file) {
      toast.error('Selecione um arquivo primeiro');
      return;
    }

    setProcessing(true);
    setResults([]);

    try {
      // Ler arquivo Excel
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      console.log('Dados lidos:', jsonData.length, 'registros');

      // Transformar dados para o formato esperado
      const billingData = jsonData.map((row: any) => ({
        pagador: row['Pagador'] || row['pagador'] || '',
        valor: String(row['Valor (R$)'] || row['valor'] || '0'),
        dataVencimento: row['Data Vencimento'] || row['dataVencimento'] || ''
      })).filter(r => r.pagador && r.dataVencimento);

      console.log('Dados processados:', billingData.length, 'registros válidos');

      // Enviar para a edge function
      const { data: processResult, error } = await supabase.functions.invoke('process-billing-data', {
        body: { billingData }
      });

      if (error) throw error;

      setResults(processResult.results || []);
      
      toast.success(
        `Processamento concluído! ${processResult.summary.updated} atualizados, ${processResult.summary.notFound} não encontrados`,
        { duration: 5000 }
      );

    } catch (error: any) {
      console.error('Erro ao processar planilha:', error);
      toast.error('Erro ao processar planilha: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const enrichAllClients = async () => {
    setEnrichingAll(true);
    setResults([]);

    try {
      // Buscar todos os clientes com CNPJ
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, cnpj')
        .not('cnpj', 'is', null)
        .neq('cnpj', '');

      if (error) throw error;

      if (!clients || clients.length === 0) {
        toast.info('Nenhum cliente com CNPJ encontrado');
        return;
      }

      setProgress({ current: 0, total: clients.length });
      const enrichmentResults = [];

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        
        try {
          const { data, error: enrichError } = await supabase.functions.invoke('enrich-client-data', {
            body: {
              clientId: client.id,
              cnpj: client.cnpj
            }
          });

          if (enrichError) throw enrichError;

          enrichmentResults.push({
            client: client.name,
            status: 'success',
            message: `${data.socios_count} sócios encontrados`
          });
        } catch (error: any) {
          enrichmentResults.push({
            client: client.name,
            status: 'error',
            message: error.message
          });
        }

        setProgress({ current: i + 1, total: clients.length });

        // Delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setResults(enrichmentResults);
      toast.success(`Enriquecimento concluído! ${enrichmentResults.filter(r => r.status === 'success').length} de ${clients.length} clientes processados`);

    } catch (error: any) {
      console.error('Erro ao enriquecer clientes:', error);
      toast.error('Erro ao enriquecer clientes: ' + error.message);
    } finally {
      setEnrichingAll(false);
    }
  };

  const downloadResults = () => {
    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados');
    XLSX.writeFile(workbook, `resultados_processamento_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Relatório exportado com sucesso!');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">⚡ Processamento em Lote</h1>
          <p className="text-muted-foreground mt-2">
            Atualize dados de múltiplos clientes automaticamente
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Processar Planilha de Boletos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar Planilha de Boletos
              </CardTitle>
              <CardDescription>
                Atualize honorários e dias de pagamento baseado nos boletos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileUpload}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90"
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Arquivo selecionado: {file.name}
                  </p>
                )}
              </div>

              <Button
                onClick={processBillingFile}
                disabled={processing || !file}
                className="w-full"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Processar Planilha
                  </>
                )}
              </Button>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• A planilha deve conter as colunas: Pagador, Valor (R$), Data Vencimento</p>
                <p>• Os clientes serão identificados pelo nome do pagador</p>
                <p>• O sistema calculará a média dos honorários e o dia mais frequente</p>
              </div>
            </CardContent>
          </Card>

          {/* Card: Enriquecer Todos os Clientes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Enriquecer Todos os Clientes
              </CardTitle>
              <CardDescription>
                Buscar dados da Receita Federal para todos os clientes com CNPJ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">O que será feito:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Buscar dados completos na Receita Federal</li>
                  <li>Atualizar razão social, endereço, sócios</li>
                  <li>Criar registros de pagadores automaticamente</li>
                  <li>Manter histórico de mudanças</li>
                </ul>
              </div>

              <Button
                onClick={enrichAllClients}
                disabled={enrichingAll}
                className="w-full"
              >
                {enrichingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enriquecendo {progress.current}/{progress.total}...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Iniciar Enriquecimento
                  </>
                )}
              </Button>

              {enrichingAll && (
                <div className="space-y-2">
                  <Progress value={(progress.current / progress.total) * 100} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">
                    {Math.round((progress.current / progress.total) * 100)}% concluído
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Resultados do Processamento</CardTitle>
                  <CardDescription>
                    {results.length} registros processados
                  </CardDescription>
                </div>
                <Button onClick={downloadResults} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{result.client}</TableCell>
                        <TableCell>
                          {result.status === 'updated' || result.status === 'success' ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Sucesso
                            </Badge>
                          ) : result.status === 'skipped' ? (
                            <Badge variant="secondary" className="gap-1">
                              Ignorado
                            </Badge>
                          ) : result.status === 'not_found' ? (
                            <Badge variant="outline" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Não encontrado
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Erro
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {result.message || 
                           (result.amount ? `R$ ${result.amount.toFixed(2)} - Dia ${result.paymentDay}` : '') ||
                           (result.suggestedAmount ? `Sugestão: R$ ${result.suggestedAmount.toFixed(2)} - Dia ${result.suggestedPaymentDay}` : '')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default BatchEnrichment;
