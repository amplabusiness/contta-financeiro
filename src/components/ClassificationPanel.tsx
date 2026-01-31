/**
 * ClassificationPanel.tsx
 * 
 * REGRA DE OURO DO DR. CÍCERO:
 * "Nenhuma transação pode ser conciliada sem classificação contábil validada"
 * 
 * Este painel aparece ao clicar em uma transação no Super Conciliação.
 * Oferece 4 opções obrigatórias:
 * 1. ✅ Confirmar conta atual
 * 2. 🔁 Reclassificar para outra conta
 * 3. ✂️ Desmembrar (split)
 * 4. ➕ Criar nova conta
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Split,
  Plus,
  Shield,
  Building2,
  CreditCard,
  Calendar,
  DollarSign,
  FileText,
  Brain,
  Loader2,
  Trash2,
  Lock
} from 'lucide-react';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

interface BankTransaction {
  id: string;
  amount: number;
  date: string;
  description: string;
  matched: boolean;
  journal_entry_id?: string;
  extracted_cnpj?: string;
  extracted_cpf?: string;
  extracted_cob?: string;
  suggested_client_id?: string;
  suggested_client_name?: string;
  identification_confidence?: number;
  identification_method?: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  is_analytical: boolean;
}

interface SuggestedAccount {
  account: Account;
  confidence: number;
  reason: string;
  rule_id?: string;
}

interface SplitLine {
  account_id: string;
  account_code?: string;
  account_name?: string;
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

interface ClassificationPanelProps {
  transaction: BankTransaction;
  currentAccount?: Account;
  suggestedAccount?: SuggestedAccount;
  onClassify: (result: ClassificationResult) => void;
  onCancel: () => void;
}

interface ClassificationResult {
  action: ClassificationAction;
  account_id: string;
  account_code: string;
  account_name: string;
  split_lines?: SplitLine[];
  rule_created?: boolean;
  justification?: string;
}

// ============================================================================
// CONSTANTES DE CONTAS GENÉRICAS (ALERTAS)
// ============================================================================

const GENERIC_ACCOUNT_CODES = [
  '4.1.1.08', // Outras Despesas Operacionais
  '4.1.1.99', // Outras Despesas
  '3.1.1.99', // Outras Receitas
  '1.1.9.01', // Transitória Débitos
  '2.1.9.01', // Transitória Créditos
];

// Contas proibidas para receitas (PIX de sócio NUNCA vira receita)
const FORBIDDEN_REVENUE_PATTERNS = [
  /sócio/i,
  /socio/i,
  /empréstimo/i,
  /emprestimo/i,
  /aporte/i,
  /devolução/i,
  /devoluçao/i,
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function ClassificationPanel({
  transaction,
  currentAccount,
  suggestedAccount,
  onClassify,
  onCancel
}: ClassificationPanelProps) {
  const { tenant } = useTenantConfig();
  
  // Estados principais
  const [action, setAction] = useState<ClassificationAction>('confirm');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(currentAccount || suggestedAccount?.account || null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountSearchOpen, setAccountSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justification, setJustification] = useState('');
  
  // Estados para split
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);
  
  // Estados para criar conta
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccountCode, setNewAccountCode] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<string>('EXPENSE');
  
  // Estados para aprendizado IA
  const [saveAsRule, setSaveAsRule] = useState(false);
  const [matchingRules, setMatchingRules] = useState<ClassificationRule[]>([]);

  // Determinar tipo de transação
  const isIncome = transaction.amount > 0;
  const transactionType = isIncome ? 'credit' : 'debit';
  const absAmount = Math.abs(transaction.amount);

  // ============================================================================
  // CARREGAR DADOS
  // ============================================================================

  useEffect(() => {
    loadAccounts();
    loadMatchingRules();
  }, [tenant]);

  const loadAccounts = async () => {
    if (!tenant?.id) return;
    
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, type, is_analytical')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .eq('is_analytical', true)
      .order('code');
    
    if (data) setAccounts(data);
  };

  const loadMatchingRules = async () => {
    if (!tenant?.id) return;
    
    const { data } = await supabase.rpc('rpc_find_matching_rule', {
      p_tenant_id: tenant.id,
      p_amount: absAmount,
      p_description: transaction.description,
      p_transaction_type: transactionType
    });
    
    if (data) setMatchingRules(data);
  };

  // ============================================================================
  // VALIDAÇÕES DO DR. CÍCERO
  // ============================================================================

  const isGenericAccount = useMemo(() => {
    if (!selectedAccount) return false;
    return GENERIC_ACCOUNT_CODES.some(code => selectedAccount.code.startsWith(code));
  }, [selectedAccount]);

  const isForbiddenRevenue = useMemo(() => {
    if (!isIncome) return false;
    return FORBIDDEN_REVENUE_PATTERNS.some(pattern => 
      pattern.test(transaction.description)
    );
  }, [transaction.description, isIncome]);

  const accountWarning = useMemo(() => {
    if (!selectedAccount) return null;
    
    if (isGenericAccount) {
      return {
        type: 'warning' as const,
        message: '⚠️ Conta genérica - recomenda-se uma conta mais específica',
        canProceed: true
      };
    }
    
    if (isForbiddenRevenue && selectedAccount.type === 'REVENUE') {
      return {
        type: 'error' as const,
        message: '🚫 PIX de sócio/empréstimo NÃO pode ser classificado como Receita',
        canProceed: false
      };
    }
    
    // Verificar se tipo de conta combina com tipo de transação
    if (isIncome && selectedAccount.type === 'EXPENSE') {
      return {
        type: 'warning' as const,
        message: '⚠️ Entrada classificada como Despesa - verifique se não é estorno',
        canProceed: true
      };
    }
    
    if (!isIncome && selectedAccount.type === 'REVENUE') {
      return {
        type: 'warning' as const,
        message: '⚠️ Saída classificada como Receita - verifique se não é estorno',
        canProceed: true
      };
    }
    
    return {
      type: 'success' as const,
      message: '✅ Conta adequada',
      canProceed: true
    };
  }, [selectedAccount, isGenericAccount, isForbiddenRevenue, isIncome]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleAddSplitLine = () => {
    setSplitLines([...splitLines, { account_id: '', amount: 0, description: '' }]);
  };

  const handleRemoveSplitLine = (index: number) => {
    setSplitLines(splitLines.filter((_, i) => i !== index));
  };

  const handleUpdateSplitLine = (index: number, field: keyof SplitLine, value: any) => {
    const newLines = [...splitLines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    if (field === 'account_id') {
      const account = accounts.find(a => a.id === value);
      if (account) {
        newLines[index].account_code = account.code;
        newLines[index].account_name = account.name;
      }
    }
    
    setSplitLines(newLines);
  };

  const handleDistributeSplitRemaining = () => {
    if (splitLines.length === 0) return;
    
    const othersTotal = splitLines.slice(0, -1).reduce((sum, l) => sum + (l.amount || 0), 0);
    const remaining = absAmount - othersTotal;
    
    const newLines = [...splitLines];
    newLines[newLines.length - 1].amount = Math.max(0, remaining);
    setSplitLines(newLines);
  };

  const splitTotal = splitLines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const isSplitBalanced = Math.abs(splitTotal - absAmount) < 0.01;

  // ============================================================================
  // CRIAR NOVA CONTA
  // ============================================================================

  const handleCreateAccount = async () => {
    if (!newAccountCode || !newAccountName) {
      toast.error('Código e nome são obrigatórios');
      return;
    }

    // Validar formato do código
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(newAccountCode)) {
      toast.error('Código deve seguir padrão X.X.X.XX');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert({
          tenant_id: tenant?.id,
          code: newAccountCode,
          name: newAccountName,
          type: newAccountType,
          is_analytical: true,
          is_active: true,
          balance_type: newAccountType === 'EXPENSE' || newAccountType === 'ASSET' ? 'DEBIT' : 'CREDIT'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Conta criada com sucesso!');
      
      // Recarregar contas e selecionar a nova
      await loadAccounts();
      setSelectedAccount(data);
      setShowCreateAccount(false);
      setAction('confirm');

    } catch (err: any) {
      console.error('Erro ao criar conta:', err);
      toast.error(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // CONFIRMAR CLASSIFICAÇÃO
  // ============================================================================

  const handleConfirm = async () => {
    // Validações
    if (action === 'confirm' || action === 'reclassify') {
      if (!selectedAccount) {
        toast.error('Selecione uma conta');
        return;
      }
      
      if (accountWarning?.canProceed === false) {
        toast.error(accountWarning.message);
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
        toast.error(`Total (${formatCurrency(splitTotal)}) difere do valor original (${formatCurrency(absAmount)})`);
        return;
      }
      
      if (splitLines.some(l => !l.account_id)) {
        toast.error('Todas as linhas devem ter conta selecionada');
        return;
      }
    }

    setLoading(true);
    try {
      // Salvar como regra de aprendizado se solicitado
      if (saveAsRule && selectedAccount) {
        const keywords = extractKeywords(transaction.description);
        
        await supabase.rpc('rpc_create_classification_rule', {
          p_tenant_id: tenant?.id,
          p_rule_name: `Regra: ${selectedAccount.name}`,
          p_destination_account_id: selectedAccount.id,
          p_created_by: (await supabase.auth.getUser()).data.user?.id,
          p_description_keywords: keywords,
          p_transaction_type: transactionType
        });
      }

      // Retornar resultado
      const result: ClassificationResult = {
        action,
        account_id: action === 'split' ? '' : (selectedAccount?.id || ''),
        account_code: action === 'split' ? '' : (selectedAccount?.code || ''),
        account_name: action === 'split' ? 'SPLIT' : (selectedAccount?.name || ''),
        split_lines: action === 'split' ? splitLines : undefined,
        rule_created: saveAsRule,
        justification: justification || undefined
      };

      onClassify(result);

    } catch (err: any) {
      console.error('Erro ao classificar:', err);
      toast.error(err.message || 'Erro ao classificar');
    } finally {
      setLoading(false);
    }
  };

  // Extrair keywords relevantes da descrição
  const extractKeywords = (desc: string): string[] => {
    const words = desc.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);
    
    // Remover palavras comuns
    const stopwords = ['para', 'com', 'por', 'pix', 'ted', 'doc', 'boleto'];
    return words.filter(w => !stopwords.includes(w)).slice(0, 5);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto p-4">
      {/* BLOCO 1: Dados Fixos (Somente Leitura) */}
      <Card className="border-slate-300">
        <CardHeader className="py-3 bg-slate-50">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Dados da Transação (Fixos)
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className={`h-4 w-4 ${isIncome ? 'text-green-600' : 'text-red-600'}`} />
              <span className={`font-bold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                {isIncome ? '+' : '-'}{formatCurrency(absAmount)}
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
            <span className="text-xs break-words">{transaction.description}</span>
          </div>
          {transaction.extracted_cnpj && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-mono">{transaction.extracted_cnpj}</span>
            </div>
          )}
          {transaction.suggested_client_name && (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Cliente: {transaction.suggested_client_name}
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* BLOCO 2: Conta Atual / Sugerida */}
      {(currentAccount || suggestedAccount) && (
        <Card className={`border-2 ${isGenericAccount ? 'border-amber-300 bg-amber-50' : 'border-blue-200'}`}>
          <CardHeader className="py-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {isGenericAccount ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Conta Atual (Genérica)
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  Conta Sugerida
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm mr-2">
                  {currentAccount?.code || suggestedAccount?.account.code}
                </span>
                <span className="text-sm">
                  {currentAccount?.name || suggestedAccount?.account.name}
                </span>
              </div>
              {suggestedAccount && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  {suggestedAccount.confidence}%
                </Badge>
              )}
            </div>
            {suggestedAccount?.reason && (
              <p className="text-xs text-muted-foreground mt-1">{suggestedAccount.reason}</p>
            )}
            {accountWarning && (
              <div className={`mt-2 p-2 rounded text-xs ${
                accountWarning.type === 'error' ? 'bg-red-100 text-red-700' :
                accountWarning.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {accountWarning.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BLOCO 3: Ação Obrigatória */}
      <Card className="border-blue-300 bg-blue-50/50">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            Ação Obrigatória
          </CardTitle>
          <CardDescription className="text-xs">
            Escolha como classificar esta transação
          </CardDescription>
        </CardHeader>
        <CardContent className="py-3">
          <RadioGroup value={action} onValueChange={(v) => setAction(v as ClassificationAction)}>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="confirm" id="confirm" />
                <Label htmlFor="confirm" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Confirmar esta conta
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Manter a classificação atual/sugerida
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="reclassify" id="reclassify" />
                <Label htmlFor="reclassify" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <RefreshCw className="h-4 w-4 text-blue-600" />
                    Reclassificar para outra conta
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Alterar para uma conta diferente
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="split" id="split" />
                <Label htmlFor="split" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <Split className="h-4 w-4 text-purple-600" />
                    Desmembrar (Split)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dividir em múltiplas contas
                  </p>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="create_account" id="create_account" />
                <Label htmlFor="create_account" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2 font-medium">
                    <Plus className="h-4 w-4 text-amber-600" />
                    Criar nova conta
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Adicionar conta no Plano de Contas
                  </p>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* BLOCO 4: Seletor de Conta (para reclassificar) */}
      {action === 'reclassify' && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Selecionar Nova Conta</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
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
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Código ou nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-y-auto">
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
                          <span className="truncate">{acc.name}</span>
                          {selectedAccount?.id === acc.id && (
                            <CheckCircle2 className="ml-auto h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Regras sugeridas pela IA */}
            {matchingRules.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium mb-2 flex items-center gap-1">
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
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        {rule.confidence_score}%
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BLOCO 5: Split Lines */}
      {action === 'split' && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Linhas do Split</span>
              <Button variant="outline" size="sm" onClick={handleAddSplitLine}>
                <Plus className="h-3 w-3 mr-1" />
                Adicionar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-2">
            {splitLines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-xs h-8">
                      {line.account_id ? (
                        <span className="truncate">
                          <span className="font-mono mr-1">{line.account_code}</span>
                          {line.account_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Conta...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar..." />
                      <CommandList>
                        <CommandEmpty>Não encontrada.</CommandEmpty>
                        <CommandGroup className="max-h-[200px] overflow-y-auto">
                          {accounts.map((acc) => (
                            <CommandItem
                              key={acc.id}
                              value={`${acc.code} ${acc.name}`}
                              onSelect={() => handleUpdateSplitLine(idx, 'account_id', acc.id)}
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
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500"
                  onClick={() => handleRemoveSplitLine(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {splitLines.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <div className={`text-sm font-medium ${isSplitBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  Total: {formatCurrency(splitTotal)} / {formatCurrency(absAmount)}
                </div>
                <Button variant="outline" size="sm" onClick={handleDistributeSplitRemaining}>
                  Auto-distribuir
                </Button>
              </div>
            )}

            {splitLines.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Clique em "Adicionar" para criar linhas do split
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* BLOCO 6: Criar Conta */}
      {action === 'create_account' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Criar Nova Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Código</Label>
                <Input
                  value={newAccountCode}
                  onChange={(e) => setNewAccountCode(e.target.value)}
                  placeholder="4.1.1.XX"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Nome da conta"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <RadioGroup 
                value={newAccountType} 
                onValueChange={setNewAccountType}
                className="flex gap-4 mt-1"
              >
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="EXPENSE" id="type_expense" />
                  <Label htmlFor="type_expense" className="text-xs">Despesa</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="REVENUE" id="type_revenue" />
                  <Label htmlFor="type_revenue" className="text-xs">Receita</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="ASSET" id="type_asset" />
                  <Label htmlFor="type_asset" className="text-xs">Ativo</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="LIABILITY" id="type_liability" />
                  <Label htmlFor="type_liability" className="text-xs">Passivo</Label>
                </div>
              </RadioGroup>
            </div>
            <Button 
              onClick={handleCreateAccount} 
              disabled={loading || !newAccountCode || !newAccountName}
              className="w-full"
              size="sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar Conta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 7: Justificativa (para contas genéricas) */}
      {(action === 'confirm' || action === 'reclassify') && isGenericAccount && (
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Justificativa (obrigatória para conta genérica)
          </Label>
          <Textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Explique por que esta conta genérica é adequada..."
            rows={2}
            className="text-sm"
          />
        </div>
      )}

      {/* BLOCO 8: Aprendizado IA */}
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

      {/* BOTÕES DE AÇÃO */}
      <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-white">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button 
          onClick={handleConfirm}
          disabled={loading || (accountWarning?.canProceed === false)}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-1" />
          )}
          Confirmar Classificação
        </Button>
      </div>
    </div>
  );
}
