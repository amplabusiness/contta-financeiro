// Script para enviar NFS-e ao webservice da Prefeitura de Goiânia
// Usa certificado digital A1 (PFX) para autenticação mTLS
// Padrão ABRASF 2.04

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações Supabase
const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

// Configurações do Certificado
const CERT_PATH = join(__dirname, '..', 'certificado', 'ampla contabilidade.pfx');
const CERT_PASSWORD = '123456';

// URLs do Webservice NFS-e - Padrão ABRASF 2.04
// ISSNet Online é usado para homologação de vários municípios
const WEBSERVICE_CONFIG = {
  homologacao: {
    url: 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204/nfse.asmx',
    namespace: 'http://nfse.abrasf.org.br',
    soapAction: 'http://nfse.abrasf.org.br'
  },
  // Goiânia - após migração para SGISS (ABRASF 2.04)
  goiania: {
    url: 'https://nfse.goiania.go.gov.br/ws/nfse.asmx',
    namespace: 'http://nfse.goiania.go.gov.br/ws/',
    soapAction: 'http://nfse.goiania.go.gov.br'
  }
};

// Namespace ABRASF padrão
const NAMESPACE = "http://www.abrasf.org.br/nfse.xsd";

// Cria cliente Supabase
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Carrega certificado PFX
function loadCertificate() {
  try {
    const pfxBuffer = readFileSync(CERT_PATH);
    console.log(`✅ Certificado carregado: ${CERT_PATH}`);
    return pfxBuffer;
  } catch (err) {
    console.error(`❌ Erro ao carregar certificado: ${err.message}`);
    throw err;
  }
}

// Envelope SOAP para operações NFS-e
function wrapSoapEnvelope(xmlPayload, operation = "RecepcionarLoteRps", namespace = "http://nfse.abrasf.org.br") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="${namespace}">
  <soap:Body>
    <nfse:${operation}>
      <nfse:xmlEnvio><![CDATA[${xmlPayload}]]></nfse:xmlEnvio>
    </nfse:${operation}>
  </soap:Body>
