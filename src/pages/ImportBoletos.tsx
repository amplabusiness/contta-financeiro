import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ImportResult {
  success: number;
  errors: string[];
  warnings: string[];
}

const ImportBoletos = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.trim() === "") return null;
    
    // Formato: DD/MM/YYYY
    const parts = dateStr.trim().split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return null;
  };

  const parseAmount = (amountStr: string): number => {
    if (!amountStr) return 0;
    // Remover "R$" se existir e converter vírgula para ponto
    return parseFloat(amountStr.toString().replace("R$", "").replace(/\./g, "").replace(",", "."));
  };

  const calculateCompetence = (dueDate: string): string => {
    // Boleto que vence em 10/10/2025 tem competência 09/2025
    const date = new Date(dueDate);
    date.setMonth(date.getMonth() - 1);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const mapStatus = (situacao: string): string => {
    const situacaoUpper = situacao.toUpperCase();
    if (situacaoUpper.includes("LIQUIDADO")) return "paid";
    if (situacaoUpper.includes("BAIXADO")) return "cancelled";
    if (situacaoUpper.includes("VENCIDO")) return "overdue";
    return "pending";
  };

  const processExcelFile = async () => {
    if (!file) {
      toast.error("Selecione um arquivo Excel");
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Carregar todos os clientes ativos para fazer o match
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name")
        .eq("status", "active");

      if (clientsError) throw clientsError;

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        
        // Verificar se tem os campos necessários
        if (!row["Pagador"] || !row["Data Vencimento"] || !row["Valor (R$)"]) {
          continue;
        }

        try {
          const pagadorName = row["Pagador"].toString().trim().toUpperCase();
          
          // Encontrar o cliente pelo nome (case insensitive)
          const client = clients?.find(c => 
            c.name.toUpperCase().includes(pagadorName) || 
            pagadorName.includes(c.name.toUpperCase())
          );

          if (!client) {
            warnings.push(`Cliente não encontrado: ${row["Pagador"]}`);
            continue;
          }

          const dueDate = parseDate(row["Data Vencimento"]);
          if (!dueDate) {
            errors.push(`Data de vencimento inválida na linha ${i + 2}`);
            continue;
          }

          const amount = parseAmount(row["Valor (R$)"]);
          const liquidationAmount = parseAmount(row["Liquidação (R$)"] || "0");
          const paymentDate = parseDate(row["Data Liquidação"] || "");
          const competence = calculateCompetence(dueDate);
          const status = mapStatus(row["Situação do Boleto"] || "");

          // Verificar se já existe um boleto com mesmo cliente, vencimento e valor
          const { data: existing } = await supabase
            .from("invoices")
            .select("id")
            .eq("client_id", client.id)
            .eq("due_date", dueDate)
            .eq("amount", amount)
            .single();

          if (existing) {
            warnings.push(`Boleto já existe para ${row["Pagador"]} com vencimento ${row["Data Vencimento"]}`);
            continue;
          }

          const invoiceData = {
            client_id: client.id,
            amount: amount,
            due_date: dueDate,
            payment_date: paymentDate,
            status: status,
            competence: competence,
            description: `Honorários ${competence} - Boleto ${row["Nº Doc"]} (${row["Nosso Nº"]})`,
            created_by: user.id,
            calculated_amount: liquidationAmount > 0 ? liquidationAmount : null,
          };

          const { data: insertedInvoice, error: insertError } = await supabase
            .from("invoices")
            .insert(invoiceData)
            .select()
            .single();

          if (insertError) throw insertError;

          // Criar log de auditoria para boletos baixados manualmente
          if (status === "cancelled" && row["Situação do Boleto"].toUpperCase().includes("BAIXADO")) {
            const auditData = {
              audit_type: "boleto_baixado",
              severity: "warning",
              entity_type: "invoice",
              entity_id: insertedInvoice.id,
              title: `Boleto Baixado Manualmente - ${row["Pagador"]}`,
              description: `Boleto ${row["Nº Doc"]} (${row["Nosso Nº"]}) foi baixado manualmente. Status: ${row["Situação do Boleto"]}. Vencimento: ${row["Data Vencimento"]}. Valor: R$ ${amount.toFixed(2)}. AÇÃO NECESSÁRIA: Verificar motivo do cancelamento e confirmar se não houve pagamento por outro meio (PIX, transferência).`,
              metadata: {
                boleto_numero: row["Nº Doc"],
                nosso_numero: row["Nosso Nº"],
                cliente: row["Pagador"],
                valor: amount,
                vencimento: row["Data Vencimento"],
                situacao_original: row["Situação do Boleto"],
                competencia: competence,
              },
              created_by: user.id,
            };

            await supabase.from("audit_logs").insert(auditData);
          }

          // Se o boleto foi pago, criar entrada no client_ledger
          if (status === "paid" && paymentDate) {
            const ledgerData = {
              client_id: client.id,
              transaction_date: paymentDate,
              description: `Pagamento honorários ${competence}`,
              debit: 0,
              credit: liquidationAmount > 0 ? liquidationAmount : amount,
              balance: 0, // Será calculado por trigger
              reference_type: "invoice",
              notes: `Boleto ${row["Nº Doc"]} - ${row["Situação do Boleto"]}`,
              created_by: user.id,
            };

            await supabase.from("client_ledger").insert(ledgerData);
          }

          successCount++;
        } catch (err: any) {
          errors.push(`Erro na linha ${i + 2}: ${err.message}`);
        }
      }

      setResults({ success: successCount, errors, warnings });
      
      if (successCount > 0) {
        toast.success(`${successCount} boletos importados com sucesso!`);
      }
      if (warnings.length > 0) {
        toast.warning(`${warnings.length} avisos durante importação`);
      }
      if (errors.length > 0) {
        toast.error(`${errors.length} erros durante importação`);
      }
    } catch (error: any) {
      toast.error("Erro ao processar arquivo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Boletos Bancários</h1>
          <p className="text-muted-foreground">
            Importe boletos do Sicredi com cálculo automático de competência
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload de Arquivo Excel</CardTitle>
            <CardDescription>
              Selecione o relatório de boletos do Sicredi (.xls, .xlsx)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo Excel</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={loading}
              />
              {file && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  {file.name}
                </p>
              )}
            </div>

            <Button
              onClick={processExcelFile}
              disabled={!file || loading}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Importando..." : "Importar Boletos"}
            </Button>

            {results && (
              <div className="space-y-4 mt-6">
                {results.success > 0 && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">
                      {results.success} boletos importados com sucesso
                    </span>
                  </div>
                )}

                {results.warnings.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Avisos ({results.warnings.length})</span>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-md space-y-1 max-h-48 overflow-y-auto">
                      {results.warnings.map((warning, idx) => (
                        <p key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                          • {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {results.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Erros ({results.errors.length})</span>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md space-y-1 max-h-48 overflow-y-auto">
                      {results.errors.map((error, idx) => (
                        <p key={idx} className="text-sm text-red-800 dark:text-red-200">
                          • {error}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instruções</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Formato do Arquivo</h3>
              <p className="text-sm text-muted-foreground">
                O arquivo Excel deve conter as seguintes colunas:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li><strong>Cart:</strong> Tipo da carteira (ex: SIMPLES)</li>
                <li><strong>Nº Doc:</strong> Número do boleto no sistema CNAB 400</li>
                <li><strong>Nosso Nº:</strong> Número gerado pelo banco</li>
                <li><strong>Pagador:</strong> Nome do cliente (deve estar cadastrado)</li>
                <li><strong>Data Vencimento:</strong> Data de vencimento do boleto</li>
                <li><strong>Data Liquidação:</strong> Data do pagamento (se pago)</li>
                <li><strong>Valor (R$):</strong> Valor original do boleto</li>
                <li><strong>Liquidação (R$):</strong> Valor efetivamente pago</li>
                <li><strong>Situação do Boleto:</strong> Status (LIQUIDADO, BAIXADO, VENCIDO)</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Regras de Importação</h3>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li>A competência é calculada automaticamente (vencimento - 1 mês)</li>
                <li>Boleto vencendo em 10/10/2025 tem competência 09/2025</li>
                <li>O cliente deve estar cadastrado no sistema</li>
                <li>Boletos duplicados (mesmo cliente, vencimento e valor) são ignorados</li>
                <li>Boletos liquidados geram entrada no razão do cliente</li>
                <li>Boletos baixados são marcados como cancelados</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Status dos Boletos</h3>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
                <li><strong>LIQUIDADO:</strong> Boleto pago pelo cliente</li>
                <li><strong>BAIXADO POR SOLICITAÇÃO:</strong> Cancelado manualmente (fazer auditoria)</li>
                <li><strong>VENCIDO:</strong> Boleto não pago na data (monitorar)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ImportBoletos;
