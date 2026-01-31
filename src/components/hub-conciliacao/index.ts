/**
 * Index de componentes do HUB Super Conciliação
 * 
 * Este arquivo centraliza a exportação de todos os componentes relacionados
 * ao HUB de Super Conciliação implementados para o sistema Contta.
 * 
 * @author Sistema Contta - HUB Super Conciliação
 * @version 1.0.0
 */

// ============================================================================
// COMPONENTES PRINCIPAIS
// ============================================================================

export { AccountSelector } from './AccountSelector';
export type { Account as AccountSelectorAccount, AccountSelectorProps } from './AccountSelector';

export { ReclassificationSplitModal } from './ReclassificationSplitModal';

export { CreateAccountAssistant } from './CreateAccountAssistant';

export { DrCiceroApprovalPanel } from './DrCiceroApprovalPanel';

export { TransactionActionsHub } from './TransactionActionsHub';

// ============================================================================
// HOOKS
// ============================================================================

export { useClassification } from '../hooks/useClassification';
export type { 
  BankTransaction, 
  Account, 
  ClassificationRule,
  SplitLine,
  ValidationResult,
  ClassificationResult,
  ReclassificationRequest 
} from '../hooks/useClassification';

export { useAIClassificationSuggestion } from '../hooks/useAIClassificationSuggestion';
export type {
  ClassificationSuggestion,
  LearningFeedback
} from '../hooks/useAIClassificationSuggestion';

// ============================================================================
// UTILITIES
// ============================================================================

export { 
  generateBreadcrumb, 
  groupAccountsByType, 
  filterAccounts 
} from './AccountSelector';
