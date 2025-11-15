import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Loader2, ShieldAlert, CheckCircle, AlertTriangle, Ban, Eye, Bot } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface AccountPayable {
  id: string;
  supplier_name: string;
  supplier_document: string | null;
  description: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  category: string;
  payment_method: string | null;
  bank_account: string | null;
  document_number: string | null;
  notes: string | null;
  ai_fraud_score: number | null;
  ai_fraud_reasons: string[] | null;
  ai_recommendations: string[] | null;
  ai_analysis: any;
  approval_status: string;
  created_at: string;
}

const AccountsPayable = () => {
  const [accounts, setAccounts] = useState<AccountPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountPayable | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountPayable | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [filterTab, setFilterTab] = useState("all");

  const [formData, setFormData] = useState({
    supplier_name: "",
    supplier_document: "",
    description: "",
    amount: "",
    due_date: "",
    payment_date: "",
    status: "pending",
    category: "",
    payment_method: "",
    bank_account: "",
    document_number: "",
    notes: "",
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("accounts_payable")
        .select("*")
        .order("due_date", { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar contas a pagar:", error);
      toast.error("Erro ao carregar contas a pagar");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Usuário não autenticado");

      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        created_by: user.user.id,
      };

      if (editingAccount) {
        const { error } = await supabase
          .from("accounts_payable")
          .update(payload)
          .eq("id", editingAccount.id);

        if (error) throw error;
        toast.success("Conta atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("accounts_payable")
          .insert([payload]);

        if (error) throw error;
        toast.success("Conta criada com sucesso!");
      }

      setOpen(false);
      resetForm();
      loadAccounts();
    } catch (error: any) {
      console.error("Erro ao salvar conta:", error);
      toast.error(error.message || "Erro ao salvar conta");
    } finally {
      setLoading(false);
    }
  };

  const analyzePayment = async (account: AccountPayable) => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-fraud-analyzer', {
        body: {
          payment: {
            supplier_name: account.supplier_name,
            supplier_document: account.supplier_document,
            description: account.description,
            amount: account.amount,
            category: account.category,
            payment_method: account.payment_method,
            bank_account: account.bank_account,
            document_number: account.document_number,
          }
        }
      });

      if (error) throw error;

      const analysis = data.analysis;

      // Atualizar conta com análise da IA
      const { error: updateError } = await supabase
        .from("accounts_payable")
        .update({
          ai_fraud_score: analysis.fraud_score,
          ai_fraud_reasons: analysis.fraud_reasons,
          ai_recommendations: analysis.recommendations,
          ai_analysis: analysis,
          approval_status: analysis.approval_suggestion === 'reject' ? 'rejected' : 
                          analysis.approval_suggestion === 'flag_for_review' ? 'flagged' : 'approved'
        })
        .eq("id", account.id);

      if (updateError) throw updateError;

      toast.success("Análise de fraude concluída!");
      loadAccounts();
    } catch (error: any) {
      console.error("Erro na análise de fraude:", error);
      toast.error(error.message || "Erro ao analisar pagamento");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAccountId) return;

    try {
      const { error } = await supabase
        .from("accounts_payable")
        .delete()
        .eq("id", selectedAccountId);

      if (error) throw error;

      toast.success("Conta excluída com sucesso!");
      setDeleteDialogOpen(false);
      loadAccounts();
    } catch (error: any) {
      console.error("Erro ao excluir conta:", error);
      toast.error("Erro ao excluir conta");
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase
        .from("accounts_payable")
        .update({
          status: "paid",
          payment_date: new Date().toISOString().split('T')[0]
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Pagamento confirmado!");
      loadAccounts();
    } catch (error: any) {
      console.error("Erro ao confirmar pagamento:", error);
      toast.error("Erro ao confirmar pagamento");
    }
  };

  const resetForm = () => {
    setFormData({
      supplier_name: "",
      supplier_document: "",
      description: "",
      amount: "",
      due_date: "",
      payment_date: "",
      status: "pending",
      category: "",
      payment_method: "",
      bank_account: "",
      document_number: "",
      notes: "",
    });
    setEditingAccount(null);
  };

  const openEditDialog = (account: AccountPayable) => {
    setEditingAccount(account);
    setFormData({
      supplier_name: account.supplier_name,
      supplier_document: account.supplier_document || "",
      description: account.description,
      amount: account.amount.toString(),
      due_date: account.due_date,
      payment_date: account.payment_date || "",
      status: account.status,
      category: account.category,
      payment_method: account.payment_method || "",
      bank_account: account.bank_account || "",
      document_number: account.document_number || "",
      notes: account.notes || "",
    });
    setOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      approved: "default",
      paid: "secondary",
      rejected: "destructive",
      cancelled: "outline"
    };
    
    const labels: Record<string, string> = {
      pending: "Pendente",
      approved: "Aprovado",
      paid: "Pago",
      rejected: "Rejeitado",
      cancelled: "Cancelado"
    };

    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const getApprovalBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending_review: "outline",
      approved: "default",
      rejected: "destructive",
      flagged: "secondary"
    };
    
    const labels: Record<string, string> = {
      pending_review: "Aguardando Análise",
      approved: "Aprovado IA",
      rejected: "Rejeitado IA",
      flagged: "Requer Revisão"
    };

    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const getRiskColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 70) return "text-destructive";
    if (score >= 50) return "text-orange-500";
    if (score >= 30) return "text-yellow-500";
    return "text-green-500";
  };

  const filteredAccounts = accounts.filter(account => {
    if (filterTab === "all") return true;
    if (filterTab === "pending") return account.status === "pending";
    if (filterTab === "flagged") return account.approval_status === "flagged";
    if (filterTab === "high_risk") return (account.ai_fraud_score || 0) >= 50;
    return true;
  });

  const stats = {
    total: accounts.length,
    pending: accounts.filter(a => a.status === "pending").length,
    flagged: accounts.filter(a => a.approval_status === "flagged").length,
    highRisk: accounts.filter(a => (a.ai_fraud_score || 0) >= 50).length,
    totalAmount: accounts.reduce((sum, a) => sum + a.amount, 0),
    pendingAmount: accounts.filter(a => a.status === "pending").reduce((sum, a) => sum + a.amount, 0)
  };

  if (loading && accounts.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contas a Pagar</h1>
            <p className="text-muted-foreground">
              Gestão inteligente com análise de fraudes por IA
            </p>
          </div>
          <Button onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Contas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.totalAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.pendingAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Requerem Revisão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{stats.flagged}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Flagadas pela IA
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alto Risco
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.highRisk}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Score ≥ 50
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Contas */}
        <Card>
          <CardHeader>
            <CardTitle>Contas a Pagar</CardTitle>
            <CardDescription>
              Lista de todas as contas cadastradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={filterTab} onValueChange={setFilterTab} className="mb-4">
              <TabsList>
                <TabsTrigger value="all">Todas ({stats.total})</TabsTrigger>
                <TabsTrigger value="pending">Pendentes ({stats.pending})</TabsTrigger>
                <TabsTrigger value="flagged">Flagadas ({stats.flagged})</TabsTrigger>
                <TabsTrigger value="high_risk">Alto Risco ({stats.highRisk})</TabsTrigger>
              </TabsList>
            </Tabs>

            {filteredAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Nenhuma conta encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Análise IA</TableHead>
                      <TableHead>Risco</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{account.supplier_name}</div>
                            {account.supplier_document && (
                              <div className="text-xs text-muted-foreground">
                                {account.supplier_document}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {account.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{account.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(account.amount)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(account.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>{getStatusBadge(account.status)}</TableCell>
                        <TableCell>{getApprovalBadge(account.approval_status)}</TableCell>
                        <TableCell>
                          {account.ai_fraud_score !== null ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-bold ${getRiskColor(account.ai_fraud_score)}`}>
                                {account.ai_fraud_score}
                              </span>
                              {account.ai_fraud_score >= 70 && <ShieldAlert className="h-4 w-4 text-destructive" />}
                              {account.ai_fraud_score >= 50 && account.ai_fraud_score < 70 && (
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {account.ai_fraud_score === null && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => analyzePayment(account)}
                                disabled={analyzing}
                                title="Analisar com IA"
                              >
                                <Bot className="h-4 w-4" />
                              </Button>
                            )}
                            {account.ai_fraud_score !== null && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedAccount(account);
                                  setAnalysisDialogOpen(true);
                                }}
                                title="Ver Análise"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {account.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => markAsPaid(account.id)}
                                title="Marcar como Pago"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(account)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedAccountId(account.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
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

        {/* Dialog de Formulário */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da conta a pagar
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="supplier_name">Fornecedor *</Label>
                  <Input
                    id="supplier_name"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="supplier_document">CNPJ/CPF</Label>
                  <Input
                    id="supplier_document"
                    value={formData.supplier_document}
                    onChange={(e) => setFormData({ ...formData, supplier_document: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="document_number">Nº Documento</Label>
                  <Input
                    id="document_number"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="amount">Valor *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category">Categoria *</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="due_date">Vencimento *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="payment_date">Data de Pagamento</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="payment_method">Método de Pagamento</Label>
                  <Input
                    id="payment_method"
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="bank_account">Conta Bancária</Label>
                  <Input
                    id="bank_account"
                    value={formData.bank_account}
                    onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="approved">Aprovado</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="rejected">Rejeitado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAccount ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Análise */}
        <Dialog open={analysisDialogOpen} onOpenChange={setAnalysisDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Análise de Fraude - IA</DialogTitle>
              <DialogDescription>
                Análise detalhada do pagamento
              </DialogDescription>
            </DialogHeader>
            {selectedAccount && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Informações do Pagamento</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="font-medium">Fornecedor:</span> {selectedAccount.supplier_name}</div>
                    <div><span className="font-medium">Valor:</span> {formatCurrency(selectedAccount.amount)}</div>
                    <div><span className="font-medium">Categoria:</span> {selectedAccount.category}</div>
                    <div><span className="font-medium">Vencimento:</span> {format(new Date(selectedAccount.due_date), "dd/MM/yyyy")}</div>
                  </div>
                </div>

                {selectedAccount.ai_fraud_score !== null && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-2">Score de Risco</h3>
                      <div className="flex items-center gap-4">
                        <div className={`text-4xl font-bold ${getRiskColor(selectedAccount.ai_fraud_score)}`}>
                          {selectedAccount.ai_fraud_score}
                        </div>
                        <div className="flex-1">
                          <Progress value={selectedAccount.ai_fraud_score} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedAccount.ai_fraud_score >= 70 ? "Risco Crítico" :
                             selectedAccount.ai_fraud_score >= 50 ? "Risco Alto" :
                             selectedAccount.ai_fraud_score >= 30 ? "Risco Médio" : "Risco Baixo"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedAccount.ai_fraud_reasons && selectedAccount.ai_fraud_reasons.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Motivos de Alerta</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedAccount.ai_fraud_reasons.map((reason, index) => (
                            <li key={index} className="text-sm text-destructive">{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedAccount.ai_recommendations && selectedAccount.ai_recommendations.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Recomendações</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {selectedAccount.ai_recommendations.map((rec, index) => (
                            <li key={index} className="text-sm">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedAccount.ai_analysis?.detailed_analysis && (
                      <div>
                        <h3 className="font-semibold mb-2">Análise Detalhada</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedAccount.ai_analysis.detailed_analysis}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Exclusão */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default AccountsPayable;
