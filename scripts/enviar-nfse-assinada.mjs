// Script para enviar NFS-e assinada ao webservice
// Usa certificado digital A1 para autenticação mTLS e assinatura

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações
const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const CERT_PATH = join(__dirname, '..', 'certificado', 'ampla contabilidade.pfx');
const CERT_PASSWORD = '123456';

// URLs do Webservice
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

// Supabase client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Carrega certificado PFX
 */
function loadCertificate(pfxPath, password) {
  const pfxBuffer = readFileSync(pfxPath);
  const pfxAsn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  // Chave privada
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag[0].key);

  // Certificado
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  const cert = certBag[0].cert;
  const certPem = forge.pki.certificateToPem(cert);
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  return { privateKeyPem, certPem, certBase64, pfxBuffer };
}

/**
 * Escape XML
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Provider personalizado para incluir KeyInfo com X509Certificate
 */
class X509KeyInfoProvider {
  constructor(certificate) {
    this.certificate = certificate;
  }

  getKeyInfo() {
    return `<X509Data><X509Certificate>${this.certificate}</X509Certificate></X509Data>`;
  }

  getKey() {
    return this.certificate;
  }
}

/**
 * Assina XML - coloca assinatura como irmão do elemento referenciado (não filho)
 */
function signXml(xml, referenceId, privateKey, certificate, insertAfter = false) {
  const sig = new SignedXml({
    privateKey: privateKey,
    publicCert: certificate,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
  });

  sig.addReference({
    xpath: `//*[@Id='${referenceId}']`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ]
  });

  // Usar provider customizado para KeyInfo
  sig.keyInfoProvider = new X509KeyInfoProvider(certificate);

  // Assinatura deve ficar como irmão (after) do elemento referenciado, não como filho (append)
  sig.computeSignature(xml, {
    location: {
      reference: `//*[@Id='${referenceId}']`,
      action: insertAfter ? 'after' : 'append'
    }
  });

  return sig.getSignedXml();
}

/**
 * Extrai logradouro, número e bairro de um endereço completo
 */
function parseEndereco(enderecoCompleto) {
  if (!enderecoCompleto) return { logradouro: '', numero: 'S/N', bairro: '' };

  // Padrão: "RUA NOME, 123 - BAIRRO" ou "RUA NOME, 123 BAIRRO"
  const match = enderecoCompleto.match(/^(.+?),?\s*(\d+)\s*[-–]?\s*(.*)$/);
  if (match) {
    return {
      logradouro: match[1].trim(),
      numero: match[2].trim(),
      bairro: match[3].trim() || 'Centro'
    };
  }

  // Padrão alternativo: "LOGRADOURO NUMERO - BAIRRO" sem vírgula
  const match2 = enderecoCompleto.match(/^(.+?)\s+(\d+)\s*[-–]\s*(.+)$/);
  if (match2) {
    return {
      logradouro: match2[1].trim(),
      numero: match2[2].trim(),
      bairro: match2[3].trim()
    };
  }

  return { logradouro: enderecoCompleto, numero: 'S/N', bairro: 'Centro' };
}

/**
 * Gera XML do RPS completo
 * @param {object} nfse - Dados da NFS-e
 * @param {object} config - Configuração do prestador
 * @param {string} ambiente - 'homologacao' ou 'producao'
 */
