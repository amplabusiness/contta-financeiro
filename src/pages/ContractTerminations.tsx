import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Eye,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Send,
  FileWarning,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ContractTermination {
  id: string;
  termination_number: string;
  contract_id: string;
  client_id: string;
  termination_type: string;
  termination_reason: string;
  request_date: string;
  effective_date: string;
  pending_fees: number;
  total_settlement: number;
  settlement_status: string;
  status: string;
  created_at: string;
  clients?: { name: string; cnpj: string };
  accounting_contracts?: { contract_number: string };
}

interface Contract {
  id: string;
  contract_number: string;
  client_id: string;
  status: string;
  clients?: { name: string; cnpj: string };
}

const terminationTypes = {
  mutual_agreement: "Acordo Mútuo",
  client_request: "Solicitação do Cliente",
  accountant_request: "Solicitação do Contador",
  non_payment: "Inadimplência",
  company_closed: "Empresa Encerrada",
  company_suspended: "Empresa Suspensa",
  contract_breach: "Descumprimento Contratual",
  force_majeure: "Força Maior",
  other: "Outro Motivo",
};

const ContractTerminations = () => {
  const { toast } = useToast();
  const [terminations, setTerminations] = useState<ContractTermination[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewTermination, setShowNewTermination] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTermination, setSelectedTermination] = useState<ContractTermination | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [formData, setFormData] = useState({
    contract_id: "",
    termination_type: "client_request",
    termination_reason: "",
    detailed_justification: "",
    request_date: new Date().toISOString().split("T")[0],
    effective_date: "",
    notice_period_days: "30",
    pending_fees: "0",
    pending_months: "0",
    fine_amount: "0",
    discount_amount: "0",
    settlement_notes: "",
  });

  const fetchTerminations = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("contract_terminations")
        .select(`
          *,
          clients:client_id (name, cnpj),
          accounting_contracts:contract_id (contract_number)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTerminations(data || []);
    } catch (error) {
      console.error("Error fetching terminations:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchContracts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("accounting_contracts")
        .select(`
          id,
          contract_number,
          client_id,
          status,
          clients:client_id (name, cnpj)
        `)
        .eq("status", "active")
        .order("contract_number");

      if (error) throw error;
      setContracts(data || []);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    }
  }, []);

  useEffect(() => {
    fetchTerminations();
    fetchContracts();
  }, [fetchTerminations, fetchContracts]);

  const calculateEffectiveDate = (requestDate: string, noticeDays: number) => {
    const date = new Date(requestDate);
    date.setDate(date.getDate() + noticeDays);
    return date.toISOString().split("T")[0];
  };

  const calculateTotalSettlement = () => {
    const pending = parseFloat(formData.pending_fees) || 0;
    const fine = parseFloat(formData.fine_amount) || 0;
    const discount = parseFloat(formData.discount_amount) || 0;
    return pending + fine - discount;
  };

  const handleContractChange = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    setFormData({
      ...formData,
      contract_id: contractId,
      effective_date: calculateEffectiveDate(formData.request_date, parseInt(formData.notice_period_days)),
    });
  };

  const handleSaveTermination = async () => {
    try {
      const contract = contracts.find(c => c.id === formData.contract_id);
      if (!contract) {
        toast({
          title: "Selecione um contrato",
          variant: "destructive",
        });
        return;
      }

      const terminationData = {
        contract_id: formData.contract_id,
        client_id: contract.client_id,
        termination_type: formData.termination_type,
        termination_reason: formData.termination_reason,
        detailed_justification: formData.detailed_justification,
        request_date: formData.request_date,
        effective_date: formData.effective_date || calculateEffectiveDate(formData.request_date, parseInt(formData.notice_period_days)),
        notice_period_days: parseInt(formData.notice_period_days),
        pending_fees: parseFloat(formData.pending_fees) || 0,
        pending_months: parseInt(formData.pending_months) || 0,
        fine_amount: parseFloat(formData.fine_amount) || 0,
        discount_amount: parseFloat(formData.discount_amount) || 0,
        total_settlement: calculateTotalSettlement(),
        settlement_notes: formData.settlement_notes,
        status: "draft",
        settlement_status: "pending",
      };

      const { data, error } = await supabase
        .from("contract_terminations")
        .insert(terminationData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Distrato criado",
        description: `Distrato ${data.termination_number} criado com sucesso.`,
      });

      setShowNewTermination(false);
      resetForm();
      fetchTerminations();
    } catch (error) {
      console.error("Error saving termination:", error);
      toast({
        title: "Erro ao salvar distrato",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleExecuteTermination = async (termination: ContractTermination) => {
    try {
      // Atualizar status do distrato
      const { error: termError } = await supabase
        .from("contract_terminations")
        .update({
          status: "completed",
          signature_status: "notified_only",
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq("id", termination.id);

      if (termError) throw termError;

      // Atualizar status do contrato
      const { error: contractError } = await supabase
        .from("accounting_contracts")
        .update({
          status: "terminated",
          termination_reason: termination.termination_reason,
          termination_date: termination.effective_date,
        })
        .eq("id", termination.contract_id);

      if (contractError) throw contractError;

      toast({
        title: "Distrato executado",
        description: "O contrato foi encerrado e o distrato finalizado.",
      });

      setShowConfirmDialog(false);
      setSelectedTermination(null);
      fetchTerminations();
      fetchContracts();
    } catch (error) {
      toast({
        title: "Erro ao executar distrato",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      contract_id: "",
      termination_type: "client_request",
      termination_reason: "",
      detailed_justification: "",
      request_date: new Date().toISOString().split("T")[0],
      effective_date: "",
      notice_period_days: "30",
      pending_fees: "0",
      pending_months: "0",
      fine_amount: "0",
      discount_amount: "0",
      settlement_notes: "",
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      draft: <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Rascunho</Badge>,
      pending_signature: <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Aguardando Assinatura</Badge>,
      signed: <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="w-3 h-3 mr-1" />Assinado</Badge>,
      notified: <Badge className="bg-purple-100 text-purple-800"><Send className="w-3 h-3 mr-1" />Notificado</Badge>,
      completed: <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Concluído</Badge>,
      cancelled: <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>,
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  const getSettlementBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      pending: <Badge variant="outline">Pendente</Badge>,
      partial: <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>,
      paid: <Badge className="bg-green-100 text-green-800">Quitado</Badge>,
      waived: <Badge className="bg-gray-100 text-gray-800">Dispensado</Badge>,
      negotiating: <Badge className="bg-blue-100 text-blue-800">Negociando</Badge>,
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <FileWarning className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Distratos</h1>
                    <p className="text-muted-foreground">
                      Resolução CFC 1.590/2020 - Rescisão formal obrigatória
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowNewTermination(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Distrato
                </Button>
              </div>
            </div>

            {/* Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-900">Obrigatoriedade Legal</h4>
                  <p className="text-sm text-amber-800">
                    Conforme Resolução CFC 1.590/2020, o rompimento do vínculo contratual implica a celebração
                    obrigatória de distrato entre as partes, com estabelecimento da cessação das responsabilidades.
                    Na impossibilidade de celebração do distrato, o contador deverá notificar o cliente.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{terminations.length}</div>
                  <p className="text-xs text-muted-foreground">Total de Distratos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600">
                    {terminations.filter(t => t.status === "draft" || t.status === "pending_signature").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {terminations.filter(t => t.status === "completed").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">
                    R$ {terminations
                      .filter(t => t.settlement_status === "pending")
                      .reduce((sum, t) => sum + Number(t.total_settlement), 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">Valores Pendentes</p>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Distratos Registrados</CardTitle>
                <CardDescription>
                  Rescisões de contratos conforme normas do CFC
                </CardDescription>
              </CardHeader>
              <CardContent>
                {terminations.length === 0 ? (
                  <div className="text-center py-12">
                    <FileWarning className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum distrato registrado</h3>
                    <p className="text-muted-foreground mb-4">
                      Registre distratos para formalizar rescisões contratuais
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Distrato</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Contrato</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Data Efetiva</TableHead>
                        <TableHead>Acerto</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {terminations.map((termination) => (
                        <TableRow key={termination.id}>
                          <TableCell className="font-mono text-sm">
                            {termination.termination_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {termination.clients?.name}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {termination.accounting_contracts?.contract_number}
                          </TableCell>
                          <TableCell>
                            {terminationTypes[termination.termination_type as keyof typeof terminationTypes]}
                          </TableCell>
                          <TableCell>
                            {new Date(termination.effective_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">
                                R$ {Number(termination.total_settlement).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </div>
                              {getSettlementBadge(termination.settlement_status)}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(termination.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTermination(termination);
                                  setShowPreview(true);
                                }}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              {termination.status === "draft" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => {
                                    setSelectedTermination(termination);
                                    setShowConfirmDialog(true);
                                  }}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* New Termination Dialog */}
            <Dialog open={showNewTermination} onOpenChange={setShowNewTermination}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Distrato</DialogTitle>
                  <DialogDescription>
                    Formalização de rescisão contratual conforme Resolução CFC 1.590/2020
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Contrato */}
                  <div className="space-y-2">
                    <Label>Contrato a Rescindir *</Label>
                    <Select
                      value={formData.contract_id}
                      onValueChange={handleContractChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts.map((contract) => (
                          <SelectItem key={contract.id} value={contract.id}>
                            {contract.contract_number} - {contract.clients?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Motivo */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Rescisão *</Label>
                      <Select
                        value={formData.termination_type}
                        onValueChange={(value) => setFormData({ ...formData, termination_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(terminationTypes).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Aviso Prévio (dias)</Label>
                      <Input
                        type="number"
                        value={formData.notice_period_days}
                        onChange={(e) => {
                          const days = parseInt(e.target.value) || 30;
                          setFormData({
                            ...formData,
                            notice_period_days: e.target.value,
                            effective_date: calculateEffectiveDate(formData.request_date, days),
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Motivo da Rescisão *</Label>
                    <Textarea
                      value={formData.termination_reason}
                      onChange={(e) => setFormData({ ...formData, termination_reason: e.target.value })}
                      placeholder="Descreva o motivo da rescisão..."
                      rows={2}
                    />
                  </div>

                  {/* Datas */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data da Solicitação</Label>
                      <Input
                        type="date"
                        value={formData.request_date}
                        onChange={(e) => {
                          const days = parseInt(formData.notice_period_days) || 30;
                          setFormData({
                            ...formData,
                            request_date: e.target.value,
                            effective_date: calculateEffectiveDate(e.target.value, days),
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Efetiva do Término</Label>
                      <Input
                        type="date"
                        value={formData.effective_date || calculateEffectiveDate(formData.request_date, parseInt(formData.notice_period_days))}
                        onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-semibold">Acerto Financeiro</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Honorários Pendentes (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.pending_fees}
                          onChange={(e) => setFormData({ ...formData, pending_fees: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Meses em Atraso</Label>
                        <Input
                          type="number"
                          value={formData.pending_months}
                          onChange={(e) => setFormData({ ...formData, pending_months: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Multa Contratual (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.fine_amount}
                          onChange={(e) => setFormData({ ...formData, fine_amount: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Desconto Concedido (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.discount_amount}
                          onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total do Acerto:</span>
                        <span className="text-xl font-bold">
                          R$ {calculateTotalSettlement().toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações do Acerto</Label>
                    <Textarea
                      value={formData.settlement_notes}
                      onChange={(e) => setFormData({ ...formData, settlement_notes: e.target.value })}
                      placeholder="Condições especiais, parcelamento..."
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowNewTermination(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTermination}>
                    Criar Distrato
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Distrato {selectedTermination?.termination_number}</DialogTitle>
                </DialogHeader>
                {selectedTermination && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Cliente</Label>
                        <p className="font-medium">{selectedTermination.clients?.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Contrato</Label>
                        <p className="font-medium">{selectedTermination.accounting_contracts?.contract_number}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Motivo</Label>
                        <p className="font-medium">
                          {terminationTypes[selectedTermination.termination_type as keyof typeof terminationTypes]}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Data Efetiva</Label>
                        <p className="font-medium">
                          {new Date(selectedTermination.effective_date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Descrição</Label>
                      <p className="text-sm">{selectedTermination.termination_reason}</p>
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span>Total do Acerto:</span>
                        <span className="text-xl font-bold">
                          R$ {Number(selectedTermination.total_settlement).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Fechar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Confirm Dialog */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Executar Distrato?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá encerrar o contrato {selectedTermination?.accounting_contracts?.contract_number} e
                    finalizar o distrato. O cliente será considerado notificado. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => selectedTermination && handleExecuteTermination(selectedTermination)}
                  >
                    Executar Distrato
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ContractTerminations;
