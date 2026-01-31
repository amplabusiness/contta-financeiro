/**
 * ReclassificationSplitModal.tsx
 * 
 * Modal para reclassificação e split de lançamentos contábeis.
 * 
 * REGRAS DE OURO DO DR. CÍCERO:
 * 1. Reclassificação NÃO altera saldo bancário
 * 2. Split deve somar exatamente o valor original
 * 3. Toda reclassificação requer aprovação do Dr. Cícero
 * 4. Justificativa é obrigatória (mín. 10 caracteres)
 * 
 * @author Sistema Contta - HUB Super Conciliação
 * @version 1.0.0
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { useClassification, type BankTransaction, type Account, type SplitLine } from '@/hooks/useClassification';
import { AccountSelector } from '@/components/AccountSelector';
import { formatCurrency } from '@/data/expensesData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Split,
  RefreshCw,
  Calculator,
  Send,
  Save,
  ArrowRight,
  DollarSign,
  FileText,
  Loader2
} from 'lucide-react';

// ============================================================================
// TIPOS
// ============================================================================

interface ReclassificationSplitModalProps {
  /** Transação bancária sendo reclassificada */
  transaction: BankTransaction;
  
  /** Conta atual da classificação (se houver) */
  currentAccount?: Account;
  
  /** Controle de abertura do modal */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  /** Callback após sucesso */
  onSuccess?: (result: { reclassification_id?: string; entry_id?: string }) => void;
}

