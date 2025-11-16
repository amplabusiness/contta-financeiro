import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2, Copy, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AIEmailComposerProps {
  clientId: string;
  invoiceId?: string;
  context?: "collection" | "reminder" | "general";
  trigger?: React.ReactNode;
}

export function AIEmailComposer({
  clientId,
  invoiceId,
  context = "collection",
  trigger,
}: AIEmailComposerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<any>(null);

  const composeEmail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-email-composer", {
        body: { clientId, invoiceId, type: context },
      });

      if (error) throw error;

      setEmail(data.email);
      toast.success("Email gerado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao gerar email:", error);
      toast.error(error.message || "Erro ao gerar email");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!email) return;

    const fullEmail = `Assunto: ${email.subject}\n\n${email.body}\n\n${email.signature || ""}`;
    navigator.clipboard.writeText(fullEmail);
    toast.success("Email copiado para a área de transferência!");
  };

  const defaultTrigger = (
    <Button size="sm" variant="outline">
      <Mail className="h-4 w-4 mr-2" />
      Gerar Email com IA
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Compositor de Email com IA
          </DialogTitle>
          <DialogDescription>
            A IA irá gerar um email personalizado baseado no histórico do cliente
          </DialogDescription>
        </DialogHeader>

        {!email ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Mail className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Clique no botão abaixo para gerar um email personalizado
            </p>
            <Button onClick={composeEmail} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando email...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Gerar Email
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Assunto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{email.subject}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Corpo do Email</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={email.body}
                  onChange={(e) => setEmail({ ...email, body: e.target.value })}
                  className="min-h-[200px] font-mono text-sm"
                />
              </CardContent>
            </Card>

            {email.signature && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Assinatura</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line">{email.signature}</p>
                </CardContent>
              </Card>
            )}

            {email.tone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Tom:</span>
                <span className="font-medium">{email.tone}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {email && (
            <>
              <Button variant="outline" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button onClick={composeEmail} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Regenerando...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Regenerar
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
