import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";

const Clients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    monthly_fee: "",
    payment_day: "",
    notes: "",
    status: "active",
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const clientData = {
        ...formData,
        monthly_fee: parseFloat(formData.monthly_fee) || 0,
        payment_day: formData.payment_day ? parseInt(formData.payment_day) : null,
        created_by: user.id,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("clients").insert(clientData);

        if (error) throw error;
        toast.success("Cliente cadastrado com sucesso!");
      }

      setOpen(false);
      setEditingClient(null);
      resetForm();
      loadClients();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;

    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);

      if (error) throw error;
      toast.success("Cliente excluído com sucesso!");
      loadClients();
    } catch (error: any) {
      toast.error("Erro ao excluir cliente");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      cnpj: "",
      email: "",
      phone: "",
      monthly_fee: "",
      payment_day: "",
      notes: "",
      status: "active",
    });
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      cnpj: client.cnpj || "",
      email: client.email || "",
      phone: client.phone || "",
      monthly_fee: client.monthly_fee?.toString() || "",
      payment_day: client.payment_day?.toString() || "",
      notes: client.notes || "",
      status: client.status,
    });
    setOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground">Gerencie o cadastro de clientes</p>
          </div>
          <Dialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              setEditingClient(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
                <DialogDescription>
                  Preencha os dados do cliente
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly_fee">Honorário Mensal *</Label>
                    <Input
                      id="monthly_fee"
                      type="number"
                      step="0.01"
                      value={formData.monthly_fee}
                      onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment_day">Dia de Pagamento</Label>
                    <Input
                      id="payment_day"
                      type="number"
                      min="1"
                      max="31"
                      value={formData.payment_day}
                      onChange={(e) => setFormData({ ...formData, payment_day: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
            <CardDescription>Total: {clients.length} clientes</CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum cliente cadastrado ainda
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Honorário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.cnpj || "-"}</TableCell>
                      <TableCell>{client.email || "-"}</TableCell>
                      <TableCell>{formatCurrency(Number(client.monthly_fee))}</TableCell>
                      <TableCell>
                        <Badge variant={client.status === "active" ? "default" : "secondary"}>
                          {client.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(client)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(client.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
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

export default Clients;
