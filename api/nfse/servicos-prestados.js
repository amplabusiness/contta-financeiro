/**
 * API: Consultar NFS-e de Serviços Prestados
 * Busca notas fiscais de serviços que a empresa PRESTOU (receitas)
 */

import { createClient } from '@supabase/supabase-js';
import {
  buildConsultarNfseServicoPrestadoXml,
  extractErrors,
  extractNFSeList,
  extractPaginacao,
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

    // Parâmetros da requisição
    const body = req.method === 'POST' ? await readJson(req) : {};
    const query = req.query || {};

    const dataInicial = body.data_inicial || query.data_inicial;
    const dataFinal = body.data_final || query.data_final;
    const tomadorCnpj = body.tomador_cnpj || query.tomador_cnpj;
    const numeroNfse = body.numero_nfse || query.numero_nfse;
    const pagina = parseInt(body.pagina || query.pagina || '1');
    const sincronizarBanco = body.sincronizar !== false; // default true

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
    const xmlConsulta = buildConsultarNfseServicoPrestadoXml(
      config.prestador_cnpj,
      config.prestador_inscricao_municipal,
      {
        dataInicial,
        dataFinal,
        tomadorCnpj,
        numeroNfse,
        pagina,
      }
    );

    // Enviar requisição SOAP
    const { body: responseXml, statusCode, soapEnvelope } = await sendSoapRequest({
      url: ws.url,
      operation: 'ConsultarNfseServicoPrestado',
      soapActionBase: ws.soapActionBase,
      soapNamespace: ws.soapNamespace,
      xmlPayload: xmlConsulta,
      pfxBuffer,
      passphrase: password,
    });

    // Extrair dados
    const nfseList = extractNFSeList(responseXml);
    const errors = extractErrors(responseXml);
    const paginacao = extractPaginacao(responseXml);

    // Log da operação
    await supabase.from('nfse_log').insert({
      operacao: 'consultar_servico_prestado',
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: errors.length === 0,
      codigo_retorno: errors[0]?.codigo || null,
      mensagem_retorno: errors[0]?.mensagem || `${nfseList.length} NFS-e encontradas`,
    });

    // Sincronizar com tabela nfse local
    const notasSincronizadas = [];

    if (sincronizarBanco && nfseList.length > 0) {
      for (const nfse of nfseList) {
        // Buscar NFS-e local pelo número
        const { data: nfseLocal } = await supabase
          .from('nfse')
          .select('id, status')
          .eq('numero_nfse', nfse.numero_nfse)
          .maybeSingle();

        if (nfseLocal) {
          // Atualizar se não estiver autorizada ainda
          if (nfseLocal.status !== 'authorized') {
            await supabase
              .from('nfse')
              .update({
                status: 'authorized',
                codigo_verificacao: nfse.codigo_verificacao,
                data_autorizacao: nfse.data_emissao,
                xml_nfse: nfse.xml_completo,
                updated_at: new Date().toISOString(),
              })
              .eq('id', nfseLocal.id);

            notasSincronizadas.push(nfseLocal.id);
          }
        }
      }
    }

    res.statusCode = errors.length === 0 ? 200 : 400;
    res.json({
      success: errors.length === 0,
      ambiente: ws.ambiente,
      total_encontradas: nfseList.length,
      notas_sincronizadas: notasSincronizadas.length,
      paginacao,
      nfse_list: nfseList,
      errors,
    });

  } catch (err) {
    console.error('Erro:', err);
    res.statusCode = 500;
    res.json({ error: err?.message || String(err) });
  }
}
