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

const Import = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

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

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        
        // Pular linha de cabeçalho ou linhas vazias
        if (!row["Razão social"] || row["Razão social"].includes("Relação de Empresas")) {
          continue;
        }

        try {
          const clientData = {
            name: row["Razão social"] || "",
            cnpj: row["CNPJ"] || "",
            phone: row["Fone"] || "",
            notes: row["Regime"] || "",
            monthly_fee: 0, // Será definido manualmente depois
            status: "active",
            created_by: user.id,
          };

          // Verificar se já existe pelo CNPJ
          if (clientData.cnpj) {
            const { data: existing } = await supabase
              .from("clients")
              .select("id")
              .eq("cnpj", clientData.cnpj)
              .single();

            if (existing) {
              errors.push(`Cliente ${clientData.name} já existe (CNPJ: ${clientData.cnpj})`);
              continue;
            }
          }

          const { error } = await supabase.from("clients").insert(clientData);

          if (error) throw error;
          successCount++;
        } catch (err: any) {
          errors.push(`Erro na linha ${i + 1}: ${err.message}`);
        }
      }

      setResults({ success: successCount, errors });
      
      if (successCount > 0) {
        toast.success(`${successCount} clientes importados com sucesso!`);
      }
      if (errors.length > 0) {
        toast.warning(`${errors.length} clientes não foram importados`);
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

                {results.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-3 bg-warning/10 text-warning rounded-lg">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">{results.errors.length} erros encontrados:</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                      {results.errors.map((error, index) => (
                        <div key={index} className="p-2 bg-muted rounded text-muted-foreground">
                          {error}
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
              <li><strong>Fone</strong> - Telefone de contato</li>
              <li><strong>Regime</strong> - Regime tributário (será salvo nas observações)</li>
            </ul>
            <p className="mt-4">2. Após importar, acesse a página de <strong>Clientes</strong> para definir o valor do honorário mensal de cada cliente.</p>
            <p>3. Clientes com CNPJ duplicado não serão importados.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Import;
