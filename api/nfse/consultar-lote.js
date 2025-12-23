/**
 * API: Consultar Lote RPS
 * Consulta o resultado do processamento de um lote de RPS
 */

import { createClient } from '@supabase/supabase-js';
import {
  buildConsultarLoteRpsXml,
  extractErrors,
  extractNFSeData,
  extractNFSeList,
  extractNFSeXml,
  loadCertificateFromEnv,
  sendSoapRequest,
} from '../_shared/nfse-abrasf204.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
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

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.statusCode = 405;
    res.json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Parâmetros
    const body = req.method === 'POST' ? await readJson(req) : {};
    const query = req.query || {};

    const protocolo = body.protocolo || query.protocolo;
    const nfse_id = body.nfse_id || query.nfse_id;

    if (!protocolo && !nfse_id) {
      throw new Error('protocolo ou nfse_id é obrigatório');
    }

    let protocoloConsulta = protocolo;
    let nfseLocal = null;

    // Se veio nfse_id, buscar protocolo
    if (nfse_id) {
      const { data, error } = await supabase
        .from('nfse')
        .select('*')
        .eq('id', nfse_id)
        .single();

      if (error || !data) {
        throw new Error(`NFS-e não encontrada: ${error?.message}`);
      }

      nfseLocal = data;
      protocoloConsulta = data.protocolo;

      if (!protocoloConsulta) {
        throw new Error('NFS-e não possui protocolo. Verifique se foi enviada corretamente.');
      }
    }

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('nfse_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error(`Configuração não encontrada: ${configError?.message}`);
    }

    const ws = getWebserviceConfig(config);

    // Carregar certificado
    const { pfxBuffer, password } = loadCertificateFromEnv();

    // Construir XML de consulta
    const xmlConsulta = buildConsultarLoteRpsXml(
      protocoloConsulta,
      config.prestador_cnpj,
      config.prestador_inscricao_municipal
    );

    // Enviar requisição SOAP
    const { body: responseXml, statusCode, soapEnvelope } = await sendSoapRequest({
      url: ws.url,
      operation: 'ConsultarLoteRps',
      soapActionBase: ws.soapActionBase,
      soapNamespace: ws.soapNamespace,
      xmlPayload: xmlConsulta,
      pfxBuffer,
      passphrase: password,
    });

    // Extrair dados
    const nfseData = extractNFSeData(responseXml);
    const nfseList = extractNFSeList(responseXml);
    const errors = extractErrors(responseXml);
    const nfseXml = extractNFSeXml(responseXml);

    // Determinar situação
    let situacao = 'processando';
    if (nfseData?.numero_nfse) {
      situacao = 'autorizada';
    } else if (errors.length > 0) {
      situacao = 'erro';
    }

    // Log da operação
    await supabase.from('nfse_log').insert({
      nfse_id: nfseLocal?.id || null,
      operacao: 'consultar_lote_rps',
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: situacao === 'autorizada',
      protocolo: protocoloConsulta,
      codigo_retorno: errors[0]?.codigo || null,
      mensagem_retorno: errors[0]?.mensagem || (situacao === 'autorizada' ? `NFS-e ${nfseData.numero_nfse} autorizada` : 'Em processamento'),
    });

    // Atualizar NFS-e local se encontrada
    if (nfseLocal && situacao === 'autorizada' && nfseData) {
      await supabase
        .from('nfse')
        .update({
          status: 'authorized',
          numero_nfse: nfseData.numero_nfse,
          codigo_verificacao: nfseData.codigo_verificacao,
          data_autorizacao: nfseData.data_emissao || new Date().toISOString(),
          xml_nfse: nfseXml,
          updated_at: new Date().toISOString(),
        })
        .eq('id', nfseLocal.id);
    } else if (nfseLocal && situacao === 'erro') {
      await supabase
        .from('nfse')
        .update({
          status: 'error',
          codigo_erro: errors[0]?.codigo,
          mensagem_erro: errors.map(e => `${e.codigo}: ${e.mensagem}`).join('; '),
          updated_at: new Date().toISOString(),
        })
        .eq('id', nfseLocal.id);
    }

    res.statusCode = situacao !== 'erro' ? 200 : 400;
    res.json({
      success: situacao === 'autorizada',
      situacao,
      protocolo: protocoloConsulta,
      nfse_id: nfseLocal?.id || null,
      ambiente: ws.ambiente,
      numero_nfse: nfseData?.numero_nfse || null,
      codigo_verificacao: nfseData?.codigo_verificacao || null,
      data_emissao: nfseData?.data_emissao || null,
      nfse_list: nfseList,
      errors,
    });

  } catch (err) {
    console.error('Erro:', err);
    res.statusCode = 500;
    res.json({ error: err?.message || String(err) });
  }
}
