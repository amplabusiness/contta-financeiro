import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Partners() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const { toast } = useToast();

  const { data: partners, isLoading } = useQuery({
    queryKey: ["partners-search", activeSearch],
    queryFn: async () => {
      if (!activeSearch || activeSearch.trim().length < 2) {
        return [];
      }

      const searchTerm = activeSearch.trim().toUpperCase();

      // Buscar em ambas as fontes: client_partners e qsa dos clients
      const [partnersData, clientsData] = await Promise.all([
        // Buscar na tabela client_partners
        supabase
          .from("client_partners")
          .select(`
            id,
            name,
            cpf,
            email,
            phone,
            percentage,
            is_administrator,
            client_id,
            clients (
              id,
              name,
              cnpj,
              status
            )
          `)
          .ilike("name", `%${searchTerm}%`)
          .order("name"),
        
        // Buscar no campo qsa dos clients
        supabase
          .from("clients")
          .select("id, name, cnpj, status, qsa")
          .not("qsa", "is", null)
      ]);

      if (partnersData.error) {
        toast({
          title: "Erro ao buscar sócios",
          description: partnersData.error.message,
          variant: "destructive",
        });
        throw partnersData.error;
      }

      if (clientsData.error) {
        toast({
          title: "Erro ao buscar empresas",
          description: clientsData.error.message,
          variant: "destructive",
        });
        throw clientsData.error;
      }

      // Processar resultados da tabela client_partners
      const fromPartners = partnersData.data || [];

      // Processar resultados do campo qsa
      const fromQsa: any[] = [];
      (clientsData.data || []).forEach((client: any) => {
        if (client.qsa && Array.isArray(client.qsa)) {
          client.qsa.forEach((socio: any) => {
            const socioName = socio.nome || socio.name || "";
            if (socioName.toUpperCase().includes(searchTerm)) {
              fromQsa.push({
                id: `qsa-${client.id}-${socioName}`,
                name: socioName,
                cpf: socio.cpf || null,
                email: null,
                phone: null,
                percentage: socio.participacao || socio.percentage || null,
                is_administrator: socio.qual === "Administrador" || socio.is_administrator || false,
                client_id: client.id,
                clients: {
                  id: client.id,
                  name: client.name,
                  cnpj: client.cnpj,
                  status: client.status
                }
              });
            }
          });
        }
      });

      // Combinar e remover duplicatas
      const combined = [...fromPartners, ...fromQsa];
      const unique = combined.filter((item, index, self) =>
        index === self.findIndex((t) => 
          t.name === item.name && t.clients?.cnpj === item.clients?.cnpj
        )
      );

      return unique.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: activeSearch.trim().length >= 2,
  });

  const handleSearch = () => {
    if (searchTerm.trim().length < 2) {
      toast({
        title: "Digite ao menos 2 caracteres",
        description: "Para realizar a busca, digite ao menos 2 caracteres do nome do sócio.",
        variant: "destructive",
      });
      return;
    }
    setActiveSearch(searchTerm);
  };

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return "-";
    const cleaned = cnpj.replace(/\D/g, "");
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Busca de Sócios</h1>
          <p className="text-muted-foreground">
            Pesquise pelo nome do sócio para ver em quais empresas ele está vinculado
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Pesquisar Sócio
            </CardTitle>
            <CardDescription>
              Digite o nome do sócio para buscar suas empresas vinculadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Digite qualquer parte do nome (mínimo 2 caracteres)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              A busca funciona com letras maiúsculas ou minúsculas e procura em qualquer parte do nome
            </p>
          </CardContent>
        </Card>

        {activeSearch && (
          <Card>
            <CardHeader>
              <CardTitle>
                Resultados da Busca
                {partners && partners.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({partners.length} {partners.length === 1 ? "resultado" : "resultados"})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Buscando...
                </div>
              ) : !partners || partners.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum sócio encontrado com este nome
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome do Sócio</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Nome da Empresa</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Participação</TableHead>
                        <TableHead>Administrador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((partner: any) => (
                        <TableRow key={partner.id}>
                          <TableCell className="font-medium">{partner.name}</TableCell>
                          <TableCell>{partner.cpf || "-"}</TableCell>
                          <TableCell>{partner.clients?.name || "-"}</TableCell>
                          <TableCell>{formatCNPJ(partner.clients?.cnpj)}</TableCell>
                          <TableCell>
                            {partner.percentage ? `${partner.percentage}%` : "-"}
                          </TableCell>
                          <TableCell>
                            {partner.is_administrator ? (
                              <span className="text-green-600 font-medium">Sim</span>
                            ) : (
                              <span className="text-muted-foreground">Não</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