</soap:Envelope>`;
}

// Extrai protocolo da resposta
function extractProtocol(responseXml) {
  const match = responseXml.match(/<Protocolo>([^<]+)<\/Protocolo>/i);
  return match ? match[1] : null;
}

// Extrai número da NFS-e e código de verificação
function extractNFSeData(responseXml) {
  const numeroMatch = responseXml.match(/<Numero>([^<]+)<\/Numero>/i);
  const codigoMatch = responseXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/i);

  if (numeroMatch) {
    return {
      numero_nfse: numeroMatch[1],
      codigo_verificacao: codigoMatch ? codigoMatch[1] : null
    };
  }
  return null;
}

// Extrai erros da resposta
function extractErrors(responseXml) {
  const errors = [];
  const errorRegex = /<MensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>[\s\S]*?<\/MensagemRetorno>/gi;
  let match;
  while ((match = errorRegex.exec(responseXml)) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] });
  }

  // Também verificar ListaMensagemRetorno
  const listaRegex = /<ListaMensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>/gi;
  while ((match = listaRegex.exec(responseXml)) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] });
  }

  return errors;
}

// Envia requisição SOAP com certificado
async function sendSoapRequest(url, soapEnvelope, operation, soapActionBase) {
  const pfxBuffer = loadCertificate();

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      pfx: pfxBuffer,
      passphrase: CERT_PASSWORD,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
        'SOAPAction': `${soapActionBase}/${operation}`
      },
      rejectUnauthorized: true
    };

    console.log(`📤 Enviando para: ${url}`);
    console.log(`📋 Operação: ${operation}`);
    console.log(`📋 SOAPAction: ${soapActionBase}/${operation}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`📥 Status: ${res.statusCode}`);
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Erro na requisição: ${err.message}`);
      reject(err);
    });

    req.write(soapEnvelope);
    req.end();
  });
}

// Envia lote de RPS
async function enviarLoteRps(nfseId, ambiente = 'homologacao') {
  console.log(`\n🚀 Enviando NFS-e ${nfseId} ao webservice (${ambiente})...\n`);

  // Buscar NFS-e no banco
  const { data: nfse, error: nfseError } = await supabase
    .from('nfse')
    .select('*')
    .eq('id', nfseId)
    .single();

  if (nfseError || !nfse) {
    throw new Error(`NFS-e não encontrada: ${nfseError?.message}`);
  }

  if (!nfse.xml_rps) {
    throw new Error('XML do RPS não está disponível');
  }

  console.log(`📄 RPS: ${nfse.numero_rps} - Série: ${nfse.serie_rps}`);
  console.log(`👤 Tomador: ${nfse.tomador_razao_social}`);
  console.log(`💰 Valor: R$ ${nfse.valor_servicos}`);

  const wsConfig = WEBSERVICE_CONFIG[ambiente] || WEBSERVICE_CONFIG.homologacao;
  const soapEnvelope = wrapSoapEnvelope(nfse.xml_rps, 'RecepcionarLoteRps', wsConfig.namespace);

  try {
    const response = await sendSoapRequest(wsConfig.url, soapEnvelope, 'RecepcionarLoteRps', wsConfig.soapAction);

    console.log('\n📋 Resposta do webservice:');
    console.log(response.body.substring(0, 500) + '...');

    const protocolo = extractProtocol(response.body);
    const errors = extractErrors(response.body);

    if (protocolo) {
      console.log(`\n✅ Lote recebido! Protocolo: ${protocolo}`);

      // Atualizar NFS-e no banco
      await supabase.from('nfse').update({
        protocolo: protocolo,
        status: 'processing',
        updated_at: new Date().toISOString()
      }).eq('id', nfseId);

      // Registrar log
      await supabase.from('nfse_log').insert({
        nfse_id: nfseId,
        operacao: 'enviar_lote_webservice',
        request_xml: soapEnvelope,
        response_xml: response.body,
        response_timestamp: new Date().toISOString(),
        sucesso: true,
        protocolo: protocolo,
        mensagem_retorno: 'Lote enviado com sucesso'
      });

      return { success: true, protocolo };
    }

    if (errors.length > 0) {
      console.log(`\n❌ Erros no envio:`);
      errors.forEach(e => console.log(`   - ${e.codigo}: ${e.mensagem}`));

      // Atualizar NFS-e com erro
      await supabase.from('nfse').update({
        status: 'error',
        codigo_erro: errors[0].codigo,
        mensagem_erro: errors.map(e => `${e.codigo}: ${e.mensagem}`).join('; '),
        updated_at: new Date().toISOString()
      }).eq('id', nfseId);

      // Registrar log
      await supabase.from('nfse_log').insert({
        nfse_id: nfseId,
        operacao: 'enviar_lote_webservice',
        request_xml: soapEnvelope,
        response_xml: response.body,
        response_timestamp: new Date().toISOString(),
        sucesso: false,
        codigo_retorno: errors[0].codigo,
        mensagem_retorno: errors[0].mensagem
      });

      return { success: false, errors };
    }

    return { success: false, message: 'Resposta inesperada do webservice' };

  } catch (err) {
    console.error(`\n❌ Erro ao enviar: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// Consulta status do lote
