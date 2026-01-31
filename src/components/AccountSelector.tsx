/**
 * AccountSelector.tsx
 * 
 * REGRA DE OURO DO DR. CÍCERO:
 * "Contas inativas NÃO aparecem e NÃO são aceitas"
 * 
 * Componente reutilizável para seleção de contas contábeis.
 * Centraliza toda a lógica de filtros, busca e breadcrumb de hierarquia.
 * 
 * @author Sistema Contta - HUB Super Conciliação
 * @version 1.0.0
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { cn } from '@/lib/utils';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Check,
  ChevronsUpDown,
  ChevronRight,
  AlertTriangle,
  Building,
  Landmark,
  Wallet,
  TrendingUp,
  TrendingDown,
  BookOpen
} from 'lucide-react';

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  is_analytical: boolean;
  is_active: boolean;
  parent_code?: string;
  balance_type?: 'DEBIT' | 'CREDIT';
}

export interface AccountSelectorProps {
  /** Valor selecionado (account_id) */
  value: string | null;
  
  /** Callback quando uma conta é selecionada */
  onChange: (account: Account | null) => void;
  
  /** Tipo de transação para filtrar contas por natureza */
  transactionType?: 'credit' | 'debit' | 'both';
  
  /** Tipos de conta permitidos */
  accountTypes?: Account['type'][];
  
  /** Códigos de contas a excluir (ex: transitórias) */
  excludeCodes?: string[];
  
  /** Mostrar apenas contas analíticas (que recebem lançamentos) */
  analyticalOnly?: boolean;
  
  /** Placeholder do input */
  placeholder?: string;
  
  /** Desabilitar seleção */
  disabled?: boolean;
  
  /** Classe CSS adicional */
  className?: string;
  
  /** Mostrar breadcrumb da hierarquia */
  showBreadcrumb?: boolean;
  
  /** Alerta customizado */
  warningMessage?: string;
  
  /** Callback para validação customizada */
  onValidate?: (account: Account) => { valid: boolean; message?: string };
}

// ============================================================================
// CONSTANTES
// ============================================================================

const TYPE_LABELS: Record<Account['type'], { label: string; icon: typeof Building; color: string }> = {
  ASSET: { label: 'Ativo', icon: Building, color: 'bg-blue-100 text-blue-800' },
  LIABILITY: { label: 'Passivo', icon: Landmark, color: 'bg-red-100 text-red-800' },
  EQUITY: { label: 'PL', icon: Wallet, color: 'bg-purple-100 text-purple-800' },
  REVENUE: { label: 'Receita', icon: TrendingUp, color: 'bg-green-100 text-green-800' },
  EXPENSE: { label: 'Despesa', icon: TrendingDown, color: 'bg-orange-100 text-orange-800' },
};

// Contas transitórias (padrão para excluir em classificações normais)
const DEFAULT_EXCLUDED_CODES = ['1.1.9.01', '2.1.9.01'];

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Gera o breadcrumb de uma conta baseado no código
 * Ex: "4.1.1.01" → ["4 - Despesas", "4.1 - Operacionais", "4.1.1 - Administrativas"]
 */
function generateBreadcrumb(code: string, accounts: Account[]): string[] {
  const parts = code.split('.');
  const breadcrumb: string[] = [];
  
  for (let i = 1; i < parts.length; i++) {
    const parentCode = parts.slice(0, i).join('.');
    const parent = accounts.find(a => a.code === parentCode);
    if (parent) {
      breadcrumb.push(`${parent.code} - ${parent.name}`);
    }
  }
  
  return breadcrumb;
}

/**
 * Agrupa contas por tipo
 */
function groupAccountsByType(accounts: Account[]): Record<string, Account[]> {
  return accounts.reduce((acc, account) => {
    const type = account.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(account);
    return acc;
  }, {} as Record<string, Account[]>);
}

/**
 * Filtra contas baseado nos critérios
 */
