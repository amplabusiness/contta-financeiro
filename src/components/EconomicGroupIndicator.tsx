import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useClient } from "@/contexts/ClientContext";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  qsa: any[] | null;
}

interface EconomicGroupIndicatorProps {
  client: Client;
  allClients: Client[];
}

interface EconomicGroup {
  partnerName: string;
  companies: Client[];
}

const extractPartnerNames = (qsa: any[] | null): string[] => {
  if (!qsa || !Array.isArray(qsa)) return [];
  return qsa
    .map((socio) => socio.nome || socio.nome_socio)
    .filter((nome): nome is string => typeof nome === "string" && nome.trim().length > 0);
};

const findEconomicGroups = (client: Client, allClients: Client[]): EconomicGroup[] => {
  const clientPartners = extractPartnerNames(client.qsa);
  if (clientPartners.length === 0) return [];

  const groups: EconomicGroup[] = [];

  clientPartners.forEach((partnerName) => {
    // Find all companies that share this partner
    const relatedCompanies = allClients.filter((otherClient) => {
      if (otherClient.id === client.id) return false; // Exclude current client
      const otherPartners = extractPartnerNames(otherClient.qsa);
      return otherPartners.includes(partnerName);
    });

    if (relatedCompanies.length > 0) {
      groups.push({
        partnerName,
        companies: [client, ...relatedCompanies],
      });
    }
  });

  return groups;
};

export const EconomicGroupIndicator = ({ client, allClients }: EconomicGroupIndicatorProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setSelectedClient } = useClient();
  const groups = findEconomicGroups(client, allClients);

  // If no groups found, don't render anything
  if (groups.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Count unique companies across all groups
  const uniqueCompanies = new Set<string>();
  groups.forEach((group) => {
    group.companies.forEach((company) => uniqueCompanies.add(company.id));
  });
  const totalCompanies = uniqueCompanies.size;

  const handleCompanyClick = (companyId: string, companyName: string) => {
    setSelectedClient(companyId, companyName);
    setDialogOpen(false);
  };

  const formatDocument = (company: Client) => {
    if (company.cnpj) {
      const cleaned = company.cnpj.replace(/\D/g, "");
      return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    if (company.cpf) {
      const cleaned = company.cpf.replace(/\D/g, "");
      return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    return "-";
  };

  return (
    <>
      <Badge
        variant="secondary"
        className="cursor-pointer gap-1 hover:bg-secondary/80 transition-colors"
        onClick={() => setDialogOpen(true)}
      >
        <Building2 className="h-3 w-3" />
        {totalCompanies} {totalCompanies === 1 ? "empresa" : "empresas"}
      </Badge>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Grupo Econômico
            </DialogTitle>
            <DialogDescription>
              Empresas relacionadas por sócios em comum
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {groups.map((group, idx) => (
              <div key={idx} className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-semibold">Sócio em comum:</h4>
                  <span className="text-sm text-muted-foreground">{group.partnerName}</span>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {group.companies.length} {group.companies.length === 1 ? "empresa" : "empresas"} no grupo
                  </p>
                  
                  <div className="space-y-2">
                    {group.companies.map((company) => (
                      <Card
                        key={company.id}
                        className={`p-4 transition-all ${
                          company.id === client.id
                            ? "bg-primary/5 border-primary"
                            : "hover:bg-accent cursor-pointer"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">{company.name}</p>
                              {company.id === client.id && (
                                <Badge variant="outline" className="text-xs">
                                  Empresa Atual
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDocument(company)}
                            </p>
                          </div>

                          {company.id !== client.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCompanyClick(company.id, company.name)}
                            >
                              Ver empresa →
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
