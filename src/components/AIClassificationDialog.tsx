import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, MessageCircle, User, Building2, HelpCircle, CheckCircle, SkipForward, Save, Sparkles } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";

interface PendingTransaction {
  id: string;
  fitid: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  date: string;
  ai_suggestion?: {
    category: string;
    debit_account: string;
    credit_account: string;
    confidence: number;
    reasoning: string;
  };
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface AIClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: PendingTransaction[];
  bankAccountId: string;
  importId: string;
  onComplete: (results: ClassificationResult[]) => void;
}

interface ClassificationResult {
  fitid: string;
  category: string;
  debit_account: string;
  credit_account: string;
  entity_name?: string;
  entity_type?: string;
  entity_relationship?: string;
  notes?: string;
}

// Tipos de entidade para seleção
const ENTITY_TYPES = [
  { value: 'partner', label: 'Sócio/Proprietário' },
  { value: 'employee', label: 'Funcionário' },
  { value: 'supplier', label: 'Fornecedor' },
  { value: 'client', label: 'Cliente' },
  { value: 'company', label: 'Empresa' },
  { value: 'person', label: 'Pessoa Física' },
  { value: 'other', label: 'Outro' }
];

// Categorias de transação
const TRANSACTION_CATEGORIES = {
  DEBIT: [
    { value: 'supplier_payment', label: 'Pagamento a Fornecedor' },
    { value: 'partner_withdrawal', label: 'Retirada de Sócio' },
    { value: 'salary', label: 'Salário/Pagamento Funcionário' },
    { value: 'tax', label: 'Impostos e Taxas' },
    { value: 'rent', label: 'Aluguel' },
    { value: 'utility', label: 'Conta de Consumo (Luz, Água, etc)' },
    { value: 'service', label: 'Serviço Contratado' },
    { value: 'bank_fee', label: 'Tarifa Bancária' },
    { value: 'transfer', label: 'Transferência entre Contas' },
    { value: 'personal', label: 'Despesa Pessoal' },
    { value: 'other_expense', label: 'Outra Despesa' }
  ],
  CREDIT: [
    { value: 'client_payment', label: 'Recebimento de Cliente' },
    { value: 'partner_contribution', label: 'Aporte de Sócio' },
    { value: 'service_revenue', label: 'Receita de Serviços' },
    { value: 'refund', label: 'Reembolso/Estorno' },
    { value: 'transfer', label: 'Transferência entre Contas' },
    { value: 'other_revenue', label: 'Outra Receita' }
  ]
};

