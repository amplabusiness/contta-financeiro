// Edge Function para emissão de NFS-e via webservice ABRASF 2.04
// Suporta envio síncrono e assíncrono
// Gera XML completo conforme modelos oficiais

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Namespace ABRASF
const NAMESPACE = "http://www.abrasf.org.br/nfse.xsd"

interface RpsData {
  nfse_id: string
  // Prestador
  prestador_cnpj: string
  inscricao_municipal: string
  // Tomador
  tomador_cpf_cnpj: string
  tomador_tipo_documento: 'cpf' | 'cnpj'
  tomador_razao_social: string
  tomador_email?: string
  tomador_telefone?: string
  // Endereço do tomador
  tomador_endereco?: string
  tomador_numero?: string
  tomador_complemento?: string
  tomador_bairro?: string
  tomador_codigo_municipio?: string
  tomador_uf?: string
  tomador_cep?: string
  // Serviço
  discriminacao: string
  codigo_municipio: string
  municipio_incidencia: string
  valor_servicos: number
  valor_deducoes: number
  valor_pis: number
  valor_cofins: number
  valor_inss: number
  valor_ir: number
  valor_csll: number
  outras_retencoes: number
  aliquota: number
  valor_iss: number
  iss_retido: boolean
  exigibilidade_iss: number
  item_lista_servico: string
  codigo_cnae: string
  codigo_tributacao_municipio?: string
  // RPS
  numero_rps: string
  serie_rps: string
  data_emissao: string
  competencia: string
  // Regime tributário
  regime_especial_tributacao: number
  optante_simples_nacional: boolean
  incentivo_fiscal: boolean
}

