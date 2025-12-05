import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle, CheckCircle, Badge } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CostCenterAuditResult {
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  registered_accounts: Array<{ id: string; code: string; name: string }>;
  linked_accounts: Array<{ id: string; code: string; name: string }>;
  discrepancies: Array<{
    account_id: string;
    account_code: string;
    account_name: string;
    top_level_parent: string;
    expense_count: number;
    total_amount: number;
  }>;
  is_compliant: boolean;
}

const CostCenterAudit = () => {
  const [loading, setLoading] = useState(true);
  const [auditResults, setAuditResults] = useState<CostCenterAuditResult[]>([]);
  const [discrepancyCount, setDiscrepancyCount] = useState(0);

  useEffect(() => {
    loadAuditData();
  }, []);

  const isAccountDescendant = (accountCode: string, parentCode: string): boolean => {
    // Check if accountCode is a descendant of parentCode
    // e.g., "4.1.1" is descendant of "4", "4.1", but not of "1"
    // "1.1.3.04.001" is descendant of "1", "1.1", "1.1.3", "1.1.3.04"

    // Exact match
    if (accountCode === parentCode) return true;

    // Check if accountCode starts with parentCode.
    return accountCode.startsWith(parentCode + ".");
  };

  const loadAuditData = async () => {
    try {
      setLoading(true);

      // 1. Get all active cost centers
      const { data: costCenters, error: ccError } = await supabase
        .from("cost_centers")
        .select("id, code, name")
        .eq("is_active", true)
        .order("code");

      if (ccError) throw ccError;

      if (!costCenters || costCenters.length === 0) {
        toast.info("Nenhum centro de custo encontrado");
        setLoading(false);
        return;
      }

      // 2. Get all chart accounts for reference
      const { data: allAccounts, error: acError } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name")
        .eq("is_active", true);

      if (acError) throw acError;

      const accountMap = new Map(allAccounts?.map(acc => [acc.id, acc]) || []);

      // 3. Get registered accounts for each cost center
      const { data: registeredLinks, error: regError } = await supabase
        .from("cost_center_accounts")
        .select("cost_center_id, chart_account_id");

      if (regError) throw regError;

      const registeredByCenter = new Map<string, string[]>();
      registeredLinks?.forEach(link => {
        const accounts = registeredByCenter.get(link.cost_center_id) || [];
        accounts.push(link.chart_account_id);
        registeredByCenter.set(link.cost_center_id, accounts);
      });

      // 4. Get all expenses with their cost center and account relationships
      const { data: expenses, error: expError } = await supabase
        .from("expenses")
        .select("id, cost_center_id, account_id, amount");

      if (expError) throw expError;

      // Group expenses by cost center and account
      const expensesByCenter = new Map<string, Map<string, { amount: number; count: number }>>();

      expenses?.forEach((exp: any) => {
        if (!exp.cost_center_id || !exp.account_id) return;

        if (!expensesByCenter.has(exp.cost_center_id)) {
          expensesByCenter.set(exp.cost_center_id, new Map());
        }

        const centerExpenses = expensesByCenter.get(exp.cost_center_id)!;
        const existing = centerExpenses.get(exp.account_id) || { amount: 0, count: 0 };
        centerExpenses.set(exp.account_id, {
          amount: existing.amount + (exp.amount || 0),
          count: existing.count + 1,
        });
      });

      // 5. Build audit results
      const results: CostCenterAuditResult[] = [];
      let totalDiscrepancies = 0;

      for (const center of costCenters) {
        const registeredAccountIds = registeredByCenter.get(center.id) || [];
        const registeredAccounts = registeredAccountIds
          .map(id => accountMap.get(id))
          .filter((acc): acc is any => acc !== undefined);

        const centerExpenses = expensesByCenter.get(center.id) || new Map();
        const linkedAccountIds = Array.from(centerExpenses.keys());
        const linkedAccounts = linkedAccountIds
          .map(id => accountMap.get(id))
          .filter((acc): acc is any => acc !== undefined);

        // Find discrepancies: linked accounts that are NOT descendants of any registered account
        const discrepancies: CostCenterAuditResult["discrepancies"] = [];

        linkedAccounts.forEach(linkedAcc => {
          // Check if this linked account is a descendant of any registered account
          const isCompliant = registeredAccounts.some(regAcc => {
            return isAccountDescendant(linkedAcc.code, regAcc.code);
          });

          if (!isCompliant) {
            const expenseData = centerExpenses.get(linkedAcc.id)!;
            discrepancies.push({
              account_id: linkedAcc.id,
              account_code: linkedAcc.code,
              account_name: linkedAcc.name,
              top_level_parent: linkedAcc.code.split(".")[0], // Show the top-level for reference
              expense_count: expenseData.count,
              total_amount: expenseData.amount,
            });
            totalDiscrepancies++;
          }
        });

        results.push({
          cost_center_id: center.id,
          cost_center_code: center.code,
          cost_center_name: center.name,
          registered_accounts: registeredAccounts,
          linked_accounts: linkedAccounts,
          discrepancies,
          is_compliant: discrepancies.length === 0,
        });
      }

      setDiscrepancyCount(totalDiscrepancies);
      setAuditResults(results.sort((a, b) => {
        // Show non-compliant first
        if (a.is_compliant !== b.is_compliant) {
          return a.is_compliant ? 1 : -1;
        }
        return a.cost_center_code.localeCompare(b.cost_center_code);
      }));

      if (totalDiscrepancies > 0) {
        toast.warning(`Encontrados ${totalDiscrepancies} problemas em centros de custo`);
      } else {
        toast.success("Todos os centros de custo estão em conformidade!");
      }
    } catch (error: any) {
      console.error("Erro ao carregar auditoria:", error);
      toast.error("Erro ao carregar dados da auditoria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Auditoria de Centros de Custo</h1>
          <p className="text-muted-foreground mt-2">
            Verificar quais centros de custo têm contas vinculadas que não respeitam as contas padrão cadastradas
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total de Centros</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditResults.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Em Conformidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {auditResults.filter(r => r.is_compliant).length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Com Discrepâncias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{discrepancyCount}</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all">Todos os Centros</TabsTrigger>
                <TabsTrigger value="issues">
                  Com Problemas ({auditResults.filter(r => !r.is_compliant).length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {auditResults.map(result => (
                  <CostCenterAuditCard key={result.cost_center_id} result={result} />
                ))}
              </TabsContent>

              <TabsContent value="issues" className="space-y-4">
                {auditResults
                  .filter(r => !r.is_compliant)
                  .map(result => (
                    <CostCenterAuditCard key={result.cost_center_id} result={result} />
                  ))}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
};

const CostCenterAuditCard = ({ result }: { result: CostCenterAuditResult }) => {
  return (
    <Card className={result.is_compliant ? "border-green-200" : "border-red-200"}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {result.is_compliant ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            )}
            <CardTitle className="text-base">
              {result.cost_center_code} - {result.cost_center_name}
            </CardTitle>
          </div>
          <Badge variant={result.is_compliant ? "outline" : "destructive"} className="flex-shrink-0">
            {result.is_compliant ? "Conforme" : `${result.discrepancies.length} problema(s)`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="font-semibold text-sm mb-2">Contas Padrão Cadastradas:</h4>
            <div className="space-y-1">
              {result.registered_accounts.length > 0 ? (
                result.registered_accounts.map(acc => (
                  <div key={acc.id} className="text-sm text-muted-foreground">
                    <span className="font-mono">{acc.code}</span> - {acc.name}
                  </div>
                ))
              ) : (
                <p className="text-sm text-amber-600">Nenhuma conta padrão configurada</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Contas com Despesas Vinculadas:</h4>
            <div className="space-y-1">
              {result.linked_accounts.length > 0 ? (
                result.linked_accounts.map(acc => (
                  <div key={acc.id} className="text-sm text-muted-foreground">
                    <span className="font-mono">{acc.code}</span> - {acc.name}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma despesa vinculada</p>
              )}
            </div>
          </div>
        </div>

        {result.discrepancies.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <h4 className="font-semibold text-sm text-red-800 mb-3">Discrepâncias Encontradas:</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Conta</TableHead>
                    <TableHead className="text-xs">Top-Level</TableHead>
                    <TableHead className="text-xs text-right">Qtd. Lançamentos</TableHead>
                    <TableHead className="text-xs text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.discrepancies.map(disc => (
                    <TableRow key={disc.account_id}>
                      <TableCell className="text-xs">
                        <div>
                          <span className="font-mono">{disc.account_code}</span>
                        </div>
                        <div className="text-muted-foreground text-xs">{disc.account_name}</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-red-600">
                        {disc.top_level_parent}
                      </TableCell>
                      <TableCell className="text-xs text-right">{disc.expense_count}</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        R$ {disc.total_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CostCenterAudit;
