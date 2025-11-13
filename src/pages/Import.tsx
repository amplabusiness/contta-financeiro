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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Import = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentItem, setCurrentItem] = useState("");
  const [results, setResults] = useState<{ 
    success: number; 
    errors: Array<{ line: number; client: string; reason: string }>;
    skipped: Array<{ line: number; client: string; reason: string }>;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const processExcelFile = async () => {
    if (!file) {
      toast.error("Selecione um arquivo Excel");
      return;
    }

    setLoading(true);
    setResults(null);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      const errors: Array<{ line: number; client: string; reason: string }> = [];
      const skipped: Array<{ line: number; client: string; reason: string }> = [];
      const validRows = jsonData.filter((row: any) => 
        row["Razão social"] && 
        !row["Razão social"].includes("Relação de Empresas") &&
        row["Razão social"].trim() !== ""
      );

      for (let i = 0; i < validRows.length; i++) {
        const row: any = validRows[i];
        const lineNumber = i + 2; // +2 porque linha 1 é cabeçalho
        const clientName = row["Razão social"] || "Sem nome";
        
        setCurrentItem(`Processando: ${clientName}`);
        setProgress(Math.round(((i + 1) / validRows.length) * 100));

        try {
          const clientData = {
            name: row["Razão social"]?.toString().trim() || "",
            cnpj: row["CNPJ"]?.toString().trim() || "",
            phone: row["Fone"]?.toString().trim() || "",
            email: row["Email"]?.toString().trim() || "",
            notes: row["Regime"]?.toString().trim() || "",
            monthly_fee: parseFloat(row["Honorário"]) || 0,
            payment_day: parseInt(row["Dia Pagamento"]) || null,
            status: "active",
            created_by: user.id,
          };

          // Validações
          if (!clientData.name) {
            skipped.push({
              line: lineNumber,
              client: "Sem nome",
              reason: "Nome do cliente não informado"
            });
            continue;
          }

          // Verificar se já existe pelo CNPJ
          if (clientData.cnpj) {
            const { data: existing, error: checkError } = await supabase
              .from("clients")
              .select("id")
              .eq("cnpj", clientData.cnpj)
              .maybeSingle();

            if (checkError) {
              console.error("Erro ao verificar CNPJ:", checkError);
            }

            if (existing) {
              skipped.push({
                line: lineNumber,
                client: clientData.name,
                reason: `Cliente já existe com CNPJ ${clientData.cnpj}`
              });
              continue;
            }
          }

          const { error } = await supabase.from("clients").insert(clientData);

          if (error) {
            errors.push({
              line: lineNumber,
              client: clientData.name,
              reason: error.message
            });
          } else {
            successCount++;
          }
        } catch (err: any) {
          errors.push({
            line: lineNumber,
            client: clientName,
            reason: err.message || "Erro desconhecido"
          });
        }
      }

      setResults({ success: successCount, errors, skipped });
      setCurrentItem("");
      
      if (successCount > 0) {
        toast.success(`${successCount} clientes importados com sucesso!`);
      }
      if (errors.length > 0) {
        toast.error(`${errors.length} clientes com erro`);
      }
      if (skipped.length > 0) {
        toast.warning(`${skipped.length} clientes ignorados`);
      }
    } catch (error: any) {
      toast.error("Erro ao processar arquivo: " + error.message);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Clientes</h1>
          <p className="text-muted-foreground">Importe clientes do Excel para o sistema</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload de Arquivo Excel</CardTitle>
            <CardDescription>
              Selecione um arquivo Excel (.xlsx, .xls) com as colunas: Razão social, CNPJ, Fone, Regime
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo Excel</Label>
              <div className="flex gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                <Button onClick={processExcelFile} disabled={loading || !file}>
                  {loading ? (
                    <>Processando...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Importar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="w-4 h-4" />
                Arquivo selecionado: {file.name}
              </div>
            )}

            {results && (
              <div className="space-y-3 mt-6">
                <div className="flex items-center gap-2 p-3 bg-success/10 text-success rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">{results.success} clientes importados com sucesso!</span>
                </div>

                {results.skipped.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-warning/10 text-warning rounded-lg">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">{results.skipped.length} clientes ignorados:</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 text-sm">
                      {results.skipped.map((skip, index) => (
                        <div key={index} className="p-3 bg-muted rounded">
                          <div className="font-medium text-foreground">
                            Linha {skip.line}: {skip.client}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Motivo: {skip.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {results.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">{results.errors.length} erros encontrados:</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 text-sm">
                      {results.errors.map((error, index) => (
                        <div key={index} className="p-3 bg-destructive/5 rounded border border-destructive/20">
                          <div className="font-medium text-foreground">
                            Linha {error.line}: {error.client}
                          </div>
                          <div className="text-xs text-destructive mt-1">
                            Erro: {error.reason}
                          </div>
                        </div>
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
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. O arquivo Excel deve ter as seguintes colunas:</p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><strong>Razão social</strong> - Nome do cliente (obrigatório)</li>
              <li><strong>CNPJ</strong> - CNPJ do cliente</li>
              <li><strong>Email</strong> - Email do cliente</li>
              <li><strong>Fone</strong> - Telefone de contato</li>
              <li><strong>Honorário</strong> - Valor do honorário mensal</li>
              <li><strong>Dia Pagamento</strong> - Dia do mês para pagamento</li>
              <li><strong>Regime</strong> - Regime tributário (será salvo nas observações)</li>
            </ul>
            <p className="mt-4">2. Clientes com CNPJ duplicado não serão importados.</p>
            <p>3. A planilha deve ter um cabeçalho na primeira linha.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Import;