// Gera XML do RPS no padrão ABRASF 2.04 completo
function buildRpsXml(data: RpsData, sincrono: boolean = false): string {
  const loteId = `L${data.numero_rps}`
  const rpsId = `RPS${data.numero_rps}`

  // Monta tag CPF ou CNPJ do tomador
  const tomadorCpfCnpjTag = data.tomador_tipo_documento === 'cpf'
    ? `<Cpf>${data.tomador_cpf_cnpj}</Cpf>`
    : `<Cnpj>${data.tomador_cpf_cnpj}</Cnpj>`

  // Monta endereço do tomador (se disponível)
  const enderecoTomadorXml = data.tomador_endereco ? `
            <Endereco>
              <Endereco>${escapeXml(data.tomador_endereco)}</Endereco>
              ${data.tomador_numero ? `<Numero>${escapeXml(data.tomador_numero)}</Numero>` : ''}
              ${data.tomador_complemento ? `<Complemento>${escapeXml(data.tomador_complemento)}</Complemento>` : ''}
              ${data.tomador_bairro ? `<Bairro>${escapeXml(data.tomador_bairro)}</Bairro>` : ''}
              ${data.tomador_codigo_municipio ? `<CodigoMunicipio>${data.tomador_codigo_municipio}</CodigoMunicipio>` : ''}
              ${data.tomador_uf ? `<Uf>${data.tomador_uf}</Uf>` : ''}
              ${data.tomador_cep ? `<Cep>${data.tomador_cep.replace(/\D/g, '')}</Cep>` : ''}
            </Endereco>` : ''

  // Monta contato do tomador (se disponível)
  const contatoTomadorXml = (data.tomador_telefone || data.tomador_email) ? `
            <Contato>
              ${data.tomador_telefone ? `<Telefone>${data.tomador_telefone.replace(/\D/g, '')}</Telefone>` : ''}
              ${data.tomador_email ? `<Email>${escapeXml(data.tomador_email)}</Email>` : ''}
            </Contato>` : ''

  // ExigibilidadeISS:
  // 1 = Exigível
  // 2 = Não incidência
  // 3 = Isenção
  // 4 = Exportação
  // 5 = Imunidade
  // 6 = Exigibilidade suspensa por decisão judicial
  // 7 = Exigibilidade suspensa por processo administrativo

  // RegimeEspecialTributacao:
  // 1 = Microempresa Municipal
  // 2 = Estimativa
  // 3 = Sociedade de Profissionais
  // 4 = Cooperativa
  // 5 = MEI
  // 6 = ME EPP

  const rpsContent = `
      <Rps>
        <InfDeclaracaoPrestacaoServico Id="${rpsId}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${data.numero_rps}</Numero>
              <Serie>${data.serie_rps}</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${data.data_emissao}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${data.competencia}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${data.valor_servicos.toFixed(2)}</ValorServicos>
              ${data.valor_deducoes > 0 ? `<ValorDeducoes>${data.valor_deducoes.toFixed(2)}</ValorDeducoes>` : ''}
              ${data.valor_pis > 0 ? `<ValorPis>${data.valor_pis.toFixed(2)}</ValorPis>` : ''}
              ${data.valor_cofins > 0 ? `<ValorCofins>${data.valor_cofins.toFixed(2)}</ValorCofins>` : ''}
              ${data.valor_inss > 0 ? `<ValorInss>${data.valor_inss.toFixed(2)}</ValorInss>` : ''}
              ${data.valor_ir > 0 ? `<ValorIr>${data.valor_ir.toFixed(2)}</ValorIr>` : ''}
              ${data.valor_csll > 0 ? `<ValorCsll>${data.valor_csll.toFixed(2)}</ValorCsll>` : ''}
              ${data.outras_retencoes > 0 ? `<OutrasRetencoes>${data.outras_retencoes.toFixed(2)}</OutrasRetencoes>` : ''}
              ${data.valor_iss > 0 ? `<ValorIss>${data.valor_iss.toFixed(2)}</ValorIss>` : ''}
              ${data.aliquota > 0 ? `<Aliquota>${data.aliquota.toFixed(4)}</Aliquota>` : ''}
            </Valores>
            <IssRetido>${data.iss_retido ? '1' : '2'}</IssRetido>
            <ItemListaServico>${data.item_lista_servico.replace('.', '')}</ItemListaServico>
            ${data.codigo_cnae ? `<CodigoCnae>${data.codigo_cnae}</CodigoCnae>` : ''}
            ${data.codigo_tributacao_municipio ? `<CodigoTributacaoMunicipio>${data.codigo_tributacao_municipio}</CodigoTributacaoMunicipio>` : ''}
            <Discriminacao>${escapeXml(data.discriminacao)}</Discriminacao>
            <CodigoMunicipio>${data.codigo_municipio}</CodigoMunicipio>
            <ExigibilidadeISS>${data.exigibilidade_iss}</ExigibilidadeISS>
            <MunicipioIncidencia>${data.municipio_incidencia}</MunicipioIncidencia>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${data.prestador_cnpj}</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
          </Prestador>
          <TomadorServico>
            <IdentificacaoTomador>
              <CpfCnpj>
                ${tomadorCpfCnpjTag}
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(data.tomador_razao_social)}</RazaoSocial>${enderecoTomadorXml}${contatoTomadorXml}
          </TomadorServico>
          <RegimeEspecialTributacao>${data.regime_especial_tributacao}</RegimeEspecialTributacao>
          <OptanteSimplesNacional>${data.optante_simples_nacional ? '1' : '2'}</OptanteSimplesNacional>
          <IncentivoFiscal>${data.incentivo_fiscal ? '1' : '2'}</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>`

  // Escolhe entre envio síncrono ou assíncrono
  const rootElement = sincrono ? 'EnviarLoteRpsSincronoEnvio' : 'EnviarLoteRpsEnvio'

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement} xmlns="${NAMESPACE}">
  <LoteRps Id="${loteId}" versao="2.04">
    <NumeroLote>${data.numero_rps}</NumeroLote>
    <Prestador>
      <CpfCnpj>
        <Cnpj>${data.prestador_cnpj}</Cnpj>
      </CpfCnpj>
      <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
    </Prestador>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>${rpsContent}
    </ListaRps>
  </LoteRps>
