// Edge Function para consultar status de NFS-e via webservice ABRASF 2.04
// Suporta: ConsultarLoteRps (por protocolo) e ConsultarNfseRps (por RPS)
// IMPORTANTE: Sempre usar ConsultarNfseRps antes de reenviar para evitar duplicidade!

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Namespace ABRASF
const NAMESPACE = "http://www.abrasf.org.br/nfse.xsd"

// Gera XML de consulta por protocolo (ConsultarLoteRps)
function buildConsultaLoteXml(protocolo: string, prestadorCnpj: string, inscricaoMunicipal: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarLoteRpsEnvio xmlns="${NAMESPACE}">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${prestadorCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Prestador>
  <Protocolo>${protocolo}</Protocolo>
</ConsultarLoteRpsEnvio>`
}

// Gera XML de consulta por RPS (ConsultarNfseRps)
// USAR ESTE MÉTODO ANTES DE REENVIAR PARA EVITAR DUPLICIDADE!
function buildConsultaRpsXml(
  numeroRps: string,
  serieRps: string,
  tipoRps: number,
  prestadorCnpj: string,
  inscricaoMunicipal: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseRpsEnvio xmlns="${NAMESPACE}">
  <IdentificacaoRps>
    <Numero>${numeroRps}</Numero>
    <Serie>${serieRps}</Serie>
    <Tipo>${tipoRps}</Tipo>
  </IdentificacaoRps>
  <Prestador>
    <CpfCnpj>
      <Cnpj>${prestadorCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Prestador>
</ConsultarNfseRpsEnvio>`
}

// Envelope SOAP
function wrapSoapEnvelope(xmlPayload: string, operation: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="http://nfse.abrasf.org.br">
  <soap:Body>
    <nfse:${operation}>
      <nfse:xmlEnvio><![CDATA[${xmlPayload}]]></nfse:xmlEnvio>
    </nfse:${operation}>
  </soap:Body>
</soap:Envelope>`
}

// Extrai dados da NFS-e autorizada
function extractNFSeData(responseXml: string): { numero_nfse: string; codigo_verificacao: string; data_emissao?: string } | null {
  const numeroMatch = responseXml.match(/<Numero>([^<]+)<\/Numero>/i)
  const codigoMatch = responseXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/i)
  const dataMatch = responseXml.match(/<DataEmissao>([^<]+)<\/DataEmissao>/i)

  if (numeroMatch) {
    return {
      numero_nfse: numeroMatch[1],
      codigo_verificacao: codigoMatch ? codigoMatch[1] : '',
      data_emissao: dataMatch ? dataMatch[1] : undefined
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

// Verifica se erro indica que NFS-e não foi encontrada (não existe)
function isNotFoundError(errors: { codigo: string; mensagem: string }[]): boolean {
  const notFoundCodes = ['E4', 'E10', 'E78', 'E79', 'E156']
  const notFoundTerms = ['não encontrad', 'nao encontrad', 'inexistente', 'não localiza', 'nao localiza']

  return errors.some(e =>
    notFoundCodes.includes(e.codigo) ||
    notFoundTerms.some(term => e.mensagem.toLowerCase().includes(term))
  )
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
      tipo_consulta = 'lote', // 'lote' (por protocolo) ou 'rps' (por número RPS)
      protocolo
    } = await req.json()

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

    // Determinar tipo de consulta e gerar XML
    let consultaXml: string
    let soapOperation: string

    if (tipo_consulta === 'rps') {
      // Consulta por RPS - usar antes de reenviar!
      consultaXml = buildConsultaRpsXml(
        nfse.numero_rps,
        nfse.serie_rps || 'A',
        1, // Tipo 1 = RPS
        nfse.prestador_cnpj,
        nfse.prestador_inscricao_municipal
      )
      soapOperation = 'ConsultarNfseRps'
    } else {
      // Consulta por protocolo (padrão)
      const protocoloConsulta = protocolo || nfse.protocolo

      if (!protocoloConsulta) {
        throw new Error('Protocolo não disponível para consulta. Use tipo_consulta="rps" para consultar pelo número do RPS.')
      }

      // Verificar se é protocolo simulado (homologação)
      if (protocoloConsulta.startsWith('SIM-')) {
        return new Response(
          JSON.stringify({
            success: true,
            status: 'simulated',
            message: 'Ambiente de homologação - NFS-e simulada. Em produção, consulte o portal da prefeitura.',
            protocolo: protocoloConsulta,
            numero_rps: nfse.numero_rps
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      consultaXml = buildConsultaLoteXml(
        protocoloConsulta,
        nfse.prestador_cnpj,
        nfse.prestador_inscricao_municipal
      )
      soapOperation = 'ConsultarLoteRps'
    }

    const soapEnvelope = wrapSoapEnvelope(consultaXml, soapOperation)

    // Determinar URL do webservice
    const baseUrl = config.ambiente === 'producao'
      ? config.base_url_producao
      : config.base_url_homologacao

    const endpoint = `${baseUrl}/${config.endpoint}`

    let responseXml = ''
    let nfseData: { numero_nfse: string; codigo_verificacao: string; data_emissao?: string } | null = null
    let errors: { codigo: string; mensagem: string }[] = []

    // Simular em homologação
    if (config.ambiente === 'homologacao') {
      // Simular resposta de homologação
      if (tipo_consulta === 'rps') {
        // Simular que NFS-e já existe para o RPS
        if (nfse.status === 'authorized' || nfse.numero_nfse) {
          nfseData = {
            numero_nfse: nfse.numero_nfse || `SIM${nfse.numero_rps}`,
            codigo_verificacao: nfse.codigo_verificacao || 'SIMVERIF'
          }
        } else {
          // Simular que não existe NFS-e para este RPS (pode reenviar)
          errors = [{ codigo: 'E4', mensagem: 'NFS-e não encontrada para este RPS (ambiente simulado)' }]
        }
      } else {
        // Consulta por protocolo em homologação
        nfseData = {
          numero_nfse: nfse.numero_nfse || `SIM${nfse.numero_rps}`,
          codigo_verificacao: nfse.codigo_verificacao || 'SIMVERIF'
        }
      }
      responseXml = '<SimulatedResponse>Homologacao</SimulatedResponse>'
    } else {
      // Tentativa de consulta real
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
        nfseData = extractNFSeData(responseXml)
        errors = extractErrors(responseXml)
      } catch (fetchError: any) {
        errors = [{ codigo: 'CONN', mensagem: `Erro de conexão: ${fetchError.message}. Certificado mTLS necessário.` }]
      }
    }

    // Registrar log da consulta
    await supabase.from('nfse_log').insert({
      nfse_id: nfse_id,
      operacao: tipo_consulta === 'rps' ? 'consultar_rps' : 'consultar_lote',
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: nfseData !== null || isNotFoundError(errors),
      codigo_retorno: errors.length > 0 ? errors[0].codigo : null,
      mensagem_retorno: nfseData
        ? `NFS-e encontrada: ${nfseData.numero_nfse}`
        : (errors.length > 0 ? errors[0].mensagem : 'Consulta realizada'),
      protocolo: nfse.protocolo
    })

    // Se encontrou dados da NFS-e, atualizar no banco
    if (nfseData) {
      const nfseXml = extractNFSeXml(responseXml)

      await supabase.from('nfse').update({
        numero_nfse: nfseData.numero_nfse,
        codigo_verificacao: nfseData.codigo_verificacao,
        status: 'authorized',
        data_autorizacao: nfseData.data_emissao || new Date().toISOString(),
        xml_nfse: nfseXml,
        updated_at: new Date().toISOString()
      }).eq('id', nfse_id)

      return new Response(
        JSON.stringify({
          success: true,
          status: 'authorized',
          numero_nfse: nfseData.numero_nfse,
          codigo_verificacao: nfseData.codigo_verificacao,
          message: 'NFS-e autorizada!',
          pode_reenviar: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Se houve erros
    if (errors.length > 0) {
      const notFound = isNotFoundError(errors)

      // Se não encontrou (consulta por RPS), indica que pode reenviar
      if (notFound && tipo_consulta === 'rps') {
        return new Response(
          JSON.stringify({
            success: true,
            status: 'not_found',
            message: 'NFS-e não encontrada para este RPS. Pode enviar/reenviar sem risco de duplicidade.',
            pode_reenviar: true,
            numero_rps: nfse.numero_rps,
            serie_rps: nfse.serie_rps
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: false,
          status: 'error',
          error: errors[0].mensagem,
          errors,
          pode_reenviar: notFound
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Ainda processando (sem NFS-e e sem erros)
    return new Response(
      JSON.stringify({
        success: true,
        status: 'processing',
        message: 'NFS-e ainda está sendo processada. Consulte novamente em alguns segundos.',
        protocolo: nfse.protocolo,
        pode_reenviar: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
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
