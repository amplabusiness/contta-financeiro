import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, AlertTriangle, DollarSign, FileCheck, Plus, Search, X, Crown, Trash2, Edit } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDocument } from '@/lib/formatters';
import * as XLSX from "xlsx";
import { FinancialGroupImporter } from "@/components/FinancialGroupImporter";
import { FinancialGroupAudit } from "@/components/FinancialGroupAudit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface EconomicGroup {
  id: string;
  name: string;
  main_payer_client_id: string;
  total_monthly_fee: number;
  payment_day: number;
  is_active: boolean;
  member_count: number;
  main_payer_name: string;
  members: GroupMember[];
}

interface GroupMember {
  client_id: string;
  client_name: string;
  client_document?: string;
  individual_fee: number;
  is_main_payer: boolean;
}

interface ClientOption {
  id: string;
  name: string;
  document: string;
  monthly_fee: number;
}

interface SelectedClient {
  id: string;
  name: string;
  document: string;
  monthly_fee: number;
  isMainPayer: boolean;
}

export default function EconomicGroups() {
  // Estados de carregamento
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estados de dados principais
  const [groups, setGroups] = useState<EconomicGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [importPreview, setImportPreview] = useState<any[][] | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ClientOption[]>([]);
  const [selectedClients, setSelectedClients] = useState<SelectedClient[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estados de diálogos
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EconomicGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [paymentDay, setPaymentDay] = useState(10);

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);

      const { data: groupsData, error: groupsError } = await supabase
        .from('economic_groups')
        .select(`
          id,
          name,
          main_payer_client_id,
          total_monthly_fee,
          payment_day,
          is_active
        `)
        .eq('is_active', true)
        .order('name');

      if (groupsError) throw groupsError;

      const { data: membersData, error: membersError } = await supabase
        .from('economic_group_members')
        .select(`
          economic_group_id,
          client_id,
          individual_fee,
          clients(name, cnpj, cpf)
        `);

      if (membersError) throw membersError;

      // Buscar nomes dos pagadores principais
      const mainPayerIds = (groupsData || []).map(g => g.main_payer_client_id).filter(Boolean);
      const { data: payersData } = mainPayerIds.length > 0
        ? await supabase.from('clients').select('id, name').in('id', mainPayerIds)
        : { data: [] };
      const payerNames = new Map((payersData || []).map(p => [p.id, p.name]));

      const consolidatedGroups: EconomicGroup[] = (groupsData || []).map(group => {
        const groupMembers = (membersData || [])
          .filter(m => m.economic_group_id === group.id)
          .map(m => ({
            client_id: m.client_id,
            client_name: (m.clients as any)?.name || 'Nome não disponível',
            client_document: (m.clients as any)?.cnpj || (m.clients as any)?.cpf || '',
            individual_fee: m.individual_fee,
            is_main_payer: m.client_id === group.main_payer_client_id
          }));

        return {
          id: group.id,
          name: group.name,
          main_payer_client_id: group.main_payer_client_id,
          total_monthly_fee: group.total_monthly_fee,
          payment_day: group.payment_day,
          is_active: group.is_active,
          member_count: groupMembers.length,
          main_payer_name: payerNames.get(group.main_payer_client_id) || 'Nome não disponível',
          members: groupMembers
        };
      });

      setGroups(consolidatedGroups);
    } catch (error) {
      console.error('Error loading economic groups:', error);
      toast.error('Erro ao carregar grupos econômicos');
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // FUNÇÕES AUXILIARES
  // =====================================================

  const parseExcelFile = (file: File): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data as string, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Buscar clientes por nome ou CNPJ
  const searchClients = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const searchPattern = `%${term}%`;

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, cnpj, cpf, monthly_fee')
        .eq('is_active', true)
        .or(`name.ilike.${searchPattern},cnpj.ilike.${searchPattern},cpf.ilike.${searchPattern}`)
        .order('name')
        .limit(20);

      if (error) throw error;

      // Filtrar clientes já selecionados
      const selectedIds = new Set(selectedClients.map(c => c.id));
      const filteredResults = (data || [])
        .filter(c => !selectedIds.has(c.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          document: c.cnpj || c.cpf || '',
          monthly_fee: c.monthly_fee || 0
        }));

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setSearching(false);
    }
  }, [selectedClients]);

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  // Debounce para busca
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchClients(searchTerm);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchClients]);

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportFileName(file.name);
      const data = await parseExcelFile(file);
      setImportPreview(data);
      toast.success("Planilha carregada! Iniciando análise dos grupos financeiros...");
    } catch (error) {
      console.error("Erro ao ler planilha:", error);
      toast.error("Erro ao ler a planilha. Verifique o formato.");
      setImportPreview(null);
      setImportFileName(null);
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleCompleteImport = () => {
    setImportPreview(null);
    setImportFileName(null);
    loadGroups();
  };

  const handleImportGroups = () => {
    fileInputRef.current?.click();
  };

  // Adicionar cliente à lista de selecionados
  const addClient = (client: ClientOption) => {
    const isFirst = selectedClients.length === 0;
    setSelectedClients(prev => [
      ...prev,
      { ...client, isMainPayer: isFirst }
    ]);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Remover cliente da lista
  const removeClient = (clientId: string) => {
    setSelectedClients(prev => {
      const filtered = prev.filter(c => c.id !== clientId);
      // Se removeu o pagador principal, define o primeiro como novo pagador
      if (filtered.length > 0 && !filtered.some(c => c.isMainPayer)) {
        filtered[0].isMainPayer = true;
      }
      return filtered;
    });
  };

  // Definir como empresa pagadora
  const setAsMainPayer = (clientId: string) => {
    setSelectedClients(prev =>
      prev.map(c => ({ ...c, isMainPayer: c.id === clientId }))
    );
  };

  // Resetar formulário
  const resetForm = () => {
    setGroupName('');
    setPaymentDay(10);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedClients([]);
    setEditingGroup(null);
  };

  // Salvar grupo
  const saveGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Digite um nome para o grupo');
      return;
    }
    if (selectedClients.length < 2) {
      toast.error('Selecione pelo menos 2 empresas para o grupo');
      return;
    }
    const mainPayer = selectedClients.find(c => c.isMainPayer);
    if (!mainPayer) {
      toast.error('Selecione a empresa pagadora');
      return;
    }

    try {
      setSaving(true);
      const totalFee = selectedClients.reduce((sum, c) => sum + c.monthly_fee, 0);

      if (editingGroup) {
        // Atualizar grupo existente
        const { error: updateError } = await supabase
          .from('economic_groups')
          .update({
            name: groupName.trim(),
            main_payer_client_id: mainPayer.id,
            total_monthly_fee: totalFee,
            payment_day: paymentDay
          })
          .eq('id', editingGroup.id);

        if (updateError) throw updateError;

        // Remover membros antigos
        await supabase
          .from('economic_group_members')
          .delete()
          .eq('economic_group_id', editingGroup.id);

        // Inserir novos membros
        const members = selectedClients.map(c => ({
          economic_group_id: editingGroup.id,
          client_id: c.id,
          individual_fee: c.monthly_fee
        }));

        const { error: membersError } = await supabase
          .from('economic_group_members')
          .insert(members);

        if (membersError) throw membersError;

        toast.success('Grupo atualizado com sucesso!');
      } else {
        // Criar novo grupo
        const { data: newGroup, error: createError } = await supabase
          .from('economic_groups')
          .insert({
            name: groupName.trim(),
            main_payer_client_id: mainPayer.id,
            total_monthly_fee: totalFee,
            payment_day: paymentDay,
            is_active: true
          })
          .select()
          .single();

        if (createError) throw createError;

        // Inserir membros
        const members = selectedClients.map(c => ({
          economic_group_id: newGroup.id,
          client_id: c.id,
          individual_fee: c.monthly_fee
        }));

        const { error: membersError } = await supabase
          .from('economic_group_members')
          .insert(members);

        if (membersError) throw membersError;

        toast.success('Grupo criado com sucesso!');
      }

      setShowCreateDialog(false);
      resetForm();
      loadGroups();
    } catch (error) {
      console.error('Erro ao salvar grupo:', error);
      toast.error('Erro ao salvar grupo');
    } finally {
      setSaving(false);
    }
  };

  // Editar grupo existente
  const handleEditGroup = (group: EconomicGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setPaymentDay(group.payment_day);
    setSelectedClients(group.members.map(m => ({
      id: m.client_id,
      name: m.client_name,
      document: m.client_document || '',
      monthly_fee: m.individual_fee,
      isMainPayer: m.is_main_payer
    })));
    setShowCreateDialog(true);
  };

  // Excluir grupo
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Tem certeza que deseja excluir este grupo?')) return;

    try {
      // Primeiro remove os membros
      await supabase
        .from('economic_group_members')
        .delete()
        .eq('economic_group_id', groupId);

      // Depois desativa o grupo
      const { error } = await supabase
        .from('economic_groups')
        .update({ is_active: false })
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Grupo excluído com sucesso');
      loadGroups();
    } catch (error) {
      console.error('Erro ao excluir grupo:', error);
      toast.error('Erro ao excluir grupo');
    }
  };

  const totalGroups = groups.length;
  const totalCompanies = groups.reduce((sum, g) => sum + g.member_count, 0);
  const totalRevenue = groups.reduce((sum, g) => sum + g.total_monthly_fee, 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <input
          type="file"
          accept=".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelected}
          aria-label="Selecionar arquivo de planilha"
        />

        {importPreview ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Importar Grupos Financeiros</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Arquivo: <strong>{importFileName}</strong>
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setImportPreview(null);
                  setImportFileName(null);
                }}
              >
                Cancelar
              </Button>
            </div>

            <FinancialGroupImporter
              spreadsheetData={importPreview}
              onComplete={handleCompleteImport}
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Grupos Financeiros</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Empresas relacionadas com pagamento consolidado
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => { resetForm(); setShowCreateDialog(true); }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Grupo
                </Button>
                <Button
                  variant="outline"
                  onClick={handleImportGroups}
                  disabled={importing}
                >
                  {importing ? 'Lendo planilha...' : 'Importar Planilha'}
                </Button>
              </div>
            </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Grupos</p>
                <p className="text-2xl font-bold">{totalGroups}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Empresas Vinculadas</p>
                <p className="text-2xl font-bold">{totalCompanies}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receita Total Mensal</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </Card>
        </div>

        {totalGroups === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum grupo financeiro encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Crie grupos financeiros para consolidar pagamentos de empresas relacionadas.
            </p>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Grupo
            </Button>
          </Card>
        ) : (
          <>
            <Tabs defaultValue="groups" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="groups">
                  <Building2 className="h-4 w-4 mr-2" />
                  Grupos Cadastrados
                </TabsTrigger>
                <TabsTrigger value="audit">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Auditoria e Correção
                </TabsTrigger>
              </TabsList>

              <TabsContent value="groups" className="space-y-4">
                {totalGroups > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Pagamento Consolidado:</strong> Quando uma empresa pagadora de um grupo realiza
                      o pagamento, todas as faturas das empresas do mesmo grupo para aquela competência são
                      automaticamente marcadas como pagas.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-4">
            {groups.map((group) => (
            <Collapsible
              key={group.id}
              open={expandedGroups.has(group.id)}
              onOpenChange={() => toggleGroup(group.id)}
            >
              <Card>
                <div className="p-6 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <CollapsibleTrigger className="flex items-center gap-4 flex-1 cursor-pointer">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">{group.name}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm text-muted-foreground">
                          Pagadora: <strong>{group.main_payer_name}</strong>
                        </span>
                        <Badge variant="outline">
                          {group.member_count} {group.member_count === 1 ? 'empresa' : 'empresas'}
                        </Badge>
                        <Badge variant="secondary">
                          Vencimento: Dia {group.payment_day}
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Honorário Total</p>
                      <p className="text-lg font-bold text-primary">
                        {formatCurrency(group.total_monthly_fee)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditGroup(group)}
                        title="Editar grupo"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteGroup(group.id)}
                        title="Excluir grupo"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <CollapsibleTrigger className="cursor-pointer p-2 hover:bg-accent rounded">
                      <ChevronDown
                        className={`h-5 w-5 transition-transform ${
                          expandedGroups.has(group.id) ? 'transform rotate-180' : ''
                        }`}
                      />
                    </CollapsibleTrigger>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="px-6 pb-6 border-t">
                    <div className="mt-4 space-y-2">
                      <h4 className="font-semibold mb-3">Empresas do Grupo:</h4>
                      {group.members.map((member) => (
                        <div
                          key={member.client_id}
                          className="flex items-center justify-between p-3 bg-accent/20 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{member.client_name}</span>
                              {member.client_document && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {formatDocument(member.client_document)}
                                </span>
                              )}
                            </div>
                            {member.is_main_payer && (
                              <Badge variant="default" className="text-xs">
                                Pagadora
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Honorário Individual</p>
                            <p className="font-semibold">{formatCurrency(member.individual_fee)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
              </Collapsible>
            ))}
          </div>
              </TabsContent>

              <TabsContent value="audit">
                <FinancialGroupAudit />
              </TabsContent>
            </Tabs>
          </>
        )}
          </>
        )}

        {/* Dialog de Criação/Edição de Grupo */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) { resetForm(); } setShowCreateDialog(open); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Editar Grupo Financeiro' : 'Criar Novo Grupo Financeiro'}</DialogTitle>
              <DialogDescription>
                {editingGroup
                  ? 'Altere os dados do grupo financeiro.'
                  : 'Busque e selecione as empresas que farão parte deste grupo. A empresa pagadora receberá o boleto consolidado.'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              {/* Nome do Grupo e Dia de Pagamento */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName">Nome do Grupo</Label>
                  <Input
                    id="groupName"
                    placeholder="Ex: Grupo Familia Silva"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentDay">Dia de Vencimento</Label>
                  <Input
                    id="paymentDay"
                    type="number"
                    min={1}
                    max={28}
                    value={paymentDay}
                    onChange={(e) => setPaymentDay(parseInt(e.target.value) || 10)}
                  />
                </div>
              </div>

              {/* Campo de Busca */}
              <div className="space-y-2">
                <Label>Buscar Empresas</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Digite o nome ou CNPJ da empresa..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Resultados da busca */}
                {searchResults.length > 0 && (
                  <Card className="p-0 max-h-48 overflow-auto">
                    {searchResults.map((client) => (
                      <div
                        key={client.id}
                        className="p-3 hover:bg-accent cursor-pointer border-b last:border-0 flex items-center justify-between"
                        onClick={() => addClient(client)}
                      >
                        <div>
                          <p className="font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDocument(client.document)} | {formatCurrency(client.monthly_fee)}/mês
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-primary" />
                      </div>
                    ))}
                  </Card>
                )}

                {searching && (
                  <p className="text-sm text-muted-foreground">Buscando...</p>
                )}
              </div>

              {/* Lista de Empresas Selecionadas */}
              <div className="space-y-2 flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center justify-between">
                  <Label>Empresas Selecionadas ({selectedClients.length})</Label>
                  {selectedClients.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      Total: {formatCurrency(selectedClients.reduce((sum, c) => sum + c.monthly_fee, 0))}
                    </span>
                  )}
                </div>

                <ScrollArea className="flex-1 border rounded-lg min-h-0">
                  <div className="p-2 space-y-2">
                    {selectedClients.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma empresa selecionada. Use o campo acima para buscar e adicionar empresas.
                      </p>
                    ) : (
                      selectedClients.map((client) => (
                        <div
                          key={client.id}
                          className={`p-3 rounded-lg border flex items-center justify-between ${
                            client.isMainPayer ? 'bg-primary/5 border-primary' : 'bg-accent/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`main-${client.id}`}
                                checked={client.isMainPayer}
                                onCheckedChange={() => setAsMainPayer(client.id)}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{client.name}</p>
                                {client.isMainPayer && (
                                  <Badge variant="default" className="text-xs flex items-center gap-1">
                                    <Crown className="h-3 w-3" />
                                    Pagadora
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDocument(client.document)} | {formatCurrency(client.monthly_fee)}/mês
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeClient(client.id)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false); }}>
                Cancelar
              </Button>
              <Button onClick={saveGroup} disabled={saving || selectedClients.length < 2}>
                {saving ? 'Salvando...' : editingGroup ? 'Salvar Alterações' : 'Criar Grupo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
