import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, MapPin, Phone, Mail, Loader2, CheckCircle, AlertCircle, Plus, Trash2, TrendingUp, Database, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/data/expensesData";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ClientEnrichment = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [enrichmentData, setEnrichmentData] = useState<any>(null);
  const [payers, setPayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [kpis, setKpis] = useState({
    totalClients: 0,
    enrichedClients: 0,
    totalPayers: 0,
    enrichmentRate: 0
  });
  const [newPayer, setNewPayer] = useState({
    name: '',
    document: '',
    relationship: 'socio',
    notes: ''
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('status', 'active')
        .order('name') as any;

      if (error) throw error;
      
      // Buscar dados de enrichment e payers separadamente
      if (data && data.length > 0) {
        const clientIds = data.map((c: any) => c.id);
        
        const { data: enrichmentData } = await supabase
          .from('client_enrichment' as any)
          .select('*')
          .in('client_id', clientIds) as any;
        
        const { data: payersData } = await supabase
          .from('client_payers' as any)
          .select('*')
          .in('client_id', clientIds) as any;
        
        // Combinar dados
        const enrichedClients = data.map((client: any) => ({
          ...client,
          enrichment: enrichmentData?.find((e: any) => e.client_id === client.id),
          payers: payersData?.filter((p: any) => p.client_id === client.id) || []
        }));
        
        setClients(enrichedClients);
        
        // Calcular KPIs
        const totalClientsCount = enrichedClients.length;
        const enrichedClientsCount = enrichedClients.filter((c: any) => c.enrichment).length;
        const totalPayers = enrichedClients.reduce((acc: number, c: any) => acc + (c.payers?.length || 0), 0);
        const enrichmentRate = totalClientsCount > 0 ? (enrichedClientsCount / totalClientsCount) * 100 : 0;
        
        setKpis({
          totalClients: totalClientsCount,
          enrichedClients: enrichedClientsCount,
          totalPayers,
          enrichmentRate
        });
      } else {
        setClients([]);
        setKpis({
          totalClients: 0,
          enrichedClients: 0,
          totalPayers: 0,
          enrichmentRate: 0
        });
      }
    } catch (error: any) {
      toast.error('Erro ao carregar clientes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const enrichClient = async (client: any) => {
    if (!client.cnpj) {
      toast.error('Cliente não possui CNPJ cadastrado');
      return;
    }

    setEnriching(client.id);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-client-data', {
        body: {
          clientId: client.id,
          cnpj: client.cnpj
        }
      });

      if (error) throw error;

      toast.success(`Dados de ${client.name} enriquecidos com sucesso!`);
      await loadClients();
    } catch (error: any) {
      console.error('Erro ao enriquecer:', error);
      toast.error('Erro ao enriquecer dados: ' + error.message);
    } finally {
      setEnriching(null);
    }
  };

  const viewClientDetails = async (client: any) => {
    setSelectedClient(client);
    
    const { data: enrichment } = await supabase
      .from('client_enrichment' as any)
      .select('*')
      .eq('client_id', client.id)
      .single() as any;

    const { data: payersData } = await supabase
      .from('client_payers' as any)
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }) as any;

    setEnrichmentData(enrichment);
    setPayers(payersData || []);
  };

  const addPayer = async () => {
    if (!selectedClient || !newPayer.name) {
      toast.error('Preencha pelo menos o nome do pagador');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('client_payers' as any)
        .insert({
          client_id: selectedClient.id,
          payer_name: newPayer.name,
          payer_document: newPayer.document || null,
          relationship: newPayer.relationship,
          notes: newPayer.notes || null,
          created_by: userData.user?.id
        }) as any;

      if (error) throw error;

      toast.success('Pagador adicionado com sucesso!');
      setNewPayer({ name: '', document: '', relationship: 'socio', notes: '' });
      viewClientDetails(selectedClient);
      loadClients();
    } catch (error: any) {
      toast.error('Erro ao adicionar pagador: ' + error.message);
    }
  };

  const removePayer = async (payerId: string) => {
    try {
      const { error } = await supabase
        .from('client_payers' as any)
        .delete()
        .eq('id', payerId) as any;

      if (error) throw error;

      toast.success('Pagador removido com sucesso!');
      viewClientDetails(selectedClient);
      loadClients();
    } catch (error: any) {
      toast.error('Erro ao remover pagador: ' + error.message);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">📊 Enriquecimento de Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Conecte-se à Receita Federal e conheça melhor seus clientes
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalClients}</div>
              <p className="text-xs text-muted-foreground">Clientes cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Enriquecidos</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.enrichedClients}</div>
              <p className="text-xs text-muted-foreground">
                Com dados da Receita Federal
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Enriquecimento</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.enrichmentRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {kpis.totalClients - kpis.enrichedClients} pendentes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagadores Cadastrados</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalPayers}</div>
              <p className="text-xs text-muted-foreground">
                Sócios e representantes
              </p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Clientes Cadastrados</CardTitle>
              <CardDescription>
                Enriqueça os dados dos seus clientes com informações da Receita Federal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagadores</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.cnpj || '-'}</TableCell>
                      <TableCell>
                        {client.enrichment ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Enriquecido
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {client.payers?.length || 0} pagador(es)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => enrichClient(client)}
                            disabled={!client.cnpj || enriching === client.id}
                          >
                            {enriching === client.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Enriquecer'
                            )}
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => viewClientDetails(client)}
                              >
                                Ver Detalhes
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{selectedClient?.name}</DialogTitle>
                                <DialogDescription>
                                  Dados completos do cliente e seus pagadores
                                </DialogDescription>
                              </DialogHeader>

                              {enrichmentData && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Razão Social</Label>
                                      <p className="font-medium">{enrichmentData.razao_social}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
                                      <p className="font-medium">{enrichmentData.nome_fantasia || '-'}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Situação</Label>
                                      <p className="font-medium">{enrichmentData.situacao}</p>
                                    </div>
                                    <div>
                                      <Label className="text-xs text-muted-foreground">Porte</Label>
                                      <p className="font-medium">{enrichmentData.porte}</p>
                                    </div>
                                  </div>

                                  {enrichmentData.logradouro && (
                                    <div>
                                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        Endereço
                                      </Label>
                                      <p className="font-medium">
                                        {enrichmentData.logradouro}, {enrichmentData.numero}
                                        {enrichmentData.complemento && ` - ${enrichmentData.complemento}`}
                                        <br />
                                        {enrichmentData.bairro} - {enrichmentData.municipio}/{enrichmentData.uf}
                                        <br />
                                        CEP: {enrichmentData.cep}
                                      </p>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-4">
                                    {enrichmentData.telefone && (
                                      <div>
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Phone className="h-3 w-3" />
                                          Telefone
                                        </Label>
                                        <p className="font-medium">{enrichmentData.telefone}</p>
                                      </div>
                                    )}
                                    {enrichmentData.email && (
                                      <div>
                                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Mail className="h-3 w-3" />
                                          Email
                                        </Label>
                                        <p className="font-medium">{enrichmentData.email}</p>
                                      </div>
                                    )}
                                  </div>

                                  {enrichmentData.socios && enrichmentData.socios.length > 0 && (
                                    <div>
                                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        Sócios
                                      </Label>
                                      <div className="mt-2 space-y-2">
                                        {enrichmentData.socios.map((socio: any, idx: number) => (
                                          <Card key={idx}>
                                            <CardContent className="p-3">
                                              <p className="font-medium">{socio.nome}</p>
                                              <p className="text-sm text-muted-foreground">{socio.qualificacao}</p>
                                            </CardContent>
                                          </Card>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="mt-6">
                                <div className="flex items-center justify-between mb-4">
                                  <Label className="text-sm font-semibold">Pagadores Conhecidos</Label>
                                </div>

                                <div className="space-y-2 mb-4">
                                  {payers.map((payer) => (
                                    <Card key={payer.id}>
                                      <CardContent className="p-3 flex items-center justify-between">
                                        <div>
                                          <p className="font-medium">{payer.payer_name}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {payer.relationship} • {payer.payer_document || 'Sem documento'}
                                          </p>
                                          {payer.notes && (
                                            <p className="text-xs text-muted-foreground mt-1">{payer.notes}</p>
                                          )}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => removePayer(payer.id)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>

                                <Card className="border-dashed">
                                  <CardContent className="p-4">
                                    <Label className="text-sm font-semibold mb-3 block">Adicionar Novo Pagador</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label>Nome *</Label>
                                        <Input
                                          value={newPayer.name}
                                          onChange={(e) => setNewPayer({ ...newPayer, name: e.target.value })}
                                          placeholder="Nome do pagador"
                                        />
                                      </div>
                                      <div>
                                        <Label>CPF/CNPJ</Label>
                                        <Input
                                          value={newPayer.document}
                                          onChange={(e) => setNewPayer({ ...newPayer, document: e.target.value })}
                                          placeholder="Documento"
                                        />
                                      </div>
                                      <div>
                                        <Label>Relacionamento</Label>
                                        <Select
                                          value={newPayer.relationship}
                                          onValueChange={(value) => setNewPayer({ ...newPayer, relationship: value })}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="socio">Sócio</SelectItem>
                                            <SelectItem value="representante">Representante</SelectItem>
                                            <SelectItem value="responsavel">Responsável Financeiro</SelectItem>
                                            <SelectItem value="outro">Outro</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label>Observações</Label>
                                        <Input
                                          value={newPayer.notes}
                                          onChange={(e) => setNewPayer({ ...newPayer, notes: e.target.value })}
                                          placeholder="Observações"
                                        />
                                      </div>
                                    </div>
                                    <Button
                                      onClick={addPayer}
                                      className="w-full mt-3"
                                      size="sm"
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Adicionar Pagador
                                    </Button>
                                  </CardContent>
                                </Card>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ClientEnrichment;
