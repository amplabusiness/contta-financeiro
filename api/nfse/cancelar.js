/**
 * API: Cancelar NFS-e
 * Solicita o cancelamento de uma NFS-e autorizada
 */

import { createClient } from '@supabase/supabase-js';
import {
  buildCancelarNfseXml,
  extractCancelamentoInfo,
  extractErrors,
  loadCertificateFromEnv,
  sendSoapRequest,
  signXml,
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

function getWebserviceConfig(config) {
  const ambiente = config.ambiente === 'producao' ? 'producao' : 'homologacao';

  if (ambiente === 'producao') {
    const base = config.base_url_producao || 'https://nfse.goiania.go.gov.br/ws';
    return {
      ambiente,
      url: `${base}/${config.endpoint || 'nfse.asmx'}`,
      soapNamespace: 'http://nfse.goiania.go.gov.br/ws/',
      soapActionBase: 'http://nfse.goiania.go.gov.br',
      codigoMunicipio: '5208707',
    };
  }

  const base = config.base_url_homologacao || 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204';
  return {
    ambiente,
    url: `${base}/${config.endpoint || 'nfse.asmx'}`,
    soapNamespace: 'http://nfse.abrasf.org.br',
    soapActionBase: 'http://nfse.abrasf.org.br',
    codigoMunicipio: '5002704', // Campo Grande MS para homologação
  };
}

// Códigos de cancelamento ABRASF
const CODIGOS_CANCELAMENTO = {
  '1': 'Erro na emissão',
  '2': 'Serviço não prestado',
  '3': 'Erro de assinatura',
  '4': 'Duplicidade da nota',
  '5': 'Erro no processamento',
  '9': 'Outros',
};

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
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await readJson(req);
    const { nfse_id, numero_nfse, codigo_cancelamento = '1', motivo } = body;

    if (!nfse_id && !numero_nfse) {
      throw new Error('nfse_id ou numero_nfse é obrigatório');
    }

    // Buscar NFS-e
    let nfseQuery = supabase.from('nfse').select('*');
    if (nfse_id) {
      nfseQuery = nfseQuery.eq('id', nfse_id);
    } else {
      nfseQuery = nfseQuery.eq('numero_nfse', numero_nfse);
    }

    const { data: nfse, error: nfseError } = await nfseQuery.single();

    if (nfseError || !nfse) {
      throw new Error(`NFS-e não encontrada: ${nfseError?.message}`);
    }

    if (nfse.status === 'cancelled') {
      throw new Error('NFS-e já está cancelada');
    }

    if (nfse.status !== 'authorized') {
      throw new Error(`NFS-e com status "${nfse.status}" não pode ser cancelada. Apenas notas autorizadas podem ser canceladas.`);
    }

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('nfse_config')
      .select('*')
      .eq('prestador_cnpj', nfse.prestador_cnpj)
      .single();

    if (configError || !config) {
      throw new Error(`Configuração não encontrada: ${configError?.message}`);
    }

    const ws = getWebserviceConfig(config);

    // Verificar se cancelamento é suportado
    if (ws.ambiente === 'producao' && config.base_url_producao?.includes('goiania')) {
      // Goiânia Legado não suporta cancelamento via WS
      throw new Error(
        'O WebService de Goiânia (modelo legado) não suporta cancelamento via API. ' +
        'O cancelamento deve ser solicitado via Processo Administrativo junto à Secretaria de Finanças. ' +
        'Contato: GIOF - (62) 3524-4040 ou suporte.nfse@goiania.go.gov.br'
      );
    }

    // Carregar certificado
    const { pfxBuffer, password, privateKeyPem, certBase64 } = loadCertificateFromEnv();

    // Construir XML de cancelamento
    const { pedidoId, xml: xmlCancelamento } = buildCancelarNfseXml(
      nfse.numero_nfse,
      nfse.prestador_cnpj,
      nfse.prestador_inscricao_municipal,
      ws.codigoMunicipio,
      codigo_cancelamento
    );

    // Assinar XML
    const xmlAssinado = signXml(xmlCancelamento, pedidoId, privateKeyPem, certBase64, false);

    // Enviar requisição SOAP
    const { body: responseXml, statusCode, soapEnvelope } = await sendSoapRequest({
      url: ws.url,
      operation: 'CancelarNfse',
      soapActionBase: ws.soapActionBase,
      soapNamespace: ws.soapNamespace,
      xmlPayload: xmlAssinado,
      pfxBuffer,
      passphrase: password,
    });

    // Extrair resultado
    const cancelamentoInfo = extractCancelamentoInfo(responseXml);
    const errors = extractErrors(responseXml);

    // Log da operação
    await supabase.from('nfse_log').insert({
      nfse_id: nfse.id,
      operacao: 'cancelar_nfse',
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: cancelamentoInfo.sucesso && errors.length === 0,
      codigo_retorno: errors[0]?.codigo || (cancelamentoInfo.sucesso ? '0' : null),
      mensagem_retorno: errors[0]?.mensagem || (cancelamentoInfo.sucesso ? 'Cancelamento realizado' : 'Falha no cancelamento'),
    });

    // Atualizar status no banco
    if (cancelamentoInfo.sucesso && errors.length === 0) {
      await supabase
        .from('nfse')
        .update({
          status: 'cancelled',
          data_cancelamento: cancelamentoInfo.data_cancelamento || new Date().toISOString(),
          motivo_cancelamento: motivo || CODIGOS_CANCELAMENTO[codigo_cancelamento] || 'Cancelamento solicitado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', nfse.id);
    }

    res.statusCode = cancelamentoInfo.sucesso && errors.length === 0 ? 200 : 400;
    res.json({
      success: cancelamentoInfo.sucesso && errors.length === 0,
      nfse_id: nfse.id,
      numero_nfse: nfse.numero_nfse,
      ambiente: ws.ambiente,
      data_cancelamento: cancelamentoInfo.data_cancelamento,
      codigo_cancelamento,
      motivo_cancelamento: CODIGOS_CANCELAMENTO[codigo_cancelamento],
      errors,
    });

  } catch (err) {
    console.error('Erro:', err);
    res.statusCode = 500;
    res.json({ error: err?.message || String(err) });
  }
}