async function consultarLoteRps(nfseId, ambiente = 'homologacao') {
  console.log(`\n🔍 Consultando status da NFS-e ${nfseId}...\n`);

  // Buscar NFS-e no banco
  const { data: nfse, error: nfseError } = await supabase
    .from('nfse')
    .select('*')
    .eq('id', nfseId)
    .single();

  if (nfseError || !nfse) {
    throw new Error(`NFS-e não encontrada: ${nfseError?.message}`);
  }

  if (!nfse.protocolo) {
    throw new Error('Protocolo não disponível. Envie o lote primeiro.');
  }

  console.log(`📋 Protocolo: ${nfse.protocolo}`);

  // XML de consulta
  const consultaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarLoteRpsEnvio xmlns="${NAMESPACE}">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${nfse.prestador_cnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${nfse.prestador_inscricao_municipal}</InscricaoMunicipal>
  </Prestador>
  <Protocolo>${nfse.protocolo}</Protocolo>
</ConsultarLoteRpsEnvio>`;

  const wsConfig = WEBSERVICE_CONFIG[ambiente] || WEBSERVICE_CONFIG.homologacao;
  const soapEnvelope = wrapSoapEnvelope(consultaXml, 'ConsultarLoteRps', wsConfig.namespace);

  try {
    const response = await sendSoapRequest(wsConfig.url, soapEnvelope, 'ConsultarLoteRps', wsConfig.soapAction);

    console.log('\n📋 Resposta do webservice:');
    console.log(response.body.substring(0, 1000));

    const nfseData = extractNFSeData(response.body);
    const errors = extractErrors(response.body);

    if (nfseData) {
      console.log(`\n✅ NFS-e Autorizada!`);
      console.log(`   Número: ${nfseData.numero_nfse}`);
      console.log(`   Código de Verificação: ${nfseData.codigo_verificacao}`);

      // Atualizar NFS-e no banco
      await supabase.from('nfse').update({
        numero_nfse: nfseData.numero_nfse,
        codigo_verificacao: nfseData.codigo_verificacao,
        status: 'authorized',
        data_autorizacao: new Date().toISOString(),
        xml_nfse: response.body,
        updated_at: new Date().toISOString()
      }).eq('id', nfseId);

      // Registrar log
      await supabase.from('nfse_log').insert({
        nfse_id: nfseId,
        operacao: 'consultar_lote_webservice',
        request_xml: soapEnvelope,
        response_xml: response.body,
        response_timestamp: new Date().toISOString(),
        sucesso: true,
        protocolo: nfse.protocolo,
        mensagem_retorno: `NFS-e autorizada: ${nfseData.numero_nfse}`
      });

      return { success: true, ...nfseData };
    }

    if (errors.length > 0) {
      // Verificar se ainda está processando
      const processando = errors.some(e =>
        e.codigo === 'E4' ||
        e.mensagem.toLowerCase().includes('processamento') ||
        e.mensagem.toLowerCase().includes('aguarde')
      );

      if (processando) {
        console.log(`\n⏳ NFS-e ainda em processamento. Tente novamente em alguns segundos.`);
        return { success: false, processing: true };
      }

      console.log(`\n❌ Erros na consulta:`);
      errors.forEach(e => console.log(`   - ${e.codigo}: ${e.mensagem}`));

      return { success: false, errors };
    }

    console.log(`\n⏳ Aguardando processamento...`);
    return { success: false, processing: true };

  } catch (err) {
    console.error(`\n❌ Erro na consulta: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// Listar NFS-e pendentes
async function listarPendentes() {
  console.log('\n📋 NFS-e Pendentes de Envio:\n');

  const { data: pendentes, error } = await supabase
    .from('nfse')
    .select('id, numero_rps, serie_rps, tomador_razao_social, valor_servicos, status, protocolo')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Erro: ${error.message}`);
    return;
  }

  if (!pendentes || pendentes.length === 0) {
    console.log('Nenhuma NFS-e pendente encontrada.');
    return;
  }

  pendentes.forEach((nfse, i) => {
    console.log(`${i + 1}. RPS ${nfse.numero_rps}/${nfse.serie_rps} - ${nfse.tomador_razao_social}`);
    console.log(`   Valor: R$ ${nfse.valor_servicos} | Status: ${nfse.status} | Protocolo: ${nfse.protocolo || '-'}`);
    console.log(`   ID: ${nfse.id}`);
    console.log('');
  });

  return pendentes;
}

// Menu principal
async function main() {
  const args = process.argv.slice(2);
  const comando = args[0];
  const nfseId = args[1];
  const ambiente = args[2] || 'homologacao';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    NFS-e Webservice - Prefeitura de Goiânia (ABRASF 2.04)     ');
  console.log('═══════════════════════════════════════════════════════════════');

  switch (comando) {
    case 'enviar':
      if (!nfseId) {
        console.log('\n❌ Uso: node enviar-nfse-webservice.mjs enviar <nfse_id> [ambiente]');
        console.log('   ambiente: homologacao (padrão) ou producao');
        return;
      }
      await enviarLoteRps(nfseId, ambiente);
      break;

    case 'consultar':
      if (!nfseId) {
        console.log('\n❌ Uso: node enviar-nfse-webservice.mjs consultar <nfse_id> [ambiente]');
        return;
      }
      await consultarLoteRps(nfseId, ambiente);
      break;

    case 'listar':
      await listarPendentes();
      break;

    default:
      console.log('\n📌 Comandos disponíveis:');
      console.log('');
      console.log('   node scripts/enviar-nfse-webservice.mjs listar');
      console.log('   - Lista todas as NFS-e pendentes de envio');
      console.log('');
      console.log('   node scripts/enviar-nfse-webservice.mjs enviar <nfse_id> [ambiente]');
      console.log('   - Envia o RPS ao webservice da prefeitura');
      console.log('   - ambiente: homologacao (padrão) ou producao');
      console.log('');
      console.log('   node scripts/enviar-nfse-webservice.mjs consultar <nfse_id> [ambiente]');
      console.log('   - Consulta o status do lote e obtém número da NFS-e');
      console.log('');

      // Listar pendentes por padrão
      await listarPendentes();
  }
}

main().catch(console.error);
