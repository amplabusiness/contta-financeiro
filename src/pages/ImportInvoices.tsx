import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { format, subMonths, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ImportResult {
  success: number;
  errors: number;
  skipped: number;
  details: Array<{
    client: string;
    status: "success" | "error" | "skipped";
    message: string;
    value?: number;
    competence?: string;
  }>;
}

const ImportInvoices = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setResult(null);
      
      // Preview dos primeiros 10 registros
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          
          setPreview(jsonData.slice(0, 10));
        } catch (error) {
          console.error("Erro ao ler arquivo:", error);
          toast.error("Erro ao ler arquivo");
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const parseDate = (dateStr: string): Date | null => {
    try {
      // Tenta formato DD/MM/YYYY
      const [day, month, year] = dateStr.split("/");
      if (day && month && year) {
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo");
      return;
    }

    setLoading(true);
    const importResult: ImportResult = {
      success: 0,
      errors: 0,
      skipped: 0,
      details: [],
    };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Ler arquivo Excel
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

          // Buscar todos os clientes
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name")
            .eq("is_active", true);

          const clientMap = new Map(clients?.map((c) => [c.name.toUpperCase().trim(), c.id]) || []);

          for (const row of jsonData) {
            const pagador = row["Pagador"]?.toString().toUpperCase().trim();
            const dataVencimento = row["Data Vencimento"]?.toString();
            const dataLiquidacao = row["Data Liquidação"]?.toString();
            const valor = row["Valor (R$)"];
            const liquidacao = row["Liquidação (R$)"];
            const situacao = row["Situação do Boleto"]?.toString();

            // Pular se não tem pagador ou data de vencimento
            if (!pagador || !dataVencimento) {
              importResult.skipped++;
              continue;
            }

            // Encontrar cliente
            const clientId = clientMap.get(pagador);
            if (!clientId) {
              importResult.errors++;
              importResult.details.push({
                client: pagador,
                status: "error",
                message: "Cliente não encontrado no sistema",
              });
              continue;
            }

            // Parse de datas
            const dueDate = parseDate(dataVencimento);
            if (!dueDate) {
              importResult.errors++;
              importResult.details.push({
                client: pagador,
                status: "error",
                message: "Data de vencimento inválida",
              });
              continue;
            }

            // Competência = Vencimento - 1 mês
            const competenceDate = subMonths(dueDate, 1);
            const competence = format(competenceDate, "yyyy-MM");

            // Parse de valores (remover formato brasileiro)
            const amount = typeof valor === "string"
              ? parseFloat(valor.replace(".", "").replace(",", "."))
              : parseFloat(valor);

            const liquidationAmount = liquidacao && liquidacao !== "0,00"
              ? typeof liquidacao === "string"
                ? parseFloat(liquidacao.replace(".", "").replace(",", "."))
                : parseFloat(liquidacao)
              : null;

            // Determinar status
            const isLiquidado = situacao?.includes("LIQUIDADO");
            const paymentDate = isLiquidado && dataLiquidacao ? parseDate(dataLiquidacao) : null;

            // Verificar se já existe invoice para esse cliente e competência
            const { data: existingInvoice } = await supabase
              .from("invoices")
              .select("id")
              .eq("client_id", clientId)
              .eq("competence", competence)
              .single();

            if (existingInvoice) {
              importResult.skipped++;
              importResult.details.push({
                client: pagador,
                status: "skipped",
                message: `Fatura já existe para competência ${competence}`,
                competence,
              });
              continue;
            }

            // Criar invoice
            const { data: invoice, error: invError } = await supabase
              .from("invoices")
              .insert({
                client_id: clientId,
                amount: amount,
                due_date: dueDate.toISOString().split("T")[0],
                payment_date: paymentDate ? paymentDate.toISOString().split("T")[0] : null,
                status: isLiquidado ? "paid" : "pending",
                competence: competence,
                description: `Honorários ${competence}`,
                created_by: user.id,
              })
              .select()
              .single();

            if (invError) {
              importResult.errors++;
              importResult.details.push({
                client: pagador,
                status: "error",
                message: invError.message,
                competence,
              });
              continue;
            }

            // Se foi liquidado, registrar no razão do cliente
            if (isLiquidado && invoice && paymentDate) {
              // Lançamento de débito (aumento do saldo devedor)
              await supabase.from("client_ledger").insert({
                client_id: clientId,
                transaction_date: dueDate.toISOString().split("T")[0],
                description: `Honorários ${competence}`,
                debit: amount,
                credit: 0,
                balance: amount,
                reference_type: "invoice",
                reference_id: invoice.id,
                invoice_id: invoice.id,
                created_by: user.id,
              });

              // Lançamento de crédito (pagamento)
              await supabase.from("client_ledger").insert({
                client_id: clientId,
                transaction_date: paymentDate.toISOString().split("T")[0],
                description: `Pagamento - Honorários ${competence}`,
                debit: 0,
                credit: liquidationAmount || amount,
                balance: 0,
                reference_type: "invoice",
                reference_id: invoice.id,
                invoice_id: invoice.id,
                notes: liquidationAmount ? `Valor liquidado: ${formatCurrency(liquidationAmount)}` : null,
                created_by: user.id,
              });
            }

            importResult.success++;
            importResult.details.push({
              client: pagador,
              status: "success",
              message: isLiquidado ? "Fatura criada e baixada com sucesso" : "Fatura criada com sucesso",
              value: amount,
              competence,
            });
          }

          setResult(importResult);
          toast.success(
            `Importação concluída! ${importResult.success} faturas criadas, ${importResult.errors} erros, ${importResult.skipped} ignoradas`
          );
        } catch (error: any) {
          console.error("Erro ao processar:", error);
          toast.error("Erro ao processar arquivo: " + error.message);
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao importar: " + error.message);
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Honorários</h1>
          <p className="text-muted-foreground">
            Importe faturas de honorários em lote a partir de planilha Excel
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload de Planilha</CardTitle>
            <CardDescription>
              Formato esperado: Pagador, Data Vencimento, Data Liquidação, Valor (R$), Liquidação (R$), Situação do Boleto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo Excel (.xls, .xlsx)</Label>
              <Input
                id="file"
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>

            {file && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Button onClick={handleImport} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Importar Honorários
                    </>
                  )}
                </Button>
              </div>
            )}

            <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Como funciona a importação:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>A competência é calculada automaticamente (Data Vencimento - 1 mês)</li>
                  <li>Faturas com situação "LIQUIDADO" são baixadas automaticamente</li>
                  <li>Lançamentos são registrados no razão do cliente</li>
                  <li>Faturas duplicadas são ignoradas</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {preview.length > 0 && !result && (
          <Card>
            <CardHeader>
              <CardTitle>Preview dos Dados</CardTitle>
              <CardDescription>Primeiros 10 registros da planilha</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pagador</TableHead>
                      <TableHead>Data Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{row["Pagador"]}</TableCell>
                        <TableCell>{row["Data Vencimento"]}</TableCell>
                        <TableCell>{row["Valor (R$)"]}</TableCell>
                        <TableCell>{row["Situação do Boleto"]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Resultado da Importação</CardTitle>
              <CardDescription>
                {result.success} sucesso, {result.errors} erros, {result.skipped} ignoradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="font-medium">Sucesso</span>
                  </div>
                  <div className="text-2xl font-bold">{result.success}</div>
                </div>
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium">Erros</span>
                  </div>
                  <div className="text-2xl font-bold">{result.errors}</div>
                </div>
                <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    <span className="font-medium">Ignoradas</span>
                  </div>
                  <div className="text-2xl font-bold">{result.skipped}</div>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {result.details.map((detail, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      detail.status === "success"
                        ? "bg-success/5 border-success/20"
                        : detail.status === "error"
                        ? "bg-destructive/5 border-destructive/20"
                        : "bg-warning/5 border-warning/20"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        {detail.status === "success" && (
                          <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                        )}
                        {detail.status === "error" && (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                        )}
                        {detail.status === "skipped" && (
                          <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium">{detail.client}</p>
                          <p className="text-sm text-muted-foreground">{detail.message}</p>
                          {detail.competence && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Competência: {detail.competence}
                            </p>
                          )}
                        </div>
                      </div>
                      {detail.value && (
                        <Badge variant="outline">{formatCurrency(detail.value)}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ImportInvoices;
