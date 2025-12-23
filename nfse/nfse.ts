/**
 * Modelos de dados para NFS-e Goiânia
 * Baseado no padrão ABRASF 2.0 e Padrão Nacional
 */

// ============================================
// ENUMS
// ============================================

export enum NaturezaOperacao {
  TRIBUTACAO_MUNICIPIO = 1,
  TRIBUTACAO_FORA_MUNICIPIO = 2,
  ISENCAO = 3,
  IMUNE = 4,
  EXIGIBILIDADE_SUSPENSA_DECISAO_JUDICIAL = 5,
  EXIGIBILIDADE_SUSPENSA_PROCEDIMENTO_ADM = 6
}

export enum RegimeEspecialTributacao {
  NENHUM = 0,
  MICROEMPRESA_MUNICIPAL = 1,
  ESTIMATIVA = 2,
  SOCIEDADE_PROFISSIONAIS = 3,
  COOPERATIVA = 4,
  MICROEMPRESARIO_INDIVIDUAL = 5,
  MICROEMPRESA_EPP_SIMPLES = 6
}

export enum TipoRps {
  RPS = 1,
  NOTA_FISCAL_CONJUGADA = 2,
  CUPOM = 3
}

export enum StatusRps {
  NORMAL = 1,
  CANCELADO = 2
}

export enum SimNao {
  NAO = 2,
  SIM = 1
}

export enum TipoTributacaoISSQN {
  OPERACAO_TRIBUTAVEL = 1,
  IMUNIDADE = 2,
  EXPORTACAO_SERVICO = 3,
  NAO_INCIDENCIA = 4
}

export enum TipoRetencaoISSQN {
  NAO_RETIDO = 1,
  RETIDO_TOMADOR = 2,
  RETIDO_INTERMEDIARIO = 3
}

export enum OpSimplesNacional {
  NAO_OPTANTE = 1,
  MEI = 2,
  ME_EPP = 3
}

// ============================================
// INTERFACES - MODELO LEGADO (GOIÂNIA)
// ============================================

export interface IdentificacaoRps {
  numero: number;
  serie: string;
  tipo: TipoRps;
}

export interface ValoresServico {
  valorServicos: number;
  valorDeducoes?: number;
  valorPis?: number;
  valorCofins?: number;
  valorInss?: number;
  valorIr?: number;
  valorCsll?: number;
  issRetido: boolean;
  valorIss?: number;
  valorIssRetido?: number;
  outrasRetencoes?: number;
  baseCalculo?: number;
  aliquota?: number;
  valorLiquidoNfse?: number;
  descontoIncondicionado?: number;
  descontoCondicionado?: number;
}

export interface Servico {
  valores: ValoresServico;
  itemListaServico: string;
  codigoCnae?: string;
  codigoTributacaoMunicipio: string;
  discriminacao: string;
  codigoMunicipio: string;
  codigoPais?: string;
  exigibilidadeIss?: number;
  municipioIncidencia?: string;
  numeroProcesso?: string;
}

export interface Endereco {
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  codigoMunicipio: string;
  uf: string;
  codigoPais?: string;
  cep: string;
}

export interface Contato {
  telefone?: string;
  email?: string;
}

export interface IdentificacaoPrestador {
  cnpj: string;
  inscricaoMunicipal: string;
}

export interface IdentificacaoTomador {
  cpfCnpj: string;
  inscricaoMunicipal?: string;
}

export interface Tomador {
  identificacaoTomador?: IdentificacaoTomador;
  razaoSocial?: string;
  endereco?: Endereco;
  contato?: Contato;
}

export interface Intermediario {
  identificacaoIntermediario: {
    cpfCnpj: string;
    inscricaoMunicipal?: string;
  };
  razaoSocial: string;
}

export interface ConstrucaoCivil {
  codigoObra?: string;
  art?: string;
}

export interface Rps {
  identificacaoRps: IdentificacaoRps;
  dataEmissao: Date;
  naturezaOperacao: NaturezaOperacao;
  regimeEspecialTributacao?: RegimeEspecialTributacao;
  optanteSimplesNacional: boolean;
  incentivadorCultural: boolean;
  status: StatusRps;
  rpsSubstituido?: IdentificacaoRps;
  servico: Servico;
  prestador: IdentificacaoPrestador;
  tomador?: Tomador;
  intermediarioServico?: Intermediario;
  construcaoCivil?: ConstrucaoCivil;
}

export interface LoteRps {
  numeroLote: number;
  cnpj: string;
  inscricaoMunicipal: string;
  quantidadeRps: number;
  listaRps: Rps[];
}

