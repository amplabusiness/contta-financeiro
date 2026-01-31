import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from '@/hooks/useTenantConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
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
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Send,
  AlertTriangle,
  Split,
  FileText,
  User,
  Calendar
} from 'lucide-react';
import { formatCurrency } from '@/data/expensesData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReclassificationLine {
  id?: string;
  account_id: string;
  account_code?: string;
  account_name?: string;
  amount: number;
  description: string;
}

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

interface ReclassificationPanelProps {
  parentEntryId: string;
  parentDescription: string;
  parentAmount: number;
  parentDate: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Painel de Reclassificação Contábil
 * 
 * Permite criar splits de lançamentos com:
 * - Múltiplas contas destino
 * - Trilha de auditoria
 * - Validação de totais (saldo preservado)
 * - Fluxo de aprovação Dr. Cícero
 */
export function ReclassificationPanel({
  parentEntryId,
  parentDescription,
  parentAmount,
  parentDate,
  onClose,
  onSuccess
}: ReclassificationPanelProps) {
  const { tenant } = useTenantConfig();
  const [lines, setLines] = useState<ReclassificationLine[]>([
    { account_id: '', amount: parentAmount, description: '' }
  ]);
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountSearchOpen, setAccountSearchOpen] = useState<number | null>(null);

  // Carregar contas disponíveis
  useEffect(() => {
    const fetchAccounts = async () => {
      const { data } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name')
        .eq('is_analytical', true)
        .eq('is_active', true)
        .order('code');
      
      if (data) setAccounts(data);
    };
    fetchAccounts();
  }, []);

  // Calcular total das linhas
  const totalLines = lines.reduce((sum, l) => sum + (l.amount || 0), 0);
  const isBalanced = Math.abs(totalLines - parentAmount) < 0.01;

  // Adicionar nova linha
  const addLine = () => {
    setLines([...lines, { account_id: '', amount: 0, description: '' }]);
  };

  // Remover linha
  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      toast.error('Reclassificação deve ter pelo menos uma linha');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  // Atualizar linha
  const updateLine = (index: number, field: keyof ReclassificationLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // Se selecionou conta, preencher código e nome
    if (field === 'account_id') {
      const account = accounts.find(a => a.id === value);
      if (account) {
        newLines[index].account_code = account.code;
        newLines[index].account_name = account.name;
      }
    }
    
    setLines(newLines);
  };

  // Distribuir valor restante na última linha
  const distributeRemaining = () => {
    if (lines.length === 0) return;
    
    const othersTotal = lines.slice(0, -1).reduce((sum, l) => sum + (l.amount || 0), 0);
    const remaining = parentAmount - othersTotal;
    
    const newLines = [...lines];
    newLines[newLines.length - 1].amount = Math.max(0, remaining);
    setLines(newLines);
  };