function buildRpsXml(nfse, config, ambiente = 'homologacao') {
  const rpsId = `RPS${nfse.numero_rps}`;
  const loteId = `L${nfse.numero_rps}`;
  const dataEmissao = nfse.data_emissao || new Date().toISOString().split('T')[0];
  const competencia = nfse.competencia || dataEmissao.substring(0, 7) + '-01';

  // Em homologação do ISSNet, usar município 5002704 (Campo Grande) e série 8
  const isHomologacao = ambiente === 'homologacao';
  const codigoMunicipioServico = isHomologacao ? '5002704' : (nfse.codigo_municipio || '5208707');
  const serieRps = isHomologacao ? '8' : (nfse.serie_rps || 'A');

  // CPF ou CNPJ do tomador
  const tomadorDoc = (nfse.tomador_cnpj || nfse.tomador_cpf || '').replace(/\D/g, '');
  const isCpf = tomadorDoc.length === 11;
  const tomadorTag = isCpf
    ? `<Cpf>${tomadorDoc}</Cpf>`
    : `<Cnpj>${tomadorDoc}</Cnpj>`;

  // Parse endereço se não tiver campos separados
  let logradouro = nfse.tomador_endereco || '';
  let numero = nfse.tomador_numero || '';
  let bairro = nfse.tomador_bairro || '';

  if (logradouro && (!numero || !bairro)) {
    const parsed = parseEndereco(logradouro);
    logradouro = parsed.logradouro || logradouro;
    numero = numero || parsed.numero;
    bairro = bairro || parsed.bairro;
  }

  // Valores padrão para campos obrigatórios
  const codigoMunicipioTomador = isHomologacao ? '5002704' : (nfse.tomador_codigo_municipio || '5208707');
  const uf = isHomologacao ? 'MS' : (nfse.tomador_uf || 'GO');
  const cep = (nfse.tomador_cep || (isHomologacao ? '79000000' : '74000000')).replace(/\D/g, '');

  // Discriminação do serviço (limitar tamanho)
  let discriminacao = nfse.discriminacao || 'Servicos contabeis mensais conforme contrato';
  discriminacao = discriminacao.substring(0, 2000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="${NAMESPACE}">
  <LoteRps Id="${loteId}" versao="2.04">
    <NumeroLote>${nfse.numero_rps}</NumeroLote>
    <Prestador>
      <CpfCnpj>
        <Cnpj>${nfse.prestador_cnpj}</Cnpj>
      </CpfCnpj>
      <InscricaoMunicipal>${nfse.prestador_inscricao_municipal}</InscricaoMunicipal>
    </Prestador>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfDeclaracaoPrestacaoServico Id="${rpsId}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${nfse.numero_rps}</Numero>
              <Serie>${serieRps}</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${dataEmissao}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${competencia}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${parseFloat(nfse.valor_servicos).toFixed(2)}</ValorServicos>
            </Valores>
            <IssRetido>2</IssRetido>
            <ItemListaServico>${nfse.item_lista_servico || '17.18'}</ItemListaServico>
            <CodigoCnae>${nfse.codigo_cnae || '6920602'}</CodigoCnae>
            <Discriminacao>${escapeXml(discriminacao)}</Discriminacao>
            <CodigoMunicipio>${codigoMunicipioServico}</CodigoMunicipio>
            <ExigibilidadeISS>1</ExigibilidadeISS>
            <MunicipioIncidencia>${codigoMunicipioServico}</MunicipioIncidencia>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${nfse.prestador_cnpj}</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>${nfse.prestador_inscricao_municipal}</InscricaoMunicipal>
          </Prestador>
          <TomadorServico>
            <IdentificacaoTomador>
              <CpfCnpj>
                ${tomadorTag}
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(nfse.tomador_razao_social)}</RazaoSocial>
            <Endereco>
              <Endereco>${escapeXml(logradouro || 'Rua Exemplo')}</Endereco>
              <Numero>${escapeXml(numero || 'S/N')}</Numero>
              <Bairro>${escapeXml(bairro || 'Centro')}</Bairro>
              <CodigoMunicipio>${codigoMunicipioTomador}</CodigoMunicipio>
              <Uf>${uf}</Uf>
              <Cep>${cep}</Cep>
            </Endereco>
          </TomadorServico>
          <RegimeEspecialTributacao>${config.regime_especial_tributacao || 3}</RegimeEspecialTributacao>
          <OptanteSimplesNacional>${config.optante_simples_nacional ? '1' : '2'}</OptanteSimplesNacional>
          <IncentivoFiscal>2</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
}

