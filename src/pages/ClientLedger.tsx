import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/data/expensesData";
import { toast } from "sonner";
import { useClient } from "@/contexts/ClientContext";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, AlertCircle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Histórico de Salário Mínimo
const MIN_WAGE_HISTORY: Record<number, number> = {
  2020: 1045,
  2021: 1100,
  2022: 1212,
  2023: 1320,
  2024: 1412,
  2025: 1509,
};

const getMinWage = (dateStr: string) => {
  const year = new Date(dateStr).getFullYear();
  return MIN_WAGE_HISTORY[year] || 1412;
};

const ClientLedger = () => {
  const { selectedClientId } = useClient();
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);

  // Filter State
  const [viewMode, setViewMode] = useState<'month' | 'range'>('month');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      setSelectedClient(selectedClientId);
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedClient) {
      loadLedger();
    }
  }, [selectedClient, viewMode, selectedPeriod, dateRange]);

  const loadClients = async () => {
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
  };

  const loadLedger = async () => {
    if (!selectedClient) return;
    
    setLoading(true);
    try {
        let startDateStr = '';
        let endDateStr = '';

        if (viewMode === 'month' && selectedPeriod) {
            const [y, m] = selectedPeriod.split('-');
            const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
            startDateStr = `${y}-${m}-01`;
            endDateStr = `${y}-${m}-${lastDay}`;
        } else if (viewMode === 'range' && dateRange.start && dateRange.end) {
            startDateStr = dateRange.start;
            endDateStr = dateRange.end;
        } else {
             setLoading(false);
             return; 
        }

        console.log(`Loading ledger for ${startDateStr} to ${endDateStr}`);

        // STRATEGY CHANGE: Fetch from INVOICES directly because client_ledger table is empty/unreliable
        
        const { data: invoices, error: invError } = await supabase
            .from("invoices")
            .select("*, bank_transactions(id)")
            .eq("client_id", selectedClient)
            .order("competence", { ascending: true });

        if (invError) throw invError;
        
        const ledgerLines = [];
        
        invoices.forEach(inv => {
            // Debit Date logic
            let debitDate = inv.created_at || new Date().toISOString();
            if (inv.competence) {
                const [m, y] = inv.competence.split('/');
                const lastDay = new Date(parseInt(y), parseInt(m), 0);
                // Use local date parts to avoid UTC shift causing 30th instead of 31st
                const year = lastDay.getFullYear();
                const month = String(lastDay.getMonth() + 1).padStart(2, '0');
                const day = String(lastDay.getDate()).padStart(2, '0');
                debitDate = `${year}-${month}-${day}`;
            }
            
            // Debit Entry (Issuance)
            ledgerLines.push({
                id: `debit-${inv.id}`,
                transaction_date: debitDate,
                description: inv.description || `Fatura Ref: ${inv.competence}`,
                notes: inv.notes,
                debit: inv.amount,
                credit: 0,
                invoice_id: inv,
                type: 'bill'
            });

            // Credit Entry (Payment)
            if (inv.status === 'paid' && inv.paid_date) {
                ledgerLines.push({
                    id: `credit-${inv.id}`,
                    transaction_date: inv.paid_date,
                    description: `Pagamento: ${inv.description}`,
                    notes: `Via ${inv.payment_method || 'N/D'}`,
                    debit: 0,
                    credit: inv.paid_amount || inv.amount, 
                    invoice_id: inv,
                    type: 'payment'
                });
            }
        });
        
        ledgerLines.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

        const filteredLines = [];
        let openingBalance = 0;
        let openingDebit = 0;
        let openingCredit = 0;

        for (const line of ledgerLines) {
            const lineDate = line.transaction_date;
            const effect = (line.debit || 0) - (line.credit || 0);
            
            if (lineDate < startDateStr) {
                openingBalance += effect;
                openingDebit += (line.debit || 0);
                openingCredit += (line.credit || 0);
            } else if (lineDate <= endDateStr) {
                filteredLines.push({ ...line }); 
            }
        }

        const finalLedger = [];
        // Add Opening Balance Row
        finalLedger.push({
            id: 'opening',
            transaction_date: startDateStr,
            description: 'Saldo Anterior',
            debit: 0,
            credit: 0,
            balance: openingBalance,
            isOpening: true,
            openingDetails: {
                totalDebit: openingDebit,
                totalCredit: openingCredit
            }
        });

        // Calculate visual running balance
        let currentBalance = openingBalance;
        const visualLines = filteredLines.map(line => {
             const effect = (line.debit || 0) - (line.credit || 0);
             currentBalance += effect;
             return { ...line, balance: currentBalance };
        });

        setLedger([...finalLedger, ...visualLines]);
        setBalance(currentBalance);
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao carregar razão do cliente");
    } finally {
      setLoading(false);
    }
  };

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

            <div className="pt-4 border-t mt-4">
               <div className="flex flex-col md:flex-row gap-4 items-end">
                 <div className="w-full md:w-auto">
                    <Label className="mb-2 block">Período de Visualização</Label>
                    <div className="flex items-center gap-2">
                         <Input 
                            type="date" 
                            className="w-40" 
                            value={dateRange.start} 
                            onChange={(e) => {
                                setDateRange(prev => ({...prev, start: e.target.value}));
                                setViewMode('range'); 
                            }} 
                         />
                         <span className="text-muted-foreground">até</span>
                         <Input 
                            type="date" 
                            className="w-40" 
                            value={dateRange.end} 
                            onChange={(e) => {
                                setDateRange(prev => ({...prev, end: e.target.value}));
                                setViewMode('range');
                            }} 
                         />
                    </div>
                 </div>
                 
                 <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                        const today = new Date();
                        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        setDateRange({
                            start: firstDay.toISOString().split('T')[0],
                            end: lastDay.toISOString().split('T')[0]
                        });
                    }}>Este Mês</Button>
                    <Button variant="outline" size="sm" onClick={() => {
                        const today = new Date();
                        const start = new Date(today.getFullYear(), 0, 1);
                        const end = new Date(today.getFullYear(), 11, 31);
                        setDateRange({
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                        });
                    }}>Este Ano</Button>
                    <Button variant="outline" size="sm" onClick={() => {
                        setDateRange({
                            start: '2020-01-01',
                            end: new Date().toISOString().split('T')[0]
                        });
                    }}>Tudo</Button>
                 </div>
               </div>
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
                        <TableHead>Competência / Descrição</TableHead>
                        <TableHead>Status / Pagamento</TableHead>
                        <TableHead>Valores (Multa/Juros)</TableHead>
                        <TableHead title="Valor vs Salário Mínimo">x SM</TableHead>
                        <TableHead className="text-right">Débito</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.map((entry) => {
                        const inv = entry.invoice_id;
                        const minWage = getMinWage(entry.transaction_date);
                        const smRatio = inv?.amount ? (inv.amount / minWage).toFixed(2) : ((entry.debit || 0) / minWage).toFixed(2);
                        
                        return (
                        <TableRow 
                            key={entry.id} 
                            className={`${entry.isOpening ? "bg-muted/50 font-medium cursor-pointer hover:bg-muted" : ""}`}
                            onClick={() => {
                                if (entry.isOpening) {
                                    // Calculate end date as the day before current start
                                    const currentStart = new Date(dateRange.start || new Date());
                                    currentStart.setDate(currentStart.getDate() - 1);
                                    
                                    setDateRange({
                                        start: '2020-01-01',
                                        end: currentStart.toISOString().split('T')[0]
                                    });
                                    setViewMode('range');
                                    toast.info("Exibindo histórico completo do saldo anterior");
                                }
                            }}
                        >
                          <TableCell className="whitespace-nowrap">
                            {new Date(entry.transaction_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div>
                                <div className="flex items-center gap-2">
                                  <div className="font-medium flex items-center gap-2">
                                      {entry.description}
                                      {/* Link para reconciliação bancária se houver */}
                                      {entry.invoice_id?.bank_transactions?.[0]?.id && (
                                          <TooltipProvider>
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-5 w-5 ml-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/bank-import?highlight=${entry.invoice_id.bank_transactions[0].id}`);
                                                        }}
                                                      >
                                                          <ExternalLink className="w-3 h-3 text-blue-500" />
                                                      </Button>
                                                  </TooltipTrigger>
                                                  <TooltipContent>Ir para lançamento bancário</TooltipContent>
                                              </Tooltip>
                                          </TooltipProvider>
                                      )}

                                      {entry.isOpening && entry.openingDetails && (
                                          <TooltipProvider>
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <Badge variant="outline" className="ml-2 cursor-help text-[10px] h-5">Detalhes</Badge>
                                                  </TooltipTrigger>
                                                  <TooltipContent>
                                                      <div className="text-xs space-y-1">
                                                          <p><strong>Composição do Saldo Inicial:</strong></p>
                                                          <p className="flex justify-between gap-4"><span>Total Faturado:</span> <span className="text-red-500">{formatCurrency(entry.openingDetails.totalDebit)}</span></p>
                                                          <p className="flex justify-between gap-4"><span>Total Pago:</span> <span className="text-green-500">{formatCurrency(entry.openingDetails.totalCredit)}</span></p>
                                                          <p className="text-muted-foreground italic text-[10px] mt-1">Clique na linha para ver o histórico completo</p>
                                                      </div>
                                                  </TooltipContent>
                                              </Tooltip>
                                          </TooltipProvider>
                                      )}
                                  </div>
                                  {inv?.competence && (
                                    <Badge variant="outline" className="text-xs">
                                        Ref: {(() => {
                                            const parts = inv.competence.split('/');
                                            if (parts.length === 2) {
                                                const [m, y] = parts;
                                                const d = new Date(parseInt(y), parseInt(m) - 1, 2);
                                                return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase();
                                            }
                                            return inv.competence;
                                        })()}
                                    </Badge>
                                  )}
                                </div>
                              {entry.notes && (
                                <p className="text-xs text-muted-foreground">{entry.notes}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {inv ? (
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                        {inv.status === 'paid' ? <CheckCircle2 className="w-4 h-4 text-green-500"/> : 
                                         inv.status === 'overdue' ? <AlertCircle className="w-4 h-4 text-red-500"/> :
                                         inv.status === 'open' ? <Clock className="w-4 h-4 text-yellow-500"/> : null}
                                        <span className="text-sm capitalize">{
                                            inv.status === 'paid' ? 'Pago' : 
                                            inv.status === 'overdue' ? 'Atrasado' :
                                            inv.status === 'open' ? 'Em Aberto' : inv.status
                                        }</span>
                                    </div>
                                    {inv.paid_date ? (
                                        <div className="text-xs text-muted-foreground">
                                            Pg: {new Date(inv.paid_date).toLocaleDateString('pt-BR')}
                                            {inv.payment_method && ` via ${inv.payment_method}`}
                                        </div>
                                    ) : inv.due_date ? (
                                        <div className="text-xs text-muted-foreground">
                                            Venc: {new Date(inv.due_date).toLocaleDateString('pt-BR')}
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {inv && (inv.fine_amount > 0 || inv.interest_amount > 0) ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <div className="flex flex-col text-xs text-muted-foreground cursor-help underline decoration-dotted">
                                                <span>Principal: {formatCurrency(inv.amount)}</span>
                                                <span className="text-red-500">+ M/J: {formatCurrency((inv.fine_amount||0) + (inv.interest_amount||0))}</span>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Multa: {formatCurrency(inv.fine_amount || 0)}</p>
                                            <p>Juros: {formatCurrency(inv.interest_amount || 0)}</p>
                                            <p>Principal: {formatCurrency(inv.amount)}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(Number(smRatio) > 0) ? (
                                <Badge variant="secondary" className="font-mono text-xs">
                                    {smRatio}x
                                </Badge>
                            ) : '-'}
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
                      );
                      })}
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
