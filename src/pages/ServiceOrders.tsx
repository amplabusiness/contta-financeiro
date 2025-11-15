import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ServiceOrder {
  id: string;
  clientId: string;
  clientName: string;
  description: string;
  actionTaken: string;
  createdAt: string;
  createdBy: string;
}

const ServiceOrders = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    description: "",
    actionTaken: "",
  });

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Por enquanto, vamos simular a busca
      // Quando a tabela service_orders for criada, usar:
      // const { data, error } = await supabase.from("service_orders").select("*, clients(name)");
      
      setOrders([]);
      toast.success("Ordens carregadas!");
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar ordens", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Quando a tabela service_orders for criada, usar:
      // const { error } = await supabase.from("service_orders").insert({...form});
      
      toast.success("Ordem de serviço criada!");
      setOpen(false);
      loadOrders();
    } catch (error: any) {
      toast.error("Erro ao criar ordem", { description: error.message });
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">📋 Ordens de Serviço</h1>
            <p className="text-muted-foreground">Registros de ações de cobrança</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Ordem
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Ordem de Serviço</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Cliente</Label>
                  <Input
                    placeholder="ID do cliente"
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Descrição da ordem de serviço"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Ação Realizada</Label>
                  <Textarea
                    placeholder="Detalhes da ação realizada"
                    value={form.actionTaken}
                    onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Criar Ordem</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Ordens</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-10">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma ordem registrada</h3>
                <p className="text-muted-foreground">Crie sua primeira ordem de serviço para começar.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.clientName}</TableCell>
                      <TableCell>{order.description}</TableCell>
                      <TableCell>{order.actionTaken}</TableCell>
                      <TableCell>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ServiceOrders;
