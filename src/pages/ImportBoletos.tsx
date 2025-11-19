import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, UserPlus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ImportResult {
  success: number;
  errors: string[];
  warnings: string[];
  clientsCreated: number;
}

interface MissingClient {
  name: string;
  boletos: any[];
}

const ImportBoletos = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [missingClients, setMissingClients] = useState<MissingClient[]>([]);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [currentClientIndex, setCurrentClientIndex] = useState(0);
  const [clientFormData, setClientFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    monthly_fee: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
      setMissingClients([]);
      setProgress(0);
    }
  };

  const parseDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr.trim() === "") return null;
    
    const parts = dateStr.trim().split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return null;
  };

  const parseAmount = (amountStr: string): number => {
    if (!amountStr) return 0;
    return parseFloat(amountStr.toString().replace("R$", "").replace(/\./g, "").replace(",", "."));
  };

  const calculateCompetence = (dueDate: string): string => {
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

  const normalizeClientName = (name: string): string => {
    // Remove sufixos comuns
    return name
      .toUpperCase()
      .replace(/\s+(ME|LTDA|EIRELI|EPP|S\/A|SA|CIA|COMERCIO|SERVICOS)\b/g, "")
      .replace(/[.-]/g, "")
      .trim();
  };

  const normalizeCNPJ = (cnpj: string): string => {
    if (!cnpj) return "";
    // Remove caracteres não numéricos
    return cnpj.replace(/\D/g, "");
  };

  const findClientMatch = (
    pagadorName: string, 
    cnpjFromBoleto: string | undefined,
    clients: any[]
  ): any => {
    // 1. Tentar match por CNPJ (prioritário)
    if (cnpjFromBoleto) {
      const normalizedCNPJ = normalizeCNPJ(cnpjFromBoleto);
      if (normalizedCNPJ.length >= 11) { // CPF tem 11, CNPJ tem 14
        const matchByCNPJ = clients.find(c => 
          c.cnpj && normalizeCNPJ(c.cnpj) === normalizedCNPJ
        );
        if (matchByCNPJ) return matchByCNPJ;
      }
    }

    // 2. Match por nome normalizado
    const normalizedPagador = normalizeClientName(pagadorName);
    
    // Tentar match exato
    const exactMatch = clients.find(c => 
      normalizeClientName(c.name) === normalizedPagador
    );
    if (exactMatch) return exactMatch;

    // Tentar match parcial (contém)
    const partialMatch = clients.find(c => {
      const normalizedClientName = normalizeClientName(c.name);
      return normalizedClientName.includes(normalizedPagador) || 
             normalizedPagador.includes(normalizedClientName);
    });

    return partialMatch;
  };

  const processExcelFile = async () => {
    if (!file) {
      toast.error("Selecione um arquivo Excel");
      return;
    }

    setLoading(true);
    setResults(null);
    setMissingClients([]);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, cnpj")
        .eq("status", "active");

      if (clientsError) throw clientsError;

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0;
      const errors: string[] = [];
      const warnings: string[] = [];
      const missing: Map<string, any[]> = new Map();

      for (let i = 0; i < jsonData.length; i++) {
        const row: any = jsonData[i];
        
        if (!row["Pagador"] || !row["Data Vencimento"] || !row["Valor (R$)"]) {
          continue;
        }

        const pagadorName = row["Pagador"].toString().trim();
        const cnpjFromBoleto = row["CNPJ"] || row["Cnpj"] || row["cnpj"];
        
        // Usar função melhorada de matching
        const client = findClientMatch(pagadorName, cnpjFromBoleto, clients || []);

        if (!client) {
          if (!missing.has(pagadorName)) {
            missing.set(pagadorName, []);
          }
          missing.get(pagadorName)?.push(row);
          continue;
        }

        try {
          await processBoleto(row, client.id, user.id);
          successCount++;
        } catch (err: any) {
          errors.push(`Erro na linha ${i + 2}: ${err.message}`);
        }
      }

      if (missing.size > 0) {
        const missingList: MissingClient[] = [];
        missing.forEach((boletos, name) => {
          missingList.push({ name, boletos });
        });
        setMissingClients(missingList);
        setShowClientDialog(true);
        setCurrentClientIndex(0);
        setClientFormData({
          name: missingList[0].name,
          cnpj: "",
          email: "",
          phone: "",
          monthly_fee: "",
        });
      }

      setResults({ 
        success: successCount, 
        errors, 
        warnings,
        clientsCreated: 0,
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      // Mostrar toast com resultados consolidados
      if (successCount > 0) {
        if (errors.length > 0) {
          toast.warning(`${successCount} boletos importados`, {
            description: `${errors.length} erros encontrados durante a importação`
          });
        } else {
          toast.success(`${successCount} boletos importados com sucesso!`);
        }
      } else if (errors.length > 0) {
        toast.error('Nenhum boleto foi importado', {
          description: `${errors.length} erros encontrados`
        });
      }
      
      if (missing.size > 0) {
        toast.info(`${missing.size} clientes não encontrados - cadastro necessário`);
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      setProgress(0);
      toast.error("Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const processBoleto = async (row: any, clientId: string, userId: string) => {
    const dueDate = parseDate(row["Data Vencimento"]);
    if (!dueDate) throw new Error("Data inválida");

    const amount = parseAmount(row["Valor (R$)"]);
    const liquidationAmount = parseAmount(row["Liquidação (R$)"] || "0");
    const paymentDate = parseDate(row["Data Liquidação"] || "");
    const competence = calculateCompetence(dueDate);
    const status = mapStatus(row["Situação do Boleto"] || "");

    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("client_id", clientId)
      .eq("due_date", dueDate)
      .eq("amount", amount)
      .maybeSingle();

    if (existing) throw new Error("Boleto duplicado");

    const { data: insertedInvoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        client_id: clientId,
        amount,
        due_date: dueDate,
        payment_date: paymentDate,
        status,
        competence,
        description: `Honorários ${competence} - Boleto ${row["Nº Doc"]} (${row["Nosso Nº"]})`,
        created_by: userId,
        calculated_amount: liquidationAmount > 0 ? liquidationAmount : null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (status === "cancelled" && row["Situação do Boleto"].toUpperCase().includes("BAIXADO")) {
      await supabase.from("audit_logs" as any).insert({
        audit_type: "boleto_baixado",
        severity: "warning",
        entity_type: "invoice",
        entity_id: insertedInvoice.id,
        title: `Boleto Baixado - ${row["Pagador"]}`,
        description: `Boleto ${row["Nº Doc"]} baixado. Verificar pagamento via PIX/transferência.`,
        metadata: {
          boleto_numero: row["Nº Doc"],
          nosso_numero: row["Nosso Nº"],
          cliente: row["Pagador"],
          valor: amount,
          vencimento: row["Data Vencimento"],
          situacao_original: row["Situação do Boleto"],
          competencia: competence,
        },
        created_by: userId,
      });
    }

    if (status === "paid" && paymentDate) {
      // Criar lançamento contábil de baixa (recebimento)
      await supabase.functions.invoke('create-accounting-entry', {
        body: {
          type: 'invoice',
          operation: 'payment',
          referenceId: insertedInvoice.id,
          amount: liquidationAmount > 0 ? liquidationAmount : amount,
          date: paymentDate,
          description: `Honorários ${competence}`,
          clientId: clientId,
        },
      });

      await supabase.from("client_ledger").insert({
        client_id: clientId,
        transaction_date: paymentDate,
        description: `Pagamento honorários ${competence}`,
        debit: 0,
        credit: liquidationAmount > 0 ? liquidationAmount : amount,
        balance: 0,
        reference_type: "invoice",
        notes: `Boleto ${row["Nº Doc"]}`,
        created_by: userId,
      });
    }
  };

  const handleCreateClient = async () => {
    if (!clientFormData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          name: clientFormData.name.trim(),
          cnpj: clientFormData.cnpj.trim() || null,
          email: clientFormData.email.trim() || null,
          phone: clientFormData.phone.trim() || null,
          monthly_fee: clientFormData.monthly_fee ? parseFloat(clientFormData.monthly_fee) : 0,
          status: "active",
          created_by: user.id,
        })
        .select()
        .single();

      if (clientError) throw clientError;

      await supabase.from("audit_logs" as any).insert({
        audit_type: "client_created_from_boleto",
        severity: "warning",
        entity_type: "client",
        entity_id: newClient.id,
        title: `Cliente via Boletos - ${clientFormData.name}`,
        description: `Cliente "${clientFormData.name}" cadastrado via importação. ${missingClients[currentClientIndex].boletos.length} boleto(s). ATENÇÃO: Verificar com operacional se serviço está sendo executado.`,
        metadata: {
          cliente: clientFormData.name,
          total_boletos: missingClients[currentClientIndex].boletos.length,
          origem: "importacao_boletos",
        },
        created_by: user.id,
      });

      let processedCount = 0;
      for (const boleto of missingClients[currentClientIndex].boletos) {
        try {
          await processBoleto(boleto, newClient.id, user.id);
          processedCount++;
        } catch (err) {
          console.error("Erro boleto:", err);
        }
      }

      toast.success(`Cliente cadastrado! ${processedCount} boletos processados`);

      if (results) {
        setResults({
          ...results,
          success: results.success + processedCount,
          clientsCreated: results.clientsCreated + 1,
        });
      }

      if (currentClientIndex < missingClients.length - 1) {
        const nextIndex = currentClientIndex + 1;
        setCurrentClientIndex(nextIndex);
        setClientFormData({
          name: missingClients[nextIndex].name,
          cnpj: "",
          email: "",
          phone: "",
          monthly_fee: "",
        });
      } else {
        setShowClientDialog(false);
        toast.success("Importação concluída!");
      }
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const handleSkipClient = () => {
    if (currentClientIndex < missingClients.length - 1) {
      const nextIndex = currentClientIndex + 1;
      setCurrentClientIndex(nextIndex);
      setClientFormData({
        name: missingClients[nextIndex].name,
        cnpj: "",
        email: "",
        phone: "",
        monthly_fee: "",
      });
    } else {
      setShowClientDialog(false);
      toast.info("Importação finalizada");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Importar Boletos Bancários</h1>
          <p className="text-muted-foreground">
            Importe boletos com cálculo automático de competência e cadastro de clientes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload Excel</CardTitle>
            <CardDescription>Relatório de boletos do Sicredi</CardDescription>
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

            <Button onClick={processExcelFile} disabled={!file || loading} className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              {loading ? "Importando..." : "Importar"}
            </Button>

            {loading && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full h-2" />
                <p className="text-xs text-muted-foreground text-center">{Math.round(progress)}%</p>
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
              <h3 className="font-semibold">Cadastro Automático</h3>
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md">
                <p className="text-sm">
                  <strong>💡 Novo:</strong> Clientes não encontrados podem ser cadastrados durante a importação. 
                  Ajuda a identificar divergências entre financeiro (boletos) e operacional (serviços).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Cadastrar Cliente
            </DialogTitle>
            <DialogDescription>
              Cliente {currentClientIndex + 1} de {missingClients.length} com{" "}
              {missingClients[currentClientIndex]?.boletos.length} boleto(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-md">
              <p className="text-sm">
                ⚠️ Cliente com boletos mas não cadastrado. Alerta de auditoria será criado.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={clientFormData.name}
                  onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={clientFormData.cnpj}
                    onChange={(e) => setClientFormData({ ...clientFormData, cnpj: e.target.value })}
                    maxLength={18}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={clientFormData.phone}
                    onChange={(e) => setClientFormData({ ...clientFormData, phone: e.target.value })}
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={clientFormData.email}
                    onChange={(e) => setClientFormData({ ...clientFormData, email: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label>Honorário Mensal</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={clientFormData.monthly_fee}
                    onChange={(e) => setClientFormData({ ...clientFormData, monthly_fee: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Badge variant="outline" className="mr-auto">
              {currentClientIndex + 1}/{missingClients.length}
            </Badge>
            <Button variant="outline" onClick={handleSkipClient}>Pular</Button>
            <Button onClick={handleCreateClient}>
              <UserPlus className="h-4 w-4 mr-2" />
              Cadastrar
              {currentClientIndex < missingClients.length - 1 && <ArrowRight className="h-4 w-4 ml-2" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ImportBoletos;
