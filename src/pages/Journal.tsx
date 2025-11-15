import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  documentNumber: string | null;
  lines: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

const Journal = () => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data: accountingEntries, error: entriesError } = await supabase
        .from("accounting_entries")
        .select(`
          *,
          accounting_entry_lines(
            *,
            chart_of_accounts(code, name)
          )
        `)
        .order("entry_date", { ascending: false })
        .limit(100);

      if (entriesError) throw entriesError;

      const journal: JournalEntry[] = accountingEntries?.map(entry => ({
        id: entry.id,
        date: entry.entry_date,
        description: entry.description,
        documentNumber: entry.document_number,
        lines: (entry.accounting_entry_lines as any[])?.map(line => ({
          accountCode: line.chart_of_accounts?.code || "",
          accountName: line.chart_of_accounts?.name || "",
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
        })) || [],
        totalDebit: Number(entry.total_debit || 0),
        totalCredit: Number(entry.total_credit || 0),
        balanced: entry.balanced,
      })) || [];

      setEntries(journal);
      toast.success("Livro diário carregado!");
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar livro diário", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

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
            <h1 className="text-3xl font-bold">📔 Livro Diário</h1>
            <p className="text-muted-foreground">
              Registro cronológico de todos os lançamentos contábeis
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadEntries}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {new Date(entry.date).toLocaleDateString("pt-BR")} - {entry.description}
                    </CardTitle>
                    {entry.documentNumber && (
                      <p className="text-sm text-muted-foreground">
                        Documento: {entry.documentNumber}
                      </p>
                    )}
                  </div>
                  <Badge variant={entry.balanced ? "default" : "destructive"}>
                    {entry.balanced ? "Balanceado" : "Desbalanceado"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Débito</TableHead>
                      <TableHead className="text-right">Crédito</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entry.lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono">{line.accountCode}</TableCell>
                        <TableCell>{line.accountName}</TableCell>
                        <TableCell className="text-right">
                          {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={2}>TOTAIS</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.totalDebit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.totalCredit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>

        {entries.length === 0 && !loading && (
          <Card>
            <CardContent className="py-10 text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhum lançamento encontrado</h3>
              <p className="text-muted-foreground">
                Os lançamentos contábeis aparecerão aqui quando forem criados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Journal;