/**
 * Gera cabeçalho XML ABRASF (obrigatório)
 * Formato exato conforme documentação: versao="1.00" e versaoDados="2.04"
 */
function buildCabecalho() {
  // Sem declaração XML no cabeçalho - já está dentro do CDATA
  return `<cabecalho xmlns="http://www.abrasf.org.br/nfse.xsd" versao="1.00"><versaoDados>2.04</versaoDados></cabecalho>`;
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
 * Extrai protocolo da resposta
 */
function extractProtocol(responseXml) {
  const match = responseXml.match(/<Protocolo>([^<]+)<\/Protocolo>/i);
  return match ? match[1] : null;
}

/**
 * Extrai NFS-e da resposta
 */
function extractNFSeData(responseXml) {
  const numeroMatch = responseXml.match(/<Numero>([^<]+)<\/Numero>/i);
  const codigoMatch = responseXml.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/i);
  if (numeroMatch) {
    return {
      numero_nfse: numeroMatch[1],
      codigo_verificacao: codigoMatch ? codigoMatch[1] : ''
    };
  }
  return null;
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
  return errors;
}

/**
 * Envia requisição SOAP com certificado
 */
async function sendSoapRequest(url, soapEnvelope, operation, soapActionBase, pfxBuffer, password) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    // SOAPAction conforme WSDL: http://nfse.abrasf.org.br/RecepcionarLoteRps
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

    console.log(`📤 Enviando para: ${url}`);
    console.log(`📋 SOAPAction: ${soapAction}`);

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
 * Envia NFS-e
 */
