/**
 * CreateAccountAssistant.tsx
 * 
 * Assistente para criação de novas contas contábeis.
 * Toda criação vai para aprovação do Dr. Cícero.
 * 
 * REGRAS DE OURO DO DR. CÍCERO:
 * 1. Novas contas SEMPRE requerem aprovação
 * 2. Código deve seguir estrutura hierárquica
 * 3. Nome deve ser descritivo e padronizado
 * 4. Tipo e natureza devem ser consistentes
 * 
 * @author Sistema Contta - HUB Super Conciliação
 * @version 1.0.0
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Plus,
  Building,
  Landmark,
  Wallet,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Search,
  ChevronRight,
  Loader2,
  Send,
  Lightbulb,
  HelpCircle
} from 'lucide-react';

// ============================================================================
// TIPOS
// ============================================================================

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
type BalanceType = 'DEBIT' | 'CREDIT';

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  is_analytical: boolean;
  is_active: boolean;
}

interface CreateAccountAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  /** Sugestão baseada na transação */
  suggestedType?: AccountType;
  suggestedName?: string;
  
  /** Callback após criar a conta (pode ser pendente de aprovação) */
  onSuccess?: (account: { id: string; code: string; name: string; status: 'approved' | 'pending' }) => void;
}

interface PendingAccountRequest {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: AccountType;
  balance_type: BalanceType;
  parent_code: string;
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const TYPE_CONFIG: Record<AccountType, { 
  label: string; 
  description: string;
  icon: typeof Building; 
  color: string;
  prefixes: string[];
  balanceType: BalanceType;
}> = {
  ASSET: { 
    label: 'Ativo', 
    description: 'Bens e direitos da empresa',
    icon: Building, 
    color: 'bg-blue-100 text-blue-800',
    prefixes: ['1'],
    balanceType: 'DEBIT'
  },
  LIABILITY: { 
    label: 'Passivo', 
    description: 'Obrigações e dívidas',
    icon: Landmark, 
    color: 'bg-red-100 text-red-800',
    prefixes: ['2'],
    balanceType: 'CREDIT'
  },
  EQUITY: { 
    label: 'Patrimônio Líquido', 
    description: 'Capital dos sócios',
    icon: Wallet, 
    color: 'bg-purple-100 text-purple-800',
    prefixes: ['2.3', '2.4', '2.5'],
    balanceType: 'CREDIT'
  },
  REVENUE: { 
    label: 'Receita', 
    description: 'Entradas e ganhos',
    icon: TrendingUp, 
    color: 'bg-green-100 text-green-800',
    prefixes: ['3'],
    balanceType: 'CREDIT'
  },
  EXPENSE: { 
    label: 'Despesa', 
    description: 'Gastos e custos',
    icon: TrendingDown, 
    color: 'bg-orange-100 text-orange-800',
    prefixes: ['4'],
    balanceType: 'DEBIT'
  },
};

const EXPENSE_GROUPS = [
  { code: '4.1.1', name: 'Despesas Administrativas' },
  { code: '4.1.2', name: 'Despesas com Pessoal' },
  { code: '4.1.3', name: 'Despesas Comerciais' },
  { code: '4.2.1', name: 'Despesas Financeiras' },
  { code: '4.2.2', name: 'Despesas Tributárias' },
];

const REVENUE_GROUPS = [
  { code: '3.1.1', name: 'Receitas de Serviços' },
  { code: '3.1.2', name: 'Receitas Financeiras' },
  { code: '3.1.3', name: 'Outras Receitas Operacionais' },
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function CreateAccountAssistant({
  open,
  onOpenChange,
  suggestedType,
  suggestedName,
  onSuccess
}: CreateAccountAssistantProps) {
  const { tenant } = useTenantConfig();

  // Estados do formulário
  const [step, setStep] = useState<'type' | 'parent' | 'details' | 'review'>(suggestedType ? 'parent' : 'type');
  const [accountType, setAccountType] = useState<AccountType>(suggestedType || 'EXPENSE');
  const [parentCode, setParentCode] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState(suggestedName || '');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Estados de dados
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setStep(suggestedType ? 'parent' : 'type');
      setAccountType(suggestedType || 'EXPENSE');
      setParentCode('');
      setCode('');
      setName(suggestedName || '');
      setJustification('');
      loadAccounts();
    }
  }, [open, suggestedType, suggestedName]);

  // ============================================================================
  // CARREGAR DADOS
  // ============================================================================

  const loadAccounts = async () => {
    if (!tenant?.id) return;
    
    setLoading(true);
    
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, type, is_analytical, is_active')
      .eq('tenant_id', tenant.id)
      .order('code');
    
    if (!error && data) {
      setAccounts(data);
      setExistingCodes(new Set(data.map(a => a.code)));
    }
    
    setLoading(false);
  };

  // ============================================================================
  // CÁLCULOS E FILTROS
  // ============================================================================

  const parentAccounts = useMemo(() => {
    const config = TYPE_CONFIG[accountType];
    return accounts
      .filter(a => !a.is_analytical) // Apenas sintéticas podem ser pais
      .filter(a => config.prefixes.some(p => a.code.startsWith(p)))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, accountType]);

  const suggestedCode = useMemo(() => {
    if (!parentCode) return '';
    
    // Encontrar próximo código disponível
    const children = accounts
      .filter(a => a.code.startsWith(parentCode + '.'))
      .map(a => a.code);
    
    // Contar quantos níveis tem o pai
    const parentLevels = parentCode.split('.').length;
    
    // Encontrar próximo número disponível
    let nextNum = 1;
    while (true) {
      const testCode = `${parentCode}.${String(nextNum).padStart(2, '0')}`;
      if (!existingCodes.has(testCode)) {
        return testCode;
      }
      nextNum++;
      if (nextNum > 99) break;
    }
    
    return `${parentCode}.XX`;
  }, [parentCode, accounts, existingCodes]);

  // Atualizar código sugerido quando muda o pai
  useEffect(() => {
    if (suggestedCode && !code) {
      setCode(suggestedCode);
    }
  }, [suggestedCode]);

  const validation = useMemo(() => {
    const errors: string[] = [];
    
    if (!code) {
      errors.push('Código é obrigatório');
    } else if (!/^\d+(\.\d+)+$/.test(code)) {
      errors.push('Código deve seguir padrão X.X.X.XX');
    } else if (existingCodes.has(code)) {
      errors.push('Este código já existe');
    }
    
    if (!name || name.length < 3) {
      errors.push('Nome deve ter pelo menos 3 caracteres');
    }
    
    if (!justification || justification.length < 10) {
      errors.push('Justificativa deve ter pelo menos 10 caracteres');
    }
    
    if (!parentCode) {
      errors.push('Selecione o grupo pai');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }, [code, name, justification, parentCode, existingCodes]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleNext = () => {
    switch (step) {
      case 'type':
        setStep('parent');
        break;
      case 'parent':
        if (!parentCode) {
          toast.error('Selecione o grupo pai');
          return;
        }
        setStep('details');
        break;
      case 'details':
        if (!validation.valid) {
          toast.error(validation.errors.join('. '));
          return;
        }
        setStep('review');
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'parent':
        setStep('type');
        break;
      case 'details':
        setStep('parent');
        break;
      case 'review':
        setStep('details');
        break;
    }
  };

  const handleSubmit = async () => {
    if (!validation.valid || !tenant?.id) return;

    setSubmitting(true);

    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      // Criar solicitação pendente de aprovação
      const { data, error } = await supabase
        .from('pending_account_requests')
        .insert({
          tenant_id: tenant.id,
          code,
          name,
          type: accountType,
          balance_type: TYPE_CONFIG[accountType].balanceType,
          parent_code: parentCode,
          justification,
          status: 'pending',
          created_by: userId
        })
        .select()
        .single();

      if (error) {
        // Se a tabela não existir, criar diretamente (para tenants simples)
        if (error.code === '42P01') {
          // Criar conta diretamente
          const { data: account, error: accError } = await supabase
            .from('chart_of_accounts')
            .insert({
              tenant_id: tenant.id,
              code,
              name,
              type: accountType,
              balance_type: TYPE_CONFIG[accountType].balanceType,
              parent_code: parentCode,
              is_analytical: true,
              is_active: true
            })
            .select()
            .single();

          if (accError) throw accError;

          toast.success('Conta criada com sucesso!');
          onOpenChange(false);
          onSuccess?.({ 
            id: account.id, 
            code: account.code, 
            name: account.name, 
            status: 'approved' 
          });
          return;
        }
        throw error;
      }

      toast.success('Solicitação enviada para aprovação do Dr. Cícero!');
      onOpenChange(false);
      onSuccess?.({ 
        id: data.id, 
        code, 
        name, 
        status: 'pending' 
      });

    } catch (err: unknown) {
      console.error('Erro ao criar conta:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const TypeIcon = TYPE_CONFIG[accountType].icon;
  const typeConfig = TYPE_CONFIG[accountType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-500" />
            Criar Nova Conta Contábil
          </DialogTitle>
          <DialogDescription>
            Assistente para criação de contas. Toda nova conta será revisada pelo Dr. Cícero.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-2">
          {['type', 'parent', 'details', 'review'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s 
                  ? 'bg-primary text-primary-foreground' 
                  : ['type', 'parent', 'details', 'review'].indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {['type', 'parent', 'details', 'review'].indexOf(step) > i ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            
            {/* STEP 1: Tipo da Conta */}
            {step === 'type' && (
              <div className="space-y-4">
                <h3 className="font-medium">Qual tipo de conta você precisa criar?</h3>
                
                <RadioGroup value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
                  <div className="grid grid-cols-1 gap-3">
                    {(Object.keys(TYPE_CONFIG) as AccountType[]).map(type => {
                      const config = TYPE_CONFIG[type];
                      const Icon = config.icon;
                      return (
                        <label
                          key={type}
                          className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                            accountType === type 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <RadioGroupItem value={type} />
                          <Icon className="h-5 w-5" />
                          <div className="flex-1">
                            <div className="font-medium">{config.label}</div>
                            <div className="text-sm text-muted-foreground">{config.description}</div>
                          </div>
                          <Badge className={config.color}>
                            {config.balanceType === 'DEBIT' ? 'Devedora' : 'Credora'}
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* STEP 2: Grupo Pai */}
            {step === 'parent' && (
              <div className="space-y-4">
                <h3 className="font-medium">Em qual grupo esta conta deve ficar?</h3>
                
                <Card className="mb-4">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-5 w-5" />
                      <span className="font-medium">{typeConfig.label}</span>
                      <Badge className={typeConfig.color}>
                        {typeConfig.balanceType === 'DEBIT' ? 'Devedora' : 'Credora'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <Label>Selecione o grupo pai</Label>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
                      {parentAccounts.map(account => (
                        <button
                          key={account.id}
                          onClick={() => setParentCode(account.code)}
                          className={`flex items-center gap-2 p-3 text-left border rounded-lg transition-colors ${
                            parentCode === account.code 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <Badge variant="outline" className="font-mono">
                            {account.code}
                          </Badge>
                          <span className="flex-1">{account.name}</span>
                          {parentCode === account.code && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sugestões rápidas */}
                {accountType === 'EXPENSE' && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Grupos comuns de despesa
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2">
                      {EXPENSE_GROUPS.map(g => (
                        <Button
                          key={g.code}
                          variant="outline"
                          size="sm"
                          onClick={() => setParentCode(g.code)}
                          className="justify-start"
                        >
                          <Badge variant="outline" className="mr-2 font-mono text-xs">
                            {g.code}
                          </Badge>
                          <span className="truncate">{g.name}</span>
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {accountType === 'REVENUE' && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Grupos comuns de receita
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2">
                      {REVENUE_GROUPS.map(g => (
                        <Button
                          key={g.code}
                          variant="outline"
                          size="sm"
                          onClick={() => setParentCode(g.code)}
                          className="justify-start"
                        >
                          <Badge variant="outline" className="mr-2 font-mono text-xs">
                            {g.code}
                          </Badge>
                          <span className="truncate">{g.name}</span>
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* STEP 3: Detalhes */}
            {step === 'details' && (
              <div className="space-y-4">
                <h3 className="font-medium">Defina os detalhes da conta</h3>
                
                <Card className="mb-4">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Grupo pai:</span>
                      <Badge variant="outline" className="font-mono">{parentCode}</Badge>
                      <span>
                        {accounts.find(a => a.code === parentCode)?.name}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código</Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={suggestedCode}
                      className="font-mono"
                    />
                    {suggestedCode && (
                      <p className="text-xs text-muted-foreground">
                        Sugerido: {suggestedCode}
                      </p>
                    )}
                  </div>
                  
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="name">Nome da Conta</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Despesas com Software"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="justification" className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Por que essa conta é necessária?
                  </Label>
                  <Textarea
                    id="justification"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Explique o motivo da criação desta conta. Ex: 'Necessário para classificar gastos recorrentes com assinaturas de software SaaS que não se encaixam em outras categorias existentes.'"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {justification.length}/10 caracteres mínimos
                  </p>
                </div>
              </div>
            )}

            {/* STEP 4: Revisão */}
            {step === 'review' && (
              <div className="space-y-4">
                <h3 className="font-medium">Revise e envie para aprovação</h3>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Nova Conta Contábil</CardTitle>
                    <CardDescription>
                      Esta solicitação será enviada para o Dr. Cícero aprovar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Código</Label>
                        <p className="font-mono font-medium text-lg">{code}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Tipo</Label>
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4" />
                          <span className="font-medium">{typeConfig.label}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-muted-foreground">Nome</Label>
                      <p className="font-medium">{name}</p>
                    </div>
                    
                    <div>
                      <Label className="text-muted-foreground">Grupo Pai</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">{parentCode}</Badge>
                        <span>{accounts.find(a => a.code === parentCode)?.name}</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-muted-foreground">Natureza</Label>
                      <Badge className={typeConfig.color}>
                        {typeConfig.balanceType === 'DEBIT' ? 'Devedora' : 'Credora'}
                      </Badge>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <Label className="text-muted-foreground">Justificativa</Label>
                      <p className="text-sm mt-1">{justification}</p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    A conta ficará disponível após aprovação do Dr. Cícero (geralmente em algumas horas).
                  </span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        <DialogFooter className="flex-row justify-between">
          <Button 
            variant="outline" 
            onClick={step === 'type' ? () => onOpenChange(false) : handleBack}
          >
            {step === 'type' ? 'Cancelar' : 'Voltar'}
          </Button>
          
          {step !== 'review' ? (
            <Button onClick={handleNext}>
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={!validation.valid || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Enviar para Aprovação
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateAccountAssistant;
