import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Mail,
  MessageSquare,
  FileText,
  Eye,
  Send,
  Plus,
  Edit,
  Trash2,
  Copy,
  CheckCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Template {
  id: string;
  name: string;
  type: string;
  channel: string;
  subject: string;
  body: string;
  variables: string[];
  is_active: boolean;
}

interface Client {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone: string;
}

const CollectionLetters = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "collection_letter_1",
    channel: "email",
    subject: "",
    body: "",
  });

  // Sample client for preview
  const [previewClient, setPreviewClient] = useState<Client | null>(null);
  const [previewData, setPreviewData] = useState({
    client_name: "Empresa Exemplo Ltda",
    amount: "R$ 2.500,00",
    due_date: "15/01/2025",
    competence: "12/2024",
    days_overdue: "15",
    total_overdue: "R$ 7.500,00",
    overdue_count: "3",
  });

  // Default templates
  const defaultTemplates = [
    {
      name: "1ª Carta de Cobrança - Amigável",
      type: "collection_letter_1",
      channel: "email",
      subject: "Lembrete: Honorários em Atraso - {client_name}",
      body: `Prezado(a) {client_name},

Esperamos que esteja bem!

Gostaríamos de lembrá-lo(a) que temos {overdue_count} fatura(s) de honorários contábeis em aberto, totalizando {total_overdue}.

A fatura mais antiga venceu em {due_date} (há {days_overdue} dias).

Detalhes:
• Competência: {competence}
• Valor: {amount}
• Vencimento: {due_date}

Solicitamos gentilmente que regularize esta pendência para que possamos continuar prestando nossos serviços com excelência.

Para pagamento, utilize os dados da fatura enviada anteriormente.

Caso já tenha efetuado o pagamento, por favor desconsidere este aviso e nos envie o comprovante.

Estamos à disposição para esclarecer qualquer dúvida.

Atenciosamente,
Ampla Contabilidade Ltda
www.amplabusiness.com.br`,
      variables: [
        "client_name",
        "amount",
        "due_date",
        "competence",
        "days_overdue",
        "total_overdue",
        "overdue_count",
      ],
    },
    {
      name: "2ª Carta de Cobrança - Firme",
      type: "collection_letter_2",
      channel: "email",
      subject: "URGENTE: Regularize seus Honorários - {client_name}",
      body: `Prezado(a) {client_name},

Este é um segundo aviso sobre suas pendências financeiras com nosso escritório.

Situação atual:
• Total em atraso: {total_overdue}
• Quantidade de faturas: {overdue_count}
• Dias de atraso: {days_overdue}

Precisamos da sua urgente atenção para regularizar esta situação.

⚠️ IMPORTANTE: Caso o pagamento não seja efetuado em até 5 dias úteis, seremos obrigados a reduzir temporariamente a prestação de nossos serviços até a normalização da situação financeira.

Valor desta fatura:
• Competência: {competence}
• Valor: {amount}
• Vencimento: {due_date}

Por favor, entre em contato conosco imediatamente caso haja algum problema.

Contamos com sua compreensão e colaboração.

Atenciosamente,
Departamento Financeiro
Ampla Contabilidade Ltda
Telefone: (00) 0000-0000
Email: financeiro@amplabusiness.com.br`,
      variables: [
        "client_name",
        "amount",
        "due_date",
        "competence",
        "days_overdue",
        "total_overdue",
        "overdue_count",
      ],
    },
    {
      name: "3ª Carta de Cobrança - Última Notificação",
      type: "collection_letter_3",
      channel: "email",
      subject: "ÚLTIMA NOTIFICAÇÃO: Suspensão de Serviços - {client_name}",
      body: `Prezado(a) {client_name},

Esta é nossa última tentativa de contato amigável.

Há {days_overdue} dias suas faturas estão em aberto, totalizando {total_overdue}.

📌 DECISÃO NECESSÁRIA:

Devido à falta de retorno e regularização financeira, informamos que:

1️⃣ Os serviços contábeis serão REDUZIDOS a partir de 48 horas, limitando-se apenas a:
   - Obrigações fiscais mínimas
   - Folha de pagamento básica

2️⃣ Serviços que serão SUSPENSOS:
   - Consultoria contábil
   - Planejamento tributário
   - Atendimento prioritário
   - Relatórios gerenciais

3️⃣ Em caso de não regularização em 15 dias, os serviços serão COMPLETAMENTE SUSPENSOS.

Pendência:
• Competência: {competence}
• Valor: {amount}
• Vencimento: {due_date}
• Total em atraso: {total_overdue}

🔴 IMPORTANTE: Esta medida é necessária para a continuidade saudável de nossos negócios e será revertida imediatamente após a quitação dos débitos.

Permanecemos à disposição para negociação.

Atenciosamente,
Diretoria Financeira
Ampla Contabilidade Ltda
www.amplabusiness.com.br`,
      variables: [
        "client_name",
        "amount",
        "due_date",
        "competence",
        "days_overdue",
        "total_overdue",
        "overdue_count",
      ],
    },
    {
      name: "WhatsApp - Lembrete Amigável",
      type: "collection_whatsapp_1",
      channel: "whatsapp",
      subject: "",
      body: `Olá, {client_name}! 👋

Tudo bem?

Estamos enviando este lembrete sobre a fatura de honorários:

💰 Valor: {amount}
📅 Vencimento: {due_date}
⏰ Dias de atraso: {days_overdue}

Se já pagou, desconsidere. Caso contrário, pedimos que regularize para mantermos nossos serviços em dia! 😊

Qualquer dúvida, estamos aqui!

Ampla Contabilidade 📊`,
      variables: [
        "client_name",
        "amount",
        "due_date",
        "competence",
        "days_overdue",
        "total_overdue",
        "overdue_count",
      ],
    },
  ];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .in("type", [
          "collection_letter_1",
          "collection_letter_2",
          "collection_letter_3",
          "collection_whatsapp_1",
        ])
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTemplates(data || []);

      // If no templates exist, create default ones
      if (!data || data.length === 0) {
        await createDefaultTemplates();
      }
    } catch (error: any) {
      console.error("Error fetching templates:", error);
      toast({
        title: "Erro ao carregar templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultTemplates = async () => {
    try {
      for (const template of defaultTemplates) {
        await supabase.from("message_templates").insert({
          ...template,
          is_active: true,
        });
      }
      await fetchTemplates();
      toast({
        title: "Templates criados",
        description: "Templates padrão de cobrança foram criados com sucesso.",
      });
    } catch (error: any) {
      console.error("Error creating default templates:", error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!formData.name || !formData.body) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e o corpo do template.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const templateData = {
        name: formData.name,
        type: formData.type,
        channel: formData.channel,
        subject: formData.subject,
        body: formData.body,
        variables: extractVariables(formData.body),
        is_active: true,
      };

      if (selectedTemplate) {
        // Update existing template
        const { error } = await supabase
          .from("message_templates")
          .update(templateData)
          .eq("id", selectedTemplate.id);

        if (error) throw error;

        toast({
          title: "Template atualizado",
          description: "O template foi atualizado com sucesso.",
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from("message_templates")
          .insert(templateData);

        if (error) throw error;

        toast({
          title: "Template criado",
          description: "O novo template foi criado com sucesso.",
        });
      }

      setShowNewTemplate(false);
      setSelectedTemplate(null);
      setFormData({
        name: "",
        type: "collection_letter_1",
        channel: "email",
        subject: "",
        body: "",
      });
      await fetchTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      toast({
        title: "Erro ao salvar template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const extractVariables = (text: string): string[] => {
    const regex = /\{([^}]+)\}/g;
    const matches = text.match(regex);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.slice(1, -1)))];
  };

  const replaceVariables = (template: string, data: any): string => {
    let result = template;
    Object.keys(data).forEach((key) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), data[key]);
    });
    return result;
  };

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      channel: template.channel,
      subject: template.subject || "",
      body: template.body,
    });
    setShowNewTemplate(true);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;

    try {
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      toast({
        title: "Template excluído",
        description: "O template foi excluído com sucesso.",
      });

      await fetchTemplates();
    } catch (error: any) {
      console.error("Error deleting template:", error);
      toast({
        title: "Erro ao excluir template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSendLetter = async (template: Template) => {
    // TODO: Implement actual sending via Edge Function
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      toast({
        title: "Carta enviada",
        description: `Carta "${template.name}" enviada com sucesso via ${template.channel}.`,
      });
    }, 2000);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="w-4 h-4" />;
      case "whatsapp":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case "email":
        return <Badge className="bg-blue-100 text-blue-800">E-mail</Badge>;
      case "whatsapp":
        return <Badge className="bg-green-100 text-green-800">WhatsApp</Badge>;
      default:
        return <Badge>Outro</Badge>;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Cartas de Cobrança</h1>
                    <p className="text-muted-foreground">
                      Gerencie templates e envie cartas de cobrança automáticas
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowNewTemplate(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Template
                </Button>
              </div>
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getChannelIcon(template.channel)}
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                      {getChannelBadge(template.channel)}
                    </div>
                    {template.subject && (
                      <CardDescription className="line-clamp-1">
                        {template.subject}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {template.body}
                    </p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {template.variables.slice(0, 3).map((variable) => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          {`{${variable}}`}
                        </Badge>
                      ))}
                      {template.variables.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.variables.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handlePreview(template)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Empty State */}
            {templates.length === 0 && !isLoading && (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhum template encontrado
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Crie templates de cartas de cobrança para agilizar seu processo
                  </p>
                  <Button onClick={createDefaultTemplates}>
                    Criar Templates Padrão
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* New/Edit Template Dialog */}
            <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTemplate ? "Editar Template" : "Novo Template"}
                  </DialogTitle>
                  <DialogDescription>
                    Configure o template de carta de cobrança. Use variáveis entre chaves:
                    {" {client_name}, {amount}, {due_date}, etc."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Template</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="Ex: 1ª Carta de Cobrança"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="channel">Canal</Label>
                      <Select
                        value={formData.channel}
                        onValueChange={(value) =>
                          setFormData({ ...formData, channel: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.channel === "email" && (
                    <div className="space-y-2">
                      <Label htmlFor="subject">Assunto do E-mail</Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) =>
                          setFormData({ ...formData, subject: e.target.value })
                        }
                        placeholder="Ex: Lembrete: Honorários em Atraso - {client_name}"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="body">Corpo da Mensagem</Label>
                    <Textarea
                      id="body"
                      value={formData.body}
                      onChange={(e) =>
                        setFormData({ ...formData, body: e.target.value })
                      }
                      placeholder="Digite o texto da carta de cobrança..."
                      rows={15}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Variáveis disponíveis: {"{client_name}, {amount}, {due_date}, {competence}, {days_overdue}, {total_overdue}, {overdue_count}"}
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewTemplate(false);
                      setSelectedTemplate(null);
                      setFormData({
                        name: "",
                        type: "collection_letter_1",
                        channel: "email",
                        subject: "",
                        body: "",
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTemplate} disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar Template"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Preview: {selectedTemplate?.name}</DialogTitle>
                  <DialogDescription>
                    Visualização com dados de exemplo
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {selectedTemplate?.channel === "email" && selectedTemplate?.subject && (
                    <div>
                      <Label>Assunto:</Label>
                      <p className="font-semibold">
                        {replaceVariables(selectedTemplate.subject, previewData)}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>Mensagem:</Label>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg border whitespace-pre-wrap">
                      {selectedTemplate &&
                        replaceVariables(selectedTemplate.body, previewData)}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Fechar
                  </Button>
                  {selectedTemplate && (
                    <Button onClick={() => handleSendLetter(selectedTemplate)}>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar Teste
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default CollectionLetters;
