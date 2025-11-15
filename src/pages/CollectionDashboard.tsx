import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, Clock, DollarSign } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CollectionItem {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  status: string;
}

const CollectionDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overdueInvoices, setOverdueInvoices] = useState<CollectionItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    overdue1Month: 0,
    overdue2Months: 0,
    overdue3Plus: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date();

      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(`
          *,
          clients(name)
        `)
        .neq("status", "paid")
        .lt("due_date", today.toISOString())
        .order("due_date", { ascending: true });

      if (error) throw error;

      const items: CollectionItem[] = invoices?.map(inv => {
        const dueDate = new Date(inv.due_date);
        const diffTime = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          id: inv.id,
          clientName: (inv.clients as any)?.name || "Cliente desconhecido",
          amount: Number(inv.amount),
          dueDate: inv.due_date,
          daysOverdue,
          status: inv.status,
        };
      }) || [];

      const total = items.reduce((sum, item) => sum + item.amount, 0);
      const overdue1 = items.filter(i => i.daysOverdue <= 60).reduce((sum, i) => sum + i.amount, 0);
      const overdue2 = items.filter(i => i.daysOverdue > 60 && i.daysOverdue <= 90).reduce((sum, i) => sum + i.amount, 0);
      const overdue3 = items.filter(i => i.daysOverdue > 90).reduce((sum, i) => sum + i.amount, 0);

      setOverdueInvoices(items);
      setStats({
        total,
        overdue1Month: overdue1,
        overdue2Months: overdue2,
        overdue3Plus: overdue3,
      });

      toast.success("Dados carregados!");
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar dados", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getPriorityBadge = (daysOverdue: number) => {
    if (daysOverdue > 90) return <Badge variant="destructive">Alta</Badge>;
    if (daysOverdue > 60) return <Badge variant="secondary">Média</Badge>;
    return <Badge>Baixa</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">💰 Dashboard de Cobrança</h1>
          <p className="text-muted-foreground">Central de gestão de inadimplência</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total em Atraso</CardTitle>
              <DollarSign className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.total)}</div>
              <p className="text-xs text-muted-foreground">{overdueInvoices.length} faturas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Até 60 dias</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{formatCurrency(stats.overdue1Month)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">61-90 dias</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(stats.overdue2Months)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mais de 90 dias</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdue3Plus)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Faturas em Atraso</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Dias em Atraso</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueInvoices.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.clientName}</TableCell>
                    <TableCell>{new Date(item.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{item.daysOverdue} dias</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>{getPriorityBadge(item.daysOverdue)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">
                        Cobrar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default CollectionDashboard;