export function AIClassificationDialog({
  open,
  onOpenChange,
  transactions,
  bankAccountId,
  importId,
  onComplete
}: AIClassificationDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<ClassificationResult[]>([]);

  // Estados do formulário
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityRelationship, setEntityRelationship] = useState("");
  const [category, setCategory] = useState("");
  const [debitAccount, setDebitAccount] = useState("");
  const [creditAccount, setCreditAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [saveAsPattern, setSaveAsPattern] = useState(true);

  const currentTransaction = transactions[currentIndex];
  const progress = ((currentIndex) / transactions.length) * 100;

  useEffect(() => {
    if (open) {
      loadChartAccounts();
      setCurrentIndex(0);
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (currentTransaction) {
      // Pré-preencher com sugestão da IA se disponível
      if (currentTransaction.ai_suggestion) {
        setCategory(currentTransaction.ai_suggestion.category);
        setDebitAccount(currentTransaction.ai_suggestion.debit_account);
        setCreditAccount(currentTransaction.ai_suggestion.credit_account);
      } else {
        setCategory("");
        setDebitAccount("");
        setCreditAccount("");
      }
      setEntityName("");
      setEntityType("");
      setEntityRelationship("");
      setNotes("");
    }
  }, [currentIndex, currentTransaction]);

  const loadChartAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setChartAccounts(data || []);
    } catch (error) {
      console.error('Erro ao carregar plano de contas:', error);
      toast.error('Erro ao carregar plano de contas');
    } finally {
      setLoading(false);
    }
  };

  // Extrair possível nome da descrição
  const extractPossibleName = (description: string): string => {
    // Padrões comuns de PIX/TED que contêm nomes
    const patterns = [
      /PIX\s+(?:TRANSF|RECEBIDO|ENVIADO|PAGAMENTO)\s*-?\s*(.+)/i,
      /TED\s+(?:RECEBIDA|ENVIADA)\s*-?\s*(.+)/i,
      /PAGAMENTO\s+(?:PIX|TED)\s*-?\s*(.+)/i,
      /TRANSFERENCIA\s*-?\s*(.+)/i
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return description;
  };

  const handleSaveAndNext = async () => {
    if (!category || !debitAccount || !creditAccount) {
      toast.error('Preencha categoria e contas contábeis');
      return;
    }

    const result: ClassificationResult = {
      fitid: currentTransaction.fitid,
      category,
      debit_account: debitAccount,
      credit_account: creditAccount,
      entity_name: entityName || undefined,
      entity_type: entityType || undefined,
      entity_relationship: entityRelationship || undefined,
      notes: notes || undefined
    };

    // Salvar entidade e padrão se marcado
    if (saveAsPattern && entityName) {
      await saveEntityAndPattern(result);
    }

    // Salvar no histórico
    await saveToHistory(result);

    setResults(prev => [...prev, result]);

    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Todas classificadas - finalizar
      handleFinish([...results, result]);
    }
  };

  const saveEntityAndPattern = async (result: ClassificationResult) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      // Verificar se entidade já existe
      const normalizedName = entityName.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();

      const { data: existingEntity } = await supabase
        .from('ai_known_entities')
        .select('id')
        .eq('normalized_pattern', normalizedName)
        .maybeSingle();

      let entityId = existingEntity?.id;

      if (!entityId) {
        // Criar nova entidade
        const { data: newEntity, error: entityError } = await supabase
          .from('ai_known_entities')
          .insert({
            name_pattern: entityName,
            normalized_pattern: normalizedName,
            entity_type: entityType || 'other',
            display_name: entityName,
            relationship: entityRelationship,
            notes: notes,
            created_by: userData?.user?.id
          })
          .select('id')
          .single();

        if (entityError) throw entityError;
        entityId = newEntity.id;
      }

      // Criar padrão de classificação
      const { error: patternError } = await supabase
        .from('ai_classification_patterns')
        .insert({
          transaction_pattern: extractPossibleName(currentTransaction.description),
          pattern_type: 'contains',
          category: result.category,
          debit_account_code: result.debit_account,
          credit_account_code: result.credit_account,
          entity_id: entityId,
          transaction_type: currentTransaction.type,
          confidence: 1.0,
          source: 'human',
          priority: 100,
          created_by: userData?.user?.id
        });

      if (patternError) throw patternError;
      toast.success('Padrão salvo para uso futuro!');
    } catch (error) {
      console.error('Erro ao salvar padrão:', error);
    }
  };

  const saveToHistory = async (result: ClassificationResult) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      const wasCorreted = currentTransaction.ai_suggestion &&
        (currentTransaction.ai_suggestion.category !== result.category ||
          currentTransaction.ai_suggestion.debit_account !== result.debit_account ||
          currentTransaction.ai_suggestion.credit_account !== result.credit_account);

      await supabase
        .from('ai_classification_history')
        .insert({
          original_description: currentTransaction.description,
          amount: currentTransaction.amount,
          transaction_type: currentTransaction.type,
          transaction_date: currentTransaction.date,
          ai_category: currentTransaction.ai_suggestion?.category,
          ai_debit_account: currentTransaction.ai_suggestion?.debit_account,
          ai_credit_account: currentTransaction.ai_suggestion?.credit_account,
          ai_confidence: currentTransaction.ai_suggestion?.confidence,
          ai_reasoning: currentTransaction.ai_suggestion?.reasoning,
          final_category: result.category,
          final_debit_account: result.debit_account,
          final_credit_account: result.credit_account,
          was_corrected: wasCorreted,
          human_notes: result.notes,
          reviewed_by: userData?.user?.id,
          reviewed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  };

  const handleSkip = () => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      handleFinish(results);
    }
  };

  const handleFinish = (finalResults: ClassificationResult[]) => {
    onComplete(finalResults);
    onOpenChange(false);
    toast.success(`${finalResults.length} transações classificadas!`);
  };

  const handleAcceptSuggestion = () => {
    if (currentTransaction?.ai_suggestion) {
      setCategory(currentTransaction.ai_suggestion.category);
      setDebitAccount(currentTransaction.ai_suggestion.debit_account);
      setCreditAccount(currentTransaction.ai_suggestion.credit_account);
    }
  };

  // Filtrar contas por tipo
  const debitAccounts = chartAccounts.filter(a =>
    a.code.startsWith('1') || a.code.startsWith('4') || a.code.startsWith('5')
  );
  const creditAccounts = chartAccounts.filter(a =>
    a.code.startsWith('1') || a.code.startsWith('2') || a.code.startsWith('3') || a.code.startsWith('5')
  );

  const categories = currentTransaction?.type === 'CREDIT'
    ? TRANSACTION_CATEGORIES.CREDIT
    : TRANSACTION_CATEGORIES.DEBIT;

  if (!currentTransaction) {
    return null;
  }

  const possibleName = extractPossibleName(currentTransaction.description);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Classificar Transação com IA
          </DialogTitle>
          <DialogDescription>
            Ajude a IA a aprender classificando esta transação
          </DialogDescription>
        </DialogHeader>

        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Transação {currentIndex + 1} de {transactions.length}</span>
            <span>{Math.round(progress)}% completo</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Detalhes da transação */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant={currentTransaction.type === 'CREDIT' ? 'default' : 'secondary'}>
                {currentTransaction.type === 'CREDIT' ? 'Crédito' : 'Débito'}
              </Badge>
              <span className={currentTransaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                {currentTransaction.type === 'CREDIT' ? '+' : '-'}
                {formatCurrency(currentTransaction.amount)}
              </span>
            </CardTitle>
            <CardDescription>{currentTransaction.date}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-mono text-sm">{currentTransaction.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Sugestão da IA */}
        {currentTransaction.ai_suggestion && (
          <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Sugestão da IA
                <Badge variant="outline">
                  {Math.round(currentTransaction.ai_suggestion.confidence * 100)}% confiança
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm"><strong>Categoria:</strong> {currentTransaction.ai_suggestion.category}</p>
              <p className="text-sm"><strong>Débito:</strong> {currentTransaction.ai_suggestion.debit_account}</p>
              <p className="text-sm"><strong>Crédito:</strong> {currentTransaction.ai_suggestion.credit_account}</p>
              <p className="text-xs text-muted-foreground">{currentTransaction.ai_suggestion.reasoning}</p>
              <Button variant="outline" size="sm" onClick={handleAcceptSuggestion}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Aceitar sugestão
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Formulário de classificação */}
        <Tabs defaultValue="classification" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="classification">Classificação</TabsTrigger>
            <TabsTrigger value="entity">Quem é?</TabsTrigger>
          </TabsList>

          <TabsContent value="classification" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
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

              <div className="space-y-2">
                <Label>Conta de Débito</Label>
                <Select value={debitAccount} onValueChange={setDebitAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta..." />
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
                <Label>Conta de Crédito</Label>
                <Select value={creditAccount} onValueChange={setCreditAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta..." />
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
                <Label>Observações</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre esta transação..."
                  rows={2}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="entity" className="space-y-4 mt-4">
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                  Quem é "{possibleName}"?
                </CardTitle>
                <CardDescription>
                  Ajude a IA a identificar esta pessoa/empresa para classificações futuras
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  placeholder={possibleName}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo..." />
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

              <div className="space-y-2 md:col-span-2">
                <Label>Relacionamento/Descrição</Label>
                <Input
                  value={entityRelationship}
                  onChange={(e) => setEntityRelationship(e.target.value)}
                  placeholder="Ex: Sócio da empresa, Fornecedor de TI, Contador..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <input
                type="checkbox"
                id="savePattern"
                checked={saveAsPattern}
                onChange={(e) => setSaveAsPattern(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="savePattern" className="text-sm">
                Salvar como padrão para classificar automaticamente transações similares no futuro
              </label>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleSkip}>
            <SkipForward className="h-4 w-4 mr-2" />
            Pular
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveAndNext} disabled={saving || !category || !debitAccount || !creditAccount}>
              {saving ? (
                'Salvando...'
              ) : currentIndex < transactions.length - 1 ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar e Próximo
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizar
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