function filterAccounts(
  accounts: Account[],
  options: {
    transactionType?: 'credit' | 'debit' | 'both';
    accountTypes?: Account['type'][];
    excludeCodes?: string[];
    analyticalOnly?: boolean;
    searchTerm?: string;
  }
): Account[] {
  let filtered = accounts.filter(a => a.is_active);
  
  // Filtrar por tipo de conta
  if (options.accountTypes && options.accountTypes.length > 0) {
    filtered = filtered.filter(a => options.accountTypes!.includes(a.type));
  }
  
  // Filtrar por natureza da transação
  if (options.transactionType && options.transactionType !== 'both') {
    if (options.transactionType === 'credit') {
      // Entrada → geralmente RECEITA, PASSIVO ou ATIVO (recebimento)
      filtered = filtered.filter(a => 
        ['REVENUE', 'LIABILITY', 'ASSET'].includes(a.type)
      );
    } else {
      // Saída → geralmente DESPESA, ATIVO (pagamento) ou PASSIVO (quitação)
      filtered = filtered.filter(a => 
        ['EXPENSE', 'ASSET', 'LIABILITY'].includes(a.type)
      );
    }
  }
  
  // Excluir códigos específicos
  if (options.excludeCodes && options.excludeCodes.length > 0) {
    filtered = filtered.filter(a => 
      !options.excludeCodes!.some(code => a.code.startsWith(code))
    );
  }
  
  // Apenas analíticas
  if (options.analyticalOnly) {
    filtered = filtered.filter(a => a.is_analytical);
  }
  
  // Busca por texto
  if (options.searchTerm) {
    const term = options.searchTerm.toLowerCase();
    filtered = filtered.filter(a => 
      a.code.toLowerCase().includes(term) ||
      a.name.toLowerCase().includes(term)
    );
  }
  
  return filtered.sort((a, b) => a.code.localeCompare(b.code));
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function AccountSelector({
  value,
  onChange,
  transactionType = 'both',
  accountTypes,
  excludeCodes = DEFAULT_EXCLUDED_CODES,
  analyticalOnly = true,
  placeholder = 'Selecione uma conta...',
  disabled = false,
  className,
  showBreadcrumb = true,
  warningMessage,
  onValidate
}: AccountSelectorProps) {
  const { tenant } = useTenantConfig();
  
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]); // Para breadcrumb
  const [loading, setLoading] = useState(true);

  // ============================================================================
  // CARREGAR CONTAS
  // ============================================================================

  useEffect(() => {
    async function loadAccounts() {
      if (!tenant?.id) return;
      
      setLoading(true);
      
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type, is_analytical, is_active, parent_code, balance_type')
        .eq('tenant_id', tenant.id)
        .order('code');
      
      if (error) {
        console.error('Erro ao carregar contas:', error);
        setLoading(false);
        return;
      }
      
      setAllAccounts(data || []);
      setLoading(false);
    }
    
    loadAccounts();
  }, [tenant?.id]);

  // ============================================================================
  // FILTRAGEM E MEMOIZAÇÃO
  // ============================================================================

  const filteredAccounts = useMemo(() => {
    return filterAccounts(allAccounts, {
      transactionType,
      accountTypes,
      excludeCodes,
      analyticalOnly,
      searchTerm: search
    });
  }, [allAccounts, transactionType, accountTypes, excludeCodes, analyticalOnly, search]);

  const groupedAccounts = useMemo(() => {
    return groupAccountsByType(filteredAccounts);
  }, [filteredAccounts]);

  const selectedAccount = useMemo(() => {
    if (!value) return null;
    return allAccounts.find(a => a.id === value) || null;
  }, [value, allAccounts]);

  const breadcrumb = useMemo(() => {
    if (!selectedAccount || !showBreadcrumb) return [];
    return generateBreadcrumb(selectedAccount.code, allAccounts);
  }, [selectedAccount, allAccounts, showBreadcrumb]);

  const validation = useMemo(() => {
    if (!selectedAccount || !onValidate) return null;
    return onValidate(selectedAccount);
  }, [selectedAccount, onValidate]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSelect = useCallback((accountId: string) => {
    const account = allAccounts.find(a => a.id === accountId);
    onChange(account || null);
    setOpen(false);
    setSearch('');
  }, [allAccounts, onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const TypeIcon = selectedAccount ? TYPE_LABELS[selectedAccount.type].icon : BookOpen;
  const typeInfo = selectedAccount ? TYPE_LABELS[selectedAccount.type] : null;

  return (
    <div className={cn('space-y-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className={cn(
              'w-full justify-between text-left font-normal h-auto min-h-[40px] py-2',
              !value && 'text-muted-foreground',
              validation && !validation.valid && 'border-red-500',
              warningMessage && 'border-yellow-500'
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Carregando contas...
              </span>
            ) : selectedAccount ? (
              <div className="flex flex-col gap-1 flex-1 mr-2">
                <div className="flex items-center gap-2">
                  <TypeIcon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{selectedAccount.code}</span>
                  <span className="text-muted-foreground">-</span>
                  <span className="truncate">{selectedAccount.name}</span>
                </div>
                {showBreadcrumb && breadcrumb.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {breadcrumb.map((item, index) => (
                      <span key={index} className="flex items-center gap-1">
                        {index > 0 && <ChevronRight className="h-3 w-3" />}
                        <span className="truncate max-w-[100px]">{item.split(' - ')[0]}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span>{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[500px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Buscar por código ou nome..." 
              value={search}
              onValueChange={setSearch}
            />
            
            <CommandList>
              <CommandEmpty>
                {search 
                  ? 'Nenhuma conta encontrada com esses critérios'
                  : 'Nenhuma conta disponível'
                }
              </CommandEmpty>
              
              <ScrollArea className="h-[300px]">
                {Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
                  const info = TYPE_LABELS[type as Account['type']];
                  if (!info || typeAccounts.length === 0) return null;
                  
                  return (
                    <CommandGroup 
                      key={type}
                      heading={
                        <div className="flex items-center gap-2">
                          <info.icon className="h-4 w-4" />
                          <span>{info.label}</span>
                          <Badge variant="outline" className="ml-auto">
                            {typeAccounts.length}
                          </Badge>
                        </div>
                      }
                    >
                      {typeAccounts.map((account) => (
                        <CommandItem
                          key={account.id}
                          value={account.id}
                          onSelect={() => handleSelect(account.id)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Check
                            className={cn(
                              'h-4 w-4',
                              value === account.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <Badge 
                            variant="outline" 
                            className={cn('font-mono text-xs', info.color)}
                          >
                            {account.code}
                          </Badge>
                          <span className="flex-1 truncate">{account.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Badges e warnings */}
      {selectedAccount && typeInfo && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn('text-xs', typeInfo.color)}>
            <typeInfo.icon className="h-3 w-3 mr-1" />
            {typeInfo.label}
          </Badge>
          
          {selectedAccount.balance_type && (
            <Badge variant="outline" className="text-xs">
              Natureza: {selectedAccount.balance_type === 'DEBIT' ? 'Devedora' : 'Credora'}
            </Badge>
          )}
        </div>
      )}

      {/* Mensagem de alerta customizada */}
      {warningMessage && (
        <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <span>{warningMessage}</span>
        </div>
      )}

      {/* Validação customizada */}
      {validation && !validation.valid && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
          <AlertTriangle className="h-4 w-4" />
          <span>{validation.message}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXPORT UTILITÁRIOS
// ============================================================================

export { generateBreadcrumb, groupAccountsByType, filterAccounts };
export type { Account as AccountType };