// ============================================
// INTERFACES - MODELO NACIONAL (DPS)
// ============================================

export interface RegimeTributario {
  opSimpNac: OpSimplesNacional;
  regApTribSN?: number;
  regEspTrib: RegimeEspecialTributacao;
}

export interface InfoPrestador {
  cnpj?: string;
  cpf?: string;
  nif?: string;
  cNaoNIF?: number;
  caepf?: string;
  inscricaoMunicipal: string;
  xNome?: string;
  endereco?: EnderecoNacional;
  fone?: string;
  email?: string;
  regTrib: RegimeTributario;
}

export interface EnderecoNacional {
  endNac?: {
    cMun: string;
    cep: string;
  };
  endExt?: {
    cPais: string;
    cEndPost: string;
    xCidade: string;
    xEstProvReg: string;
  };
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
}

export interface InfoPessoa {
  cnpj?: string;
  cpf?: string;
  nif?: string;
  cNaoNIF?: number;
  caepf?: string;
  inscricaoMunicipal?: string;
  xNome: string;
  endereco?: EnderecoNacional;
  fone?: string;
  email?: string;
}

export interface CodigoServico {
  cTribNac: string;
  cTribMun: string;
  xDescServ: string;
  cNBS: string;
  cIntContrib?: string;
}

export interface LocalPrestacao {
  cLocPrestacao?: string;
  cPaisPrestacao?: string;
}

export interface ServicoNacional {
  locPrest: LocalPrestacao;
  cServ: CodigoServico;
  comExt?: any;
  obra?: any;
  atvEvento?: any;
  explRod?: any;
  infoCompl?: any;
}

export interface TributacaoMunicipal {
  tribISSQN: TipoTributacaoISSQN;
  cPaisResult?: string;
  tpImunidade?: number;
  exigSusp?: any;
  BM?: any;
  tpRetISSQN: TipoRetencaoISSQN;
  pAliq?: number;
}

export interface TributacaoFederal {
  piscofins?: any;
  vRetCP?: number;
  vRetIRRF?: number;
  vRetCSLL?: number;
}

export interface TotaisTributos {
  vTotTribFed?: number;
  vTotTribEst?: number;
  vTotTribMun?: number;
}

export interface InfoTributacao {
  tribMun: TributacaoMunicipal;
  tribFed?: TributacaoFederal;
  totTrib: TotaisTributos;
}

export interface ValoresServicoNacional {
  vServPrest: {
    vReceb?: number;
    vServ: number;
  };
  vDescCondIncond?: {
    vDescIncond?: number;
    vDescCond?: number;
  };
  vDedRed?: any;
  trib: InfoTributacao;
}

export interface InfDPS {
  tpAmb: 1 | 2; // 1=Produção, 2=Homologação
  dhEmi: string; // DateTime UTC
  verAplic: string;
  serie: string;
  nDPS: number;
  dCompet: string; // Data AAAA-MM-DD
  tpEmit: 1 | 2 | 3; // 1=Prestador, 2=Tomador, 3=Intermediário
  cMotivoEmisTI?: number;
  chNFSeRej?: string;
  cLocEmi: string;
  subst?: any;
  prest: InfoPrestador;
  toma?: InfoPessoa;
  interm?: InfoPessoa;
  serv: ServicoNacional;
  valores: ValoresServicoNacional;
  IBSCBS?: any;
  Id: string;
}

export interface DPS {
  infDPS: InfDPS;
  versao: string;
}

// ============================================
// INTERFACES - RESPOSTAS
// ============================================

export interface MensagemRetorno {
  codigo: string;
  mensagem: string;
  correcao?: string;
}

export interface NfseGerada {
  numero: number;
  codigoVerificacao: string;
  dataEmissao: Date;
  competencia: string;
  valorServicos: number;
  valorIss?: number;
  xml?: string;
}

export interface RespostaGerarNfse {
  sucesso: boolean;
  nfse?: NfseGerada;
  mensagens: MensagemRetorno[];
  xmlResposta?: string;
}

export interface RespostaConsultarNfse {
  sucesso: boolean;
  nfse?: NfseGerada;
  mensagens: MensagemRetorno[];
  xmlResposta?: string;
}

export interface RespostaEnviarLote {
  sucesso: boolean;
  protocolo?: string;
  dataRecebimento?: Date;
  numeroLote?: number;
  mensagens: MensagemRetorno[];
  xmlResposta?: string;
}

export interface RespostaConsultarLote {
  sucesso: boolean;
  situacao?: string;
  listaNotas?: NfseGerada[];
  mensagens: MensagemRetorno[];
  xmlResposta?: string;
}
