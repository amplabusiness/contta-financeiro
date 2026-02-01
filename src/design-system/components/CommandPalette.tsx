/**
 * ⌘K CONTTA - COMMAND PALETTE GLOBAL
 * 
 * Navegação rápida por teclado - AI-First
 * Governado pelo Maestro UX
 * 
 * @version 2.0.0
 * @author Maestro UX
 */

import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { 
  Home,
  Users,
  FileText,
  DollarSign,
  BarChart3,
  Settings,
  HelpCircle,
  Bot,
  Calculator,
  Wallet,
  CreditCard,
  Building2,
  TrendingUp,
  PieChart,
  ClipboardList,
  Receipt,
  Sparkles,
  Search,
  ArrowRight,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════

interface CommandItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  action: () => void;
  keywords?: string[];
  category: 'navigation' | 'action' | 'ai' | 'settings';
  shortcut?: string;
}

interface CommandPaletteProps {
  /** Trigger externo para abrir */
  open?: boolean;
  /** Callback ao mudar estado */
  onOpenChange?: (open: boolean) => void;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMMAND PALETTE CONTEXT
// ═══════════════════════════════════════════════════════════════

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const context = React.useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 COMMAND PALETTE PROVIDER
// ═══════════════════════════════════════════════════════════════

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleOpen = useCallback(() => setOpen(prev => !prev), []);

  // Keyboard shortcut: ⌘K or Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen, toggleOpen }}>
      {children}
      <CommandPalette open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// ⌘K COMMAND PALETTE
// ═══════════════════════════════════════════════════════════════

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Reset search on close
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Run command and close
  const runCommand = useCallback((command: () => void) => {
    onOpenChange?.(false);
    command();
  }, [onOpenChange]);

  // ═══════════════════════════════════════════════════════════════
  // 📍 NAVIGATION COMMANDS
  // ═══════════════════════════════════════════════════════════════

