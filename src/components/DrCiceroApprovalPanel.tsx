/**
 * DrCiceroApprovalPanel.tsx
 * 
 * Painel de aprovações do Dr. Cícero - contador responsável.
 * Centraliza todas as pendências que requerem revisão contábil.
 * 
 * REGRAS DE OURO DO DR. CÍCERO:
 * 1. Toda reclassificação requer aprovação
 * 2. Toda criação de conta requer aprovação
 * 3. Toda alteração significativa é logada
 * 4. Dr. Cícero é a autoridade final
 * 
 * @author Sistema Contta - HUB Super Conciliação
 * @version 1.0.0
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { formatCurrency } from '@/data/expensesData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  XCircle,
  Clock,
  RefreshCw,
  FileText,
  User,
  Calendar,
  DollarSign,
  ArrowRight,
  Loader2,
  Shield,
  BookOpen,
  Plus
} from 'lucide-react';

// ============================================================================
// TIPOS
// ============================================================================

interface Reclassification {
  id: string;
  tenant_id: string;
  parent_entry_id: string;
  total_amount: number;
  justification: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'applied';
  created_by: string;
  created_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  // Joins
  creator_name?: string;
  parent_entry?: {
    entry_date: string;
    description: string;
  };
  lines?: ReclassificationLine[];
}

interface ReclassificationLine {
  id: string;
  account_id: string;
  amount: number;
  description?: string;
  account_code?: string;
  account_name?: string;
}

interface PendingAccountRequest {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_code: string;
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string;
  created_at: string;
  creator_name?: string;
}

interface DrCiceroApprovalPanelProps {
  /** Filtro por status */
  statusFilter?: 'pending' | 'all';
  
  /** Callback ao aprovar/rejeitar */
  onAction?: () => void;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function DrCiceroApprovalPanel({
  statusFilter = 'pending',
  onAction
}: DrCiceroApprovalPanelProps) {
  const { tenant } = useTenantConfig();

  // Estados
  const [activeTab, setActiveTab] = useState<'reclassifications' | 'accounts'>('reclassifications');
  const [reclassifications, setReclassifications] = useState<Reclassification[]>([]);
  const [accountRequests, setAccountRequests] = useState<PendingAccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Reclassification | PendingAccountRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Carregar dados
  useEffect(() => {
    if (tenant?.id) {
      loadData();
    }
  }, [tenant?.id, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    
    await Promise.all([
      loadReclassifications(),
      loadAccountRequests()
    ]);
    
    setLoading(false);
  };

  const loadReclassifications = async () => {
    let query = supabase
      .from('accounting_reclassifications')
      .select(`
        *,
        accounting_reclassification_lines (
          id, account_id, amount, description,
          chart_of_accounts (code, name)
        ),
        accounting_entries!parent_entry_id (entry_date, description)
      `)
      .eq('tenant_id', tenant?.id)
      .order('created_at', { ascending: false });

    if (statusFilter === 'pending') {
      query = query.in('status', ['draft', 'pending']);
    }

    const { data, error } = await query;

    if (!error && data) {
      setReclassifications(data.map(r => ({
        ...r,
        parent_entry: r.accounting_entries,
        lines: r.accounting_reclassification_lines?.map((l: any) => ({
          ...l,
          account_code: l.chart_of_accounts?.code,
          account_name: l.chart_of_accounts?.name
        }))
      })));
    }
  };

  const loadAccountRequests = async () => {
    // Tentar carregar da tabela pending_account_requests
    const { data, error } = await supabase
      .from('pending_account_requests')
      .select('*')
      .eq('tenant_id', tenant?.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAccountRequests(data);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleOpenReview = (item: Reclassification | PendingAccountRequest, action: 'approve' | 'reject') => {
    setSelectedItem(item);
    setReviewAction(action);
    setReviewNotes('');
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedItem) return;

    if (reviewAction === 'reject' && (!reviewNotes || reviewNotes.length < 10)) {
      toast.error('Motivo da rejeição é obrigatório (mín. 10 caracteres)');
      return;
    }

    setSubmitting(true);

    try {
      const user = await supabase.auth.getUser();
      const userId = user.data.user?.id;

      if ('parent_entry_id' in selectedItem) {
        // É uma reclassificação
        if (reviewAction === 'approve') {
          const { data, error } = await supabase.rpc('rpc_approve_reclassification', {
            p_reclassification_id: selectedItem.id,
            p_reviewed_by: userId,
            p_review_notes: reviewNotes || null
          });

          if (error || !data?.success) {
            throw new Error(data?.error || error?.message || 'Erro ao aprovar');
          }

          toast.success('Reclassificação aprovada!');
        } else {
          const { data, error } = await supabase.rpc('rpc_reject_reclassification', {
            p_reclassification_id: selectedItem.id,
            p_reviewed_by: userId,
            p_review_notes: reviewNotes
          });

          if (error || !data?.success) {
            throw new Error(data?.error || error?.message || 'Erro ao rejeitar');
          }

          toast.success('Reclassificação rejeitada');
        }
      } else {
        // É uma solicitação de conta
        const newStatus = reviewAction === 'approve' ? 'approved' : 'rejected';

        const { error } = await supabase
          .from('pending_account_requests')
          .update({
            status: newStatus,
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes
          })
          .eq('id', selectedItem.id);

        if (error) throw error;

        // Se aprovado, criar a conta
        if (reviewAction === 'approve') {
          const { error: createError } = await supabase
            .from('chart_of_accounts')
            .insert({
              tenant_id: tenant?.id,
              code: selectedItem.code,
              name: selectedItem.name,
              type: selectedItem.type,
              parent_code: selectedItem.parent_code,
              is_analytical: true,
              is_active: true
            });

          if (createError) throw createError;
        }

        toast.success(reviewAction === 'approve' ? 'Conta criada com sucesso!' : 'Solicitação rejeitada');
      }

      setReviewDialogOpen(false);
      loadData();
      onAction?.();

    } catch (err: unknown) {
      console.error('Erro na revisão:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================================
  // CONTADORES
  // ============================================================================

  const pendingReclassifications = reclassifications.filter(r => ['draft', 'pending'].includes(r.status)).length;
  const pendingAccounts = accountRequests.filter(a => a.status === 'pending').length;
  const totalPending = pendingReclassifications + pendingAccounts;

  // ============================================================================
  // RENDER
  // ============================================================================

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-gray-100"><Clock className="h-3 w-3 mr-1" />Rascunho</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      case 'applied':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800"><CheckCircle2 className="h-3 w-3 mr-1" />Aplicado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Painel de Aprovações - Dr. Cícero</CardTitle>
          </div>
          {totalPending > 0 && (
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {totalPending} pendente{totalPending > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <CardDescription>
          Revise e aprove reclassificações e solicitações de contas
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reclassifications" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reclassificações
              {pendingReclassifications > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingReclassifications}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Novas Contas
              {pendingAccounts > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingAccounts}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Reclassificações */}
          <TabsContent value="reclassifications">
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : reclassifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Nenhuma reclassificação pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reclassifications.map(reclass => (
                    <Card key={reclass.id} className="border-l-4 border-l-yellow-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusBadge(reclass.status)}
                              <Badge variant="outline">
                                <DollarSign className="h-3 w-3 mr-1" />
                                {formatCurrency(reclass.total_amount)}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {format(new Date(reclass.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </span>
                            </div>

                            <p className="text-sm font-medium mb-2">
                              {reclass.parent_entry?.description || 'Lançamento não encontrado'}
                            </p>

                            <div className="bg-muted/50 p-2 rounded text-sm mb-2">
                              <strong>Justificativa:</strong> {reclass.justification}
                            </div>

                            {reclass.lines && reclass.lines.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground font-medium">Distribuição:</p>
                                {reclass.lines.map(line => (
                                  <div key={line.id} className="flex items-center gap-2 text-sm">
                                    <Badge variant="outline" className="font-mono text-xs">
                                      {line.account_code}
                                    </Badge>
                                    <span className="flex-1 truncate">{line.account_name}</span>
                                    <span className="font-medium">{formatCurrency(line.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {['draft', 'pending'].includes(reclass.status) && (
                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => handleOpenReview(reclass, 'approve')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleOpenReview(reclass, 'reject')}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Novas Contas */}
          <TabsContent value="accounts">
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : accountRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Nenhuma solicitação de conta pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accountRequests.map(request => (
                    <Card key={request.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusBadge(request.status)}
                              <Badge variant="outline" className="font-mono">
                                {request.code}
                              </Badge>
                              <Badge variant="secondary">
                                {request.type}
                              </Badge>
                            </div>

                            <p className="font-medium mb-2">{request.name}</p>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              <BookOpen className="h-3 w-3" />
                              Grupo pai: {request.parent_code}
                            </div>

                            <div className="bg-muted/50 p-2 rounded text-sm">
                              <strong>Justificativa:</strong> {request.justification}
                            </div>

                            <div className="text-xs text-muted-foreground mt-2">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </div>
                          </div>

                          {request.status === 'pending' && (
                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => handleOpenReview(request, 'approve')}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleOpenReview(request, 'reject')}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog de Revisão */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === 'approve' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Confirmar Aprovação
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Confirmar Rejeição
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'approve'
                ? 'Confirme a aprovação desta solicitação.'
                : 'Informe o motivo da rejeição (obrigatório).'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {reviewAction === 'approve' ? 'Observações (opcional)' : 'Motivo da Rejeição (obrigatório)'}
              </Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={reviewAction === 'approve' 
                  ? 'Adicione observações se necessário...'
                  : 'Explique o motivo da rejeição...'}
                rows={3}
              />
              {reviewAction === 'reject' && (
                <p className="text-xs text-muted-foreground">
                  {reviewNotes.length}/10 caracteres mínimos
                </p>
              )}
            </div>

            {reviewAction === 'reject' && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Esta ação não pode ser desfeita. O solicitante será notificado.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submitting || (reviewAction === 'reject' && reviewNotes.length < 10)}
              className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={reviewAction === 'reject' ? 'destructive' : 'default'}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {reviewAction === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default DrCiceroApprovalPanel;
