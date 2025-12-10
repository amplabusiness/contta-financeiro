import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Eye,
  Send,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ResponsibilityLetter {
  id: string;
  letter_number: string;
  contract_id: string | null;
  client_id: string;
  reference_year: number;
  administrator_name: string;
  administrator_cpf: string;
  administrator_role: string;
  declarations: any[];
  status: string;
  signature_status: string;
  refusal_reason: string | null;
  safeguards_adopted: string | null;
  created_at: string;
  clients?: { name: string; cnpj: string };
}

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
}

// Declarações padrão conforme ITG 1000
const defaultDeclarations = [
  {
    code: "D1",
    text: "Reconheço minha responsabilidade pela elaboração e adequada apresentação das demonstrações contábeis de acordo com as práticas contábeis adotadas no Brasil e pelos controles internos que determinei como necessários para permitir a elaboração de demonstrações contábeis livres de distorção relevante, independentemente se causada por fraude ou erro.",
    required: true,
  },
  {
    code: "D2",
    text: "Confirmo que todas as transações foram devidamente registradas e estão refletidas nas demonstrações contábeis, e que forneci ao contador todas as informações relevantes de que tenho conhecimento.",
    required: true,
  },
  {
    code: "D3",
    text: "Declaro que não tenho conhecimento de qualquer fraude ou suspeita de fraude envolvendo a administração, empregados com funções significativas nos controles internos, ou outros que possam ter efeito relevante sobre as demonstrações contábeis.",
    required: true,
  },
  {
    code: "D4",
    text: "Confirmo a integridade e completude das informações fornecidas relativas à identificação de partes relacionadas e de todas as transações com essas partes das quais tenho conhecimento.",
    required: true,
  },
  {
    code: "D5",
    text: "Declaro ciência das minhas responsabilidades legais e tributárias perante os órgãos fiscalizadores e que todas as informações prestadas são verdadeiras e de minha inteira responsabilidade.",
    required: true,
  },
  {
    code: "D6",
    text: "Confirmo que a entidade cumpriu todos os aspectos contratuais que poderiam ter efeito relevante sobre as demonstrações contábeis no caso de descumprimento.",
    required: false,
  },
  {
    code: "D7",
    text: "Declaro que não há eventos subsequentes à data das demonstrações contábeis que requeiram ajuste ou divulgação nas demonstrações contábeis.",
    required: false,
  },
];

