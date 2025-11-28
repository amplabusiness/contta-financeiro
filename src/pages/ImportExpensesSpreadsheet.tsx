import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import * as XLSX from "xlsx";

interface ExpenseRow {
  description: string;
  amount: number;
  category: string;
  costCenter?: string;
}

export default function ImportExpensesSpreadsheet() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const processSpreadsheet = async () => {
    if (!file) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo primeiro",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setProgress(0);
    setResults(null);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const expenses: ExpenseRow[] = [];
      let currentCategory = "";
      let currentCostCenter = "";

      // Parse the spreadsheet structure
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const firstCol = String(row[0] || "").trim();
        const lastCol = row[row.length - 1];

        // Detect category headers
        if (firstCol.includes("CONTAS FIXAS")) {
          currentCategory = "Contas Fixas";
          currentCostCenter = "Ampla Contabilidade";
        } else if (firstCol.includes("IMPOSTOS")) {
          currentCategory = "Impostos";
          currentCostCenter = "Ampla Contabilidade";
        } else if (firstCol.includes("CONTAS VARIÁVEIS")) {
          currentCategory = "Contas Variáveis";
          currentCostCenter = "Ampla Contabilidade";
        } else if (firstCol.includes("SERVIÇO TERCEIROS")) {
          currentCategory = "Serviço Terceiros";
          currentCostCenter = "Ampla Contabilidade";
        } else if (firstCol.includes("FOLHA PAGAMENTO")) {
          currentCategory = "Folha Pagamento";
          currentCostCenter = "Ampla Contabilidade";
        } else if (firstCol.includes("MATERIAL DE CONSUMO")) {
          currentCategory = "Material de Consumo";
          currentCostCenter = "Ampla Contabilidade";
        } else if (firstCol.includes("SERGIO CARNEIRO")) {
          currentCostCenter = "Sergio Carneiro";
          currentCategory = "Pessoal";
        }

        // Parse expense line
        if (
          firstCol &&
          !firstCol.includes("TOTAL") &&
          !firstCol.includes("MOVIMENTO") &&
          !firstCol.includes("GASTOS") &&
          !firstCol.includes("R$") &&
          !firstCol.includes("RESULTADO") &&
          lastCol &&
          typeof lastCol === "number"
        ) {
          const amount = parseFloat(String(lastCol).replace(/[^\d,.-]/g, "").replace(",", "."));
          
          if (amount > 0) {
            expenses.push({
              description: firstCol,
              amount,
              category: currentCategory || "Outros",
              costCenter: currentCostCenter || "Geral",
            });
          }
        }
      }

      console.log("Parsed expenses:", expenses);

      // Insert into database
      let created = 0;
      let skipped = 0;
      const errors: any[] = [];

      for (const expense of expenses) {
        try {
          const { data: insertedData, error } = await supabase.from("accounts_payable").insert({
            supplier_name: expense.description,
            description: expense.description,
            category: expense.category,
            cost_center: expense.costCenter,
            amount: expense.amount,
            due_date: new Date().toISOString().split("T")[0],
            status: "pending",
            is_recurring: true,
            recurrence_frequency: "monthly",
            recurrence_day: 10,
            created_by: userData.user.id,
          }).select().single();

          if (error) {
            if (error.message.includes("duplicate")) {
              skipped++;
            } else {
              throw error;
            }
          } else {
            created++;

            // Criar lançamento contábil via smart-accounting
            if (insertedData) {
              try {
                await supabase.functions.invoke('smart-accounting', {
                  body: {
                    action: 'create_entry',
                    entry: {
                      type: 'expense',
                      operation: 'provision',
                      referenceId: insertedData.id,
                      referenceType: 'accounts_payable',
                      amount: expense.amount,
                      date: new Date().toISOString().split("T")[0],
                      description: `Provisão: ${expense.description}`,
                      category: expense.category
                    }
                  }
                });
              } catch (accError) {
                console.warn("Erro ao criar lançamento contábil:", accError);
              }
            }
          }
        } catch (error) {
          console.error("Error inserting expense:", error);
          errors.push({
            description: expense.description,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      setResults({
        total: expenses.length,
        created,
        skipped,
        errors,
      });

      clearInterval(progressInterval);
      setProgress(100);

      toast({
        title: "Importação Concluída",
        description: `${created} despesas cadastradas com sucesso!`,
      });
    } catch (error) {
      clearInterval(progressInterval);
      setProgress(0);
      console.error("Error processing file:", error);
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
          <h1 className="text-3xl font-bold mb-2">Importar Despesas Recorrentes</h1>
          <p className="text-muted-foreground">
            Faça upload da planilha de gastos para cadastrar despesas recorrentes
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Planilha de Gastos (.xls ou .xlsx)</Label>
              <div className="mt-2 flex items-center gap-4">
                <Input
                  id="file"
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="flex-1"
                />
                <Button onClick={processSpreadsheet} disabled={!file || loading} className="min-w-[120px]">
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar
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
                <Progress value={progress} className="w-full h-2" />
                <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}%</p>
              </div>
            )}
          </div>
        </Card>

        {results && (
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">Resultados da Importação</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>Total:</strong> {results.total} despesas
                </AlertDescription>
              </Alert>

              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900">
                  <strong>Cadastradas:</strong> {results.created} despesas
                </AlertDescription>
              </Alert>

              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-900">
                  <strong>Ignoradas:</strong> {results.skipped} (já existentes)
                </AlertDescription>
              </Alert>
            </div>

            {results.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Erros Durante Importação
                </h3>
                <div className="bg-red-50 border border-red-200 rounded-md p-3 max-h-48 overflow-y-auto">
                  <ul className="text-sm space-y-2">
                    {results.errors.map((err: any, idx: number) => (
                      <li key={idx} className="text-red-900">
                        <strong>{err.description}:</strong> {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        )}

        <Card className="p-6">
          <h3 className="font-semibold mb-3">ℹ️ Formato da Planilha</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• A planilha deve ter 2 colunas: Descrição e Valor</li>
            <li>• Cabeçalhos de categoria serão detectados automaticamente (CONTAS FIXAS, IMPOSTOS, etc.)</li>
            <li>• Valores devem estar formatados como número ou moeda brasileira</li>
            <li>• Linhas vazias e totais serão ignorados</li>
            <li>• Todas as despesas serão cadastradas como recorrentes mensais</li>
          </ul>
        </Card>
      </div>
    </Layout>
  );
}