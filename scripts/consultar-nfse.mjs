// Script para consultar status de NFS-e no webservice
// Consulta por protocolo (ConsultarLoteRps) ou por RPS (ConsultarNfseRps)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import forge from 'node-forge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações
const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const CERT_PATH = join(__dirname, '..', 'certificado', 'ampla contabilidade.pfx');
const CERT_PASSWORD = '123456';

const WEBSERVICE_CONFIG = {
  homologacao: {
    url: 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204/nfse.asmx',
    namespace: 'http://nfse.abrasf.org.br'
  },
  goiania_producao: {
    url: 'https://nfse.goiania.go.gov.br/ws/nfse.asmx',
    namespace: 'http://nfse.goiania.go.gov.br/ws/'
  }
};

const NAMESPACE = "http://www.abrasf.org.br/nfse.xsd";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Carrega certificado
 */
function loadCertificate(pfxPath, password) {
  const pfxBuffer = readFileSync(pfxPath);
  return pfxBuffer;
}

/**
 * Gera XML ConsultarLoteRps
 */
function buildConsultaLoteXml(protocolo, cnpj, inscricaoMunicipal) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarLoteRpsEnvio xmlns="${NAMESPACE}">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${cnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Prestador>
  <Protocolo>${protocolo}</Protocolo>
</ConsultarLoteRpsEnvio>`;
}

/**
 * Gera cabeçalho XML ABRASF (obrigatório)
 * IMPORTANTE: versao do cabeçalho é "1.00", versaoDados é "2.04"
 */
function buildCabecalho() {
  return `<cabecalho versao="1.00" xmlns="http://www.abrasf.org.br/nfse.xsd"><versaoDados>2.04</versaoDados></cabecalho>`;
}

/**
 * Envelope SOAP com nfseCabecMsg e nfseDadosMsg (formato ABRASF 2.04)
 */
function wrapSoapEnvelope(xmlPayload, operation, namespace) {
  const cabecalho = buildCabecalho();
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="${namespace}">
  <soap:Body>
    <ws:${operation}>
      <ws:nfseCabecMsg><![CDATA[${cabecalho}]]></ws:nfseCabecMsg>
      <ws:nfseDadosMsg><![CDATA[${xmlPayload}]]></ws:nfseDadosMsg>
    </ws:${operation}>
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Extrai dados da NFS-e autorizada
 */
function extractNFSeData(responseXml) {
  const numeroMatch = responseXml.match(/<Numero>([^<]+)<\/Numero>/i);
  const codigoMatch = responseXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/i);
  const dataMatch = responseXml.match(/<DataEmissao>([^<]+)<\/DataEmissao>/i);

  if (numeroMatch) {
    return {
      numero_nfse: numeroMatch[1],
      codigo_verificacao: codigoMatch ? codigoMatch[1] : '',
      data_emissao: dataMatch ? dataMatch[1] : ''
    };
  }
  return null;
}

/**
 * Extrai situação do lote
 */
function extractSituacao(responseXml) {
  const match = responseXml.match(/<Situacao>([^<]+)<\/Situacao>/i);
  // 1 = Não Processado, 2 = Processado com Erro, 3 = Processado com Sucesso, 4 = Lote processado com sucesso (pelo menos uma NFS-e gerada)
  return match ? parseInt(match[1]) : null;
}

/**
 * Extrai erros
 */
function extractErrors(responseXml) {
  const errors = [];
  const regex = /<MensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>[\s\S]*?<\/MensagemRetorno>/gi;
  let match;
  while ((match = regex.exec(responseXml)) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] });
  }

  // Também ListaMensagemRetorno
  const regex2 = /<ListaMensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>/gi;
  while ((match = regex2.exec(responseXml)) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] });
  }

  return errors;
}

/**
 * Extrai XML da NFS-e
 */
function extractNFSeXml(responseXml) {
  const match = responseXml.match(/<CompNfse>([\s\S]*?)<\/CompNfse>/i);
  return match ? match[0] : null;
}

/**
 * Envia requisição SOAP
 */
async function sendSoapRequest(url, soapEnvelope, operation, soapActionBase, pfxBuffer, password) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    // SOAPAction conforme WSDL: http://nfse.abrasf.org.br/ConsultarLoteRps
    const soapAction = `http://nfse.abrasf.org.br/${operation}`;

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      pfx: pfxBuffer,
      passphrase: password,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
        'SOAPAction': soapAction
      },
      rejectUnauthorized: true
    };

    console.log(`📤 Consultando: ${url}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📥 Status HTTP: ${res.statusCode}`);
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(soapEnvelope);
    req.end();
  });
}

