import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, CheckCircle, DollarSign, Loader2, AlertCircle, TrendingUp, RefreshCw, Download, Upload, FileSpreadsheet, Layers, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { useAccounting } from "@/hooks/useAccounting";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const COST_CENTER_ID = "1";
const SICREDI_BANK_ACCOUNT = "sicredi";

interface HonorarioRecord {
  id: string;
  client_id: string;
  client_name?: string;
  amount: number;
  due_date: string;
  payment_date?: string;
  status: "pending" | "paid";
  competence: string;
  description?: string;
  created_at: string;
  created_by: string;
}

interface Client {
  id: string;
  name: string;
  monthly_fee: number;
}

interface BoletoZebrinha {
  pagador: string;
  dataVencimento: string;
  dataLiquidacao: string;
  valor: number;
  valorLiquidacao: number;
  situacao: string;
  nossoNumero: string;
}

interface TransacaoConsolidada {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
}

const HonorariosFlow = () => {
  const { registrarHonorario, registrarRecebimento } = useAccounting({ showToasts: false, sourceModule: 'HonorariosFlow' });
  const [honorarios, setHonorarios] = useState<HonorarioRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingHonorario, setEditingHonorario] = useState<HonorarioRecord | null>(null);
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<{ matched: number; unmatched: string[] } | null>(null);

  const [showComposicaoDialog, setShowComposicaoDialog] = useState(false);
  const [transacoesConsolidadas, setTransacoesConsolidadas] = useState<TransacaoConsolidada[]>([]);
  const [selectedTransacao, setSelectedTransacao] = useState<TransacaoConsolidada | null>(null);
  const [selectedHonorariosIds, setSelectedHonorariosIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    client_id: "",
    amount: "",
    due_date: "",
    competence: "",
    description: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [honorariosRes, clientsRes, banksRes] = await Promise.all([
        supabase.from("invoices").select("*").order("due_date", { ascending: false }),
        supabase.from("clients").select("id, name, monthly_fee").eq("is_active", true).order("name"),
        supabase.from("bank_accounts").select("id, name").ilike("name", "%SICREDI%").eq("is_active", true).limit(1),
      ]);

      const mappedHonorarios = (honorariosRes.data || []).map((h: any) => ({
        ...h,
        client_name: clients.find(c => c.id === h.client_id)?.name || h.client_id,
      }));

      setHonorarios(mappedHonorarios);
      setClients(clientsRes.data || []);

      if (banksRes.data && banksRes.data.length > 0) {
        setBankAccountId(banksRes.data[0].id);
      }
    } catch (error: unknown) {
      toast.error("Erro ao carregar dados");
      console.error("[HonorariosFlow] Load error:", error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [clients]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormData({
      client_id: "",
      amount: "",
      due_date: "",
      competence: "",
      description: "",
    });
    setEditingHonorario(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const honorarioData = {
        client_id: formData.client_id,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        status: "pending",
        competence: formData.competence,
        description: formData.description || `Honorários ${formData.competence}`,
        created_by: user.id,
        cost_center_id: COST_CENTER_ID,
      };

      if (editingHonorario) {
        const { error } = await supabase
          .from("invoices")
          .update(honorarioData)
          .eq("id", editingHonorario.id);

        if (error) throw new Error(getErrorMessage(error));
        toast.success("Honorário atualizado com sucesso!");
      } else {
        const { data: newHonorario, error } = await supabase
          .from("invoices")
          .insert(honorarioData)
          .select()
          .single();

        if (error) throw new Error(getErrorMessage(error));

        const client = clients.find(c => c.id === formData.client_id);

        const accountingResult = await registrarHonorario({
          invoiceId: newHonorario.id,
          clientId: formData.client_id,
          clientName: client?.name || "Cliente",
          amount: parseFloat(formData.amount),
          competence: formData.competence,
          dueDate: formData.due_date,
          description: formData.description || `Honorários ${formData.competence} - ${client?.name}`,
        });

        if (accountingResult.success) {
          toast.success("Honorário criado com lançamento contábil em competência!");
        } else {
          toast.warning(`Honorário criado mas erro contábil: ${accountingResult.error}`);
        }
      }

      setOpen(false);
      resetForm();
      await loadData();
    } catch (error: any) {
      toast.error("Erro: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (honorarioId: string) => {
    if (!bankAccountId) {
      toast.error("Nenhuma conta SICREDI configurada");
      return;
    }

    if (!confirm("Marcar este honorário como pago?")) return;

    setLoading(true);

    try {
      const honorario = honorarios.find(h => h.id === honorarioId);
      if (!honorario) throw new Error("Honorário não encontrado");

      const paymentDate = new Date().toISOString().split("T")[0];

      const { error } = await supabase
        .from("invoices")
        .update({ status: "paid", payment_date: paymentDate })
        .eq("id", honorarioId);

      if (error) throw new Error(getErrorMessage(error));

      const client = clients.find(c => c.id === honorario.client_id);
      const accountingResult = await registrarRecebimento({
        paymentId: `payment_${honorarioId}_${paymentDate}`,
        invoiceId: honorarioId,
        clientId: honorario.client_id,
        clientName: client?.name || "Cliente",
        amount: honorario.amount,
        paymentDate: paymentDate,
        bankAccountId: bankAccountId,
        description: `Recebimento de ${client?.name} - Honorários ${honorario.competence}`,
      });

      if (accountingResult.success) {
        toast.success("Honorário pago com lançamento contábil em SICREDI!");
      } else {
        toast.warning(`Pagamento registrado mas erro contábil: ${accountingResult.error}`);
      }

      await loadData();
    } catch (error: any) {
      toast.error("Erro ao processar pagamento: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPayments = async () => {
    setLoading(true);
    let syncCount = 0;

    try {
      const pendingHonorarios = honorarios.filter(h => h.status === "pending");
      if (pendingHonorarios.length === 0) {
        toast.info("Nenhum honorário pendente para sincronizar");
        return;
      }

      const { data: bankTransactions, error: txError } = await supabase
        .from("bank_transactions")
        .select("id, amount, transaction_date, description, matched")
        .eq("transaction_type", "credit")
        .eq("matched", false)
        .order("transaction_date", { ascending: false });

      if (txError) throw txError;

      if (!bankTransactions || bankTransactions.length === 0) {
        toast.info("Nenhuma transação bancária não conciliada encontrada");
        return;
      }

      for (const honorario of pendingHonorarios) {
        const client = clients.find(c => c.id === honorario.client_id);
        const clientName = client?.name?.toUpperCase() || "";

        const matchingTx = bankTransactions.find(tx => {
          const amountMatch = Math.abs(tx.amount - honorario.amount) < 0.10;
          const descMatch = clientName && tx.description?.toUpperCase().includes(clientName.substring(0, 15));
          return amountMatch && (descMatch || !clientName);
        });

        if (matchingTx) {
          const paymentDate = matchingTx.transaction_date;

          const { error: updateError } = await supabase
            .from("invoices")
            .update({ status: "paid", payment_date: paymentDate })
            .eq("id", honorario.id);

          if (updateError) {
            console.error(`Erro ao baixar honorário ${honorario.id}:`, updateError);
            continue;
          }

          await supabase
            .from("bank_transactions")
            .update({ matched: true, matched_invoice_id: honorario.id })
            .eq("id", matchingTx.id);

          if (bankAccountId) {
            await registrarRecebimento({
              paymentId: `sync_${honorario.id}_${paymentDate}`,
              invoiceId: honorario.id,
              clientId: honorario.client_id,
              clientName: client?.name || "Cliente",
              amount: honorario.amount,
              paymentDate: paymentDate,
              bankAccountId: bankAccountId,
              description: `Recebimento sincronizado - ${client?.name} - Honorários ${honorario.competence}`,
            });
          }

          syncCount++;
          const txIndex = bankTransactions.findIndex(t => t.id === matchingTx.id);
          if (txIndex > -1) bankTransactions.splice(txIndex, 1);
        }
      }

      if (syncCount > 0) {
        toast.success(`${syncCount} honorário(s) baixado(s) automaticamente!`);
        await loadData();
      } else {
        toast.info("Nenhum match encontrado entre honorários e transações bancárias");
      }
    } catch (error: any) {
      console.error("[HonorariosFlow] Sync error:", error);
      toast.error("Erro ao sincronizar pagamentos: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleBaixarVencidos = async () => {
    const vencidos = honorarios.filter(h => {
      if (h.status !== "pending") return false;
      const dueDate = new Date(h.due_date);
      const today = new Date();
      return dueDate < today;
    });

    if (vencidos.length === 0) {
      toast.info("Nenhum honorário vencido pendente");
      return;
    }

    if (!confirm(`Baixar ${vencidos.length} honorário(s) vencido(s) como pagos?`)) return;

    setLoading(true);
    let baixados = 0;

    try {
      for (const honorario of vencidos) {
        const paymentDate = new Date().toISOString().split("T")[0];

        const { error } = await supabase
          .from("invoices")
          .update({ status: "paid", payment_date: paymentDate })
          .eq("id", honorario.id);

        if (error) continue;

        if (bankAccountId) {
          const client = clients.find(c => c.id === honorario.client_id);
          await registrarRecebimento({
            paymentId: `batch_${honorario.id}_${paymentDate}`,
            invoiceId: honorario.id,
            clientId: honorario.client_id,
            clientName: client?.name || "Cliente",
            amount: honorario.amount,
            paymentDate: paymentDate,
            bankAccountId: bankAccountId,
            description: `Baixa em lote - ${client?.name} - Honorários ${honorario.competence}`,
          });
        }

        baixados++;
      }

      toast.success(`${baixados} honorário(s) baixado(s)!`);
      await loadData();
    } catch (error: any) {
      toast.error("Erro ao baixar honorários: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleImportZebrinha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImportResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(rows.length, 30); i++) {
            const row = rows[i];
            if (row && row[0]?.toString().includes("Cart") && row[4]?.toString().includes("Pagador")) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            toast.error("Formato do relatório não reconhecido. Verifique se é o relatório de boletos do SICREDI.");
            setLoading(false);
            return;
          }

          const boletosLiquidados: BoletoZebrinha[] = [];
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[4]) continue;

            const situacao = row[9]?.toString() || "";
            if (!situacao.includes("LIQUIDADO")) continue;

            let dataLiquidacao = "";
            if (row[6]) {
              const rawDate = row[6].toString();
              if (rawDate.includes("/")) {
                const [d, m, y] = rawDate.split("/");
                dataLiquidacao = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
              }
            }

            if (!dataLiquidacao && situacao.includes("BAIXADO")) {
              const rawDate = row[5]?.toString() || "";
              if (rawDate.includes("/")) {
                const [d, m, y] = rawDate.split("/");
                dataLiquidacao = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
              }
            }

            if (!dataLiquidacao) continue;

            let valor = 0;
            const valorStr = row[7]?.toString().replace(/\./g, "").replace(",", ".") || "0";
            valor = parseFloat(valorStr) || 0;

            let pagador = row[4]?.toString() || "";
            pagador = pagador.replace(/^[\d./-]+\s*/, "").trim();

            boletosLiquidados.push({
              pagador,
              dataVencimento: row[5]?.toString() || "",
              dataLiquidacao,
              valor,
              valorLiquidacao: parseFloat(row[8]?.toString().replace(/\./g, "").replace(",", ".") || "0") || valor,
              situacao,
              nossoNumero: row[2]?.toString() || "",
            });
          }

          const pendingHonorarios = honorarios.filter(h => h.status === "pending");
          let matched = 0;
          const unmatched: string[] = [];

          for (const boleto of boletosLiquidados) {
            const honorario = pendingHonorarios.find(h => {
              const client = clients.find(c => c.id === h.client_id);
              if (!client) return false;

              const clientName = client.name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const pagadorName = boleto.pagador.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

              const nameMatch = clientName.substring(0, 20) === pagadorName.substring(0, 20) ||
                pagadorName.includes(clientName.substring(0, 15)) ||
                clientName.includes(pagadorName.substring(0, 15));

              const valorMatch = Math.abs(h.amount - boleto.valor) < 1;

              return nameMatch && valorMatch;
            });

            if (honorario) {
              const { error: updateError } = await supabase
                .from("invoices")
                .update({ status: "paid", payment_date: boleto.dataLiquidacao })
                .eq("id", honorario.id);

              if (!updateError) {
                if (bankAccountId) {
                  const client = clients.find(c => c.id === honorario.client_id);
                  await registrarRecebimento({
                    paymentId: `zebrinha_${honorario.id}_${boleto.dataLiquidacao}`,
                    invoiceId: honorario.id,
                    clientId: honorario.client_id,
                    clientName: client?.name || boleto.pagador,
                    amount: boleto.valorLiquidacao || honorario.amount,
                    paymentDate: boleto.dataLiquidacao,
                    bankAccountId: bankAccountId,
                    description: `Recebimento SICREDI - ${client?.name || boleto.pagador} - ${boleto.situacao}`,
                  });
                }

                matched++;
                const idx = pendingHonorarios.findIndex(h => h.id === honorario.id);
                if (idx > -1) pendingHonorarios.splice(idx, 1);
              }
            } else {
              unmatched.push(`${boleto.pagador} - R$ ${boleto.valor.toFixed(2)} (${boleto.dataLiquidacao})`);
            }
          }

          setImportResult({ matched, unmatched: unmatched.slice(0, 20) });

          if (matched > 0) {
            toast.success(`${matched} honorário(s) baixado(s) automaticamente!`);
            await loadData();
          } else {
            toast.info("Nenhum honorário foi baixado. Verifique se os clientes estão cadastrados corretamente.");
          }

          setLoading(false);
        } catch (parseError: any) {
          console.error("[Zebrinha] Parse error:", parseError);
          toast.error("Erro ao processar arquivo: " + parseError.message);
          setLoading(false);
        }
      };

      reader.readAsBinaryString(file);
    } catch (error: any) {
      console.error("[Zebrinha] Import error:", error);
      toast.error("Erro ao importar: " + getErrorMessage(error));
      setLoading(false);
    }

    e.target.value = "";
  };

  const handleOpenComposicaoManual = async () => {
    setLoading(true);
    try {
      const { data: transacoes, error } = await supabase
        .from("bank_transactions")
        .select("id, transaction_date, amount, description")
        .eq("transaction_type", "credit")
        .eq("matched", false)
        .gt("amount", 500)
        .order("transaction_date", { ascending: false })
        .limit(50);

      if (error) throw error;

      const consolidadas = (transacoes || []).filter(tx =>
        tx.description?.toUpperCase().includes("LIQ") ||
        tx.description?.toUpperCase().includes("COBRANCA") ||
        tx.amount > 2000
      );

      setTransacoesConsolidadas(consolidadas);
      setSelectedTransacao(null);
      setSelectedHonorariosIds([]);
      setShowComposicaoDialog(true);
    } catch (error: any) {
      toast.error("Erro ao carregar transações: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const toggleHonorarioSelection = (honorarioId: string) => {
    setSelectedHonorariosIds(prev =>
      prev.includes(honorarioId)
        ? prev.filter(id => id !== honorarioId)
        : [...prev, honorarioId]
    );
  };

  const totalSelecionado = honorarios
    .filter(h => selectedHonorariosIds.includes(h.id))
    .reduce((sum, h) => sum + h.amount, 0);

  const handleConfirmarComposicao = async () => {
    if (!selectedTransacao) {
      toast.error("Selecione uma transação consolidada");
      return;
    }

    if (selectedHonorariosIds.length === 0) {
      toast.error("Selecione pelo menos um honorário");
      return;
    }

    const diferenca = Math.abs(totalSelecionado - selectedTransacao.amount);
    if (diferenca > 10) {
      if (!confirm(`O total selecionado (${formatCurrency(totalSelecionado)}) difere do valor da transação (${formatCurrency(selectedTransacao.amount)}) em ${formatCurrency(diferenca)}. Deseja continuar mesmo assim?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      const paymentDate = selectedTransacao.transaction_date.split("T")[0];
      let baixados = 0;

      for (const honorarioId of selectedHonorariosIds) {
        const honorario = honorarios.find(h => h.id === honorarioId);
        if (!honorario) continue;

        const { error: updateError } = await supabase
          .from("invoices")
          .update({ status: "paid", payment_date: paymentDate })
          .eq("id", honorarioId);

        if (updateError) continue;

        if (bankAccountId) {
          const client = clients.find(c => c.id === honorario.client_id);
          await registrarRecebimento({
            paymentId: `composicao_${honorarioId}_${paymentDate}`,
            invoiceId: honorarioId,
            clientId: honorario.client_id,
            clientName: client?.name || "Cliente",
            amount: honorario.amount,
            paymentDate: paymentDate,
            bankAccountId: bankAccountId,
            description: `Composição manual LIQ.SIMPLES - ${client?.name}`,
          });
        }

        baixados++;
      }

      await supabase
        .from("bank_transactions")
        .update({
          matched: true,
          has_multiple_matches: true,
        })
        .eq("id", selectedTransacao.id);

      toast.success(`${baixados} honorário(s) baixado(s) com sucesso!`);
      setShowComposicaoDialog(false);
      await loadData();
    } catch (error: any) {
      toast.error("Erro ao processar composição: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (honorarioId: string) => {
    if (!confirm("Deletar este honorário? Isto vai remover os lançamentos contábeis também.")) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", honorarioId);

      if (error) throw new Error(getErrorMessage(error));

      toast.success("Honorário deletado!");
      await loadData();
    } catch (error: any) {
      toast.error("Erro ao deletar: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (honorario: HonorarioRecord) => {
    setEditingHonorario(honorario);
    setFormData({
      client_id: honorario.client_id,
      amount: honorario.amount.toString(),
      due_date: honorario.due_date,
      competence: honorario.competence,
      description: honorario.description || "",
    });
    setOpen(true);
  };

  const stats = {
    total: honorarios.length,
    pending: honorarios.filter(h => h.status === "pending").length,
    paid: honorarios.filter(h => h.status === "paid").length,
    totalAmount: honorarios.reduce((sum, h) => sum + h.amount, 0),
    pendingAmount: honorarios.filter(h => h.status === "pending").reduce((sum, h) => sum + h.amount, 0),
  };

  return (
    <Layout>
      <div className="space-y-6 px-1 sm:px-0 w-full max-w-[100vw] overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-7 w-7 sm:h-8 sm:w-8" />
              Fluxo de Honorários
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gerenciamento completo de honorários com lançamentos contábeis automáticos
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <label className="cursor-pointer w-full sm:w-auto">
              <input
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={handleImportZebrinha}
                disabled={loading}
              />
              <Button
                variant="default"
                disabled={loading}
                className="w-full sm:w-auto"
                asChild
                title="Importar relatório de boletos do SICREDI (Zebrinha) para baixar honorários"
              >
                <span>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Importar Zebrinha
                </span>
              </Button>
            </label>
            <Button
              variant="outline"
              onClick={handleSyncPayments}
              disabled={loading}
              className="w-full sm:w-auto"
              title="Sincronizar com transações bancárias (PIX) e baixar pagos"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar PIX
            </Button>
            <Button
              variant="outline"
              onClick={handleBaixarVencidos}
              disabled={loading}
              className="w-full sm:w-auto"
              title="Baixar todos os vencidos como pagos"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Vencidos
            </Button>
            <Button
              variant="secondary"
              onClick={handleOpenComposicaoManual}
              disabled={loading}
              className="w-full sm:w-auto"
              title="Compor manualmente valores consolidados (LIQ.SIMPLES)"
            >
              <Layers className="mr-2 h-4 w-4" />
              Composição Manual
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Honorário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-lg w-full">
                <DialogHeader>
                  <DialogTitle>
                    {editingHonorario ? "Editar Honorário" : "Novo Honorário"}
                  </DialogTitle>
                  <DialogDescription>
                    Centro de Custo: <strong>1. AMPLA</strong> | Regime: <strong>Competência</strong>
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="client">Cliente</Label>
                    <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="amount">Valor</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="competence">Competência (MM/YYYY)</Label>
                    <Input
                      id="competence"
                      placeholder="01/2025"
                      value={formData.competence}
                      onChange={(e) => setFormData({ ...formData, competence: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="due_date">Data de Vencimento</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Descrição (opcional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Descrição adicional..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Lançamento contábil (Competência): D: 1.1.2 | C: 3.1.1
                    </AlertDescription>
                  </Alert>

                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {editingHonorario ? "Atualizar" : "Criar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3 p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats.totalAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats.pendingAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Recebidos</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.paid}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatCurrency(stats.totalAmount - stats.pendingAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taxa Recebimento</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                {stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0}%
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 md:col-span-1 lg:col-span-1">
            <CardHeader className="pb-3 p-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Centro de Custo</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Badge variant="secondary">1. AMPLA</Badge>
            </CardContent>
          </Card>
        </div>

        {importResult && (
          <Alert className={importResult.matched > 0 ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <div className="flex flex-col gap-2">
                <div className="font-medium text-sm sm:text-base">
                  Importação concluída: {importResult.matched} honorário(s) baixado(s) automaticamente
                </div>
                {importResult.unmatched.length > 0 && (
                  <div className="text-sm">
                    <strong>Boletos sem match ({importResult.unmatched.length}):</strong>
                    <ul className="list-disc ml-4 mt-1 max-h-40 overflow-y-auto">
                      {importResult.unmatched.map((item, i) => (
                        <li key={i} className="text-xs text-muted-foreground">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  onClick={() => setImportResult(null)}
                >
                  Fechar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Honorários</CardTitle>
            <CardDescription>
              Lista completa de honorários com status e ações
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            ) : honorarios.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum honorário cadastrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Cliente</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="whitespace-nowrap">Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right min-w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {honorarios.map((honorario) => (
                      <TableRow key={honorario.id}>
                        <TableCell className="font-medium">{honorario.client_name}</TableCell>
                        <TableCell>{honorario.competence}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(honorario.amount)}</TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(honorario.due_date).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          {honorario.status === "paid" ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Pago
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1 sm:space-x-2 whitespace-nowrap">
                          {honorario.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePayment(honorario.id)}
                              disabled={loading}
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9 sm:px-3"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {honorario.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(honorario)}
                              disabled={loading}
                              className="h-8 w-8 p-0 sm:h-9 sm:w-9 sm:px-3"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(honorario.id)}
                            disabled={loading}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-9 sm:px-3"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-base">Regras Contábeis do Fluxo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <strong>Centro de Custo:</strong> 1. AMPLA (fixo para todos os honorários)
            </div>
            <div>
              <strong>Ao Criar Honorário (Competência):</strong>
              <div className="ml-4 mt-1">
                • Débito: 1.1.2 - Créditos a Receber<br />
                • Crédito: 3.1.1 - Receita de Honorários
              </div>
            </div>
            <div>
              <strong>Ao Marcar como Pago (Caixa):</strong>
              <div className="ml-4 mt-1">
                • Débito: SICREDI (conta bancária)<br />
                • Crédito: 1.1.2 - Créditos a Receber
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={showComposicaoDialog} onOpenChange={setShowComposicaoDialog}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Composição Manual de LIQ.SIMPLES
              </DialogTitle>
              <DialogDescription>
                Selecione uma transação consolidada e marque os honorários que compõem o valor
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-semibold">1. Selecione a transação consolidada:</Label>
                <ScrollArea className="h-[250px] sm:h-[300px] border rounded-md p-2">
                  {transacoesConsolidadas.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhuma transação consolidada encontrada
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transacoesConsolidadas.map((tx) => (
                        <div
                          key={tx.id}
                          className={`p-3 border rounded-md cursor-pointer transition-colors ${
                            selectedTransacao?.id === tx.id
                              ? "border-primary bg-primary/10"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => {
                            setSelectedTransacao(tx);
                            setSelectedHonorariosIds([]);
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <div className="text-sm font-medium truncate max-w-[200px]">
                              {tx.description}
                            </div>
                            <Badge variant="secondary" className="font-mono">
                              {formatCurrency(tx.amount)}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(tx.transaction_date).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {selectedTransacao && (
                  <Alert className="bg-primary/5 border-primary/20">
                    <AlertDescription>
                      <strong>Selecionado:</strong> {formatCurrency(selectedTransacao.amount)}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">2. Marque os honorários que compõem:</Label>
                <ScrollArea className="h-[250px] sm:h-[300px] border rounded-md p-2">
                  {honorarios.filter(h => h.status === "pending").length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhum honorário pendente
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {honorarios
                        .filter(h => h.status === "pending")
                        .map((honorario) => (
                          <div
                            key={honorario.id}
                            className={`p-2 border rounded-md cursor-pointer transition-colors flex items-center gap-2 ${
                              selectedHonorariosIds.includes(honorario.id)
                                ? "border-green-500 bg-green-50"
                                : "hover:bg-muted"
                            }`}
                            onClick={() => toggleHonorarioSelection(honorario.id)}
                          >
                            <Checkbox
                              checked={selectedHonorariosIds.includes(honorario.id)}
                              onCheckedChange={() => toggleHonorarioSelection(honorario.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {honorario.client_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {honorario.competence}
                              </div>
                            </div>
                            <Badge variant="outline" className="font-mono shrink-0">
                              {formatCurrency(honorario.amount)}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </ScrollArea>

                <Alert className={
                  selectedTransacao && Math.abs(totalSelecionado - selectedTransacao.amount) < 10
                    ? "bg-green-50 border-green-200"
                    : "bg-yellow-50 border-yellow-200"
                }>
                  <AlertDescription className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <div>
                      <strong>Total selecionado:</strong> {formatCurrency(totalSelecionado)}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({selectedHonorariosIds.length} honorário(s))
                      </span>
                    </div>
                    {selectedTransacao && (
                      <div className="text-sm">
                        Diferença:{" "}
                        <span className={
                          Math.abs(totalSelecionado - selectedTransacao.amount) < 10
                            ? "text-green-600 font-medium"
                            : "text-red-600 font-medium"
                        }>
                          {formatCurrency(Math.abs(totalSelecionado - selectedTransacao.amount))}
                        </span>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowComposicaoDialog(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarComposicao}
                disabled={loading || !selectedTransacao || selectedHonorariosIds.length === 0}
                className="w-full sm:w-auto"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Confirmar e Baixar ({selectedHonorariosIds.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default HonorariosFlow;