</${rootElement}>`
}

// Gera XML para GerarNfse (emissão unitária síncrona)
function buildGerarNfseXml(data: RpsData): string {
  const rpsId = `RPS${data.numero_rps}`

  // Monta tag CPF ou CNPJ do tomador
  const tomadorCpfCnpjTag = data.tomador_tipo_documento === 'cpf'
    ? `<Cpf>${data.tomador_cpf_cnpj}</Cpf>`
    : `<Cnpj>${data.tomador_cpf_cnpj}</Cnpj>`

  // Monta endereço do tomador (se disponível)
  const enderecoTomadorXml = data.tomador_endereco ? `
            <Endereco>
              <Endereco>${escapeXml(data.tomador_endereco)}</Endereco>
              ${data.tomador_numero ? `<Numero>${escapeXml(data.tomador_numero)}</Numero>` : ''}
              ${data.tomador_complemento ? `<Complemento>${escapeXml(data.tomador_complemento)}</Complemento>` : ''}
              ${data.tomador_bairro ? `<Bairro>${escapeXml(data.tomador_bairro)}</Bairro>` : ''}
              ${data.tomador_codigo_municipio ? `<CodigoMunicipio>${data.tomador_codigo_municipio}</CodigoMunicipio>` : ''}
              ${data.tomador_uf ? `<Uf>${data.tomador_uf}</Uf>` : ''}
              ${data.tomador_cep ? `<Cep>${data.tomador_cep.replace(/\D/g, '')}</Cep>` : ''}
            </Endereco>` : ''

  // Monta contato do tomador (se disponível)
  const contatoTomadorXml = (data.tomador_telefone || data.tomador_email) ? `
            <Contato>
              ${data.tomador_telefone ? `<Telefone>${data.tomador_telefone.replace(/\D/g, '')}</Telefone>` : ''}
              ${data.tomador_email ? `<Email>${escapeXml(data.tomador_email)}</Email>` : ''}
            </Contato>` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseEnvio xmlns="${NAMESPACE}">
  <Rps>
    <InfDeclaracaoPrestacaoServico Id="${rpsId}">
      <Rps>
        <IdentificacaoRps>
          <Numero>${data.numero_rps}</Numero>
          <Serie>${data.serie_rps}</Serie>
          <Tipo>1</Tipo>
        </IdentificacaoRps>
        <DataEmissao>${data.data_emissao}</DataEmissao>
        <Status>1</Status>
      </Rps>
      <Competencia>${data.competencia}</Competencia>
      <Servico>
        <Valores>
          <ValorServicos>${data.valor_servicos.toFixed(2)}</ValorServicos>
          ${data.valor_deducoes > 0 ? `<ValorDeducoes>${data.valor_deducoes.toFixed(2)}</ValorDeducoes>` : ''}
          ${data.valor_pis > 0 ? `<ValorPis>${data.valor_pis.toFixed(2)}</ValorPis>` : ''}
          ${data.valor_cofins > 0 ? `<ValorCofins>${data.valor_cofins.toFixed(2)}</ValorCofins>` : ''}
          ${data.valor_inss > 0 ? `<ValorInss>${data.valor_inss.toFixed(2)}</ValorInss>` : ''}
          ${data.valor_ir > 0 ? `<ValorIr>${data.valor_ir.toFixed(2)}</ValorIr>` : ''}
          ${data.valor_csll > 0 ? `<ValorCsll>${data.valor_csll.toFixed(2)}</ValorCsll>` : ''}
          ${data.outras_retencoes > 0 ? `<OutrasRetencoes>${data.outras_retencoes.toFixed(2)}</OutrasRetencoes>` : ''}
          ${data.valor_iss > 0 ? `<ValorIss>${data.valor_iss.toFixed(2)}</ValorIss>` : ''}
          ${data.aliquota > 0 ? `<Aliquota>${data.aliquota.toFixed(4)}</Aliquota>` : ''}
        </Valores>
        <IssRetido>${data.iss_retido ? '1' : '2'}</IssRetido>
        <ItemListaServico>${data.item_lista_servico.replace('.', '')}</ItemListaServico>
        ${data.codigo_cnae ? `<CodigoCnae>${data.codigo_cnae}</CodigoCnae>` : ''}
        ${data.codigo_tributacao_municipio ? `<CodigoTributacaoMunicipio>${data.codigo_tributacao_municipio}</CodigoTributacaoMunicipio>` : ''}
        <Discriminacao>${escapeXml(data.discriminacao)}</Discriminacao>
        <CodigoMunicipio>${data.codigo_municipio}</CodigoMunicipio>
        <ExigibilidadeISS>${data.exigibilidade_iss}</ExigibilidadeISS>
        <MunicipioIncidencia>${data.municipio_incidencia}</MunicipioIncidencia>
      </Servico>
      <Prestador>
        <CpfCnpj>
          <Cnpj>${data.prestador_cnpj}</Cnpj>
        </CpfCnpj>
        <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
      </Prestador>
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            ${tomadorCpfCnpjTag}
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>${escapeXml(data.tomador_razao_social)}</RazaoSocial>${enderecoTomadorXml}${contatoTomadorXml}
      </TomadorServico>
      <RegimeEspecialTributacao>${data.regime_especial_tributacao}</RegimeEspecialTributacao>
      <OptanteSimplesNacional>${data.optante_simples_nacional ? '1' : '2'}</OptanteSimplesNacional>
      <IncentivoFiscal>${data.incentivo_fiscal ? '1' : '2'}</IncentivoFiscal>
    </InfDeclaracaoPrestacaoServico>
  </Rps>
</GerarNfseEnvio>`
}

