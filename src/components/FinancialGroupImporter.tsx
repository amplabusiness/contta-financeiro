import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertCircle, Building2, Crown, Search, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDocument, normalizeDocument } from "@/lib/formatters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface SpreadsheetCompany {
  name: string;
  document: string;
}

interface SpreadsheetGroup {
  groupNumber: number;
  groupName: string;
  companies: SpreadsheetCompany[];
  color: string;
}

interface MatchedCompany {
  spreadsheetName: string;
  spreadsheetDocument: string;
  clientId: string | null;
  clientName: string | null;
  currentFee: number | null;
  currentPaymentDay: number | null;
  found: boolean;
  manualSearch?: string;
}

interface GroupMatch {
  group: SpreadsheetGroup;
  matches: MatchedCompany[];
  mainPayerIndex: number;
  approved: boolean;
  processing: boolean;
}

interface ClientOption {
  id: string;
  name: string;
  document: string;
  monthly_fee: number;
  payment_day: number;
}

const GROUP_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#06b6d4", "#eab308", "#a855f7", "#22c55e", "#f43f5e",
  "#0ea5e9", "#d946ef", "#16a34a", "#dc2626", "#7c3aed",
  "#059669"
];

interface FinancialGroupImporterProps {
  spreadsheetData: any[][];
  onComplete: () => void;
}

