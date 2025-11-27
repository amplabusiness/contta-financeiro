import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, AlertCircle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ImportResult {
  success: number;
  duplicates: number;
  errors: number;
  details: Array<{
    row: number;
    name: string;
    cnpj: string;
    status: "success" | "duplicate" | "error";
    message?: string;
  }>;
}

const ImportCompanies = () => {
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const downloadTemplate = () => {
    const template = [
      {
        Nome: "Empresa Exemplo Ltda",
        CNPJ: "12.345.678/0001-99",
        Email: "contato@exemplo.com",
        Telefone: "(11) 98765-4321",
        "Dia Pagamento": 10,
        "Mensalidade (R$)": 1500.00,
        Observações: "Cliente desde 2024",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Empresas");

    // Ajustar largura das colunas
    ws["!cols"] = [
      { wch: 30 }, // Nome
      { wch: 20 }, // CNPJ
      { wch: 30 }, // Email
      { wch: 18 }, // Telefone
      { wch: 15 }, // Dia Pagamento
      { wch: 18 }, // Mensalidade
      { wch: 40 }, // Observações
    ];

    XLSX.writeFile(wb, "template_importacao_empresas.xlsx");
    toast.success("Template baixado com sucesso!");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setImportResult(null);
      setPreviewData([]);

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error("A planilha está vazia!");
        return;
      }

      // Mostrar preview dos primeiros 5 registros
      setPreviewData(jsonData.slice(0, 5));

      // Processar importação
      await processImport(jsonData);
    } catch (error: any) {
      toast.error("Erro ao ler arquivo: " + error.message);
      console.error(error);
    } finally {
      setLoading(false);
      // Limpar input
      e.target.value = "";
    }
  };

  const processImport = async (data: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Usuário não autenticado");
      return;
    }

    const result: ImportResult = {
      success: 0,
      duplicates: 0,
      errors: 0,
      details: [],
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 porque Excel começa em 1 e tem cabeçalho

      try {
        // Extrair dados da linha
        const name = row["Nome"] || row["nome"] || row["NOME"];
        const cnpj = row["CNPJ"] || row["cnpj"];
        const email = row["Email"] || row["email"] || row["EMAIL"];
        const phone = row["Telefone"] || row["telefone"] || row["TELEFONE"];
        const paymentDay = row["Dia Pagamento"] || row["dia_pagamento"] || row["payment_day"];
        const monthlyFee = row["Mensalidade (R$)"] || row["mensalidade"] || row["monthly_fee"] || 0;
        const notes = row["Observações"] || row["observacoes"] || row["notes"] || "";

        if (!name) {
          result.errors++;
          result.details.push({
            row: rowNumber,
            name: "Sem nome",
            cnpj: cnpj || "Sem CNPJ",
            status: "error",
            message: "Nome é obrigatório",
          });
          continue;
        }

        // Limpar CNPJ (remover pontuação)
        const cleanCnpj = cnpj ? String(cnpj).replace(/[^\d]/g, "") : null;

        // Verificar se já existe
        if (cleanCnpj) {
          const { data: existing } = await supabase
            .from("clients")
            .select("id, name")
            .eq("cnpj", cleanCnpj)
            .maybeSingle();

          if (existing) {
            result.duplicates++;
            result.details.push({
              row: rowNumber,
              name,
              cnpj: cnpj || "",
              status: "duplicate",
              message: `Empresa já cadastrada: ${existing.name}`,
            });
            continue;
          }
        }

        // Inserir empresa
        const { error: insertError } = await supabase.from("clients").insert({
          name,
          cnpj: cleanCnpj,
          email: email || null,
          phone: phone || null,
          payment_day: paymentDay ? Number(paymentDay) : null,
          monthly_fee: monthlyFee ? Number(monthlyFee) : 0,
          notes: notes || null,
          is_active: true,
          created_by: user.id,
        });

        if (insertError) {
          result.errors++;
          result.details.push({
            row: rowNumber,
            name,
            cnpj: cnpj || "",
            status: "error",
            message: insertError.message,
          });
        } else {
          result.success++;
          result.details.push({
            row: rowNumber,
            name,
            cnpj: cnpj || "",
            status: "success",
          });
        }
      } catch (error: any) {
        result.errors++;
        result.details.push({
          row: rowNumber,
          name: "Erro ao processar",
          cnpj: "",
          status: "error",
          message: error.message,
        });
      }
    }

    setImportResult(result);

    // Mostrar toast com resumo
    if (result.success > 0) {
      toast.success(
        `${result.success} empresa(s) importada(s) com sucesso! ${
          result.duplicates > 0 ? `${result.duplicates} duplicata(s) ignorada(s).` : ""
        } ${result.errors > 0 ? `${result.errors} erro(s).` : ""}`
      );
    } else if (result.duplicates > 0) {
      toast.warning(`Todas as empresas já estavam cadastradas (${result.duplicates} duplicatas)`);
    } else {
      toast.error("Nenhuma empresa foi importada. Verifique os erros.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Importado</Badge>;
      case "duplicate":
        return <Badge variant="secondary">Duplicado</Badge>;
      case "error":
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Empresas</h1>
          <p className="text-muted-foreground">
            Importe múltiplas empresas de uma planilha Excel. Duplicatas são automaticamente identificadas.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Baixar Template
              </CardTitle>
              <CardDescription>
                Baixe o template Excel com os campos corretos para importação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Baixar Template
              </Button>
              <div className="mt-4 text-sm text-muted-foreground space-y-2">
                <p className="font-semibold">Campos do template:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Nome (obrigatório)</li>
                  <li>CNPJ (usado para evitar duplicatas)</li>
                  <li>Email</li>
                  <li>Telefone</li>
                  <li>Dia Pagamento</li>
                  <li>Mensalidade (R$)</li>
                  <li>Observações</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Importar Planilha
              </CardTitle>
              <CardDescription>Selecione um arquivo Excel (.xlsx) para importar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Arquivo Excel</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </div>
                {loading && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Processando...</AlertTitle>
                    <AlertDescription>
                      Importando empresas. Por favor, aguarde.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {previewData.length > 0 && !importResult && (
          <Card>
            <CardHeader>
              <CardTitle>Preview dos Dados</CardTitle>
              <CardDescription>Primeiros 5 registros da planilha</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell>{row["Nome"] || row["nome"]}</TableCell>
                        <TableCell>{row["CNPJ"] || row["cnpj"]}</TableCell>
                        <TableCell>{row["Email"] || row["email"]}</TableCell>
                        <TableCell>{row["Telefone"] || row["telefone"]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {importResult && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    Importadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{importResult.success}</div>
                  <p className="text-sm text-muted-foreground">Empresas cadastradas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="w-5 h-5" />
                    Duplicadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{importResult.duplicates}</div>
                  <p className="text-sm text-muted-foreground">Já cadastradas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    Erros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{importResult.errors}</div>
                  <p className="text-sm text-muted-foreground">Não processadas</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Importação</CardTitle>
                <CardDescription>
                  Resultado detalhado de cada linha processada
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Linha</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Mensagem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.details.map((detail, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{detail.row}</TableCell>
                          <TableCell className="font-medium">{detail.name}</TableCell>
                          <TableCell>{detail.cnpj}</TableCell>
                          <TableCell>{getStatusBadge(detail.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {detail.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Importante</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Empresas com CNPJ duplicado não serão importadas</li>
              <li>O campo Nome é obrigatório</li>
              <li>Todas as empresas são cadastradas como ativas</li>
              <li>Você pode usar o template como base para sua planilha</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
};

export default ImportCompanies;