// Envelope SOAP
function wrapSoapEnvelope(xmlPayload: string, operation: string, namespace: string = "http://nfse.abrasf.org.br"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="${namespace}">
  <soap:Body>
    <nfse:${operation}>
      <nfse:xmlEnvio><![CDATA[${xmlPayload}]]></nfse:xmlEnvio>
    </nfse:${operation}>
  </soap:Body>
</soap:Envelope>`
}

function escapeXml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Extrai protocolo da resposta
function extractProtocol(responseXml: string): string | null {
  const match = responseXml.match(/<Protocolo>([^<]+)<\/Protocolo>/i)
  return match ? match[1] : null
}

// Extrai dados da NFS-e autorizada
function extractNFSeData(responseXml: string): { numero_nfse: string; codigo_verificacao: string } | null {
  const numeroMatch = responseXml.match(/<Numero>([^<]+)<\/Numero>/i)
  const codigoMatch = responseXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/i)

  if (numeroMatch) {
    return {
      numero_nfse: numeroMatch[1],
      codigo_verificacao: codigoMatch ? codigoMatch[1] : ''
    }
  }
  return null
}

// Extrai XML da NFS-e
function extractNFSeXml(responseXml: string): string | null {
  const match = responseXml.match(/<CompNfse>([\s\S]*?)<\/CompNfse>/i)
  return match ? match[0] : null
}

// Extrai erros da resposta
function extractErrors(responseXml: string): { codigo: string; mensagem: string }[] {
  const errors: { codigo: string; mensagem: string }[] = []
  const errorRegex = /<MensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>[\s\S]*?<\/MensagemRetorno>/gi
  let match
  while ((match = errorRegex.exec(responseXml)) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] })
  }

  // Também verifica ListaMensagemRetorno
  const listaRegex = /<ListaMensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>/gi
  while ((match = listaRegex.exec(responseXml)) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] })
  }

  return errors
}

// Determina código IBGE do município pelo nome/UF
function getCodigoMunicipioIBGE(municipio: string, uf: string): string {
  // Mapeamento dos principais municípios
  const municipios: Record<string, string> = {
    'GOIANIA-GO': '5208707',
    'APARECIDA DE GOIANIA-GO': '5201405',
    'ANAPOLIS-GO': '5201108',
    'SAO PAULO-SP': '3550308',
    'RIO DE JANEIRO-RJ': '3304557',
    'BRASILIA-DF': '5300108',
    'CAMPO GRANDE-MS': '5002704',
  }

  const key = `${municipio?.toUpperCase()?.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}-${uf?.toUpperCase()}`
  return municipios[key] || '5208707' // Default: Goiânia
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const {
      nfse_id,
      modo_envio = 'assincrono', // 'sincrono', 'assincrono', 'gerar_nfse'
      operacao = 'emitir'
    } = await req.json()

    if (!nfse_id) {
      throw new Error('nfse_id é obrigatório')
    }

    // Buscar dados da NFS-e com dados do cliente
    const { data: nfse, error: nfseError } = await supabase
      .from('nfse')
      .select(`
        *,
        client:clients(
          id, name, cnpj, cpf, email, phone,
          razao_social, logradouro, numero, complemento,
          bairro, municipio, uf, cep
        )
      `)
      .eq('id', nfse_id)
      .single()

    if (nfseError || !nfse) {
      throw new Error(`NFS-e não encontrada: ${nfseError?.message}`)
    }

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('nfse_config')
      .select('*')
      .eq('prestador_cnpj', nfse.prestador_cnpj)
      .single()

    if (configError || !config) {
      throw new Error(`Configuração não encontrada: ${configError?.message}`)
    }

    // Determinar tipo de documento do tomador
    const tomadorCpfCnpj = nfse.tomador_cnpj || nfse.tomador_cpf || nfse.client?.cnpj || nfse.client?.cpf || ''
    const tomadorTipoDoc = tomadorCpfCnpj.replace(/\D/g, '').length === 11 ? 'cpf' : 'cnpj'

    // Código do município do tomador
    const tomadorCodigoMunicipio = nfse.tomador_codigo_municipio ||
      (nfse.client?.municipio && nfse.client?.uf ?
        getCodigoMunicipioIBGE(nfse.client.municipio, nfse.client.uf) : undefined)

    // Data de emissão (hoje se não especificada)
    const dataEmissao = nfse.data_emissao || new Date().toISOString().split('T')[0]

    // Montar dados do RPS
    const rpsData: RpsData = {
      nfse_id: nfse.id,
      // Prestador
      prestador_cnpj: nfse.prestador_cnpj,
      inscricao_municipal: nfse.prestador_inscricao_municipal,
      // Tomador
      tomador_cpf_cnpj: tomadorCpfCnpj.replace(/\D/g, ''),
      tomador_tipo_documento: tomadorTipoDoc,
      tomador_razao_social: nfse.tomador_razao_social || nfse.client?.razao_social || nfse.client?.name || '',
      tomador_email: nfse.tomador_email || nfse.client?.email,
      tomador_telefone: nfse.client?.phone,
      // Endereço do tomador
      tomador_endereco: nfse.tomador_endereco || nfse.client?.logradouro,
      tomador_numero: nfse.tomador_numero || nfse.client?.numero,
      tomador_complemento: nfse.tomador_complemento || nfse.client?.complemento,
      tomador_bairro: nfse.tomador_bairro || nfse.client?.bairro,
      tomador_codigo_municipio: tomadorCodigoMunicipio,
      tomador_uf: nfse.tomador_uf || nfse.client?.uf,
      tomador_cep: nfse.tomador_cep || nfse.client?.cep,
      // Serviço
      discriminacao: nfse.discriminacao || config.descricao_servico_padrao || 'Serviços contábeis mensais',
      codigo_municipio: nfse.codigo_municipio || '5208707',
      municipio_incidencia: nfse.municipio_incidencia || nfse.codigo_municipio || '5208707',
      valor_servicos: parseFloat(nfse.valor_servicos || '0'),
      valor_deducoes: parseFloat(nfse.valor_deducoes || '0'),
      valor_pis: parseFloat(nfse.valor_pis || '0'),
      valor_cofins: parseFloat(nfse.valor_cofins || '0'),
      valor_inss: parseFloat(nfse.valor_inss || '0'),
      valor_ir: parseFloat(nfse.valor_ir || '0'),
      valor_csll: parseFloat(nfse.valor_csll || '0'),
      outras_retencoes: parseFloat(nfse.outras_retencoes || '0'),
      aliquota: parseFloat(nfse.aliquota || config.aliquota_padrao || '0'),
      valor_iss: parseFloat(nfse.valor_iss || '0'),
      iss_retido: nfse.iss_retido || false,
      exigibilidade_iss: nfse.exigibilidade_iss || 1, // 1 = Exigível
      item_lista_servico: nfse.item_lista_servico || config.item_lista_servico_padrao || '17.18',
      codigo_cnae: nfse.codigo_cnae || config.codigo_cnae_padrao || '6920602',
      codigo_tributacao_municipio: nfse.codigo_tributacao_municipio,
      // RPS
      numero_rps: nfse.numero_rps,
      serie_rps: nfse.serie_rps || config.serie_rps_padrao || 'A',
      data_emissao: dataEmissao,
      competencia: nfse.competencia,
      // Regime tributário
      regime_especial_tributacao: config.regime_especial_tributacao || 3, // 3 = Sociedade de Profissionais
      optante_simples_nacional: config.optante_simples_nacional || false,
      incentivo_fiscal: config.incentivo_fiscal || false,
    }

    // Gerar XML conforme modo de envio
    let rpsXml: string
    let soapOperation: string

    if (modo_envio === 'gerar_nfse') {
      rpsXml = buildGerarNfseXml(rpsData)
      soapOperation = 'GerarNfse'
    } else if (modo_envio === 'sincrono') {
      rpsXml = buildRpsXml(rpsData, true)
      soapOperation = 'RecepcionarLoteRpsSincrono'
    } else {
      rpsXml = buildRpsXml(rpsData, false)
      soapOperation = 'RecepcionarLoteRps'
    }

    const soapEnvelope = wrapSoapEnvelope(rpsXml, soapOperation)

    // Determinar URL do webservice
    const baseUrl = config.ambiente === 'producao'
      ? config.base_url_producao
      : config.base_url_homologacao

    const endpoint = `${baseUrl}/${config.endpoint}`

    // NOTA: Chamada ao webservice com certificado digital requer ambiente especial
    // No Supabase Edge Functions, não temos suporte nativo a mTLS com certificado PFX
    // Para produção, será necessário:
    // 1. Usar um proxy/gateway que faça a autenticação mTLS
    // 2. Ou migrar para uma Cloud Function do GCP/AWS com suporte a certificados

    // Simular resposta para homologação (até configurar proxy mTLS)
    const isHomologacao = config.ambiente === 'homologacao'

    let responseXml = ''
    let protocolo: string | null = null
    let nfseData: { numero_nfse: string; codigo_verificacao: string } | null = null
    let errors: { codigo: string; mensagem: string }[] = []

    if (isHomologacao) {
      // Em homologação, simular resposta de sucesso
      protocolo = `SIM-${Date.now()}`
      responseXml = `<Protocolo>${protocolo}</Protocolo>`

      // Para modo síncrono, simular NFS-e autorizada
      if (modo_envio === 'sincrono' || modo_envio === 'gerar_nfse') {
        const nfseNumero = `SIM${nfse.numero_rps}`
        const codVerif = Math.random().toString(36).substring(2, 10).toUpperCase()
        nfseData = { numero_nfse: nfseNumero, codigo_verificacao: codVerif }
        responseXml = `<Numero>${nfseNumero}</Numero><CodigoVerificacao>${codVerif}</CodigoVerificacao>`
      }
    } else {
      // Tentativa de envio real (pode falhar sem mTLS)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': `http://nfse.abrasf.org.br/${soapOperation}`
          },
          body: soapEnvelope
        })
        responseXml = await response.text()
        protocolo = extractProtocol(responseXml)
        nfseData = extractNFSeData(responseXml)
        errors = extractErrors(responseXml)
      } catch (fetchError: any) {
        errors = [{ codigo: 'CONN', mensagem: `Erro de conexão: ${fetchError.message}. Certificado mTLS necessário.` }]
      }
    }

    // Atualizar NFS-e no banco
    const updateData: Record<string, any> = {
      xml_rps: rpsXml,
      updated_at: new Date().toISOString()
    }

    if (protocolo) {
      updateData.protocolo = protocolo
      updateData.status = 'processing'
    }

    // Se retornou NFS-e autorizada (modo síncrono)
    if (nfseData) {
      updateData.numero_nfse = nfseData.numero_nfse
      updateData.codigo_verificacao = nfseData.codigo_verificacao
      updateData.status = 'authorized'
      updateData.data_autorizacao = new Date().toISOString()

      const nfseXml = extractNFSeXml(responseXml)
      if (nfseXml) {
        updateData.xml_nfse = nfseXml
      }
    }

    if (errors.length > 0) {
      updateData.status = 'error'
      updateData.codigo_erro = errors[0].codigo
      updateData.mensagem_erro = errors.map(e => `${e.codigo}: ${e.mensagem}`).join('; ')
    }

    await supabase.from('nfse').update(updateData).eq('id', nfse_id)

    // Registrar log
    await supabase.from('nfse_log').insert({
      nfse_id: nfse_id,
      operacao: `enviar_${modo_envio}`,
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: errors.length === 0,
      codigo_retorno: errors.length > 0 ? errors[0].codigo : null,
      mensagem_retorno: errors.length > 0 ? errors[0].mensagem :
        (nfseData ? `NFS-e autorizada: ${nfseData.numero_nfse}` : 'Lote enviado com sucesso'),
      protocolo: protocolo
    })

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        protocolo,
        numero_nfse: nfseData?.numero_nfse,
        codigo_verificacao: nfseData?.codigo_verificacao,
        errors,
        xml_rps: rpsXml,
        modo_envio,
        message: isHomologacao
          ? `XML gerado (ambiente homologação - simulado) - Modo: ${modo_envio}`
          : (nfseData ? `NFS-e autorizada: ${nfseData.numero_nfse}` :
             (errors.length === 0 ? 'Lote enviado' : 'Erro no envio'))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: errors.length === 0 ? 200 : 400
      }
    )

  } catch (error: any) {
    console.error('Erro na Edge Function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
