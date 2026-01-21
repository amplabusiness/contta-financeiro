/**
 * Componente para importar arquivo de cobrança
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { importCobrancaFile, ConciliationResult } from '@/services/cobrancaImportService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/data/expensesData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CobrancaImporterProps {
  onImportComplete?: (results: ConciliationResult[]) => void;
}

export function CobrancaImporter({ onImportComplete }: CobrancaImporterProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ConciliationResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar se é CSV
    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo CSV');
      return;
    }

    try {
      setLoading(true);
      const content = await file.text();

      const importResults = await importCobrancaFile(content);
      setResults(importResults);

      // Resumo
      const totalDocumentos = importResults.length;
      const totalRecebido = importResults.reduce(
        (sum, r) => sum + r.totalRecebido,
        0
      );
      const totalClientes = importResults.reduce(
        (sum, r) => sum + r.clientesCount,
        0
      );
      const totalMatched = importResults.filter(
        (r) => r.bankTransactionMatched
      ).length;
      const totalAccountsCreated = importResults.reduce(
        (sum, r) => sum + (r.accountsCreated || 0),
        0
      );

      let message = `Importado: ${totalDocumentos} cobranças, ${totalClientes} clientes, ${formatCurrency(totalRecebido)}\n${totalMatched}/${totalDocumentos} conciliadas`;
      if (totalAccountsCreated > 0) {
        message += `\n${totalAccountsCreated} contas contábeis criadas automaticamente`;
      }
      toast.success(message, { duration: 5000 });

      onImportComplete?.(importResults);
    } catch (error) {
      console.error('Erro ao importar:', error);
      toast.error(
        `Erro ao importar: ${error instanceof Error ? error.message : 'Desconhecido'}`
      );
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          title="Importar arquivo de cobrança (clientes boletos jan.csv)"
        >
          <Upload className="h-4 w-4" />
          Importar Cobrança
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Arquivo de Cobrança</DialogTitle>
          <DialogDescription>
            Importe o arquivo de cobrança para conciliar automaticamente os
            recebimentos com as invoices
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {results.length === 0 ? (
            <>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  disabled={loading}
                  className="hidden"
                />

                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Selecione o arquivo CSV
                    </>
                  )}
                </Button>

                <p className="text-sm text-muted-foreground mt-4">
                  Procure em: <code>banco/clientes boletos jan.csv</code>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cobranças</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{results.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Conciliadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {results.filter((r) => r.bankTransactionMatched).length}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Contas Criadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {results.reduce((sum, r) => sum + (r.accountsCreated || 0), 0)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Recebido</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        results.reduce((sum, r) => sum + r.totalRecebido, 0)
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Detalhes por Cobrança</h4>

                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  <div className="space-y-4">
                    {results.map((result, idx) => (
                      <div
                        key={idx}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-mono font-semibold">
                            {result.documento}
                          </div>
                          <Badge
                            variant={
                              result.bankTransactionMatched
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {result.bankTransactionMatched ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Conciliada
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Não encontrada
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="font-semibold">Data Extrato:</span>{' '}
                            {format(result.dataExtrato, 'dd/MM/yyyy', {
                              locale: ptBR,
                            })}
                          </div>
                          <div>
                            <span className="font-semibold">Total:</span>{' '}
                            {formatCurrency(result.totalRecebido)}
                          </div>
                          <div>
                            <span className="font-semibold">Clientes:</span>{' '}
                            {result.clientesLinked}/{result.clientesCount}
                          </div>
                          <div>
                            <span className="font-semibold">Invoices:</span>{' '}
                            {result.invoicesCreated} criadas
                          </div>
                        </div>

                        <div className="space-y-1">
                          {result.clientes.map((cliente, cIdx) => (
                            <div
                              key={cIdx}
                              className="text-xs flex justify-between items-center p-2 bg-slate-50 rounded"
                            >
                              <div className="flex-1 flex flex-col">
                                <span>{cliente.nome.substring(0, 40)}</span>
                                {cliente.accountCode && (
                                  <span className="font-mono text-[10px] text-slate-500">
                                    {cliente.accountCode}
                                    {cliente.accountCreated && (
                                      <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 text-green-600 border-green-300">
                                        nova
                                      </Badge>
                                    )}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-semibold min-w-fit ml-2">
                                {formatCurrency(cliente.valor)}
                              </span>
                              {cliente.invoiceId ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500 ml-2" />
                              ) : (
                                <AlertTriangle className="h-3 w-3 text-yellow-500 ml-2" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setResults([]);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  Importar Outro Arquivo
                </Button>

                <Button
                  onClick={() => setOpen(false)}
                  className="ml-auto"
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
