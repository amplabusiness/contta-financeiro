import { createClient } from '@supabase/supabase-js';
import {
  extractNFSeData,
  extractNFSeXml,
  extractErrors,
  extractProtocol,
  loadCertificateFromEnv,
  sendSoapRequest,
} from '../_shared/nfse-abrasf204.js';

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

// Função para consultar RPS via SOAP
async function consultarRps(rpsnumber, serie, pfxBuffer, passphrase, ws) {
  const consultaXml = `
    <ConsultarNfsePorRpsEnvio xmlns="http://nfse.abrasf.org.br">
      <IdentificacaoRps>
        <Numero>${rpsnumber}</Numero>
        <Serie>${serie}</Serie>
        <Tipo>1</Tipo>
      </IdentificacaoRps>
    </ConsultarNfsePorRpsEnvio>
  `.trim();

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    <ConsultarNfsePorRps xmlns="${ws.soapNamespace}">
      <consultarNfsePorRpsEnvio>${Buffer.from(consultaXml).toString('base64')}</consultarNfsePorRpsEnvio>
    </ConsultarNfsePorRps>
  </soap:Body>
</soap:Envelope>`;

  const response = await sendSoapRequest({
    url: ws.url,
    operation: 'ConsultarNfsePorRps',
    soapActionBase: ws.soapActionBase,
    soapNamespace: ws.soapNamespace,
    xmlPayload: soapEnvelope,
    pfxBuffer,
    passphrase,
  });

  return response;
}

export default async function handler(req, res) {
  // OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis SUPABASE não configuradas');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Buscar NFS-e em processamento
    const { data: nfsesProcessando, error: selectError } = await supabase
      .from('nfse')
      .select('id, numero_rps, serie_rps, protocolo, status, created_at')
      .eq('status', 'processing')
      .order('created_at', { ascending: true });

    if (selectError) throw selectError;

    if (!nfsesProcessando || nfsesProcessando.length === 0) {
      res.json({
        message: 'Nenhuma NFS-e em processamento',
        checked: 0,
        updated: 0,
      });
      return;
    }

    console.log(`📋 Consultando ${nfsesProcessando.length} NFS-e em processamento...`);

    // Carregar certificado
    const pfxBuffer = Buffer.from(process.env.NFSE_CERT_PFX_B64 || '', 'base64');
    const passphrase = process.env.NFSE_CERT_PASSWORD || '';

    // Buscar config
    const { data: configData } = await supabase.from('nfse_config').select('*').single();
    const ws = getWebserviceConfig(configData || {});

    let updated = 0;
    const results = [];

    // Consultar cada uma
    for (const nfse of nfsesProcessando) {
      try {
        console.log(`🔍 Consultando RPS ${nfse.numero_rps}/${nfse.serie_rps}...`);

        const responseXml = await consultarRps(
          nfse.numero_rps,
          nfse.serie_rps,
          pfxBuffer,
          passphrase,
          ws
        );

        // Extrair dados
        const nfseData = extractNFSeData(responseXml);
        const errors = extractErrors(responseXml);

        if (nfseData && nfseData.numero_nfse) {
          // Aprovada!
          const { error: updateError } = await supabase
            .from('nfse')
            .update({
              status: 'approved',
              numero_nfse: nfseData.numero_nfse,
              codigo_verificacao: nfseData.codigo_verificacao,
              response_xml: responseXml,
              updated_at: new Date().toISOString(),
            })
            .eq('id', nfse.id);

          if (!updateError) {
            console.log(`✅ NFS-e ${nfseData.numero_nfse} aprovada!`);
            results.push({
              rps: `${nfse.numero_rps}/${nfse.serie_rps}`,
              status: 'approved',
              numero_nfse: nfseData.numero_nfse,
            });
            updated++;
          }
        } else if (errors && errors.length > 0) {
          // Erro
          console.log(`❌ RPS ${nfse.numero_rps} com erro:`, errors[0].mensagem);
          results.push({
            rps: `${nfse.numero_rps}/${nfse.serie_rps}`,
            status: 'error',
            erro: errors[0].mensagem,
          });
        } else {
          // Ainda processando
          console.log(`⏳ RPS ${nfse.numero_rps} ainda em processamento...`);
          results.push({
            rps: `${nfse.numero_rps}/${nfse.serie_rps}`,
            status: 'processing',
          });
        }

        // Aguardar um pouco entre requisições
        await new Promise(r => setTimeout(r, 1000));
      } catch (err) {
        console.error(`❌ Erro ao consultar RPS ${nfse.numero_rps}:`, err.message);
        results.push({
          rps: `${nfse.numero_rps}/${nfse.serie_rps}`,
          status: 'error_consulta',
          erro: err.message,
        });
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.json({
      message: 'Consulta de status concluída',
      checked: nfsesProcessando.length,
      updated,
      results,
    });
  } catch (err) {
    console.error('❌ Erro ao processar:', err.message);
    res.statusCode = 500;
    res.json({ error: err.message });
  }
}
