import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, Users, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useClient } from "@/contexts/ClientContext";
import { supabase } from "@/integrations/supabase/client";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  monthly_fee?: number;
}

interface EconomicGroupIndicatorProps {
  client: Client;
  allClients?: Client[];
}

interface EconomicGroupData {
  group_id: string;
  group_name: string;
  main_payer_client_id: string;
  total_monthly_fee: number;
  payment_day: number;
  members: {
    client_id: string;
    client_name: string;
    individual_fee: number;
    is_main_payer: boolean;
  }[];
}

export const EconomicGroupIndicator = ({ client }: EconomicGroupIndicatorProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupData, setGroupData] = useState<EconomicGroupData | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setSelectedClient } = useClient();

  useEffect(() => {
    if (dialogOpen && !groupData) {
      loadGroupData();
    }
  }, [dialogOpen]);

  const loadGroupData = async () => {
    try {
      setLoading(true);

      // Buscar dados do grupo econômico do cliente
      const { data: groupInfo, error: groupError } = await supabase
        .rpc('get_economic_group_by_client', { p_client_id: client.id });

      if (groupError) throw groupError;
      if (!groupInfo || groupInfo.length === 0) return;

      const group = groupInfo[0];

      // Buscar membros do grupo
      const { data: members, error: membersError } = await supabase
        .from('economic_group_members')
        .select(`
          client_id,
          individual_fee,
          clients(name)
        `)
        .eq('economic_group_id', group.group_id);

      if (membersError) throw membersError;

      setGroupData({
        group_id: group.group_id,
        group_name: group.group_name,
        main_payer_client_id: group.main_payer_client_id,
        total_monthly_fee: group.total_monthly_fee,
        payment_day: group.payment_day,
        members: (members || []).map(m => ({
          client_id: m.client_id,
          client_name: (m.clients as any)?.name || 'Nome não disponível',
          individual_fee: m.individual_fee,
          is_main_payer: m.client_id === group.main_payer_client_id
        }))
      });
    } catch (error) {
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyClick = async (companyId: string, companyName: string) => {
    // Buscar dados do cliente
    const { data: clientData } = await supabase
      .from('clients')
      .select('monthly_fee')
      .eq('id', companyId)
      .single();

    if (!clientData) return;

    setSelectedClient(companyId, companyName);
    setDialogOpen(false);

    const isProBono = clientData.monthly_fee === 0;
    const isOnClientsPage = location.pathname === "/clients";
    const isOnProBonoPage = location.pathname === "/pro-bono-clients";

    if (isOnClientsPage && isProBono) {
      navigate("/pro-bono-clients");
    } else if (isOnProBonoPage && !isProBono) {
      navigate("/clients");
    } else if (!isOnClientsPage && !isOnProBonoPage) {
      navigate("/client-dashboard");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Verificar se o cliente pertence a um grupo
  const [belongsToGroup, setBelongsToGroup] = useState(false);

  useEffect(() => {
    checkGroupMembership();
  }, [client.id]);

  const checkGroupMembership = async () => {
    const { data } = await supabase
      .rpc('is_in_economic_group', { p_client_id: client.id });
    setBelongsToGroup(data || false);
  };

  if (!belongsToGroup) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <>
      <Badge
        variant="secondary"
        className="cursor-pointer gap-1 hover:bg-secondary/80 transition-colors"
        onClick={() => setDialogOpen(true)}
      >
        <Building2 className="h-3 w-3" />
        Grupo Econômico
      </Badge>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Grupo Econômico - Pagamento Consolidado
            </DialogTitle>
            <DialogDescription>
              Esta empresa faz parte de um grupo com pagamento consolidado
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : groupData ? (
            <div className="space-y-6">
              <Card className="p-4 bg-primary/5 border-primary">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Empresa Pagadora:</span>
                    <span className="font-semibold">
                      {groupData.members.find(m => m.is_main_payer)?.client_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Honorário Total Mensal:</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(groupData.total_monthly_fee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Dia de Vencimento:</span>
                    <span className="font-semibold">Dia {groupData.payment_day}</span>
                  </div>
                </div>
              </Card>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Empresas do Grupo ({groupData.members.length})
                </h4>

                <div className="space-y-2">
                  {groupData.members.map((member) => (
                    <Card
                      key={member.client_id}
                      className={`p-4 transition-all ${
                        member.client_id === client.id
                          ? "bg-primary/5 border-primary"
                          : "hover:bg-accent cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <p className="font-medium">{member.client_name}</p>
                            {member.is_main_payer && (
                              <Badge variant="default" className="text-xs">
                                Pagadora
                              </Badge>
                            )}
                            {member.client_id === client.id && (
                              <Badge variant="outline" className="text-xs">
                                Empresa Atual
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Honorário Individual: <strong>{formatCurrency(member.individual_fee)}</strong>
                            </span>
                          </div>
                        </div>

                        {member.client_id !== client.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompanyClick(member.client_id, member.client_name)}
                          >
                            Ver empresa →
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <Card className="p-4 bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Pagamento Consolidado:</strong> Quando a empresa pagadora efetua o pagamento,
                  todas as faturas das empresas deste grupo para aquela competência são automaticamente
                  marcadas como pagas.
                </p>
              </Card>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Não foi possível carregar os dados do grupo
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