/**
 * Consulta lote por protocolo
 */
async function consultarLote(nfseId, ambiente = 'homologacao') {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`    CONSULTANDO NFS-e ${nfseId}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar NFS-e
  const { data: nfse, error: nfseError } = await supabase
    .from('nfse')
    .select('*')
    .eq('id', nfseId)
    .single();

  if (nfseError || !nfse) {
    throw new Error(`NFS-e não encontrada: ${nfseError?.message}`);
  }

  if (!nfse.protocolo) {
    throw new Error('NFS-e não possui protocolo. Envie o lote primeiro.');
  }

  console.log(`📄 RPS: ${nfse.numero_rps}/${nfse.serie_rps}`);
  console.log(`📋 Protocolo: ${nfse.protocolo}`);
  console.log(`📊 Status atual: ${nfse.status}`);

  // Carregar certificado
  const pfxBuffer = loadCertificate(CERT_PATH, CERT_PASSWORD);

  // Gerar XML de consulta
  const consultaXml = buildConsultaLoteXml(
    nfse.protocolo,
    nfse.prestador_cnpj,
    nfse.prestador_inscricao_municipal
  );

  // Enviar
  const wsConfig = WEBSERVICE_CONFIG[ambiente] || WEBSERVICE_CONFIG.homologacao;
  const soapEnvelope = wrapSoapEnvelope(consultaXml, 'ConsultarLoteRps', wsConfig.namespace);

  console.log('\n📤 Consultando webservice...');
  const response = await sendSoapRequest(
    wsConfig.url,
    soapEnvelope,
    'ConsultarLoteRps',
    wsConfig.namespace,
    pfxBuffer,
    CERT_PASSWORD
  );

  console.log('\n📋 Resposta completa:');
  console.log(response.body);

  const situacao = extractSituacao(response.body);
  const nfseData = extractNFSeData(response.body);
  const errors = extractErrors(response.body);

  console.log('\n═══════════════════════════════════════════════════════════════');

  if (situacao) {
    const situacaoDesc = {
      1: '⏳ Não Processado',
      2: '❌ Processado com Erro',
      3: '✅ Processado com Sucesso',
      4: '✅ Processado com Sucesso (NFS-e gerada)'
    };
    console.log(`📊 Situação: ${situacaoDesc[situacao] || situacao}`);
  }

  if (nfseData) {
    console.log(`\n🎉 NFS-e AUTORIZADA!`);
    console.log(`   Número: ${nfseData.numero_nfse}`);
    console.log(`   Código Verificação: ${nfseData.codigo_verificacao}`);
    console.log(`   Data Emissão: ${nfseData.data_emissao}`);

    // Atualizar banco
    const nfseXml = extractNFSeXml(response.body);
    await supabase.from('nfse').update({
      numero_nfse: nfseData.numero_nfse,
      codigo_verificacao: nfseData.codigo_verificacao,
      status: 'authorized',
      data_autorizacao: nfseData.data_emissao || new Date().toISOString(),
      xml_nfse: nfseXml,
      updated_at: new Date().toISOString()
    }).eq('id', nfseId);

    console.log(`\n✅ Banco de dados atualizado!`);
  }

  if (errors.length > 0) {
    console.log(`\n❌ Erros encontrados:`);
    errors.forEach(e => console.log(`   ${e.codigo}: ${e.mensagem}`));

    await supabase.from('nfse').update({
      status: 'error',
      codigo_erro: errors[0].codigo,
      mensagem_erro: errors.map(e => `${e.codigo}: ${e.mensagem}`).join('; '),
      updated_at: new Date().toISOString()
    }).eq('id', nfseId);
  }

  // Log
  await supabase.from('nfse_log').insert({
    nfse_id: nfseId,
    operacao: 'consultar_lote',
    request_xml: soapEnvelope,
    response_xml: response.body,
    response_timestamp: new Date().toISOString(),
    sucesso: nfseData !== null,
    codigo_retorno: errors[0]?.codigo,
    mensagem_retorno: nfseData ? `NFS-e: ${nfseData.numero_nfse}` : errors[0]?.mensagem,
    protocolo: nfse.protocolo
  });

  console.log('═══════════════════════════════════════════════════════════════\n');

  return { situacao, nfseData, errors };
}

// Main
const args = process.argv.slice(2);
const nfseId = args[0];
const ambiente = args[1] || 'homologacao';

if (!nfseId) {
  console.log('Uso: node consultar-nfse.mjs <nfse_id> [ambiente]');
  process.exit(1);
}

consultarLote(nfseId, ambiente).catch(err => {
  console.error('❌ ERRO:', err.message);
  process.exit(1);
});
