/**
 * 🔒 CONTTA - COMPONENTE DE FECHAMENTO MENSAL
 * 
 * Integra na SuperConciliation para permitir fechamento do mês
 * quando todas as transações estiverem classificadas.
 * 
 * Governado pelo Maestro UX
 * @version 1.0.0
 * @author Dr. Cícero
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Lock, 
  Unlock, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Calendar,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/data/expensesData";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// 📋 TYPES
// ═══════════════════════════════════════════════════════════════
interface MonthClosingStatusProps {
  selectedDate: Date;
  tenantId: string;
  pendingCount: number;
  onClose?: () => void;
}

interface ClosingCheck {
  status: 'ready' | 'blocked' | 'pending';
  transitory_balance: {
    debit_balance: number;
    credit_balance: number;
  };
  pending_transactions: number;
  unbalanced_entries: number;
  blockers: string[];
  warnings: string[];
  checked_at: string;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export function MonthClosingStatus({ 
  selectedDate, 
  tenantId, 
  pendingCount,
  onClose 
}: MonthClosingStatusProps) {
  const [loading, setLoading] = useState(false);
  const [closingData, setClosingData] = useState<ClosingCheck | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;
  const monthLabel = format(selectedDate, "MMMM/yyyy", { locale: ptBR });

  // ─────────────────────────────────────────────────────────────
  // 📡 CARREGAR STATUS DO FECHAMENTO
  // ─────────────────────────────────────────────────────────────
  const loadClosingStatus = useCallback(async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('rpc_monthly_closing_check', {
        p_tenant_id: tenantId,
        p_year: year,
        p_month: month
      });

      if (error) throw error;
      setClosingData(data as ClosingCheck);
    } catch (err) {
      console.error('Erro ao verificar fechamento:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, year, month]);

  useEffect(() => {
    loadClosingStatus();
  }, [loadClosingStatus]);

  // Recarregar quando pendingCount mudar
  useEffect(() => {
    if (pendingCount === 0) {
      loadClosingStatus();
    }
  }, [pendingCount, loadClosingStatus]);

  // ─────────────────────────────────────────────────────────────
  // 🔒 FECHAR MÊS
  // ─────────────────────────────────────────────────────────────
  const handleCloseMonth = async () => {
    if (!closingData || closingData.status !== 'ready') {
      toast.error('Não é possível fechar o mês com pendências');
      return;
    }

    setClosing(true);
    try {
      // Registrar fechamento na tabela accounting_closures
      const { error } = await supabase
        .from('accounting_closures')
        .insert({
          tenant_id: tenantId,
          year,
          month,
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
          closed_by: (await supabase.auth.getUser()).data.user?.id,
          notes: `Fechamento automático via Super Conciliação - ${format(new Date(), "dd/MM/yyyy HH:mm")}`
        });

      if (error) {
        // Se já existe, atualizar
        if (error.code === '23505') {
          const { error: updateError } = await supabase
            .from('accounting_closures')
            .update({
              status: 'CLOSED',
              closed_at: new Date().toISOString(),
              closed_by: (await supabase.auth.getUser()).data.user?.id,
              notes: `Fechamento via Super Conciliação - ${format(new Date(), "dd/MM/yyyy HH:mm")}`
            })
            .eq('tenant_id', tenantId)
            .eq('year', year)
            .eq('month', month);
          
          if (updateError) throw updateError;
        } else {
          throw error;
        }
      }

      toast.success(`✅ ${monthLabel} fechado com sucesso!`, {
        description: 'O mês está agora bloqueado para alterações.',
        duration: 5000
      });

      setDialogOpen(false);
      await loadClosingStatus();
      onClose?.();

    } catch (err) {
      console.error('Erro ao fechar mês:', err);
      toast.error('Erro ao fechar o mês');
    } finally {
      setClosing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🎨 RENDERIZAÇÃO
  // ─────────────────────────────────────────────────────────────
  if (loading && !closingData) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Verificando...</span>
      </div>
    );
  }

  const isReady = closingData?.status === 'ready';
  const isBlocked = closingData?.status === 'blocked';
  const transitoryDebit = closingData?.transitory_balance?.debit_balance || 0;
  const transitoryCredit = closingData?.transitory_balance?.credit_balance || 0;
  const hasTransitoryBalance = Math.abs(transitoryDebit) > 0.01 || Math.abs(transitoryCredit) > 0.01;

  // Badge de status
  const StatusBadge = () => {
    if (isReady) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Pronto para fechar
        </Badge>
      );
    }
    
    if (pendingCount > 0) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
          <AlertTriangle className="h-3 w-3" />
          {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
        <AlertCircle className="h-3 w-3" />
        Bloqueado
      </Badge>
    );
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={isReady ? "default" : "outline"}
            size="sm"
            className={cn(
              "gap-2 transition-all",
              isReady && "bg-emerald-600 hover:bg-emerald-700 text-white",
              isBlocked && !isReady && "border-red-200 text-red-700 hover:bg-red-50"
            )}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isReady ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Unlock className="h-4 w-4" />
            )}
            Fechar Mês
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {monthLabel}
                </CardTitle>
                <StatusBadge />
              </div>
              <CardDescription>
                Status do fechamento contábil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Transitórias */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Transitória Débitos</span>
                  <span className={cn(
                    "font-mono font-medium",
                    Math.abs(transitoryDebit) > 0.01 ? "text-red-600" : "text-emerald-600"
                  )}>
                    {formatCurrency(transitoryDebit)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Transitória Créditos</span>
                  <span className={cn(
                    "font-mono font-medium",
                    Math.abs(transitoryCredit) > 0.01 ? "text-red-600" : "text-emerald-600"
                  )}>
                    {formatCurrency(transitoryCredit)}
                  </span>
                </div>
              </div>

              {/* Progress */}
              {pendingCount > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Progresso</span>
                    <span>{pendingCount} restante{pendingCount > 1 ? 's' : ''}</span>
                  </div>
                  <Progress value={0} className="h-2" />
                </div>
              )}

              {/* Blockers */}
              {closingData?.blockers && closingData.blockers.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    Bloqueadores
                  </div>
                  <ul className="text-xs text-red-600 space-y-1 pl-6">
                    {closingData.blockers.map((b, i) => (
                      <li key={i} className="list-disc">{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {closingData?.warnings && closingData.warnings.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
                    <Info className="h-4 w-4" />
                    Avisos
                  </div>
                  <ul className="text-xs text-amber-600 space-y-1 pl-6">
                    {closingData.warnings.map((w, i) => (
                      <li key={i} className="list-disc">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Botão de Fechar */}
              {isReady && (
                <Button 
                  onClick={() => setDialogOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Fechar {monthLabel}
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              )}

              {/* Info */}
              {!isReady && (
                <p className="text-xs text-muted-foreground text-center">
                  Classifique todas as transações pendentes para liberar o fechamento.
                </p>
              )}
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>

      {/* Dialog de Confirmação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" />
              Confirmar Fechamento
            </DialogTitle>
            <DialogDescription>
              Você está prestes a fechar o mês de <strong>{monthLabel}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-emerald-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                Tudo verificado!
              </div>
              <ul className="text-sm text-emerald-600 space-y-1 ml-7">
                <li>✓ Todas as transações classificadas</li>
                <li>✓ Contas transitórias zeradas</li>
                <li>✓ Lançamentos balanceados</li>
              </ul>
            </div>

            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>Atenção:</strong> Após o fechamento, as transações deste mês 
                não poderão mais ser alteradas. Você pode reabrir o mês se necessário.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              disabled={closing}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCloseMonth}
              disabled={closing}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {closing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fechando...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Confirmar Fechamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MonthClosingStatus;