const ResponsibilityLetters = () => {
  const { toast } = useToast();
  const [letters, setLetters] = useState<ResponsibilityLetter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewLetter, setShowNewLetter] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<ResponsibilityLetter | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    client_id: "",
    reference_year: currentYear.toString(),
    administrator_name: "",
    administrator_cpf: "",
    administrator_role: "Sócio-Administrador",
    notes: "",
  });
  const [selectedDeclarations, setSelectedDeclarations] = useState<any[]>(
    defaultDeclarations.map(d => ({ ...d, accepted: d.required }))
  );

  const fetchLetters = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("responsibility_letters")
        .select(`
          *,
          clients:client_id (name, cnpj)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLetters(data || []);
    } catch (error) {
      console.error("Error fetching letters:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, cnpj")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  }, []);

  useEffect(() => {
    fetchLetters();
    fetchClients();
  }, [fetchLetters, fetchClients]);

  const handleDeclarationToggle = (index: number) => {
    const newDeclarations = [...selectedDeclarations];
    if (!newDeclarations[index].required) {
      newDeclarations[index].accepted = !newDeclarations[index].accepted;
      setSelectedDeclarations(newDeclarations);
    }
  };

  const handleSaveLetter = async () => {
    try {
      if (!formData.client_id || !formData.administrator_name || !formData.administrator_cpf) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        return;
      }

      const acceptedDeclarations = selectedDeclarations.filter(d => d.accepted);

      const letterData = {
        client_id: formData.client_id,
        reference_year: parseInt(formData.reference_year),
        reference_start_date: `${formData.reference_year}-01-01`,
        reference_end_date: `${formData.reference_year}-12-31`,
        administrator_name: formData.administrator_name,
        administrator_cpf: formData.administrator_cpf,
        administrator_role: formData.administrator_role,
        declarations: acceptedDeclarations,
        notes: formData.notes,
        status: "draft",
        signature_status: "pending",
      };

      const { data, error } = await supabase
        .from("responsibility_letters")
        .insert(letterData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Carta criada",
        description: `Carta ${data.letter_number} criada com sucesso.`,
      });

      setShowNewLetter(false);
      resetForm();
      fetchLetters();
    } catch (error) {
      console.error("Error saving letter:", error);
      toast({
        title: "Erro ao salvar carta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleSendLetter = async (letter: ResponsibilityLetter) => {
    try {
      const { error } = await supabase
        .from("responsibility_letters")
        .update({
          status: "sent",
          signature_status: "sent",
        })
        .eq("id", letter.id);

      if (error) throw error;

      toast({
        title: "Carta enviada",
        description: "A carta foi enviada para assinatura.",
      });

      fetchLetters();
    } catch (error) {
      toast({
        title: "Erro ao enviar carta",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsSigned = async (letter: ResponsibilityLetter) => {
    try {
      const { error } = await supabase
        .from("responsibility_letters")
        .update({
          status: "signed",
          signature_status: "signed",
          signed_at: new Date().toISOString(),
        })
        .eq("id", letter.id);

      if (error) throw error;

      toast({
        title: "Carta assinada",
        description: "A carta foi marcada como assinada.",
      });

      fetchLetters();
    } catch (error) {
      toast({
        title: "Erro ao atualizar carta",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsRefused = async (letter: ResponsibilityLetter, reason: string) => {
    try {
      const { error } = await supabase
        .from("responsibility_letters")
        .update({
          status: "refused",
          signature_status: "refused",
          refusal_date: new Date().toISOString().split("T")[0],
          refusal_reason: reason,
        })
        .eq("id", letter.id);

      if (error) throw error;

      toast({
        title: "Recusa registrada",
        description: "A recusa foi registrada. Adote as salvaguardas necessárias.",
        variant: "destructive",
      });

      fetchLetters();
    } catch (error) {
      toast({
        title: "Erro ao registrar recusa",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: "",
      reference_year: currentYear.toString(),
      administrator_name: "",
      administrator_cpf: "",
      administrator_role: "Sócio-Administrador",
      notes: "",
    });
    setSelectedDeclarations(defaultDeclarations.map(d => ({ ...d, accepted: d.required })));
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, JSX.Element> = {
      draft: <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Rascunho</Badge>,
      sent: <Badge className="bg-blue-100 text-blue-800"><Send className="w-3 h-3 mr-1" />Enviada</Badge>,
      signed: <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Assinada</Badge>,
      refused: <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Recusada</Badge>,
      archived: <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" />Arquivada</Badge>,
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  // Clientes que ainda não têm carta do ano atual
  const clientsWithoutLetter = clients.filter(client =>
    !letters.some(letter =>
      letter.client_id === client.id &&
      letter.reference_year === currentYear &&
      letter.status !== "refused"
    )
  );

  const filteredLetters = letters.filter(letter => {
    if (activeTab === "pending") return letter.status === "draft" || letter.status === "sent";
    if (activeTab === "signed") return letter.status === "signed";
    if (activeTab === "refused") return letter.status === "refused";
    if (activeTab === "all") return true;
    return true;
  });

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
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold">Carta de Responsabilidade</h1>
                    <p className="text-muted-foreground">
                      ITG 1000 - Documento anual obrigatório para encerramento do exercício
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowNewLetter(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Carta
                </Button>
              </div>
            </div>

            {/* Alert - Clientes pendentes */}
            {clientsWithoutLetter.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-900">
                      {clientsWithoutLetter.length} cliente(s) sem Carta de Responsabilidade em {currentYear}
                    </h4>
                    <p className="text-sm text-amber-800">
                      Conforme ITG 1000, o contratante deve fornecer anualmente a Carta de Responsabilidade
                      da Administração para fins de encerramento do exercício.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{letters.filter(l => l.reference_year === currentYear).length}</div>
                  <p className="text-xs text-muted-foreground">Cartas {currentYear}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-yellow-600">
                    {letters.filter(l => l.reference_year === currentYear && (l.status === "draft" || l.status === "sent")).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {letters.filter(l => l.reference_year === currentYear && l.status === "signed").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Assinadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">
                    {letters.filter(l => l.reference_year === currentYear && l.status === "refused").length}
                  </div>
                  <p className="text-xs text-muted-foreground">Recusadas</p>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="pending">Pendentes</TabsTrigger>
                    <TabsTrigger value="signed">Assinadas</TabsTrigger>
                    <TabsTrigger value="refused">Recusadas</TabsTrigger>
                    <TabsTrigger value="all">Todas</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {filteredLetters.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma carta encontrada</h3>
                    <p className="text-muted-foreground mb-4">
                      Crie cartas de responsabilidade para seus clientes
                    </p>
                    <Button onClick={() => setShowNewLetter(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Carta
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº Carta</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Ano Ref.</TableHead>
                        <TableHead>Administrador</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLetters.map((letter) => (
                        <TableRow key={letter.id}>
                          <TableCell className="font-mono text-sm">
                            {letter.letter_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {letter.clients?.name}
                          </TableCell>
                          <TableCell>{letter.reference_year}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{letter.administrator_name}</div>
                              <div className="text-xs text-muted-foreground">{letter.administrator_role}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(letter.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedLetter(letter);
                                  setShowPreview(true);
                                }}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              {letter.status === "draft" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSendLetter(letter)}
                                >
                                  <Send className="w-3 h-3" />
                                </Button>
                              )}
                              {letter.status === "sent" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600"
                                  onClick={() => handleMarkAsSigned(letter)}
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

            {/* New Letter Dialog */}
            <Dialog open={showNewLetter} onOpenChange={setShowNewLetter}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nova Carta de Responsabilidade da Administração</DialogTitle>
                  <DialogDescription>
                    Conforme ITG 1000, o contratante deve fornecer esta carta anualmente para encerramento do exercício
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Cliente e Ano */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cliente *</Label>
                      <Select
                        value={formData.client_id}
                        onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
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
                    <div className="space-y-2">
                      <Label>Ano de Referência *</Label>
                      <Select
                        value={formData.reference_year}
                        onValueChange={(value) => setFormData({ ...formData, reference_year: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                          <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Administrador */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h4 className="font-semibold">Responsável pela Administração</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Nome Completo *</Label>
                        <Input
                          value={formData.administrator_name}
                          onChange={(e) => setFormData({ ...formData, administrator_name: e.target.value })}
                          placeholder="Nome do administrador"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CPF *</Label>
                        <Input
                          value={formData.administrator_cpf}
                          onChange={(e) => setFormData({ ...formData, administrator_cpf: e.target.value })}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo/Função</Label>
                        <Select
                          value={formData.administrator_role}
                          onValueChange={(value) => setFormData({ ...formData, administrator_role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sócio-Administrador">Sócio-Administrador</SelectItem>
                            <SelectItem value="Administrador">Administrador</SelectItem>
                            <SelectItem value="Diretor">Diretor</SelectItem>
                            <SelectItem value="Presidente">Presidente</SelectItem>
                            <SelectItem value="Titular">Titular (EI)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Declarações */}
                  <div className="space-y-2">
                    <Label>Declarações do Administrador</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Declarações obrigatórias estão marcadas e não podem ser desmarcadas
                    </p>
                    <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                      {selectedDeclarations.map((declaration, index) => (
                        <div key={declaration.code} className="flex items-start gap-3 p-3">
                          <Checkbox
                            checked={declaration.accepted}
                            onCheckedChange={() => handleDeclarationToggle(index)}
                            disabled={declaration.required}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                                {declaration.code}
                              </span>
                              {declaration.required && (
                                <Badge variant="outline" className="text-xs">Obrigatória</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{declaration.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Observações */}
                  <div className="space-y-2">
                    <Label>Observações Adicionais</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Declarações específicas ou observações..."
                      rows={2}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowNewLetter(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveLetter}>
                    Criar Carta
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Carta {selectedLetter?.letter_number}</DialogTitle>
                </DialogHeader>
                {selectedLetter && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Cliente</Label>
                        <p className="font-medium">{selectedLetter.clients?.name}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Ano de Referência</Label>
                        <p className="font-medium">{selectedLetter.reference_year}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Administrador</Label>
                        <p className="font-medium">{selectedLetter.administrator_name}</p>
                        <p className="text-sm text-muted-foreground">{selectedLetter.administrator_role}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <div className="mt-1">{getStatusBadge(selectedLetter.status)}</div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-muted-foreground">Declarações</Label>
                      <div className="mt-2 space-y-2">
                        {selectedLetter.declarations?.map((declaration: any, index: number) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{declaration.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedLetter.status === "refused" && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-semibold text-red-900 mb-2">Carta Recusada</h4>
                        <p className="text-sm text-red-800">
                          <strong>Motivo:</strong> {selectedLetter.refusal_reason || "Não informado"}
                        </p>
                        {selectedLetter.safeguards_adopted && (
                          <p className="text-sm text-red-800 mt-2">
                            <strong>Salvaguardas adotadas:</strong> {selectedLetter.safeguards_adopted}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPreview(false)}>
                    Fechar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ResponsibilityLetters;
