import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings as SettingsIcon, User, Bell, Shield, Building2, Mail, Save, Loader2, Search,
  Users, UserPlus, Home, Car, AlertTriangle, Brain, Plus, Edit, Trash2, Heart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AITeamBadge } from "@/components/AITeamBadge";

// Interface para dados da empresa via Brasil API
interface CompanyData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  ddd_telefone_1: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);

  // Estados para os campos da empresa
  const [companyForm, setCompanyForm] = useState({
    cnpj: "",
    razaoSocial: "Ampla Contabilidade Ltda",
    nomeFantasia: "Ampla Business",
    crc: "",
    website: "www.amplabusiness.com.br",
    email: "",
    phone: "",
    address: "",
    number: "",
    city: "",
    state: "",
    zip: "",
  });

  // Formatar CNPJ enquanto digita
  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
  };

  // Buscar dados do CNPJ na Brasil API
  const fetchCnpjData = async (cnpj: string) => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) return;

    setIsLoadingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);

      if (!response.ok) {
        throw new Error("CNPJ não encontrado");
      }

      const data: CompanyData = await response.json();

      // Formatar telefone
      let phone = "";
      if (data.ddd_telefone_1) {
        const phoneClean = data.ddd_telefone_1.replace(/\D/g, "");
        if (phoneClean.length >= 10) {
          phone = `(${phoneClean.slice(0, 2)}) ${phoneClean.slice(2, 6)}-${phoneClean.slice(6, 10)}`;
        }
      }

      // Atualizar formulário com dados da API
      setCompanyForm(prev => ({
        ...prev,
        razaoSocial: data.razao_social || prev.razaoSocial,
        nomeFantasia: data.nome_fantasia || data.razao_social || prev.nomeFantasia,
        email: data.email || prev.email,
        phone: phone || prev.phone,
        address: data.logradouro || prev.address,
        number: data.numero || prev.number,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
        zip: data.cep ? data.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : prev.zip,
      }));

      toast({
        title: "Dados carregados",
        description: `Dados de ${data.razao_social} preenchidos automaticamente.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao buscar CNPJ",
        description: "Não foi possível encontrar dados para este CNPJ. Verifique e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  // Handler para mudança do CNPJ
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCnpj(e.target.value);
    setCompanyForm(prev => ({ ...prev, cnpj: formatted }));

    // Buscar automaticamente quando CNPJ estiver completo
    const cleanCnpj = formatted.replace(/\D/g, "");
    if (cleanCnpj.length === 14) {
      fetchCnpjData(formatted);
    }
  };

  // Handler genérico para outros campos
  const handleFieldChange = (field: keyof typeof companyForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompanyForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save functionality
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso.",
      });
    }, 1000);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4 max-w-6xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <SettingsIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
                  <p className="text-muted-foreground">
                    Configure as preferências e integrações do sistema
                  </p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="company" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="company">
                  <Building2 className="w-4 h-4 mr-2" />
                  Empresa
                </TabsTrigger>
                <TabsTrigger value="users">
                  <User className="w-4 h-4 mr-2" />
                  Usuários
                </TabsTrigger>
                <TabsTrigger value="notifications">
                  <Bell className="w-4 h-4 mr-2" />
                  Notificações
                </TabsTrigger>
                <TabsTrigger value="integrations">
                  <Mail className="w-4 h-4 mr-2" />
                  Integrações
                </TabsTrigger>
                <TabsTrigger value="security">
                  <Shield className="w-4 h-4 mr-2" />
                  Segurança
                </TabsTrigger>
              </TabsList>

              {/* Company Settings */}
              <TabsContent value="company" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados da Empresa</CardTitle>
                    <CardDescription>
                      Informações do escritório de contabilidade
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* CNPJ com busca automática */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cnpj">CNPJ do Escritório</Label>
                        <div className="relative">
                          <Input
                            id="cnpj"
                            placeholder="00.000.000/0000-00"
                            value={companyForm.cnpj}
                            onChange={handleCnpjChange}
                            className={isLoadingCnpj ? "pr-10" : ""}
                          />
                          {isLoadingCnpj && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Digite o CNPJ para preencher automaticamente os dados
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="crc">CRC (Registro no CFC)</Label>
                        <Input
                          id="crc"
                          placeholder="CRC/XX 000000"
                          value={companyForm.crc}
                          onChange={handleFieldChange("crc")}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Razão Social</Label>
                        <Input
                          id="companyName"
                          placeholder="Razão Social da Empresa"
                          value={companyForm.razaoSocial}
                          onChange={handleFieldChange("razaoSocial")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tradeName">Nome Fantasia</Label>
                        <Input
                          id="tradeName"
                          placeholder="Nome Fantasia"
                          value={companyForm.nomeFantasia}
                          onChange={handleFieldChange("nomeFantasia")}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        placeholder="www.seusite.com.br"
                        value={companyForm.website}
                        onChange={handleFieldChange("website")}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="contato@empresa.com.br"
                          value={companyForm.email}
                          onChange={handleFieldChange("email")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          placeholder="(00) 0000-0000"
                          value={companyForm.phone}
                          onChange={handleFieldChange("phone")}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Endereço</CardTitle>
                    <CardDescription>
                      Preenchido automaticamente ao digitar o CNPJ
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="address">Logradouro</Label>
                        <Input
                          id="address"
                          placeholder="Rua, Avenida..."
                          value={companyForm.address}
                          onChange={handleFieldChange("address")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="number">Número</Label>
                        <Input
                          id="number"
                          placeholder="000"
                          value={companyForm.number}
                          onChange={handleFieldChange("number")}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input
                          id="city"
                          placeholder="Cidade"
                          value={companyForm.city}
                          onChange={handleFieldChange("city")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">Estado</Label>
                        <Input
                          id="state"
                          placeholder="UF"
                          maxLength={2}
                          value={companyForm.state}
                          onChange={handleFieldChange("state")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="zip">CEP</Label>
                        <Input
                          id="zip"
                          placeholder="00000-000"
                          value={companyForm.zip}
                          onChange={handleFieldChange("zip")}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Users Settings */}
              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Gerenciamento de Usuários</CardTitle>
                    <CardDescription>
                      Configure usuários e permissões do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <User className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        Sistema de Usuários em Desenvolvimento
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Em breve você poderá gerenciar usuários, perfis e permissões
                      </p>
                      <Button variant="outline">Saiba Mais</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Settings */}
              <TabsContent value="notifications" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Preferências de Notificação</CardTitle>
                    <CardDescription>
                      Configure como você deseja receber notificações
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Notificações por E-mail</Label>
                          <p className="text-sm text-muted-foreground">
                            Receba atualizações importantes por e-mail
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Alertas de Inadimplência</Label>
                          <p className="text-sm text-muted-foreground">
                            Notificar quando clientes estiverem atrasados
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Vencimentos Próximos</Label>
                          <p className="text-sm text-muted-foreground">
                            Alertar sobre honorários a vencer em 7 dias
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Conciliações Automáticas</Label>
                          <p className="text-sm text-muted-foreground">
                            Notificar sobre reconciliações realizadas
                          </p>
                        </div>
                        <Switch />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Relatórios Automáticos</Label>
                          <p className="text-sm text-muted-foreground">
                            Receber relatórios mensais por e-mail
                          </p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Integrations Settings */}
              <TabsContent value="integrations" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Integrações de API</CardTitle>
                    <CardDescription>
                      Configure as integrações com serviços externos
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Brasil API</h4>
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Conectado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Enriquecimento de dados de clientes via CNPJ
                        </p>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">SendGrid</h4>
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            Não configurado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Envio de e-mails transacionais e cartas de cobrança
                        </p>
                        <Input placeholder="API Key do SendGrid" type="password" />
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">WhatsApp (Evolution API)</h4>
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            Não configurado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Envio de notificações e cartas de cobrança via WhatsApp
                        </p>
                        <div className="space-y-2">
                          <Input placeholder="URL da API" />
                          <Input placeholder="API Key" type="password" />
                        </div>
                      </div>

                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Banco Cora</h4>
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                            Não configurado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Integração bancária para conciliação automática
                        </p>
                        <Button variant="outline" size="sm">Conectar com OAuth</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Settings */}
              <TabsContent value="security" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Segurança e Privacidade</CardTitle>
                    <CardDescription>
                      Configure as opções de segurança do sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Autenticação de Dois Fatores (2FA)</Label>
                          <p className="text-sm text-muted-foreground">
                            Aumenta a segurança exigindo código adicional no login
                          </p>
                        </div>
                        <Switch />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Logs de Auditoria</Label>
                          <p className="text-sm text-muted-foreground">
                            Registrar todas as ações dos usuários no sistema
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Timeout de Sessão</Label>
                          <p className="text-sm text-muted-foreground">
                            Encerrar sessão automaticamente após inatividade
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label>Tempo de Inatividade (minutos)</Label>
                        <Input type="number" defaultValue="30" min="5" max="120" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Save Button */}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
