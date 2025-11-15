import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LedgerEntry {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface AccountLedger {
  accountCode: string;
  accountName: string;
  entries: LedgerEntry[];
  finalBalance: number;
}

const GeneralLedger = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [ledger, setLedger] = useState<AccountLedger | null>(null);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar contas", { description: error.message });
    }
  };

  const loadLedger = async (accountId: string) => {
    setLoading(true);
    try {
      const account = accounts.find(a => a.id === accountId);
      if (!account) return;

      const { data: entries, error } = await supabase
        .from("accounting_entry_lines")
        .select(`
          *,
          accounting_entries(entry_date, description)
        `)
        .eq("account_id", accountId)
        .order("created_at");

      if (error) throw error;

      let runningBalance = 0;
      const ledgerEntries: LedgerEntry[] = entries?.map(entry => {
        const debit = Number(entry.debit || 0);
        const credit = Number(entry.credit || 0);
        runningBalance += debit - credit;

        return {
          date: (entry.accounting_entries as any)?.entry_date || entry.created_at,
          description: (entry.accounting_entries as any)?.description || entry.description || "",
          debit,
          credit,
          balance: runningBalance,
        };
      }) || [];

      setLedger({
        accountCode: account.code,
        accountName: account.name,
        entries: ledgerEntries,
        finalBalance: runningBalance,
      });

      toast.success("Razão carregado!");
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar razão", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadLedger(selectedAccount);
    }
  }, [selectedAccount]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">📖 Livro Razão</h1>
            <p className="text-muted-foreground">
              Movimentação detalhada por conta contábil
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => selectedAccount && loadLedger(selectedAccount)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecione a Conta</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma conta para ver o razão" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {ledger && (
          <Card>
            <CardHeader>
              <CardTitle>
                {ledger.accountCode} - {ledger.accountName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Histórico</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.entries.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{new Date(entry.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-right">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4} className="text-right">Saldo Final:</TableCell>
                    <TableCell className="text-right">{formatCurrency(ledger.finalBalance)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default GeneralLedger;
