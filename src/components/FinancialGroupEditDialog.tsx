import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Plus, Trash2, AlertTriangle, Search } from "lucide-react";
import { formatDocument } from '@/lib/formatters';

interface GroupMember {
  client_id: string;
  client_name: string;
  client_document?: string;
  individual_fee: number;
  is_main_payer: boolean;
  original_monthly_fee?: number;
}

interface FinancialGroupEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  onComplete: () => void;
}

interface AvailableClient {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  monthly_fee: number;
  payment_day: number | null;
}

export function FinancialGroupEditDialog({ open, onOpenChange, groupId, groupName, onComplete }: FinancialGroupEditDialogProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableClients, setAvailableClients] = useState<AvailableClient[]>([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [removingMembers, setRemovingMembers] = useState<Set<string>>(new Set());
  const [removedMembersData, setRemovedMembersData] = useState<Map<string, { fee: number, paymentDay: number }>>(new Map());
  const [newPayerId, setNewPayerId] = useState<string>("");
  const [newPayerFee, setNewPayerFee] = useState<string>("");
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [newMemberFee, setNewMemberFee] = useState<string>("");
  const [newMemberPaymentDay, setNewMemberPaymentDay] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadGroupMembers();
      loadAvailableClients();
      // Limpar estados ao abrir o diálogo
      setRemovedMembersData(new Map());
      setRemovingMembers(new Set());
      setNewPayerId("");
      setNewPayerFee("");
    }
  }, [open, groupId]);

  const loadGroupMembers = async () => {
    try {
      setLoading(true);
      const { data: membersData, error } = await supabase
        .from('economic_group_members')
        .select(`
          client_id,
          individual_fee,
          clients(name, cnpj, cpf, monthly_fee)
        `)
        .eq('economic_group_id', groupId);

      if (error) throw error;

      const { data: groupData } = await supabase
        .from('economic_groups')
        .select('main_payer_client_id')
        .eq('id', groupId)
        .single();

      const formattedMembers: GroupMember[] = (membersData || []).map(m => ({
        client_id: m.client_id,
        client_name: (m.clients as any)?.name || 'Nome não disponível',
        client_document: (m.clients as any)?.cnpj || (m.clients as any)?.cpf || '',
        individual_fee: m.individual_fee,
        is_main_payer: m.client_id === groupData?.main_payer_client_id,
        original_monthly_fee: (m.clients as any)?.monthly_fee || 0
      }));

      setMembers(formattedMembers);
    } catch (error) {
      console.error('Error loading group members:', error);
      toast.error('Erro ao carregar membros do grupo');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableClients = async () => {
    try {
      const { data: existingMembers } = await supabase
        .from('economic_group_members')
        .select('client_id');

      const existingClientIds = (existingMembers || []).map(m => m.client_id);

      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, name, cnpj, cpf, monthly_fee, payment_day')
        .eq('status', 'active')
        .not('id', 'in', `(${existingClientIds.join(',')})`)
        .gt('monthly_fee', 0);

      if (error) throw error;
      setAvailableClients(clients || []);
    } catch (error) {
      console.error('Error loading available clients:', error);
      toast.error('Erro ao carregar clientes disponíveis');
    }
  };

  const handleAddMember = async () => {
    if (!selectedClientId) return;

    const client = availableClients.find(c => c.id === selectedClientId);
    if (!client) return;

    if (client.monthly_fee <= 0) {
      toast.error('Esta empresa não possui honorário cadastrado');
      return;
    }

    const newMember: GroupMember = {
      client_id: client.id,
      client_name: client.name,
      client_document: client.cnpj || client.cpf || '',
      individual_fee: 0,
      is_main_payer: false,
      original_monthly_fee: client.monthly_fee
    };

    setMembers(prev => [...prev, newMember]);
    setAvailableClients(prev => prev.filter(c => c.id !== selectedClientId));
    setSelectedClientId("");
    setShowAddClient(false);
    toast.success('Empresa adicionada ao grupo');
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (members.length === 1) {
      toast.error('Não é possível remover o único membro do grupo');
      return;
    }

    setMemberToRemove(member);
    setNewMemberFee(member.original_monthly_fee?.toString() || "");
    
    // Se estiver removendo a pagadora, deixar payment_day vazio para forçar preenchimento
    setNewMemberPaymentDay(member.is_main_payer ? "" : "15");
    
    // Se estiver removendo a pagadora, pré-selecionar a primeira empresa restante como nova pagadora
    if (member.is_main_payer && members.length > 1) {
      const firstRemaining = members.find(m => m.client_id !== member.client_id);
      if (firstRemaining) {
        setNewPayerId(firstRemaining.client_id);
        setNewPayerFee(firstRemaining.original_monthly_fee?.toString() || "");
      }
    }
  };

  const confirmRemoveMember = () => {
    if (!memberToRemove) return;

    const fee = parseFloat(newMemberFee);
    const paymentDay = parseInt(newMemberPaymentDay);

    if (isNaN(fee) || fee <= 0) {
      toast.error('Informe um honorário válido para a empresa removida');
      return;
    }

    if (isNaN(paymentDay) || paymentDay < 1 || paymentDay > 31) {
      toast.error('Informe uma data de vencimento válida (1-31)');
      return;
    }

    // Se estiver removendo a pagadora atual
    if (memberToRemove.is_main_payer) {
      if (!newPayerId) {
        toast.error('Selecione uma nova empresa pagadora');
        return;
      }
      
      const newPayerFeeValue = parseFloat(newPayerFee);
      if (isNaN(newPayerFeeValue) || newPayerFeeValue <= 0) {
        toast.error('Informe o novo honorário da empresa pagadora');
        return;
      }
    }

    // Armazenar dados da empresa removida
    setRemovedMembersData(prev => {
      const newMap = new Map(prev);
      newMap.set(memberToRemove.client_id, { fee, paymentDay });
      return newMap;
    });
    
    setRemovingMembers(prev => new Set(prev).add(memberToRemove.client_id));
    setMembers(prev => prev.filter(m => m.client_id !== memberToRemove.client_id));
    setMemberToRemove(null);
    setNewMemberFee("");
    setNewMemberPaymentDay("");
    
    // Limpar dados de nova pagadora apenas se não for uma remoção de pagadora
    if (!memberToRemove.is_main_payer) {
      setNewPayerId("");
      setNewPayerFee("");
    }
    
    toast.success('Empresa removida do grupo');
  };

  const canApprove = () => {
    const hasFeePayers = members.some(m => m.original_monthly_fee && m.original_monthly_fee > 0);
    return hasFeePayers && members.length > 0;
  };

  const handleSaveChanges = async () => {
    if (!canApprove()) {
      toast.error('O grupo precisa ter pelo menos uma empresa com honorário cadastrado');
      return;
    }

    try {
      setSaving(true);

      const totalOriginalFee = members.reduce((sum, m) => sum + (m.original_monthly_fee || 0), 0);
      const newIndividualFee = totalOriginalFee / members.length;

      const currentMainPayer = members.find(m => m.is_main_payer);
      let finalMainPayerId = currentMainPayer?.client_id;

      if (removingMembers.has(currentMainPayer?.client_id || '')) {
        if (newPayerId) {
          finalMainPayerId = newPayerId;
          
          const { error: updateClientError } = await supabase
            .from('clients')
            .update({ monthly_fee: parseFloat(newPayerFee) })
            .eq('id', newPayerId);

          if (updateClientError) throw updateClientError;
        }
      }

      const mainPayerData = await supabase
        .from('clients')
        .select('payment_day')
        .eq('id', finalMainPayerId)
        .single();

      if (!mainPayerData.data) throw new Error('Pagadora não encontrada');

      const { error: updateGroupError } = await supabase
        .from('economic_groups')
        .update({
          total_monthly_fee: totalOriginalFee,
          main_payer_client_id: finalMainPayerId,
          payment_day: mainPayerData.data.payment_day
        })
        .eq('id', groupId);

      if (updateGroupError) throw updateGroupError;

      for (const memberId of removingMembers) {
        const { error: deleteMemberError } = await supabase
          .from('economic_group_members')
          .delete()
          .eq('economic_group_id', groupId)
          .eq('client_id', memberId);

        if (deleteMemberError) throw deleteMemberError;

        // Buscar os dados armazenados para esta empresa
        const memberData = removedMembersData.get(memberId);
        if (!memberData) {
          throw new Error(`Dados não encontrados para empresa removida: ${memberId}`);
        }

        const { error: updateRemovedClientError } = await supabase
          .from('clients')
          .update({
            monthly_fee: memberData.fee,
            payment_day: memberData.paymentDay
          })
          .eq('id', memberId);

        if (updateRemovedClientError) throw updateRemovedClientError;
      }

      for (const member of members) {
        const { error: upsertError } = await supabase
          .from('economic_group_members')
          .upsert({
            economic_group_id: groupId,
            client_id: member.client_id,
            individual_fee: newIndividualFee
          }, {
            onConflict: 'economic_group_id,client_id'
          });

        if (upsertError) throw upsertError;

        const { error: updateClientError } = await supabase
          .from('clients')
          .update({
            monthly_fee: newIndividualFee,
            payment_day: mainPayerData.data.payment_day
          })
          .eq('id', member.client_id);

        if (updateClientError) throw updateClientError;
      }

      toast.success('Grupo atualizado com sucesso');
      setRemovedMembersData(new Map()); // Limpar dados de empresas removidas
      setRemovingMembers(new Set());
      setNewPayerId("");
      setNewPayerFee("");
      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving group changes:', error);
      toast.error('Erro ao salvar alterações do grupo');
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = availableClients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cnpj && c.cnpj.includes(searchTerm)) ||
    (c.cpf && c.cpf.includes(searchTerm))
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalOriginalFee = members.reduce((sum, m) => sum + (m.original_monthly_fee || 0), 0);
  const calculatedIndividualFee = members.length > 0 ? totalOriginalFee / members.length : 0;

  const currentMainPayer = members.find(m => m.is_main_payer);
  // Se estiver removendo a pagadora, sempre mostrar campos de nova pagadora
  const isRemovingMainPayer = memberToRemove?.is_main_payer;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Grupo Financeiro</DialogTitle>
            <DialogDescription>{groupName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {!canApprove() && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  O grupo precisa ter pelo menos uma empresa com honorário cadastrado para ser salvo
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Total de Empresas: {members.length}</p>
                <p className="text-sm text-muted-foreground">
                  Soma dos Honorários: {formatCurrency(totalOriginalFee)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Honorário Individual: {formatCurrency(calculatedIndividualFee)}
                </p>
              </div>
              <Button
                onClick={() => setShowAddClient(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Empresa
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold">Empresas no Grupo:</h4>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.client_id}
                      className="flex items-center justify-between p-3 bg-accent/20 rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{member.client_name}</span>
                          {member.client_document && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatDocument(member.client_document)}
                            </span>
                          )}
                          {member.is_main_payer && (
                            <Badge variant="default" className="text-xs ml-2">
                              Pagadora
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(member.original_monthly_fee || 0)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member)}
                          disabled={members.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveChanges} 
              disabled={!canApprove() || saving}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Empresa ao Grupo</DialogTitle>
            <DialogDescription>
              Selecione uma empresa com honorário cadastrado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma empresa" />
              </SelectTrigger>
              <SelectContent>
                {filteredClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} - {formatCurrency(client.monthly_fee)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddClient(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddMember} disabled={!selectedClientId}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Empresa do Grupo</DialogTitle>
            <DialogDescription>
              Configure os novos valores para {memberToRemove?.client_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Novo Honorário Mensal</Label>
              <Input
                type="number"
                step="0.01"
                value={newMemberFee}
                onChange={(e) => setNewMemberFee(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Dia de Vencimento (1-31)</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={newMemberPaymentDay}
                onChange={(e) => setNewMemberPaymentDay(e.target.value)}
                placeholder="15"
              />
            </div>

            {isRemovingMainPayer && (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Você está removendo a empresa pagadora do grupo. Selecione uma nova pagadora.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Nova Empresa Pagadora</Label>
                  <Select value={newPayerId} onValueChange={setNewPayerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a nova pagadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {members
                        .filter(m => m.client_id !== memberToRemove?.client_id)
                        .map((member) => (
                          <SelectItem key={member.client_id} value={member.client_id}>
                            {member.client_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Novo Honorário da Pagadora</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPayerFee}
                    onChange={(e) => setNewPayerFee(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToRemove(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmRemoveMember} variant="destructive">
              Confirmar Remoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