async function enviarNfse(nfseId, ambiente = 'homologacao') {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`    ENVIANDO NFS-e ${nfseId} (${ambiente})`);
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

  // Buscar dados completos do cliente para endereço
  let clientData = null;
  if (nfse.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', nfse.client_id)
      .single();
    clientData = client;
  }

  // Complementar dados do tomador com dados do cliente
  if (clientData) {
    nfse.tomador_endereco = nfse.tomador_endereco || clientData.address || clientData.endereco;
    nfse.tomador_numero = nfse.tomador_numero || clientData.address_number || clientData.numero;
    nfse.tomador_bairro = nfse.tomador_bairro || clientData.neighborhood || clientData.bairro;
    nfse.tomador_cep = nfse.tomador_cep || clientData.zip_code || clientData.cep;
    nfse.tomador_uf = nfse.tomador_uf || clientData.state || clientData.uf || 'GO';
    nfse.tomador_codigo_municipio = nfse.tomador_codigo_municipio || clientData.city_code || clientData.codigo_municipio || '5208707';
    nfse.tomador_email = nfse.tomador_email || clientData.email;
    nfse.tomador_telefone = nfse.tomador_telefone || clientData.phone || clientData.telefone;
  }

  console.log(`📄 RPS: ${nfse.numero_rps}/${nfse.serie_rps}`);
  console.log(`👤 Tomador: ${nfse.tomador_razao_social}`);
  console.log(`💰 Valor: R$ ${nfse.valor_servicos}`);

  // Buscar config
  const { data: config, error: configError } = await supabase
    .from('nfse_config')
    .select('*')
    .eq('prestador_cnpj', nfse.prestador_cnpj)
    .single();

  if (configError || !config) {
    throw new Error(`Config não encontrada: ${configError?.message}`);
  }

  // Carregar certificado
  console.log('\n🔐 Carregando certificado...');
  const { privateKeyPem, certBase64, pfxBuffer } = loadCertificate(CERT_PATH, CERT_PASSWORD);

  // Gerar XML
  console.log('📝 Gerando XML do RPS...');
  let rpsXml = buildRpsXml(nfse, config, ambiente);

  // Assinar
  console.log('🔏 Assinando XML...');
  const rpsId = `RPS${nfse.numero_rps}`;
  const loteId = `L${nfse.numero_rps}`;

  // Assinatura do InfDeclaracaoPrestacaoServico - insere DEPOIS do elemento (como irmão)
  rpsXml = signXml(rpsXml, rpsId, privateKeyPem, certBase64, true);
  // Assinatura do LoteRps - insere DENTRO do elemento (append)
  rpsXml = signXml(rpsXml, loteId, privateKeyPem, certBase64, false);

  console.log('✅ XML assinado com sucesso!');

  // Salvar XML para debug
  const outputPath = join(__dirname, '..', 'output', `nfse_${nfseId}_assinada.xml`);
  writeFileSync(outputPath, rpsXml, 'utf8');
  console.log(`💾 XML salvo em: ${outputPath}`);

  // Enviar
  const wsConfig = WEBSERVICE_CONFIG[ambiente] || WEBSERVICE_CONFIG.homologacao;
  const soapEnvelope = wrapSoapEnvelope(rpsXml, 'RecepcionarLoteRps', wsConfig.namespace);

  console.log('\n📤 Enviando ao webservice...');
  const response = await sendSoapRequest(
    wsConfig.url,
    soapEnvelope,
    'RecepcionarLoteRps',
    wsConfig.namespace,
    pfxBuffer,
    CERT_PASSWORD
  );

  console.log('\n📋 Resposta:');
  console.log(response.body.substring(0, 1000));

  const protocolo = extractProtocol(response.body);
  const nfseData = extractNFSeData(response.body);
  const errors = extractErrors(response.body);

  // Atualizar banco
  const updateData = {
    xml_rps: rpsXml,
    updated_at: new Date().toISOString()
  };

  if (protocolo) {
    updateData.protocolo = protocolo;
    updateData.status = 'processing';
    console.log(`\n✅ Protocolo: ${protocolo}`);
  }

  if (nfseData) {
    updateData.numero_nfse = nfseData.numero_nfse;
    updateData.codigo_verificacao = nfseData.codigo_verificacao;
    updateData.status = 'authorized';
    updateData.data_autorizacao = new Date().toISOString();
    console.log(`\n✅ NFS-e Autorizada: ${nfseData.numero_nfse}`);
  }

  if (errors.length > 0) {
    updateData.status = 'error';
    updateData.codigo_erro = errors[0].codigo;
    updateData.mensagem_erro = errors.map(e => `${e.codigo}: ${e.mensagem}`).join('; ');
    console.log(`\n❌ Erros:`);
    errors.forEach(e => console.log(`   ${e.codigo}: ${e.mensagem}`));
  }

  await supabase.from('nfse').update(updateData).eq('id', nfseId);

  // Log
  await supabase.from('nfse_log').insert({
    nfse_id: nfseId,
    operacao: 'enviar_lote_assinado',
    request_xml: soapEnvelope,
    response_xml: response.body,
    response_timestamp: new Date().toISOString(),
    sucesso: errors.length === 0,
    codigo_retorno: errors[0]?.codigo,
    mensagem_retorno: errors[0]?.mensagem || (protocolo ? `Protocolo: ${protocolo}` : 'OK'),
    protocolo
  });

  return { protocolo, nfseData, errors };
}

// Main
const args = process.argv.slice(2);
const nfseId = args[0];
const ambiente = args[1] || 'homologacao';

if (!nfseId) {
  console.log('Uso: node enviar-nfse-assinada.mjs <nfse_id> [ambiente]');
  console.log('Ambiente: homologacao (padrão) ou goiania_producao');
  process.exit(1);
}

enviarNfse(nfseId, ambiente)
  .then(result => {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ PROCESSO CONCLUÍDO');
    console.log('═══════════════════════════════════════════════════════════════');
  })
  .catch(err => {
    console.error('\n❌ ERRO:', err.message);
    process.exit(1);
  });
