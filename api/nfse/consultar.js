import { createClient } from '@supabase/supabase-js';
import {
  extractErrors,
  extractNFSeData,
  extractNFSeXml,
  loadCertificateFromEnv,
  sendSoapRequest,
  wrapSoapEnvelope,
} from '../_shared/nfse-abrasf204.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header) return null;
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function getWebserviceConfig(config) {
  const ambiente = config.ambiente === 'producao' ? 'producao' : 'homologacao';

  if (ambiente === 'producao') {
    const base = config.base_url_producao || 'https://nfse.goiania.go.gov.br/ws';
    return {
      ambiente,
      url: `${base}/${config.endpoint || 'nfse.asmx'}`,
      soapNamespace: 'http://nfse.goiania.go.gov.br/ws/',
      soapActionBase: 'http://nfse.goiania.go.gov.br',
    };
  }

  const base = config.base_url_homologacao || 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204';
  return {
    ambiente,
    url: `${base}/${config.endpoint || 'nfse.asmx'}`,
    soapNamespace: 'http://nfse.abrasf.org.br',
    soapActionBase: 'http://nfse.abrasf.org.br',
  };
}

function buildConsultaLoteXml(protocolo, prestadorCnpj, inscricaoMunicipal) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${prestadorCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Prestador>
  <Protocolo>${protocolo}</Protocolo>
</ConsultarLoteRpsEnvio>`;
}

function buildConsultaRpsXml(numeroRps, serieRps, tipoRps, prestadorCnpj, inscricaoMunicipal) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
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
</ConsultarNfseRpsEnvio>`;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados no servidor');
    }

    const token = getBearerToken(req);
    if (!token) {
      res.statusCode = 401;
      res.json({ error: 'Authorization Bearer token obrigatório' });
      return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      res.statusCode = 401;
      res.json({ error: 'Token inválido' });
      return;
    }

    const body = await readJson(req);
    const nfse_id = body.nfse_id;
    const tipo_consulta = body.tipo_consulta || 'lote';
    const protocolo = body.protocolo;

    if (!nfse_id) throw new Error('nfse_id é obrigatório');

    const { data: nfse, error: nfseError } = await supabase
      .from('nfse')
      .select('*')
      .eq('id', nfse_id)
      .single();

    if (nfseError || !nfse) throw new Error(`NFS-e não encontrada: ${nfseError?.message}`);

    if (nfse.created_by && nfse.created_by !== userData.user.id) {
      res.statusCode = 403;
      res.json({ error: 'Sem permissão para consultar esta NFS-e' });
      return;
    }

    const { data: config, error: configError } = await supabase
      .from('nfse_config')
      .select('*')
      .eq('prestador_cnpj', nfse.prestador_cnpj)
      .single();

    if (configError || !config) throw new Error(`Configuração não encontrada: ${configError?.message}`);

    const ws = getWebserviceConfig(config);

    let consultaXml;
    let soapOperation;

    if (tipo_consulta === 'rps') {
      consultaXml = buildConsultaRpsXml(
        nfse.numero_rps,
        nfse.serie_rps || 'A',
        1,
        nfse.prestador_cnpj,
        nfse.prestador_inscricao_municipal
      );
      soapOperation = 'ConsultarNfseRps';
    } else {
      const protocoloConsulta = protocolo || nfse.protocolo;
      if (!protocoloConsulta) {
        throw new Error('Protocolo não disponível; use tipo_consulta="rps"');
      }
      consultaXml = buildConsultaLoteXml(
        protocoloConsulta,
        nfse.prestador_cnpj,
        nfse.prestador_inscricao_municipal
      );
      soapOperation = 'ConsultarLoteRps';
    }

    // Certificado mTLS
    const { pfxBuffer, password } = loadCertificateFromEnv();

    const { body: responseXml, statusCode, soapEnvelope } = await sendSoapRequest({
      url: ws.url,
      operation: soapOperation,
      soapActionBase: ws.soapActionBase,
      soapNamespace: ws.soapNamespace,
      xmlPayload: consultaXml,
      pfxBuffer,
      passphrase: password,
    });

    const nfseData = extractNFSeData(responseXml);
    const nfseXml = extractNFSeXml(responseXml);
    const errors = extractErrors(responseXml);

    // Atualizar DB se autorizou
    if (nfseData && nfseData.numero_nfse) {
      await supabase
        .from('nfse')
        .update({
          numero_nfse: nfseData.numero_nfse,
          codigo_verificacao: nfseData.codigo_verificacao,
          status: 'authorized',
          data_autorizacao: new Date().toISOString(),
          xml_nfse: nfseXml || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', nfse_id);
    }

    await supabase.from('nfse_log').insert({
      nfse_id,
      operacao: tipo_consulta === 'rps' ? 'consultar_nfse_rps' : 'consultar_lote',
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: errors.length === 0,
      codigo_retorno: errors[0]?.codigo || null,
      mensagem_retorno: errors[0]?.mensagem || 'OK',
      protocolo: nfse.protocolo || null,
    });

    res.statusCode = errors.length === 0 ? 200 : 400;
    res.json({
      success: errors.length === 0,
      http_status: statusCode,
      ambiente: ws.ambiente,
      endpoint: ws.url,
      tipo_consulta,
      numero_nfse: nfseData?.numero_nfse,
      codigo_verificacao: nfseData?.codigo_verificacao,
      xml_nfse: nfseXml,
      errors,
    });
  } catch (err) {
    res.statusCode = 500;
    res.json({ error: err?.message || String(err) });
  }
}
