import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Download,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lightbulb,
  Link,
  FileText,
  CreditCard,
  Check,
  Plus,
  Loader2
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as XLSX from "xlsx";

interface Discrepancy {
  transaction: any;
  analysisResult: {
    possibleCauses: string[];
    suggestions: string[];
    severity: "low" | "medium" | "high";
    category: string;
  };
}

const ReconciliationDiscrepancies = () => {
  const [loading, setLoading] = useState(true);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [filteredDiscrepancies, setFilteredDiscrepancies] = useState<Discrepancy[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<Discrepancy | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconcileMode, setReconcileMode] = useState<"invoice" | "expense" | "new_invoice" | "new_expense" | "manual">("invoice");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedExpenseId, setSelectedExpenseId] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [newInvoiceData, setNewInvoiceData] = useState({
    client_id: "",
    amount: 0,
    competence: "",
    description: ""
  });
  const [newExpenseData, setNewExpenseData] = useState({
    description: "",
    amount: 0,
    category: "",
    due_date: ""
  });
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    loadDiscrepancies();
    loadInvoices();
    loadExpenses();
    loadClients();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [discrepancies, searchTerm, filterType, filterSeverity]);

  const loadInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*, clients(name)")
      .eq("status", "pending")
      .order("due_date", { ascending: false });
    setInvoices(data || []);
  };

  const loadExpenses = async () => {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("status", "pending")
      .order("due_date", { ascending: false });
    setExpenses(data || []);
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("is_active", true)
      .order("name");
    setClients(data || []);
  };

  const analyzeTransaction = (tx: any): Discrepancy["analysisResult"] => {
    const possibleCauses: string[] = [];
    const suggestions: string[] = [];
    let severity: "low" | "medium" | "high" = "low";
    let category = "Geral";

    const amount = Math.abs(tx.amount);
    const description = tx.description?.toLowerCase() || "";
    const isCredit = tx.transaction_type === "credit";
    const daysSinceTransaction = Math.floor(
      (new Date().getTime() - new Date(tx.transaction_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Análise de transações de entrada (recebimentos)
    if (isCredit) {
      category = "Recebimento não identificado";

      // PIX sem identificação clara
      if (description.includes("pix")) {
        possibleCauses.push("Recebimento PIX sem identificação clara do pagador");
        possibleCauses.push("CNPJ ou razão social não encontrados na descrição");
        suggestions.push("Verificar o nome do pagador na descrição do PIX");
        suggestions.push("Buscar o CNPJ/CPF na descrição e cruzar com base de clientes");
        suggestions.push("Entrar em contato com o cliente para confirmar pagamento");
      }

      // Transferência sem identificação
      if (description.includes("transf") || description.includes("ted") || description.includes("doc")) {
        possibleCauses.push("Transferência bancária sem informações suficientes");
        suggestions.push("Verificar histórico de faturas pendentes com valores próximos");
        suggestions.push("Conferir extrato da conta de origem se disponível");
      }

      // Valor muito baixo ou muito alto
      if (amount < 100) {
        possibleCauses.push("Valor muito baixo - pode ser um pagamento parcial ou taxa");
        suggestions.push("Verificar se é parte de um pagamento maior");
        suggestions.push("Conferir se não é uma devolução ou estorno");
        severity = "low";
      } else if (amount > 50000) {
        possibleCauses.push("Valor alto - requer atenção especial");
        suggestions.push("Priorizar a identificação desta transação");
        suggestions.push("Verificar se corresponde a múltiplas faturas");
        severity = "high";
      }

      // Transação antiga não conciliada
      if (daysSinceTransaction > 30) {
        possibleCauses.push(`Transação com ${daysSinceTransaction} dias sem conciliação`);
        suggestions.push("Priorizar a resolução - pode afetar o fluxo de caixa");
        severity = severity === "high" ? "high" : "medium";
      }
    } 
    // Análise de transações de saída (pagamentos)
    else {
      category = "Pagamento não identificado";

      // Pagamento de despesa sem categoria
      if (!tx.category) {
        possibleCauses.push("Pagamento sem categoria definida");
        suggestions.push("Criar uma despesa correspondente com categoria adequada");
        suggestions.push("Verificar se é uma despesa recorrente");
      }

      // Débito automático
      if (description.includes("débito") || description.includes("debito") || description.includes("automatico")) {
        possibleCauses.push("Débito automático não cadastrado como despesa");
        suggestions.push("Cadastrar como despesa recorrente para conciliação automática futura");
        suggestions.push("Criar regra de conciliação para este tipo de débito");
      }

      // Boleto ou fatura
      if (description.includes("boleto") || description.includes("fatura") || description.includes("titulo")) {
        possibleCauses.push("Boleto pago mas não cadastrado no sistema");
        suggestions.push("Cadastrar a despesa correspondente");
        suggestions.push("Anexar comprovante de pagamento");
      }

      // Taxa bancária
      if (description.includes("taxa") || description.includes("tarifa") || description.includes("iof")) {
        category = "Taxa bancária";
        possibleCauses.push("Taxa bancária não registrada");
        suggestions.push("Criar despesa na categoria 'Taxas Bancárias'");
        severity = "low";
      }

      // Valor alto
      if (amount > 10000) {
        possibleCauses.push("Pagamento de valor alto não identificado");
        suggestions.push("Verificar com urgência - pode ser pagamento importante");
        severity = "high";
      }
    }

    // Análise de descrição vazia ou genérica
    if (!description || description.length < 10) {
      possibleCauses.push("Descrição muito curta ou vazia");
      suggestions.push("Entrar em contato com o banco para obter mais detalhes");
      severity = severity === "high" ? "high" : "medium";
    }

    // Se não encontrou nenhuma causa específica
    if (possibleCauses.length === 0) {
      possibleCauses.push("Transação não correspondeu a nenhum padrão conhecido");
      suggestions.push("Revisar manualmente todas as faturas e despesas pendentes");
      suggestions.push("Verificar se há erros de digitação nos valores cadastrados");
    }

    // Sugestão geral sempre presente
    suggestions.push("Usar a funcionalidade de conciliação manual no sistema");

    return {
      possibleCauses,
      suggestions,
      severity,
      category,
    };
  };

  const loadDiscrepancies = async () => {
    setLoading(true);
    try {
      const { data: transactions, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("matched", false)
        .order("transaction_date", { ascending: false });

      if (error) throw error;

      const analyzed = (transactions || []).map((tx) => ({
        transaction: tx,
        analysisResult: analyzeTransaction(tx),
      }));

      setDiscrepancies(analyzed);
      toast.success(`${analyzed.length} divergências encontradas e analisadas`);
    } catch (error: any) {
      console.error("Erro ao carregar divergências:", error);
      toast.error("Erro ao carregar divergências: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...discrepancies];

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(
        (d) =>
          d.transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.analysisResult.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por tipo
    if (filterType !== "all") {
      filtered = filtered.filter((d) => d.transaction.transaction_type === filterType);
    }

    // Filtro por severidade
    if (filterSeverity !== "all") {
      filtered = filtered.filter((d) => d.analysisResult.severity === filterSeverity);
    }

    setFilteredDiscrepancies(filtered);
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      low: { variant: "default" as const, label: "Baixa", className: "bg-blue-500" },
      medium: { variant: "secondary" as const, label: "Média", className: "bg-yellow-500" },
      high: { variant: "destructive" as const, label: "Alta", className: "bg-red-500" },
    };
    const config = variants[severity as keyof typeof variants] || variants.low;
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const exportToExcel = () => {
    const exportData = filteredDiscrepancies.map((d) => ({
      Data: format(new Date(d.transaction.transaction_date), "dd/MM/yyyy", { locale: ptBR }),
      Tipo: d.transaction.transaction_type === "credit" ? "Entrada" : "Saída",
      Descrição: d.transaction.description,
      Valor: Math.abs(d.transaction.amount),
      Categoria: d.analysisResult.category,
      Severidade: d.analysisResult.severity === "high" ? "Alta" : d.analysisResult.severity === "medium" ? "Média" : "Baixa",
      "Possíveis Causas": d.analysisResult.possibleCauses.join("; "),
      Sugestões: d.analysisResult.suggestions.join("; "),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Divergências");
    XLSX.writeFile(wb, `divergencias_conciliacao_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Relatório exportado com sucesso!");
  };

  const handleViewDetails = (discrepancy: Discrepancy) => {
    setSelectedDiscrepancy(discrepancy);
    setDetailDialogOpen(true);
  };

  const handleOpenReconcile = (discrepancy: Discrepancy) => {
    setSelectedDiscrepancy(discrepancy);
    setNewInvoiceData({
      client_id: "",
      amount: Math.abs(discrepancy.transaction.amount),
      competence: "",
      description: discrepancy.transaction.description
    });
    setNewExpenseData({
      description: discrepancy.transaction.description,
      amount: Math.abs(discrepancy.transaction.amount),
      category: "",
      due_date: discrepancy.transaction.transaction_date
    });
    setReconcileDialogOpen(true);
  };

  const handleReconcile = async () => {
    if (!selectedDiscrepancy) return;
    
    setReconciling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const transaction = selectedDiscrepancy.transaction;
      let matchedInvoiceId = null;
      let matchedExpenseId = null;

      if (reconcileMode === "invoice" && selectedInvoiceId) {
        // Vincular a fatura existente
        matchedInvoiceId = selectedInvoiceId;
        
        // Atualizar fatura como paga
        await supabase
          .from("invoices")
          .update({ 
            status: "paid",
            payment_date: transaction.transaction_date
          })
          .eq("id", selectedInvoiceId);

        // Adicionar entrada no razão do cliente
        const { data: invoice } = await supabase
          .from("invoices")
          .select("client_id, amount")
          .eq("id", selectedInvoiceId)
          .single();

        if (invoice) {
          await supabase.from("client_ledger").insert({
            client_id: invoice.client_id,
            transaction_date: transaction.transaction_date,
            description: `Pagamento recebido - ${transaction.description}`,
            credit: invoice.amount,
            debit: 0,
            balance: 0,
            reference_type: "invoice",
            reference_id: selectedInvoiceId,
            invoice_id: selectedInvoiceId,
            created_by: user.id
          });
        }

      } else if (reconcileMode === "expense" && selectedExpenseId) {
        // Vincular a despesa existente
        matchedExpenseId = selectedExpenseId;
        
        // Atualizar despesa como paga
        await supabase
          .from("expenses")
          .update({ 
            status: "paid",
            payment_date: transaction.transaction_date
          })
          .eq("id", selectedExpenseId);

      } else if (reconcileMode === "new_invoice") {
        // Criar nova fatura
        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert({
            client_id: newInvoiceData.client_id,
            amount: newInvoiceData.amount,
            due_date: transaction.transaction_date,
            payment_date: transaction.transaction_date,
            status: "paid",
            competence: newInvoiceData.competence,
            description: newInvoiceData.description,
            created_by: user.id
          })
          .select()
          .single();

        if (invoiceError) throw invoiceError;
        matchedInvoiceId = newInvoice.id;

        // Adicionar entrada no razão do cliente
        await supabase.from("client_ledger").insert({
          client_id: newInvoiceData.client_id,
          transaction_date: transaction.transaction_date,
          description: `Pagamento recebido - ${newInvoiceData.description}`,
          credit: newInvoiceData.amount,
          debit: 0,
          balance: 0,
          reference_type: "invoice",
          reference_id: newInvoice.id,
          invoice_id: newInvoice.id,
          created_by: user.id
        });

      } else if (reconcileMode === "new_expense") {
        // Criar nova despesa
        const { data: newExpense, error: expenseError } = await supabase
          .from("expenses")
          .insert({
            description: newExpenseData.description,
            amount: newExpenseData.amount,
            category: newExpenseData.category,
            due_date: newExpenseData.due_date,
            payment_date: transaction.transaction_date,
            status: "paid",
            created_by: user.id
          })
          .select()
          .single();

        if (expenseError) throw expenseError;
        matchedExpenseId = newExpense.id;

      } else if (reconcileMode === "manual") {
        // Marcar como resolvida manualmente
        await supabase
          .from("bank_transactions")
          .update({ 
            matched: true,
            notes: manualNotes
          })
          .eq("id", transaction.id);

        toast.success("Transação marcada como resolvida");
        setReconcileDialogOpen(false);
        loadDiscrepancies();
        return;
      }

      // Atualizar transação bancária
      await supabase
        .from("bank_transactions")
        .update({ 
          matched: true,
          matched_invoice_id: matchedInvoiceId,
          matched_expense_id: matchedExpenseId,
          ai_confidence: 100
        })
        .eq("id", transaction.id);

      toast.success("Conciliação realizada com sucesso!");
      setReconcileDialogOpen(false);
      setSelectedInvoiceId("");
      setSelectedExpenseId("");
      setManualNotes("");
      loadDiscrepancies();

    } catch (error: any) {
      console.error("Erro ao conciliar:", error);
      toast.error("Erro ao realizar conciliação: " + error.message);
    } finally {
      setReconciling(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Relatório de Divergências de Conciliação</h1>
            <p className="text-muted-foreground">
              Análise detalhada de transações não conciliadas com causas e sugestões
            </p>
          </div>
          <Button onClick={exportToExcel} disabled={filteredDiscrepancies.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Divergências</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{discrepancies.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Severidade Alta</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {discrepancies.filter((d) => d.analysisResult.severity === "high").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recebimentos</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {discrepancies.filter((d) => d.transaction.transaction_type === "credit").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagamentos</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {discrepancies.filter((d) => d.transaction.transaction_type === "debit").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Descrição ou categoria..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Transação</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="credit">Entradas</SelectItem>
                    <SelectItem value="debit">Saídas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Severidade</Label>
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Divergências */}
        <Card>
          <CardHeader>
            <CardTitle>Divergências Detectadas</CardTitle>
            <CardDescription>
              {filteredDiscrepancies.length} de {discrepancies.length} divergências
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredDiscrepancies.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-success" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma divergência encontrada</h3>
                <p className="text-muted-foreground">
                  Todas as transações estão conciliadas ou não há dados com os filtros aplicados
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDiscrepancies.map((discrepancy, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {format(new Date(discrepancy.transaction.transaction_date), "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          {discrepancy.transaction.transaction_type === "credit" ? (
                            <Badge variant="default" className="bg-success">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Entrada
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <TrendingDown className="w-3 h-3 mr-1" />
                              Saída
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {discrepancy.transaction.description}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(Math.abs(discrepancy.transaction.amount))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{discrepancy.analysisResult.category}</Badge>
                        </TableCell>
                        <TableCell>{getSeverityBadge(discrepancy.analysisResult.severity)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(discrepancy)}
                            >
                              <HelpCircle className="w-4 h-4 mr-1" />
                              Detalhes
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleOpenReconcile(discrepancy)}
                            >
                              <Link className="w-4 h-4 mr-1" />
                              Resolver
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalhes */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Análise Detalhada da Divergência</DialogTitle>
            <DialogDescription>
              Causas possíveis e sugestões de resolução
            </DialogDescription>
          </DialogHeader>

          {selectedDiscrepancy && (
            <div className="space-y-6">
              {/* Informações da Transação */}
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-3">Informações da Transação</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-medium">
                      {format(new Date(selectedDiscrepancy.transaction.transaction_date), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium">
                      {selectedDiscrepancy.transaction.transaction_type === "credit" ? "Entrada" : "Saída"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor:</span>
                    <span className="font-medium">
                      {formatCurrency(Math.abs(selectedDiscrepancy.transaction.amount))}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Descrição:</span>
                    <span className="font-medium">{selectedDiscrepancy.transaction.description}</span>
                  </div>
                </div>
              </div>

              {/* Possíveis Causas */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <h3 className="font-semibold">Possíveis Causas</h3>
                </div>
                <ul className="space-y-2">
                  {selectedDiscrepancy.analysisResult.possibleCauses.map((cause, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-destructive mt-0.5">•</span>
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sugestões de Resolução */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-5 w-5 text-warning" />
                  <h3 className="font-semibold">Sugestões de Resolução</h3>
                </div>
                <ul className="space-y-2">
                  {selectedDiscrepancy.analysisResult.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-warning mt-0.5">→</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Classificação */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Categoria:</p>
                  <Badge variant="outline" className="mt-1">
                    {selectedDiscrepancy.analysisResult.category}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Severidade:</p>
                  <div className="mt-1">{getSeverityBadge(selectedDiscrepancy.analysisResult.severity)}</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setDetailDialogOpen(false);
              // Navegar para página de conciliação bancária
              window.location.href = "/bank-reconciliation";
            }}>
              Ir para Conciliação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Conciliação Manual */}
      <Dialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolver Divergência</DialogTitle>
            <DialogDescription>
              Escolha como deseja resolver esta transação não conciliada
            </DialogDescription>
          </DialogHeader>

          {selectedDiscrepancy && (
            <div className="space-y-6">
              {/* Informações da Transação */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Transação Bancária</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Data</Label>
                      <p className="font-medium">
                        {format(new Date(selectedDiscrepancy.transaction.transaction_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Valor</Label>
                      <p className="font-medium">
                        {formatCurrency(Math.abs(selectedDiscrepancy.transaction.amount))}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Descrição</Label>
                    <p className="font-medium">{selectedDiscrepancy.transaction.description}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Tipo</Label>
                    <p>
                      {selectedDiscrepancy.transaction.transaction_type === "credit"
                        ? "Entrada (Recebimento)"
                        : "Saída (Pagamento)"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Modo de Conciliação */}
              <div className="space-y-4">
                <Label>Como deseja resolver?</Label>
                <Select value={reconcileMode} onValueChange={(value: any) => setReconcileMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDiscrepancy.transaction.transaction_type === "credit" && (
                      <>
                        <SelectItem value="invoice">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-2" />
                            Vincular a Fatura Existente
                          </div>
                        </SelectItem>
                        <SelectItem value="new_invoice">
                          <div className="flex items-center">
                            <Plus className="w-4 h-4 mr-2" />
                            Criar Nova Fatura
                          </div>
                        </SelectItem>
                      </>
                    )}
                    {selectedDiscrepancy.transaction.transaction_type === "debit" && (
                      <>
                        <SelectItem value="expense">
                          <div className="flex items-center">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Vincular a Despesa Existente
                          </div>
                        </SelectItem>
                        <SelectItem value="new_expense">
                          <div className="flex items-center">
                            <Plus className="w-4 h-4 mr-2" />
                            Criar Nova Despesa
                          </div>
                        </SelectItem>
                      </>
                    )}
                    <SelectItem value="manual">
                      <div className="flex items-center">
                        <Check className="w-4 h-4 mr-2" />
                        Marcar como Resolvida (Sem Vínculo)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Vincular a Fatura Existente */}
              {reconcileMode === "invoice" && (
                <div className="space-y-2">
                  <Label>Selecione a Fatura</Label>
                  <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma fatura..." />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.map((inv) => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.clients?.name} - {formatCurrency(inv.amount)} - Venc:{" "}
                          {format(new Date(inv.due_date), "dd/MM/yyyy")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Vincular a Despesa Existente */}
              {reconcileMode === "expense" && (
                <div className="space-y-2">
                  <Label>Selecione a Despesa</Label>
                  <Select value={selectedExpenseId} onValueChange={setSelectedExpenseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha uma despesa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {expenses.map((exp) => (
                        <SelectItem key={exp.id} value={exp.id}>
                          {exp.description} - {formatCurrency(exp.amount)} - Venc:{" "}
                          {format(new Date(exp.due_date), "dd/MM/yyyy")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Criar Nova Fatura */}
              {reconcileMode === "new_invoice" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select
                      value={newInvoiceData.client_id}
                      onValueChange={(value) =>
                        setNewInvoiceData({ ...newInvoiceData, client_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      value={newInvoiceData.amount}
                      onChange={(e) =>
                        setNewInvoiceData({ ...newInvoiceData, amount: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Competência (YYYY-MM)</Label>
                    <Input
                      type="text"
                      placeholder="2025-01"
                      value={newInvoiceData.competence}
                      onChange={(e) =>
                        setNewInvoiceData({ ...newInvoiceData, competence: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={newInvoiceData.description}
                      onChange={(e) =>
                        setNewInvoiceData({ ...newInvoiceData, description: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Criar Nova Despesa */}
              {reconcileMode === "new_expense" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={newExpenseData.description}
                      onChange={(e) =>
                        setNewExpenseData({ ...newExpenseData, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      type="number"
                      value={newExpenseData.amount}
                      onChange={(e) =>
                        setNewExpenseData({ ...newExpenseData, amount: parseFloat(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={newExpenseData.category}
                      onValueChange={(value) =>
                        setNewExpenseData({ ...newExpenseData, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Aluguel">Aluguel</SelectItem>
                        <SelectItem value="Salários">Salários</SelectItem>
                        <SelectItem value="Fornecedores">Fornecedores</SelectItem>
                        <SelectItem value="Impostos">Impostos</SelectItem>
                        <SelectItem value="Serviços">Serviços</SelectItem>
                        <SelectItem value="Outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data de Vencimento</Label>
                    <Input
                      type="date"
                      value={newExpenseData.due_date}
                      onChange={(e) =>
                        setNewExpenseData({ ...newExpenseData, due_date: e.target.value })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Marcar como Resolvida Manualmente */}
              {reconcileMode === "manual" && (
                <div className="space-y-2">
                  <Label>Justificativa</Label>
                  <Textarea
                    placeholder="Explique por que esta transação está sendo marcada como resolvida sem vínculo..."
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    rows={4}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReconcileDialogOpen(false)} disabled={reconciling}>
              Cancelar
            </Button>
            <Button onClick={handleReconcile} disabled={reconciling}>
              {reconciling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar Resolução
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ReconciliationDiscrepancies;
