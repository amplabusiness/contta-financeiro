import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  UserX, 
  RefreshCw,
  Calendar,
  TrendingDown,
  CheckCircle,
} from "lucide-react";
import { format, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface GapAnalysis {
  client_id: string;
  client_name: string;
  missing_months: string[];
  last_invoice_date: string;
  has_future_invoices: boolean;
  total_missing: number;
  status: "active" | "suspended";
}

const BoletoGapsAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [gaps, setGaps] = useState<GapAnalysis[]>([]);
  const [selectedGap, setSelectedGap] = useState<GapAnalysis | null>(null);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendNotes, setSuspendNotes] = useState("");

  useEffect(() => {
    analyzeGaps();
  }, []);

  const analyzeGaps = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Buscar clientes ativos
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, status")
        .eq("is_active", true);

      if (clientsError) throw clientsError;

      // Buscar todos os boletos dos últimos 12 meses
      const startDate = format(subMonths(new Date(), 12), "yyyy-MM-dd");
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("client_id, competence, due_date")
        .gte("competence", startDate.substring(0, 7))
        .order("competence", { ascending: false });

      if (invoicesError) throw invoicesError;

      const gapsFound: GapAnalysis[] = [];

      // Analisar cada cliente
      for (const client of clients || []) {
        const clientInvoices = (invoices || []).filter(inv => inv.client_id === client.id);
        
        if (clientInvoices.length === 0) continue;

        // Obter competências com boleto
        const competencesWithInvoice = new Set(
          clientInvoices.map(inv => inv.competence).filter(Boolean)
        );

        // Gerar lista de competências esperadas (últimos 12 meses)
        const expectedCompetences: string[] = [];
        for (let i = 0; i < 12; i++) {
          const date = subMonths(new Date(), i);
          expectedCompetences.push(format(date, "yyyy-MM"));
        }

        // Encontrar ausências
        const missingMonths = expectedCompetences.filter(
          comp => !competencesWithInvoice.has(comp)
        );

        // Se há ausências, verificar se há boletos futuros
        if (missingMonths.length > 0) {
          const lastInvoice = clientInvoices[0];
          const lastInvoiceDate = lastInvoice.due_date || lastInvoice.competence;
          
          // Verificar se há boletos após as ausências
          const hasFutureInvoices = missingMonths.some(missing => {
            return clientInvoices.some(inv => 
              inv.competence && inv.competence > missing
            );
          });

          gapsFound.push({
            client_id: client.id,
            client_name: client.name,
            missing_months: missingMonths,
            last_invoice_date: lastInvoiceDate,
            has_future_invoices: hasFutureInvoices,
            total_missing: missingMonths.length,
            status: client.status as "active" | "suspended",
          });

          // Criar alerta crítico se esqueceu de gerar boleto
          if (hasFutureInvoices) {
            await supabase.from("audit_logs" as any).insert({
              audit_type: "boleto_missing",
              severity: "error",
              entity_type: "client",
              entity_id: client.id,
              title: `CRÍTICO: Boleto não gerado - ${client.name}`,
              description: `Cliente possui boletos em meses posteriores mas está sem boleto nas competências: ${missingMonths.join(", ")}. AÇÃO IMEDIATA: Gerar boletos retroativos e informar financeiro.`,
              metadata: {
                cliente: client.name,
                competencias_faltantes: missingMonths,
                total_faltantes: missingMonths.length,
                tem_boletos_futuros: true,
              },
              created_by: user.id,
            });
          }
        }
      }

      // Ordenar por críticos primeiro (tem boletos futuros)
      gapsFound.sort((a, b) => {
        if (a.has_future_invoices && !b.has_future_invoices) return -1;
        if (!a.has_future_invoices && b.has_future_invoices) return 1;
        return b.total_missing - a.total_missing;
      });

      setGaps(gapsFound);
      
      const criticalCount = gapsFound.filter(g => g.has_future_invoices).length;
      if (criticalCount > 0) {
        toast.error(`${criticalCount} clientes com boletos não gerados (CRÍTICO)!`);
      } else if (gapsFound.length > 0) {
        toast.warning(`${gapsFound.length} clientes com ausências de boletos`);
      } else {
        toast.success("Nenhuma ausência detectada!");
      }
    } catch (error: any) {
      toast.error("Erro ao analisar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendClient = async () => {
    if (!selectedGap || !suspendNotes.trim()) {
      toast.error("Adicione o motivo da suspensão");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Suspender cliente
      const { error: updateError } = await supabase
        .from("clients")
        .update({ 
          status: "suspended",
          notes: `[${format(new Date(), "dd/MM/yyyy")}] Suspenso: ${suspendNotes}\n\n${selectedGap.client_name}`,
        })
        .eq("id", selectedGap.client_id);

      if (updateError) throw updateError;

      // Criar log de auditoria
      await supabase.from("audit_logs" as any).insert({
        audit_type: "client_suspended",
        severity: "info",
        entity_type: "client",
        entity_id: selectedGap.client_id,
        title: `Cliente Suspenso - ${selectedGap.client_name}`,
        description: `Cliente suspenso após análise de ausências de boletos. Motivo: ${suspendNotes}`,
        metadata: {
          cliente: selectedGap.client_name,
          competencias_faltantes: selectedGap.missing_months,
          motivo: suspendNotes,
        },
        created_by: user.id,
      });

      toast.success("Cliente suspenso com sucesso!");
      setSuspendDialog(false);
      setSuspendNotes("");
      analyzeGaps();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const getSeverityBadge = (gap: GapAnalysis) => {
    if (gap.has_future_invoices) {
      return <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        CRÍTICO
      </Badge>;
    }
    return <Badge variant="secondary" className="gap-1">
      <TrendingDown className="h-3 w-3" />
      Possível Saída
    </Badge>;
  };

  const criticalGaps = gaps.filter(g => g.has_future_invoices);
  const possibleExits = gaps.filter(g => !g.has_future_invoices);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Análise de Ausências de Boletos</h1>
            <p className="text-muted-foreground">
              Detecte boletos não gerados e possíveis saídas de clientes
            </p>
          </div>
          <Button onClick={analyzeGaps} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Analisando..." : "Atualizar"}
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total de Ausências</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{gaps.length}</div>
              <p className="text-xs text-muted-foreground">clientes com boletos faltantes</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-red-600 dark:text-red-400">
                Boletos Não Gerados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {criticalGaps.length}
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">
                ação imediata necessária
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Possíveis Saídas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{possibleExits.length}</div>
              <p className="text-xs text-muted-foreground">
                clientes podem ter saído
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Críticos */}
        {criticalGaps.length > 0 && (
          <Card className="border-l-4 border-l-red-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Boletos Não Gerados (CRÍTICO)
              </CardTitle>
              <CardDescription>
                Clientes com boletos em meses posteriores mas faltando em meses anteriores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {criticalGaps.map((gap) => (
                  <Card key={gap.client_id} className="bg-red-50 dark:bg-red-950/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{gap.client_name}</CardTitle>
                            {getSeverityBadge(gap)}
                          </div>
                          <div className="text-sm space-y-1">
                            <p className="text-red-700 dark:text-red-300">
                              <strong>⚠️ Competências sem boleto:</strong>{" "}
                              {gap.missing_months.map(m => format(parseISO(m + "-01"), "MM/yyyy")).join(", ")}
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Total faltando:</strong> {gap.total_missing} mês(es)
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Último boleto:</strong>{" "}
                              {format(parseISO(gap.last_invoice_date), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-md mb-3">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          ⚡ AÇÃO IMEDIATA NECESSÁRIA
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                          Este cliente possui boletos em meses posteriores, indicando que esqueceram 
                          de gerar boletos nas competências faltantes. Gerar boletos retroativos 
                          e informar o setor financeiro imediatamente.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Possíveis Saídas */}
        {possibleExits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Possíveis Saídas de Clientes
              </CardTitle>
              <CardDescription>
                Clientes sem boletos recentes - podem ter saído da Ampla
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {possibleExits.map((gap) => (
                  <Card key={gap.client_id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{gap.client_name}</CardTitle>
                            {getSeverityBadge(gap)}
                          </div>
                          <div className="text-sm space-y-1">
                            <p className="text-muted-foreground">
                              <strong>Competências sem boleto:</strong>{" "}
                              {gap.missing_months.slice(0, 3).map(m => format(parseISO(m + "-01"), "MM/yyyy")).join(", ")}
                              {gap.missing_months.length > 3 && ` e mais ${gap.missing_months.length - 3}`}
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Total faltando:</strong> {gap.total_missing} mês(es)
                            </p>
                            <p className="text-muted-foreground">
                              <strong>Último boleto:</strong>{" "}
                              {format(parseISO(gap.last_invoice_date), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedGap(gap);
                            setSuspendDialog(true);
                          }}
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Suspender Cliente
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && gaps.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhuma ausência detectada!</p>
                <p className="text-sm text-muted-foreground">
                  Todos os clientes ativos possuem boletos regulares
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Suspensão */}
      <Dialog open={suspendDialog} onOpenChange={setSuspendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspender Cliente</DialogTitle>
            <DialogDescription>
              {selectedGap?.client_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Motivo da Suspensão *</Label>
              <Textarea
                value={suspendNotes}
                onChange={(e) => setSuspendNotes(e.target.value)}
                placeholder="Ex: Cliente solicitou cancelamento, Migrou para outro escritório, etc."
                rows={4}
              />
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                O cliente será marcado como suspenso e um log de auditoria será criado.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSuspendClient} disabled={!suspendNotes.trim()}>
              <UserX className="h-4 w-4 mr-2" />
              Confirmar Suspensão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default BoletoGapsAnalysis;
