import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Landmark, Wifi, WifiOff, RefreshCw, Download, CheckCircle2,
  AlertTriangle, Zap, Copy, ExternalLink, DollarSign, ArrowDownToLine,
  ArrowUpFromLine, Webhook, Settings, Info, CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const SUPABASE_PROJECT_ID = "xdtlhzysrpoinqtsglmr";
const WEBHOOK_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/cora-webhook`;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function CoraIntegration() {
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<{ available: number; blocked: number } | null>(null);

  const [importing, setImporting] = useState(false);
  const [importStart, setImportStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [importEnd, setImportEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);

  const [registering, setRegistering] = useState(false);
  const [bankAccountId, setBankAccountId] = useState<string | null>(null);

  // ─── Test Connection ──────────────────────────────────────────────────────
  async function testConnection() {
    setTesting(true);
    setConnected(null);
    setBalance(null);
    try {
      const { data, error } = await supabase.functions.invoke("cora-banking-service", {
        body: { action: "get_balance" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na API Cora");

      const bal = data.data;
      setBalance({
        available: (bal.available ?? bal.balance ?? 0) / 100,
        blocked: (bal.blocked ?? 0) / 100,
      });
      setConnected(true);
      toast.success("Cora conectado! Saldo obtido com sucesso.");
    } catch (e: unknown) {
      setConnected(false);
      toast.error(`Falha na conexão: ${e instanceof Error ? e.message : "Erro desconhecido"}`);
    } finally {
      setTesting(false);
    }
  }

  // ─── Import Statement ────────────────────────────────────────────────────
  async function importStatement() {
    setImporting(true);
    setImportResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("cora-banking-service", {
        body: { action: "get_statement", data: { start_date: importStart, end_date: importEnd } },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao importar extrato");
      setImportResult(data.data);
      toast.success(`${data.data.imported} transações importadas do Cora.`);
    } catch (e: unknown) {
      toast.error(`Erro ao importar: ${e instanceof Error ? e.message : "Erro"}`);
    } finally {
      setImporting(false);
    }
  }

  // ─── Register Cora Bank Account ───────────────────────────────────────────
  async function registerCoraAccount() {
    setRegistering(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Check if already exists
      const { data: existing } = await supabase
        .from("bank_accounts")
        .select("id, name")
        .ilike("bank_name", "%cora%")
        .limit(1);

      if (existing && existing.length > 0) {
        setBankAccountId(existing[0].id);
        toast.info(`Conta Cora já cadastrada: ${existing[0].name}`);
        return;
      }

      const { data, error } = await supabase.from("bank_accounts").insert({
        name: "Cora — Conta Corrente PJ",
        bank_name: "Cora (Banco 403)",
        bank_code: "403",
        agency: "0001",
        account_number: "", // Preencher com número da conta após confirmar no app Cora
        account_type: "checking",
        current_balance: balance?.available ?? 0,
        initial_balance: balance?.available ?? 0,
        initial_balance_date: format(new Date(), "yyyy-MM-dd"),
        is_active: true,
        notes: "Conta digital Cora — integração automática via API Cora Banking",
        created_by: user?.id,
      }).select("id").single();

      if (error) throw error;
      setBankAccountId(data.id);
      toast.success("Conta Cora cadastrada com sucesso!");
    } catch (e: unknown) {
      toast.error(`Erro: ${e instanceof Error ? e.message : "Erro"}`);
    } finally {
      setRegistering(false);
    }
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL copiada!");
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Landmark className="w-7 h-7 text-primary" />
              Integração Cora Bank
            </h1>
            <p className="text-muted-foreground text-sm">
              Banco digital PJ — extrato automático, PIX receber/pagar, boletos e webhook
            </p>
          </div>
          <div className="flex items-center gap-2">
            {connected === true && (
              <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
                <Wifi className="w-3 h-3" /> Conectado
              </Badge>
            )}
            {connected === false && (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="w-3 h-3" /> Sem conexão
              </Badge>
            )}
            <Button onClick={testConnection} disabled={testing}>
              {testing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              {testing ? "Testando..." : "Testar Conexão"}
            </Button>
          </div>
        </div>

        {/* Saldo cards */}
        {balance && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" /> Saldo Disponível
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-800">{formatCurrency(balance.available)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <CreditCard className="w-4 h-4" /> Saldo Bloqueado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold">{formatCurrency(balance.blocked)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Atualizado em</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                <p className="text-xs text-muted-foreground">Banco Cora (código 403)</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="conta">
          <TabsList className="grid grid-cols-4 max-w-2xl">
            <TabsTrigger value="conta"><Landmark className="w-4 h-4 mr-1" /> Conta</TabsTrigger>
            <TabsTrigger value="extrato"><Download className="w-4 h-4 mr-1" /> Extrato</TabsTrigger>
            <TabsTrigger value="pagamentos"><ArrowUpFromLine className="w-4 h-4 mr-1" /> Pagamentos</TabsTrigger>
            <TabsTrigger value="webhook"><Webhook className="w-4 h-4 mr-1" /> Webhook</TabsTrigger>
          </TabsList>

          {/* ── CONTA ── */}
          <TabsContent value="conta" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cadastrar Conta Cora no Sistema</CardTitle>
                <CardDescription>
                  Registra a conta Cora em Contas Bancárias para que o extrato seja vinculado ao fluxo financeiro.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bankAccountId && (
                  <Alert>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <AlertDescription>
                      Conta Cora cadastrada com ID: <code className="text-xs">{bankAccountId}</code>
                    </AlertDescription>
                  </Alert>
                )}
                <Button onClick={registerCoraAccount} disabled={registering}>
                  {registering ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Landmark className="w-4 h-4 mr-2" />}
                  Cadastrar / Verificar Conta Cora
                </Button>
                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="w-4 h-4 text-blue-500" />
                  <AlertDescription className="text-blue-800 text-xs">
                    Após cadastrar, acesse <strong>Banco → Contas Bancárias</strong> para editar o número da conta
                    e vincular os extratos corretamente. O número da conta está no app do Cora em <em>Minha Conta → Dados da Conta</em>.
                  </AlertDescription>
                </Alert>

                <div className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-sm">Dados Cora (Banco 403)</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Banco:</span> Cora Sociedade de Crédito Direto</div>
                    <div><span className="text-muted-foreground">ISPB:</span> 37880206</div>
                    <div><span className="text-muted-foreground">Código:</span> 403</div>
                    <div><span className="text-muted-foreground">Tipo:</span> Conta Corrente PJ</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Variáveis de Ambiente
                </CardTitle>
                <CardDescription>Configure no painel do Supabase → Edge Functions → Secrets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {[
                    { key: "CORA_CLIENT_ID", desc: "Client ID (ex: int-xxx) — Conta > Integrações via APIs no app Cora" },
                    { key: "CORA_CERT_PEM_B64", desc: "certificate.pem em base64 (gerado em 'Gerar nova credencial' no app Cora)" },
                    { key: "CORA_PRIVATE_KEY_B64", desc: "private-key.key em base64 (gerado junto com o certificado)" },
                    { key: "CORA_TOKEN_URL", desc: "Stage: https://matls-clients.api.stage.cora.com.br/token | Prod: padrão" },
                    { key: "CORA_API_URL", desc: "Stage: https://api.stage.cora.com.br | Prod: https://api.cora.com.br (padrão)" },
                  ].map(v => (
                    <div key={v.key} className="flex items-start gap-2 p-2 border rounded bg-muted/30">
                      <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded shrink-0">{v.key}</code>
                      <span className="text-xs text-muted-foreground">{v.desc}</span>
                    </div>
                  ))}
                </div>
                <Alert className="mt-3 border-blue-200 bg-blue-50">
                  <Info className="w-4 h-4 text-blue-500" />
                  <AlertDescription className="text-blue-800 text-xs space-y-1">
                    <p><strong>Como gerar o certificado:</strong></p>
                    <p>1. No app Cora: <em>Conta → Integrações via APIs → Gerar nova credencial</em></p>
                    <p>2. Baixe <code>certificate.pem</code> e <code>private-key.key</code></p>
                    <p>3. Converta para base64: <code>base64 -w 0 certificate.pem</code></p>
                    <p>4. Cole o resultado no Secret do Supabase</p>
                  </AlertDescription>
                </Alert>
                <Alert className="mt-2 border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-xs">
                    A autenticação Cora usa <strong>mTLS</strong> (certificado digital), não client_secret.
                    O certificado tem validade de 1 ano.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── EXTRATO ── */}
          <TabsContent value="extrato" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowDownToLine className="w-5 h-5 text-blue-500" />
                  Importar Extrato do Cora
                </CardTitle>
                <CardDescription>
                  Baixa as transações do Cora e insere em Transações Bancárias para conciliação no Super Conciliador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Data Inicial</Label>
                    <Input type="date" value={importStart} onChange={e => setImportStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Data Final</Label>
                    <Input type="date" value={importEnd} onChange={e => setImportEnd(e.target.value)} />
                  </div>
                </div>
                <Button onClick={importStatement} disabled={importing} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {importing
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Importando...</>
                    : <><Download className="w-4 h-4 mr-2" /> Importar Extrato</>
                  }
                </Button>
                {importResult && (
                  <Alert>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <AlertDescription>
                      <strong>{importResult.imported}</strong> transações importadas do Cora (
                      {format(new Date(importStart + "T00:00:00"), "dd/MM/yyyy")} a {format(new Date(importEnd + "T00:00:00"), "dd/MM/yyyy")}).
                      Acesse o <strong>Super Conciliador</strong> para reconciliar.
                    </AlertDescription>
                  </Alert>
                )}
                <Alert className="border-blue-100">
                  <Info className="w-4 h-4 text-blue-500" />
                  <AlertDescription className="text-xs text-blue-800">
                    As transações importadas ficam em <strong>bank_transactions</strong> com
                    <code className="mx-1 text-xs">imported_from = 'cora'</code> e podem ser conciliadas
                    com honorários e despesas no Super Conciliador.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Resumo do fluxo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Fluxo completo de extrato Cora</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-sm">
                  {[
                    "1. Importar extrato (botão acima) → salva em bank_transactions",
                    "2. Super Conciliador → associa cada crédito a um honorário",
                    "3. Dr. Cícero classifica os débitos automaticamente",
                    "4. Contabilidade atualiza DRE, Balancete e Balanço em tempo real",
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
                      <span className="text-muted-foreground">{s.slice(3)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PAGAMENTOS ── */}
          <TabsContent value="pagamentos" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    <ArrowDownToLine className="w-4 h-4 text-green-500" /> Receber — Boletos e PIX
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground text-xs">
                    Para cada honorário pendente, gere um boleto + QR Code PIX via Cora.
                    O cliente recebe o link de pagamento e ao pagar, o webhook atualiza automaticamente o status.
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3 h-3" /> Gera boleto com vencimento</div>
                    <div className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3 h-3" /> Gera QR Code PIX</div>
                    <div className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3 h-3" /> Link de pagamento para enviar ao cliente</div>
                    <div className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3 h-3" /> Webhook marca fatura como paga automaticamente</div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.href = "/invoices"}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Ir para Honorários
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1">
                    <ArrowUpFromLine className="w-4 h-4 text-orange-500" /> Pagar — MEI/Terceiros (dia 10)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground text-xs">
                    Os 8 prestadores MEI/PJ são pagos todo dia 10 via PIX.
                    Configure as chaves PIX na aba Agenda → Despesas Fixas e clique em "PIX" para enviar.
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1 text-orange-700"><Zap className="w-3 h-3" /> Daniel, Rose, Sueli, Alexssandra...</div>
                    <div className="flex items-center gap-1 text-orange-700"><Zap className="w-3 h-3" /> Total: ~R$29.665/mês</div>
                    <div className="flex items-center gap-1 text-orange-700"><Zap className="w-3 h-3" /> Pode agendar para o dia 10</div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.href = "/agenda"}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Ir para Agenda → Despesas Fixas
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Como funciona o pagamento PIX via Cora</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>1. Cora autentica via OAuth2 (Client Credentials)</p>
                  <p>2. POST /pix/payments com: valor (centavos), chave PIX, tipo da chave, descrição, data de agendamento</p>
                  <p>3. Cora retorna payment_id e status (scheduled/sent/confirmed)</p>
                  <p>4. O sistema registra em bank_transactions como débito</p>
                  <p>5. Webhook notifica quando o PIX é confirmado pelo banco destinatário</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── WEBHOOK ── */}
          <TabsContent value="webhook" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-purple-500" />
                  Configurar Webhook no Cora
                </CardTitle>
                <CardDescription>
                  O webhook notifica o sistema quando um cliente paga um boleto ou PIX, atualizando o honorário automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">URL do Webhook (copie e configure no app Cora)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={WEBHOOK_URL}
                      readOnly
                      className="font-mono text-xs bg-muted"
                    />
                    <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No app Cora: <strong>Configurações → Webhooks → Adicionar URL</strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Eventos suportados</h3>
                  <div className="space-y-1">
                    {[
                      { event: "charge.paid", desc: "Boleto liquidado — atualiza honorário para 'pago'" },
                      { event: "pix.received", desc: "PIX recebido — atualiza honorário para 'pago'" },
                    ].map(e => (
                      <div key={e.event} className="flex items-start gap-2 p-2 border rounded bg-muted/30">
                        <Badge variant="outline" className="text-xs font-mono shrink-0">{e.event}</Badge>
                        <span className="text-xs text-muted-foreground">{e.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Alert>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <AlertDescription className="text-xs">
                    Quando o webhook é acionado, o sistema automaticamente:
                    <ul className="mt-1 space-y-0.5 list-disc list-inside text-muted-foreground">
                      <li>Marca o honorário como pago</li>
                      <li>Cria lançamento contábil (D: Banco | C: Clientes a Receber)</li>
                      <li>Envia notificação ao cliente (e-mail / WhatsApp)</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800 text-xs">
                    <strong>Importante:</strong> Para o webhook funcionar em produção, é necessário criar a edge function
                    <code className="mx-1">cora-webhook</code> como endpoint público (sem verificação de JWT).
                    A validação de segurança é feita pelo header <code>x-cora-signature</code> (HMAC-SHA256).
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
