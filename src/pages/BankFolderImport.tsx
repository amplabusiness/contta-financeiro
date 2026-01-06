import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  FolderOpen,
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Banknote
} from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

interface ImportResult {
  fileName: string;
  type: 'ofx' | 'excel';
  status: 'success' | 'error';
  message: string;
  transactionsCount?: number;
  paymentsCount?: number;
}

const BankFolderImport = () => {
  const [ofxFiles, setOfxFiles] = useState<FileList | null>(null);
  const [excelFiles, setExcelFiles] = useState<FileList | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [autoPosting, setAutoPosting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('2025-01');

  const monthRange = (() => {
    if (!selectedMonth) return null;
    const [y, m] = selectedMonth.split('-').map(Number);
    if (!y || !m) return null;
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return {
      startStr: start.toISOString().split('T')[0],
      endStr: end.toISOString().split('T')[0],
      label: `${String(start.getUTCDate()).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} a ${String(end.getUTCDate()).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    };
  })();

  const handleOfxImport = async () => {
    if (!ofxFiles || ofxFiles.length === 0) {
      toast.error("Selecione pelo menos um arquivo OFX");
      return;
    }

    setImporting(true);
    setProgress(0);
    const importResults: ImportResult[] = [];
    const totalFiles = ofxFiles.length;

    for (let i = 0; i < ofxFiles.length; i++) {
      const file = ofxFiles[i];
      setProgress(((i + 1) / totalFiles) * 50); // 0-50% para OFX

      try {
        const text = await file.text();

        // Chamar Edge Function para processar OFX
        const { data, error } = await supabase.functions.invoke('parse-ofx-statement', {
          body: { ofx_content: text }
        });

        if (error) throw error;

        importResults.push({
          fileName: file.name,
          type: 'ofx',
          status: 'success',
          message: 'Importado com sucesso',
          transactionsCount: data?.transactions?.length || 0
        });

        toast.success(`${file.name} importado`);
      } catch (error) {
        console.error(`Erro ao importar ${file.name}:`, error);
        importResults.push({
          fileName: file.name,
          type: 'ofx',
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        });
        toast.error(`Erro em ${file.name}`);
      }
    }

    setResults(prev => [...prev, ...importResults]);
    setImporting(false);
  };

  const handleExcelImport = async () => {
    if (!excelFiles || excelFiles.length === 0) {
      toast.error("Selecione pelo menos um arquivo Excel");
      return;
    }

    setImporting(true);
    setProgress(50); // 50-100% para Excel
    const importResults: ImportResult[] = [];
    const totalFiles = excelFiles.length;

    for (let i = 0; i < excelFiles.length; i++) {
      const file = excelFiles[i];
      setProgress(50 + ((i + 1) / totalFiles) * 50);

      try {
        // Ler arquivo Excel
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // Chamar Edge Function para processar Excel
        const { data, error } = await supabase.functions.invoke('process-bank-excel-report', {
          body: { 
            fileContent: base64,
            fileName: file.name
          }
        });

        if (error) throw error;

        importResults.push({
          fileName: file.name,
          type: 'excel',
          status: 'success',
          message: 'Processado com sucesso',
          paymentsCount: data?.paymentsProcessed || 0
        });

        toast.success(`${file.name} processado`);
      } catch (error) {
        console.error(`Erro ao processar ${file.name}:`, error);
        importResults.push({
          fileName: file.name,
          type: 'excel',
          status: 'error',
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        });
        toast.error(`Erro em ${file.name}`);
      }
    }

    setResults(prev => [...prev, ...importResults]);
    setImporting(false);
    setProgress(100);
  };

  const handleBatchImport = async () => {
    setResults([]);
    setProgress(0);

    // Importar OFX primeiro
    if (ofxFiles && ofxFiles.length > 0) {
      await handleOfxImport();
    }

    // Depois importar Excel
    if (excelFiles && excelFiles.length > 0) {
      await handleExcelImport();
    }

    setProgress(100);
    toast.success("Importação em lote concluída!");
  };

  const autoPostBankFees = async () => {
    setAutoPosting(true);
    try {
      if (!monthRange) {
        toast.error('Selecione o mês de trabalho.');
        return;
      }

      const { data: txs, error } = await supabase
        .from('bank_transactions')
        .select('id, amount, transaction_date, description')
        .lt('amount', 0)
        .or('description.ilike.%TARIFA%,description.ilike.%LIQUIDACAO%')
        .gte('transaction_date', monthRange.startStr)
        .lte('transaction_date', monthRange.endStr)
        .order('transaction_date', { ascending: true });

      if (error) throw error;

      if (!txs || txs.length === 0) {
        toast.info('Nenhuma tarifa bancária encontrada no período.');
        return;
      }

      let created = 0;
      for (const tx of txs) {
        const { data: existing } = await supabase
          .from('accounting_entries')
          .select('id')
          .eq('reference_type', 'bank_transaction')
          .eq('reference_id', String(tx.id))
          .maybeSingle();

        if (existing?.id) continue; // já lançado

        const { data, error: fnError } = await supabase.functions.invoke('smart-accounting', {
          body: {
            action: 'create_entry',
            entry_type: 'pagamento_despesa',
            amount: Math.abs(Number(tx.amount || 0)),
            date: tx.transaction_date,
            description: tx.description || 'Tarifa Bancária',
            reference_type: 'bank_transaction',
            reference_id: String(tx.id),
            expense_category: 'tarifas', // 4.1.3.02
            metadata: {
              source_module: 'BankFolderImport',
              origin_context: 'auto_post_bank_fees',
              created_at: new Date().toISOString(),
            },
          },
        });

        if (fnError) {
          console.error('Erro ao criar lançamento de tarifa:', fnError);
          continue;
        }
        if (data?.success) created++;
      }

      if (created > 0) {
        toast.success(`Lançamentos de tarifas criados: ${created}`);
      } else {
        toast.info('Nenhuma tarifa pendente para lançar.');
      }
    } catch (err: any) {
      console.error('Falha ao lançar tarifas:', err);
      toast.error(err?.message || 'Erro ao lançar tarifas bancárias');
    } finally {
      setAutoPosting(false);
    }
  };

  const clearAll = () => {
    setOfxFiles(null);
    setExcelFiles(null);
    setResults([]);
    setProgress(0);
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const totalTransactions = results.reduce((sum, r) => sum + (r.transactionsCount || 0), 0);
  const totalPayments = results.reduce((sum, r) => sum + (r.paymentsCount || 0), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importação da Pasta Banco</h1>
          <p className="text-muted-foreground">
            Importe extratos OFX e planilhas Excel da pasta banco para conciliação automática
          </p>
        </div>

        {/* Instruções */}
        <Alert>
          <FolderOpen className="h-4 w-4" />
          <AlertDescription>
            <strong>Como usar:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
              <li>Selecione os arquivos OFX (extratos bancários)</li>
              <li>Selecione as planilhas Excel (relatório de boletos pagos/em aberto)</li>
              <li>Clique em "Importar Tudo" para processar</li>
              <li>O sistema fará a conciliação automática</li>
            </ol>
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Upload de OFX */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Extratos OFX
              </CardTitle>
              <CardDescription>
                Arquivos de extrato bancário do SICREDI (.ofx)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ofx-files">Selecionar Arquivos OFX</Label>
                <Input
                  id="ofx-files"
                  type="file"
                  accept=".ofx"
                  multiple
                  onChange={(e) => setOfxFiles(e.target.files)}
                  disabled={importing}
                />
                {ofxFiles && ofxFiles.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {ofxFiles.length} arquivo(s) selecionado(s)
                  </p>
                )}
              </div>

              <Button
                onClick={handleOfxImport}
                disabled={!ofxFiles || importing}
                className="w-full"
                variant="outline"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Importar OFX
              </Button>
            </CardContent>
          </Card>

          {/* Upload de Excel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Planilhas Excel
              </CardTitle>
              <CardDescription>
                Relatórios de boletos pagos/em aberto (.xlsx, .xls)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="excel-files">Selecionar Planilhas</Label>
                <Input
                  id="excel-files"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  onChange={(e) => setExcelFiles(e.target.files)}
                  disabled={importing}
                />
                {excelFiles && excelFiles.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {excelFiles.length} arquivo(s) selecionado(s)
                  </p>
                )}
              </div>

              <Button
                onClick={handleExcelImport}
                disabled={!excelFiles || importing}
                className="w-full"
                variant="outline"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Processar Excel
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Ações em Lote */}
        <Card>
          <CardHeader>
            <CardTitle>Importação em Lote</CardTitle>
            <CardDescription>
              Importe todos os arquivos de uma vez
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleBatchImport}
                disabled={(!ofxFiles && !excelFiles) || importing}
                className="flex-1"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Importar Tudo
              </Button>
              <Button
                onClick={clearAll}
                disabled={importing}
                variant="outline"
              >
                Limpar
              </Button>
            </div>

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-center text-muted-foreground">
                  Processando... {Math.round(progress)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lançar tarifas bancárias automaticamente */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Tarifas Bancárias
            </CardTitle>
            <CardDescription>
              Cria lançamentos contábeis para tarifas de cobrança (ex: TARIFA COM R LIQUIDACAO-COBxxxx) dentro do mês selecionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="tarifa-month">Mês de trabalho</Label>
              <Input
                id="tarifa-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={autoPosting}
              />
              <p className="text-xs text-muted-foreground">
                Janela: {monthRange?.label || 'Selecione um mês'}
              </p>
            </div>
            <Button
              onClick={autoPostBankFees}
              disabled={autoPosting}
              className="w-full"
              variant="secondary"
            >
              {autoPosting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Banknote className="h-4 w-4 mr-2" />
              )}
              Lançar tarifas (mês selecionado)
            </Button>
            <p className="text-xs text-muted-foreground">
              Inclui cobranças vinculadas a LIQUIDACAO/COB. Evita duplicar se o lançamento já existir.
            </p>
          </CardContent>
        </Card>

        {/* Resultados */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resultados da Importação</CardTitle>
              <CardDescription>
                Resumo do processamento dos arquivos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Estatísticas */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total de Arquivos</p>
                  <p className="text-2xl font-bold">{results.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Sucesso</p>
                  <p className="text-2xl font-bold text-green-600">{successCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Erros</p>
                  <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Transações</p>
                  <p className="text-2xl font-bold">{totalTransactions + totalPayments}</p>
                </div>
              </div>

              {/* Lista de Resultados */}
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {result.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <p className="font-medium">{result.fileName}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.message}
                          {result.transactionsCount && ` - ${result.transactionsCount} transações`}
                          {result.paymentsCount && ` - ${result.paymentsCount} pagamentos`}
                        </p>
                      </div>
                    </div>
                    <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                      {result.type.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>

              {successCount > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Próximo passo:</strong> Acesse a página de{" "}
                    <a href="/bank-reconciliation" className="underline">
                      Conciliação Bancária
                    </a>{" "}
                    para revisar e aprovar as conciliações automáticas.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default BankFolderImport;
