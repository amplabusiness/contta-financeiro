import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Users, AlertTriangle, DollarSign, FileCheck, Pencil } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDocument } from '@/lib/formatters';
import * as XLSX from "xlsx";
import { FinancialGroupImporter } from "@/components/FinancialGroupImporter";
import { FinancialGroupAudit } from "@/components/FinancialGroupAudit";
import { FinancialGroupEditDialog } from "@/components/FinancialGroupEditDialog";

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

interface FinancialGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FinancialGroupsDialog({ open, onOpenChange }: FinancialGroupsDialogProps) {
  const [groups, setGroups] = useState<EconomicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [importPreview, setImportPreview] = useState<any[][] | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>("");

  useEffect(() => {
    if (open) {
      loadGroups();
    }
  }, [open]);

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
          is_active,
          clients!economic_groups_main_payer_client_id_fkey(name)
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
          main_payer_name: (group.clients as any)?.name || 'Nome não disponível',
          members: groupMembers
        };
      });

      setGroups(consolidatedGroups);
    } catch (error) {
      console.error('Error loading economic groups:', error);
      toast.error('Erro ao carregar grupos financeiros');
    } finally {
      setLoading(false);
    }
  };

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

  const totalGroups = groups.length;
  const totalCompanies = groups.reduce((sum, g) => sum + g.member_count, 0);
  const totalRevenue = groups.reduce((sum, g) => sum + g.total_monthly_fee, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Grupos Financeiros</DialogTitle>
            <DialogDescription>
              Empresas relacionadas com pagamento consolidado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
          <input
            type="file"
            accept=".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelected}
          />

          {importPreview ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Arquivo: <strong>{importFileName}</strong>
                </p>
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
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button 
                  onClick={handleImportGroups} 
                  disabled={importing}
                >
                  {importing ? 'Lendo planilha...' : totalGroups > 0 ? 'Reimportar Grupos' : 'Importar Grupos'}
                </Button>
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
                  <p className="text-muted-foreground mb-2">
                    Clique no botão acima para importar a planilha de grupos financeiros.
                  </p>
                </Card>
              ) : (
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
                            <CollapsibleTrigger className="w-full">
                              <div className="p-6 flex items-center justify-between hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-4">
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
                                </div>
                                <div className="flex items-center gap-4">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingGroupId(group.id);
                                      setEditingGroupName(group.name);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <div className="text-right">
                                    <p className="text-sm text-muted-foreground">Honorário Total</p>
                                    <p className="text-lg font-bold text-primary">
                                      {formatCurrency(group.total_monthly_fee)}
                                    </p>
                                  </div>
                                  <ChevronDown
                                    className={`h-5 w-5 transition-transform ${
                                      expandedGroups.has(group.id) ? 'transform rotate-180' : ''
                                    }`}
                                  />
                                </div>
                              </div>
                            </CollapsibleTrigger>

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
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {editingGroupId && (
      <FinancialGroupEditDialog
        open={!!editingGroupId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGroupId(null);
            setEditingGroupName("");
          }
        }}
        groupId={editingGroupId}
        groupName={editingGroupName}
        onComplete={() => {
          loadGroups();
          setEditingGroupId(null);
          setEditingGroupName("");
        }}
      />
    )}
    </>
  );
}