  // Salvar reclassificação
  const handleSave = async (submitForApproval: boolean = false) => {
    // Validações
    if (!isBalanced) {
      toast.error('Total das linhas deve ser igual ao lançamento original');
      return;
    }

    if (lines.some(l => !l.account_id)) {
      toast.error('Todas as linhas devem ter uma conta selecionada');
      return;
    }

    if (!justification.trim()) {
      toast.error('Justificativa é obrigatória');
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Preparar linhas para RPC
      const lineData = lines.map(l => ({
        account_id: l.account_id,
        amount: l.amount,
        description: l.description || ''
      }));

      const { data, error } = await supabase.rpc('rpc_create_reclassification', {
        p_tenant_id: tenant?.id,
        p_parent_entry_id: parentEntryId,
        p_lines: lineData,
        p_justification: justification,
        p_created_by: userId
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao criar reclassificação');
      }

      // Se solicitou aprovação, atualizar status
      if (submitForApproval) {
        await supabase
          .from('accounting_reclassifications')
          .update({ status: 'pending' })
          .eq('id', data.reclassification_id);
      }

      toast.success(submitForApproval 
        ? 'Reclassificação enviada para aprovação do Dr. Cícero'
        : 'Reclassificação salva como rascunho'
      );

      onSuccess();
      onClose();

    } catch (err: any) {
      console.error('Erro ao criar reclassificação:', err);
      toast.error(err.message || 'Erro ao criar reclassificação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5" />
            Reclassificação Contábil (Split)
          </DialogTitle>
          <DialogDescription>
            Divida um lançamento em múltiplas contas mantendo o saldo total preservado.
          </DialogDescription>
        </DialogHeader>

        {/* Informações do Lançamento Original */}
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Lançamento Original (Bloqueado)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descrição:</span>
              <span className="font-medium">{parentDescription}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>
              <span>{format(new Date(parentDate), 'dd/MM/yyyy', { locale: ptBR })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-bold text-lg">{formatCurrency(parentAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Linhas da Reclassificação */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Distribuição por Contas</h4>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Linha
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Conta Destino</TableHead>
                <TableHead className="w-[20%]">Valor</TableHead>
                <TableHead className="w-[30%]">Descrição</TableHead>
                <TableHead className="w-[10%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Popover 
                      open={accountSearchOpen === index} 
                      onOpenChange={(open) => setAccountSearchOpen(open ? index : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-start text-left font-normal"
                        >
                          {line.account_id ? (
                            <span className="truncate">
                              <span className="font-mono text-muted-foreground mr-2">
                                {line.account_code}
                              </span>
                              {line.account_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Selecionar conta...</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar conta..." />
                          <CommandList>
                            <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-y-auto">
                              {accounts.map((account) => (
                                <CommandItem
                                  key={account.id}
                                  value={`${account.code} ${account.name}`}
                                  onSelect={() => {
                                    updateLine(index, 'account_id', account.id);
                                    setAccountSearchOpen(null);
                                  }}
                                >
                                  <span className="font-mono text-muted-foreground w-20 shrink-0">
                                    {account.code}
                                  </span>
                                  <span className="truncate">{account.name}</span>
                                  {line.account_id === account.id && (
                                    <CheckCircle2 className="ml-auto h-4 w-4" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount || ''}
                      onChange={(e) => updateLine(index, 'amount', parseFloat(e.target.value) || 0)}
                      className="text-right"
                      placeholder="0,00"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      placeholder="Descrição opcional"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totalizador */}
          <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Total das linhas:</span>
              <span className={`font-bold text-lg ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalLines)}
              </span>
              {!isBalanced && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Diferença: {formatCurrency(Math.abs(totalLines - parentAmount))}
                </Badge>
              )}
              {isBalanced && (
                <Badge variant="default" className="bg-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Balanceado
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={distributeRemaining}>
              Distribuir restante
            </Button>
          </div>
        </div>

        {/* Justificativa */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Justificativa (obrigatória)
          </label>
          <Textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Explique o motivo da reclassificação..."
            rows={3}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => handleSave(false)} 
            disabled={loading || !isBalanced}
          >
            Salvar Rascunho
          </Button>
          <Button 
            onClick={() => handleSave(true)} 
            disabled={loading || !isBalanced || !justification.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4 mr-1" />
            Enviar para Aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lista de Reclassificações Pendentes (para Dr. Cícero)
 */
interface PendingReclassificationsListProps {
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}

export function PendingReclassificationsList({ onApprove, onReject }: PendingReclassificationsListProps) {
  const { tenant } = useTenantConfig();
  const [reclassifications, setReclassifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const fetchPending = async () => {
      const { data, error } = await supabase
        .from('vw_pending_reclassifications')
        .select('*')
        .eq('tenant_id', tenant?.id);

      if (!error && data) {
        setReclassifications(data);
      }
      setLoading(false);
    };

    if (tenant?.id) fetchPending();
  }, [tenant?.id]);

  const handleApprove = async (id: string) => {
    const { data: userData } = await supabase.auth.getUser();
    
    const { error } = await supabase.rpc('rpc_approve_reclassification', {
      p_reclassification_id: id,
      p_reviewed_by: userData.user?.id
    });

    if (error) {
      toast.error('Erro ao aprovar: ' + error.message);
    } else {
      toast.success('Reclassificação aprovada!');
      onApprove(id);
      setReclassifications(reclassifications.filter(r => r.id !== id));
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) {
      toast.error('Motivo da rejeição é obrigatório');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.rpc('rpc_reject_reclassification', {
      p_reclassification_id: rejectingId,
      p_reviewed_by: userData.user?.id,
      p_review_notes: rejectReason
    });

    if (error) {
      toast.error('Erro ao rejeitar: ' + error.message);
    } else {
      toast.success('Reclassificação rejeitada');
      onReject(rejectingId, rejectReason);
      setReclassifications(reclassifications.filter(r => r.id !== rejectingId));
    }

    setRejectingId(null);
    setRejectReason('');
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (reclassifications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
        Nenhuma reclassificação pendente de aprovação
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        Reclassificações Aguardando Aprovação ({reclassifications.length})
      </h3>

      {reclassifications.map((reclass) => (
        <Card key={reclass.id} className="border-amber-200">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {reclass.parent_description}
              </CardTitle>
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Pendente
              </Badge>
            </div>
            <CardDescription>
              <span className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(reclass.parent_date), 'dd/MM/yyyy')}
                </span>
                <span>{reclass.lines_count} linha(s)</span>
                <span className="font-medium">{formatCurrency(reclass.total_amount)}</span>
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="py-3 space-y-3">
            <div className="text-sm">
              <strong>Justificativa:</strong> {reclass.justification}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleApprove(reclass.id)}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => setRejectingId(reclass.id)}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Rejeitar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Dialog de Rejeição */}
      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Reclassificação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O usuário poderá corrigir e reenviar.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeição..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingId(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ReclassificationPanel;
