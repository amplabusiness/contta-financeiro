import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, CheckCircle, Building2, RefreshCw } from "lucide-react";

interface GroupMember {
  id: string;
  client_id: string;
  individual_fee: number;
  clients: {
    name: string;
    monthly_fee: number;
  };
}

interface FinancialGroup {
  id: string;
  name: string;
  total_monthly_fee: number;
  payment_day: number;
  group_color: string | null;
  created_at: string | null;
  economic_group_members: GroupMember[];
}

interface GroupAudit {
  group: FinancialGroup;
  needsCorrection: boolean;
  currentTotal: number;
  calculatedIndividual: number;
  memberCount: number;
  originalFees: { [clientId: string]: number };
}

export function FinancialGroupAudit() {
  const [groups, setGroups] = useState<GroupAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [correcting, setCorrecting] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("economic_groups")
        .select(`
          id,
          name,
          total_monthly_fee,
          payment_day,
          group_color,
          created_at,
          economic_group_members (
            id,
            client_id,
            individual_fee,
            clients (
              name,
              monthly_fee
            )
          )
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      const groupsData = (data || []) as FinancialGroup[];

      const audits: GroupAudit[] = await Promise.all(
        groupsData.map(async (group) => {
          const memberCount = group.economic_group_members.length;
          const memberClientIds = group.economic_group_members.map(
            (member) => member.client_id
          );

          let originalFees: { [key: string]: number } = {};
          let sumOfOriginalFees = 0;

          if (memberClientIds.length > 0 && group.created_at) {
            const { data: invoices, error: invoicesError } = await supabase
              .from("invoices")
              .select("client_id, amount, created_at")
              .in("client_id", memberClientIds)
              .lt("created_at", group.created_at);

            if (invoicesError) {
              console.error(
                "Erro ao buscar invoices para grupo financeiro:",
                invoicesError
              );
            } else {
              const latestByClient: {
                [clientId: string]: { created_at: string; amount: number };
              } = {};

              (invoices || []).forEach((invoice) => {
                const clientId = invoice.client_id as string;
                const existing = latestByClient[clientId];
                if (
                  !existing ||
                  new Date(invoice.created_at).getTime() >
                    new Date(existing.created_at).getTime()
                ) {
                  latestByClient[clientId] = {
                    created_at: invoice.created_at,
                    amount: Number(invoice.amount) || 0,
                  };
                }
              });

              originalFees = {};
              sumOfOriginalFees = 0;

              Object.entries(latestByClient).forEach(([clientId, info]) => {
                originalFees[clientId] = info.amount;
                sumOfOriginalFees += info.amount;
              });
            }
          }

          const hasAnyOriginalFee = sumOfOriginalFees > 0;
          const safeMemberCount = memberCount || 1;
          const correctIndividualFee = sumOfOriginalFees / safeMemberCount;

          const needsCorrection =
            hasAnyOriginalFee &&
            group.economic_group_members.some(
              (member) =>
                Math.abs(member.individual_fee - correctIndividualFee) > 0.01
            );

          return {
            group,
            needsCorrection,
            currentTotal: group.total_monthly_fee,
            calculatedIndividual: correctIndividualFee,
            memberCount,
            originalFees,
          };
        })
      );

      setGroups(audits);

      setGroups(audits);
    } catch (error) {
      console.error("Erro ao carregar grupos:", error);
      toast.error("Erro ao carregar grupos financeiros");
    } finally {
      setLoading(false);
    }
  };

  const handleCorrectGroup = async (groupId: string) => {
    setCorrecting(groupId);
    
    try {
      const audit = groups.find(a => a.group.id === groupId);
      if (!audit) throw new Error("Grupo não encontrado");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Usar os valores já calculados automaticamente
      const totalFee = Object.values(audit.originalFees).reduce((sum, fee) => sum + fee, 0);
      const individualFee = audit.calculatedIndividual;
      
      if (totalFee <= 0) {
        toast.error("O total de honorários deve ser maior que zero");
        setCorrecting(null);
        return;
      }

      // Atualizar o grupo
      const { error: groupError } = await supabase
        .from("economic_groups")
        .update({
          total_monthly_fee: totalFee
        })
        .eq("id", groupId);

      if (groupError) throw groupError;

      // Atualizar members
      for (const member of audit.group.economic_group_members) {
        const { error: memberError } = await supabase
          .from("economic_group_members")
          .update({
            individual_fee: individualFee
          })
          .eq("id", member.id);

        if (memberError) throw memberError;

        // Atualizar client
        const { error: clientError } = await supabase
          .from("clients")
          .update({
            monthly_fee: individualFee
          })
          .eq("id", member.client_id);

        if (clientError) throw clientError;
      }

      toast.success(`Grupo "${audit.group.name}" corrigido com sucesso!`);
      await loadGroups();
    } catch (error) {
      console.error("Erro ao corrigir grupo:", error);
      toast.error("Erro ao corrigir grupo financeiro");
    } finally {
      setCorrecting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Carregando grupos financeiros...</p>
        </CardContent>
      </Card>
    );
  }

  const groupsNeedingCorrection = groups.filter(g => g.needsCorrection);
  const totalGroups = groups.length;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Auditoria Automática:</strong> {groupsNeedingCorrection.length} de {totalGroups} grupos precisam de correção. 
          O sistema buscou automaticamente os honorários originais de cada empresa nas faturas anteriores à criação do grupo, somou todos e calculou a divisão correta.
        </AlertDescription>
      </Alert>

      {groupsNeedingCorrection.length === 0 && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Todos os grupos estão corretos!</h3>
            <p className="text-muted-foreground">
              Nenhuma inconsistência foi detectada nos {totalGroups} grupos financeiros.
            </p>
          </CardContent>
        </Card>
      )}

      {groupsNeedingCorrection.length > 0 && (
        <Card className="border-amber-500">
          <CardContent className="pt-6">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{groupsNeedingCorrection.length} grupo(s)</strong> precisam de correção. 
                As empresas desses grupos têm valores de honorários no banco que não correspondem aos valores divididos registrados no grupo.
              </AlertDescription>
            </Alert>
            <Button
              onClick={async () => {
                for (const audit of groupsNeedingCorrection) {
                  await handleCorrectGroup(audit.group.id);
                }
              }}
              disabled={correcting !== null}
              className="w-full"
              variant="destructive"
            >
              {correcting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Corrigindo grupos...
                </>
              ) : (
                <>Corrigir Todos os {groupsNeedingCorrection.length} Grupos Automaticamente</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {groups.map((audit) => (
          <Card 
            key={audit.group.id}
            className={audit.needsCorrection ? "border-amber-500" : "border-green-500"}
            style={{ borderLeftWidth: "4px", borderLeftColor: audit.group.group_color || undefined }}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5" style={{ color: audit.group.group_color || undefined }} />
                  <div>
                    <CardTitle className="text-lg">{audit.group.name}</CardTitle>
                    <CardDescription>
                      {audit.memberCount} empresa(s) • Dia de pagamento: {audit.group.payment_day}
                    </CardDescription>
                  </div>
                </div>
                {audit.needsCorrection ? (
                  <Badge variant="destructive">Precisa Correção</Badge>
                ) : (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Correto
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {audit.needsCorrection && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Inconsistência detectada:</strong> Os honorários originais das empresas (antes da criação do grupo) não correspondem ao individual_fee registrado. 
                  Somando todos esses valores originais e dividindo igualmente, cada empresa deveria ter {formatCurrency(audit.calculatedIndividual)}.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3 mb-4">
              {audit.group.economic_group_members.map((member) => (
                <div key={member.id} className="p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                    <div className="font-medium text-sm mb-1">{member.clients.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Honorário original (antes do grupo): <strong>{formatCurrency(audit.originalFees[member.client_id] || 0)}</strong>
                    </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-muted-foreground">Individual (BD):</div>
                      <div className={`font-semibold ${audit.needsCorrection ? 'text-red-600' : ''}`}>
                        {formatCurrency(member.individual_fee)}
                      </div>
                      {audit.needsCorrection && (
                        <>
                          <div className="text-muted-foreground mt-1">Deveria ser:</div>
                          <div className="text-green-600 font-semibold">
                            {formatCurrency(audit.calculatedIndividual)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Soma dos honorários originais:</div>
                  <div className="font-semibold text-lg">
                    {formatCurrency(Object.values(audit.originalFees).reduce((sum, fee) => sum + fee, 0))}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Individual correto:</div>
                  <div className="font-semibold text-lg text-green-600">
                    {formatCurrency(audit.calculatedIndividual)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total atual (BD):</div>
                  <div className="font-semibold text-lg">
                    {formatCurrency(audit.currentTotal)}
                  </div>
                </div>
              </div>
            </div>

              {audit.needsCorrection && (
                <Button
                  onClick={() => handleCorrectGroup(audit.group.id)}
                  disabled={correcting === audit.group.id}
                  className="w-full"
                >
                  {correcting === audit.group.id ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Corrigindo...
                    </>
                  ) : (
                    "Aplicar Correção"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
