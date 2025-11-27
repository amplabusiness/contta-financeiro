import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import * as XLSX from "xlsx";

interface DefaultData {
  clientName: string;
  competence: string;
  dueDate: string;
  amountOpen: number;
  totalClient: number;
}

interface ImportResult {
  success: number;
  errors: number;
  warnings: string[];
  clientsProcessed: number;
  invoicesCreated: number;
}

export function DefaultReportImporter() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        await handleFileImport(acceptedFiles[0]);
      }
    },
  });

  const parseExcelFile = async (file: File): Promise<DefaultData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          const defaults: DefaultData[] = [];
          
          // Skip header row and process data
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 4) continue;

            const clientName = String(row[0] || "").trim();
            const competence = String(row[1] || "").trim();
            const dueDate = String(row[2] || "").trim();
            const amountOpen = parseAmount(row[3]);
            const totalClient = parseAmount(row[4]);

            if (clientName && competence && dueDate && amountOpen > 0) {
              defaults.push({
                clientName,
                competence,
                dueDate: parseDateString(dueDate),
                amountOpen,
                totalClient: totalClient || amountOpen,
              });
            }
          }

          resolve(defaults);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
      reader.readAsBinaryString(file);
    });
  };

  const parseAmount = (value: any): number => {
    if (typeof value === "number") return value;
    if (!value) return 0;
    
    const str = String(value)
      .replace(/[^\d,.-]/g, "")
      .replace(",", ".");
    return parseFloat(str) || 0;
  };

  const parseDateString = (dateStr: string): string => {
    // Try DD/MM/YYYY format
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  };

  const parseCompetence = (comp: string): string => {
    // Format: MM/YYYY -> YYYY-MM-01
    const parts = comp.split("/");
    if (parts.length === 2) {
      const month = parts[0].padStart(2, "0");
      const year = parts[1];
      return `${year}-${month}-01`;
    }
    return comp;
  };

  const handleFileImport = async (file: File) => {
    try {
      setImporting(true);
      setProgress(0);
      setResult(null);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 500);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Parse Excel file
      const defaults = await parseExcelFile(file);
      console.log("Parsed defaults:", defaults);

      if (defaults.length === 0) {
        toast.error("Nenhum dado válido encontrado no arquivo");
        return;
      }

      // Get all clients to match names
      const { data: existingClients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, cnpj")
        .eq("is_active", true);

      if (clientsError) throw clientsError;

      const clientMap = new Map(
        existingClients?.map((c) => [normalizeClientName(c.name), c.id]) || []
      );

      const warnings: string[] = [];
      let invoicesCreated = 0;
      const clientsProcessed = new Set<string>();

      // Process each default entry
      for (const defaultEntry of defaults) {
        const normalizedName = normalizeClientName(defaultEntry.clientName);
        const clientId = clientMap.get(normalizedName);

        if (!clientId) {
          warnings.push(`Cliente não encontrado: ${defaultEntry.clientName}`);
          continue;
        }

        clientsProcessed.add(clientId);

        // Check if invoice already exists
        const { data: existingInvoice } = await supabase
          .from("invoices")
          .select("id")
          .eq("client_id", clientId)
          .eq("due_date", defaultEntry.dueDate)
          .eq("competence", defaultEntry.competence)
          .single();

        if (existingInvoice) {
          // Update existing invoice to pending status
          await supabase
            .from("invoices")
            .update({
              status: "pending",
              amount: defaultEntry.amountOpen,
            })
            .eq("id", existingInvoice.id);
          
          invoicesCreated++;
        } else {
          // Create new invoice with pending status
          const { error: invoiceError } = await supabase
            .from("invoices")
            .insert({
              client_id: clientId,
              amount: defaultEntry.amountOpen,
              due_date: defaultEntry.dueDate,
              competence: defaultEntry.competence,
              status: "pending",
              description: `Honorários ${defaultEntry.competence}`,
              created_by: user.id,
            });

          if (invoiceError) {
            warnings.push(`Erro ao criar fatura para ${defaultEntry.clientName}: ${invoiceError.message}`);
          } else {
            invoicesCreated++;
          }
        }
      }

      const importResult: ImportResult = {
        success: invoicesCreated,
        errors: warnings.length,
        warnings,
        clientsProcessed: clientsProcessed.size,
        invoicesCreated,
      };

      setResult(importResult);
      clearInterval(progressInterval);
      setProgress(100);
      toast.success(`Importação concluída! ${invoicesCreated} faturas processadas.`);
    } catch (error) {
      console.error("Error importing default report:", error);
      toast.error("Erro ao importar relatório de inadimplência");
      setProgress(0);
    } finally {
      setImporting(false);
    }
  };

  const normalizeClientName = (name: string): string => {
    return name
      .toUpperCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s]/gi, "");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Relatório de Inadimplência
          </CardTitle>
          <CardDescription>
            Importe planilha de clientes com honorários em atraso para atualizar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            {importing ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-full max-w-md space-y-3">
                  <Upload className="h-8 w-8 text-primary mx-auto" />
                  <p className="text-sm font-medium text-center">Processando relatório...</p>
                  <Progress value={progress} className="w-full h-2" />
                  <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}%</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {isDragActive
                      ? "Solte o arquivo aqui..."
                      : "Arraste um arquivo Excel ou clique para selecionar"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Formatos aceitos: .xls, .xlsx
                  </p>
                </div>
              </div>
            )}
          </div>

          <Alert>
            <AlertDescription>
              <strong>Formato esperado:</strong>
              <br />
              Colunas: Nome | Competência | Vencimento | Em aberto | Total cliente
              <br />
              O sistema irá criar ou atualizar as faturas dos clientes encontrados.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Faturas Processadas</p>
                  <p className="text-2xl font-bold">{result.invoicesCreated}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <CheckCircle className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Clientes Processados</p>
                  <p className="text-2xl font-bold">{result.clientsProcessed}</p>
                </div>
              </div>
            </div>

            {result.warnings.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-yellow-500" />
                  <h4 className="font-medium">Avisos ({result.warnings.length})</h4>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {result.warnings.map((warning, index) => (
                    <p key={index} className="text-sm text-muted-foreground">
                      • {warning}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
