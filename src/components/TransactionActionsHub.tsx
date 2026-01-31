/**
 * TransactionActionsHub.tsx
 * 
 * HUB de ações para transações bancárias no Super Conciliação.
 * Centraliza classificação, reclassificação, split e criação de conta.
 * 
 * REGRAS DE OURO DO DR. CÍCERO:
 * 1. Toda transação deve ser classificada
 * 2. Reclassificação NÃO altera saldo bancário
 * 3. Split deve somar exatamente o valor original
 * 4. Conta nova requer aprovação
 * 
 * @author Sistema Contta - HUB Super Conciliação
 * @version 1.0.0
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  RefreshCw,
  Split,
  Plus,
  MoreVertical,
  Brain,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { formatCurrency } from '@/data/expensesData';
import { ReclassificationSplitModal } from './ReclassificationSplitModal';
import { CreateAccountAssistant } from './CreateAccountAssistant';
import { ClassificationDialog } from './ClassificationDialog';
import type { BankTransaction, Account } from '@/hooks/useClassification';
import type { ClassificationSuggestion } from '@/hooks/useAIClassificationSuggestion';

// ============================================================================
// TIPOS
// ============================================================================

interface TransactionActionsHubProps {
  /** Transação selecionada */
  transaction: BankTransaction;
  
  /** Conta atual (se já classificada) */
  currentAccount?: Account;
  
  /** Sugestão da IA */
  suggestion?: ClassificationSuggestion | null;
  
  /** Se a transação já está conciliada */
  isReconciled?: boolean;
  
  /** Callback após ação */
  onActionComplete?: () => void;
  
  /** Modo de exibição */
  variant?: 'buttons' | 'dropdown' | 'inline';
  
  /** Se está carregando */
  loading?: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function TransactionActionsHub({
  transaction,
  currentAccount,
  suggestion,
  isReconciled = false,
  onActionComplete,
  variant = 'buttons',
  loading = false
}: TransactionActionsHubProps) {
  // Estados dos modais
  const [classifyDialogOpen, setClassifyDialogOpen] = useState(false);
  const [reclassifyModalOpen, setReclassifyModalOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  const isIncome = transaction.amount > 0;
  const hasJournalEntry = !!transaction.journal_entry_id;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleActionComplete = () => {
    setClassifyDialogOpen(false);
    setReclassifyModalOpen(false);
    setCreateAccountOpen(false);
    onActionComplete?.();
  };

  // ============================================================================
  // RENDER ACTIONS
  // ============================================================================

  const actions = [
    {
      id: 'classify',
      label: hasJournalEntry ? 'Alterar Classificação' : 'Classificar',
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      onClick: () => setClassifyDialogOpen(true),
      disabled: false,
      show: true
    },
    {
      id: 'reclassify',
      label: 'Reclassificar / Split',
      icon: Split,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      onClick: () => setReclassifyModalOpen(true),
      disabled: !hasJournalEntry,
      show: hasJournalEntry,
      tooltip: !hasJournalEntry ? 'Classifique primeiro para poder reclassificar' : undefined
    },
    {
      id: 'create_account',
      label: 'Criar Conta',
      icon: Plus,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      onClick: () => setCreateAccountOpen(true),
      disabled: false,
      show: true
    }
  ];

  const visibleActions = actions.filter(a => a.show);

  // ============================================================================
  // RENDER VARIANTS
  // ============================================================================

  if (variant === 'dropdown') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={loading}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Ações
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {visibleActions.map(action => (
              <DropdownMenuItem
                key={action.id}
                onClick={action.onClick}
                disabled={action.disabled}
                className="flex items-center gap-2"
              >
                <action.icon className={`h-4 w-4 ${action.color}`} />
                {action.label}
              </DropdownMenuItem>
            ))}

            {suggestion && !suggestion.blocked && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="flex items-center gap-2 text-amber-600"
                  onClick={() => setClassifyDialogOpen(true)}
                >
                  <Brain className="h-4 w-4" />
                  Usar sugestão IA ({Math.round(suggestion.confidence)}%)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Modais */}
        <ClassificationDialog
          open={classifyDialogOpen}
          onOpenChange={setClassifyDialogOpen}
          transaction={transaction}
          suggestedAccount={suggestion?.account}
          onClassified={handleActionComplete}
        />

        <ReclassificationSplitModal
          open={reclassifyModalOpen}
          onOpenChange={setReclassifyModalOpen}
          transaction={transaction}
          currentAccount={currentAccount}
          onSuccess={handleActionComplete}
        />

        <CreateAccountAssistant
          open={createAccountOpen}
          onOpenChange={setCreateAccountOpen}
          suggestedType={isIncome ? 'REVENUE' : 'EXPENSE'}
          onSuccess={handleActionComplete}
        />
      </>
    );
  }

  if (variant === 'inline') {
    return (
      <>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {visibleActions.slice(0, 2).map(action => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={action.onClick}
                    disabled={action.disabled || loading}
                    className={`h-7 w-7 ${action.disabled ? 'opacity-50' : ''}`}
                  >
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.tooltip || action.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>

          {visibleActions.length > 2 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {visibleActions.slice(2).map(action => (
                  <DropdownMenuItem
                    key={action.id}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="flex items-center gap-2"
                  >
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Modais */}
        <ClassificationDialog
          open={classifyDialogOpen}
          onOpenChange={setClassifyDialogOpen}
          transaction={transaction}
          suggestedAccount={suggestion?.account}
          onClassified={handleActionComplete}
        />

        <ReclassificationSplitModal
          open={reclassifyModalOpen}
          onOpenChange={setReclassifyModalOpen}
          transaction={transaction}
          currentAccount={currentAccount}
          onSuccess={handleActionComplete}
        />

        <CreateAccountAssistant
          open={createAccountOpen}
          onOpenChange={setCreateAccountOpen}
          suggestedType={isIncome ? 'REVENUE' : 'EXPENSE'}
          onSuccess={handleActionComplete}
        />
      </>
    );
  }

  // Default: buttons
  return (
    <>
      <div className="flex flex-col gap-2">
        {/* Sugestão da IA */}
        {suggestion && (
          <div className={`p-3 rounded-lg border ${
            suggestion.blocked 
              ? 'bg-red-50 border-red-200' 
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {suggestion.blocked ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <Brain className="h-4 w-4 text-amber-600" />
              )}
              <span className={`text-sm font-medium ${
                suggestion.blocked ? 'text-red-700' : 'text-amber-700'
              }`}>
                {suggestion.blocked ? 'Classificação Bloqueada' : 'Sugestão da IA'}
              </span>
              <Badge variant={suggestion.blocked ? 'destructive' : 'secondary'}>
                {Math.round(suggestion.confidence)}%
              </Badge>
            </div>
            
            <p className="text-sm">
              {suggestion.blocked 
                ? suggestion.blockReason 
                : `${suggestion.account.code} - ${suggestion.account.name}`
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {suggestion.reason}
            </p>

            {!suggestion.blocked && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 w-full"
                onClick={() => setClassifyDialogOpen(true)}
              >
                <Zap className="h-4 w-4 mr-2" />
                Usar esta sugestão
              </Button>
            )}
          </div>
        )}

        {/* Botões de ação */}
        <div className="grid grid-cols-1 gap-2">
          {visibleActions.map(action => (
            <TooltipProvider key={action.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={action.onClick}
                    disabled={action.disabled || loading}
                    className={`justify-start ${action.bgColor} ${action.disabled ? 'opacity-50' : ''}`}
                  >
                    <action.icon className={`h-4 w-4 mr-2 ${action.color}`} />
                    {action.label}
                  </Button>
                </TooltipTrigger>
                {action.tooltip && (
                  <TooltipContent>
                    <p>{action.tooltip}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Info adicional */}
        {hasJournalEntry && currentAccount && (
          <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
            <span className="font-medium">Classificado em:</span>
            <br />
            <Badge variant="outline" className="mt-1">
              {currentAccount.code} - {currentAccount.name}
            </Badge>
          </div>
        )}
      </div>

      {/* Modais */}
      <ClassificationDialog
        open={classifyDialogOpen}
        onOpenChange={setClassifyDialogOpen}
        transaction={transaction}
        suggestedAccount={suggestion?.account}
        onClassified={handleActionComplete}
      />

      <ReclassificationSplitModal
        open={reclassifyModalOpen}
        onOpenChange={setReclassifyModalOpen}
        transaction={transaction}
        currentAccount={currentAccount}
        onSuccess={handleActionComplete}
      />

      <CreateAccountAssistant
        open={createAccountOpen}
        onOpenChange={setCreateAccountOpen}
        suggestedType={isIncome ? 'REVENUE' : 'EXPENSE'}
        onSuccess={handleActionComplete}
      />
    </>
  );
}

export default TransactionActionsHub;
