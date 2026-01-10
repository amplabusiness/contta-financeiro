import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clipboard,
  Plus,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AIEmailComposer } from "@/components/ai/AIEmailComposer";

interface WorkOrder {
  id: string;
  client_id: string;
  client_name: string;
  invoice_id: string | null;
  invoice_amount: number;
  invoice_competence: string | null;
  assigned_to: string;
  status: string;
  priority: string;
  action_type: string;
  description: string;
  next_action_date: string;
  created_at: string;
  updated_at: string;
  logs: WorkOrderLog[];
}

interface WorkOrderLog {
  id: string;
  work_order_id: string;
  action: string;
  description: string;
  result: string;
  next_step: string;
  next_contact_date: string | null;
  created_by: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  client_id: string;
  competence: string;
  amount: number;
  status: string;
}

const CollectionWorkOrders = () => {
  const { toast } = useToast();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    client_id: "",
    invoice_id: "",
    assigned_to: "",
    priority: "medium",
    action_type: "phone_call",
    description: "",
    next_action_date: "",
  });

  const [logFormData, setLogFormData] = useState({
    action: "",
    description: "",
    result: "",
    next_step: "",
    next_contact_date: "",
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Fetch overdue invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, client_id, competence, amount, status")
        .eq("status", "overdue")
        .order("due_date");

      if (invoicesError) throw invoicesError;
      setOverdueInvoices(invoicesData || []);

      const { data: workOrdersData, error: workOrdersError } = await supabase
        .from("collection_work_orders")
        .select(`
          id,
          client_id,
          invoice_id,
          assigned_to,
          status,
          priority,
          action_type,
          description,
          next_action_date,
          created_at,
          updated_at,
          clients(name),
          invoices(amount, competence),
          collection_work_order_logs(
            id,
            work_order_id,
            action,
            description,
            result,
            next_step,
            next_contact_date,
            created_by,
            created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (workOrdersError) throw workOrdersError;

      const mappedOrders = (workOrdersData || []).map((order: any) => ({
        id: order.id,
        client_id: order.client_id,
        client_name: order.clients?.name || "Cliente não informado",
        invoice_id: order.invoice_id,
        invoice_amount: Number(order.invoices?.amount || 0),
        invoice_competence: order.invoices?.competence || null,
        assigned_to: order.assigned_to,
        status: order.status,
        priority: order.priority,
        action_type: order.action_type,
        description: order.description,
        next_action_date: order.next_action_date,
        created_at: order.created_at,
        updated_at: order.updated_at,
        logs: order.collection_work_order_logs || [],
      }));

      setWorkOrders(mappedOrders);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateWorkOrder = async () => {
    if (!formData.client_id || !formData.invoice_id || !formData.assigned_to || !formData.next_action_date) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha cliente, fatura, responsável e próxima ação.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const { error } = await supabase
        .from("collection_work_orders")
        .insert({
          client_id: formData.client_id,
          invoice_id: formData.invoice_id,
          assigned_to: formData.assigned_to,
          priority: formData.priority,
          action_type: formData.action_type,
          description: formData.description,
          next_action_date: formData.next_action_date,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Ordem de Serviço criada",
        description: "A OS foi criada com sucesso.",
      });

      setShowNewOrder(false);
      setFormData({
        client_id: "",
        invoice_id: "",
        assigned_to: "",
        priority: "medium",
        action_type: "phone_call",
        description: "",
        next_action_date: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating work order:", error);
      toast({
        title: "Erro ao criar OS",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleAddLog = async () => {
    if (!selectedOrder) {
      toast({
        title: "Selecione uma OS",
        description: "Escolha uma ordem de serviço para registrar o log.",
        variant: "destructive",
      });
      return;
    }

    if (!logFormData.action) {
      toast({
        title: "Campo obrigatório",
        description: "Informe a ação realizada.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const { error } = await supabase
        .from("collection_work_order_logs")
        .insert({
          work_order_id: selectedOrder.id,
          action: logFormData.action,
          description: logFormData.description,
          result: logFormData.result,
          next_step: logFormData.next_step,
          next_contact_date: logFormData.next_contact_date || null,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Log adicionado",
        description: "O registro de ação foi adicionado com sucesso.",
      });
      setShowLogDialog(false);
      setLogFormData({
        action: "",
        description: "",
        result: "",
        next_step: "",
        next_contact_date: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error adding log:", error);
      toast({
        title: "Erro ao salvar log",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      pending: (
        <Badge className="bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Pendente
        </Badge>
      ),
      in_progress: (
        <Badge className="bg-blue-100 text-blue-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Em Andamento
        </Badge>
      ),
      resolved: (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Resolvido
        </Badge>
      ),
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const badges: Record<string, JSX.Element> = {
      high: <Badge variant="destructive">Alta</Badge>,
      medium: <Badge className="bg-orange-100 text-orange-800">Média</Badge>,
      low: <Badge variant="outline">Baixa</Badge>,
    };
    return badges[priority] || <Badge>{priority}</Badge>;
  };

  const getActionIcon = (actionType: string) => {
    const icons: Record<string, JSX.Element> = {
      phone_call: <Phone className="w-4 h-4" />,
      email: <Mail className="w-4 h-4" />,
      whatsapp: <MessageSquare className="w-4 h-4" />,
      meeting: <User className="w-4 h-4" />,
    };
    return icons[actionType] || <Clipboard className="w-4 h-4" />;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value ?? 0);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("pt-BR");
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
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Clipboard className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Ordens de Serviço - Cobrança</h1>
                    <p className="text-muted-foreground">
                      Gestão de ações de cobrança com histórico completo
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowNewOrder(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova OS
                </Button>
              </div>
            </div>

            {/* Work Orders Table */}
            <Card>
              <CardHeader>
                <CardTitle>Ordens de Serviço Ativas</CardTitle>
                <CardDescription>
                  Acompanhe todas as ações de cobrança em andamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workOrders.length === 0 ? (
                  <div className="text-center py-12">
                    <Clipboard className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma OS cadastrada</h3>
                    <p className="text-muted-foreground mb-4">
                      Crie ordens de serviço para gerenciar as cobranças pendentes
                    </p>
                    <Button onClick={() => setShowNewOrder(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeira OS
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OS#</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Próxima Data</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>IA</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm">
                            #{order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="font-medium">{order.client_name}</TableCell>
                          <TableCell>{formatCurrency(order.invoice_amount)}</TableCell>
                          <TableCell>{order.assigned_to}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionIcon(order.action_type)}
                              <span className="text-sm capitalize">
                                {order.action_type.replace("_", " ")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(order.next_action_date)}</TableCell>
                          <TableCell>{getPriorityBadge(order.priority)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            <AIEmailComposer
                              clientId={order.client_id}
                              invoiceId={order.invoice_id}
                              context="collection"
                              trigger={
                                <Button size="sm" variant="outline">
                                  <Mail className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowLogDialog(true);
                                }}
                              >
                                Adicionar Log
                              </Button>
                              <Button size="sm" variant="ghost">
                                Ver Histórico
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* New Work Order Dialog */}
            <Dialog open={showNewOrder} onOpenChange={setShowNewOrder}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nova Ordem de Serviço de Cobrança</DialogTitle>
                  <DialogDescription>
                    Crie uma OS para registrar e acompanhar ações de cobrança
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="client">Cliente *</Label>
                      <Select
                        value={formData.client_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, client_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invoice">Fatura em Atraso *</Label>
                      <Select
                        value={formData.invoice_id}
                        onValueChange={(value) =>
                          setFormData({ ...formData, invoice_id: value })
                        }
                        disabled={!formData.client_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a fatura" />
                        </SelectTrigger>
                        <SelectContent>
                          {overdueInvoices
                            .filter((inv) => inv.client_id === formData.client_id)
                            .map((invoice) => (
                              <SelectItem key={invoice.id} value={invoice.id}>
                                {invoice.competence} - {formatCurrency(invoice.amount)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="assigned_to">Responsável *</Label>
                      <Input
                        id="assigned_to"
                        value={formData.assigned_to}
                        onChange={(e) =>
                          setFormData({ ...formData, assigned_to: e.target.value })
                        }
                        placeholder="Nome do responsável"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority">Prioridade</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) =>
                          setFormData({ ...formData, priority: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="low">Baixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="action_type">Tipo de Ação</Label>
                      <Select
                        value={formData.action_type}
                        onValueChange={(value) =>
                          setFormData({ ...formData, action_type: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone_call">Ligação</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="meeting">Reunião</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="next_action_date">Próxima Ação</Label>
                      <Input
                        id="next_action_date"
                        type="date"
                        value={formData.next_action_date}
                        onChange={(e) =>
                          setFormData({ ...formData, next_action_date: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição/Observações</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Descreva o contexto da cobrança..."
                      rows={4}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowNewOrder(false);
                      setFormData({
                        client_id: "",
                        invoice_id: "",
                        assigned_to: "",
                        priority: "medium",
                        action_type: "phone_call",
                        description: "",
                        next_action_date: "",
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateWorkOrder}>Criar OS</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Log Dialog */}
            <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Registrar Ação de Cobrança</DialogTitle>
                  <DialogDescription>
                    Documente a ação realizada e os próximos passos
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="action">Ação Realizada *</Label>
                    <Input
                      id="action"
                      value={logFormData.action}
                      onChange={(e) =>
                        setLogFormData({ ...logFormData, action: e.target.value })
                      }
                      placeholder="Ex: Ligação realizada, E-mail enviado..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="log_description">Descrição da Ação</Label>
                    <Textarea
                      id="log_description"
                      value={logFormData.description}
                      onChange={(e) =>
                        setLogFormData({ ...logFormData, description: e.target.value })
                      }
                      placeholder="Descreva o que foi feito..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="result">Resultado</Label>
                    <Textarea
                      id="result"
                      value={logFormData.result}
                      onChange={(e) =>
                        setLogFormData({ ...logFormData, result: e.target.value })
                      }
                      placeholder="Qual foi o resultado da ação? O que o cliente disse?"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="next_step">Próximo Passo</Label>
                    <Textarea
                      id="next_step"
                      value={logFormData.next_step}
                      onChange={(e) =>
                        setLogFormData({ ...logFormData, next_step: e.target.value })
                      }
                      placeholder="O que deve ser feito em seguida?"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="next_contact_date">Próximo Contato</Label>
                    <Input
                      id="next_contact_date"
                      type="date"
                      value={logFormData.next_contact_date}
                      onChange={(e) =>
                        setLogFormData({
                          ...logFormData,
                          next_contact_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowLogDialog(false);
                      setLogFormData({
                        action: "",
                        description: "",
                        result: "",
                        next_step: "",
                        next_contact_date: "",
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleAddLog}>Salvar Log</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default CollectionWorkOrders;
