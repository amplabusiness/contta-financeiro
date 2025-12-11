import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Search,
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  FileText,
  Link2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface BoletoAgrupado {
  data_pagamento: string;
  quantidade_boletos: number;
  valor_total: number;
  reconciliados: number;
  pendentes: number;
  boletos: Array<{
    id: string;
    numero: string;
    cliente: string;
    valor: number;
    reconciled: boolean;
  }>;
}

interface TransacaoBancaria {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category_id: string | null;
}

export default function BoletosComposicao() {
  const [loading, setLoading] = useState(true);
  const [composicoes, setComposicoes] = useState<BoletoAgrupado[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [transacoesDia, setTransacoesDia] = useState<TransacaoBancaria[]>([]);
  const [showReconcileDialog, setShowReconcileDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBoletos, setSelectedBoletos] = useState<string[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    loadComposicoes();
  }, []);

  const loadComposicoes = async () => {
    setLoading(true);
    try {
      // Buscar boletos agrupados por data
      const { data: boletos, error } = await supabase
        .from('boletos_liquidados')
        .select('*')
        .order('data_pagamento', { ascending: false });

      if (error) throw error;

      // Agrupar por data
      const grouped = (boletos || []).reduce((acc, boleto) => {
        const date = boleto.data_pagamento;
        if (!acc[date]) {
          acc[date] = {
            data_pagamento: date,
            quantidade_boletos: 0,
            valor_total: 0,
            reconciliados: 0,
            pendentes: 0,
            boletos: [],
          };
        }
        acc[date].quantidade_boletos++;
        acc[date].valor_total += Number(boleto.valor_pago);
        if (boleto.reconciled) {
          acc[date].reconciliados++;
        } else {
          acc[date].pendentes++;
        }
        acc[date].boletos.push({
          id: boleto.id,
          numero: boleto.numero_boleto,
          cliente: boleto.client_name,
          valor: Number(boleto.valor_pago),
          reconciled: boleto.reconciled,
        });
        return acc;
      }, {} as Record<string, BoletoAgrupado>);

      setComposicoes(Object.values(grouped));

    } catch (error: any) {
      console.error("Erro ao carregar composições:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const loadTransacoesDia = async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .gte('transaction_date', `${date}T00:00:00`)
        .lt('transaction_date', `${date}T23:59:59`)
        .gt('amount', 0) // Apenas créditos
        .order('amount', { ascending: false });

      if (error) throw error;

      setTransacoesDia(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar transações:", error);
      toast.error("Erro ao carregar transações do dia");
    }
  };

  const handleOpenReconcile = async (date: string) => {
    setSelectedDate(date);
    setSelectedBoletos([]);
    setSelectedTransaction(null);
    await loadTransacoesDia(date);
    setShowReconcileDialog(true);
  };

  const handleReconcile = async () => {
    if (!selectedTransaction || selectedBoletos.length === 0) {
      toast.error("Selecione uma transação e pelo menos um boleto");
      return;
    }

    setReconciling(true);
    try {
      const { data, error } = await supabase.rpc(
        'reconcile_boletos_with_transaction' as any,
        {
          p_transaction_id: selectedTransaction,
          p_boleto_ids: selectedBoletos,
        }
      );

      if (error) throw error;

      const result = data?.[0];
      if (result?.success) {
        toast.success(result.message);
        setShowReconcileDialog(false);
        loadComposicoes();
      } else {
        toast.error(result?.message || "Erro na reconciliação");
      }
    } catch (error: any) {
      console.error("Erro na reconciliação:", error);
      toast.error(error.message || "Erro ao reconciliar");
    } finally {
      setReconciling(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const filteredComposicoes = composicoes.filter(c => {
    if (!dateFilter) return true;
    return c.data_pagamento.includes(dateFilter);
  });

  const totalBoletos = filteredComposicoes.reduce((sum, c) => sum + c.quantidade_boletos, 0);
  const totalValor = filteredComposicoes.reduce((sum, c) => sum + c.valor_total, 0);
  const totalReconciliados = filteredComposicoes.reduce((sum, c) => sum + c.reconciliados, 0);
  const totalPendentes = filteredComposicoes.reduce((sum, c) => sum + c.pendentes, 0);

  // Calcular total selecionado para reconciliação
  const selectedTotal = composicoes
    .find(c => c.data_pagamento === selectedDate)
    ?.boletos.filter(b => selectedBoletos.includes(b.id))
    .reduce((sum, b) => sum + b.valor, 0) || 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Composição Diária de Boletos</h1>
          <p className="text-muted-foreground mt-2">
            Visualize quais boletos compõem cada dia de recebimento - resolve o problema de agregação bancária
          </p>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{filteredComposicoes.length}</p>
                  <p className="text-xs text-muted-foreground">Dias</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{totalBoletos}</p>
                  <p className="text-xs text-muted-foreground">Boletos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalValor)}</p>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {totalReconciliados}/{totalBoletos}
                  </p>
                  <p className="text-xs text-muted-foreground">Reconciliados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtro */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por data (YYYY-MM-DD ou MM)"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={loadComposicoes} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
              </Button>
              <Button variant="outline" asChild>
                <a href="/import-boletos-liquidados">
                  <FileText className="h-4 w-4 mr-2" />
                  Importar Boletos
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de composições */}
        {loading ? (
          <Card>
            <CardContent className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        ) : filteredComposicoes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Nenhum boleto liquidado encontrado</p>
              <p className="text-sm text-muted-foreground mt-2">
                Importe os boletos liquidados do relatório bancário
              </p>
              <Button className="mt-4" asChild>
                <a href="/import-boletos-liquidados">Importar Boletos</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {filteredComposicoes.map((comp) => (
              <AccordionItem key={comp.data_pagamento} value={comp.data_pagamento} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <p className="font-semibold">
                          {new Date(comp.data_pagamento).toLocaleDateString("pt-BR", {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {comp.quantidade_boletos} boleto{comp.quantidade_boletos > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={comp.pendentes === 0 ? "default" : "secondary"}>
                        {comp.reconciliados}/{comp.quantidade_boletos} reconciliados
                      </Badge>
                      <span className="font-mono font-bold text-lg">
                        {formatCurrency(comp.valor_total)}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    {/* Tabela de boletos do dia */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº Boleto</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comp.boletos
                          .sort((a, b) => a.cliente.localeCompare(b.cliente))
                          .map((boleto) => (
                            <TableRow key={boleto.id}>
                              <TableCell className="font-mono text-xs">
                                {boleto.numero}
                              </TableCell>
                              <TableCell>{boleto.cliente}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(boleto.valor)}
                              </TableCell>
                              <TableCell className="text-center">
                                {boleto.reconciled ? (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Reconciliado
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pendente
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>

                    {/* Botão de reconciliação */}
                    {comp.pendentes > 0 && (
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleOpenReconcile(comp.data_pagamento)}
                          variant="outline"
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          Reconciliar com Extrato
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>

      {/* Dialog de reconciliação */}
      <Dialog open={showReconcileDialog} onOpenChange={setShowReconcileDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Reconciliar Boletos com Extrato
            </DialogTitle>
            <DialogDescription>
              Selecione os boletos e a transação bancária correspondente para reconciliar
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Boletos do dia */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Boletos do dia {selectedDate && new Date(selectedDate).toLocaleDateString("pt-BR")}
              </h3>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {composicoes
                  .find(c => c.data_pagamento === selectedDate)
                  ?.boletos.filter(b => !b.reconciled)
                  .map((boleto) => (
                    <div
                      key={boleto.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedBoletos.includes(boleto.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground'
                      }`}
                      onClick={() => {
                        setSelectedBoletos(prev =>
                          prev.includes(boleto.id)
                            ? prev.filter(id => id !== boleto.id)
                            : [...prev, boleto.id]
                        );
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{boleto.cliente}</p>
                          <p className="text-xs text-muted-foreground">Boleto: {boleto.numero}</p>
                        </div>
                        <span className="font-mono font-medium">
                          {formatCurrency(boleto.valor)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {selectedBoletos.length > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{selectedBoletos.length} boleto(s) selecionado(s)</span>
                    <span className="font-mono font-bold">{formatCurrency(selectedTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Transações do dia */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Transações Bancárias (Créditos)
              </h3>

              {transacoesDia.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                  Nenhuma transação de crédito encontrada para este dia
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {transacoesDia.map((tx) => (
                    <div
                      key={tx.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTransaction === tx.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground'
                      }`}
                      onClick={() => setSelectedTransaction(tx.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]" title={tx.description}>
                            {tx.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.category_id ? "Classificado" : "Não classificado"}
                          </p>
                        </div>
                        <span className="font-mono font-medium text-green-600">
                          +{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comparação de valores */}
          {selectedBoletos.length > 0 && selectedTransaction && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Boletos</p>
                  <p className="font-mono font-bold text-lg">{formatCurrency(selectedTotal)}</p>
                </div>
                <ArrowRight className="h-5 w-5" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Transação</p>
                  <p className="font-mono font-bold text-lg">
                    {formatCurrency(transacoesDia.find(t => t.id === selectedTransaction)?.amount || 0)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Diferença</p>
                  <p className={`font-mono font-bold text-lg ${
                    Math.abs(selectedTotal - (transacoesDia.find(t => t.id === selectedTransaction)?.amount || 0)) < 0.01
                      ? 'text-green-600'
                      : 'text-yellow-600'
                  }`}>
                    {formatCurrency(Math.abs(selectedTotal - (transacoesDia.find(t => t.id === selectedTransaction)?.amount || 0)))}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowReconcileDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleReconcile}
              disabled={reconciling || selectedBoletos.length === 0 || !selectedTransaction}
            >
              {reconciling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reconciliando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Reconciliar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
