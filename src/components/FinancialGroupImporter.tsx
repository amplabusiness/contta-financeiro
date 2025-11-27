import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertCircle, Building2, Users, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDocument, normalizeDocument } from "@/lib/formatters";

interface SpreadsheetGroup {
  groupNumber: number;
  groupName: string;
  companies: {
    name: string;
    document: string; // CNPJ/CPF da coluna B
    isMainPayer?: boolean;
  }[];
  totalFee?: number;
  paymentDay?: number;
}

interface MatchedCompany {
  spreadsheetName: string;
  spreadsheetDocument: string;
  clientId: string | null;
  clientName: string | null;
  currentFee: number | null;
  currentPaymentDay: number | null;
  isProBono: boolean | null;
  found: boolean;
}

interface GroupMatch {
  group: SpreadsheetGroup;
  matches: MatchedCompany[];
  approved: boolean;
  processing: boolean;
}

interface FinancialGroupImporterProps {
  spreadsheetData: any[][];
  onComplete: () => void;
}

export function FinancialGroupImporter({ spreadsheetData, onComplete }: FinancialGroupImporterProps) {
  const [groups, setGroups] = useState<GroupMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const parseSpreadsheet = async () => {
    setLoading(true);
    try {
      console.log("📊 Iniciando parse da planilha...");
      console.log("📊 Total de linhas:", spreadsheetData.length);
      console.log("📊 Primeiras 5 linhas:", spreadsheetData.slice(0, 5));
      
      // Parse a planilha e identifica os grupos
      const parsedGroups: SpreadsheetGroup[] = [];
      let currentGroup: SpreadsheetGroup | null = null;

      for (let i = 0; i < spreadsheetData.length; i++) {
        const row = spreadsheetData[i];
        if (!row || row.length < 2) continue;

        const colA = String(row[0] || "").trim();
        const colB = String(row[1] || "").trim();

        console.log(`📊 Linha ${i}: colA="${colA}", colB="${colB}"`);

        // Detectar início de novo grupo (ex: "GRUPO 1", "Grupo 2", etc)
        if (colA.toLowerCase().includes("grupo")) {
          console.log(`✅ Grupo detectado na linha ${i}: ${colA}`);
          // Salvar grupo anterior se existir
          if (currentGroup && currentGroup.companies.length > 0) {
            parsedGroups.push(currentGroup);
          }

          // Extrair número do grupo
          const match = colA.match(/\d+/);
          const groupNumber = match ? parseInt(match[0]) : parsedGroups.length + 1;
          
          currentGroup = {
            groupNumber,
            groupName: colA,
            companies: []
          };
        } 
        // Adicionar empresa ao grupo atual
        else if (currentGroup && colB) {
          const normalized = normalizeDocument(colB);
          if (normalized.length === 11 || normalized.length === 14) {
            currentGroup.companies.push({
              name: colA,
              document: colB
            });
          }
        }
      }

      // Adicionar último grupo
      if (currentGroup && currentGroup.companies.length > 0) {
        parsedGroups.push(currentGroup);
      }

      // Buscar matches para cada grupo
      const groupMatches: GroupMatch[] = [];

      for (const group of parsedGroups) {
        const matches: MatchedCompany[] = [];

        for (const company of group.companies) {
          const normalizedDoc = normalizeDocument(company.document);
          
          // Buscar em clientes (tanto pagos quanto pro-bono)
          const { data: clients, error } = await supabase
            .from("clients")
            .select("id, name, cnpj, cpf, monthly_fee, payment_day, is_pro_bono, status")
            .eq("status", "active");

          if (error) {
            console.error("Erro ao buscar clientes:", error);
            matches.push({
              spreadsheetName: company.name,
              spreadsheetDocument: company.document,
              clientId: null,
              clientName: null,
              currentFee: null,
              currentPaymentDay: null,
              isProBono: null,
              found: false
            });
            continue;
          }

          // Procurar match pelo documento
          const matchedClient = clients?.find(c => {
            const clientDoc = normalizeDocument(c.cnpj || c.cpf || "");
            return clientDoc === normalizedDoc;
          });

          if (matchedClient) {
            matches.push({
              spreadsheetName: company.name,
              spreadsheetDocument: company.document,
              clientId: matchedClient.id,
              clientName: matchedClient.name,
              currentFee: matchedClient.monthly_fee,
              currentPaymentDay: matchedClient.payment_day,
              isProBono: matchedClient.is_pro_bono,
              found: true
            });
          } else {
            matches.push({
              spreadsheetName: company.name,
              spreadsheetDocument: company.document,
              clientId: null,
              clientName: null,
              currentFee: null,
              currentPaymentDay: null,
              isProBono: null,
              found: false
            });
          }
        }

        groupMatches.push({
          group,
          matches,
          approved: false,
          processing: false
        });
      }

      setGroups(groupMatches);
      setInitialized(true);
      toast.success(`${parsedGroups.length} grupos identificados na planilha`);
    } catch (error) {
      console.error("Erro ao processar planilha:", error);
      toast.error("Erro ao processar a planilha");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveGroup = async (groupIndex: number) => {
    const groupMatch = groups[groupIndex];
    
    // Verificar se há empresas não encontradas
    const notFound = groupMatch.matches.filter(m => !m.found);
    if (notFound.length > 0) {
      toast.error(`${notFound.length} empresa(s) não encontrada(s) no sistema. Todas as empresas do grupo devem estar cadastradas.`);
      return;
    }

    // Marcar como processando
    setGroups(prev => prev.map((g, i) => 
      i === groupIndex ? { ...g, processing: true } : g
    ));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Determinar empresa pagadora (primeira com monthly_fee > 0, ou a primeira)
      const mainPayer = groupMatch.matches.find(m => m.currentFee && m.currentFee > 0) 
        || groupMatch.matches[0];

      if (!mainPayer?.clientId) {
        throw new Error("Não foi possível determinar a empresa pagadora");
      }

      // Calcular honorário total e individual
      const totalFee = mainPayer.currentFee || 1518.00;
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

      // Atualizar main payer
      const { error: mainPayerError } = await supabase
        .from("clients")
        .update({
          monthly_fee: totalFee,
          payment_day: paymentDay,
          is_pro_bono: false,
          pro_bono_start_date: null,
          pro_bono_end_date: null,
          pro_bono_reason: null
        })
        .eq("id", mainPayer.clientId);

      if (mainPayerError) throw mainPayerError;

      // Atualizar demais membros
      const otherMembers = groupMatch.matches.filter(m => m.clientId !== mainPayer.clientId);
      for (const member of otherMembers) {
        const { error: updateError } = await supabase
          .from("clients")
          .update({
            monthly_fee: individualFee,
            payment_day: paymentDay,
            is_pro_bono: false,
            pro_bono_start_date: null,
            pro_bono_end_date: null,
            pro_bono_reason: null
          })
          .eq("id", member.clientId!);

        if (updateError) throw updateError;
      }

      // Marcar como aprovado
      setGroups(prev => prev.map((g, i) => 
        i === groupIndex ? { ...g, approved: true, processing: false } : g
      ));

      toast.success(`${groupMatch.group.groupName} criado com sucesso!`);
    } catch (error) {
      console.error("Erro ao criar grupo:", error);
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
        {groups.map((groupMatch, index) => {
          const notFoundCount = groupMatch.matches.filter(m => !m.found).length;
          const canApprove = notFoundCount === 0 && !groupMatch.approved;

          return (
            <Card key={index} className={groupMatch.approved ? "border-green-500 bg-green-50" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{groupMatch.group.groupName}</CardTitle>
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
                      onClick={() => handleApproveGroup(index)}
                      disabled={!canApprove || groupMatch.processing}
                      size="sm"
                    >
                      {groupMatch.processing ? "Processando..." : "Aprovar Grupo"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {groupMatch.matches.map((match, matchIndex) => (
                    <div
                      key={matchIndex}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        match.found 
                          ? "bg-green-50 border-green-200" 
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {match.found ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{match.spreadsheetName}</span>
                            {matchIndex === 0 && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Crown className="h-3 w-3" />
                                Pagadora
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDocument(match.spreadsheetDocument)}
                          </div>
                          {match.found && (
                            <div className="text-xs text-green-700 mt-1">
                              ✓ Encontrado: {match.clientName}
                              {match.isProBono && " (Pro-Bono)"}
                            </div>
                          )}
                        </div>
                      </div>
                      {match.found && (
                        <div className="text-right text-xs">
                          <div className="text-muted-foreground">Honorário atual:</div>
                          <div className="font-semibold">
                            R$ {(match.currentFee || 0).toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {approvedGroups === totalGroups && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Importação Concluída!</h3>
            <p className="text-muted-foreground mb-4">
              Todos os {totalGroups} grupos financeiros foram criados com sucesso.
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
