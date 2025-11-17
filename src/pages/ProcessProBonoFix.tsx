import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { format, parse } from "date-fns";

interface ClientUpdate {
  name: string;
  oldStatus: string;
  newMonthlyFee: number;
  paymentDay: number;
  invoicesCreated: number;
}

interface ProcessResult {
  updated: ClientUpdate[];
  notFound: string[];
  errors: string[];
}

const ProcessProBonoFix = () => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const processExcelFile = async () => {
    try {
      setProcessing(true);
      setResult(null);

      // Ler o arquivo Excel
      const filePath = "C:\\Users\\Samsung\\OneDrive\\Documentos\\financeiro_ampla\\data-bling-sheets-3122699b\\docs\\relatorio 01-2025 a 11-2025.xls";

      toast.info("Processando planilha...");

      // Buscar clientes Pro-Bono atuais
      const { data: proBonoClients, error: proBonoError } = await supabase
        .from("clients")
        .select("*")
        .or("is_pro_bono.eq.true,monthly_fee.eq.0");

      if (proBonoError) throw proBonoError;

      console.log("Clientes Pro-Bono encontrados:", proBonoClients?.length);

      // Simular leitura de Excel (você precisará fazer upload do arquivo)
      // Por enquanto, vou mostrar a estrutura esperada

      const updated: ClientUpdate[] = [];
      const notFound: string[] = [];
      const errors: string[] = [];

      toast.success("Processamento iniciado!");

      setResult({ updated, notFound, errors });

    } catch (error: any) {
      console.error("Erro ao processar:", error);
      toast.error("Erro ao processar planilha");
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      setResult(null);
      toast.info("Lendo planilha...");

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });

      console.log("Dados da planilha:", jsonData);

      // Buscar clientes Pro-Bono
      const { data: proBonoClients, error: proBonoError } = await supabase
        .from("clients")
        .select("*")
        .or("is_pro_bono.eq.true,monthly_fee.eq.0");

      if (proBonoError) throw proBonoError;

      const updated: ClientUpdate[] = [];
      const notFound: string[] = [];
      const errors: string[] = [];

      // Agrupar dados por cliente
      const clientData = new Map<string, any[]>();

      jsonData.forEach((row: any) => {
        const clientName = row["Pagador"]?.toString().trim().toUpperCase();
        if (!clientName) return;

        if (!clientData.has(clientName)) {
          clientData.set(clientName, []);
        }
        clientData.get(clientName)?.push(row);
      });

      console.log("Clientes na planilha:", Array.from(clientData.keys()));

      // Processar cada cliente da planilha
      for (const [clientName, rows] of clientData.entries()) {
        // Verificar se cliente está em Pro-Bono
        const proBonoClient = proBonoClients?.find(
          (c) => c.name.toUpperCase().includes(clientName) || clientName.includes(c.name.toUpperCase())
        );

        if (!proBonoClient) {
          console.log(`Cliente ${clientName} não encontrado em Pro-Bono`);
          continue;
        }

        console.log(`Processando cliente Pro-Bono: ${proBonoClient.name}`);

        // Calcular honorário mensal (valor mais frequente dos boletos liquidados)
        const liquidatedValues = rows
          .filter((r) => r["Situação do Boleto"]?.includes("LIQUIDADO"))
          .map((r) => {
            const value = r["Valor (R$)"]?.toString() || "0";
            return parseFloat(value.replace(/\./g, "").replace(",", "."));
          })
          .filter((v) => v > 0);

        if (liquidatedValues.length === 0) {
          notFound.push(`${clientName} - Nenhum boleto liquidado encontrado`);
          continue;
        }

        // Valor mais frequente
        const valueCounts = new Map<number, number>();
        liquidatedValues.forEach((v) => {
          valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
        });
        const monthlyFee = Array.from(valueCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];

        // Calcular dia de pagamento (dia mais frequente de vencimento)
        const dueDays = rows
          .map((r) => {
            const dateStr = r["Data Vencimento"]?.toString();
            if (!dateStr) return null;
            const day = parseInt(dateStr.split("/")[0]);
            return day >= 1 && day <= 31 ? day : null;
          })
          .filter((d) => d !== null);

        if (dueDays.length === 0) {
          notFound.push(`${clientName} - Nenhuma data de vencimento válida`);
          continue;
        }

        const dayCounts = new Map<number, number>();
        dueDays.forEach((d) => {
          if (d) dayCounts.set(d, (dayCounts.get(d) || 0) + 1);
        });
        const paymentDay = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];

        // Atualizar cliente (remover Pro-Bono e adicionar honorários)
        const { error: updateError } = await supabase
          .from("clients")
          .update({
            is_pro_bono: false,
            monthly_fee: monthlyFee,
            payment_day: paymentDay,
            pro_bono_start_date: null,
            pro_bono_end_date: null,
            pro_bono_reason: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", proBonoClient.id);

        if (updateError) {
          errors.push(`${clientName} - Erro ao atualizar: ${updateError.message}`);
          continue;
        }

        // Criar invoices para cada boleto
        let invoicesCreated = 0;
        for (const row of rows) {
          const dateStr = row["Data Vencimento"]?.toString();
          const valueStr = row["Valor (R$)"]?.toString() || "0";
          const status = row["Situação do Boleto"]?.toString() || "";
          const paymentDateStr = row["Data Liquidação"]?.toString();

          if (!dateStr) continue;

          try {
            // Parsear data de vencimento (formato DD/MM/YYYY)
            const [day, month, year] = dateStr.split("/");
            const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

            // Competência (MM/YYYY)
            const competence = `${month.padStart(2, "0")}/${year}`;

            // Valor
            const amount = parseFloat(valueStr.replace(/\./g, "").replace(",", "."));

            // Status do invoice
            let invoiceStatus = "pending";
            if (status.includes("LIQUIDADO")) invoiceStatus = "paid";
            else if (status.includes("VENCIDO")) invoiceStatus = "overdue";
            else if (status.includes("CANCELADO")) invoiceStatus = "cancelled";

            // Data de pagamento
            let paymentDate = null;
            if (paymentDateStr && paymentDateStr !== "") {
              const [pDay, pMonth, pYear] = paymentDateStr.split("/");
              paymentDate = new Date(parseInt(pYear), parseInt(pMonth) - 1, parseInt(pDay));
            }

            // Verificar se já existe invoice para esta competência
            const { data: existingInvoice } = await supabase
              .from("invoices")
              .select("id")
              .eq("client_id", proBonoClient.id)
              .eq("competence", competence)
              .single();

            if (existingInvoice) {
              console.log(`Invoice já existe para ${clientName} - ${competence}`);
              continue;
            }

            // Criar invoice
            const { error: invoiceError } = await supabase.from("invoices").insert({
              client_id: proBonoClient.id,
              competence: competence,
              amount: amount,
              due_date: format(dueDate, "yyyy-MM-dd"),
              status: invoiceStatus,
              payment_date: paymentDate ? format(paymentDate, "yyyy-MM-dd") : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

            if (!invoiceError) {
              invoicesCreated++;
            }
          } catch (err) {
            console.error(`Erro ao criar invoice para ${clientName}:`, err);
          }
        }

        updated.push({
          name: proBonoClient.name,
          oldStatus: "Pro-Bono",
          newMonthlyFee: monthlyFee,
          paymentDay: paymentDay,
          invoicesCreated: invoicesCreated
        });
      }

      setResult({ updated, notFound, errors });

      if (updated.length > 0) {
        toast.success(`${updated.length} cliente(s) atualizado(s) com sucesso!`);
      } else {
        toast.info("Nenhum cliente Pro-Bono encontrado na planilha");
      }

    } catch (error: any) {
      console.error("Erro ao processar arquivo:", error);
      toast.error("Erro ao processar arquivo: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Corrigir Clientes Pro-Bono</h1>
            <p className="text-muted-foreground">
              Processar planilha de honorários e converter clientes Pro-Bono em pagos
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload da Planilha</CardTitle>
            <CardDescription>
              Faça upload da planilha "relatorio 01-2025 a 11-2025.xls" para processar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                disabled={processing}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  disabled:opacity-50"
              />
              {processing && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">O que este processo faz:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Identifica clientes marcados como Pro-Bono que constam na planilha</li>
                <li>Remove a condição Pro-Bono destes clientes</li>
                <li>Calcula e define o honorário mensal baseado nos boletos liquidados</li>
                <li>Define o dia de pagamento baseado nas datas de vencimento</li>
                <li>Cria todos os invoices/boletos que constam na planilha</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            {/* Clientes Atualizados */}
            {result.updated.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Clientes Atualizados ({result.updated.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.updated.map((client, idx) => (
                      <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="font-medium">{client.name}</p>
                        <div className="text-sm text-muted-foreground mt-1 space-y-1">
                          <p>Status anterior: {client.oldStatus}</p>
                          <p>Novo honorário mensal: R$ {client.newMonthlyFee.toFixed(2)}</p>
                          <p>Dia de pagamento: {client.paymentDay}</p>
                          <p className="text-green-600 font-medium">
                            {client.invoicesCreated} invoice(s) criado(s)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Não Encontrados */}
            {result.notFound.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="h-5 w-5" />
                    Avisos ({result.notFound.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.notFound.map((msg, idx) => (
                      <li key={idx} className="text-sm p-2 bg-yellow-50 border border-yellow-200 rounded">
                        {msg}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Erros */}
            {result.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <XCircle className="h-5 w-5" />
                    Erros ({result.errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.errors.map((msg, idx) => (
                      <li key={idx} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                        {msg}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProcessProBonoFix;
