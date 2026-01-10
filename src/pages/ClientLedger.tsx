import { useEffect, useState, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { toast } from "sonner";
import { useClient } from "@/contexts/ClientContext";

const ClientLedger = () => {
  const { selectedClientId } = useClient();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);

  const loadClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLedger = useCallback(async (clientId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("client_ledger")
        .select("*, invoice_id:invoices(id, description, competence)")
        .eq("client_id", clientId)
        .order("transaction_date", { ascending: true });

      if (error) throw error;
      setLedger(data || []);

      if (data && data.length > 0) {
        setBalance(data[data.length - 1].balance);
      } else {
        setBalance(0);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar razão do cliente");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (selectedClientId) {
      setSelectedClient(selectedClientId);
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedClient) {
      loadLedger(selectedClient);
    }
  }, [selectedClient, loadLedger]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Razão do Cliente</h1>
          <p className="text-muted-foreground">
            Histórico de honorários e pagamentos por cliente
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecionar Cliente</CardTitle>
            <CardDescription>Visualize o razão de um cliente específico</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
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
          </CardContent>
        </Card>

        {selectedClient && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Saldo Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${balance < 0 ? 'text-destructive' : 'text-success'}`}>
                  {formatCurrency(balance)}
                </div>
                {balance < 0 && (
                  <p className="text-sm text-destructive mt-2">
                    Cliente possui honorários em atraso
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extrato</CardTitle>
                <CardDescription>Movimentação histórica</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                  </div>
                ) : ledger.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma movimentação encontrada para este cliente
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Débito</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {new Date(entry.transaction_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{entry.description}</p>
                              {entry.notes && (
                                <p className="text-xs text-muted-foreground">{entry.notes}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.debit > 0 ? (
                              <span className="text-destructive font-semibold">
                                {formatCurrency(entry.debit)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.credit > 0 ? (
                              <span className="text-success font-semibold">
                                {formatCurrency(entry.credit)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span className={entry.balance < 0 ? 'text-destructive' : 'text-success'}>
                              {formatCurrency(entry.balance)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default ClientLedger;