export function FinancialGroupImporter({ spreadsheetData, onComplete }: FinancialGroupImporterProps) {
  const [groups, setGroups] = useState<GroupMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [allClients, setAllClients] = useState<ClientOption[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  const parseSpreadsheet = async () => {
    setLoading(true);
    try {
      // Buscar todos os clientes para o dropdown
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, cnpj, cpf, monthly_fee, payment_day")
        .eq("status", "active")
        .order("name");

      const clientOptions: ClientOption[] = (clients || []).map(c => ({
        id: c.id,
        name: c.name,
        document: formatDocument(c.cnpj || c.cpf || ""),
        monthly_fee: c.monthly_fee || 0,
        payment_day: c.payment_day || 10
      }));

      setAllClients(clientOptions);

      // Parse da planilha - Estrutura: A=Empresa, B=CNPJ/CPF, C=Grupo
      const groupsMap = new Map<string, SpreadsheetCompany[]>();

      console.log("📊 Iniciando parse - Total de linhas:", spreadsheetData.length);

      for (let i = 0; i < spreadsheetData.length; i++) {
        const row = spreadsheetData[i];
        if (!row || row.length < 3) continue;

        const companyName = String(row[0] ?? "").trim();  // Coluna A
        const document = String(row[1] ?? "").trim();      // Coluna B
        const groupIdentifier = String(row[2] ?? "").trim(); // Coluna C

        const normalized = normalizeDocument(document);
        const hasValidDoc = normalized.length === 11 || normalized.length === 14;

        console.log(`Linha ${i}: empresa="${companyName}", doc="${document}", grupo="${groupIdentifier}", valid=${hasValidDoc}`);

        // Pular cabeçalho ou linhas sem documento válido
        if (!hasValidDoc || !companyName) {
          console.log(`  ⏭️ Ignorando linha ${i} (cabeçalho ou inválida)`);
          continue;
        }

        // Agrupar empresas pelo identificador da coluna C
        if (!groupsMap.has(groupIdentifier)) {
          groupsMap.set(groupIdentifier, []);
        }

        groupsMap.get(groupIdentifier)!.push({
          name: companyName,
          document: document
        });

        console.log(`  ✅ Empresa "${companyName}" adicionada ao ${groupIdentifier}`);
      }

      // Converter Map para array de grupos
      const parsedGroups: SpreadsheetGroup[] = [];
      let groupIndex = 0;

      groupsMap.forEach((companies, groupName) => {
        const match = groupName.match(/\d+/);
        const groupNumber = match ? parseInt(match[0]) : groupIndex + 1;

        parsedGroups.push({
          groupNumber,
          groupName,
          companies,
          color: GROUP_COLORS[(groupNumber - 1) % GROUP_COLORS.length]
        });

        console.log(`📦 Grupo criado: ${groupName} com ${companies.length} empresas`);
        groupIndex++;
      });

      console.log(`📊 RESULTADO: ${parsedGroups.length} grupos identificados`);
      parsedGroups.forEach((g, i) => {
        console.log(`  ${i + 1}. ${g.groupName} - ${g.companies.length} empresas`);
      });

      // Fazer match automático
      const baseGroupMatches: GroupMatch[] = parsedGroups.map(group => {
        const matches: MatchedCompany[] = group.companies.map(company => {
          const normalizedDoc = normalizeDocument(company.document);
          const matchedClient = clientOptions.find(c => 
            normalizeDocument(c.document) === normalizedDoc
          );

          if (matchedClient) {
            return {
              spreadsheetName: company.name,
              spreadsheetDocument: company.document,
              clientId: matchedClient.id,
              clientName: matchedClient.name,
              currentFee: matchedClient.monthly_fee,
              currentPaymentDay: matchedClient.payment_day,
              found: true
            };
          }

          return {
            spreadsheetName: company.name,
            spreadsheetDocument: company.document,
            clientId: null,
            clientName: null,
            currentFee: null,
            currentPaymentDay: null,
            found: false,
            manualSearch: ""
          };
        });

        // Primeira empresa com fee > 0 ou primeira empresa é a pagadora por padrão
        const mainPayerIndex = matches.findIndex(m => m.currentFee && m.currentFee > 0);

        return {
          group,
          matches,
          mainPayerIndex: mainPayerIndex >= 0 ? mainPayerIndex : 0,
          approved: false,
          processing: false
        };
      });

      // Verificar quais clientes já pertencem a algum grupo financeiro existente
      const allClientIds = baseGroupMatches
        .flatMap(g => g.matches.map(m => m.clientId))
        .filter((id): id is string => Boolean(id));

      let groupMatches: GroupMatch[] = baseGroupMatches;

      if (allClientIds.length > 0) {
        const { data: existingMembers, error: existingError } = await supabase
          .from("economic_group_members")
          .select("client_id")
          .in("client_id", allClientIds);

        if (existingError) {
          console.error("Erro ao verificar grupos existentes:", existingError);
        } else {
          const existingClientIds = new Set<string>((existingMembers || []).map(m => m.client_id));

          groupMatches = baseGroupMatches.map(g => {
            const hasClientInExistingGroup = g.matches.some(m => m.clientId && existingClientIds.has(m.clientId));

            // Se qualquer empresa do grupo já estiver em um grupo financeiro,
            // marcamos este grupo como já aprovado para evitar duplicação.
            return hasClientInExistingGroup
              ? { ...g, approved: true }
              : g;
          });
        }
      }

      setGroups(groupMatches);
      setInitialized(true);
      
      const totalCompanies = groupMatches.reduce((sum, g) => sum + g.matches.length, 0);
      const foundCompanies = groupMatches.reduce((sum, g) => 
        sum + g.matches.filter(m => m.found).length, 0
      );
      
      toast.success(
        `${parsedGroups.length} grupos identificados • ${foundCompanies} de ${totalCompanies} empresas encontradas`
      );
    } catch (error) {
      console.error("Erro ao processar planilha:", error);
      toast.error("Erro ao processar a planilha");
    } finally {
      setLoading(false);
    }
  };

  const handleManualMatch = (groupIndex: number, matchIndex: number, clientId: string) => {
    const client = allClients.find(c => c.id === clientId);
    if (!client) return;

    setGroups(prev => prev.map((g, gi) => {
      if (gi !== groupIndex) return g;

      const newMatches = [...g.matches];
      newMatches[matchIndex] = {
        ...newMatches[matchIndex],
        clientId: client.id,
        clientName: client.name,
        currentFee: client.monthly_fee,
        currentPaymentDay: client.payment_day,
        found: true
      };

      return { ...g, matches: newMatches };
    }));
  };

  const handleSetMainPayer = (groupIndex: number, matchIndex: number) => {
    setGroups(prev => prev.map((g, gi) => 
      gi === groupIndex ? { ...g, mainPayerIndex: matchIndex } : g
    ));
  };

  const handleApproveGroup = async (groupIndex: number) => {
    const groupMatch = groups[groupIndex];
    
    // Verificar se todas as empresas foram identificadas
    const allMatched = groupMatch.matches.every(m => m.found && m.clientId);
    if (!allMatched) {
      toast.error("Todas as empresas do grupo devem ser identificadas antes da aprovação");
      return;
    }

    // Verificar se pelo menos uma empresa tem honorário configurado
    const hasValidFee = groupMatch.matches.some(m => m.currentFee && m.currentFee > 0);
    if (!hasValidFee) {
      toast.error("Pelo menos uma empresa do grupo deve ter um valor de honorário configurado. Grupos financeiros não podem ter todas as empresas em pro-bono.");
      return;
    }

    setGroups(prev => prev.map((g, i) => 
      i === groupIndex ? { ...g, processing: true } : g
    ));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const mainPayer = groupMatch.matches[groupMatch.mainPayerIndex];
      if (!mainPayer?.clientId) {
        throw new Error("Empresa pagadora não definida");
      }

      // Calcular honorário total e individual
      const totalFee = mainPayer.currentFee || 0;
      
      if (totalFee <= 0) {
        throw new Error("Empresa pagadora deve ter um valor de honorário configurado");
      }
      
      const paymentDay = mainPayer.currentPaymentDay || 10;
      const individualFee = totalFee / groupMatch.matches.length;

      // Criar grupo financeiro
      const { data: economicGroup, error: groupError } = await supabase
        .from("economic_groups")
        .insert({
          name: groupMatch.group.groupName,
          main_payer_client_id: mainPayer.clientId,
          total_monthly_fee: totalFee,
          payment_day: paymentDay,
          is_active: true,
          group_color: groupMatch.group.color,
          created_by: user.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Adicionar membros
      const members = groupMatch.matches.map(m => ({
        economic_group_id: economicGroup.id,
        client_id: m.clientId!,
        individual_fee: individualFee
      }));

      const { error: membersError } = await supabase
        .from("economic_group_members")
        .insert(members);

      if (membersError) throw membersError;

      // Atualizar todos os clientes do grupo com mesmo payment_day
      for (const match of groupMatch.matches) {
        const { error: updateError } = await supabase
          .from("clients")
          .update({
            monthly_fee: match.clientId === mainPayer.clientId ? totalFee : individualFee,
            payment_day: paymentDay,
            is_pro_bono: false,
            pro_bono_start_date: null,
            pro_bono_end_date: null,
            pro_bono_reason: null
          })
          .eq("id", match.clientId!);

        if (updateError) throw updateError;
      }

      setGroups(prev => prev.map((g, i) => 
        i === groupIndex ? { ...g, approved: true, processing: false } : g
      ));

      toast.success(`Grupo Financeiro "${groupMatch.group.groupName}" aprovado com sucesso!`);
    } catch (error) {
      console.error("Erro ao aprovar grupo:", error);
      toast.error("Erro ao criar grupo financeiro");
      setGroups(prev => prev.map((g, i) => 
        i === groupIndex ? { ...g, processing: false } : g
      ));
    }
  };

  if (!initialized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Processar Planilha de Grupos Financeiros</CardTitle>
          <CardDescription>
            A planilha será analisada para identificar os grupos e fazer o match das empresas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={parseSpreadsheet} disabled={loading} className="w-full">
            {loading ? "Processando..." : "Iniciar Análise da Planilha"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalGroups = groups.length;
  const approvedGroups = groups.filter(g => g.approved).length;
  const totalCompanies = groups.reduce((sum, g) => sum + g.matches.length, 0);
  const foundCompanies = groups.reduce((sum, g) => sum + g.matches.filter(m => m.found).length, 0);

  const filteredClients = (groupIndex: number, matchIndex: number) => {
    const searchKey = `${groupIndex}-${matchIndex}`;
    const search = searchTerms[searchKey]?.toLowerCase() || "";
    
    if (!search) return allClients.slice(0, 50);
    
    return allClients.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.document.includes(search)
    ).slice(0, 50);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Progresso:</strong> {approvedGroups} de {totalGroups} grupos aprovados • 
          {foundCompanies} de {totalCompanies} empresas encontradas no sistema
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {groups.map((groupMatch, groupIndex) => {
          const allMatched = groupMatch.matches.every(m => m.found);
          const hasValidFee = groupMatch.matches.some(m => m.currentFee && m.currentFee > 0);
          const mainPayer = groupMatch.matches[groupMatch.mainPayerIndex];
          const totalFee = mainPayer?.currentFee || 0;
          const individualFee = totalFee / groupMatch.matches.length;
          const canApprove = allMatched && hasValidFee;

          return (
            <Card 
              key={groupIndex} 
              className={groupMatch.approved ? "border-green-500 bg-green-50" : ""}
              style={{ borderLeftWidth: "4px", borderLeftColor: groupMatch.group.color }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5" style={{ color: groupMatch.group.color }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{groupMatch.group.groupName}</CardTitle>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
                          <Circle 
                            className="h-3 w-3 fill-current" 
                            style={{ color: groupMatch.group.color }}
                          />
                          <span className="text-xs text-muted-foreground">Identificador do grupo</span>
                        </div>
                      </div>
                      <CardDescription>
                        {groupMatch.matches.length} empresa(s) • {groupMatch.matches.filter(m => m.found).length} encontrada(s)
                      </CardDescription>
                    </div>
                  </div>
                  {groupMatch.approved ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Aprovado
                    </Badge>
                  ) : (
                    <Button
                      onClick={() => handleApproveGroup(groupIndex)}
                      disabled={!canApprove || groupMatch.processing}
                      size="sm"
                    >
                      {groupMatch.processing ? "Processando..." : "Aprovar Grupo"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              {!hasValidFee && !groupMatch.approved && (
                <div className="px-6 pb-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Impossível aprovar:</strong> Pelo menos uma empresa do grupo deve ter um valor de honorário configurado. Grupos financeiros não podem ter todas as empresas em pro-bono.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              <CardContent>
                <div className="space-y-3">
                  {groupMatch.matches.map((match, matchIndex) => (
                    <div
                      key={matchIndex}
                      className={`p-3 rounded-lg border ${
                        match.found 
                          ? "bg-green-50 border-green-200" 
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {match.found ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <Search className="h-4 w-4 text-amber-600" />
                            )}
                            <span className="font-medium text-sm">{match.spreadsheetName}</span>
                            {matchIndex === groupMatch.mainPayerIndex && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Crown className="h-3 w-3" />
                                Pagadora
                              </Badge>
                            )}
                            {match.found && matchIndex !== groupMatch.mainPayerIndex && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleSetMainPayer(groupIndex, matchIndex)}
                              >
                                Definir como Pagadora
                              </Button>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {formatDocument(match.spreadsheetDocument)}
                          </div>
                          
                          {match.found ? (
                            <div className="text-xs text-green-700">
                              ✓ {match.clientName}
                            </div>
                          ) : (
                            <div className="mt-2">
                              <Select
                                onValueChange={(value) => handleManualMatch(groupIndex, matchIndex, value)}
                                onOpenChange={(open) => {
                                  if (open) {
                                    const searchKey = `${groupIndex}-${matchIndex}`;
                                    setSearchTerms(prev => ({ ...prev, [searchKey]: "" }));
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full h-8 text-xs">
                                  <SelectValue placeholder="Buscar cliente..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <div className="p-2">
                                    <Input
                                      placeholder="Digite para buscar..."
                                      className="h-8 text-xs"
                                      value={searchTerms[`${groupIndex}-${matchIndex}`] || ""}
                                      onChange={(e) => {
                                        const searchKey = `${groupIndex}-${matchIndex}`;
                                        setSearchTerms(prev => ({ ...prev, [searchKey]: e.target.value }));
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  {filteredClients(groupIndex, matchIndex).map((client) => (
                                    <SelectItem key={client.id} value={client.id} className="text-xs">
                                      {client.name} - {client.document}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        
                        {match.found && (
                          <div className="text-right text-xs">
                            <div className="text-muted-foreground">
                              {matchIndex === groupMatch.mainPayerIndex ? "Total:" : "Individual:"}
                            </div>
                            <div className="font-semibold">
                              R$ {(matchIndex === groupMatch.mainPayerIndex ? totalFee : individualFee).toFixed(2)}
                            </div>
                            {match.currentPaymentDay && (
                              <div className="text-muted-foreground mt-1">
                                Venc: dia {match.currentPaymentDay}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {approvedGroups === totalGroups && totalGroups > 0 && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Importação Concluída!</h3>
            <p className="text-muted-foreground mb-4">
              Todos os {totalGroups} grupos financeiros foram aprovados e atualizados.
            </p>
            <Button onClick={onComplete}>
              Voltar para Grupos Financeiros
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
