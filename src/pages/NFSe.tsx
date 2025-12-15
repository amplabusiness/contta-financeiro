import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Send, Search, XCircle, RefreshCw, Plus, Settings, Download, Eye, Building2, User, MapPin, Calculator, Hash, CheckCircle2, AlertCircle, Clock, Zap, FileCode, Users } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

// Códigos de Serviço da Lista de Serviços (LC 116/2003) - Contabilidade
const CODIGOS_SERVICO = [
  { codigo: '17.01', cnae: '6920601', descricao: 'Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista; análise, exame, pesquisa, coleta, compilação e fornecimento de dados e informações de qualquer natureza, inclusive cadastro e similares' },
  { codigo: '17.02', cnae: '6920601', descricao: 'Datilografia, digitação, estenografia, expediente, secretaria em geral, resposta audível, redação, edição, interpretação, revisão, tradução, apoio e infra-estrutura administrativa e congêneres' },
  { codigo: '17.19', cnae: '6920602', descricao: 'Contabilidade, inclusive serviços técnicos e auxiliares' },
  { codigo: '17.20', cnae: '6920601', descricao: 'Assessoria, análise, avaliação, atendimento, consulta, cadastro, seleção, gerenciamento de informações, administração de contas a receber ou a pagar e em geral, relacionados a operações de faturamento' },
  { codigo: '25.01', cnae: '6621501', descricao: 'Serviços de apoio técnico, administrativo, jurídico, contábil, comercial e congêneres, relacionados à cobrança de dívidas' },
  { codigo: '18.01', cnae: '7020400', descricao: 'Serviços de regulação de sinistros vinculados a contrato de seguro; inspeção e avaliação de riscos para cobertura de contratos de seguros; prevenção e gerência de riscos seguráveis e congêneres' }
];

// Código padrão para contabilidade
const SERVICO_CONTABILIDADE = CODIGOS_SERVICO.find(s => s.codigo === '17.19') || CODIGOS_SERVICO[0];

// Município padrão (Goiânia)
const MUNICIPIO_GOIANIA = {
  codigo: '5208707',
  nome: 'GOIANIA',
  uf: 'GO'
};

interface NFSe {
  id: string;
  numero_nfse: string | null;
  codigo_verificacao: string | null;
  numero_rps: string;
  serie_rps: string;
  status: string;
  protocolo: string | null;
  data_emissao: string;
  competencia: string;
  data_autorizacao: string | null;
  prestador_cnpj: string;
  prestador_inscricao_municipal: string | null;
  prestador_razao_social: string | null;
  tomador_razao_social: string;
  tomador_cnpj: string | null;
  tomador_cpf: string | null;
  tomador_email: string | null;
  tomador_endereco: string | null;
  tomador_numero: string | null;
  tomador_complemento: string | null;
  tomador_bairro: string | null;
  tomador_cidade: string | null;
  tomador_uf: string | null;
  tomador_cep: string | null;
  valor_servicos: number;
  valor_deducoes: number;
  valor_pis: number;
  valor_cofins: number;
  valor_inss: number;
  valor_ir: number;
  valor_csll: number;
  outras_retencoes: number;
  valor_iss: number;
  aliquota: number;
  desconto_incondicionado: number;
  desconto_condicionado: number;
  valor_liquido: number;
  iss_retido: boolean;
  discriminacao: string;
  item_lista_servico: string | null;
  codigo_cnae: string | null;
  codigo_municipio: string | null;
  codigo_erro: string | null;
  mensagem_erro: string | null;
  invoice_id: string | null;
  client_id: string | null;
  xml_rps: string | null;
  xml_nfse: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  document: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  monthly_fee: number;
  status: string;
}

interface NFSeConfig {
  id: string;
  ambiente: string;
  prestador_cnpj: string;
  prestador_razao_social: string;
  prestador_inscricao_municipal: string;
  serie_rps_padrao: string;
  aliquota_padrao: number;
  descricao_servico_padrao: string;
  ultimo_numero_rps: number;
}

