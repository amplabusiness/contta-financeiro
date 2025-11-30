import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Lightbulb,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  Brain,
  Sparkles,
  TrendingUp,
  Users,
  FileText,
  Calendar,
  MessageSquare,
  ChevronRight,
  Zap,
  Target,
  Building2,
  BarChart3,
  Bell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureRequest {
  id: string;
  requested_by: string;
  department: string;
  title: string;
  description: string;
  problem_description: string | null;
  expected_benefit: string | null;
  example_use_case: string | null;
  status: string;
  priority: number;
  complexity: string | null;
  estimated_hours: number | null;
  assigned_agent: string | null;
  created_at: string;
  updated_at: string;
}

interface FeatureTemplate {
  id: string;
  template_code: string;
  name: string;
  description: string;
  category: string;
  estimated_hours: number;
  default_agent: string | null;
}

const FeatureRequests = () => {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [templates, setTemplates] = useState<FeatureTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    requested_by: "",
    department: "",
    title: "",
    description: "",
    problem_description: "",
    expected_benefit: "",
    example_use_case: "",
  });

  const departments = [
    { value: "financeiro", label: "Financeiro", icon: TrendingUp },
    { value: "contabil", label: "Contabil", icon: FileText },
    { value: "dp", label: "Departamento Pessoal", icon: Users },
    { value: "fiscal", label: "Fiscal", icon: Building2 },
    { value: "administrativo", label: "Administrativo", icon: Settings },
    { value: "diretoria", label: "Diretoria", icon: Target },
  ];

  const employees = [
    "Rose",
    "Josimar",
    "Lilian",
    "Sr. Daniel",
    "Sergio",
    "Carla",
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("feature_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);

      // Load templates
      const { data: templatesData, error: templatesError } = await supabase
        .from("feature_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (templatesError) throw templatesError;
      setTemplates(templatesData || []);

    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.requested_by || !form.department || !form.title || !form.description) {
      toast.error("Preencha todos os campos obrigatorios");
      return;
    }

    setSubmitting(true);
    try {
      // Call the request_improvement function
      const { data, error } = await supabase.rpc("request_improvement", {
        p_requested_by: form.requested_by,
        p_department: form.department,
        p_title: form.title,
        p_description: form.description,
        p_problem: form.problem_description || null,
        p_benefit: form.expected_benefit || null,
        p_example: form.example_use_case || null,
      });

      if (error) throw error;

      toast.success("Solicitacao registrada!", {
        description: "A IA vai analisar sua solicitacao em breve.",
      });

      // Reset form and reload data
      setForm({
        requested_by: "",
        department: "",
        title: "",
        description: "",
        problem_description: "",
        expected_benefit: "",
        example_use_case: "",
      });
      setSelectedTemplate(null);
      setDialogOpen(false);
      loadData();

    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast.error("Erro ao registrar solicitacao", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const applyTemplate = (templateCode: string) => {
    const template = templates.find(t => t.template_code === templateCode);
    if (template) {
      setSelectedTemplate(templateCode);
      setForm(prev => ({
        ...prev,
        title: template.name,
        description: template.description,
      }));
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { label: "Pendente", variant: "secondary", icon: Clock },
      analyzing: { label: "Em Analise", variant: "default", icon: Brain },
      approved: { label: "Aprovado", variant: "default", icon: CheckCircle2 },
      rejected: { label: "Rejeitado", variant: "destructive", icon: XCircle },
      in_development: { label: "Em Desenvolvimento", variant: "default", icon: Zap },
      completed: { label: "Concluido", variant: "default", icon: CheckCircle2 },
    };

    const config = configs[status] || configs.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getComplexityBadge = (complexity: string | null) => {
    if (!complexity) return null;

    const colors: Record<string, string> = {
      low: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-red-100 text-red-800",
    };

    return (
      <span className={cn("px-2 py-0.5 rounded text-xs font-medium", colors[complexity] || colors.medium)}>
        {complexity === "low" ? "Baixa" : complexity === "medium" ? "Media" : complexity === "high" ? "Alta" : "Critica"}
      </span>
    );
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === "pending").length,
    approved: requests.filter(r => r.status === "approved" || r.status === "in_development").length,
    completed: requests.filter(r => r.status === "completed").length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="relative">
                <Lightbulb className="h-8 w-8 text-amber-500" />
                <Sparkles className="h-4 w-4 text-violet-500 absolute -top-1 -right-1" />
              </div>
              Sistema de Evolucao Continua
            </h1>
            <p className="text-muted-foreground mt-1">
              Solicite melhorias e acompanhe a evolucao do sistema
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Solicitacao
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  Solicitar Melhoria
                </DialogTitle>
                <DialogDescription>
                  Descreva a melhoria que voce gostaria de ver no sistema. A IA vai analisar e sugerir a melhor forma de implementar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Templates */}
                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label>Usar Template (opcional)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {templates.slice(0, 4).map(template => (
                        <Button
                          key={template.id}
                          variant={selectedTemplate === template.template_code ? "default" : "outline"}
                          size="sm"
                          className="justify-start text-left h-auto py-2"
                          onClick={() => applyTemplate(template.template_code)}
                        >
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-xs text-muted-foreground">
                              ~{template.estimated_hours}h
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="requested_by">Quem esta solicitando? *</Label>
                    <Select
                      value={form.requested_by}
                      onValueChange={(value) => setForm(prev => ({ ...prev, requested_by: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Departamento *</Label>
                    <Select
                      value={form.department}
                      onValueChange={(value) => setForm(prev => ({ ...prev, department: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept.value} value={dept.value}>
                            <div className="flex items-center gap-2">
                              <dept.icon className="h-4 w-4" />
                              {dept.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Titulo da Solicitacao *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Vincular empresas como grupo economico"
                    value={form.title}
                    onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descricao *</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o que voce precisa..."
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="problem">Qual problema isso resolve? (opcional)</Label>
                  <Textarea
                    id="problem"
                    placeholder="Ex: Hoje tenho que gerar relatorios separados e somar manualmente..."
                    rows={2}
                    value={form.problem_description}
                    onChange={(e) => setForm(prev => ({ ...prev, problem_description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="benefit">Qual o beneficio esperado? (opcional)</Label>
                  <Textarea
                    id="benefit"
                    placeholder="Ex: Economizar tempo e poder dar desconto por volume..."
                    rows={2}
                    value={form.expected_benefit}
                    onChange={(e) => setForm(prev => ({ ...prev, expected_benefit: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="example">De um exemplo concreto (opcional)</Label>
                  <Textarea
                    id="example"
                    placeholder="Ex: Joao tem padaria, Pedro tem acougue, mesma familia..."
                    rows={2}
                    value={form.example_use_case}
                    onChange={(e) => setForm(prev => ({ ...prev, example_use_case: e.target.value }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Enviar Solicitacao
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.pending}</div>
                  <div className="text-xs text-muted-foreground">Pendentes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Zap className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.approved}</div>
                  <div className="text-xs text-muted-foreground">Em Andamento</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.completed}</div>
                  <div className="text-xs text-muted-foreground">Concluidos</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests Table */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovadas</TabsTrigger>
            <TabsTrigger value="completed">Concluidas</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>Solicitacoes de Melhoria</CardTitle>
                <CardDescription>
                  Lista de todas as solicitacoes registradas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-12">
                    <Lightbulb className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma solicitacao</h3>
                    <p className="text-muted-foreground mb-4">
                      Seja o primeiro a sugerir uma melhoria!
                    </p>
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Solicitacao
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titulo</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Complexidade</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => (
                        <TableRow key={request.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <div className="font-medium">{request.title}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {request.description}
                            </div>
                          </TableCell>
                          <TableCell>{request.requested_by}</TableCell>
                          <TableCell className="capitalize">{request.department}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>{getComplexityBadge(request.complexity)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {requests.filter(r => r.status === "pending" || r.status === "analyzing").map(request => (
                    <div key={request.id} className="p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{request.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">{request.description}</div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{request.requested_by}</span>
                            <span>{request.department}</span>
                            <span>{new Date(request.created_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                  ))}
                  {requests.filter(r => r.status === "pending" || r.status === "analyzing").length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitacao pendente
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {requests.filter(r => r.status === "approved" || r.status === "in_development").map(request => (
                    <div key={request.id} className="p-4 border rounded-lg hover:bg-muted/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{request.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">{request.description}</div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{request.requested_by}</span>
                            {request.estimated_hours && <span>{request.estimated_hours}h estimadas</span>}
                            {request.assigned_agent && <span>Agente: {request.assigned_agent}</span>}
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                  ))}
                  {requests.filter(r => r.status === "approved" || r.status === "in_development").length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitacao em andamento
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {requests.filter(r => r.status === "completed").map(request => (
                    <div key={request.id} className="p-4 border rounded-lg bg-green-50/50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{request.title}</div>
                          <div className="text-sm text-muted-foreground mt-1">{request.description}</div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{request.requested_by}</span>
                            <span>Concluido em {new Date(request.updated_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                  ))}
                  {requests.filter(r => r.status === "completed").length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma solicitacao concluida ainda
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* How it works */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-600" />
              Como funciona?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Lightbulb className="h-6 w-6 text-amber-600" />
                </div>
                <div className="font-medium">1. Solicite</div>
                <div className="text-xs text-muted-foreground">
                  Descreva a melhoria que precisa
                </div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Brain className="h-6 w-6 text-violet-600" />
                </div>
                <div className="font-medium">2. IA Analisa</div>
                <div className="text-xs text-muted-foreground">
                  Agente IA avalia viabilidade
                </div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 className="h-6 w-6 text-blue-600" />
                </div>
                <div className="font-medium">3. Aprovacao</div>
                <div className="text-xs text-muted-foreground">
                  Gerente aprova implementacao
                </div>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap className="h-6 w-6 text-green-600" />
                </div>
                <div className="font-medium">4. Deploy</div>
                <div className="text-xs text-muted-foreground">
                  Implementado automaticamente
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default FeatureRequests;
