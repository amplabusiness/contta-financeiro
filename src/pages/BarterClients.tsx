import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Repeat, Loader2, Plus, Minus, Eye, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BarterClient {
  id: string;
  name: string;
  is_barter: boolean;
  barter_monthly_credit: number;
  barter_description: string;
  barter_start_date: string;
  current_balance: number;
  status: string;
}

interface CreditMovement {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference_date: string;
  competence: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

const BarterClients = () => {
  const [clients, setClients] = useState<BarterClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<BarterClient | null>(null);
  const [movements, setMovements] = useState<CreditMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  const [movementForm, setMovementForm] = useState({
    type: 'debit' as 'credit' | 'debit',
    amount: '',
    description: '',
    reference_date: format(new Date(), 'yyyy-MM-dd')
  });

  const [stats, setStats] = useState({
    total: 0,
    totalCredits: 0,
    totalDebits: 0,
    totalBalance: 0
  });

  useEffect(() => {
    loadBarterClients();
  }, []);

  const loadBarterClients = async () => {
    try {
      setLoading(true);

      // Buscar clientes em permuta
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .eq("is_barter", true)
        .order("name");

      if (clientsError) throw clientsError;

      // Para cada cliente, buscar saldo atual
      const clientsWithBalance = await Promise.all(
        (clientsData || []).map(async (client) => {
          const { data: balance } = await supabase
            .rpc('get_barter_balance', { p_client_id: client.id });

          return {
            ...client,
            current_balance: balance || 0
          };
        })
      );

      setClients(clientsWithBalance);

      // Calcular estatísticas
      const totalCredits = clientsWithBalance.reduce((sum, c) => sum + (c.barter_monthly_credit || 0), 0);
      const totalBalance = clientsWithBalance.reduce((sum, c) => sum + c.current_balance, 0);

      setStats({
        total: clientsWithBalance.length,
        totalCredits: totalCredits,
        totalDebits: 0,
        totalBalance: totalBalance
      });

    } catch (error: any) {
      console.error("Erro ao carregar clientes em permuta:", error);
      toast.error("Erro ao carregar clientes em permuta");
    } finally {
      setLoading(false);
    }
  };

  const loadClientMovements = async (clientId: string) => {
    try {
      setLoadingMovements(true);

      const { data, error } = await supabase
        .from("barter_credits")
        .select("*")
        .eq("client_id", clientId)
        .order("reference_date", { ascending: false });

      if (error) throw error;

      setMovements((data || []) as CreditMovement[]);
    } catch (error: any) {
      console.error("Erro ao carregar movimentações:", error);
      toast.error("Erro ao carregar movimentações");
    } finally {
      setLoadingMovements(false);
    }
  };

  const handleAddMovement = (client: BarterClient) => {
    setSelectedClient(client);
    setMovementForm({
      type: 'debit',
      amount: '',
      description: '',
      reference_date: format(new Date(), 'yyyy-MM-dd')
    });
    setMovementDialogOpen(true);
  };

  const handleViewExtract = async (client: BarterClient) => {
    setSelectedClient(client);
    setExtractDialogOpen(true);
    await loadClientMovements(client.id);
  };

  const handleSaveMovement = async () => {
    if (!selectedClient) return;

    try {
      const amount = parseFloat(movementForm.amount);

      if (!amount || amount <= 0) {
        toast.error("Informe um valor válido");
        return;
      }

      if (!movementForm.description) {
        toast.error("Informe a descrição da movimentação");
        return;
      }

      // Verificar se há saldo suficiente para débito
      if (movementForm.type === 'debit' && amount > selectedClient.current_balance) {
        toast.error(`Saldo insuficiente! Saldo disponível: ${formatCurrency(selectedClient.current_balance)}`);
        return;
      }

      const referenceDate = new Date(movementForm.reference_date + 'T00:00:00');
      const competence = format(referenceDate, 'MM/yyyy');

      // Usar a function do postgres para adicionar movimentação
      const { error } = await supabase.rpc('add_barter_credit', {
        p_client_id: selectedClient.id,
        p_type: movementForm.type,
        p_amount: amount,
        p_description: movementForm.description,
        p_reference_date: movementForm.reference_date,
        p_competence: competence
      });

      if (error) throw error;

      toast.success(
        movementForm.type === 'credit'
          ? "Crédito adicionado com sucesso!"
          : "Débito lançado com sucesso!"
      );

      setMovementDialogOpen(false);
      loadBarterClients();

    } catch (error: any) {
      console.error("Erro ao salvar movimentação:", error);
      toast.error("Erro ao salvar movimentação: " + error.message);
    }
  };

  const handleGenerateMonthlyCredits = async () => {
    try {
      const activeBarterClients = clients.filter(c => c.status === 'active');

      if (activeBarterClients.length === 0) {
        toast.info("Nenhum cliente ativo em permuta");
        return;
      }

      const firstDayOfMonth = startOfMonth(new Date());
      const competence = format(firstDayOfMonth, 'MM/yyyy');

      let successCount = 0;
      let errorCount = 0;

      for (const client of activeBarterClients) {
        try {
          await supabase.rpc('add_barter_credit', {
            p_client_id: client.id,
            p_type: 'credit',
            p_amount: client.barter_monthly_credit,
            p_description: `Crédito mensal - ${competence}`,
            p_reference_date: format(firstDayOfMonth, 'yyyy-MM-dd'),
            p_competence: competence
          });
          successCount++;
        } catch (err) {
          errorCount++;
          console.error(`Erro ao gerar crédito para ${client.name}:`, err);
        }
      }

      if (successCount > 0) {
        toast.success(`Créditos mensais gerados para ${successCount} cliente(s)!`);
        loadBarterClients();
      }

      if (errorCount > 0) {
        toast.error(`Erro ao gerar créditos para ${errorCount} cliente(s)`);
      }

    } catch (error: any) {
      console.error("Erro ao gerar créditos mensais:", error);
      toast.error("Erro ao gerar créditos mensais");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Repeat className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Clientes em Permuta</h1>
              <p className="text-muted-foreground">
                Gestão de créditos e consumo por permuta de serviços
              </p>
            </div>
          </div>
          <Button onClick={handleGenerateMonthlyCredits} className="gap-2">
            <Calendar className="h-4 w-4" />
            Gerar Créditos Mensais
          </Button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Crédito Mensal Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalCredits)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo Total Acumulado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalBalance)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Média de Saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.total > 0 ? stats.totalBalance / stats.total : 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Clientes */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes em Permuta</CardTitle>
            <CardDescription>
              {clients.length} cliente{clients.length !== 1 ? 's' : ''} encontrado{clients.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cliente em permuta cadastrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Descrição da Permuta</TableHead>
                      <TableHead>Crédito Mensal</TableHead>
                      <TableHead>Saldo Atual</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Repeat className="h-4 w-4 text-primary" />
                            {client.name}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {client.barter_description || "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(client.barter_monthly_credit)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={client.current_balance > 0 ? "default" : "secondary"}>
                              {formatCurrency(client.current_balance)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.barter_start_date
                            ? format(new Date(client.barter_start_date), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                            {client.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddMovement(client)}
                              title="Adicionar movimentação"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewExtract(client)}
                              title="Ver extrato"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Movimentação */}
        <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Movimentação</DialogTitle>
              <DialogDescription>
                Cliente: {selectedClient?.name} - Saldo: {formatCurrency(selectedClient?.current_balance || 0)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="movement_type">Tipo de Movimentação</Label>
                <Select
                  value={movementForm.type}
                  onValueChange={(value: 'credit' | 'debit') => setMovementForm({ ...movementForm, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span>Crédito (Adicionar)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="debit">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span>Débito (Consumo)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="movement_amount">Valor</Label>
                <Input
                  id="movement_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={movementForm.amount}
                  onChange={(e) => setMovementForm({ ...movementForm, amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="movement_date">Data</Label>
                <Input
                  id="movement_date"
                  type="date"
                  value={movementForm.reference_date}
                  onChange={(e) => setMovementForm({ ...movementForm, reference_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="movement_description">Descrição</Label>
                <Textarea
                  id="movement_description"
                  placeholder={
                    movementForm.type === 'credit'
                      ? "Ex: Crédito mensal de Janeiro"
                      : "Ex: Corte de cabelo + escova"
                  }
                  value={movementForm.description}
                  onChange={(e) => setMovementForm({ ...movementForm, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMovementDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveMovement}>
                Salvar Movimentação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Extrato */}
        <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Extrato de Movimentações</DialogTitle>
              <DialogDescription>
                Cliente: {selectedClient?.name} - Saldo Atual: {formatCurrency(selectedClient?.current_balance || 0)}
              </DialogDescription>
            </DialogHeader>

            {loadingMovements ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma movimentação registrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo Anterior</TableHead>
                    <TableHead className="text-right">Saldo Posterior</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        {format(new Date(movement.reference_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {movement.type === 'credit' ? (
                          <Badge variant="default" className="bg-green-600">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Crédito
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Débito
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">{movement.description}</TableCell>
                      <TableCell className="text-right font-medium">
                        {movement.type === 'credit' ? '+' : '-'}{formatCurrency(movement.amount)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(movement.balance_before)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(movement.balance_after)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <DialogFooter>
              <Button onClick={() => setExtractDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default BarterClients;
