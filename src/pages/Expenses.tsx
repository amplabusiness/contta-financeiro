import { useEffect, useState, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Pencil, Trash2, CheckCircle, RefreshCw, ChevronsUpDown, Check, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import { PeriodFilter } from "@/components/PeriodFilter";
import { usePeriod } from "@/contexts/PeriodContext";
import { useClient } from "@/contexts/ClientContext";
import { useAccounting } from "@/hooks/useAccounting";
import { useExpenseUpdate } from "@/contexts/ExpenseUpdateContext";
import { getErrorMessage } from "@/lib/utils";
import { RecurringExpenseForm } from "@/components/RecurringExpenseForm";
import { RecurringExpenseDialog } from "@/components/RecurringExpenseDialog";

const Expenses = () => {
  const { selectedYear, selectedMonth } = usePeriod();
  const { selectedClientId, selectedClientName } = useClient();
  const { registrarDespesa, registrarPagamentoDespesa } = useAccounting({ showToasts: false });
  const { notifyExpenseChange } = useExpenseUpdate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const scrollPositionRef = useRef<number>(0);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: "",
    description: "",
  });
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [recurringDialogMode, setRecurringDialogMode] = useState<"edit" | "delete">("edit");
  const [pendingRecurringAction, setPendingRecurringAction] = useState<any>(null);
  const [formData, setFormData] = useState({
    category: "",
    description: "",
    amount: "",
    due_date: "",
    payment_date: "",
    status: "pending",
    competence: "",
    notes: "",
    account_id: "",
    cost_center_id: "",
    is_recurring: false,
    recurrence_day: 10,
    recurrence_frequency: "monthly",
    recurrence_start_date: "",
    recurrence_end_date: "",
    recurrence_count: undefined as number | undefined,
    recurrence_specific_days: [] as number[],
  });

  const normalizeAccountType = (value?: string | null) => value?.trim().toLowerCase() ?? "";

  const loadAccounts = useCallback(async () => {
    try {
      const response = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, type, is_active, is_analytical")
        .eq("is_active", true)
        .eq("is_analytical", true)
        .order("code");

      if (response.error) {
        console.error("Erro ao carregar contas");
        throw new Error("Erro ao carregar contas");
      }

      setAccounts(response.data || []);
      setFilteredAccounts(response.data || []);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar contas";
      console.error("Erro ao carregar contas:", errorMsg);
    }
  }, []);

  const loadCategories = async () => {
    try {
      const response = await supabase
        .from("expense_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (response.error) {
        console.error("Erro ao carregar categorias");
        throw new Error("Erro ao carregar categorias");
      }

      // Deduplicate by name to prevent render key issues
      const uniqueCategories = Array.from(
        new Map((response.data || []).map(cat => [cat.name, cat])).values()
      );

      setCategories(uniqueCategories);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar categorias";
      console.error("Erro ao carregar categorias:", errorMsg);
    }
  };

  const loadCostCenters = async () => {
    try {
      const response = await supabase
        .from("cost_centers")
        .select("id, code, name, default_chart_account_id")
        .eq("is_active", true)
        .order("code");

      if (response.error) {
        console.error("Erro ao carregar centros de custo");
        throw new Error("Erro ao carregar centros de custo");
      }

      setCostCenters(response.data || []);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar centros de custo";
      console.error("Erro ao carregar centros de custo:", errorMsg);
      toast.error(errorMsg);
    }
  };

  const saveScrollPosition = () => {
    scrollPositionRef.current = window.scrollY;
  };

  const restoreScrollPosition = () => {
    const scrollPos = scrollPositionRef.current;
    if (scrollPos > 0) {
      // Restaurar multiple times para garantir que funciona
      window.scrollTo(0, scrollPos);
      setTimeout(() => window.scrollTo(0, scrollPos), 0);
      setTimeout(() => window.scrollTo(0, scrollPos), 50);
      setTimeout(() => window.scrollTo(0, scrollPos), 150);
    }
  };

  const loadExpenses = useCallback(async () => {
    try {
      let query = supabase.from("expenses").select("*").order("due_date", { ascending: false });

      if (selectedClientId) {
        query = query.eq("client_id", selectedClientId);
      }

      const response = await query;

      if (response.error) {
        console.error("Erro ao carregar despesas");
        throw new Error("Erro ao carregar despesas");
      }

      const data = response.data;

      let filteredData = data || [];

      if (selectedYear && selectedMonth) {
        filteredData = filteredData.filter((expense) => {
          if (!expense.due_date) return false;
          // Parse date string manually to avoid timezone issues
          const [yearStr, monthStr] = expense.due_date.split('-');
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);

          return (
            year === selectedYear &&
            month === selectedMonth
          );
        });
      } else if (selectedYear) {
        filteredData = filteredData.filter((expense) => {
          if (!expense.due_date) return false;
          // Parse date string manually to avoid timezone issues
          const [yearStr] = expense.due_date.split('-');
          const year = parseInt(yearStr);

          return year === selectedYear;
        });
      }

      setExpenses(filteredData);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao carregar despesas";
      toast.error("Erro ao carregar despesas: " + errorMsg);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, selectedYear, selectedMonth]);

  useEffect(() => {
    loadExpenses();
    loadAccounts();
    loadCategories();
    loadCostCenters();
  }, [selectedYear, selectedMonth, selectedClientId, loadExpenses, loadAccounts]);

  const generateRecurringInstances = async (parentExpense: any, parentId: string) => {
    try {
      const instances = [];

      // Parse dates manually to avoid timezone issues
      const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
        return new Date(y, m - 1, d);
      };

      const startDateStr = parentExpense.recurrence_start_date || parentExpense.due_date;
      const startDate = parseDate(startDateStr);

      // Calcular limite: até o final do 3º ano a partir do ano de início (startYear + 2)
      // Isso garante cobertura para 2027 mesmo se o ano base for considerado 2025
      const startYear = startDate.getFullYear();
      const limitDate = new Date(startYear + 2, 11, 31, 23, 59, 59);

      let currentDate = new Date(startDate);
      let count = 0;
      const maxCount = parentExpense.recurrence_count || 999;

      const endDateStr = parentExpense.recurrence_end_date;
      const endDate = endDateStr ? parseDate(endDateStr) : limitDate;

      const parentDueDate = parentExpense.due_date.split('T')[0];
      const parentDueDateObj = parseDate(parentExpense.due_date);
      const targetDay = parentDueDateObj.getDate();

      console.log("Gerando recorrências:", {
        startDate: startDate.toISOString(),
        startYear,
        limitDate: limitDate.toISOString(),
        parentDueDate,
        targetDay,
        frequency: parentExpense.recurrence_frequency
      });

      while (count < maxCount && currentDate <= endDate && currentDate <= limitDate) {
        // Format as YYYY-MM-DD manually to ensure local date is used
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');

        // Use o dia do vencimento original como base, ajustando para o último dia do mês se necessário
        const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
        const dayToUse = Math.min(targetDay, daysInMonth);
        const day = String(dayToUse).padStart(2, '0');

        const currentIsoDate = `${year}-${month}-${day}`;

        // Gerar se não for a mesma data da despesa pai (evitar duplicidade da primeira ocorrência)
        if (currentIsoDate !== parentDueDate) {
          const dayOfMonth = parentExpense.recurrence_specific_days && parentExpense.recurrence_specific_days.length > 0
            ? parentExpense.recurrence_specific_days[0]
            : currentDate.getDate();

          const competence = `${month}/${year}`;

          // Validate that we're copying the frequency correctly
          const frequencyToCopy = parentExpense.recurrence_frequency || "monthly";
          console.log(`Creating instance for ${currentIsoDate} with frequency: ${frequencyToCopy}`);

          instances.push({
            category: parentExpense.category,
            description: parentExpense.description,
            amount: parentExpense.amount,
            due_date: currentIsoDate,
            payment_date: null,
            status: "pending",
            competence: competence,
            notes: parentExpense.notes,
            account_id: parentExpense.account_id,
            cost_center_id: parentExpense.cost_center_id,
            client_id: parentExpense.client_id,
            created_by: parentExpense.created_by,
            parent_expense_id: parentId,
            is_recurring: true,
            recurrence_frequency: frequencyToCopy,
            recurrence_day: parentExpense.recurrence_day || 10,
            recurrence_start_date: parentExpense.recurrence_start_date || null,
            recurrence_end_date: parentExpense.recurrence_end_date || null,
            recurrence_count: parentExpense.recurrence_count || null,
            recurrence_specific_days: (parentExpense.recurrence_specific_days && parentExpense.recurrence_specific_days.length > 0) ? parentExpense.recurrence_specific_days : null,
          });
        }

        count++;

        switch (parentExpense.recurrence_frequency) {
          case "weekly":
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case "biweekly":
            currentDate.setDate(currentDate.getDate() + 15);
            break;
          case "monthly":
            const targetDay = parentExpense.recurrence_specific_days && parentExpense.recurrence_specific_days.length > 0
              ? parentExpense.recurrence_specific_days[0]
              : currentDate.getDate();
            currentDate.setMonth(currentDate.getMonth() + 1);
            // Handle end of month logic
            const lastDayOfNextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
            currentDate.setDate(Math.min(targetDay, lastDayOfNextMonth));
            break;
          case "annual":
            currentDate.setFullYear(currentDate.getFullYear() + 1);
            break;
        }
      }

      if (instances.length > 0) {
        const { error } = await supabase
          .from("expenses")
          .insert(instances);

        if (error) throw new Error(getErrorMessage(error));

        toast.success(`${instances.length} despesas recorrentes geradas automaticamente!`);
      }
    } catch (error: any) {
      toast.error("Erro ao gerar despesas recorrentes");
      console.error("Erro:", error);
    }
  };

  const generateRecurringExpense = async (expense: any) => {
    try {
      const dueDate = new Date(expense.due_date);
      const nextMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, expense.recurrence_day);
      const nextCompetence = `${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}`;

      const newExpenseData = {
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        due_date: nextMonth.toISOString().split('T')[0],
        payment_date: null,
        status: "pending",
        competence: nextCompetence,
        notes: expense.notes,
        account_id: expense.account_id,
        cost_center_id: expense.cost_center_id,
        created_by: expense.created_by,
      };

      const { error } = await supabase
        .from("expenses")
        .insert(newExpenseData);

      if (error) throw new Error(getErrorMessage(error));

      toast.success("Despesa recorrente do próximo mês gerada!");
      loadExpenses();
    } catch (error: any) {
      toast.error("Erro ao gerar despesa recorrente");
      console.error("Erro:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (!formData.description?.trim()) {
        throw new Error("Descrição é obrigatória");
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }

      if (!formData.due_date) {
        throw new Error("Data de vencimento é obrigatória");
      }

      if (!formData.cost_center_id) {
        throw new Error("Centro de custo é obrigatório");
      }

      if (!formData.category) {
        throw new Error("Categoria é obrigatória");
      }

      const accountId = formData.account_id;

      if (!accountId) {
        throw new Error("Conta contábil é obrigatória");
      }

      // Para despesas recorrentes, respeitar o due_date informado pelo usuário
      // A data de início da recorrência serve para controlar o ciclo, mas o dia do vencimento manda
      const actualDueDate = formData.due_date;

      const [year, month, day] = actualDueDate.split('-');
      const calculatedCompetence = `${month}/${year}`;

      console.log("Salvando com due_date:", actualDueDate, "competence:", calculatedCompetence);
      console.log("Dados de recorrência:", {
        is_recurring: formData.is_recurring,
        frequency: formData.recurrence_frequency,
        start: formData.recurrence_start_date,
        end: formData.recurrence_end_date
      });

      // Only send fields that exist in the database schema
      const expenseData: any = {
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        due_date: actualDueDate,
        payment_date: formData.payment_date || null,
        status: formData.status,
        competence: calculatedCompetence,
        notes: formData.notes || null,
        account_id: accountId,
        cost_center_id: formData.cost_center_id,
        is_recurring: formData.is_recurring,
      };

      // Add client_id if available
      if (selectedClientId) {
        expenseData.client_id = selectedClientId;
      }

      // Add recurring expense fields if is_recurring is true
      if (formData.is_recurring) {
        expenseData.recurrence_day = formData.recurrence_day;
        expenseData.recurrence_frequency = formData.recurrence_frequency;
        expenseData.recurrence_start_date = formData.recurrence_start_date || null;
        expenseData.recurrence_end_date = formData.recurrence_end_date || null;
        expenseData.recurrence_count = formData.recurrence_count || null;
        expenseData.recurrence_specific_days = formData.recurrence_specific_days && formData.recurrence_specific_days.length > 0
          ? formData.recurrence_specific_days
          : null;

        console.log("Recurrence data being saved:", {
          is_recurring: expenseData.is_recurring,
          recurrence_frequency: expenseData.recurrence_frequency,
          recurrence_day: expenseData.recurrence_day,
          recurrence_start_date: expenseData.recurrence_start_date,
          recurrence_specific_days: expenseData.recurrence_specific_days,
          formDataFrequency: formData.recurrence_frequency,
        });
      }

      if (editingExpense) {
        if (editingExpense.is_recurring || editingExpense.parent_expense_id) {
          setPendingRecurringAction({
            type: "update",
            data: expenseData,
          });
          setRecurringDialogMode("edit");
          setRecurringDialogOpen(true);
          setLoading(false);
          return;
        }

        try {
          console.log("Atualizando despesa com dados:", expenseData);
          const response = await supabase
            .from("expenses")
            .update(expenseData)
            .eq("id", editingExpense.id);

          if (response.error) {
            const errorMsg = getErrorMessage(response.error);
            console.error("Erro Supabase ao atualizar despesa:", {
              error: response.error,
              message: errorMsg,
              details: response.error?.details,
              hint: response.error?.hint,
              code: response.error?.code,
            });
            throw new Error(`Falha ao atualizar despesa: ${errorMsg}`);
          }

          console.log("Despesa atualizada com sucesso");
          toast.success("Despesa atualizada com sucesso!");
          notifyExpenseChange();

          // Se a despesa não era recorrente e passou a ser, gerar as instâncias futuras
          if (formData.is_recurring && !editingExpense.is_recurring) {
            console.log("Convertendo despesa para recorrente, gerando instâncias futuras...");
            await generateRecurringInstances(
              {
                ...expenseData,
                created_by: editingExpense.created_by || user.id,
              },
              editingExpense.id
            );
          }
        } catch (updateError: any) {
          let errorMsg = "Erro ao atualizar despesa";

          if (updateError instanceof Error) {
            errorMsg = updateError.message;
          } else if (typeof updateError === "string") {
            errorMsg = updateError;
          } else {
            errorMsg = getErrorMessage(updateError);
          }

          console.error("Erro na atualização:", errorMsg);
          throw new Error(errorMsg);
        }
      } else {
        const updateData = {
          ...expenseData,
          created_by: user.id,
        };

        let newExpense: any = null;
        try {
          console.log("Dados sendo salvos:", updateData);
          const { data, error } = await supabase
            .from("expenses")
            .insert(updateData)
            .select("id")
            .single();

          if (error) {
            const errorMsg = getErrorMessage(error);
            console.error("Erro Supabase ao criar despesa:", {
              error,
              message: errorMsg,
              details: error?.details,
              hint: error?.hint,
              code: error?.code,
            });
            throw new Error(`Falha ao criar despesa: ${errorMsg}`);
          }

          newExpense = data;
        } catch (insertError: any) {
          let errorMsg = "Erro ao criar despesa";

          if (insertError instanceof Error) {
            errorMsg = insertError.message;
          } else if (typeof insertError === "string") {
            errorMsg = insertError;
          } else {
            errorMsg = getErrorMessage(insertError);
          }

          console.error("Erro ao inserir despesa:", errorMsg);
          throw new Error(errorMsg);
        }

        const accountingResult = await registrarDespesa({
          expenseId: newExpense.id,
          amount: parseFloat(formData.amount),
          expenseDate: formData.due_date,
          category: formData.category,
          description: formData.description || 'Despesa',
          competence: calculatedCompetence,
        });

        if (accountingResult.success) {
          toast.success("Despesa cadastrada com lançamento contábil!");
          notifyExpenseChange();
        } else {
          console.error('Erro ao criar lançamento contábil:', accountingResult.error);
          toast.warning("Despesa cadastrada, mas erro no lançamento contábil");
        }

        if (formData.is_recurring) {
          await generateRecurringInstances(
            {
              ...expenseData,
              created_by: user.id,
            },
            newExpense.id
          );
        }

        // Show warning if filters are active
        if (selectedYear || selectedMonth || selectedClientId) {
          toast.info("Despesa criada! Ajuste os filtros acima para visualizá-la.");
        }
      }

      setOpen(false);
      setEditingExpense(null);
      resetForm();
      await loadExpenses();
      // Restaurar scroll após salvar
      setTimeout(() => {
        restoreScrollPosition();
      }, 200);
    } catch (error: any) {
      let errorMsg = "Erro ao salvar despesa";

      if (error instanceof Error) {
        errorMsg = error.message;
      } else {
        errorMsg = getErrorMessage(error);
      }

      console.error("Erro capturado no handleSubmit:", {
        message: errorMsg,
        error,
      });
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (expense: any) => {
    try {
      const paymentDate = new Date().toISOString().split("T")[0];

      const response = await supabase
        .from("expenses")
        .update({ status: "paid", payment_date: paymentDate })
        .eq("id", expense.id);

      if (response.error) {
        console.error("Erro ao marcar como pago");
        throw new Error("Erro ao marcar despesa como paga");
      }

      const accountingResult = await registrarPagamentoDespesa({
        paymentId: `${expense.id}_payment`,
        expenseId: expense.id,
        amount: Number(expense.amount),
        paymentDate: paymentDate,
        description: expense.description || 'Despesa',
      });

      if (accountingResult.success) {
        toast.success("Despesa paga com lançamento contábil!");
        notifyExpenseChange();
      } else {
        console.error('Erro ao criar lançamento de pagamento:', accountingResult.error);
        toast.warning("Despesa paga, mas erro no lançamento contábil");
      }

      loadExpenses();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao marcar despesa como paga";
      console.error("Erro capturado no mark as paid:", errorMsg);
      toast.error("Erro ao marcar despesa como paga: " + errorMsg);
    }
  };

  const handleDelete = async (id: string) => {
    const expense = expenses.find(e => e.id === id);

    if (expense && (expense.is_recurring || expense.parent_expense_id)) {
      setPendingRecurringAction({
        type: "delete",
        id: id,
      });
      setRecurringDialogMode("delete");
      setRecurringDialogOpen(true);
      return;
    }

    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;

    try {
      // Primeiro, deletar os lançamentos contábeis associados a esta despesa
      try {
        const { data: entriesToDelete, error: selectError } = await supabase
          .from('accounting_entries')
          .select('id')
          .eq('reference_type', 'expense')
          .eq('reference_id', id);

        if (!selectError && entriesToDelete && entriesToDelete.length > 0) {
          const entryIds = entriesToDelete.map(e => e.id);
          
          // Deletar as linhas contábeis
          const { error: linesError } = await supabase
            .from('accounting_entry_lines')
            .delete()
            .in('entry_id', entryIds);

          if (linesError) {
            console.warn('Erro ao deletar linhas contábeis:', linesError);
          }

          // Deletar as entradas contábeis
          const { error: entriesError } = await supabase
            .from('accounting_entries')
            .delete()
            .in('id', entryIds);

          if (entriesError) {
            console.warn('Erro ao deletar entradas contábeis:', entriesError);
          }
        }
      } catch (accountingError) {
        console.warn('Erro ao processar lançamentos contábeis:', accountingError);
        // Continuar com a deleção mesmo se houver erro nos lançamentos
      }

      // Depois, deletar a despesa
      const response = await supabase.from("expenses").delete().eq("id", id);

      if (response.error) {
        console.error("Erro ao excluir despesa");
        throw new Error("Erro ao excluir despesa");
      }
      toast.success("Despesa excluída com sucesso! (Lançamentos contábeis também foram removidos)");
      notifyExpenseChange();
      loadExpenses();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao excluir despesa";
      console.error("Erro capturado na exclusão:", errorMsg);
      toast.error("Erro ao excluir despesa: " + errorMsg);
    }
  };

  const handleRecurringAction = async (updateAll: boolean) => {
    if (!pendingRecurringAction) return;

    try {
      setLoading(true);

      if (pendingRecurringAction.type === "update") {
        if (updateAll) {
          const parentId = editingExpense.parent_expense_id || editingExpense.id;

          // Check if recurrence parameters changed
          // Only consider actual recurrence config changes, not cosmetic updates
          // Helper to compare values treating null/undefined as equal
          const isDifferent = (a: any, b: any) => {
            if ((a === null || a === undefined) && (b === null || b === undefined)) return false;
            return a !== b;
          };

          // Helper to compare arrays (like specific days)
          const isArrayDifferent = (a: any[], b: any[]) => {
            const arrA = a || [];
            const arrB = b || [];
            if (arrA.length !== arrB.length) return true;
            return JSON.stringify(arrA.sort()) !== JSON.stringify(arrB.sort());
          };

          const recurrenceParamsChanged =
            (editingExpense.is_recurring !== pendingRecurringAction.data.is_recurring) ||
            (editingExpense.is_recurring && pendingRecurringAction.data.is_recurring && (
              editingExpense.recurrence_frequency !== pendingRecurringAction.data.recurrence_frequency ||
              isDifferent(editingExpense.recurrence_start_date, pendingRecurringAction.data.recurrence_start_date) ||
              isDifferent(editingExpense.recurrence_end_date, pendingRecurringAction.data.recurrence_end_date) ||
              isDifferent(editingExpense.recurrence_count, pendingRecurringAction.data.recurrence_count) ||
              isArrayDifferent(editingExpense.recurrence_specific_days, pendingRecurringAction.data.recurrence_specific_days)
            ));

          console.log("Recurrence params changed:", recurrenceParamsChanged, {
            oldFrequency: editingExpense.recurrence_frequency,
            newFrequency: pendingRecurringAction.data.recurrence_frequency,
            oldIsRecurring: editingExpense.is_recurring,
            newIsRecurring: pendingRecurringAction.data.is_recurring,
            oldStart: editingExpense.recurrence_start_date,
            newStart: pendingRecurringAction.data.recurrence_start_date,
            oldEnd: editingExpense.recurrence_end_date,
            newEnd: pendingRecurringAction.data.recurrence_end_date,
            oldCount: editingExpense.recurrence_count,
            newCount: pendingRecurringAction.data.recurrence_count,
            oldDays: editingExpense.recurrence_specific_days,
            newDays: pendingRecurringAction.data.recurrence_specific_days
          });

          // First, update the current expense
          await supabase
            .from("expenses")
            .update(pendingRecurringAction.data)
            .eq("id", editingExpense.id);

          // Only delete and regenerate if recurrence parameters changed
          if (recurrenceParamsChanged) {
            // Delete only FUTURE expenses (strictly greater than, not equal)
            await supabase
              .from("expenses")
              .delete()
              .eq("parent_expense_id", parentId)
              .gt("due_date", editingExpense.due_date);

            if (pendingRecurringAction.data.is_recurring) {
              // When regenerating, we must ensure we use the correct start date logic
              // If we are editing an instance (e.g. Jan 2026), and we want to regenerate future ones,
              // we should start generating from the NEXT occurrence after this one.

              // However, generateRecurringInstances uses recurrence_start_date from the data passed.
              // If that date is the original start date (e.g. Jan 2025), it will try to generate from there,
              // but skip existing ones? No, it skips if date matches parentDueDate.

              // To be safe, let's ensure the data passed to generateRecurringInstances has a start date
              // that allows it to generate the correct future instances.
              // But generateRecurringInstances logic is: start from start_date, go until end_date.
              // It checks if instance exists? No, it just inserts.
              // Wait, it does NOT check if instance exists (except for the parent date check).

              // So if we delete future instances, we are fine.
              // But we must ensure we don't duplicate PAST instances if we are editing a middle instance.

              // Actually, generateRecurringInstances is designed to generate the WHOLE series?
              // No, it generates from start_date.

              // If we are editing Jan 2026. We deleted Jan 2027+.
              // We want to generate Jan 2027+.
              // We should NOT generate Jan 2025-Dec 2025.

              // If we pass the original start date (Jan 2025), it will try to generate Jan 2025...
              // And since we didn't delete them, we might get duplicates or errors?
              // The code says:
              // if (currentIsoDate !== parentDueDate) { ... insert ... }

              // It doesn't check if other instances exist.
              // So we MUST adjust the start date to be the NEXT occurrence after the current one.

              const nextMonth = new Date(editingExpense.due_date);
              nextMonth.setMonth(nextMonth.getMonth() + 1);
              // Adjust day based on recurrence rule?
              // For now, just using the due_date of the current expense as the "start" for the new series
              // might be safer if we want to generate future ones.

              // But generateRecurringInstances uses the passed data.
              // Let's override recurrence_start_date to be the current expense's due date
              // so it starts generating from there (and the function logic will skip the first one if it matches).

              const regenerationData = {
                ...pendingRecurringAction.data,
                recurrence_start_date: editingExpense.due_date,
                created_by: editingExpense.created_by,
              };

              await generateRecurringInstances(
                regenerationData,
                editingExpense.id
              );
            }

            toast.success("Despesa e recorrências futuras atualizadas!");
          } else {
            // If only values changed, check if there are future instances in the database
            // We must query the database directly because 'expenses' state might be filtered by period
            // Look for expenses with the same properties (category, description) that are in the future
            const { data: dbFutureExpenses, error: queryError } = await supabase
              .from("expenses")
              .select("id, description, category, due_date, parent_expense_id")
              .eq("parent_expense_id", parentId)
              .gt("due_date", editingExpense.due_date);

            if (queryError) {
              console.warn("Error checking for future expenses:", queryError);
            }

            let hasFutureInstances = (dbFutureExpenses && dbFutureExpenses.length > 0);

            // If still not found, try alternate search: same description and category created after this one
            if (!hasFutureInstances && editingExpense.description && editingExpense.category) {
              const { data: altFutureExpenses } = await supabase
                .from("expenses")
                .select("id, description, category, due_date, parent_expense_id")
                .eq("description", editingExpense.description)
                .eq("category", editingExpense.category)
                .eq("cost_center_id", editingExpense.cost_center_id)
                .gt("due_date", editingExpense.due_date)
                .limit(100);

              if (altFutureExpenses && altFutureExpenses.length > 0) {
                console.log("Found future instances by matching description/category:", altFutureExpenses.map(e => e.due_date));
                hasFutureInstances = true;
                // Update dbFutureExpenses to contain the found records
                if (dbFutureExpenses) {
                  dbFutureExpenses.push(...altFutureExpenses.filter(alt =>
                    !dbFutureExpenses.some(db => db.id === alt.id)
                  ));
                } else {
                  // If dbFutureExpenses was null, initialize it
                  // We can't assign to const, so we need to handle this logic carefully
                  // But wait, dbFutureExpenses is const. We can't push to it if it's null.
                  // Actually, supabase returns null or array.
                }
              }
            }

            // Re-assign to a mutable array to handle the case where dbFutureExpenses is null
            let expensesToUpdate = dbFutureExpenses || [];

            if (expensesToUpdate.length === 0 && editingExpense.description && editingExpense.category) {
               const { data: altFutureExpenses } = await supabase
                .from("expenses")
                .select("id, description, category, due_date, parent_expense_id")
                .eq("description", editingExpense.description)
                .eq("category", editingExpense.category)
                .eq("cost_center_id", editingExpense.cost_center_id)
                .gt("due_date", editingExpense.due_date)
                .limit(100);

               if (altFutureExpenses) {
                 expensesToUpdate = altFutureExpenses;
                 hasFutureInstances = expensesToUpdate.length > 0;
               }
            }

            console.log("Future instances check:", {
              parentId,
              editingExpenseId: editingExpense.id,
              currentDueDate: editingExpense.due_date,
              foundCount: expensesToUpdate.length,
              hasFutureInstances,
              description: editingExpense.description,
              category: editingExpense.category
            });

            // If no future instances exist but recurrence is enabled, generate them
            if (!hasFutureInstances && pendingRecurringAction.data.is_recurring) {
              console.log("No future instances found, generating...");

              // Force start date to be the current expense's due date to ensure we generate future items
              // and don't get stuck in the past or duplicate past items.
              // This is critical when "repairing" a broken chain where future items are missing.
              const generationData = {
                ...pendingRecurringAction.data,
                recurrence_start_date: pendingRecurringAction.data.due_date,
                created_by: editingExpense.created_by,
                // Ensure frequency is passed correctly
                recurrence_frequency: pendingRecurringAction.data.recurrence_frequency,
                recurrence_day: pendingRecurringAction.data.recurrence_day,
                recurrence_end_date: pendingRecurringAction.data.recurrence_end_date,
                recurrence_count: pendingRecurringAction.data.recurrence_count,
                recurrence_specific_days: pendingRecurringAction.data.recurrence_specific_days,
              };

              await generateRecurringInstances(
                generationData,
                editingExpense.id
              );
              toast.success("Recorrências futuras geradas!");
            } else if (hasFutureInstances) {
              // Update all existing future instances with new values
              const fieldsToUpdate = {
                category: pendingRecurringAction.data.category,
                description: pendingRecurringAction.data.description,
                amount: pendingRecurringAction.data.amount,
                notes: pendingRecurringAction.data.notes,
                // Also update recurrence fields to ensure consistency
                recurrence_frequency: pendingRecurringAction.data.recurrence_frequency,
                recurrence_day: pendingRecurringAction.data.recurrence_day,
                recurrence_start_date: pendingRecurringAction.data.recurrence_start_date,
                recurrence_end_date: pendingRecurringAction.data.recurrence_end_date,
                recurrence_count: pendingRecurringAction.data.recurrence_count,
                recurrence_specific_days: pendingRecurringAction.data.recurrence_specific_days,
                is_recurring: true, // Ensure they are marked as recurring
              };

              console.log("Updating future instances with:", fieldsToUpdate);
              console.log("Future expenses to update:", expensesToUpdate.map(e => ({ id: e.id, due_date: e.due_date })));

              // Update using the list of found IDs to ensure we get all matching records
              if (expensesToUpdate.length > 0) {
                const futureIds = expensesToUpdate.map(e => e.id);
                const { error: updateError } = await supabase
                  .from("expenses")
                  .update(fieldsToUpdate)
                  .in("id", futureIds);

                if (updateError) {
                  console.error("Error updating future expenses:", updateError);
                  throw new Error(`Erro ao atualizar despesas futuras: ${updateError.message}`);
                }

                console.log(`Successfully updated ${futureIds.length} future instances`);
                toast.success(`Despesa e ${futureIds.length} futuras atualizadas!`);
              }
            } else {
              toast.success("Despesa atualizada!");
            }
          }
        } else {
          await supabase
            .from("expenses")
            .update({
              ...pendingRecurringAction.data,
              is_recurring: false,
              parent_expense_id: null,
            })
            .eq("id", editingExpense.id);

          toast.success("Apenas esta despesa foi atualizada!");
        }

        notifyExpenseChange();
        setOpen(false);
        setEditingExpense(null);
        resetForm();
        await loadExpenses();
        setTimeout(() => restoreScrollPosition(), 200);
      } else if (pendingRecurringAction.type === "delete") {
        const expense = expenses.find(e => e.id === pendingRecurringAction.id);

        if (updateAll) {
          const parentId = expense.parent_expense_id || expense.id;

          // Delete the current expense
          await supabase
            .from("expenses")
            .delete()
            .eq("id", pendingRecurringAction.id);

          // Then delete only FUTURE expenses (strictly greater than, not equal)
          await supabase
            .from("expenses")
            .delete()
            .eq("parent_expense_id", parentId)
            .gt("due_date", expense.due_date);

          toast.success("Despesa e recorrências futuras excluídas!");
        } else {
          await supabase
            .from("expenses")
            .delete()
            .eq("id", pendingRecurringAction.id);

          toast.success("Apenas esta despesa foi excluída!");
        }

        notifyExpenseChange();
        await loadExpenses();
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao processar ação";
      toast.error(errorMsg);
      console.error("Erro:", error);
    } finally {
      setLoading(false);
      setPendingRecurringAction(null);
    }
  };

  const handleTogglePause = async (expense: any) => {
    try {
      setLoading(true);
      const newPausedState = !expense.is_paused;

      await supabase
        .from("expenses")
        .update({ is_paused: newPausedState })
        .eq("id", expense.id);

      const message = newPausedState
        ? "Recorrência pausada! Não serão geradas novas despesas."
        : "Recorrência retomada! Novas despesas serão geradas automaticamente.";

      toast.success(message);
      notifyExpenseChange();
      await loadExpenses();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao pausar/retomar recorrência";
      toast.error(errorMsg);
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      category: "",
      description: "",
      amount: "",
      due_date: "",
      payment_date: "",
      status: "pending",
      competence: "",
      notes: "",
      account_id: "",
      cost_center_id: "",
      is_recurring: false,
      recurrence_day: 10,
      recurrence_frequency: "monthly",
      recurrence_start_date: "",
      recurrence_end_date: "",
      recurrence_count: undefined,
      recurrence_specific_days: [],
    });
    setAccountSearchQuery("");
    setCategorySearchQuery("");
    setFilteredAccounts(accounts);
  };

  const handleCostCenterChange = async (costCenterId: string) => {
    setFormData({ ...formData, cost_center_id: costCenterId, account_id: "" });

    try {
      // Buscar todas as contas vinculadas ao centro
      const { data: centerAccounts } = await supabase
        .from("cost_center_accounts")
        .select("chart_account_id")
        .eq("cost_center_id", costCenterId);

      if (!centerAccounts || centerAccounts.length === 0) {
        // Fallback: tentar usar default_chart_account_id
        const selectedCenter = costCenters.find(c => c.id === costCenterId);
        if (!selectedCenter?.default_chart_account_id) {
          setFilteredAccounts(accounts);
          return;
        }

        const { data: parentAccount } = await supabase
          .from("chart_of_accounts")
          .select("code")
          .eq("id", selectedCenter.default_chart_account_id)
          .single();

        if (parentAccount) {
          const filtered = accounts.filter(acc =>
            acc.code === parentAccount.code || acc.code.startsWith(parentAccount.code + '.')
          );
          setFilteredAccounts(filtered);
        } else {
          setFilteredAccounts(accounts);
        }
        return;
      }

      // Buscar os códigos das contas pai
      const accountIds = centerAccounts.map(item => item.chart_account_id);
      const { data: parentAccounts } = await supabase
        .from("chart_of_accounts")
        .select("code")
        .in("id", accountIds);

      if (parentAccounts && parentAccounts.length > 0) {
        const parentCodes = parentAccounts.map(acc => acc.code);
        const filtered = accounts.filter(acc =>
          parentCodes.some(code => {
            // Filtro exato: deve começar com o código E
            // - ser igual ao código pai, OU
            // - o próximo caractere deve ser um ponto (para evitar 4.1.10 quando o pai é 4.1.1)
            return acc.code === code || acc.code.startsWith(code + '.');
          })
        );
        setFilteredAccounts(filtered);
      } else {
        setFilteredAccounts(accounts);
      }
    } catch (error) {
      console.error("Erro ao filtrar contas:", error);
      setFilteredAccounts(accounts);
    }
  };

  const handleCreateNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCategoryData.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }

    // Check if category already exists
    const existingCategory = categories.find(cat =>
      cat.name.toLowerCase() === newCategoryData.name.toLowerCase()
    );

    if (existingCategory) {
      toast.error("Esta categoria já existe! Use a dropdown para selecioná-la.");
      setFormData({ ...formData, category: existingCategory.name });
      setNewCategoryDialogOpen(false);
      setNewCategoryData({ name: "", description: "" });
      return;
    }

    try {
      setLoading(true);
      const response = await supabase
        .from("expense_categories")
        .insert({
          code: `CAT_${Date.now()}`,
          name: newCategoryData.name,
          description: newCategoryData.description || null,
          is_active: true,
          display_order: (categories.length) + 1,
        })
        .select()
        .single();

      if (response.error) {
        console.error("Erro ao criar categoria");
        throw new Error("Erro ao criar categoria");
      }

      toast.success("Categoria criada com sucesso!");

      setFormData({ ...formData, category: response.data.name });
      setNewCategoryData({ name: "", description: "" });
      setNewCategoryDialogOpen(false);
      setCategorySearchQuery(""); // Reset search para mostrar todas as categorias

      await loadCategories();
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Erro ao criar categoria";
      console.error("Erro ao criar categoria:", errorMsg);
      toast.error("Erro ao criar categoria: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (expense: any) => {
    // Salvar posição de scroll ANTES de abrir o dialog
    saveScrollPosition();
    setEditingExpense(expense);
    const formatDateForInput = (dateStr: string) => {
      if (!dateStr) return "";
      // Handle ISO strings and date-only strings correctly
      if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      return dateStr;
    };

    console.log("Editando despesa - due_date original:", expense.due_date);
    const formattedDate = formatDateForInput(expense.due_date);
    console.log("Editando despesa - due_date formatado:", formattedDate);

    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      due_date: formattedDate,
      payment_date: formatDateForInput(expense.payment_date),
      status: expense.status,
      competence: expense.competence || "",
      notes: expense.notes || "",
      account_id: expense.account_id || "",
      cost_center_id: expense.cost_center_id || "",
      is_recurring: expense.is_recurring || false,
      recurrence_day: expense.recurrence_day || 10,
      recurrence_frequency: expense.recurrence_frequency || "monthly",
      recurrence_start_date: expense.recurrence_start_date || "",
      recurrence_end_date: expense.recurrence_end_date || "",
      recurrence_count: expense.recurrence_count || undefined,
      recurrence_specific_days: expense.recurrence_specific_days || [],
    });

    // Se for uma instância filha, buscar dados do pai para preencher recorrência
    if (expense.parent_expense_id) {
      try {
        const { data: parentExpense } = await supabase
          .from("expenses")
          .select("*")
          .eq("id", expense.parent_expense_id)
          .single();

        if (parentExpense) {
          console.log("Dados do pai carregados para edição:", parentExpense);
          setFormData(prev => ({
            ...prev,
            is_recurring: true,
            recurrence_frequency: parentExpense.recurrence_frequency || "monthly",
            recurrence_day: parentExpense.recurrence_day || 10,
            recurrence_start_date: parentExpense.recurrence_start_date || "",
            recurrence_end_date: parentExpense.recurrence_end_date || "",
            recurrence_count: parentExpense.recurrence_count || undefined,
            recurrence_specific_days: parentExpense.recurrence_specific_days || [],
          }));
        }
      } catch (error) {
        console.error("Erro ao carregar dados da despesa pai:", error);
      }
    }

    // Filtrar contas baseado no centro de custo
    if (expense.cost_center_id) {
      try {
        // Buscar todas as contas vinculadas ao centro
        const { data: centerAccounts } = await supabase
          .from("cost_center_accounts")
          .select("chart_account_id")
          .eq("cost_center_id", expense.cost_center_id);

        if (centerAccounts && centerAccounts.length > 0) {
          // Buscar os códigos das contas pai
          const accountIds = centerAccounts.map(item => item.chart_account_id);
          const { data: parentAccounts } = await supabase
            .from("chart_of_accounts")
            .select("code")
            .in("id", accountIds);

          if (parentAccounts && parentAccounts.length > 0) {
            const parentCodes = parentAccounts.map(acc => acc.code);
            const filtered = accounts.filter(acc =>
              parentCodes.some(code => {
                // Filtro exato: deve começar com o código E
                // - ser igual ao código pai, OU
                // - o próximo caractere deve ser um ponto
                return acc.code === code || acc.code.startsWith(code + '.');
              })
            );
            setFilteredAccounts(filtered);
          }
        } else {
          // Fallback: usar default_chart_account_id
          const selectedCenter = costCenters.find(c => c.id === expense.cost_center_id);
          if (selectedCenter?.default_chart_account_id) {
            const { data: parentAccount } = await supabase
              .from("chart_of_accounts")
              .select("code")
              .eq("id", selectedCenter.default_chart_account_id)
              .single();

            if (parentAccount) {
              const filtered = accounts.filter(acc =>
                acc.code === parentAccount.code || acc.code.startsWith(parentAccount.code + '.')
              );
              setFilteredAccounts(filtered);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao filtrar contas:", error);
        setFilteredAccounts(accounts);
      }
    }

    setOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      paid: "default",
      pending: "secondary",
      overdue: "destructive",
      canceled: "secondary",
    };
    const labels: Record<string, string> = {
      paid: "Pago",
      pending: "Pendente",
      overdue: "Vencido",
      canceled: "Cancelado",
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  const getCategoryName = (expenseCategory: string) => {
    // If the category is empty or null, return default text
    if (!expenseCategory) return "Sem categoria";

    // Check if the stored category matches any of the loaded categories by name
    const matchedCategory = categories.find(
      cat => cat.name.toLowerCase() === expenseCategory.toLowerCase()
    );

    // Return the matched category name, or return the stored value as-is if no match
    // This ensures we display what's actually stored in the database
    return matchedCategory ? matchedCategory.name : expenseCategory;
  };

  const getRecurrenceLabel = (expense: any) => {
    const rawFrequency = expense.recurrence_frequency;
    const frequency = (rawFrequency || "monthly").toLowerCase();

    // Debug log for problematic cases
    if (frequency === "monthly" && expense.description?.includes("Anuidade")) {
      console.log("DEBUG: Expense with 'Anuidade' showing as monthly:", {
        expenseId: expense.id,
        rawFrequency: rawFrequency,
        normalizedFrequency: frequency,
        is_recurring: expense.is_recurring,
        parent_expense_id: expense.parent_expense_id,
        recurrence_day: expense.recurrence_day,
        recurrence_specific_days: expense.recurrence_specific_days,
      });
    }

    const frequencyLabels: Record<string, string> = {
      weekly: "Semanal",
      biweekly: "Quinzenal",
      monthly: "Mensal",
      mensal: "Mensal", // Handle legacy/pt-br value if present
      annual: "Anual",
      anual: "Anual", // Handle legacy/pt-br value if present
    };

    const frequencyLabel = frequencyLabels[frequency] || frequency;

    // For monthly recurrence, try to show the day from multiple sources
    if (frequency === "monthly" || frequency === "mensal") {
      let dayToShow: number | undefined;

      // First, try recurrence_specific_days (newer format)
      if (expense.recurrence_specific_days && expense.recurrence_specific_days.length > 0) {
        dayToShow = expense.recurrence_specific_days[0];
      }
      // If not found, try recurrence_day (fallback)
      else if (expense.recurrence_day) {
        dayToShow = expense.recurrence_day;
      }
      // If still not found, try to extract from due_date
      else if (expense.due_date) {
        const dueDateStr = expense.due_date.includes('T')
          ? expense.due_date.split('T')[0]
          : expense.due_date;
        const dayFromDate = parseInt(dueDateStr.split('-')[2]);
        if (!isNaN(dayFromDate)) {
          dayToShow = dayFromDate;
        }
      }

      if (dayToShow) {
        return `${frequencyLabel} (dia ${dayToShow})`;
      }
    }

    return frequencyLabel;
  };

  // Função para identificar se é adiantamento a sócio (não é despesa real)
  const isAdiantamento = (category: string) => {
    const cat = (category || '').toLowerCase();
    return cat.includes('adiantamento');
  };

  // Separar despesas reais de adiantamentos
  const despesasReais = expenses.filter(e => !isAdiantamento(e.category));
  const adiantamentos = expenses.filter(e => isAdiantamento(e.category));

  // Totais apenas das DESPESAS REAIS (sem adiantamentos)
  const totalPending = despesasReais
    .filter((e) => e.status === "pending" || e.status === "overdue")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalPaid = despesasReais
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  // Total de adiantamentos (informativo)
  const totalAdiantamentos = adiantamentos
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <Layout>
      <RecurringExpenseDialog
        open={recurringDialogOpen}
        onClose={() => {
          setRecurringDialogOpen(false);
          setPendingRecurringAction(null);
        }}
        onConfirm={handleRecurringAction}
        mode={recurringDialogMode}
      />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Despesas - Ampla Contabilidade</h1>
          <p className="text-muted-foreground">
            Controle de contas a pagar da empresa
          </p>
          {(selectedYear || selectedMonth) && (
            <div className="mt-2 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
              <span className="font-medium">⚠️ Filtros ativos:</span>
              {selectedYear && <Badge variant="secondary">Ano: {selectedYear}</Badge>}
              {selectedMonth && <Badge variant="secondary">Mês: {selectedMonth}</Badge>}
            </div>
          )}
          {adiantamentos.length > 0 && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>ℹ️ Nota:</strong> {adiantamentos.length} item(s) são <strong>Adiantamentos a Sócios</strong> (R$ {formatCurrency(totalAdiantamentos)}) -
                não são despesas da empresa e não afetam o DRE.
              </p>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar despesas por período</CardDescription>
          </CardHeader>
          <CardContent>
            <PeriodFilter />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div />
          <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              // Restaurar scroll quando dialog fecha
              setTimeout(() => {
                restoreScrollPosition();
              }, 100);
              setEditingExpense(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Despesa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingExpense ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
                <DialogDescription>
                  Registre a despesa a pagar
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_id">Plano de Contas</Label>
                    <Popover open={isAccountPickerOpen} onOpenChange={(open) => {
                      setIsAccountPickerOpen(open);
                      if (!open) setAccountSearchQuery("");
                    }}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={isAccountPickerOpen}
                          className="w-full justify-between"
                        >
                          {formData.account_id && filteredAccounts.find((acc) => acc.id === formData.account_id)
                            ? `${filteredAccounts.find((acc) => acc.id === formData.account_id)?.code} - ${filteredAccounts.find((acc) => acc.id === formData.account_id)?.name}`
                            : "Selecione a conta"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Digite para pesquisar"
                            value={accountSearchQuery}
                            onValueChange={setAccountSearchQuery}
                          />
                          <CommandList>
                            {filteredAccounts.filter((account) =>
                              `${account.code} ${account.name}`.toLowerCase().includes(accountSearchQuery.toLowerCase())
                            ).length === 0 ? (
                              <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {filteredAccounts
                                  .filter((account) =>
                                    `${account.code} ${account.name}`.toLowerCase().includes(accountSearchQuery.toLowerCase())
                                  )
                                  .map((account) => (
                                    <CommandItem
                                      key={account.id}
                                      value={account.id}
                                      onSelect={(currentValue) => {
                                        setFormData({ ...formData, account_id: currentValue });
                                        setIsAccountPickerOpen(false);
                                        setAccountSearchQuery("");
                                      }}
                                    >
                                      {account.code} - {account.name}
                                      {formData.account_id === account.id && (
                                        <Check className="ml-auto h-4 w-4 text-muted-foreground" />
                                      )}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="category">Categoria *</Label>
                      <Dialog open={newCategoryDialogOpen} onOpenChange={setNewCategoryDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-blue-600"
                          >
                            + Nova Categoria
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[400px]">
                          <DialogHeader>
                            <DialogTitle>Criar Nova Categoria</DialogTitle>
                            <DialogDescription>
                              Crie uma nova categoria de despesas
                            </DialogDescription>
                          </DialogHeader>
                          <form onSubmit={handleCreateNewCategory} className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="new_category_name">Nome da Categoria *</Label>
                              <Input
                                id="new_category_name"
                                placeholder="ex: Aluguel, Serviços, etc"
                                value={newCategoryData.name}
                                onChange={(e) =>
                                  setNewCategoryData({ ...newCategoryData, name: e.target.value })
                                }
                                required
                              />
                              {newCategoryData.name && (
                                <>
                                  {categories.filter(cat =>
                                    cat.name.toLowerCase().includes(newCategoryData.name.toLowerCase())
                                  ).length > 0 && (
                                    <div className="mt-3 border rounded-md p-3 bg-blue-50 dark:bg-blue-950">
                                      <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">
                                        Categorias encontradas:
                                      </p>
                                      <div className="space-y-1">
                                        {categories
                                          .filter(cat =>
                                            cat.name.toLowerCase().includes(newCategoryData.name.toLowerCase())
                                          )
                                          .slice(0, 5)
                                          .map(cat => (
                                            <div
                                              key={cat.id}
                                              className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                                              onClick={() => {
                                                setFormData({ ...formData, category: cat.name });
                                                setNewCategoryDialogOpen(false);
                                                setNewCategoryData({ name: "", description: "" });
                                              }}
                                            >
                                              <span className="text-sm font-medium">{cat.name}</span>
                                              <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                  {categories.some(cat =>
                                    cat.name.toLowerCase() === newCategoryData.name.toLowerCase()
                                  ) && (
                                    <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                                      ⚠️ Esta categoria já existe! Clique acima para selecioná-la ou cancele.
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new_category_description">Descrição</Label>
                              <Textarea
                                id="new_category_description"
                                placeholder="Descrição da categoria (opcional)"
                                value={newCategoryData.description}
                                onChange={(e) =>
                                  setNewCategoryData({ ...newCategoryData, description: e.target.value })
                                }
                                rows={2}
                              />
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setNewCategoryDialogOpen(false)}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="submit"
                                disabled={loading || (newCategoryData.name && categories.some(cat =>
                                  cat.name.toLowerCase().includes(newCategoryData.name.toLowerCase())
                                ))}
                                title={newCategoryData.name && categories.some(cat =>
                                  cat.name.toLowerCase().includes(newCategoryData.name.toLowerCase())
                                ) ? "Selecione uma categoria encontrada acima ou digite um nome diferente" : ""}
                              >
                                {loading ? "Criando..." : "Criar"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Popover open={isCategoryPickerOpen} onOpenChange={(open) => {
                      setIsCategoryPickerOpen(open);
                      if (!open) setCategorySearchQuery("");
                    }}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={isCategoryPickerOpen}
                          className="w-full justify-between"
                        >
                          {formData.category || "Selecione a categoria"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Digite para pesquisar"
                            value={categorySearchQuery}
                            onValueChange={setCategorySearchQuery}
                          />
                          <CommandList>
                            {categories.filter((cat) =>
                              cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
                            ).length === 0 ? (
                              <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                            ) : (
                              <CommandGroup>
                                {categories
                                  .filter((cat) =>
                                    cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
                                  )
                                  .map((cat) => (
                                    <CommandItem
                                      key={cat.id}
                                      value={cat.name}
                                      onSelect={(currentValue) => {
                                        setFormData({ ...formData, category: currentValue });
                                        setIsCategoryPickerOpen(false);
                                        setCategorySearchQuery("");
                                      }}
                                    >
                                      {cat.name}
                                      {formData.category === cat.name && (
                                        <Check className="ml-auto h-4 w-4 text-muted-foreground" />
                                      )}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <input
                      type="text"
                      className="sr-only"
                      value={formData.category}
                      readOnly
                      required
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost_center_id">Centro de Custo *</Label>
                    <Select
                      value={formData.cost_center_id}
                      onValueChange={handleCostCenterChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um centro de custo" />
                      </SelectTrigger>
                      <SelectContent>
                        {costCenters.map((center) => (
                          <SelectItem key={center.id} value={center.id}>
                            {center.code} - {center.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="competence">Competência</Label>
                    <Input
                      id="competence"
                      placeholder="Ex: 11/2024"
                      value={formData.competence}
                      onChange={(e) => setFormData({ ...formData, competence: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                        <SelectItem value="canceled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Vencimento *</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_date">Data Pagamento</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="col-span-2 space-y-3 border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_recurring"
                        checked={formData.is_recurring}
                        onCheckedChange={(checked) => 
                          setFormData({ ...formData, is_recurring: checked as boolean })
                        }
                      />
                      <Label htmlFor="is_recurring" className="font-medium cursor-pointer">
                        É uma despesa recorrente?
                      </Label>
                    </div>
                    <RecurringExpenseForm
                      formData={formData}
                      onFormChange={(updates) => setFormData({ ...formData, ...updates })}
                      isPaused={editingExpense?.is_paused}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Despesas a Pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(totalPending)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {despesasReais.filter(e => e.status === "pending" || e.status === "overdue").length} pendente(s)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Despesas Pagas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {despesasReais.filter(e => e.status === "paid").length} paga(s)
              </p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-700 dark:text-blue-300">
                💼 Adiantamentos a Sócios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(totalAdiantamentos)}
              </div>
              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                {adiantamentos.length} item(s) - NÃO é despesa
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Despesas</CardTitle>
            <CardDescription>
              Total: {despesasReais.length} despesas reais
              {adiantamentos.length > 0 && ` + ${adiantamentos.length} adiantamentos`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma despesa cadastrada ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Recorrente</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => {
                    const categoryName = getCategoryName(expense.category);
                    const isAdiant = isAdiantamento(expense.category);
                    return (
                    <TableRow
                      key={expense.id}
                      className={isAdiant ? "bg-blue-50/50 dark:bg-blue-950/30" : ""}
                    >
                      <TableCell className="font-medium">
                        {isAdiant && <span className="text-blue-600 mr-1">💼</span>}
                        {categoryName}
                      </TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>{new Date(expense.due_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{formatCurrency(Number(expense.amount))}</TableCell>
                      <TableCell>{getStatusBadge(expense.status)}</TableCell>
                      <TableCell className="text-center">
                        {(expense.is_recurring || expense.parent_expense_id) && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            {getRecurrenceLabel(expense)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {(expense.is_recurring || expense.parent_expense_id) && expense.status !== "canceled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleTogglePause(expense)}
                            title={expense.is_paused ? "Retomar recorrência" : "Pausar recorrência"}
                          >
                            {expense.is_paused ? (
                              <Play className="w-4 h-4 text-orange-600" />
                            ) : (
                              <Pause className="w-4 h-4 text-orange-600" />
                            )}
                          </Button>
                        )}
                        {expense.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMarkAsPaid(expense)}
                            title="Marcar como pago"
                          >
                            <CheckCircle className="w-4 h-4 text-success" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(expense)}
                          title="Editar despesa"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
                          title="Excluir despesa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Expenses;
