import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertCircle, Search, UserPlus, RefreshCw, Building2, Calendar, DollarSign } from "lucide-react";
import { formatCurrency } from "@/data/expensesData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UnmatchedPix {
  id: string;
  transaction_date: string;
  amount: number;
  description: string;
  cnpj: string;
  company_name: string;
  has_client: boolean;
  similar_clients: any[];
}

const UnmatchedPixReport = () => {
  const [loading, setLoading] = useState(true);
  const [unmatchedTransactions, setUnmatchedTransactions] = useState<UnmatchedPix[]>([]);
  const [createClientDialogOpen, setCreateClientDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<UnmatchedPix | null>(null);
  const [newClientName, setNewClientName] = useState("");

  useEffect(() => {
    loadUnmatchedTransactions();
  }, []);

  const extractCNPJFromDescription = (description: string): string | null => {
    const cnpjMatch = description.match(/(\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (cnpjMatch) {
      return cnpjMatch[1].replace(/[^\d]/g, '');
    }
    return null;
  };

  const extractCompanyNameFromDescription = (description: string): string => {
    // Tentar extrair nome após o CNPJ
    const parts = description.split(/\d{14}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    if (parts.length > 1) {
      const name = parts[1].trim().split(/\s{2,}|Ref:|REF:/)[0].trim();
      return name || "Nome não identificado";
    }
    return "Nome não identificado";
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj || cnpj.length !== 14) return cnpj;
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const loadUnmatchedTransactions = async () => {
    setLoading(true);
    try {
      // Buscar transações PIX não conciliadas
      const { data: pixTransactions, error: txError } = await supabase
        .from("bank_transactions")
        .select("*")
        .eq("matched", false)
        .eq("transaction_type", "credit")
        .or("description.ilike.%PIX%,description.ilike.%pix%")
        .order("transaction_date", { ascending: false });

      if (txError) throw txError;

      // Buscar todos os clientes
      const { data: allClients, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, cnpj, status");

      if (clientsError) throw clientsError;

      // Processar transações
      const unmatched: UnmatchedPix[] = [];

      for (const tx of pixTransactions || []) {
        const cnpj = extractCNPJFromDescription(tx.description);
        
        if (cnpj) {
          // Verificar se existe cliente com esse CNPJ
          const clientWithCNPJ = allClients?.find(c => 
            c.cnpj?.replace(/[^\d]/g, '') === cnpj
          );

          // Buscar clientes similares pelo nome
          const companyName = extractCompanyNameFromDescription(tx.description);
          const similarClients = allClients?.filter(c => {
            const similarity = c.name.toUpperCase().includes(companyName.toUpperCase()) ||
                             companyName.toUpperCase().includes(c.name.toUpperCase());
            return similarity && c.id !== clientWithCNPJ?.id;
          }).slice(0, 3) || [];

          unmatched.push({
            id: tx.id,
            transaction_date: tx.transaction_date,
            amount: tx.amount,
            description: tx.description,
            cnpj: cnpj,
            company_name: companyName,
            has_client: !!clientWithCNPJ,
            similar_clients: similarClients,
          });
        }
      }

      // Filtrar apenas os que NÃO têm cliente cadastrado
      const withoutClient = unmatched.filter(u => !u.has_client);
      
      setUnmatchedTransactions(withoutClient);
      
      if (withoutClient.length === 0) {
        toast.success("Todas as transações PIX têm clientes correspondentes!");
      } else {
        toast.info(`${withoutClient.length} transação(ões) sem cliente correspondente`);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar transações: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClient = (transaction: UnmatchedPix) => {
    setSelectedTransaction(transaction);
    setNewClientName(transaction.company_name);
    setCreateClientDialogOpen(true);
  };

  const confirmCreateClient = async () => {
    if (!selectedTransaction || !newClientName.trim()) {
      toast.error("Preencha o nome do cliente");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("clients").insert({
        name: newClientName.trim(),
        cnpj: selectedTransaction.cnpj,
        status: "active",
        created_by: user.id,
        notes: `Cadastrado automaticamente via PIX em ${new Date().toLocaleDateString()}`,
      });

      if (error) {
        if (error.message.includes('clients_cnpj_normalized_unique')) {
          toast.error("CNPJ já cadastrado para outro cliente");
          return;
        }
        throw error;
      }

      toast.success("Cliente cadastrado com sucesso!");
      setCreateClientDialogOpen(false);
      setSelectedTransaction(null);
      setNewClientName("");
      loadUnmatchedTransactions();
    } catch (error: any) {
      toast.error("Erro ao cadastrar cliente: " + error.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">PIX sem Cliente Correspondente</h1>
            <p className="text-muted-foreground mt-1">
              Transações PIX com CNPJ identificado mas sem cliente cadastrado
            </p>
          </div>
          <Button onClick={loadUnmatchedTransactions} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transações sem Cliente</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unmatchedTransactions.length}</div>
              <p className="text-xs text-muted-foreground">PIX não conciliados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(unmatchedTransactions.reduce((sum, t) => sum + t.amount, 0))}
              </div>
              <p className="text-xs text-muted-foreground">Aguardando conciliação</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CNPJs Únicos</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(unmatchedTransactions.map(t => t.cnpj)).size}
              </div>
              <p className="text-xs text-muted-foreground">Empresas diferentes</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transações Não Conciliadas</CardTitle>
            <CardDescription>
              PIX com CNPJ identificado mas sem cliente correspondente no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              </div>
            ) : unmatchedTransactions.length === 0 ? (
              <div className="text-center py-12">
                <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Nenhuma transação sem cliente</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Todas as transações PIX têm clientes correspondentes!
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Empresa (extraída)</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Clientes Similares</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(tx.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCNPJ(tx.cnpj)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {tx.company_name}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell>
                        {tx.similar_clients.length > 0 ? (
                          <div className="space-y-1">
                            {tx.similar_clients.map((client) => (
                              <Badge key={client.id} variant="outline" className="mr-1">
                                {client.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nenhum similar</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          onClick={() => handleCreateClient(tx)}
                          size="sm"
                          variant="outline"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Cadastrar Cliente
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

      <Dialog open={createClientDialogOpen} onOpenChange={setCreateClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Cadastrar Novo Cliente
            </DialogTitle>
            <DialogDescription>
              Criar cliente para a transação PIX recebida
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">CNPJ:</span>
                  <span className="font-mono font-medium">{formatCNPJ(selectedTransaction.cnpj)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(selectedTransaction.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Data:</span>
                  <span>{format(new Date(selectedTransaction.transaction_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-name">Nome do Cliente *</Label>
                <Input
                  id="client-name"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Digite o nome da empresa"
                />
                <p className="text-xs text-muted-foreground">
                  Nome extraído da descrição: {selectedTransaction.company_name}
                </p>
              </div>

              {selectedTransaction.similar_clients.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-orange-900 mb-1">Atenção</p>
                      <p className="text-orange-800">
                        Existem clientes com nomes similares. Verifique se não é um deles antes de criar um novo cadastro.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateClientDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={confirmCreateClient}>
              Cadastrar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default UnmatchedPixReport;
