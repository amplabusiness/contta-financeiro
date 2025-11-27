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
  payment_day?: number;
}

interface EconomicGroupIndicatorProps {
  client: Client & { qsa?: any[] };
  allClients?: (Client & { qsa?: any[] })[];
}

interface EconomicGroupData {
  group_id: string;
  group_name: string;
  main_payer_client_id: string;
  total_monthly_fee: number;
  payment_day: number;
  members: {
    id: string;
    name: string;
    individual_fee: number;
  }[];
}

export const EconomicGroupIndicator = ({ client, allClients }: EconomicGroupIndicatorProps) => {
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
    if (!dialogOpen) return;
    
    setLoading(true);
    try {
      // Identificar empresas com sócios em comum
      if (!client.qsa || client.qsa.length === 0) {
        setLoading(false);
        return;
      }

      // Extrair CPFs dos sócios do cliente atual
      const clientPartnerCPFs = new Set(
        client.qsa
          .map((socio: any) => socio.cpf_cnpj_socio || socio.cpf)
          .filter((cpf: string) => cpf && cpf.length === 11)
      );

      if (clientPartnerCPFs.size === 0) {
        setLoading(false);
        return;
      }

      // Buscar outras empresas que compartilham os mesmos sócios
      const relatedCompanies = (allClients || [])
        .filter(otherClient => {
          if (otherClient.id === client.id || !otherClient.qsa) return false;
          
          const otherPartnerCPFs = otherClient.qsa
            .map((socio: any) => socio.cpf_cnpj_socio || socio.cpf)
            .filter((cpf: string) => cpf && cpf.length === 11);

          return otherPartnerCPFs.some((cpf: string) => clientPartnerCPFs.has(cpf));
        })
        .map(c => ({
          id: c.id,
          name: c.name,
          individual_fee: c.monthly_fee || 0
        }));

      if (relatedCompanies.length === 0) {
        setLoading(false);
        return;
      }

      // Calcular total de honorários
      const totalFee = relatedCompanies.reduce((sum, c) => sum + c.individual_fee, 0) + (client.monthly_fee || 0);

      setGroupData({
        group_id: 'economic-group',
        group_name: 'Grupo Econômico (Sócios em Comum)',
        main_payer_client_id: client.id,
        total_monthly_fee: totalFee,
        payment_day: client.payment_day || 10,
        members: [
          { id: client.id, name: client.name, individual_fee: client.monthly_fee || 0 },
          ...relatedCompanies
        ]
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
    try {
      // Verificar se há sócios em comum com outras empresas
      if (!client.qsa || client.qsa.length === 0) {
        setBelongsToGroup(false);
        return;
      }

      // Extrair CPFs dos sócios
      const clientPartnerCPFs = new Set(
        client.qsa
          .map((socio: any) => socio.cpf_cnpj_socio || socio.cpf)
          .filter((cpf: string) => cpf && cpf.length === 11)
      );

      if (clientPartnerCPFs.size === 0) {
        setBelongsToGroup(false);
        return;
      }

      // Verificar se alguma outra empresa compartilha os mesmos sócios
      const hasSharedPartners = allClients?.some(otherClient => {
        if (otherClient.id === client.id || !otherClient.qsa) return false;
        
        const otherPartnerCPFs = otherClient.qsa
          .map((socio: any) => socio.cpf_cnpj_socio || socio.cpf)
          .filter((cpf: string) => cpf && cpf.length === 11);

        return otherPartnerCPFs.some((cpf: string) => clientPartnerCPFs.has(cpf));
      });

      setBelongsToGroup(hasSharedPartners || false);
    } catch (error) {
      console.error('Error checking group membership:', error);
      setBelongsToGroup(false);
    }
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
        <Users className="h-3 w-3" />
        Sócios em Comum
      </Badge>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Empresas com Sócios em Comum
            </DialogTitle>
            <DialogDescription>
              Empresas que compartilham os mesmos sócios/proprietários
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : groupData ? (
            <div className="space-y-6">
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total de Empresas:</span>
                    <span className="font-semibold">{groupData.members.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Receita Total Combinada:</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(groupData.total_monthly_fee)}
                    </span>
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
                      key={member.id}
                      className={`p-4 transition-all ${
                        member.id === client.id
                          ? "bg-primary/5 border-primary"
                          : "hover:bg-accent cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <p className="font-medium">{member.name}</p>
                            {member.id === client.id && (
                              <Badge variant="outline" className="text-xs">
                                Empresa Atual
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Honorário Mensal: <strong>{formatCurrency(member.individual_fee)}</strong>
                            </span>
                          </div>
                        </div>

                        {member.id !== client.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCompanyClick(member.id, member.name)}
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
                  <strong>Sócios em Comum:</strong> Estas empresas compartilham os mesmos sócios/proprietários
                  de acordo com os dados cadastrais da Receita Federal (QSA - Quadro Societário).
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
