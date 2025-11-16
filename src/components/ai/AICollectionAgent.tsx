import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Loader2, Phone, Mail, MessageSquare, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AICollectionAgentProps {
  clientId: string;
  invoiceId: string;
  trigger?: React.ReactNode;
}

export function AICollectionAgent({ clientId, invoiceId, trigger }: AICollectionAgentProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<any>(null);

  const analyzeCollection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-collection-agent", {
        body: { clientId, invoiceId },
      });

      if (error) throw error;

      setStrategy(data.strategy);
      toast.success("Estratégia de cobrança gerada!");
    } catch (error: any) {
      console.error("Erro ao gerar estratégia:", error);
      toast.error(error.message || "Erro ao analisar cobrança");
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "phone":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const defaultTrigger = (
    <Button size="sm" variant="outline">
      <Bot className="h-4 w-4 mr-2" />
      Estratégia de Cobrança IA
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={() => !strategy && analyzeCollection()}>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Estratégia de Cobrança Inteligente
          </DialogTitle>
          <DialogDescription>
            Análise baseada em IA do histórico de pagamentos e comportamento do cliente
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando histórico do cliente...</p>
          </div>
        ) : strategy ? (
          <div className="space-y-4">
            {/* Priority and Recommended Channel */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Prioridade</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={getPriorityColor(strategy.priority)}>
                    {strategy.priority?.toUpperCase()}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Canal Recomendado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {getChannelIcon(strategy.recommended_channel)}
                    <span className="text-sm font-medium capitalize">
                      {strategy.recommended_channel}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Best Contact Time */}
            {strategy.best_contact_time && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Melhor Horário de Contato
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{strategy.best_contact_time}</p>
                </CardContent>
              </Card>
            )}

            {/* Approach */}
            {strategy.approach && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Abordagem Sugerida</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{strategy.approach}</p>
                </CardContent>
              </Card>
            )}

            {/* Payment Probability */}
            {strategy.payment_probability !== undefined && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Probabilidade de Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${strategy.payment_probability * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold">
                      {(strategy.payment_probability * 100).toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Negotiation Strategy */}
            {strategy.negotiation_strategy && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Estratégia de Negociação</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{strategy.negotiation_strategy}</p>
                </CardContent>
              </Card>
            )}

            {/* Recommended Actions */}
            {strategy.recommended_actions && strategy.recommended_actions.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Ações Recomendadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {strategy.recommended_actions.map((action: string, idx: number) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-primary">•</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full"
              onClick={analyzeCollection}
              disabled={loading}
              variant="outline"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reanalisando...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  Reanalisar Estratégia
                </>
              )}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
