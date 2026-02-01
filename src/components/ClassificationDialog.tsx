/**
 * ClassificationDialog.tsx
 * 
 * Dialog de classificação obrigatória para o Super Conciliação
 * 
 * REGRA DE OURO DO DR. CÍCERO:
 * "Nenhuma transação pode ser conciliada sem classificação contábil validada"
 * 
 * Este dialog aparece ao clicar em "Classificar" no Super Conciliação
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency } from '@/data/expensesData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Split,
  Plus,
  Shield,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Brain,
  Loader2,
  Trash2,
  Lock
} from 'lucide-react';

// ============================================================================
// TIPOS
// ============================================================================

interface BankTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  matched?: boolean;
  journal_entry_id?: string;
  extracted_cnpj?: string;
  extracted_cpf?: string;
  suggested_client_name?: string;
  suggested_account_id?: string;
  suggested_account_code?: string;
  suggested_account_name?: string;
  is_reclassification?: boolean;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface SplitLine {
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;
  description: string;
}

interface ClassificationRule {
  rule_id: string;
  rule_name: string;
  destination_account_id: string;
  destination_account_code: string;
  destination_account_name: string;
  confidence_score: number;
  status: string;
}

type ClassificationAction = 'confirm' | 'reclassify' | 'split' | 'create_account';

interface ClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction | null;
  currentAccount?: Account;
  suggestedAccount?: Account;
  onClassificationComplete: (result: {
    action: ClassificationAction;
    account?: Account;
    splitLines?: SplitLine[];
    newAccount?: Account;
    createRule?: boolean;
  }) => void;
}

// Contas genéricas que requerem justificativa
const GENERIC_ACCOUNT_CODES = ['4.1.1.08', '4.1.1.99', '3.1.1.99', '1.1.9.01', '2.1.9.01'];

// Padrões proibidos para receita
const FORBIDDEN_REVENUE_PATTERNS = [/sócio/i, /socio/i, /empréstimo/i, /aporte/i];

// ============================================================================
// COMPONENTE
// ============================================================================

export function ClassificationDialog({
  open,
  onOpenChange,
  transaction,
  currentAccount,
  suggestedAccount,
  onClassificationComplete
}: ClassificationDialogProps) {
  const { tenant } = useTenantConfig();
  
  const [action, setAction] = useState<ClassificationAction>('confirm');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justification, setJustification] = useState('');
  
  // Split
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);
  const [splitSearchOpen, setSplitSearchOpen] = useState<number | null>(null);
  
  // Nova conta
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('EXPENSE');
  const [selectedParentCode, setSelectedParentCode] = useState('');
  const [parentAccounts, setParentAccounts] = useState<{code: string; name: string}[]>([]);
  const [loadingNextCode, setLoadingNextCode] = useState(false);
  
  // Aprendizado
  const [saveAsRule, setSaveAsRule] = useState(false);
  const [matchingRules, setMatchingRules] = useState<ClassificationRule[]>([]);

  // Resetar ao abrir
  useEffect(() => {
    if (open && transaction) {
      setAction('confirm');
      setSelectedAccount(currentAccount || suggestedAccount || null);
      setJustification('');
      setSplitLines([]);
      setNewAccountCode('');
      setNewAccountName('');
      setSaveAsRule(false);
      loadAccounts();
      loadMatchingRules();
    }
  }, [open, transaction]);

  const loadAccounts = async () => {
    if (!tenant?.id) return;
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .eq('is_analytical', true)
      .order('code');
    if (data) {
      // Mapear account_type para type para manter compatibilidade
      const mappedData = data.map(acc => ({
        ...acc,
        type: acc.account_type
      }));
      setAccounts(mappedData);
    }
  };

  const loadMatchingRules = async () => {
    if (!tenant?.id || !transaction) return;
    const { data } = await supabase.rpc('rpc_find_matching_rule', {
      p_tenant_id: tenant.id,
      p_amount: Math.abs(transaction.amount),
      p_description: transaction.description,
      p_transaction_type: transaction.amount > 0 ? 'credit' : 'debit'
    });
    if (data) setMatchingRules(data);
  };

  // ============================================================================
  // CARREGAR CONTAS PAI PARA CRIAR NOVAS CONTAS
  // ============================================================================

  const loadParentAccounts = async (accountType: string) => {
    if (!tenant?.id) return;
    
    // Prefixos baseados no tipo de conta
    const prefixMap: Record<string, string[]> = {
      'EXPENSE': ['4.1', '4.2', '4.3', '4.4', '4.5'],      // Despesas
      'REVENUE': ['3.1', '3.2'],                           // Receitas
      'ASSET': ['1.1', '1.2', '1.3'],                      // Ativos
      'LIABILITY': ['2.1', '2.2', '2.3']                   // Passivos
    };
    
    const prefixes = prefixMap[accountType] || ['4.1'];
    
    // Buscar contas sintéticas (nível 3) como opções de pai
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('code, name')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .eq('is_analytical', false)
      .order('code');
    
    if (data) {
      // Filtrar apenas contas que sejam nível 3 (X.X.X) dos prefixos válidos
      const filtered = data.filter(acc => {
        const parts = acc.code.split('.');
        return parts.length === 3 && prefixes.some(p => acc.code.startsWith(p));
      });
      setParentAccounts(filtered);
      
      // Selecionar primeira opção automaticamente
      if (filtered.length > 0) {
        const firstCode = filtered[0].code;
        setSelectedParentCode(firstCode);
        calculateNextCode(firstCode);
      }
    }
  };

  // Calcular próximo código disponível
  const calculateNextCode = async (parentCode: string) => {
    if (!tenant?.id || !parentCode) return;
    
    setLoadingNextCode(true);
    try {
      // Buscar todas as contas filhas do pai selecionado
      const { data } = await supabase
        .from('chart_of_accounts')
        .select('code')
        .eq('tenant_id', tenant.id)
        .like('code', `${parentCode}.%`)
        .order('code', { ascending: false })
        .limit(1);
      
      let nextNumber = 1;
      if (data && data.length > 0) {
        // Extrair o último número e incrementar
        const lastCode = data[0].code;
        const parts = lastCode.split('.');
        const lastNumber = parseInt(parts[parts.length - 1]) || 0;
        nextNumber = lastNumber + 1;
      }
      
      // Formatar com dois dígitos
      const nextCode = `${parentCode}.${nextNumber.toString().padStart(2, '0')}`;
      setNewAccountCode(nextCode);
    } catch (err) {
      console.error('Erro ao calcular próximo código:', err);
    } finally {
      setLoadingNextCode(false);
    }
  };

  // Carregar contas pai quando action muda para create_account
  useEffect(() => {
    if (action === 'create_account' && newAccountType) {
      setSelectedParentCode('');
      setNewAccountCode('');
      loadParentAccounts(newAccountType);
    }
  }, [action, newAccountType, tenant?.id]);

  if (!transaction) return null;

  const isIncome = transaction.amount > 0;
  const absAmount = Math.abs(transaction.amount);

  // Validações
  const isGenericAccount = selectedAccount && 
    GENERIC_ACCOUNT_CODES.some(c => selectedAccount.code.startsWith(c));
  
  const isForbiddenRevenue = isIncome && 
    selectedAccount?.type === 'REVENUE' &&
    FORBIDDEN_REVENUE_PATTERNS.some(p => p.test(transaction.description));

  const splitTotal = splitLines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const isSplitBalanced = Math.abs(splitTotal - absAmount) < 0.01;

  // Handlers
  const handleAddSplitLine = () => {
    setSplitLines([...splitLines, { account_id: '', account_code: '', account_name: '', amount: 0, description: '' }]);
  };

  const handleRemoveSplitLine = (index: number) => {
    setSplitLines(splitLines.filter((_, i) => i !== index));
  };

  const handleUpdateSplitLine = (index: number, field: keyof SplitLine, value: string | number) => {
    const newLines = [...splitLines];
    newLines[index] = { ...newLines[index], [field]: value };
    if (field === 'account_id') {
      const acc = accounts.find(a => a.id === value);
      if (acc) {
        newLines[index].account_code = acc.code;
        newLines[index].account_name = acc.name;
      }
    }
    setSplitLines(newLines);
  };

  const handleDistributeRemaining = () => {
    if (splitLines.length === 0) return;
    const othersTotal = splitLines.slice(0, -1).reduce((sum, l) => sum + (l.amount || 0), 0);
    const remaining = absAmount - othersTotal;
    const newLines = [...splitLines];
    newLines[newLines.length - 1].amount = Math.max(0, remaining);
    setSplitLines(newLines);
  };

  const handleCreateAccount = async () => {
    if (!newAccountCode || !newAccountName) {
      toast.error('Código e nome são obrigatórios');
      return;
    }
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(newAccountCode)) {
      toast.error('Código deve seguir padrão X.X.X.XX');
      return;
    }

    setLoading(true);
    try {
      // Determinar natureza: DEVEDORA para Ativo/Despesa, CREDORA para Passivo/Receita
      const nature = (newAccountType === 'EXPENSE' || newAccountType === 'ASSET' || newAccountType === 'DESPESA' || newAccountType === 'ATIVO') ? 'DEVEDORA' : 'CREDORA';
      const level = newAccountCode.split('.').length;
      
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert({
          tenant_id: tenant?.id,
          code: newAccountCode,
          name: newAccountName,
          account_type: newAccountType,
          nature: nature,
          level: level,
          is_analytical: true,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Conta criada com sucesso!');
      await loadAccounts();
      setSelectedAccount(data);
      setAction('confirm');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conta';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    // Validações
    if (action === 'confirm' || action === 'reclassify') {
      if (!selectedAccount) {
        toast.error('Selecione uma conta');
        return;
      }
      if (isForbiddenRevenue) {
        toast.error('🚫 PIX de sócio/empréstimo NÃO pode ser classificado como Receita');
        return;
      }
      if (isGenericAccount && !justification) {
        toast.error('Conta genérica requer justificativa');
        return;
      }
    }

    if (action === 'split') {
      if (splitLines.length < 2) {
        toast.error('Split deve ter pelo menos 2 linhas');
        return;
      }
      if (!isSplitBalanced) {
        toast.error(`Total (${formatCurrency(splitTotal)}) difere do original (${formatCurrency(absAmount)})`);
        return;
      }
      if (splitLines.some(l => !l.account_id)) {
        toast.error('Todas as linhas devem ter conta selecionada');
        return;
      }
    }

    setLoading(true);
    try {
      // =======================================================================
      // MODO RECLASSIFICAÇÃO: Apenas atualiza a conta, não cria novo lançamento
      // =======================================================================
      if (transaction?.is_reclassification && transaction.journal_entry_id && selectedAccount) {
        // Buscar as linhas do lançamento existente
        const { data: existingLines, error: linesError } = await supabase
          .from('accounting_entry_lines')
          .select('id, account_id, debit, credit, description')
          .eq('entry_id', transaction.journal_entry_id);

        if (linesError) throw linesError;

        // Identificar a linha que NÃO é do banco (é a que vamos alterar)
        // A linha do banco tem o código que começa com 1.1.1 (Bancos)
        const { data: bankAccounts } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .ilike('code', '1.1.1.%');

        const bankAccountIds = new Set((bankAccounts || []).map(a => a.id));
        
        // Encontrar a linha que não é do banco
        const lineToUpdate = existingLines?.find(l => !bankAccountIds.has(l.account_id));
        
        if (lineToUpdate) {
          // Atualizar a conta da linha
          const { error: updateError } = await supabase
            .from('accounting_entry_lines')
            .update({ 
              account_id: selectedAccount.id,
              description: `Reclassificado: ${selectedAccount.name}${justification ? ' - ' + justification : ''}`
            })
            .eq('id', lineToUpdate.id);

          if (updateError) throw updateError;

          // Registrar a reclassificação para auditoria
          const user = (await supabase.auth.getUser()).data.user;
          await supabase.from('accounting_reclassifications').insert({
            tenant_id: tenant?.id,
            parent_entry_id: transaction.journal_entry_id,
            total_amount: Math.abs(transaction.amount),
            justification: justification || `Reclassificado de ${currentAccount?.name || 'conta anterior'} para ${selectedAccount.name}`,
            created_by: user?.id,
            status: 'applied',
            applied_at: new Date().toISOString()
          });

          toast.success(`Reclassificado para: ${selectedAccount.code} - ${selectedAccount.name}`);
          
          onClassificationComplete({
            action: 'reclassify',
            account: selectedAccount,
            createRule: saveAsRule
          });

          onOpenChange(false);
          return;
        }
      }

      // =======================================================================
      // MODO NORMAL: Criar novo lançamento
      // =======================================================================
      
      // Criar regra de aprendizado se solicitado
      if (saveAsRule && selectedAccount) {
        const keywords = extractKeywords(transaction.description);
        await supabase.rpc('rpc_create_classification_rule', {
          p_tenant_id: tenant?.id,
          p_rule_name: `Regra: ${selectedAccount.name}`,
          p_destination_account_id: selectedAccount.id,
          p_created_by: (await supabase.auth.getUser()).data.user?.id,
          p_description_keywords: keywords,
          p_transaction_type: isIncome ? 'credit' : 'debit'
        });
      }

      onClassificationComplete({
        action,
        account: action === 'split' ? undefined : selectedAccount || undefined,
        splitLines: action === 'split' ? splitLines : undefined,
        createRule: saveAsRule
      });

      onOpenChange(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao classificar';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const extractKeywords = (desc: string): string[] => {
    const words = desc.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);
    const stopwords = ['para', 'com', 'por', 'pix', 'ted', 'doc', 'boleto'];
    return words.filter(w => !stopwords.includes(w)).slice(0, 5);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Classificação Obrigatória
          </DialogTitle>
          <DialogDescription>
            {transaction?.is_reclassification 
              ? 'Reclassifique a conta sem alterar valores - apenas troca a conta destino'
              : 'Regra do Dr. Cícero: Nenhuma transação pode ser conciliada sem classificação validada'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* INDICADOR DE RECLASSIFICAÇÃO */}
          {transaction?.is_reclassification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                <RefreshCw className="h-4 w-4" />
                Modo Reclassificação
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Transação já conciliada. A reclassificação só altera a conta, não o valor.
              </p>
            </div>
          )}

          {/* DADOS FIXOS */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4" />
              Dados da Transação (Fixos)
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className={`h-4 w-4 ${isIncome ? 'text-green-600' : 'text-red-600'}`} />
                <span className={`font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                  {isIncome ? '+' : '-'}{formatCurrency(absAmount)}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span className="text-xs">{transaction.description}</span>
            </div>
            {transaction.extracted_cnpj && (
              <Badge variant="outline" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />
                {transaction.extracted_cnpj}
              </Badge>
            )}
          </div>

          {/* CONTA ATUAL */}
          {(currentAccount || suggestedAccount) && (
            <div className={`rounded-lg p-3 ${isGenericAccount ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-center gap-2 text-sm font-medium mb-1">
                {isGenericAccount ? (
                  <><AlertTriangle className="h-4 w-4 text-amber-500" />Conta Atual (Genérica)</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 text-blue-500" />Conta Sugerida</>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono">{currentAccount?.code || suggestedAccount?.code}</span>
                <span>{currentAccount?.name || suggestedAccount?.name}</span>
              </div>
              {isForbiddenRevenue && (
                <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-xs">
                  🚫 PIX de sócio/empréstimo NÃO pode ser Receita
                </div>
              )}
            </div>
          )}

          {/* AÇÃO OBRIGATÓRIA */}
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Shield className="h-4 w-4 text-blue-600" />
              {transaction?.is_reclassification ? 'Selecione a nova conta' : 'Ação Obrigatória'}
            </div>
            <RadioGroup value={action} onValueChange={(v) => setAction(v as ClassificationAction)}>
              <div className="grid grid-cols-2 gap-3">
                {/* Não mostrar "Confirmar" no modo reclassificação se não há conta atual */}
                {(!transaction?.is_reclassification || currentAccount) && (
                  <Label htmlFor="confirm" className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                    <RadioGroupItem value="confirm" id="confirm" className="mt-1" />
                    <div>
                      <div className="flex items-center gap-1 font-medium text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        {transaction?.is_reclassification ? 'Manter' : 'Confirmar'}
                      </div>
                      <p className="text-xs text-muted-foreground">Manter conta atual</p>
                    </div>
                  </Label>
                )}
                
                <Label htmlFor="reclassify" className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="reclassify" id="reclassify" className="mt-1" />
                  <div>
                    <div className="flex items-center gap-1 font-medium text-sm">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      Reclassificar
                    </div>
                    <p className="text-xs text-muted-foreground">Alterar conta</p>
                  </div>
                </Label>
                
                <Label htmlFor="split" className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="split" id="split" className="mt-1" />
                  <div>
                    <div className="flex items-center gap-1 font-medium text-sm">
                      <Split className="h-4 w-4 text-purple-600" />
                      Desmembrar
                    </div>
                    <p className="text-xs text-muted-foreground">Dividir em múltiplas</p>
                  </div>
                </Label>
                
                <Label htmlFor="create_account" className="flex items-start gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                  <RadioGroupItem value="create_account" id="create_account" className="mt-1" />
                  <div>
                    <div className="flex items-center gap-1 font-medium text-sm">
                      <Plus className="h-4 w-4 text-amber-600" />
                      Criar Conta
                    </div>
                    <p className="text-xs text-muted-foreground">Nova no plano</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* SELETOR DE CONTA (reclassificar) */}
          {action === 'reclassify' && (
            <div className="space-y-2">
              <Label className="text-sm">Selecionar Nova Conta</Label>
              <Popover open={accountSearchOpen} onOpenChange={setAccountSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    {selectedAccount ? (
                      <span className="truncate">
                        <span className="font-mono mr-2">{selectedAccount.code}</span>
                        {selectedAccount.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Buscar conta...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Código ou nome..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma encontrada.</CommandEmpty>
                      <CommandGroup className="max-h-[200px] overflow-y-auto">
                        {accounts.map((acc) => (
                          <CommandItem
                            key={acc.id}
                            value={`${acc.code} ${acc.name}`}
                            onSelect={() => {
                              setSelectedAccount(acc);
                              setAccountSearchOpen(false);
                            }}
                            className="text-xs"
                          >
                            <span className="font-mono w-20 shrink-0">{acc.code}</span>
                            {acc.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Sugestões IA */}
              {matchingRules.length > 0 && (
                <div className="bg-purple-50 rounded p-2">
                  <p className="text-xs font-medium flex items-center gap-1 mb-2">
                    <Brain className="h-3 w-3" />
                    Sugestões da IA:
                  </p>
                  <div className="space-y-1">
                    {matchingRules.slice(0, 3).map((rule) => (
                      <Button
                        key={rule.rule_id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-auto py-1"
                        onClick={() => {
                          const acc = accounts.find(a => a.id === rule.destination_account_id);
                          if (acc) setSelectedAccount(acc);
                        }}
                      >
                        <span className="font-mono mr-2">{rule.destination_account_code}</span>
                        <span className="truncate flex-1">{rule.destination_account_name}</span>
                        <Badge variant="secondary" className="ml-2 text-[10px]">{rule.confidence_score}%</Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SPLIT */}
          {action === 'split' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Linhas do Split</Label>
                <Button variant="outline" size="sm" onClick={handleAddSplitLine}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              
              <div className="space-y-2">
                {splitLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Popover open={splitSearchOpen === idx} onOpenChange={(o) => setSplitSearchOpen(o ? idx : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 justify-start text-xs h-8">
                          {line.account_id ? (
                            <span className="truncate">{line.account_code} - {line.account_name}</span>
                          ) : (
                            <span className="text-muted-foreground">Conta...</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Buscar..." />
                          <CommandList>
                            <CommandEmpty>Não encontrada.</CommandEmpty>
                            <CommandGroup className="max-h-[150px] overflow-y-auto">
                              {accounts.map((acc) => (
                                <CommandItem
                                  key={acc.id}
                                  value={`${acc.code} ${acc.name}`}
                                  onSelect={() => {
                                    handleUpdateSplitLine(idx, 'account_id', acc.id);
                                    setSplitSearchOpen(null);
                                  }}
                                  className="text-xs"
                                >
                                  <span className="font-mono w-16 shrink-0">{acc.code}</span>
                                  {acc.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    
                    <Input
                      type="number"
                      step="0.01"
                      value={line.amount || ''}
                      onChange={(e) => handleUpdateSplitLine(idx, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-24 h-8 text-right text-xs"
                      placeholder="0,00"
                    />
                    
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveSplitLine(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {splitLines.length > 0 && (
                <div className="flex items-center justify-between p-2 bg-slate-100 rounded">
                  <span className={`text-sm font-medium ${isSplitBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    Total: {formatCurrency(splitTotal)} / {formatCurrency(absAmount)}
                  </span>
                  <Button variant="outline" size="sm" onClick={handleDistributeRemaining}>
                    Auto-distribuir
                  </Button>
                </div>
              )}

              {splitLines.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Clique em "Adicionar" para criar linhas
                </p>
              )}
            </div>
          )}

          {/* CRIAR CONTA */}
          {action === 'create_account' && (
            <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/50 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  Dr. Cícero
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Sempre criar contas específicas
                </span>
              </div>

              {/* 1. Tipo da Conta */}
              <div>
                <Label className="text-xs font-medium">1. Tipo de Conta</Label>
                <RadioGroup 
                  value={newAccountType} 
                  onValueChange={(val) => {
                    setNewAccountType(val);
                    setSelectedParentCode('');
                    setNewAccountCode('');
                    loadParentAccounts(val);
                  }} 
                  className="flex gap-4 mt-1"
                >
                  {[{ v: 'EXPENSE', l: 'Despesa' }, { v: 'REVENUE', l: 'Receita' }, { v: 'ASSET', l: 'Ativo' }, { v: 'LIABILITY', l: 'Passivo' }].map(t => (
                    <div key={t.v} className="flex items-center space-x-1">
                      <RadioGroupItem value={t.v} id={`type_${t.v}`} />
                      <Label htmlFor={`type_${t.v}`} className="text-xs">{t.l}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* 2. Categoria Pai - Com filtro de busca */}
              {parentAccounts.length > 0 && (
                <div>
                  <Label className="text-xs font-medium">2. Categoria (Conta Pai) - Digite para filtrar</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full h-8 justify-between text-xs font-normal"
                      >
                        {selectedParentCode ? (
                          <span>
                            <span className="font-mono">{selectedParentCode}</span> - {parentAccounts.find(a => a.code === selectedParentCode)?.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Selecione ou digite...</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar categoria..." className="h-8 text-xs" />
                        <CommandList>
                          <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                          <CommandGroup>
                            {parentAccounts.map((acc) => (
                              <CommandItem
                                key={acc.code}
                                value={`${acc.code} ${acc.name}`}
                                onSelect={() => {
                                  setSelectedParentCode(acc.code);
                                  calculateNextCode(acc.code);
                                }}
                                className="text-xs"
                              >
                                <span className="font-mono font-medium">{acc.code}</span>
                                <span className="ml-2 text-muted-foreground">{acc.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* 3. Código Automático + Nome */}
              {selectedParentCode && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs font-medium">3. Código</Label>
                    {loadingNextCode ? (
                      <div className="h-8 flex items-center justify-center bg-muted rounded">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </div>
                    ) : (
                      <div className="h-8 flex items-center px-2 bg-green-50 border border-green-200 rounded text-xs font-mono font-bold text-green-700">
                        {newAccountCode || '...'}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">Auto-gerado</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs font-medium">4. Nome da Conta</Label>
                    <Input
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="Ex: Publicações e Assinaturas"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Preview */}
              {newAccountCode && newAccountName && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                  <div className="font-medium text-blue-800 mb-1">Preview:</div>
                  <div className="font-mono text-blue-700">
                    {newAccountCode} - {newAccountName}
                  </div>
                </div>
              )}

              <Button onClick={handleCreateAccount} disabled={loading || !newAccountCode || !newAccountName || loadingNextCode} className="w-full" size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Criar Conta
              </Button>
            </div>
          )}

          {/* JUSTIFICATIVA (conta genérica) */}
          {(action === 'confirm' || action === 'reclassify') && isGenericAccount && (
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Justificativa (obrigatória)
              </Label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Por que usar conta genérica..."
                rows={2}
                className="text-sm"
              />
            </div>
          )}

          {/* APRENDIZADO IA */}
          {(action === 'confirm' || action === 'reclassify') && selectedAccount && (
            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
              <input
                type="checkbox"
                id="saveRule"
                checked={saveAsRule}
                onChange={(e) => setSaveAsRule(e.target.checked)}
                className="h-4 w-4"
                aria-label="Salvar como regra de aprendizado"
              />
              <Label htmlFor="saveRule" className="text-sm flex items-center gap-2 cursor-pointer">
                <Brain className="h-4 w-4 text-purple-600" />
                Salvar como regra de aprendizado (IA)
              </Label>
            </div>
          )}
        </div>

        {/* BOTÕES */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={loading || isForbiddenRevenue}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            Confirmar Classificação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
