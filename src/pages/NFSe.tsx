import { useState, useEffect, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAccounting } from '@/hooks/useAccounting';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FileText, Send, Search, XCircle, RefreshCw, Plus, Settings, Download, Eye, Building2, User, MapPin, Calculator, Hash, CheckCircle2, AlertCircle, Clock, Zap, FileCode, Users, Upload, FileUp, ArrowDownToLine, ArrowUpFromLine, Trash2, DollarSign, TrendingUp, Receipt, Info, FileX, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

// Códigos de Serviço da Lista de Serviços (LC 116/2003) - Contabilidade
const CODIGOS_SERVICO = [
  { codigo: '17.01', cnae: '6920601', descricao: 'Assessoria ou consultoria de qualquer natureza' },
  { codigo: '17.02', cnae: '6920601', descricao: 'Datilografia, digitação, estenografia, expediente' },
  { codigo: '17.19', cnae: '6920602', descricao: 'Contabilidade, inclusive serviços técnicos e auxiliares' },
  { codigo: '17.20', cnae: '6920601', descricao: 'Assessoria, análise, administração de contas' },
];

const SERVICO_CONTABILIDADE = CODIGOS_SERVICO.find(s => s.codigo === '17.19') || CODIGOS_SERVICO[0];

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

interface NFSeTomada {
  id: string;
  numero_nfse: string;
  codigo_verificacao: string | null;
  data_emissao: string | null;
  competencia: string | null;
  prestador_cnpj: string;
  prestador_cpf: string | null;
  prestador_razao_social: string | null;
  prestador_inscricao_municipal: string | null;
  prestador_endereco: string | null;
  prestador_municipio: string | null;
  prestador_uf: string | null;
  tomador_cnpj: string;
  tomador_razao_social: string | null;
  valor_servicos: number;
  valor_deducoes: number | null;
  valor_pis: number | null;
  valor_cofins: number | null;
  valor_inss: number | null;
  valor_ir: number | null;
  valor_csll: number | null;
  valor_iss: number | null;
  outras_retencoes: number | null;
  aliquota: number | null;
  valor_liquido: number | null;
  discriminacao: string | null;
  item_lista_servico: string | null;
  codigo_cnae: string | null;
  status: string;
  conta_pagar_id: string | null;
  supplier_id: string | null;
  created_at: string;
}

interface InvoiceForNFSe {
  id: string;
  client_id: string;
  competence: string;
  amount: number;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  created_by?: string | null;
  client?: Client | null;
}

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  cpf: string | null;
  email: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
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
  iss_fixo: number | null;
  usar_iss_fixo: boolean;
}

interface CodigoServicoLC116 {
  id: number;
  codigo: string;
  descricao: string;
  cnae_principal: string | null;
  aliquota_minima: number;
  aliquota_maxima: number;
  ativo: boolean;
}

