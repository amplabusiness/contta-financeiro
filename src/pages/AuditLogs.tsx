import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle, 
  Eye,
  CheckCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  created_at: string;
  audit_type: string;
  severity: string;
  entity_type: string;
  entity_id: string | null;
  title: string;
  description: string | null;
  metadata: any;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [showResolved]);

  const loadLogs = async () => {
    try {
      const query = supabase
        .from("audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (!showResolved) {
        query.eq("resolved", false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data as any) || []);
    } catch (error: any) {
      toast.error("Erro ao carregar logs: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedLog || !resolutionNotes.trim()) {
      toast.error("Adicione notas sobre a resolução");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("audit_logs" as any)
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: resolutionNotes,
        })
        .eq("id", selectedLog.id);

      if (error) throw error;

      toast.success("Alerta resolvido com sucesso!");
      setSelectedLog(null);
      setResolutionNotes("");
      loadLogs();
    } catch (error: any) {
      toast.error("Erro ao resolver alerta: " + error.message);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
      critical: "destructive",
      error: "destructive",
      warning: "default",
      info: "secondary",
    };
    
    return (
      <Badge variant={variants[severity] || "default"}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const unresolvedCount = logs.filter(log => !log.resolved).length;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Auditoria de Boletos</h1>
            <p className="text-muted-foreground">
              Alertas e ações pendentes de revisão
            </p>
          </div>
          <div className="flex items-center gap-4">
            {unresolvedCount > 0 && (
              <Badge variant="destructive" className="text-lg px-4 py-2">
                {unresolvedCount} Pendentes
              </Badge>
            )}
            <Button
              variant={showResolved ? "default" : "outline"}
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? "Mostrar Apenas Pendentes" : "Mostrar Todos"}
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Carregando...</p>
            </CardContent>
          </Card>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">
                  {showResolved
                    ? "Nenhum log de auditoria encontrado"
                    : "Nenhum alerta pendente!"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {!showResolved && "Todos os alertas foram resolvidos"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <Card
                key={log.id}
                className={log.resolved ? "opacity-60" : "border-l-4 border-l-yellow-600"}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getSeverityIcon(log.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-lg">{log.title}</CardTitle>
                          {getSeverityBadge(log.severity)}
                          {log.resolved && (
                            <Badge variant="outline" className="gap-1">
                              <CheckCheck className="h-3 w-3" />
                              Resolvido
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {log.description}
                  </p>

                  {log.metadata && (
                    <div className="bg-muted/50 p-3 rounded-md space-y-1 text-sm">
                      {log.metadata.cliente && (
                        <p>
                          <strong>Cliente:</strong> {log.metadata.cliente}
                        </p>
                      )}
                      {log.metadata.boleto_numero && (
                        <p>
                          <strong>Nº Boleto:</strong> {log.metadata.boleto_numero}
                        </p>
                      )}
                      {log.metadata.nosso_numero && (
                        <p>
                          <strong>Nosso Nº:</strong> {log.metadata.nosso_numero}
                        </p>
                      )}
                      {log.metadata.valor && (
                        <p>
                          <strong>Valor:</strong> R${" "}
                          {log.metadata.valor.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      )}
                      {log.metadata.vencimento && (
                        <p>
                          <strong>Vencimento:</strong> {log.metadata.vencimento}
                        </p>
                      )}
                      {log.metadata.competencia && (
                        <p>
                          <strong>Competência:</strong> {log.metadata.competencia}
                        </p>
                      )}
                    </div>
                  )}

                  {log.resolved && log.resolution_notes && (
                    <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                        Resolução:
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {log.resolution_notes}
                      </p>
                      {log.resolved_at && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                          Resolvido em{" "}
                          {format(new Date(log.resolved_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                      )}
                    </div>
                  )}

                  {!log.resolved && (
                    <div className="mt-4">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedLog(log);
                          setResolutionNotes("");
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Resolvido
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedLog?.title}</DialogTitle>
            <DialogDescription>
              {selectedLog?.description}
            </DialogDescription>
          </DialogHeader>

          {!selectedLog?.resolved && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Notas de Resolução *
                </label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Descreva as ações tomadas para resolver este alerta..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Exemplo: "Verificado extrato bancário - cliente pagou via PIX em
                  DD/MM/AAAA. Valor confirmado."
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedLog(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleResolve} disabled={!resolutionNotes.trim()}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Resolução
                </Button>
              </DialogFooter>
            </div>
          )}

          {selectedLog?.resolved && selectedLog.resolution_notes && (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-md">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Resolução:
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {selectedLog.resolution_notes}
              </p>
              {selectedLog.resolved_at && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-3">
                  Resolvido em{" "}
                  {format(new Date(selectedLog.resolved_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default AuditLogs;