interface SplitLineWithUI extends SplitLine {
  id: string; // ID temporário para UI
  isValid?: boolean;
  error?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function ReclassificationSplitModal({
  transaction,
  currentAccount,
  open,
  onOpenChange,
  onSuccess
}: ReclassificationSplitModalProps) {
  const { tenant } = useTenantConfig();
  const {
    loading,
    accounts,
    isIncome,
    transactionType,
    absAmount,
    createReclassification,
    validateClassification
  } = useClassification(transaction);

  // Estados
  const [mode, setMode] = useState<'reclassify' | 'split'>('reclassify');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Estados para Split
  const [splitLines, setSplitLines] = useState<SplitLineWithUI[]>([
    { id: crypto.randomUUID(), account_id: '', amount: 0, description: '' },
    { id: crypto.randomUUID(), account_id: '', amount: 0, description: '' }
  ]);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setSelectedAccount(null);
      setJustification('');
      setSplitLines([
        { id: crypto.randomUUID(), account_id: '', amount: 0, description: '' },
        { id: crypto.randomUUID(), account_id: '', amount: 0, description: '' }
      ]);
      setMode('reclassify');
    }
  }, [open]);

  // ============================================================================
  // CÁLCULOS E VALIDAÇÕES
  // ============================================================================

  const splitTotal = useMemo(() => {
    return splitLines.reduce((sum, line) => sum + (line.amount || 0), 0);
  }, [splitLines]);

  const splitDifference = useMemo(() => {
    return absAmount - splitTotal;
  }, [absAmount, splitTotal]);

  const isSplitBalanced = useMemo(() => {
    return Math.abs(splitDifference) < 0.01;
  }, [splitDifference]);

  const validation = useMemo(() => {
    if (mode === 'reclassify') {
      if (!selectedAccount) {
        return { valid: false, error: 'Selecione uma conta destino' };
      }
      return validateClassification(selectedAccount, justification);
    }
    
    // Validação do Split
    const errors: string[] = [];
    
    if (splitLines.length < 2) {
      errors.push('Split deve ter pelo menos 2 linhas');
    }
    
    const emptyLines = splitLines.filter(l => !l.account_id || l.amount <= 0);
    if (emptyLines.length > 0) {
      errors.push('Todas as linhas devem ter conta e valor');
    }
    
    if (!isSplitBalanced) {
      errors.push(`Diferença de ${formatCurrency(Math.abs(splitDifference))}`);
    }
    
    if (justification.trim().length < 10) {
      errors.push('Justificativa deve ter pelo menos 10 caracteres');
    }
    
    return {
      valid: errors.length === 0,
      error: errors.join('. ')
    };
  }, [mode, selectedAccount, splitLines, isSplitBalanced, splitDifference, justification, validateClassification]);

  // ============================================================================
  // HANDLERS - SPLIT
  // ============================================================================

  const handleAddLine = () => {
    setSplitLines([...splitLines, { 
      id: crypto.randomUUID(), 
      account_id: '', 
      amount: 0, 
      description: '' 
    }]);
  };

  const handleRemoveLine = (id: string) => {
    if (splitLines.length <= 2) {
      toast.error('Split deve ter pelo menos 2 linhas');
      return;
    }
    setSplitLines(splitLines.filter(l => l.id !== id));
  };

  const handleUpdateLine = (id: string, field: keyof SplitLineWithUI, value: any) => {
    setSplitLines(splitLines.map(line => {
      if (line.id !== id) return line;
      
      const updated = { ...line, [field]: value };
      
      // Se atualizou o account_id, buscar info da conta
      if (field === 'account_id' && value) {
        const account = accounts.find(a => a.id === value);
        if (account) {
          updated.account_code = account.code;
          updated.account_name = account.name;
        }
      }
      
      return updated;
    }));
  };

  const handleDistributeRemaining = () => {
    if (splitLines.length === 0) return;
    
    const othersTotal = splitLines.slice(0, -1).reduce((sum, l) => sum + (l.amount || 0), 0);
    const remaining = absAmount - othersTotal;
    
    setSplitLines(splitLines.map((line, index) => {
      if (index === splitLines.length - 1) {
        return { ...line, amount: Math.max(0, remaining) };
      }
      return line;
    }));
  };

  const handleDistributeEqually = () => {
    const valuePerLine = absAmount / splitLines.length;
    const rounded = Math.floor(valuePerLine * 100) / 100;
    
    setSplitLines(splitLines.map((line, index) => {
      // Última linha recebe o resto para garantir que some exatamente
      if (index === splitLines.length - 1) {
        const othersTotal = rounded * (splitLines.length - 1);
        return { ...line, amount: absAmount - othersTotal };
      }
      return { ...line, amount: rounded };
    }));
  };

  // ============================================================================
  // SUBMIT
  // ============================================================================

  const handleSubmit = async (submitForApproval: boolean) => {
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSubmitting(true);

    try {
      if (mode === 'reclassify' && selectedAccount) {
        // Reclassificação simples (1 para 1)
        const result = await createReclassification(
          transaction.journal_entry_id || '',
          [{ 
            account_id: selectedAccount.id, 
            account_code: selectedAccount.code,
            account_name: selectedAccount.name,
            amount: absAmount,
            description: justification
          }],
          justification,
          submitForApproval
        );

        if (result.success) {
          onOpenChange(false);
          onSuccess?.(result);
        }
      } else {
        // Split
        const result = await createReclassification(
          transaction.journal_entry_id || '',
          splitLines.map(l => ({
            account_id: l.account_id,
            account_code: l.account_code,
            account_name: l.account_name,
            amount: l.amount,
            description: l.description || justification
          })),
          justification,
          submitForApproval
        );

        if (result.success) {
          onOpenChange(false);
          onSuccess?.(result);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'reclassify' ? (
              <>
                <RefreshCw className="h-5 w-5 text-blue-500" />
                Reclassificar Transação
              </>
            ) : (
              <>
                <Split className="h-5 w-5 text-purple-500" />
                Desmembrar Transação (Split)
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {mode === 'reclassify' 
              ? 'Altere a classificação contábil desta transação. O saldo bancário permanece inalterado.'
              : 'Divida esta transação em múltiplas contas contábeis. O saldo bancário permanece inalterado.'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Informações da Transação */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Transação Original</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valor:</span>
                  <Badge 
                    variant={isIncome ? 'default' : 'destructive'}
                    className="text-lg font-bold"
                  >
                    {formatCurrency(transaction.amount)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span>{format(new Date(transaction.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Descrição:</span>
                  <span className="text-right max-w-[300px] truncate">{transaction.description}</span>
                </div>
                {currentAccount && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-muted-foreground">Conta Atual:</span>
                    <Badge variant="outline">{currentAccount.code} - {currentAccount.name}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs para modo */}
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="reclassify" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Reclassificar
                </TabsTrigger>
                <TabsTrigger value="split" className="flex items-center gap-2">
                  <Split className="h-4 w-4" />
                  Desmembrar (Split)
                </TabsTrigger>
              </TabsList>

              {/* Tab Reclassificar */}
              <TabsContent value="reclassify" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nova Conta Contábil</Label>
                  <AccountSelector
                    value={selectedAccount?.id || null}
                    onChange={(acc) => setSelectedAccount(acc as Account | null)}
                    transactionType={transactionType}
                    analyticalOnly={true}
                    showBreadcrumb={true}
                    placeholder="Selecione a nova conta..."
                  />
                </div>

                {currentAccount && selectedAccount && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">DE</p>
                          <Badge variant="outline" className="mt-1">
                            {currentAccount.code}
                          </Badge>
                          <p className="text-xs mt-1">{currentAccount.name}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">PARA</p>
                          <Badge variant="default" className="mt-1">
                            {selectedAccount.code}
                          </Badge>
                          <p className="text-xs mt-1">{selectedAccount.name}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Tab Split */}
              <TabsContent value="split" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={isSplitBalanced ? 'default' : 'destructive'}>
                      {isSplitBalanced ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Balanceado
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Diferença: {formatCurrency(Math.abs(splitDifference))}
                        </>
                      )}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDistributeEqually}
                    >
                      <Calculator className="h-4 w-4 mr-1" />
                      Dividir Igual
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDistributeRemaining}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Distribuir Resto
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAddLine}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Linha
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {splitLines.map((line, index) => (
                    <Card key={line.id} className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-8 justify-center">
                              {index + 1}
                            </Badge>
                            <div className="flex-1">
                              <AccountSelector
                                value={line.account_id || null}
                                onChange={(acc) => handleUpdateLine(line.id, 'account_id', acc?.id || '')}
                                transactionType={transactionType}
                                analyticalOnly={true}
                                showBreadcrumb={false}
                                placeholder="Selecione a conta..."
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-10">
                            <div className="w-32">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.amount || ''}
                                onChange={(e) => handleUpdateLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                                placeholder="Valor"
                                className="text-right"
                              />
                            </div>
                            <Input
                              value={line.description || ''}
                              onChange={(e) => handleUpdateLine(line.id, 'description', e.target.value)}
                              placeholder="Descrição (opcional)"
                              className="flex-1"
                            />
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLine(line.id)}
                          disabled={splitLines.length <= 2}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Resumo do Split */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <span>Total Original:</span>
                      <span className="font-bold">{formatCurrency(absAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Total Split:</span>
                      <span className={isSplitBalanced ? 'font-bold text-green-600' : 'font-bold text-red-600'}>
                        {formatCurrency(splitTotal)}
                      </span>
                    </div>
                    {!isSplitBalanced && (
                      <div className="flex justify-between items-center text-red-600">
                        <span>Diferença:</span>
                        <span className="font-bold">{formatCurrency(splitDifference)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Justificativa (comum aos dois modos) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Justificativa (obrigatória)
              </Label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explique o motivo da reclassificação/split. Esta informação será revisada pelo Dr. Cícero."
                rows={3}
                className={justification.length < 10 ? 'border-yellow-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                {justification.length}/10 caracteres mínimos
              </p>
            </div>

            {/* Validação */}
            {!validation.valid && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{validation.error}</span>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={!validation.valid || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Salvar Rascunho
          </Button>
          
          <Button
            onClick={() => handleSubmit(true)}
            disabled={!validation.valid || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            Enviar para Aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReclassificationSplitModal;