export default function NFSe() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [nfses, setNfses] = useState<NFSe[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [config, setConfig] = useState<NFSeConfig | null>(null);
  const [showEmitirDialog, setShowEmitirDialog] = useState(false);
  const [showEmitirLoteDialog, setShowEmitirLoteDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDetalhesDialog, setShowDetalhesDialog] = useState(false);
  const [selectedNFSe, setSelectedNFSe] = useState<NFSe | null>(null);
  const [emitting, setEmitting] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('all');
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>(format(new Date(), 'yyyy-MM'));

  // Form de emissão manual
  const [formData, setFormData] = useState({
    client_id: '',
    valor_servicos: '',
    discriminacao: '',
    competencia: format(new Date(), 'yyyy-MM-dd'),
    aliquota: '0.02',
    codigo_servico: '17.19'
  });

  useEffect(() => {
    loadData();
  }, [filtroStatus, filtroCompetencia]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar configuração
      const { data: configData } = await supabase
        .from('nfse_config')
        .select('*')
        .single();

      if (configData) {
        setConfig(configData);
        setFormData(prev => ({
          ...prev,
          discriminacao: configData.descricao_servico_padrao || '',
          aliquota: String(configData.aliquota_padrao || 0.02)
        }));
      }

      // Carregar NFS-e
      let query = supabase
        .from('nfse')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtroStatus !== 'all') {
        query = query.eq('status', filtroStatus);
      }

      if (filtroCompetencia) {
        const [ano, mes] = filtroCompetencia.split('-');
        const inicioMes = `${ano}-${mes}-01`;
        const fimMes = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0];
        query = query.gte('competencia', inicioMes).lte('competencia', fimMes);
      }

      const { data: nfseData, error } = await query;

      if (error) throw error;
      setNfses(nfseData || []);

      // Carregar clientes com honorário > 0
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, document, email, address, city, state, zip_code, monthly_fee, status')
        .eq('status', 'active')
        .not('monthly_fee', 'is', null)
        .order('name');

      // Filtrar clientes com honorário > 0
      const clientesComHonorario = (clientsData || []).filter(c => c.monthly_fee && c.monthly_fee > 0);
      setClients(clientesComHonorario);

    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Emissão automática - só seleciona o cliente e emite
  const emitirAutomatico = async (client: Client) => {
    if (!config) {
      toast({
        title: 'Erro',
        description: 'Configuração não encontrada',
        variant: 'destructive'
      });
      return;
    }

    setEmitting(true);
    try {
      // Gerar próximo número de RPS
      const { data: rpsData, error: rpsError } = await supabase
        .rpc('proximo_numero_rps', { p_prestador_cnpj: config.prestador_cnpj });

      if (rpsError) throw rpsError;

      const numeroRps = String(rpsData || 1);
      const valorServicos = client.monthly_fee;
      const aliquota = config.aliquota_padrao;
      const valorIss = valorServicos * aliquota;

      // Discriminação automática detalhada
      const competenciaAtual = format(new Date(), 'MM/yyyy');
      const mesExtenso = format(new Date(), 'MMMM', { locale: ptBR }).toUpperCase();
      const anoAtual = format(new Date(), 'yyyy');
      const discriminacao = `SERVIÇOS DE CONTABILIDADE - COMPETÊNCIA ${mesExtenso}/${anoAtual}

Serviços prestados conforme contrato de prestação de serviços contábeis:
- Escrituração contábil e fiscal
- Apuração de impostos (IRPJ, CSLL, PIS, COFINS, ISS)
- Elaboração de balancetes e demonstrações contábeis
- Obrigações acessórias (SPED, DCTFWeb, EFD, etc.)
- Assessoria e consultoria contábil

Código do Serviço: ${SERVICO_CONTABILIDADE.codigo}
CNAE: ${SERVICO_CONTABILIDADE.cnae}`;

      // Criar registro da NFS-e
      const { data: nfse, error: insertError } = await supabase
        .from('nfse')
        .insert({
          numero_rps: numeroRps,
          serie_rps: config.serie_rps_padrao || 'A',
          status: 'pending',
          data_emissao: new Date().toISOString().split('T')[0],
          competencia: format(new Date(), 'yyyy-MM-dd'),
          prestador_cnpj: config.prestador_cnpj,
          prestador_inscricao_municipal: config.prestador_inscricao_municipal,
          prestador_razao_social: config.prestador_razao_social,
          tomador_cnpj: client.document?.replace(/\D/g, ''),
          tomador_razao_social: client.name,
          tomador_email: client.email,
          tomador_endereco: client.address,
          tomador_cidade: client.city,
          tomador_uf: client.state,
          tomador_cep: client.zip_code?.replace(/\D/g, ''),
          discriminacao: discriminacao,
          valor_servicos: valorServicos,
          aliquota: aliquota,
          valor_iss: valorIss,
          valor_liquido: valorServicos - valorIss,
          item_lista_servico: SERVICO_CONTABILIDADE.codigo,
          codigo_cnae: SERVICO_CONTABILIDADE.cnae,
          codigo_municipio: MUNICIPIO_GOIANIA.codigo,
          client_id: client.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'NFS-e criada',
        description: `RPS ${numeroRps} - ${client.name}`
      });

      // Chamar Edge Function para enviar ao webservice
      try {
        const { data: funcData, error: funcError } = await supabase.functions.invoke('nfse-emitir', {
          body: { nfse_id: nfse.id }
        });

        if (funcData?.protocolo) {
          // Salvar XML no Storage
          if (funcData.xml_rps) {
            await salvarXmlStorage(nfse.id, numeroRps, funcData.xml_rps, 'rps');
          }
          toast({
            title: 'Lote enviado',
            description: `Protocolo: ${funcData.protocolo}`
          });
        }
      } catch (funcErr: any) {
        console.error('Erro ao chamar Edge Function:', funcErr);
      }

      return nfse;

    } catch (error: any) {
      toast({
        title: 'Erro ao emitir NFS-e',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setEmitting(false);
    }
  };

  // Emissão em lote
  const emitirEmLote = async () => {
    if (selectedClients.length === 0) {
      toast({
        title: 'Selecione clientes',
        description: 'Selecione ao menos um cliente para emitir',
        variant: 'destructive'
      });
      return;
    }

    setEmitting(true);
    let sucesso = 0;
    let erro = 0;

    for (const clientId of selectedClients) {
      const client = clients.find(c => c.id === clientId);
      if (client) {
        const result = await emitirAutomatico(client);
        if (result) {
          sucesso++;
        } else {
          erro++;
        }
      }
    }

    toast({
      title: 'Emissão em lote finalizada',
      description: `${sucesso} emitidas com sucesso, ${erro} com erro`
    });

    setShowEmitirLoteDialog(false);
    setSelectedClients([]);
    setEmitting(false);
    loadData();
  };

  // Salvar XML no Storage
  const salvarXmlStorage = async (nfseId: string, numeroRps: string, xml: string, tipo: 'rps' | 'nfse' | 'cancelamento') => {
    try {
      const fileName = `${tipo}_${numeroRps}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xml`;
      const filePath = `nfse/${nfseId}/${fileName}`;

      const { error } = await supabase.storage
        .from('documentos')
        .upload(filePath, new Blob([xml], { type: 'application/xml' }), {
          contentType: 'application/xml',
          upsert: true
        });

      if (error) {
        console.error('Erro ao salvar XML no Storage:', error);
      }

      return filePath;
    } catch (err) {
      console.error('Erro ao salvar XML:', err);
      return null;
    }
  };

  // Download XML
  const downloadXml = async (nfse: NFSe, tipo: 'rps' | 'nfse') => {
    const xml = tipo === 'rps' ? nfse.xml_rps : nfse.xml_nfse;

    if (!xml) {
      toast({
        title: 'XML não disponível',
        description: `XML do ${tipo.toUpperCase()} não encontrado`,
        variant: 'destructive'
      });
      return;
    }

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tipo.toUpperCase()}_${nfse.numero_nfse || nfse.numero_rps}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download iniciado',
      description: `XML do ${tipo.toUpperCase()} baixado com sucesso`
    });
  };

  const handleEmitir = async () => {
    if (!formData.client_id || !formData.valor_servicos || !formData.discriminacao) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    setEmitting(true);
    try {
      const client = clients.find(c => c.id === formData.client_id);
      if (!client) throw new Error('Cliente não encontrado');

      const { data: rpsData, error: rpsError } = await supabase
        .rpc('proximo_numero_rps', { p_prestador_cnpj: config?.prestador_cnpj || '23893032000169' });

      if (rpsError) throw rpsError;

      const numeroRps = String(rpsData || 1);
      const valorServicos = parseFloat(formData.valor_servicos);
      const aliquota = parseFloat(formData.aliquota);
      const valorIss = valorServicos * aliquota;

      // Buscar código de serviço selecionado
      const servicoSelecionado = CODIGOS_SERVICO.find(s => s.codigo === formData.codigo_servico) || SERVICO_CONTABILIDADE;

      const { data: nfse, error: insertError } = await supabase
        .from('nfse')
        .insert({
          numero_rps: numeroRps,
          serie_rps: config?.serie_rps_padrao || 'A',
          status: 'pending',
          data_emissao: new Date().toISOString().split('T')[0],
          competencia: formData.competencia,
          prestador_cnpj: config?.prestador_cnpj || '23893032000169',
          prestador_inscricao_municipal: config?.prestador_inscricao_municipal || '6241034',
          prestador_razao_social: config?.prestador_razao_social || 'AMPLA CONTABILIDADE LTDA',
          tomador_cnpj: client.document?.replace(/\D/g, ''),
          tomador_razao_social: client.name,
          tomador_email: client.email,
          tomador_endereco: client.address,
          tomador_cidade: client.city,
          tomador_uf: client.state,
          tomador_cep: client.zip_code?.replace(/\D/g, ''),
          discriminacao: formData.discriminacao,
          valor_servicos: valorServicos,
          aliquota: aliquota,
          valor_iss: valorIss,
          valor_liquido: valorServicos - valorIss,
          item_lista_servico: servicoSelecionado.codigo,
          codigo_cnae: servicoSelecionado.cnae,
          codigo_municipio: MUNICIPIO_GOIANIA.codigo,
          client_id: client.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({
        title: 'NFS-e criada',
        description: `RPS ${numeroRps} criado. Enviando para o webservice...`
      });

      try {
        const { data: funcData, error: funcError } = await supabase.functions.invoke('nfse-emitir', {
          body: { nfse_id: nfse.id }
        });

        if (funcData?.protocolo) {
          toast({
            title: 'Lote enviado',
            description: `Protocolo: ${funcData.protocolo}`
          });
        }
      } catch (funcErr: any) {
        console.error('Erro ao chamar Edge Function:', funcErr);
      }

      setShowEmitirDialog(false);
      setFormData({
        client_id: '',
        valor_servicos: '',
        discriminacao: config?.descricao_servico_padrao || '',
        competencia: format(new Date(), 'yyyy-MM-dd'),
        aliquota: String(config?.aliquota_padrao || 0.02),
        codigo_servico: '17.19'
      });
      loadData();

    } catch (error: any) {
      toast({
        title: 'Erro ao emitir NFS-e',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setEmitting(false);
    }
  };

  const consultarStatus = async (nfse: NFSe) => {
    toast({
      title: 'Consultando...',
      description: `Consultando status da NFS-e ${nfse.numero_rps}`
    });
  };

  const cancelarNFSe = async (nfse: NFSe) => {
    if (!confirm(`Deseja realmente cancelar a NFS-e ${nfse.numero_nfse || nfse.numero_rps}?`)) {
      return;
    }
    toast({
      title: 'Cancelando...',
      description: 'Enviando solicitação de cancelamento'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any }> = {
      pending: { variant: 'secondary', label: 'Pendente', icon: Clock },
      processing: { variant: 'outline', label: 'Processando', icon: RefreshCw },
      authorized: { variant: 'default', label: 'Autorizada', icon: CheckCircle2 },
      cancelled: { variant: 'destructive', label: 'Cancelada', icon: XCircle },
      error: { variant: 'destructive', label: 'Erro', icon: AlertCircle }
    };
    const { variant, label, icon: Icon } = variants[status] || { variant: 'secondary', label: status, icon: Clock };
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCNPJ = (cnpj: string | null) => {
    if (!cnpj) return '-';
    const cleaned = cnpj.replace(/\D/g, '');
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cnpj;
  };

  const formatCEP = (cep: string | null) => {
    if (!cep) return '-';
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length === 8) {
      return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return cep;
  };

  // Gerar PDF da NFS-e
  const gerarPDF = (nfse: NFSe) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    // Cabeçalho
    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, pageWidth, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTA FISCAL DE SERVIÇOS ELETRÔNICA', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('NFS-e', pageWidth / 2, 25, { align: 'center' });

    if (nfse.numero_nfse) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Nº ${nfse.numero_nfse}`, pageWidth / 2, 35, { align: 'center' });
    } else {
      doc.setFontSize(10);
      doc.text(`RPS Nº ${nfse.numero_rps} - Série ${nfse.serie_rps}`, pageWidth / 2, 35, { align: 'center' });
    }

    y = 55;
    doc.setTextColor(0, 0, 0);

    const statusLabels: Record<string, string> = {
      pending: 'PENDENTE DE AUTORIZAÇÃO',
      processing: 'EM PROCESSAMENTO',
      authorized: 'AUTORIZADA',
      cancelled: 'CANCELADA',
      error: 'ERRO NA EMISSÃO'
    };

    doc.setFillColor(nfse.status === 'authorized' ? 34 : nfse.status === 'error' ? 220 : 108,
                      nfse.status === 'authorized' ? 139 : nfse.status === 'error' ? 53 : 117,
                      nfse.status === 'authorized' ? 34 : nfse.status === 'error' ? 69 : 125);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabels[nfse.status] || nfse.status.toUpperCase(), pageWidth / 2, y + 7, { align: 'center' });

    y += 20;
    doc.setTextColor(0, 0, 0);

    doc.setFillColor(248, 249, 250);
    doc.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, pageWidth - 2 * margin, 25, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Data de Emissão:', margin + 5, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.text(format(new Date(nfse.data_emissao), 'dd/MM/yyyy'), margin + 5, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.text('Competência:', margin + 50, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.text(format(new Date(nfse.competencia), 'MM/yyyy'), margin + 50, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.text('Código Verificação:', margin + 95, y + 8);
    doc.setFont('helvetica', 'bold');
    doc.text(nfse.codigo_verificacao || '-', margin + 95, y + 14);

    if (nfse.protocolo) {
      doc.setFont('helvetica', 'normal');
      doc.text('Protocolo:', margin + 145, y + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(nfse.protocolo.substring(0, 20), margin + 145, y + 14);
    }

    y += 35;

    doc.setFillColor(33, 37, 41);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESTADOR DE SERVIÇOS', margin + 5, y + 6);

    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(nfse.prestador_razao_social || 'AMPLA CONTABILIDADE LTDA', margin + 5, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`CNPJ: ${formatCNPJ(nfse.prestador_cnpj)}`, margin + 5, y + 12);
    doc.text(`Inscrição Municipal: ${nfse.prestador_inscricao_municipal || '6241034'}`, margin + 80, y + 12);

    y += 20;

    doc.setFillColor(33, 37, 41);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOMADOR DE SERVIÇOS', margin + 5, y + 6);

    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(nfse.tomador_razao_social, margin + 5, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const documento = nfse.tomador_cnpj || nfse.tomador_cpf;
    doc.text(`CNPJ/CPF: ${formatCNPJ(documento)}`, margin + 5, y + 12);

    if (nfse.tomador_email) {
      doc.text(`E-mail: ${nfse.tomador_email}`, margin + 80, y + 12);
    }

    const endereco = [
      nfse.tomador_endereco,
      nfse.tomador_numero ? `Nº ${nfse.tomador_numero}` : null,
      nfse.tomador_complemento,
      nfse.tomador_bairro
    ].filter(Boolean).join(', ');

    if (endereco) {
      doc.text(`Endereço: ${endereco}`, margin + 5, y + 18);
    }

    const cidadeUfCep = [
      nfse.tomador_cidade,
      nfse.tomador_uf,
      nfse.tomador_cep ? `CEP: ${formatCEP(nfse.tomador_cep)}` : null
    ].filter(Boolean).join(' - ');

    if (cidadeUfCep) {
      doc.text(cidadeUfCep, margin + 5, y + 24);
    }

    y += 35;

    doc.setFillColor(33, 37, 41);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DISCRIMINAÇÃO DOS SERVIÇOS', margin + 5, y + 6);

    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    const discriminacaoLines = doc.splitTextToSize(nfse.discriminacao, pageWidth - 2 * margin - 10);
    discriminacaoLines.forEach((line: string, index: number) => {
      doc.text(line, margin + 5, y + 6 + (index * 5));
    });

    y += 10 + (discriminacaoLines.length * 5);

    if (nfse.item_lista_servico) {
      doc.text(`Código do Serviço: ${nfse.item_lista_servico}`, margin + 5, y);
      y += 5;
    }
    if (nfse.codigo_cnae) {
      doc.text(`CNAE: ${nfse.codigo_cnae}`, margin + 5, y);
      y += 5;
    }

    y += 10;

    doc.setFillColor(33, 37, 41);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('VALORES', margin + 5, y + 6);

    y += 12;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);

    const col1 = margin + 5;
    const col2 = margin + 65;
    const col3 = margin + 125;

    doc.setFont('helvetica', 'normal');
    doc.text('Valor dos Serviços:', col1, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(nfse.valor_servicos), col1, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.text('Deduções:', col2, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(nfse.valor_deducoes), col2, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.text('Base de Cálculo:', col3, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(nfse.valor_servicos - (nfse.valor_deducoes || 0)), col3, y + 5);

    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.text(`Alíquota ISS: ${(nfse.aliquota * 100).toFixed(2)}%`, col1, y);
    doc.text(`PIS: ${formatCurrency(nfse.valor_pis)}`, col2, y);
    doc.text(`COFINS: ${formatCurrency(nfse.valor_cofins)}`, col3, y);

    y += 8;
    doc.text(`INSS: ${formatCurrency(nfse.valor_inss)}`, col1, y);
    doc.text(`IR: ${formatCurrency(nfse.valor_ir)}`, col2, y);
    doc.text(`CSLL: ${formatCurrency(nfse.valor_csll)}`, col3, y);

    y += 15;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Valor do ISS:', col1, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(nfse.valor_iss), col1 + 35, y);

    doc.setFont('helvetica', 'normal');
    doc.text('ISS Retido:', col2, y);
    doc.setFont('helvetica', 'bold');
    doc.text(nfse.iss_retido ? 'SIM' : 'NÃO', col2 + 28, y);

    y += 10;

    doc.setFillColor(34, 139, 34);
    doc.rect(margin, y, pageWidth - 2 * margin, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR LÍQUIDO:', margin + 10, y + 10);
    doc.setFontSize(14);
    doc.text(formatCurrency(nfse.valor_liquido || (nfse.valor_servicos - nfse.valor_iss)), pageWidth - margin - 10, y + 10, { align: 'right' });

    y += 25;

    doc.setTextColor(128, 128, 128);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Documento gerado pelo Sistema Ampla Contabilidade', pageWidth / 2, y, { align: 'center' });
    doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, pageWidth / 2, y + 4, { align: 'center' });

    const fileName = nfse.numero_nfse
      ? `NFSe_${nfse.numero_nfse}.pdf`
      : `RPS_${nfse.numero_rps}.pdf`;
    doc.save(fileName);

    toast({
      title: 'PDF gerado',
      description: `Arquivo ${fileName} baixado com sucesso`
    });
  };

  // Clientes que ainda não têm nota no mês atual
  const clientesSemNota = clients.filter(c => {
    const mesAtual = format(new Date(), 'yyyy-MM');
    return !nfses.some(n => n.client_id === c.id && n.competencia.startsWith(mesAtual));
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            NFS-e - Nota Fiscal de Serviços
          </h1>
          <p className="text-muted-foreground mt-1">
            Emissão automática e gerenciamento de notas fiscais
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button variant="outline" onClick={() => setShowEmitirLoteDialog(true)}>
            <Users className="h-4 w-4 mr-2" />
            Emitir em Lote
          </Button>
          <Button onClick={() => setShowEmitirDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Emitir Manual
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Autorizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {nfses.filter(n => n.status === 'authorized').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {nfses.filter(n => n.status === 'pending' || n.status === 'processing').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Com Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {nfses.filter(n => n.status === 'error').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Sem Nota (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {clientesSemNota.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Valor Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(nfses.filter(n => n.status === 'authorized').reduce((sum, n) => sum + (n.valor_servicos || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emissão Rápida - Clientes sem nota */}
      {clientesSemNota.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Emissão Rápida - Clientes sem nota em {format(new Date(), 'MMMM/yyyy', { locale: ptBR })}
            </CardTitle>
            <CardDescription>
              Clique no cliente para emitir automaticamente com valor do honorário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {clientesSemNota.slice(0, 10).map(client => (
                <Button
                  key={client.id}
                  variant="outline"
                  size="sm"
                  onClick={() => emitirAutomatico(client).then(() => loadData())}
                  disabled={emitting}
                  className="bg-white"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {client.name.substring(0, 25)}...
                  <Badge variant="secondary" className="ml-2">{formatCurrency(client.monthly_fee)}</Badge>
                </Button>
              ))}
              {clientesSemNota.length > 10 && (
                <Button variant="outline" size="sm" onClick={() => setShowEmitirLoteDialog(true)}>
                  +{clientesSemNota.length - 10} mais...
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="w-48">
              <Label>Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="authorized">Autorizada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label>Competência</Label>
              <Input
                type="month"
                value={filtroCompetencia}
                onChange={(e) => setFiltroCompetencia(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de NFS-e */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RPS/NFS-e</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Tomador</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>ISS</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : nfses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    Nenhuma NFS-e encontrada
                  </TableCell>
                </TableRow>
              ) : (
                nfses.map((nfse) => (
                  <TableRow key={nfse.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    setSelectedNFSe(nfse);
                    setShowDetalhesDialog(true);
                  }}>
                    <TableCell>
                      <div className="font-medium">
                        {nfse.numero_nfse ? `NFS-e ${nfse.numero_nfse}` : `RPS ${nfse.numero_rps}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Série {nfse.serie_rps}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{format(new Date(nfse.data_emissao), 'dd/MM/yyyy')}</div>
                      <div className="text-xs text-muted-foreground">
                        Comp. {format(new Date(nfse.competencia), 'MM/yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium max-w-[200px] truncate">{nfse.tomador_razao_social}</div>
                      <div className="text-xs text-muted-foreground">{formatCNPJ(nfse.tomador_cnpj)}</div>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(nfse.valor_servicos)}</TableCell>
                    <TableCell>{formatCurrency(nfse.valor_iss)}</TableCell>
                    <TableCell>
                      {getStatusBadge(nfse.status)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedNFSe(nfse); setShowDetalhesDialog(true); }} title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => gerarPDF(nfse)} title="Gerar PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                        {nfse.xml_rps && (
                          <Button variant="ghost" size="icon" onClick={() => downloadXml(nfse, 'rps')} title="Download XML RPS">
                            <FileCode className="h-4 w-4" />
                          </Button>
                        )}
                        {(nfse.status === 'pending' || nfse.status === 'processing') && (
                          <Button variant="ghost" size="icon" onClick={() => consultarStatus(nfse)} title="Consultar status">
                            <Search className="h-4 w-4" />
                          </Button>
                        )}
                        {nfse.status === 'authorized' && (
                          <Button variant="ghost" size="icon" onClick={() => cancelarNFSe(nfse)} title="Cancelar">
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Emitir em Lote */}
      <Dialog open={showEmitirLoteDialog} onOpenChange={setShowEmitirLoteDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Emitir NFS-e em Lote
            </DialogTitle>
            <DialogDescription>
              Selecione os clientes para emitir notas automaticamente com o valor do honorário
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                checked={selectedClients.length === clientesSemNota.length && clientesSemNota.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedClients(clientesSemNota.map(c => c.id));
                  } else {
                    setSelectedClients([]);
                  }
                }}
              />
              <Label className="font-medium">Selecionar todos ({clientesSemNota.length} clientes sem nota)</Label>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-2">
                {clientesSemNota.map(client => (
                  <div key={client.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg">
                    <Checkbox
                      checked={selectedClients.includes(client.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedClients([...selectedClients, client.id]);
                        } else {
                          setSelectedClients(selectedClients.filter(id => id !== client.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{client.name}</div>
                      <div className="text-xs text-muted-foreground">{formatCNPJ(client.document)}</div>
                    </div>
                    <Badge variant="outline">{formatCurrency(client.monthly_fee)}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedClients.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span>Clientes selecionados:</span>
                  <span className="font-bold">{selectedClients.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor total:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(clients.filter(c => selectedClients.includes(c.id)).reduce((sum, c) => sum + c.monthly_fee, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmitirLoteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={emitirEmLote} disabled={emitting || selectedClients.length === 0}>
              {emitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Emitindo...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Emitir {selectedClients.length} Notas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Emitir Manual */}
      <Dialog open={showEmitirDialog} onOpenChange={setShowEmitirDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Emitir NFS-e (Manual)
            </DialogTitle>
            <DialogDescription>
              Preencha os dados manualmente para emissão personalizada
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Cliente (Tomador) *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => {
                  const client = clients.find(c => c.id === value);
                  setFormData({
                    ...formData,
                    client_id: value,
                    valor_servicos: client ? String(client.monthly_fee) : ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} - {formatCurrency(client.monthly_fee)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Valor dos Serviços *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={formData.valor_servicos}
                  onChange={(e) => setFormData({ ...formData, valor_servicos: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Alíquota ISS (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.aliquota}
                  onChange={(e) => setFormData({ ...formData, aliquota: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Competência *</Label>
              <Input
                type="date"
                value={formData.competencia}
                onChange={(e) => setFormData({ ...formData, competencia: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Discriminação dos Serviços *</Label>
              <Textarea
                rows={4}
                placeholder="Descreva os serviços prestados..."
                value={formData.discriminacao}
                onChange={(e) => setFormData({ ...formData, discriminacao: e.target.value })}
              />
            </div>

            {formData.valor_servicos && (
              <Card className="bg-muted">
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor dos Serviços:</span>
                      <span className="font-medium">{formatCurrency(parseFloat(formData.valor_servicos) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ISS ({(parseFloat(formData.aliquota) * 100).toFixed(2)}%):</span>
                      <span className="font-medium text-red-600">
                        - {formatCurrency((parseFloat(formData.valor_servicos) || 0) * (parseFloat(formData.aliquota) || 0))}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-bold">Valor Líquido:</span>
                      <span className="font-bold text-green-600">
                        {formatCurrency(
                          (parseFloat(formData.valor_servicos) || 0) -
                          ((parseFloat(formData.valor_servicos) || 0) * (parseFloat(formData.aliquota) || 0))
                        )}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmitirDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEmitir} disabled={emitting}>
              {emitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Emitindo...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Emitir NFS-e
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes - Visualizador Rico */}
      <Dialog open={showDetalhesDialog} onOpenChange={setShowDetalhesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedNFSe?.numero_nfse
                ? `NFS-e Nº ${selectedNFSe.numero_nfse}`
                : `RPS Nº ${selectedNFSe?.numero_rps}`}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              {selectedNFSe && getStatusBadge(selectedNFSe.status)}
              {selectedNFSe?.codigo_verificacao && (
                <Badge variant="outline">Cód. Verificação: {selectedNFSe.codigo_verificacao}</Badge>
              )}
            </div>
          </DialogHeader>

          {selectedNFSe && (
            <div ref={printRef} className="space-y-6 py-4">
              {/* Cards de informação da nota */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Identificação da Nota
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Número RPS</Label>
                      <div className="font-medium">{selectedNFSe.numero_rps}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Série</Label>
                      <div className="font-medium">{selectedNFSe.serie_rps}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Número NFS-e</Label>
                      <div className="font-medium">{selectedNFSe.numero_nfse || '-'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Protocolo</Label>
                      <div className="font-medium text-xs break-all">{selectedNFSe.protocolo || '-'}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Data Emissão</Label>
                      <div className="font-medium">{format(new Date(selectedNFSe.data_emissao), 'dd/MM/yyyy')}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Competência</Label>
                      <div className="font-medium">{format(new Date(selectedNFSe.competencia), 'MM/yyyy')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Prestador */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Prestador de Serviços
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="font-medium text-lg">{selectedNFSe.prestador_razao_social}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">CNPJ: </span>
                        <span className="font-medium">{formatCNPJ(selectedNFSe.prestador_cnpj)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Inscrição Municipal: </span>
                        <span className="font-medium">{selectedNFSe.prestador_inscricao_municipal}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tomador */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Tomador de Serviços
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="font-medium text-lg">{selectedNFSe.tomador_razao_social}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">CNPJ/CPF: </span>
                        <span className="font-medium">{formatCNPJ(selectedNFSe.tomador_cnpj || selectedNFSe.tomador_cpf)}</span>
                      </div>
                      {selectedNFSe.tomador_email && (
                        <div>
                          <span className="text-muted-foreground">E-mail: </span>
                          <span className="font-medium">{selectedNFSe.tomador_email}</span>
                        </div>
                      )}
                    </div>
                    {(selectedNFSe.tomador_endereco || selectedNFSe.tomador_cidade) && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          {selectedNFSe.tomador_endereco && (
                            <div>{selectedNFSe.tomador_endereco}</div>
                          )}
                          <div>
                            {selectedNFSe.tomador_cidade && selectedNFSe.tomador_cidade}
                            {selectedNFSe.tomador_uf && ` - ${selectedNFSe.tomador_uf}`}
                            {selectedNFSe.tomador_cep && ` - CEP: ${formatCEP(selectedNFSe.tomador_cep)}`}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Discriminação */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Discriminação dos Serviços
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                    {selectedNFSe.discriminacao}
                  </div>
                </CardContent>
              </Card>

              {/* Valores */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Valores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <Label className="text-xs text-muted-foreground">Valor dos Serviços</Label>
                        <div className="text-xl font-bold">{formatCurrency(selectedNFSe.valor_servicos)}</div>
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <Label className="text-xs text-muted-foreground">ISS ({(selectedNFSe.aliquota * 100).toFixed(2)}%)</Label>
                        <div className="text-xl font-bold text-orange-600">{formatCurrency(selectedNFSe.valor_iss)}</div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                        <Label className="text-xs text-green-700">Valor Líquido</Label>
                        <div className="text-2xl font-bold text-green-700">
                          {formatCurrency(selectedNFSe.valor_liquido || (selectedNFSe.valor_servicos - selectedNFSe.valor_iss))}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Erro (se houver) */}
              {selectedNFSe.codigo_erro && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      Erro na Emissão
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-red-700">
                      <div className="font-bold">Código: {selectedNFSe.codigo_erro}</div>
                      <div className="mt-1">{selectedNFSe.mensagem_erro}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetalhesDialog(false)}>
              Fechar
            </Button>
            {selectedNFSe?.xml_rps && (
              <Button variant="outline" onClick={() => downloadXml(selectedNFSe, 'rps')}>
                <FileCode className="h-4 w-4 mr-2" />
                XML RPS
              </Button>
            )}
            {selectedNFSe && (
              <Button onClick={() => gerarPDF(selectedNFSe)}>
                <Download className="h-4 w-4 mr-2" />
                Gerar PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Configurações */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações NFS-e
            </DialogTitle>
          </DialogHeader>

          {config && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Ambiente</Label>
                <Badge variant={config.ambiente === 'producao' ? 'default' : 'secondary'} className="w-fit">
                  {config.ambiente === 'producao' ? 'Produção' : 'Homologação'}
                </Badge>
              </div>
              <Separator />
              <div className="grid gap-2">
                <Label>Prestador</Label>
                <div className="font-medium">{config.prestador_razao_social}</div>
                <div className="text-sm text-muted-foreground">CNPJ: {formatCNPJ(config.prestador_cnpj)}</div>
                <div className="text-sm text-muted-foreground">IM: {config.prestador_inscricao_municipal}</div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Série RPS</Label>
                  <div className="font-medium">{config.serie_rps_padrao}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Alíquota Padrão</Label>
                  <div className="font-medium">{(config.aliquota_padrao * 100).toFixed(2)}%</div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">Último RPS</Label>
                <div className="font-medium">{config.ultimo_numero_rps}</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
