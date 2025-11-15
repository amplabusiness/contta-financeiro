import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, FileText, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const templates = {
  first: {
    name: "1ª Carta - Lembrete Amigável",
    subject: "Lembrete: Fatura em atraso",
    body: `Prezado(a) {cliente},

Esperamos que este e-mail o(a) encontre bem.

Gostaríamos de lembrá-lo(a) que a fatura referente ao mês de {competencia}, no valor de {valor}, encontra-se em aberto desde {vencimento}.

Solicitamos a gentileza de regularizar este pagamento o mais breve possível.

Caso já tenha efetuado o pagamento, por favor, desconsidere este e-mail.

Atenciosamente,
{escritorio}`,
  },
  second: {
    name: "2ª Carta - Cobrança Formal",
    subject: "IMPORTANTE: Fatura vencida há {dias_atraso} dias",
    body: `Prezado(a) {cliente},

Identificamos que a fatura nº {numero_fatura}, com vencimento em {vencimento}, no valor de {valor}, ainda não foi quitada.

Alertamos que o não pagamento em até 5 (cinco) dias úteis poderá acarretar:
- Suspensão temporária dos serviços
- Negativação cadastral
- Cobrança judicial

Para regularizar, utilize o boleto em anexo ou entre em contato conosco.

Atenciosamente,
{escritorio}
Departamento Financeiro`,
  },
  third: {
    name: "3ª Carta - Notificação Final",
    subject: "URGENTE: Última oportunidade - Fatura vencida",
    body: `Prezado(a) {cliente},

Esta é nossa última tentativa de contato amigável.

A fatura nº {numero_fatura}, vencida em {vencimento}, no valor de {valor} ({valor_extenso}), permanece em aberto há {dias_atraso} dias.

ESTA É A ÚLTIMA OPORTUNIDADE para regularização antes das seguintes medidas:

1. Suspensão imediata dos serviços contábeis
2. Inclusão em cadastros de inadimplentes (SPC/SERASA)
3. Cobrança judicial com acréscimo de custas processuais

PRAZO FINAL: 48 horas a partir do recebimento deste e-mail.

Para evitar transtornos, entre em contato URGENTEMENTE.

Departamento Jurídico
{escritorio}`,
  },
};

const CollectionLetters = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof templates>("first");
  const [customBody, setCustomBody] = useState(templates.first.body);

  useEffect(() => {
    setCustomBody(templates[selectedTemplate].body);
  }, [selectedTemplate]);

  const handlePreview = () => {
    const preview = customBody
      .replace("{cliente}", "NOME DO CLIENTE")
      .replace("{competencia}", "Janeiro/2025")
      .replace("{valor}", "R$ 1.500,00")
      .replace("{vencimento}", "10/01/2025")
      .replace("{dias_atraso}", "30")
      .replace("{escritorio}", "Seu Escritório Contábil")
      .replace("{numero_fatura}", "2025/0001")
      .replace("{valor_extenso}", "mil e quinhentos reais");

    alert(preview);
  };

  const handleExport = () => {
    toast.success("Template exportado com sucesso!");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">📧 Cartas de Cobrança</h1>
          <p className="text-muted-foreground">
            Templates profissionais para gestão de inadimplência
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Selecione o Template</CardTitle>
              <CardDescription>
                Escolha o tipo de carta de acordo com o estágio de cobrança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Tipo de Carta</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={(value) => setSelectedTemplate(value as keyof typeof templates)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(templates).map(([key, template]) => (
                      <SelectItem key={key} value={key}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assunto do E-mail</Label>
                <div className="p-3 bg-muted rounded-md">
                  {templates[selectedTemplate].subject}
                </div>
              </div>

              <div>
                <Label>Corpo da Mensagem</Label>
                <Textarea
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handlePreview} variant="outline" className="flex-1">
                  <FileText className="h-4 w-4 mr-2" />
                  Visualizar
                </Button>
                <Button onClick={handleExport} className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Variáveis Disponíveis</CardTitle>
              <CardDescription>
                Use estas variáveis no template para personalização automática
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">{"{cliente}"}</code>
                  <p className="text-xs text-muted-foreground mt-1">Nome do cliente</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">{"{valor}"}</code>
                  <p className="text-xs text-muted-foreground mt-1">Valor da fatura</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">{"{vencimento}"}</code>
                  <p className="text-xs text-muted-foreground mt-1">Data de vencimento</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">{"{competencia}"}</code>
                  <p className="text-xs text-muted-foreground mt-1">Mês de competência</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">{"{dias_atraso}"}</code>
                  <p className="text-xs text-muted-foreground mt-1">Dias em atraso</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">{"{escritorio}"}</code>
                  <p className="text-xs text-muted-foreground mt-1">Nome do escritório</p>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm">{"{numero_fatura}"}</code>
                  <p className="text-xs text-muted-foreground mt-1">Número da fatura</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fluxo de Cobrança Recomendado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Lembrete Amigável (15 dias após vencimento)</h4>
                  <p className="text-sm text-muted-foreground">
                    Contato cordial lembrando do vencimento
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold">Cobrança Formal (30 dias após vencimento)</h4>
                  <p className="text-sm text-muted-foreground">
                    Carta formal alertando sobre consequências
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold">Notificação Final (60 dias após vencimento)</h4>
                  <p className="text-sm text-muted-foreground">
                    Última oportunidade antes de medidas legais
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CollectionLetters;
