// Edge Function para emissão de NFS-e via webservice ABRASF 2.04
// Esta função requer certificado digital A1 configurado

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
  prestador_cnpj: string
  inscricao_municipal: string
  tomador_cnpj: string
  tomador_razao_social: string
  discriminacao: string
  codigo_municipio: string
  valor_servicos: number
  aliquota: number
  valor_iss: number
  exigibilidade_iss: number
  item_lista_servico: string
  codigo_cnae: string
  numero_rps: string
  serie_rps: string
  competencia: string
}

// Gera XML do RPS no padrão ABRASF 2.04
function buildRpsXml(data: RpsData): string {
  const loteId = `L${data.numero_rps}`
  const rpsId = `R${data.numero_rps}`

  // ExigibilidadeISS:
  // 1 = Exigível
  // 2 = Não incidência
  // 3 = Isenção
  // 4 = Exportação (ou ISS Fixo - Sociedade de Profissionais)
  // 5 = Imunidade
  // 6 = Exigibilidade suspensa por decisão judicial
  // 7 = Exigibilidade suspensa por processo administrativo

  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="${NAMESPACE}">
  <LoteRps Id="${loteId}" versao="2.04">
    <NumeroLote>${data.numero_rps}</NumeroLote>
    <Cnpj>${data.prestador_cnpj}</Cnpj>
    <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfDeclaracaoPrestacaoServico Id="${rpsId}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${data.numero_rps}</Numero>
              <Serie>${data.serie_rps}</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
          </Rps>
          <Competencia>${data.competencia}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${data.valor_servicos.toFixed(2)}</ValorServicos>
              <ValorIss>${data.valor_iss.toFixed(2)}</ValorIss>
              <IssRetido>2</IssRetido>
              <Aliquota>${data.aliquota.toFixed(4)}</Aliquota>
            </Valores>
            <ItemListaServico>${data.item_lista_servico.replace('.', '')}</ItemListaServico>
            <CodigoCnae>${data.codigo_cnae}</CodigoCnae>
            <Discriminacao>${escapeXml(data.discriminacao)}</Discriminacao>
            <CodigoMunicipio>${data.codigo_municipio}</CodigoMunicipio>
            <ExigibilidadeISS>${data.exigibilidade_iss}</ExigibilidadeISS>
          </Servico>
          <Prestador>
            <Cnpj>${data.prestador_cnpj}</Cnpj>
            <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <Cnpj>${data.tomador_cnpj}</Cnpj>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(data.tomador_razao_social)}</RazaoSocial>
          </Tomador>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`
}

// Envelope SOAP
function wrapSoapEnvelope(xmlPayload: string, operation: string = "RecepcionarLoteRps"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="http://nfse.abrasf.org.br">
  <soap:Body>
    <nfse:${operation}>
      <nfse:xmlEnvio><![CDATA[${xmlPayload}]]></nfse:xmlEnvio>
    </nfse:${operation}>
  </soap:Body>
</soap:Envelope>`
}

function escapeXml(str: string): string {
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

// Extrai erros da resposta
function extractErrors(responseXml: string): { codigo: string; mensagem: string }[] {
  const errors: { codigo: string; mensagem: string }[] = []
  const errorRegex = /<MensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>[\s\S]*?<\/MensagemRetorno>/gi
  let match
  while ((match = errorRegex.exec(responseXml)) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] })
  }
  return errors
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

    const { nfse_id, operacao = 'emitir' } = await req.json()

    if (!nfse_id) {
      throw new Error('nfse_id é obrigatório')
    }

    // Buscar dados da NFS-e
    const { data: nfse, error: nfseError } = await supabase
      .from('nfse')
      .select('*')
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

    // Montar dados do RPS
    const rpsData: RpsData = {
      nfse_id: nfse.id,
      prestador_cnpj: nfse.prestador_cnpj,
      inscricao_municipal: nfse.prestador_inscricao_municipal,
      tomador_cnpj: nfse.tomador_cnpj || '',
      tomador_razao_social: nfse.tomador_razao_social,
      discriminacao: nfse.discriminacao,
      codigo_municipio: nfse.codigo_municipio || '5208707',
      valor_servicos: parseFloat(nfse.valor_servicos),
      aliquota: parseFloat(nfse.aliquota || '0'),
      valor_iss: parseFloat(nfse.valor_iss || '0'),
      exigibilidade_iss: nfse.exigibilidade_iss || 4, // 4 = ISS Fixo (Sociedade de Profissionais)
      item_lista_servico: nfse.item_lista_servico || '17.18',
      codigo_cnae: nfse.codigo_cnae || '6920602',
      numero_rps: nfse.numero_rps,
      serie_rps: nfse.serie_rps || 'A',
      competencia: nfse.competencia
    }

    // Gerar XML
    const rpsXml = buildRpsXml(rpsData)
    const soapEnvelope = wrapSoapEnvelope(rpsXml)

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
    let errors: { codigo: string; mensagem: string }[] = []

    if (isHomologacao) {
      // Em homologação, apenas salvar o XML gerado
      protocolo = `SIM-${Date.now()}`
      responseXml = `<Protocolo>${protocolo}</Protocolo>`
    } else {
      // Tentativa de envio real (pode falhar sem mTLS)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://nfse.abrasf.org.br/RecepcionarLoteRps'
          },
          body: soapEnvelope
        })
        responseXml = await response.text()
        protocolo = extractProtocol(responseXml)
        errors = extractErrors(responseXml)
      } catch (fetchError: any) {
        errors = [{ codigo: 'CONN', mensagem: `Erro de conexão: ${fetchError.message}. Certificado mTLS necessário.` }]
      }
    }

    // Atualizar NFS-e no banco
    const updateData: any = {
      xml_rps: rpsXml,
      updated_at: new Date().toISOString()
    }

    if (protocolo) {
      updateData.protocolo = protocolo
      updateData.status = 'processing'
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
      operacao: 'enviar_lote',
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: errors.length === 0,
      codigo_retorno: errors.length > 0 ? errors[0].codigo : null,
      mensagem_retorno: errors.length > 0 ? errors[0].mensagem : 'Lote enviado com sucesso',
      protocolo: protocolo
    })

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        protocolo,
        errors,
        xml_rps: rpsXml,
        message: isHomologacao
          ? 'XML gerado (ambiente homologação - simulado)'
          : (errors.length === 0 ? 'Lote enviado' : 'Erro no envio')
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