export default function NFSe() {
  const { toast } = useToast();
  // Hook de contabilidade - OBRIGATÓRIO para lançamentos D/C (Dr. Cícero - NBC TG 26)
  const { registrarHonorario, registrarDespesa } = useAccounting({ showToasts: false, sourceModule: 'NFSe' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Estados de carregamento
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Estados de dados principais
  const [activeTab, setActiveTab] = useState('emitidas');
  const [nfses, setNfses] = useState<NFSe[]>([]);
  const [nfsesTomadas, setNfsesTomadas] = useState<NFSeTomada[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<InvoiceForNFSe[]>([]);
  const [config, setConfig] = useState<NFSeConfig | null>(null);
  const [codigosServico, setCodigosServico] = useState<CodigoServicoLC116[]>([]);
  const [selectedNFSe, setSelectedNFSe] = useState<NFSe | null>(null);
  const [selectedNFSeTomada, setSelectedNFSeTomada] = useState<NFSeTomada | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('all');
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [filtroEmissaoRapida, setFiltroEmissaoRapida] = useState<string>('');
  const [filtroStatusTomadas, setFiltroStatusTomadas] = useState<string>('all');
  const [filtroMesTomadas, setFiltroMesTomadas] = useState<string>('all');
  const [formData, setFormData] = useState({
    client_id: '',
    valor_servicos: '',
    discriminacao: '',
    competencia: format(new Date(), 'yyyy-MM-dd'),
    codigo_servico: '17.19',
    aliquota: '0'
  });
  const [uploadOptions, setUploadOptions] = useState({
    criarContasPagar: true,
    diasVencimento: 30
  });

  // Estados de diálogos
  const [showEmitirDialog, setShowEmitirDialog] = useState(false);
  const [showEmitirLoteDialog, setShowEmitirLoteDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showDetalhesDialog, setShowDetalhesDialog] = useState(false);
  const [showDetalhesTomadaDialog, setShowDetalhesTomadaDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // =====================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // =====================================================

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
          discriminacao: configData.descricao_servico_padrao || ''
        }));
      }

      // Carregar códigos de serviço
      const { data: codigosData } = await supabase
        .from('codigos_servico_lc116')
        .select('*')
        .eq('ativo', true)
        .order('codigo');

      if (codigosData) {
        setCodigosServico(codigosData);
      }

      // Carregar NFS-e emitidas
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

      // Carregar NFS-e tomadas (recebidas)
      let queryTomadas = supabase
        .from('nfse_tomadas')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtroStatusTomadas !== 'all') {
        queryTomadas = queryTomadas.eq('status', filtroStatusTomadas);
      }

      const { data: tomadasData } = await queryTomadas;
      setNfsesTomadas(tomadasData || []);

      // Carregar clientes ativos
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, cnpj, cpf, email, logradouro, numero, bairro, municipio, uf, cep, monthly_fee, status')
        .eq('status', 'active')
        .order('name');

      const clientesComHonorario = (clientsData || []).filter(c => c.monthly_fee && c.monthly_fee > 0);
      setClients(clientesComHonorario);

      // Carregar invoices do mês
      if (filtroCompetencia) {
        const [ano, mes] = filtroCompetencia.split('-');
        const competenciaInvoice = `${mes}/${ano}`;
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, client_id, competence, amount, status, due_date, paid_date, created_by, client:clients(id, name, cnpj, cpf, email, logradouro, numero, bairro, municipio, uf, cep, monthly_fee, status)')
          .eq('competence', competenciaInvoice);

        setInvoices((invoicesData || []) as any);
      } else {
        setInvoices([]);
      }

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

  // =====================================================
  // EFFECTS - Inicialização e sincronização
  // =====================================================

  useEffect(() => {
    loadData();
  }, [filtroStatus, filtroCompetencia, activeTab]);

  // =====================================================
  // HANDLERS DE AÇÕES
  // =====================================================

  // Emissão automática
  const emitirAutomatico = async (invoice: InvoiceForNFSe) => {
    if (!config) {
      toast({ title: 'Erro', description: 'Configuração não encontrada', variant: 'destructive' });
      return;
    }

    setEmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.');

      const resp = await fetch('/api/nfse/emitir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });

      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || payload?.success === false) {
        throw new Error(payload?.error || payload?.errors?.map((e: any) => `${e.codigo}: ${e.mensagem}`).join('; ') || 'Falha ao emitir');
      }

      toast({
        title: 'Emissão iniciada',
        description: payload?.protocolo ? `Protocolo: ${payload.protocolo}` : 'Solicitação enviada',
      });

      // LANÇAMENTO CONTÁBIL OBRIGATÓRIO (Dr. Cícero - NBC TG 26)
      // D: Clientes a Receber (1.1.2.01) - ativo aumenta
      // C: Receita de Honorários (3.1.1.01) - receita aumenta
      if (payload?.nfse_id && invoice.client_id) {
        await registrarHonorario({
          invoiceId: invoice.id,
          clientId: invoice.client_id,
          clientName: invoice.client?.name || 'Cliente',
          amount: Number(invoice.amount),
          competence: invoice.competence,
          dueDate: invoice.due_date || new Date().toISOString().split('T')[0],
          description: `NFS-e - Honorários ${invoice.competence}`,
        });
      }

      return payload?.nfse_id || true;

    } catch (error: any) {
      toast({ title: 'Erro ao emitir NFS-e', description: error.message, variant: 'destructive' });
      return null;
    } finally {
      setEmitting(false);
    }
  };

  // Emissão em lote
  const emitirEmLote = async () => {
    if (selectedInvoices.length === 0) {
      toast({ title: 'Selecione clientes', description: 'Selecione ao menos um cliente para emitir', variant: 'destructive' });
      return;
    }

    setEmitting(true);
    let sucesso = 0;
    let erro = 0;

    for (const invoiceId of selectedInvoices) {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (invoice) {
        const result = await emitirAutomatico(invoice);
        if (result) sucesso++;
        else erro++;
      }
    }

    toast({
      title: 'Emissão em lote finalizada',
      description: `${sucesso} emitidas com sucesso, ${erro} com erro`
    });

    setShowEmitirLoteDialog(false);
    setSelectedInvoices([]);
    setEmitting(false);
    loadData();
  };

  // Abrir seletor de arquivos
  const openFileSelector = () => {
    console.log('openFileSelector chamado, ref:', fileInputRef.current);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('fileInputRef não está disponível');
      toast({ title: 'Erro', description: 'Seletor de arquivos não disponível', variant: 'destructive' });
    }
  };

  // Upload de XMLs
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileSelect chamado', event.target.files);
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadResults([]);

    const xmls: string[] = [];
    const totalFiles = files.length;

    // Ler todos os arquivos
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        xmls.push(text);
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 50));
      } catch (err) {
        console.error(`Erro ao ler arquivo ${file.name}:`, err);
      }
    }

    // Enviar para API
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const resp = await fetch('/api/nfse/importar-xml', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          xmls,
          criarContasPagar: uploadOptions.criarContasPagar,
          diasVencimento: uploadOptions.diasVencimento
        })
      });

      setUploadProgress(100);

      const result = await resp.json();

      if (result.success) {
        setUploadResults(result.resultados || []);
        toast({
          title: 'Upload concluído',
          description: `${result.resumo.inseridas} notas importadas, ${result.resumo.duplicadas} duplicadas, ${result.resumo.erros} erros`
        });
        loadData();
      } else {
        throw new Error(result.error || 'Erro ao importar');
      }

    } catch (error: any) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Processar NFS-e tomada (criar conta a pagar)
  const processarNFSeTomada = async (nfseTomada: NFSeTomada) => {
    try {
      const { data, error } = await supabase
        .rpc('fn_processar_nfse_tomada', {
          p_nfse_tomada_id: nfseTomada.id,
          p_criar_conta_pagar: true,
          p_dias_vencimento: 30
        });

      if (error) throw error;

      if (data?.success) {
        // LANÇAMENTO CONTÁBIL OBRIGATÓRIO (Dr. Cícero - NBC TG 26)
        // D: Despesa (4.x.x.xx) - custo aumenta
        // C: Fornecedores a Pagar (2.1.x.xx) - passivo aumenta
        await registrarDespesa({
          expenseId: nfseTomada.id,
          amount: nfseTomada.valor_servicos,
          expenseDate: nfseTomada.data_emissao || new Date().toISOString().split('T')[0],
          category: 'Serviços Terceiros',
          description: `NFS-e ${nfseTomada.numero_nfse} - ${nfseTomada.prestador_razao_social || 'Fornecedor'}`,
          supplierName: nfseTomada.prestador_razao_social || 'Fornecedor',
          competence: nfseTomada.competencia || nfseTomada.data_emissao?.slice(0, 7),
        });

        toast({
          title: 'NFS-e processada',
          description: 'Conta a pagar e lançamento contábil criados'
        });
        loadData();
      } else {
        throw new Error(data?.error || 'Erro ao processar');
      }
    } catch (error: any) {
      toast({ title: 'Erro ao processar', description: error.message, variant: 'destructive' });
    }
  };

  // Ignorar NFS-e tomada
  const ignorarNFSeTomada = async (nfseTomada: NFSeTomada) => {
    try {
      const { error } = await supabase
        .from('nfse_tomadas')
        .update({ status: 'ignorada' })
        .eq('id', nfseTomada.id);

      if (error) throw error;

      toast({ title: 'NFS-e ignorada' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  // Excluir NFS-e tomada
  const excluirNFSeTomada = async (nfseTomada: NFSeTomada) => {
    if (!confirm('Deseja realmente excluir esta NFS-e?')) return;

    try {
      const { error } = await supabase
        .from('nfse_tomadas')
        .delete()
        .eq('id', nfseTomada.id);

      if (error) throw error;

      toast({ title: 'NFS-e excluída' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  // Download XML
  const downloadXml = async (nfse: NFSe, tipo: 'rps' | 'nfse') => {
    const xml = tipo === 'rps' ? nfse.xml_rps : nfse.xml_nfse;
    if (!xml) {
      toast({ title: 'XML não disponível', variant: 'destructive' });
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
  };

  const handleEmitir = async () => {
    if (!formData.client_id || !formData.valor_servicos || !formData.discriminacao) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos', variant: 'destructive' });
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
      const servicoSelecionado = codigosServico.find(s => s.codigo === formData.codigo_servico) || SERVICO_CONTABILIDADE;

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
          tomador_cnpj: (client.cnpj || client.cpf)?.replace(/\D/g, ''),
          tomador_razao_social: client.name,
          tomador_email: client.email,
          tomador_endereco: client.logradouro,
          tomador_cidade: client.municipio,
          tomador_uf: client.uf,
          tomador_cep: client.cep?.replace(/\D/g, ''),
          discriminacao: formData.discriminacao,
          valor_servicos: valorServicos,
          aliquota: 0,
          valor_iss: 0,
          valor_pis: 0,
          valor_cofins: 0,
          valor_csll: 0,
          valor_ir: 0,
          valor_inss: 0,
          outras_retencoes: 0,
          valor_liquido: valorServicos,
          item_lista_servico: servicoSelecionado.codigo,
          codigo_cnae: ('cnae_principal' in servicoSelecionado ? servicoSelecionado.cnae_principal : servicoSelecionado.cnae) || '6920602',
          codigo_municipio: MUNICIPIO_GOIANIA.codigo,
          exigibilidade_iss: 4,
          optante_simples_nacional: true,
          client_id: client.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({ title: 'NFS-e criada', description: `RPS ${numeroRps} - ${client.name}` });

      // Chamar API para emitir
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        const resp = await fetch('/api/nfse/emitir', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({ nfse_id: nfse.id })
        });

        const apiData = await resp.json();
        if (apiData?.protocolo) {
          toast({ title: 'Lote enviado', description: `Protocolo: ${apiData.protocolo}` });
        }
      } catch (funcErr: any) {
        console.error('Erro:', funcErr);
      }

      setShowEmitirDialog(false);
      setFormData({
        client_id: '',
        valor_servicos: '',
        discriminacao: config?.descricao_servico_padrao || '',
        competencia: format(new Date(), 'yyyy-MM-dd'),
        codigo_servico: '17.19',
        aliquota: '0'
      });
      loadData();

    } catch (error: any) {
      toast({ title: 'Erro ao emitir NFS-e', description: error.message, variant: 'destructive' });
    } finally {
      setEmitting(false);
    }
  };

  const consultarStatus = async (nfse: NFSe) => {
    toast({ title: 'Consultando...', description: `Consultando status da NFS-e ${nfse.numero_rps}` });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const resp = await fetch('/api/nfse/consultar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ nfse_id: nfse.id, protocolo: nfse.protocolo })
      });

      const apiData = await resp.json();

      if (apiData?.numero_nfse) {
        toast({
          title: 'NFS-e Autorizada!',
          description: `Número: ${apiData.numero_nfse} - Código: ${apiData.codigo_verificacao}`,
        });
        loadData();
      } else if (apiData?.status === 'processing') {
        toast({ title: 'Em Processamento', description: 'Ainda sendo processada' });
      }
    } catch (err: any) {
      toast({ title: 'Verificação Manual', description: 'Acesse https://nfse.goiania.go.gov.br' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: any }> = {
      pending: { variant: 'secondary', label: 'Pendente', icon: Clock },
      pendente: { variant: 'secondary', label: 'Pendente', icon: Clock },
      processing: { variant: 'outline', label: 'Processando', icon: RefreshCw },
      authorized: { variant: 'default', label: 'Autorizada', icon: CheckCircle2 },
      lancada: { variant: 'default', label: 'Lançada', icon: CheckCircle2 },
      cancelled: { variant: 'destructive', label: 'Cancelada', icon: XCircle },
      ignorada: { variant: 'outline', label: 'Ignorada', icon: FileX },
      error: { variant: 'destructive', label: 'Erro', icon: AlertCircle },
      erro: { variant: 'destructive', label: 'Erro', icon: AlertCircle }
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

  // Gerar PDF
  const gerarPDF = (nfse: NFSe) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, pageWidth, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTA FISCAL DE SERVIÇOS ELETRÔNICA', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(12);
    doc.text('NFS-e', pageWidth / 2, 25, { align: 'center' });

    if (nfse.numero_nfse) {
      doc.setFontSize(14);
      doc.text(`Nº ${nfse.numero_nfse}`, pageWidth / 2, 35, { align: 'center' });
    } else {
      doc.setFontSize(10);
      doc.text(`RPS Nº ${nfse.numero_rps} - Série ${nfse.serie_rps}`, pageWidth / 2, 35, { align: 'center' });
    }

    y = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESTADOR:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(nfse.prestador_razao_social || 'AMPLA CONTABILIDADE LTDA', margin + 30, y);

    y += 8;
    doc.text(`CNPJ: ${formatCNPJ(nfse.prestador_cnpj)} | IM: ${nfse.prestador_inscricao_municipal}`, margin, y);

    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text('TOMADOR:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(nfse.tomador_razao_social, margin + 25, y);

    y += 8;
    doc.text(`CNPJ/CPF: ${formatCNPJ(nfse.tomador_cnpj || nfse.tomador_cpf)}`, margin, y);

    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.text('DISCRIMINAÇÃO:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const discriminacaoLines = doc.splitTextToSize(nfse.discriminacao, pageWidth - 2 * margin);
    discriminacaoLines.slice(0, 5).forEach((line: string) => {
      doc.text(line, margin, y);
      y += 5;
    });

    y += 10;
    doc.setFillColor(34, 139, 34);
    doc.rect(margin, y, pageWidth - 2 * margin, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VALOR:', margin + 10, y + 10);
    doc.setFontSize(14);
    doc.text(formatCurrency(nfse.valor_servicos), pageWidth - margin - 10, y + 10, { align: 'right' });

    const fileName = nfse.numero_nfse ? `NFSe_${nfse.numero_nfse}.pdf` : `RPS_${nfse.numero_rps}.pdf`;
    doc.save(fileName);
    toast({ title: 'PDF gerado', description: `${fileName} baixado` });
  };

  // Estatísticas
  const [anoFiltro, mesFiltro] = (filtroCompetencia || format(new Date(), 'yyyy-MM')).split('-');
  const competenciaNfsePrefix = `${anoFiltro}-${mesFiltro}`;

  const invoicesSemNota = invoices
    .filter(i => Number(i.amount || 0) > 0)
    .filter(i => {
      const jaTemPorInvoice = nfses.some(n => n.invoice_id === i.id);
      const jaTemPorClienteMes = nfses.some(n => n.client_id === i.client_id && n.competencia?.startsWith(competenciaNfsePrefix));
      return !jaTemPorInvoice && !jaTemPorClienteMes;
    });

  const invoicesSemNotaFiltradas = filtroEmissaoRapida
    ? invoicesSemNota.filter((inv) => {
        const c = inv.client;
        const term = filtroEmissaoRapida.toLowerCase();
        return (
          (c?.name || '').toLowerCase().includes(term) ||
          (c?.cnpj && c.cnpj.includes(filtroEmissaoRapida)) ||
          (c?.cpf && c.cpf.includes(filtroEmissaoRapida))
        );
      })
    : invoicesSemNota;

  const statsEmitidas = {
    autorizadas: nfses.filter(n => n.status === 'authorized').length,
    pendentes: nfses.filter(n => n.status === 'pending' || n.status === 'processing').length,
    erros: nfses.filter(n => n.status === 'error').length,
    valorTotal: nfses.filter(n => n.status === 'authorized').reduce((sum, n) => sum + (n.valor_servicos || 0), 0)
  };

  const statsTomadas = {
    pendentes: nfsesTomadas.filter(n => n.status === 'pendente').length,
    lancadas: nfsesTomadas.filter(n => n.status === 'lancada').length,
    ignoradas: nfsesTomadas.filter(n => n.status === 'ignorada').length,
    valorTotal: nfsesTomadas.reduce((sum, n) => sum + (n.valor_servicos || 0), 0)
  };

  // Agrupar NFS-e tomadas por mês
  const getMesDaData = (dataStr: string | null): string => {
    if (!dataStr) return 'sem-data';
    const data = new Date(dataStr);
    return format(data, 'yyyy-MM');
  };

  const mesesDisponiveis = Array.from(new Set(
    nfsesTomadas.map(n => getMesDaData(n.data_emissao))
  )).sort().reverse();

  const nfsesTomadasFiltradas = nfsesTomadas
    .filter(n => filtroStatusTomadas === 'all' || n.status === filtroStatusTomadas)
    .filter(n => filtroMesTomadas === 'all' || getMesDaData(n.data_emissao) === filtroMesTomadas);

  // Agrupar por mês para exibição
  const nfsesTomadasPorMes = nfsesTomadasFiltradas.reduce((acc, n) => {
    const mes = getMesDaData(n.data_emissao);
    if (!acc[mes]) acc[mes] = [];
    acc[mes].push(n);
    return acc;
  }, {} as Record<string, NFSeTomada[]>);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              NFS-e - Nota Fiscal de Serviços
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Emissão, recebimento e gerenciamento de notas fiscais eletrônicas
            </p>
          </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>
          <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar XML
          </Button>
          <Button onClick={() => setShowEmitirDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Emitir NFS-e
          </Button>
        </div>
      </div>

      {/* Ambiente Badge */}
      {config && (
        <Alert className={config.ambiente === 'producao' ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}>
          <Info className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Ambiente: {config.ambiente === 'producao' ? 'Produção' : 'Homologação'}
            <Badge variant={config.ambiente === 'producao' ? 'default' : 'secondary'}>
              {config.ambiente === 'producao' ? 'Notas com validade jurídica' : 'Ambiente de testes'}
            </Badge>
          </AlertTitle>
          <AlertDescription>
            {config.prestador_razao_social} - CNPJ: {formatCNPJ(config.prestador_cnpj)} - IM: {config.prestador_inscricao_municipal}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="emitidas" className="flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4" />
            Notas Emitidas
            <Badge variant="secondary">{nfses.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="recebidas" className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4" />
            Notas Recebidas
            <Badge variant="secondary">{nfsesTomadas.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Importar XMLs
          </TabsTrigger>
        </TabsList>

        {/* Tab: Notas Emitidas */}
        <TabsContent value="emitidas" className="space-y-4">
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
                <div className="text-2xl font-bold text-green-600">{statsEmitidas.autorizadas}</div>
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
                <div className="text-2xl font-bold text-yellow-600">{statsEmitidas.pendentes}</div>
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
                <div className="text-2xl font-bold text-red-600">{statsEmitidas.erros}</div>
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
                <div className="text-2xl font-bold text-blue-600">{invoicesSemNota.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor Emitido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">{formatCurrency(statsEmitidas.valorTotal)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Emissão Rápida */}
          {invoicesSemNota.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  Emissão Rápida - Clientes sem nota em {mesFiltro}/{anoFiltro}
                </CardTitle>
                <CardDescription>
                  Clique no cliente para emitir automaticamente com valor do honorário
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente por nome ou CNPJ/CPF..."
                    value={filtroEmissaoRapida}
                    onChange={(e) => setFiltroEmissaoRapida(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {invoicesSemNotaFiltradas.slice(0, 10).map(inv => (
                    <Button
                      key={inv.id}
                      variant="outline"
                      size="sm"
                      onClick={() => emitirAutomatico(inv).then(() => loadData())}
                      disabled={emitting}
                      className="bg-white"
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      {(inv.client?.name || 'Cliente').substring(0, 25)}
                      <Badge variant="secondary" className="ml-2">{formatCurrency(Number(inv.amount || 0))}</Badge>
                    </Button>
                  ))}
                  {invoicesSemNota.length > 10 && (
                    <Button variant="outline" size="sm" onClick={() => setShowEmitirLoteDialog(true)}>
                      +{invoicesSemNota.length - 10} mais...
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
                <Button variant="outline" onClick={() => setShowEmitirLoteDialog(true)}>
                  <Users className="h-4 w-4 mr-2" />
                  Emitir em Lote
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de NFS-e Emitidas */}
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
                          <div className="text-xs text-muted-foreground">Série {nfse.serie_rps}</div>
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
                        <TableCell>{getStatusBadge(nfse.status)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => gerarPDF(nfse)} title="Gerar PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                            {nfse.xml_rps && (
                              <Button variant="ghost" size="icon" onClick={() => downloadXml(nfse, 'rps')} title="XML RPS">
                                <FileCode className="h-4 w-4" />
                              </Button>
                            )}
                            {(nfse.status === 'pending' || nfse.status === 'processing') && (
                              <Button variant="ghost" size="icon" onClick={() => consultarStatus(nfse)} title="Consultar">
                                <Search className="h-4 w-4" />
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
        </TabsContent>

        {/* Tab: Notas Recebidas */}
        <TabsContent value="recebidas" className="space-y-4">
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{statsTomadas.pendentes}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Lançadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{statsTomadas.lancadas}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileX className="h-4 w-4 text-gray-600" />
                  Ignoradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{statsTomadas.ignoradas}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Despesas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">{formatCurrency(statsTomadas.valorTotal)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4 items-end flex-wrap">
                <div className="w-48">
                  <Label>Status</Label>
                  <Select value={filtroStatusTomadas} onValueChange={setFiltroStatusTomadas}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="lancada">Lançada</SelectItem>
                      <SelectItem value="ignorada">Ignorada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-48">
                  <Label>Mês</Label>
                  <Select value={filtroMesTomadas} onValueChange={setFiltroMesTomadas}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      {mesesDisponiveis.map(mes => (
                        <SelectItem key={mes} value={mes}>
                          {mes === 'sem-data' ? 'Sem data' : format(new Date(mes + '-01'), 'MMMM/yyyy', { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={loadData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
                <Button onClick={() => setShowUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar XMLs
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de NFS-e Recebidas - Agrupado por Mês */}
          {loading ? (
            <Card>
              <CardContent className="pt-6 text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                Carregando...
              </CardContent>
            </Card>
          ) : nfsesTomadasFiltradas.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-8 text-muted-foreground">
                <ArrowDownToLine className="h-12 w-12 mx-auto mb-2 opacity-30" />
                Nenhuma NFS-e recebida
                <div className="mt-2">
                  <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar XMLs
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            Object.entries(nfsesTomadasPorMes)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([mes, notas]) => {
                const valorMes = notas.reduce((sum, n) => sum + (n.valor_servicos || 0), 0);
                const mesLabel = mes === 'sem-data' ? 'Sem data' : format(new Date(mes + '-01'), 'MMMM/yyyy', { locale: ptBR });

                return (
                  <Card key={mes}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2 capitalize">
                          <Hash className="h-4 w-4" />
                          {mesLabel}
                          <Badge variant="secondary">{notas.length} nota{notas.length > 1 ? 's' : ''}</Badge>
                        </CardTitle>
                        <div className="text-lg font-bold text-red-600">
                          {formatCurrency(valorMes)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>NFS-e</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Prestador (Fornecedor)</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {notas.map((nfse) => (
                            <TableRow key={nfse.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                              setSelectedNFSeTomada(nfse);
                              setShowDetalhesTomadaDialog(true);
                            }}>
                              <TableCell>
                                <div className="font-medium">NFS-e {nfse.numero_nfse}</div>
                                <div className="text-xs text-muted-foreground">
                                  {nfse.codigo_verificacao || '-'}
                                </div>
                              </TableCell>
                              <TableCell>
                                {nfse.data_emissao ? format(new Date(nfse.data_emissao), 'dd/MM/yyyy') : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium max-w-[200px] truncate">
                                  {nfse.prestador_razao_social || 'Fornecedor'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatCNPJ(nfse.prestador_cnpj)}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-red-600">
                                {formatCurrency(nfse.valor_servicos)}
                              </TableCell>
                              <TableCell>{getStatusBadge(nfse.status)}</TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex gap-1 justify-end">
                                  {nfse.status === 'pendente' && (
                                    <>
                                      <Button variant="ghost" size="icon" onClick={() => processarNFSeTomada(nfse)} title="Lançar em contas a pagar">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => ignorarNFSeTomada(nfse)} title="Ignorar">
                                        <FileX className="h-4 w-4 text-gray-600" />
                                      </Button>
                                    </>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={() => excluirNFSeTomada(nfse)} title="Excluir">
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })
          )}
        </TabsContent>

        {/* Tab: Upload XMLs */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar XMLs de NFS-e Recebidas
              </CardTitle>
              <CardDescription>
                Faça upload de arquivos XML de notas fiscais recebidas de fornecedores para lançamento automático em contas a pagar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Opções de upload */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="criarContasPagar"
                    checked={uploadOptions.criarContasPagar}
                    onCheckedChange={(checked) => setUploadOptions(prev => ({ ...prev, criarContasPagar: !!checked }))}
                  />
                  <Label htmlFor="criarContasPagar">Criar contas a pagar automaticamente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Dias para vencimento:</Label>
                  <Input
                    type="number"
                    className="w-20"
                    value={uploadOptions.diasVencimento}
                    onChange={(e) => setUploadOptions(prev => ({ ...prev, diasVencimento: parseInt(e.target.value) || 30 }))}
                  />
                </div>
              </div>

              {/* Área de upload */}
              <div className="border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  multiple
                  className="hidden"
                  title="Selecionar arquivos XML"
                  onChange={handleFileSelect}
                />
                <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-4">Selecione arquivos XML de NFS-e</p>
                <Button
                  type="button"
                  onClick={openFileSelector}
                  className="mb-4"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Escolher Arquivos
                </Button>
                <p className="text-sm text-muted-foreground">Suporta múltiplos arquivos XML de NFS-e</p>
              </div>

              {/* Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processando...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {/* Resultados */}
              {uploadResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Resultados do Upload</h3>
                  <ScrollArea className="h-[300px] border rounded-lg">
                    <div className="p-4 space-y-2">
                      {uploadResults.map((result, index) => (
                        <div key={index} className={`p-3 rounded-lg flex items-center justify-between ${result.sucesso ? 'bg-green-50' : 'bg-red-50'}`}>
                          <div className="flex items-center gap-2">
                            {result.sucesso ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            <div>
                              <div className="font-medium">
                                {result.numero_nfse ? `NFS-e ${result.numero_nfse}` : 'Nota Fiscal'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {result.sucesso ? result.prestador : result.erro}
                              </div>
                            </div>
                          </div>
                          {result.sucesso && (
                            <Badge variant="secondary">{formatCurrency(result.valor)}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instruções */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Como obter os XMLs</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Solicite aos fornecedores o envio do XML da NFS-e por e-mail</p>
              <p>2. Acesse o portal da prefeitura do município do fornecedor</p>
              <p>3. Use o código de verificação para baixar o XML</p>
              <p>4. Importe os arquivos XML nesta tela</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Upload */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar XMLs de NFS-e Recebidas
            </DialogTitle>
            <DialogDescription>
              Selecione os arquivos XML para importar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Opções */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="criarContasPagar2"
                  checked={uploadOptions.criarContasPagar}
                  onCheckedChange={(checked) => setUploadOptions(prev => ({ ...prev, criarContasPagar: !!checked }))}
                />
                <Label htmlFor="criarContasPagar2">Criar contas a pagar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label>Vencimento:</Label>
                <Input
                  type="number"
                  className="w-20"
                  value={uploadOptions.diasVencimento}
                  onChange={(e) => setUploadOptions(prev => ({ ...prev, diasVencimento: parseInt(e.target.value) || 30 }))}
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            </div>

            {/* Upload área */}
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".xml"
                multiple
                className="hidden"
                id="xml-upload-dialog"
                title="Selecionar arquivos XML"
                onChange={handleFileSelect}
              />
              <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium mb-3">Selecione arquivos XML</p>
              <Button
                type="button"
                onClick={() => document.getElementById('xml-upload-dialog')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Escolher Arquivos
              </Button>
              <p className="text-sm text-muted-foreground mt-2">Suporta múltiplos arquivos</p>
            </div>

            {uploading && (
              <div className="space-y-2">
                <Progress value={uploadProgress} />
                <p className="text-sm text-center">{uploadProgress}%</p>
              </div>
            )}

            {uploadResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Resultados:</h4>
                <div className="max-h-[200px] overflow-auto space-y-1">
                  {uploadResults.map((r, i) => (
                    <div key={i} className={`p-2 rounded text-sm ${r.sucesso ? 'bg-green-50' : 'bg-red-50'}`}>
                      {r.sucesso ? `✓ NFS-e ${r.numero_nfse} - ${formatCurrency(r.valor)}` : `✗ ${r.erro}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Emitir em Lote */}
      <Dialog open={showEmitirLoteDialog} onOpenChange={setShowEmitirLoteDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Emitir NFS-e em Lote
            </DialogTitle>
            <DialogDescription>
              Selecione os clientes para emitir notas automaticamente
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <Checkbox
                checked={selectedInvoices.length === invoicesSemNota.length && invoicesSemNota.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedInvoices(invoicesSemNota.map(i => i.id));
                  } else {
                    setSelectedInvoices([]);
                  }
                }}
              />
              <Label className="font-medium">Selecionar todos ({invoicesSemNota.length})</Label>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg p-4">
              <div className="space-y-2">
                {invoicesSemNota.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg">
                    <Checkbox
                      checked={selectedInvoices.includes(inv.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedInvoices([...selectedInvoices, inv.id]);
                        } else {
                          setSelectedInvoices(selectedInvoices.filter(id => id !== inv.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{inv.client?.name || 'Cliente'}</div>
                      <div className="text-xs text-muted-foreground">{formatCNPJ(inv.client?.cnpj || '')}</div>
                    </div>
                    <Badge variant="outline">{formatCurrency(Number(inv.amount || 0))}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {selectedInvoices.length > 0 && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span>Selecionados:</span>
                  <span className="font-bold">{selectedInvoices.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor total:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(invoices.filter(i => selectedInvoices.includes(i.id)).reduce((sum, i) => sum + Number(i.amount || 0), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmitirLoteDialog(false)}>Cancelar</Button>
            <Button onClick={emitirEmLote} disabled={emitting || selectedInvoices.length === 0}>
              {emitting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Emitindo...</> : <><Zap className="h-4 w-4 mr-2" />Emitir {selectedInvoices.length} Notas</>}
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
              Emitir NFS-e Manual
            </DialogTitle>
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
                <Label>Competência *</Label>
                <Input
                  type="date"
                  value={formData.competencia}
                  onChange={(e) => setFormData({ ...formData, competencia: e.target.value })}
                />
              </div>
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
              <Card className="bg-green-50">
                <CardContent className="pt-4">
                  <div className="flex justify-between">
                    <span className="font-bold">Valor Líquido:</span>
                    <span className="font-bold text-green-600 text-xl">
                      {formatCurrency(parseFloat(formData.valor_servicos) || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmitirDialog(false)}>Cancelar</Button>
            <Button onClick={handleEmitir} disabled={emitting}>
              {emitting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Emitindo...</> : <><Send className="h-4 w-4 mr-2" />Emitir NFS-e</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes NFS-e Emitida */}
      <Dialog open={showDetalhesDialog} onOpenChange={setShowDetalhesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedNFSe?.numero_nfse ? `NFS-e Nº ${selectedNFSe.numero_nfse}` : `RPS Nº ${selectedNFSe?.numero_rps}`}
            </DialogTitle>
            {selectedNFSe && (
              <div className="flex items-center gap-2 mt-2">
                {getStatusBadge(selectedNFSe.status)}
                {selectedNFSe.codigo_verificacao && (
                  <Badge variant="outline">Cód: {selectedNFSe.codigo_verificacao}</Badge>
                )}
              </div>
            )}
          </DialogHeader>

          {selectedNFSe && (
            <div className="space-y-4 py-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Data Emissão</Label>
                      <div className="font-medium">{format(new Date(selectedNFSe.data_emissao), 'dd/MM/yyyy')}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Competência</Label>
                      <div className="font-medium">{format(new Date(selectedNFSe.competencia), 'MM/yyyy')}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Série/RPS</Label>
                      <div className="font-medium">{selectedNFSe.serie_rps}/{selectedNFSe.numero_rps}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Protocolo</Label>
                      <div className="font-medium text-xs">{selectedNFSe.protocolo || '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Prestador
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-medium">{selectedNFSe.prestador_razao_social}</div>
                    <div className="text-sm text-muted-foreground">CNPJ: {formatCNPJ(selectedNFSe.prestador_cnpj)}</div>
                    <div className="text-sm text-muted-foreground">IM: {selectedNFSe.prestador_inscricao_municipal}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Tomador
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="font-medium">{selectedNFSe.tomador_razao_social}</div>
                    <div className="text-sm text-muted-foreground">CNPJ/CPF: {formatCNPJ(selectedNFSe.tomador_cnpj || selectedNFSe.tomador_cpf)}</div>
                    {selectedNFSe.tomador_email && (
                      <div className="text-sm text-muted-foreground">{selectedNFSe.tomador_email}</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Discriminação dos Serviços</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                    {selectedNFSe.discriminacao}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor Serviços</Label>
                      <div className="text-xl font-bold">{formatCurrency(selectedNFSe.valor_servicos)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">ISS</Label>
                      <div className="text-xl font-bold text-orange-600">{formatCurrency(selectedNFSe.valor_iss)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-green-700">Valor Líquido</Label>
                      <div className="text-2xl font-bold text-green-700">{formatCurrency(selectedNFSe.valor_liquido)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedNFSe.codigo_erro && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      <div>
                        <div className="font-bold">Erro: {selectedNFSe.codigo_erro}</div>
                        <div>{selectedNFSe.mensagem_erro}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetalhesDialog(false)}>Fechar</Button>
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

      {/* Dialog Detalhes NFS-e Tomada */}
      <Dialog open={showDetalhesTomadaDialog} onOpenChange={setShowDetalhesTomadaDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5" />
              NFS-e Recebida Nº {selectedNFSeTomada?.numero_nfse}
            </DialogTitle>
            {selectedNFSeTomada && (
              <div className="flex items-center gap-2 mt-2">
                {getStatusBadge(selectedNFSeTomada.status)}
              </div>
            )}
          </DialogHeader>

          {selectedNFSeTomada && (
            <div className="space-y-4 py-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Prestador (Fornecedor)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-medium text-lg">{selectedNFSeTomada.prestador_razao_social || 'Fornecedor'}</div>
                  <div className="text-sm text-muted-foreground">CNPJ: {formatCNPJ(selectedNFSeTomada.prestador_cnpj)}</div>
                  {selectedNFSeTomada.prestador_endereco && (
                    <div className="text-sm text-muted-foreground">{selectedNFSeTomada.prestador_endereco}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Serviço</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                    {selectedNFSeTomada.discriminacao || 'Sem descrição'}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor Total</Label>
                      <div className="text-2xl font-bold text-red-700">{formatCurrency(selectedNFSeTomada.valor_servicos)}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor Líquido</Label>
                      <div className="text-2xl font-bold">{formatCurrency(selectedNFSeTomada.valor_liquido || selectedNFSeTomada.valor_servicos)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetalhesTomadaDialog(false)}>Fechar</Button>
            {selectedNFSeTomada?.status === 'pendente' && (
              <>
                <Button variant="outline" onClick={() => {
                  ignorarNFSeTomada(selectedNFSeTomada);
                  setShowDetalhesTomadaDialog(false);
                }}>
                  <FileX className="h-4 w-4 mr-2" />
                  Ignorar
                </Button>
                <Button onClick={() => {
                  processarNFSeTomada(selectedNFSeTomada);
                  setShowDetalhesTomadaDialog(false);
                }}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Lançar em Contas a Pagar
                </Button>
              </>
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
                  <Label className="text-muted-foreground">Último RPS</Label>
                  <div className="font-medium">{config.ultimo_numero_rps}</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
}