  const navigationCommands: CommandItem[] = [
    {
      id: 'dashboard',
      label: 'Ir para Dashboard',
      icon: Home,
      action: () => navigate('/dashboard'),
      keywords: ['inicio', 'home', 'painel'],
      category: 'navigation',
      shortcut: '⌘D',
    },
    {
      id: 'clients',
      label: 'Ir para Clientes',
      icon: Users,
      action: () => navigate('/clients'),
      keywords: ['cliente', 'cadastro', 'empresas'],
      category: 'navigation',
    },
    {
      id: 'invoices',
      label: 'Ir para Faturas',
      icon: FileText,
      action: () => navigate('/invoices'),
      keywords: ['fatura', 'cobranca', 'boleto', 'honorarios'],
      category: 'navigation',
    },
    {
      id: 'bank-accounts',
      label: 'Ir para Contas Bancárias',
      icon: Building2,
      action: () => navigate('/bank-accounts'),
      keywords: ['banco', 'conta', 'saldo'],
      category: 'navigation',
    },
    {
      id: 'bank-import',
      label: 'Importar Extrato OFX',
      icon: CreditCard,
      action: () => navigate('/bank-import'),
      keywords: ['ofx', 'extrato', 'importar', 'banco'],
      category: 'navigation',
    },
    {
      id: 'reconciliation',
      label: 'Ir para Conciliação',
      icon: ClipboardList,
      action: () => navigate('/reconciliation-dashboard'),
      keywords: ['conciliar', 'pendente', 'classificar'],
      category: 'navigation',
    },
    {
      id: 'dre',
      label: 'Ir para DRE',
      icon: TrendingUp,
      action: () => navigate('/dre'),
      keywords: ['resultado', 'lucro', 'prejuizo', 'demonstrativo'],
      category: 'navigation',
    },
    {
      id: 'balance-sheet',
      label: 'Ir para Balanço Patrimonial',
      icon: PieChart,
      action: () => navigate('/balance-sheet'),
      keywords: ['balanco', 'ativo', 'passivo', 'patrimonio'],
      category: 'navigation',
    },
    {
      id: 'chart-of-accounts',
      label: 'Plano de Contas',
      icon: Calculator,
      action: () => navigate('/chart-of-accounts'),
      keywords: ['plano', 'conta', 'contabil'],
      category: 'navigation',
    },
    {
      id: 'cash-flow',
      label: 'Fluxo de Caixa',
      icon: Wallet,
      action: () => navigate('/cash-flow'),
      keywords: ['caixa', 'fluxo', 'entrada', 'saida'],
      category: 'navigation',
    },
    {
      id: 'expenses',
      label: 'Despesas',
      icon: Receipt,
      action: () => navigate('/expenses'),
      keywords: ['despesa', 'gasto', 'custo'],
      category: 'navigation',
    },
    {
      id: 'reports',
      label: 'Relatórios',
      icon: BarChart3,
      action: () => navigate('/reports'),
      keywords: ['relatorio', 'exportar', 'pdf'],
      category: 'navigation',
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // 🤖 AI COMMANDS
  // ═══════════════════════════════════════════════════════════════

  const aiCommands: CommandItem[] = [
    {
      id: 'ai-chat',
      label: 'Perguntar ao Dr. Cícero',
      icon: Bot,
      action: () => navigate('/ai-chat'),
      keywords: ['ia', 'cicero', 'perguntar', 'duvida', 'ajuda'],
      category: 'ai',
      shortcut: '⌘J',
    },
    {
      id: 'ai-insights',
      label: 'Ver Insights da IA',
      icon: Sparkles,
      action: () => navigate('/ai-insights'),
      keywords: ['insight', 'sugestao', 'recomendacao'],
      category: 'ai',
    },
    {
      id: 'ai-automation',
      label: 'Automações da IA',
      icon: Bot,
      action: () => navigate('/ai-automation'),
      keywords: ['automacao', 'auto', 'classificar'],
      category: 'ai',
    },
  ];

  // ═══════════════════════════════════════════════════════════════
  // ⚙️ SETTINGS COMMANDS
  // ═══════════════════════════════════════════════════════════════

  const settingsCommands: CommandItem[] = [
    {
      id: 'settings',
      label: 'Configurações',
      icon: Settings,
      action: () => navigate('/settings'),
      keywords: ['config', 'preferencia', 'opcao'],
      category: 'settings',
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* Header with AI indicator */}
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3 bg-gradient-to-r from-primary-50 to-ai-50">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Sparkles className="h-4 w-4 text-ai-500" />
          <span className="font-medium">Comando Rápido</span>
        </div>
        <kbd className="ml-auto text-xs bg-neutral-100 px-2 py-0.5 rounded text-neutral-500">
          ⌘K
        </kbd>
      </div>

      <CommandInput 
        placeholder="Digite um comando ou busque..." 
        value={search}
        onValueChange={setSearch}
        className="border-0"
      />
      
      <CommandList className="max-h-[400px]">
        <CommandEmpty className="py-8">
          <div className="flex flex-col items-center gap-2 text-neutral-500">
            <Search className="h-8 w-8 opacity-50" />
            <p>Nenhum resultado encontrado.</p>
            <p className="text-xs">Tente buscar por outra palavra-chave</p>
          </div>
        </CommandEmpty>

        {/* AI Commands - AI-First! */}
        <CommandGroup heading="🤖 Dr. Cícero IA">
          {aiCommands.map((item) => (
            <CommandItem
              key={item.id}
              value={[item.label, ...(item.keywords || [])].join(' ')}
              onSelect={() => runCommand(item.action)}
              className="flex items-center gap-3 py-3 cursor-pointer hover:bg-ai-50"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-ai-100 text-ai-600">
                <item.icon className="h-4 w-4" />
              </div>
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              )}
              <ArrowRight className="h-4 w-4 opacity-50" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation Commands */}
        <CommandGroup heading="📍 Navegação">
          {navigationCommands.map((item) => (
            <CommandItem
              key={item.id}
              value={[item.label, ...(item.keywords || [])].join(' ')}
              onSelect={() => runCommand(item.action)}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600">
                <item.icon className="h-4 w-4" />
              </div>
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              )}
              <ArrowRight className="h-4 w-4 opacity-50" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Settings Commands */}
        <CommandGroup heading="⚙️ Sistema">
          {settingsCommands.map((item) => (
            <CommandItem
              key={item.id}
              value={[item.label, ...(item.keywords || [])].join(' ')}
              onSelect={() => runCommand(item.action)}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600">
                <item.icon className="h-4 w-4" />
              </div>
              <span className="flex-1">{item.label}</span>
              <ArrowRight className="h-4 w-4 opacity-50" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      {/* Footer hint */}
      <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-2 text-xs text-neutral-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="bg-neutral-100 px-1.5 py-0.5 rounded">↑↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-neutral-100 px-1.5 py-0.5 rounded">↵</kbd>
            selecionar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-neutral-100 px-1.5 py-0.5 rounded">esc</kbd>
            fechar
          </span>
        </div>
        <span className="text-ai-500 font-medium">Powered by Dr. Cícero</span>
      </div>
    </CommandDialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🔘 COMMAND TRIGGER BUTTON
// ═══════════════════════════════════════════════════════════════

export function CommandTrigger({ className }: { className?: string }) {
  const { toggleOpen } = useCommandPalette();

  return (
    <button
      onClick={toggleOpen}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg",
        "bg-neutral-100 hover:bg-neutral-200 transition-colors",
        "text-sm text-neutral-600",
        "border border-neutral-200",
        className
      )}
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Buscar...</span>
      <kbd className="hidden sm:inline text-xs bg-white px-1.5 py-0.5 rounded border border-neutral-200">
        ⌘K
      </kbd>
    </button>
  );
}

export default CommandPalette;
