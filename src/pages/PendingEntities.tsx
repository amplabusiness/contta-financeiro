import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Brain,
  HelpCircle,
  Users,
  Building2,
  User,
  CheckCircle2,
  XCircle,
  SkipForward,
  Loader2,
  Search,
  MessageCircle,
  Sparkles,
  Clock,
  AlertTriangle,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Target,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/data/expensesData";

interface PendingQuestion {
  id: string;
  bank_transaction_id: string | null;
  import_id: string | null;
  description: string;
  amount: number;
  transaction_type: string;
  transaction_date: string;
  question_type: string;
  question_text: string;
  ai_suggestion: string | null;
  ai_confidence: number | null;
  options: any;
  status: string;
  priority: number;
  created_at: string;
}

interface KnownEntity {
  id: string;
  name_pattern: string;
  normalized_pattern: string;
  entity_type: string;
  display_name: string;
  document: string | null;
  relationship: string | null;
  notes: string | null;
  usage_count: number;
  last_used_at: string;
  created_at: string;
}

interface ClassificationPattern {
  id: string;
  transaction_pattern: string;
  pattern_type: string;
  category: string;
  subcategory: string | null;
  debit_account_code: string;
  credit_account_code: string;
  entity_id: string | null;
  transaction_type: string | null;
  confidence: number;
  source: string;
  priority: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

const ENTITY_TYPES = [
  { value: "partner", label: "Socio/Proprietario", icon: User },
  { value: "employee", label: "Funcionario", icon: Users },
  { value: "supplier", label: "Fornecedor", icon: Building2 },
  { value: "client", label: "Cliente", icon: Target },
  { value: "company", label: "Empresa", icon: Building2 },
  { value: "person", label: "Pessoa Fisica", icon: User },
  { value: "other", label: "Outro", icon: HelpCircle },
];

const QUESTION_TYPES = {
  who_is: { label: "Quem e?", icon: User, color: "bg-blue-100 text-blue-800" },
  what_is: { label: "O que e?", icon: HelpCircle, color: "bg-purple-100 text-purple-800" },
  category: { label: "Categoria", icon: Target, color: "bg-green-100 text-green-800" },
  account: { label: "Conta", icon: TrendingUp, color: "bg-orange-100 text-orange-800" },
  confirm: { label: "Confirmar", icon: CheckCircle2, color: "bg-gray-100 text-gray-800" },
};

const TRANSACTION_CATEGORIES = {
  DEBIT: [
    { value: "supplier_payment", label: "Pagamento a Fornecedor" },
    { value: "partner_withdrawal", label: "Retirada de Socio" },
    { value: "salary", label: "Salario/Pagamento Funcionario" },
    { value: "tax", label: "Impostos e Taxas" },
    { value: "rent", label: "Aluguel" },
    { value: "utility", label: "Conta de Consumo (Luz, Agua, etc)" },
    { value: "service", label: "Servico Contratado" },
    { value: "bank_fee", label: "Tarifa Bancaria" },
    { value: "transfer", label: "Transferencia entre Contas" },
    { value: "personal", label: "Despesa Pessoal" },
    { value: "other_expense", label: "Outra Despesa" },
  ],
  CREDIT: [
    { value: "client_payment", label: "Recebimento de Cliente" },
    { value: "partner_contribution", label: "Aporte de Socio" },
    { value: "service_revenue", label: "Receita de Servicos" },
    { value: "refund", label: "Reembolso/Estorno" },
    { value: "transfer", label: "Transferencia entre Contas" },
    { value: "other_revenue", label: "Outra Receita" },
  ],
};

const PendingEntities = () => {
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [knownEntities, setKnownEntities] = useState<KnownEntity[]>([]);
  const [patterns, setPatterns] = useState<ClassificationPattern[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Answer dialog state
  const [answerDialog, setAnswerDialog] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<PendingQuestion | null>(null);
  const [answerForm, setAnswerForm] = useState({
    entityName: "",
    entityType: "",
    relationship: "",
    category: "",
    debitAccount: "",
    creditAccount: "",
    notes: "",
    saveAsPattern: true,
  });

  // Entity CRUD state
  const [entityDialog, setEntityDialog] = useState(false);
  const [editingEntity, setEditingEntity] = useState<KnownEntity | null>(null);
  const [entityForm, setEntityForm] = useState({
    name_pattern: "",
    display_name: "",
    entity_type: "other",
    document: "",
    relationship: "",
    notes: "",
  });
  const [deleteEntityDialog, setDeleteEntityDialog] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<KnownEntity | null>(null);

  // Pattern CRUD state
  const [patternDialog, setPatternDialog] = useState(false);
  const [editingPattern, setEditingPattern] = useState<ClassificationPattern | null>(null);
  const [patternForm, setPatternForm] = useState({
    transaction_pattern: "",
    pattern_type: "contains",
    category: "",
    debit_account_code: "",
    credit_account_code: "",
    transaction_type: "ANY",
    priority: 100,
  });
  const [deletePatternDialog, setDeletePatternDialog] = useState(false);
  const [patternToDelete, setPatternToDelete] = useState<ClassificationPattern | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load pending questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("ai_pending_questions")
        .select("*")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if (questionsError) throw questionsError;
      setPendingQuestions(questionsData || []);

      // Load known entities
      const { data: entitiesData, error: entitiesError } = await supabase
        .from("ai_known_entities")
        .select("*")
        .order("usage_count", { ascending: false })
        .limit(100);

      if (entitiesError) throw entitiesError;
      setKnownEntities(entitiesData || []);

      // Load patterns
      const { data: patternsData, error: patternsError } = await supabase
        .from("ai_classification_patterns")
        .select("*")
        .order("priority", { ascending: false })
        .order("usage_count", { ascending: false })
        .limit(100);

      if (patternsError) throw patternsError;
      setPatterns(patternsData || []);

      // Load chart of accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, type")
        .eq("is_active", true)
        .order("code");

      if (accountsError) throw accountsError;
      setChartAccounts(accountsData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // ========== ANSWER QUESTION ==========
  const openAnswerDialog = (question: PendingQuestion) => {
    setSelectedQuestion(question);
    setAnswerForm({
      entityName: extractPossibleName(question.description),
      entityType: "",
      relationship: "",
      category: "",
      debitAccount: "",
      creditAccount: "",
      notes: "",
      saveAsPattern: true,
    });
    setAnswerDialog(true);
  };

  const extractPossibleName = (description: string): string => {
    const patterns = [
      /PIX\s+(?:TRANSF|RECEBIDO|ENVIADO|PAGAMENTO)\s*-?\s*(.+)/i,
      /TED\s+(?:RECEBIDA|ENVIADA)\s*-?\s*(.+)/i,
      /PAGAMENTO\s+(?:PIX|TED)\s*-?\s*(.+)/i,
      /TRANSFERENCIA\s*-?\s*(.+)/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return description;
  };

  const handleAnswerQuestion = async () => {
    if (!selectedQuestion) return;

    const needsCategory = selectedQuestion.question_type === "category" || selectedQuestion.question_type === "what_is";
    const needsEntity = selectedQuestion.question_type === "who_is";

    if (needsCategory && (!answerForm.category || !answerForm.debitAccount || !answerForm.creditAccount)) {
      toast.error("Preencha categoria e contas contabeis");
      return;
    }

    if (needsEntity && !answerForm.entityName) {
      toast.error("Preencha o nome da entidade");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      let entityId = null;

      // Create entity if needed
      if (answerForm.entityName && answerForm.saveAsPattern) {
        const normalizedName = answerForm.entityName.toUpperCase().replace(/[^A-Z0-9\s]/g, "").trim();

        // Check if entity already exists
        const { data: existingEntity } = await supabase
          .from("ai_known_entities")
          .select("id")
          .eq("normalized_pattern", normalizedName)
          .maybeSingle();

        if (existingEntity) {
          entityId = existingEntity.id;
        } else {
          const { data: newEntity, error: entityError } = await supabase
            .from("ai_known_entities")
            .insert({
              name_pattern: answerForm.entityName,
              normalized_pattern: normalizedName,
              entity_type: answerForm.entityType || "other",
              display_name: answerForm.entityName,
              relationship: answerForm.relationship || null,
              notes: answerForm.notes || null,
              created_by: userData?.user?.id,
            })
            .select("id")
            .single();

          if (entityError) throw entityError;
          entityId = newEntity.id;
        }
      }

      // Create pattern if requested
      if (answerForm.saveAsPattern && answerForm.category && answerForm.debitAccount && answerForm.creditAccount) {
        const { error: patternError } = await supabase.from("ai_classification_patterns").insert({
          transaction_pattern: extractPossibleName(selectedQuestion.description),
          pattern_type: "contains",
          category: answerForm.category,
          debit_account_code: answerForm.debitAccount,
          credit_account_code: answerForm.creditAccount,
          entity_id: entityId,
          transaction_type: selectedQuestion.transaction_type,
          confidence: 1.0,
          source: "human",
          priority: 100,
          created_by: userData?.user?.id,
        });

        if (patternError) throw patternError;
      }

      // Update question status
      const { error: updateError } = await supabase
        .from("ai_pending_questions")
        .update({
          status: "answered",
          answer: JSON.stringify(answerForm),
          answer_details: answerForm,
          answered_by: userData?.user?.id,
          answered_at: new Date().toISOString(),
        })
        .eq("id", selectedQuestion.id);

      if (updateError) throw updateError;

      toast.success("Pergunta respondida!", {
        description: answerForm.saveAsPattern ? "Padrao salvo para uso futuro" : "Resposta registrada",
      });

      setAnswerDialog(false);
      setSelectedQuestion(null);
      loadData();
    } catch (error: any) {
      console.error("Error answering question:", error);
      toast.error("Erro ao responder", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipQuestion = async (question: PendingQuestion) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("ai_pending_questions")
        .update({ status: "skipped" })
        .eq("id", question.id);

      if (error) throw error;

      toast.success("Pergunta pulada");
      loadData();
    } catch (error: any) {
      console.error("Error skipping question:", error);
      toast.error("Erro ao pular pergunta", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ========== ENTITY CRUD ==========
  const resetEntityForm = () => {
    setEntityForm({
      name_pattern: "",
      display_name: "",
      entity_type: "other",
      document: "",
      relationship: "",
      notes: "",
    });
    setEditingEntity(null);
  };

  const openCreateEntity = () => {
    resetEntityForm();
    setEntityDialog(true);
  };

  const openEditEntity = (entity: KnownEntity) => {
    setEditingEntity(entity);
    setEntityForm({
      name_pattern: entity.name_pattern,
      display_name: entity.display_name,
      entity_type: entity.entity_type,
      document: entity.document || "",
      relationship: entity.relationship || "",
      notes: entity.notes || "",
    });
    setEntityDialog(true);
  };

  const handleSaveEntity = async () => {
    if (!entityForm.name_pattern.trim() || !entityForm.display_name.trim()) {
      toast.error("Nome e nome de exibicao sao obrigatorios");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const normalizedPattern = entityForm.name_pattern.toUpperCase().replace(/[^A-Z0-9\s]/g, "").trim();

      if (editingEntity) {
        const { error } = await supabase
          .from("ai_known_entities")
          .update({
            name_pattern: entityForm.name_pattern,
            normalized_pattern: normalizedPattern,
            display_name: entityForm.display_name,
            entity_type: entityForm.entity_type,
            document: entityForm.document || null,
            relationship: entityForm.relationship || null,
            notes: entityForm.notes || null,
          })
          .eq("id", editingEntity.id);

        if (error) throw error;
        toast.success("Entidade atualizada!");
      } else {
        const { error } = await supabase.from("ai_known_entities").insert({
          name_pattern: entityForm.name_pattern,
          normalized_pattern: normalizedPattern,
          display_name: entityForm.display_name,
          entity_type: entityForm.entity_type,
          document: entityForm.document || null,
          relationship: entityForm.relationship || null,
          notes: entityForm.notes || null,
          created_by: userData?.user?.id,
        });

        if (error) throw error;
        toast.success("Entidade criada!");
      }

      setEntityDialog(false);
      resetEntityForm();
      loadData();
    } catch (error: any) {
      console.error("Error saving entity:", error);
      toast.error("Erro ao salvar entidade", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntity = (entity: KnownEntity) => {
    setEntityToDelete(entity);
    setDeleteEntityDialog(true);
  };

  const confirmDeleteEntity = async () => {
    if (!entityToDelete) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("ai_known_entities").delete().eq("id", entityToDelete.id);

      if (error) throw error;

      toast.success("Entidade excluida!");
      setDeleteEntityDialog(false);
      setEntityToDelete(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting entity:", error);
      toast.error("Erro ao excluir entidade", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ========== PATTERN CRUD ==========
  const resetPatternForm = () => {
    setPatternForm({
      transaction_pattern: "",
      pattern_type: "contains",
      category: "",
      debit_account_code: "",
      credit_account_code: "",
      transaction_type: "ANY",
      priority: 100,
    });
    setEditingPattern(null);
  };

  const openCreatePattern = () => {
    resetPatternForm();
    setPatternDialog(true);
  };

  const openEditPattern = (pattern: ClassificationPattern) => {
    setEditingPattern(pattern);
    setPatternForm({
      transaction_pattern: pattern.transaction_pattern,
      pattern_type: pattern.pattern_type,
      category: pattern.category,
      debit_account_code: pattern.debit_account_code,
      credit_account_code: pattern.credit_account_code,
      transaction_type: pattern.transaction_type || "ANY",
      priority: pattern.priority,
    });
    setPatternDialog(true);
  };

  const handleSavePattern = async () => {
    if (!patternForm.transaction_pattern.trim() || !patternForm.category || !patternForm.debit_account_code || !patternForm.credit_account_code) {
      toast.error("Preencha todos os campos obrigatorios");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();

      if (editingPattern) {
        const { error } = await supabase
          .from("ai_classification_patterns")
          .update({
            transaction_pattern: patternForm.transaction_pattern,
            pattern_type: patternForm.pattern_type,
            category: patternForm.category,
            debit_account_code: patternForm.debit_account_code,
            credit_account_code: patternForm.credit_account_code,
            transaction_type: patternForm.transaction_type,
            priority: patternForm.priority,
          })
          .eq("id", editingPattern.id);

        if (error) throw error;
        toast.success("Padrao atualizado!");
      } else {
        const { error } = await supabase.from("ai_classification_patterns").insert({
          transaction_pattern: patternForm.transaction_pattern,
          pattern_type: patternForm.pattern_type,
          category: patternForm.category,
          debit_account_code: patternForm.debit_account_code,
          credit_account_code: patternForm.credit_account_code,
          transaction_type: patternForm.transaction_type,
          confidence: 1.0,
          source: "human",
          priority: patternForm.priority,
          is_active: true,
          created_by: userData?.user?.id,
        });

        if (error) throw error;
        toast.success("Padrao criado!");
      }

      setPatternDialog(false);
      resetPatternForm();
      loadData();
    } catch (error: any) {
      console.error("Error saving pattern:", error);
      toast.error("Erro ao salvar padrao", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePattern = (pattern: ClassificationPattern) => {
    setPatternToDelete(pattern);
    setDeletePatternDialog(true);
  };

  const confirmDeletePattern = async () => {
    if (!patternToDelete) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("ai_classification_patterns").delete().eq("id", patternToDelete.id);

      if (error) throw error;

      toast.success("Padrao excluido!");
      setDeletePatternDialog(false);
      setPatternToDelete(null);
      loadData();
    } catch (error: any) {
      console.error("Error deleting pattern:", error);
      toast.error("Erro ao excluir padrao", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const togglePatternActive = async (pattern: ClassificationPattern) => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("ai_classification_patterns")
        .update({ is_active: !pattern.is_active })
        .eq("id", pattern.id);

      if (error) throw error;

      toast.success(pattern.is_active ? "Padrao desativado!" : "Padrao ativado!");
      loadData();
    } catch (error: any) {
      console.error("Error toggling pattern:", error);
      toast.error("Erro ao alterar status", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter helpers
  const filteredEntities = knownEntities.filter(
    (entity) =>
      entity.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.name_pattern.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPatterns = patterns.filter((pattern) =>
    pattern.transaction_pattern.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEntityTypeLabel = (type: string) => {
    const entityType = ENTITY_TYPES.find((t) => t.value === type);
    return entityType?.label || type;
  };

  const getQuestionTypeConfig = (type: string) => {
    return QUESTION_TYPES[type as keyof typeof QUESTION_TYPES] || QUESTION_TYPES.confirm;
  };

  const categories =
    selectedQuestion?.transaction_type === "CREDIT" ? TRANSACTION_CATEGORIES.CREDIT : TRANSACTION_CATEGORIES.DEBIT;

  const debitAccounts = chartAccounts.filter((a) => a.code.startsWith("1") || a.code.startsWith("4") || a.code.startsWith("5"));
  const creditAccounts = chartAccounts.filter(
    (a) => a.code.startsWith("1") || a.code.startsWith("2") || a.code.startsWith("3") || a.code.startsWith("5")
  );

  const stats = {
    pendingQuestions: pendingQuestions.length,
    knownEntities: knownEntities.length,
    patterns: patterns.length,
    activePatterns: patterns.filter((p) => p.is_active).length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="relative">
                <Brain className="h-8 w-8 text-purple-600" />
                <Sparkles className="h-4 w-4 text-amber-500 absolute -top-1 -right-1" />
              </div>
              Treinamento de IA
            </h1>
            <p className="text-muted-foreground mt-1">Ajude a IA a aprender classificando transacoes e entidades</p>
          </div>

          <Button onClick={loadData} variant="outline" disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className={pendingQuestions.length > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.pendingQuestions}</div>
                  <div className="text-xs text-muted-foreground">Perguntas Pendentes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.knownEntities}</div>
                  <div className="text-xs text-muted-foreground">Entidades Conhecidas</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.activePatterns}</div>
                  <div className="text-xs text-muted-foreground">Padroes Ativos</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{patterns.reduce((sum, p) => sum + p.usage_count, 0)}</div>
                  <div className="text-xs text-muted-foreground">Classificacoes</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Questions Alert */}
        {pendingQuestions.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader className="py-3">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-5 w-5" />A IA precisa da sua ajuda!
              </CardTitle>
              <CardDescription className="text-amber-700">
                Existem {pendingQuestions.length} transacoes aguardando classificacao humana
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <Tabs defaultValue="questions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="questions" className="gap-2">
              <HelpCircle className="h-4 w-4" />
              Perguntas ({pendingQuestions.length})
            </TabsTrigger>
            <TabsTrigger value="entities" className="gap-2">
              <Users className="h-4 w-4" />
              Entidades ({knownEntities.length})
            </TabsTrigger>
            <TabsTrigger value="patterns" className="gap-2">
              <Target className="h-4 w-4" />
              Padroes ({patterns.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Perguntas da IA</CardTitle>
                <CardDescription>Responda as perguntas para treinar a IA a classificar automaticamente</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : pendingQuestions.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma pergunta pendente!</h3>
                    <p className="text-muted-foreground">A IA esta aprendendo bem. Continue importando extratos.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingQuestions.map((question) => {
                      const typeConfig = getQuestionTypeConfig(question.question_type);
                      const TypeIcon = typeConfig.icon;

                      return (
                        <Card key={question.id} className="border-l-4 border-l-purple-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge className={typeConfig.color}>
                                    <TypeIcon className="h-3 w-3 mr-1" />
                                    {typeConfig.label}
                                  </Badge>
                                  <Badge variant="outline">
                                    {question.transaction_type === "CREDIT" ? "Credito" : "Debito"}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {new Date(question.transaction_date).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>

                                <p className="font-medium text-purple-700 mb-2">{question.question_text}</p>

                                <div className="p-3 bg-muted rounded-lg mb-2">
                                  <p className="font-mono text-sm">{question.description}</p>
                                  <p
                                    className={cn(
                                      "font-semibold mt-1",
                                      question.transaction_type === "CREDIT" ? "text-green-600" : "text-red-600"
                                    )}
                                  >
                                    {question.transaction_type === "CREDIT" ? "+" : "-"}
                                    {formatCurrency(question.amount)}
                                  </p>
                                </div>

                                {question.ai_suggestion && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Sparkles className="h-4 w-4 text-purple-500" />
                                    Sugestao da IA: {question.ai_suggestion}
                                    {question.ai_confidence && (
                                      <Badge variant="outline" className="ml-1">
                                        {Math.round(question.ai_confidence * 100)}%
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col gap-2">
                                <Button size="sm" onClick={() => openAnswerDialog(question)}>
                                  <MessageCircle className="h-4 w-4 mr-1" />
                                  Responder
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleSkipQuestion(question)}>
                                  <SkipForward className="h-4 w-4 mr-1" />
                                  Pular
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Known Entities Tab */}
          <TabsContent value="entities" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Entidades Conhecidas</CardTitle>
                    <CardDescription>Pessoas e empresas que a IA ja conhece</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar entidade..."
                        className="pl-9 w-[200px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Button onClick={openCreateEntity}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Entidade
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEntities.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma entidade cadastrada</h3>
                    <p className="text-muted-foreground mb-4">Cadastre entidades para a IA classificar automaticamente</p>
                    <Button onClick={openCreateEntity}>
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar Entidade
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Relacionamento</TableHead>
                        <TableHead>Usos</TableHead>
                        <TableHead>Ultimo Uso</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntities.map((entity) => (
                        <TableRow key={entity.id}>
                          <TableCell>
                            <div className="font-medium">{entity.display_name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{entity.name_pattern}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getEntityTypeLabel(entity.entity_type)}</Badge>
                          </TableCell>
                          <TableCell>{entity.relationship || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{entity.usage_count}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(entity.last_used_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditEntity(entity)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteEntity(entity)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Padroes de Classificacao</CardTitle>
                    <CardDescription>Regras que a IA usa para classificar automaticamente</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar padrao..."
                        className="pl-9 w-[200px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Button onClick={openCreatePattern}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Padrao
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPatterns.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum padrao cadastrado</h3>
                    <p className="text-muted-foreground mb-4">Cadastre padroes para a IA classificar automaticamente</p>
                    <Button onClick={openCreatePattern}>
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar Padrao
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Padrao</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Contas</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Usos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPatterns.map((pattern) => (
                        <TableRow key={pattern.id} className={!pattern.is_active ? "opacity-50" : ""}>
                          <TableCell>
                            <div className="font-mono text-sm max-w-[200px] truncate">{pattern.transaction_pattern}</div>
                            <Badge variant="outline" className="mt-1">
                              {pattern.pattern_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{pattern.category}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <span className="text-red-600">D: {pattern.debit_account_code}</span>
                              <br />
                              <span className="text-green-600">C: {pattern.credit_account_code}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={pattern.source === "human" ? "default" : "secondary"}>{pattern.source}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{pattern.usage_count}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={pattern.is_active ? "default" : "secondary"}>
                              {pattern.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditPattern(pattern)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => togglePatternActive(pattern)}>
                                  {pattern.is_active ? (
                                    <>
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Desativar
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Ativar
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeletePattern(pattern)}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Answer Question Dialog */}
        <Dialog open={answerDialog} onOpenChange={setAnswerDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                Responder Pergunta da IA
              </DialogTitle>
              <DialogDescription>Ajude a IA a aprender classificando esta transacao</DialogDescription>
            </DialogHeader>

            {selectedQuestion && (
              <div className="space-y-4 py-4">
                {/* Transaction details */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={selectedQuestion.transaction_type === "CREDIT" ? "default" : "secondary"}>
                        {selectedQuestion.transaction_type === "CREDIT" ? "Credito" : "Debito"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(selectedQuestion.transaction_date).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="font-mono text-sm">{selectedQuestion.description}</p>
                      <p
                        className={cn(
                          "font-semibold mt-1",
                          selectedQuestion.transaction_type === "CREDIT" ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {selectedQuestion.transaction_type === "CREDIT" ? "+" : "-"}
                        {formatCurrency(selectedQuestion.amount)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Entity fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Entidade</Label>
                    <Input
                      value={answerForm.entityName}
                      onChange={(e) => setAnswerForm((prev) => ({ ...prev, entityName: e.target.value }))}
                      placeholder="Ex: Sergio Carneiro Leao"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Entidade</Label>
                    <Select
                      value={answerForm.entityType}
                      onValueChange={(value) => setAnswerForm((prev) => ({ ...prev, entityType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Relacionamento</Label>
                  <Input
                    value={answerForm.relationship}
                    onChange={(e) => setAnswerForm((prev) => ({ ...prev, relationship: e.target.value }))}
                    placeholder="Ex: Socio, Fornecedor de TI, Cliente..."
                  />
                </div>

                {/* Classification fields */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={answerForm.category}
                      onValueChange={(value) => setAnswerForm((prev) => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Conta de Debito</Label>
                      <Select
                        value={answerForm.debitAccount}
                        onValueChange={(value) => setAnswerForm((prev) => ({ ...prev, debitAccount: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {debitAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.code}>
                              {acc.code} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Conta de Credito</Label>
                      <Select
                        value={answerForm.creditAccount}
                        onValueChange={(value) => setAnswerForm((prev) => ({ ...prev, creditAccount: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {creditAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.code}>
                              {acc.code} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observacoes</Label>
                  <Textarea
                    value={answerForm.notes}
                    onChange={(e) => setAnswerForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Observacoes sobre esta classificacao..."
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <input
                    type="checkbox"
                    id="savePattern"
                    checked={answerForm.saveAsPattern}
                    onChange={(e) => setAnswerForm((prev) => ({ ...prev, saveAsPattern: e.target.checked }))}
                    className="rounded"
                  />
                  <label htmlFor="savePattern" className="text-sm">
                    Salvar como padrao para classificar automaticamente transacoes similares no futuro
                  </label>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setAnswerDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAnswerQuestion} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Responder
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Entity Create/Edit Dialog */}
        <Dialog open={entityDialog} onOpenChange={setEntityDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingEntity ? "Editar Entidade" : "Nova Entidade"}</DialogTitle>
              <DialogDescription>
                {editingEntity ? "Atualize as informacoes da entidade" : "Cadastre uma nova entidade conhecida"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="entity-pattern">Padrao de Nome *</Label>
                <Input
                  id="entity-pattern"
                  value={entityForm.name_pattern}
                  onChange={(e) => setEntityForm((prev) => ({ ...prev, name_pattern: e.target.value }))}
                  placeholder="Ex: SERGIO CARNEIRO LEAO"
                />
                <p className="text-xs text-muted-foreground">Como aparece nas transacoes bancarias</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-display">Nome de Exibicao *</Label>
                <Input
                  id="entity-display"
                  value={entityForm.display_name}
                  onChange={(e) => setEntityForm((prev) => ({ ...prev, display_name: e.target.value }))}
                  placeholder="Ex: Sergio Carneiro Leao"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-type">Tipo</Label>
                <Select
                  value={entityForm.entity_type}
                  onValueChange={(value) => setEntityForm((prev) => ({ ...prev, entity_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-document">CPF/CNPJ</Label>
                <Input
                  id="entity-document"
                  value={entityForm.document}
                  onChange={(e) => setEntityForm((prev) => ({ ...prev, document: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-relationship">Relacionamento</Label>
                <Input
                  id="entity-relationship"
                  value={entityForm.relationship}
                  onChange={(e) => setEntityForm((prev) => ({ ...prev, relationship: e.target.value }))}
                  placeholder="Ex: Socio, Fornecedor, Cliente..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-notes">Observacoes</Label>
                <Textarea
                  id="entity-notes"
                  value={entityForm.notes}
                  onChange={(e) => setEntityForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Informacoes adicionais..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEntityDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEntity} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {editingEntity ? "Salvar" : "Criar Entidade"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pattern Create/Edit Dialog */}
        <Dialog open={patternDialog} onOpenChange={setPatternDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPattern ? "Editar Padrao" : "Novo Padrao"}</DialogTitle>
              <DialogDescription>
                {editingPattern ? "Atualize as informacoes do padrao" : "Cadastre um novo padrao de classificacao"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="pattern-text">Padrao de Texto *</Label>
                <Input
                  id="pattern-text"
                  value={patternForm.transaction_pattern}
                  onChange={(e) => setPatternForm((prev) => ({ ...prev, transaction_pattern: e.target.value }))}
                  placeholder="Ex: PIX PAGAMENTO"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Match</Label>
                  <Select
                    value={patternForm.pattern_type}
                    onValueChange={(value) => setPatternForm((prev) => ({ ...prev, pattern_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contem</SelectItem>
                      <SelectItem value="literal">Exato</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Transacao</Label>
                  <Select
                    value={patternForm.transaction_type}
                    onValueChange={(value) => setPatternForm((prev) => ({ ...prev, transaction_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">Qualquer</SelectItem>
                      <SelectItem value="CREDIT">Credito</SelectItem>
                      <SelectItem value="DEBIT">Debito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select
                  value={patternForm.category}
                  onValueChange={(value) => setPatternForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" disabled>
                      -- Debitos --
                    </SelectItem>
                    {TRANSACTION_CATEGORIES.DEBIT.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="" disabled>
                      -- Creditos --
                    </SelectItem>
                    {TRANSACTION_CATEGORIES.CREDIT.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta de Debito *</Label>
                <Select
                  value={patternForm.debit_account_code}
                  onValueChange={(value) => setPatternForm((prev) => ({ ...prev, debit_account_code: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {debitAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.code}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta de Credito *</Label>
                <Select
                  value={patternForm.credit_account_code}
                  onValueChange={(value) => setPatternForm((prev) => ({ ...prev, credit_account_code: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {creditAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.code}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  value={patternForm.priority}
                  onChange={(e) => setPatternForm((prev) => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
                  min={1}
                  max={1000}
                />
                <p className="text-xs text-muted-foreground">Maior = mais prioritario</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPatternDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSavePattern} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {editingPattern ? "Salvar" : "Criar Padrao"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Entity AlertDialog */}
        <AlertDialog open={deleteEntityDialog} onOpenChange={setDeleteEntityDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Entidade</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a entidade "{entityToDelete?.display_name}"? Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteEntity} className="bg-red-600 hover:bg-red-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Pattern AlertDialog */}
        <AlertDialog open={deletePatternDialog} onOpenChange={setDeletePatternDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Padrao</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este padrao de classificacao? Esta acao nao pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeletePattern} className="bg-red-600 hover:bg-red-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default PendingEntities;
