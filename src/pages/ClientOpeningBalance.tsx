import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Calendar, DollarSign, Loader2, FileText, CheckCircle, XCircle, CalendarRange } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  opening_balance: number;
  monthly_fee: number | null;
}

interface OpeningBalance {
  id: string;
  client_id: string;
  client_name?: string;
  competence: string;
  amount: number;
  due_date: string | null;
  status: string;
  paid_amount: number;
  paid_date: string | null;
  description: string | null;
  notes: string | null;
}

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const ClientOpeningBalance = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [balances, setBalances] = useState<OpeningBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingBatch, setSavingBatch] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<OpeningBalance | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Form para lançamento individual
  const [formData, setFormData] = useState({
    client_id: "",
    competence: "",
    amount: "",
    due_date: "",
    description: "",
    notes: ""
  });

  // Form para lançamento em lote
  const [batchForm, setBatchForm] = useState({
    client_id: "",
    year: currentYear.toString(),
    selectedMonths: [] as string[],
    customAmount: "",
    useClientFee: true,
    notes: ""
  });

  // Cliente selecionado para lote
  const [selectedClientForBatch, setSelectedClientForBatch] = useState<Client | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Função para criar honorário (invoice) + lançamento contábil + razão do cliente
  const createInvoiceAndAccountingEntry = async (
    balanceId: string,
    clientId: string,
    amount: number,
    competence: string,
    description: string,
    dueDate: string | null
  ) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        console.warn("Usuário não autenticado");
        return;
      }

      const userId = sessionData.session.user.id;

      // 1. Criar o honorário (invoice) para aparecer na ficha do cliente
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          client_id: clientId,
          amount: amount,
          competence: competence,
          due_date: dueDate || new Date().toISOString().split('T')[0],
          description: description,
          status: "pending",
          source: "opening_balance",
          source_id: balanceId,
          created_by: userId
        })
        .select()
        .single();

      if (invoiceError) {
        console.error("Erro ao criar honorário:", invoiceError);
      } else {
        console.log("Honorário criado:", invoiceData);
      }

      // 2. Criar lançamento no razão do cliente (débito = valor a receber)
      const { data: lastBalance } = await supabase
        .from("client_ledger")
        .select("balance")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const previousBalance = lastBalance?.balance || 0;
      const newBalance = previousBalance + amount; // Débito aumenta o saldo devedor

      const { error: ledgerError } = await supabase
        .from("client_ledger")
        .insert({
          client_id: clientId,
          transaction_date: dueDate || new Date().toISOString().split('T')[0],
          description: `Saldo de Abertura: ${description}`,
          debit: amount,
          credit: 0,
          balance: newBalance,
          reference_type: "opening_balance",
          reference_id: balanceId,
          invoice_id: invoiceData?.id || null,
          created_by: userId
        });

      if (ledgerError) {
        console.error("Erro ao criar lançamento no razão:", ledgerError);
      } else {
        console.log("Lançamento no razão criado");
      }

      // 3. Criar lançamento contábil
      const response = await supabase.functions.invoke('create-accounting-entry', {
        body: {
          type: 'opening_balance',
          operation: 'provision',
          referenceId: balanceId,
          amount: amount,
          date: dueDate || new Date().toISOString().split('T')[0],
          description: description,
          clientId: clientId,
          competence: competence
        }
      });

      if (response.error) {
        console.error("Erro ao criar lançamento contábil:", response.error);
      } else {
        console.log("Lançamento contábil criado:", response.data);
      }
    } catch (error) {
      console.error("Erro ao criar registros:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar clientes ativos com monthly_fee
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf, opening_balance, monthly_fee")
        .eq("is_active", true)
        .order("name");

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Buscar saldos de abertura
      await loadBalances();
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async (clientId?: string) => {
    try {
      let query = supabase
        .from("client_opening_balance")
        .select(`
          *,
          clients!inner(name)
        `)
        .order("competence", { ascending: false });

      if (clientId) {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const enrichedBalances = (data || []).map((balance) => ({
        ...balance,
        client_name: balance.clients?.name
      }));

      setBalances(enrichedBalances);
    } catch (error) {
      console.error("Erro ao carregar saldos:", error);
      toast.error("Erro ao carregar saldos de abertura");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (!formData.client_id) {
        toast.error("Selecione um cliente");
        return;
      }

      if (!formData.competence) {
        toast.error("Informe a competência (MM/AAAA)");
        return;
      }

      const competenceRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
      if (!competenceRegex.test(formData.competence)) {
        toast.error("Formato de competência inválido. Use MM/AAAA (ex: 01/2024)");
        return;
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        toast.error("Informe um valor válido");
        return;
      }

      const balanceData = {
        client_id: formData.client_id,
        competence: formData.competence,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date || null,
        description: formData.description || `Honorários de ${getMonthName(formData.competence.split('/')[0])}/${formData.competence.split('/')[1]}`,
        notes: formData.notes || null,
        status: "pending",
        paid_amount: 0
      };

      if (editingBalance) {
        const { error } = await supabase
          .from("client_opening_balance")
          .update(balanceData)
          .eq("id", editingBalance.id);

        if (error) throw error;
        toast.success("Saldo de abertura atualizado!");
      } else {
        const { data: insertedData, error } = await supabase
          .from("client_opening_balance")
          .insert(balanceData)
          .select()
          .single();

        if (error) throw error;

        // Criar honorário + razão + lançamento contábil automaticamente
        if (insertedData) {
          await createInvoiceAndAccountingEntry(
            insertedData.id,
            formData.client_id,
            parseFloat(formData.amount),
            formData.competence,
            balanceData.description || `Honorários de ${formData.competence}`,
            formData.due_date || null
          );
        }

        toast.success("Saldo de abertura cadastrado com honorário e lançamentos!");
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar saldo de abertura: " + errorMessage);
    }
  };

  const handleBatchSubmit = async () => {
    if (!batchForm.client_id) {
      toast.error("Selecione um cliente");
      return;
    }

    if (batchForm.selectedMonths.length === 0) {
      toast.error("Selecione pelo menos uma competência");
      return;
    }

    const amount = batchForm.useClientFee
      ? selectedClientForBatch?.monthly_fee || 0
      : parseFloat(batchForm.customAmount);

    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido para os honorários");
      return;
    }

    try {
      setSavingBatch(true);

      // Verificar competências já existentes
      const { data: existingBalances, error: checkError } = await supabase
        .from("client_opening_balance")
        .select("competence")
        .eq("client_id", batchForm.client_id);

      if (checkError) throw checkError;

      const existingCompetences = new Set(existingBalances?.map(b => b.competence) || []);

      // Preparar lançamentos
      const entries = batchForm.selectedMonths
        .map(month => {
          const competence = `${month}/${batchForm.year}`;

          // Pular se já existe
          if (existingCompetences.has(competence)) {
            return null;
          }

          // Calcular data de vencimento (dia 10 do mês seguinte)
          const [m, y] = competence.split('/').map(Number);
          const nextMonth = m === 12 ? 1 : m + 1;
          const nextYear = m === 12 ? y + 1 : y;
          const dueDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-10`;

          return {
            client_id: batchForm.client_id,
            competence,
            amount,
            due_date: dueDate,
            description: `Honorários de ${getMonthName(month)}/${batchForm.year}`,
            notes: batchForm.notes || null,
            status: "pending",
            paid_amount: 0
          };
        })
        .filter(Boolean);

      if (entries.length === 0) {
        toast.warning("Todas as competências selecionadas já existem para este cliente");
        setSavingBatch(false);
        return;
      }

      const skipped = batchForm.selectedMonths.length - entries.length;

      // Inserir em lote e retornar os IDs
      const { data: insertedEntries, error } = await supabase
        .from("client_opening_balance")
        .insert(entries)
        .select();

      if (error) throw error;

      // Criar honorários + razão + lançamentos contábeis para cada entrada
      if (insertedEntries && insertedEntries.length > 0) {
        toast.info(`Criando ${insertedEntries.length} honorários e lançamentos...`);

        for (const entry of insertedEntries) {
          await createInvoiceAndAccountingEntry(
            entry.id,
            entry.client_id,
            entry.amount,
            entry.competence,
            entry.description || `Honorários de ${entry.competence}`,
            entry.due_date
          );
        }
      }

      let message = `${entries.length} competência(s) lançada(s) com honorários e lançamentos!`;
      if (skipped > 0) {
        message += ` (${skipped} já existente(s) foram ignoradas)`;
      }
      toast.success(message);

      setBatchDialogOpen(false);
      resetBatchForm();
      loadData();
    } catch (error) {
      console.error("Erro ao salvar em lote:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao salvar em lote: " + errorMessage);
    } finally {
      setSavingBatch(false);
    }
  };

  const getMonthName = (monthNum: string) => {
    const month = MONTHS.find(m => m.value === monthNum);
    return month?.label || monthNum;
  };

  const handleEdit = (balance: OpeningBalance) => {
    setEditingBalance(balance);
    setFormData({
      client_id: balance.client_id,
      competence: balance.competence,
      amount: balance.amount.toString(),
      due_date: balance.due_date || "",
      description: balance.description || "",
      notes: balance.notes || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este saldo de abertura?")) return;

    try {
      const { error } = await supabase
        .from("client_opening_balance")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Saldo de abertura excluído!");
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir saldo de abertura");
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: "",
      competence: "",
      amount: "",
      due_date: "",
      description: "",
      notes: ""
    });
    setEditingBalance(null);
  };

  const resetBatchForm = () => {
    setBatchForm({
      client_id: "",
      year: currentYear.toString(),
      selectedMonths: [],
      customAmount: "",
      useClientFee: true,
      notes: ""
    });
    setSelectedClientForBatch(null);
  };

  const handleClientFilter = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId === "all") {
      loadBalances();
    } else {
      loadBalances(clientId);
    }
  };

  const handleBatchClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setSelectedClientForBatch(client || null);
    setBatchForm({
      ...batchForm,
      client_id: clientId,
      customAmount: client?.monthly_fee?.toString() || ""
    });
  };

  const handleMonthToggle = (month: string) => {
    setBatchForm(prev => ({
      ...prev,
      selectedMonths: prev.selectedMonths.includes(month)
        ? prev.selectedMonths.filter(m => m !== month)
        : [...prev.selectedMonths, month]
    }));
  };

  const selectAllMonths = () => {
    setBatchForm(prev => ({
      ...prev,
      selectedMonths: MONTHS.map(m => m.value)
    }));
  };

  const clearAllMonths = () => {
    setBatchForm(prev => ({
      ...prev,
      selectedMonths: []
    }));
  };

  const getStatusBadge = (balance: OpeningBalance) => {
    if (balance.status === "paid") {
      return (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Pago
        </Badge>
      );
    }
    if (balance.status === "partial") {
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-700">
          <DollarSign className="h-3 w-3 mr-1" />
          Parcial
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const getTotalByClient = () => {
    const totals = new Map<string, { name: string; total: number; pending: number }>();

    balances.forEach(balance => {
      const current = totals.get(balance.client_id) || {
        name: balance.client_name || "",
        total: 0,
        pending: 0
      };

      current.total += balance.amount;
      if (balance.status !== "paid") {
        current.pending += (balance.amount - balance.paid_amount);
      }

      totals.set(balance.client_id, current);
    });

    return Array.from(totals.entries()).map(([clientId, data]) => ({
      clientId,
      ...data
    })).sort((a, b) => b.pending - a.pending);
  };

  const totalPending = balances
    .filter(b => b.status !== "paid")
    .reduce((sum, b) => sum + (b.amount - b.paid_amount), 0);

  const totalPaid = balances
    .filter(b => b.status === "paid")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Saldo de Abertura</h1>
            <p className="text-muted-foreground">
              Gerencie honorários não pagos de competências anteriores
            </p>
          </div>
          <div className="flex gap-2">
            {/* Botão Lançamento em Lote */}
            <Dialog open={batchDialogOpen} onOpenChange={(open) => {
              setBatchDialogOpen(open);
              if (!open) resetBatchForm();
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <CalendarRange className="w-4 h-4 mr-2" />
                  Lançamento em Lote
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Lançamento em Lote por Ano</DialogTitle>
                  <DialogDescription>
                    Selecione o cliente, ano e as competências para lançar automaticamente
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Seleção de Cliente */}
                  <div className="space-y-2">
                    <Label>Cliente *</Label>
                    <Select
                      value={batchForm.client_id}
                      onValueChange={handleBatchClientChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{client.name}</span>
                              {client.monthly_fee && (
                                <span className="text-muted-foreground ml-2">
                                  ({formatCurrency(client.monthly_fee)})
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedClientForBatch && (
                      <div className="bg-muted p-3 rounded-lg mt-2">
                        <p className="text-sm font-medium">
                          Honorário mensal cadastrado: {" "}
                          <span className="text-primary">
                            {selectedClientForBatch.monthly_fee
                              ? formatCurrency(selectedClientForBatch.monthly_fee)
                              : "Não informado"}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Seleção de Ano */}
                  <div className="space-y-2">
                    <Label>Ano *</Label>
                    <Select
                      value={batchForm.year}
                      onValueChange={(value) => setBatchForm({ ...batchForm, year: value })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seleção de Meses */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Competências *</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={selectAllMonths}
                        >
                          Selecionar Todos
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearAllMonths}
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {MONTHS.map((month) => (
                        <div
                          key={month.value}
                          className={`flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                            batchForm.selectedMonths.includes(month.value)
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => handleMonthToggle(month.value)}
                        >
                          <Checkbox
                            id={`month-${month.value}`}
                            checked={batchForm.selectedMonths.includes(month.value)}
                            onCheckedChange={() => handleMonthToggle(month.value)}
                          />
                          <label
                            htmlFor={`month-${month.value}`}
                            className="text-sm font-medium cursor-pointer flex-1"
                          >
                            {month.label}
                          </label>
                        </div>
                      ))}
                    </div>

                    {batchForm.selectedMonths.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {batchForm.selectedMonths.length} competência(s) selecionada(s)
                      </p>
                    )}
                  </div>

                  {/* Valor dos Honorários */}
                  <div className="space-y-3">
                    <Label>Valor dos Honorários *</Label>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="useClientFee"
                        checked={batchForm.useClientFee}
                        onCheckedChange={(checked) => setBatchForm({
                          ...batchForm,
                          useClientFee: checked === true,
                          customAmount: checked ? "" : (selectedClientForBatch?.monthly_fee?.toString() || "")
                        })}
                      />
                      <label htmlFor="useClientFee" className="text-sm">
                        Usar valor cadastrado do cliente ({selectedClientForBatch?.monthly_fee ? formatCurrency(selectedClientForBatch.monthly_fee) : "N/A"})
                      </label>
                    </div>

                    {!batchForm.useClientFee && (
                      <div className="space-y-2">
                        <Label htmlFor="customAmount">Valor personalizado</Label>
                        <Input
                          id="customAmount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0,00"
                          value={batchForm.customAmount}
                          onChange={(e) => setBatchForm({ ...batchForm, customAmount: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  {/* Observações */}
                  <div className="space-y-2">
                    <Label htmlFor="batchNotes">Observações (opcional)</Label>
                    <Textarea
                      id="batchNotes"
                      placeholder="Observações adicionais para todos os lançamentos..."
                      value={batchForm.notes}
                      onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {/* Resumo */}
                  {batchForm.client_id && batchForm.selectedMonths.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                        Resumo do Lançamento
                      </h4>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <li>• Cliente: {selectedClientForBatch?.name}</li>
                        <li>• Ano: {batchForm.year}</li>
                        <li>• Competências: {batchForm.selectedMonths.length}</li>
                        <li>• Valor unitário: {formatCurrency(
                          batchForm.useClientFee
                            ? selectedClientForBatch?.monthly_fee || 0
                            : parseFloat(batchForm.customAmount) || 0
                        )}</li>
                        <li className="font-semibold pt-1 border-t border-blue-300 dark:border-blue-700 mt-2">
                          • Total: {formatCurrency(
                            (batchForm.useClientFee
                              ? selectedClientForBatch?.monthly_fee || 0
                              : parseFloat(batchForm.customAmount) || 0) * batchForm.selectedMonths.length
                          )}
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setBatchDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleBatchSubmit}
                    disabled={savingBatch || !batchForm.client_id || batchForm.selectedMonths.length === 0}
                  >
                    {savingBatch ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Lançar {batchForm.selectedMonths.length} Competência(s)
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Botão Lançamento Individual */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Individual
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingBalance ? "Editar Saldo de Abertura" : "Adicionar Saldo de Abertura"}
                  </DialogTitle>
                  <DialogDescription>
                    Registre uma competência devida individualmente
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="client_id">Cliente *</Label>
                      <Select
                        value={formData.client_id}
                        onValueChange={(value) => {
                          const client = clients.find(c => c.id === value);
                          setFormData({
                            ...formData,
                            client_id: value,
                            amount: client?.monthly_fee?.toString() || formData.amount
                          });
                        }}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{client.name}</span>
                                {client.monthly_fee && (
                                  <span className="text-muted-foreground ml-2">
                                    ({formatCurrency(client.monthly_fee)})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="competence">Competência *</Label>
                      <Input
                        id="competence"
                        placeholder="MM/AAAA (ex: 01/2024)"
                        value={formData.competence}
                        onChange={(e) => setFormData({ ...formData, competence: e.target.value })}
                        maxLength={7}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Formato: MM/AAAA (ex: 01/2024, 03/2024)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">Valor *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0,00"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="due_date">Data de Vencimento</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Input
                        id="description"
                        placeholder="Gerada automaticamente se vazio"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Se deixar vazio, será gerada automaticamente: "Honorários de Mês/Ano"
                      </p>
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="notes">Observações</Label>
                      <Textarea
                        id="notes"
                        placeholder="Observações adicionais..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingBalance ? "Atualizar" : "Cadastrar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pendente</CardTitle>
              <DollarSign className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(totalPending)}
              </div>
              <p className="text-xs text-muted-foreground">
                Competências não pagas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground">
                Já recebido
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Competências</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {balances.filter(b => b.status !== "paid").length}
              </div>
              <p className="text-xs text-muted-foreground">
                Competências em aberto
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo por Cliente</CardTitle>
            <CardDescription>
              Saldo devedor de cada cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {getTotalByClient().length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum saldo de abertura cadastrado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Total Original</TableHead>
                    <TableHead className="text-right">Saldo Pendente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getTotalByClient().map((item) => (
                    <TableRow key={item.clientId}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.pending > 0 ? (
                          <span className="font-semibold text-orange-600">
                            {formatCurrency(item.pending)}
                          </span>
                        ) : (
                          <span className="text-green-600">
                            {formatCurrency(0)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Lista de Competências */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Competências Cadastradas</CardTitle>
                <CardDescription>
                  Histórico detalhado por competência
                </CardDescription>
              </div>
              <div className="w-64">
                <Select
                  value={selectedClientId || "all"}
                  onValueChange={handleClientFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : balances.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {selectedClientId && selectedClientId !== "all"
                  ? "Nenhuma competência cadastrada para este cliente"
                  : "Nenhuma competência cadastrada ainda"}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance) => (
                    <TableRow key={balance.id}>
                      <TableCell className="font-medium">
                        {balance.client_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {balance.competence}
                        </div>
                      </TableCell>
                      <TableCell>
                        {balance.due_date
                          ? format(new Date(balance.due_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(balance.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {balance.paid_amount > 0 ? (
                          <span className="text-green-600">
                            {formatCurrency(balance.paid_amount)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(balance)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(balance.id)}
                            title="Excluir"
                            disabled={balance.status === "paid" || balance.paid_amount > 0}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ClientOpeningBalance;
