#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import {
  escapeXml,
  extractErrors,
  extractProtocol,
  loadCertificateFromEnv,
  wrapSoapEnvelope,
} from '../api/_shared/nfse-abrasf204.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

class X509KeyInfoProvider {
  constructor(cert) {
    this.cert = cert;
  }

  getKeyInfo(key, prefix) {
    return `<${prefix}:X509Data><${prefix}:X509Certificate>${this.cert}</${prefix}:X509Certificate></${prefix}:X509Data>`;
  }
}

function signXml(xml, certificate) {
  const sig = new SignedXml({
    privateKey: certificate.privateKeyPem,
    publicCert: certificate.certBase64,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  });

  const referenceId = 'rps1';

  sig.addReference({
    xpath: `//*[@Id='${referenceId}']`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
  });

  sig.keyInfoProvider = new X509KeyInfoProvider(certificate.certBase64);

  sig.computeSignature(xml, {
    location: {
      reference: `//*[@Id='${referenceId}']`,
      action: 'append',
    },
  });

  return sig.getSignedXml();
}

async function emitir() {
  console.log('📤 Emissão NFS-e - Sistema Simplificado\n');

  try {
    // 1. Buscar config
    const { data: configs } = await supabase.from('nfse_config').select('*');
    if (!configs?.length) throw new Error('Sem config NFS-e');
    const config = configs[0];
    console.log('✅ Config encontrada');
    console.log('   Ambiente:', config.ambiente);
    console.log('   CNPJ:', config.prestador_cnpj);

    // 2. Carregar certificado
    console.log('\n🔐 Carregando certificado...');
    const cert = loadCertificateFromEnv();
    console.log('✅ Certificado carregado');

    // 3. Criar RPS
    const numero_rps = Math.floor(Math.random() * 10000);
    console.log('\n📝 Criando RPS ' + numero_rps);

    const { data: nfse } = await supabase.from('nfse').insert({
      numero_rps: String(numero_rps).padStart(5, '0'),
      serie_rps: 'A',
      tipo_rps: 1,
      prestador_cnpj: config.prestador_cnpj,
      prestador_inscricao_municipal: '6241034',
      tomador_razao_social: 'AVIZ ALIMENTOS LTDA',
      tomador_cnpj: '24544420000105',
      tomador_email: 'contato@aviz.com.br',
      tomador_cep: '74000000',
      discriminacao: 'Consultoria em Sistemas - Desenvolvimento e Integração',
      item_lista_servico: '17.01',
      codigo_cnae: '6920601',
      valor_servicos: 3000.00,
      aliquota: 0.02,
      data_emissao: new Date().toISOString().split('T')[0],
      competencia: new Date().toISOString().split('T')[0],
      status: 'pending'
    }).select().single();

    if (!nfse) throw new Error('Erro ao criar NFS-e');
    console.log('✅ NFS-e criada: ID =', nfse.id.substring(0, 8) + '...');

    // 4. Construir XML
    console.log('\n🔨 Construindo XML...');
    const xml = buildLoteRpsXml(nfse, config);
    console.log('✅ XML construído (' + xml.length + ' chars)');

    // 5. Assinar
    console.log('\n✍️  Assinando XML...');
    const xmlAssinado = signXml(xml, cert);
    console.log('✅ XML assinado');

    // 6. Enviar SOAP
    console.log('\n📡 Enviando para Goiânia...');
    const url = config.ambiente === 'producao'
      ? `${config.base_url_producao}/${config.endpoint}`
      : `${config.base_url_homologacao}/${config.endpoint}`;

    console.log('   URL:', url.substring(0, 60) + '...');

    const response = await sendSoap(
      url,
      xmlAssinado,
      'RecepcionarLoteRps',
      'http://nfse.abrasf.org.br', // CORRETO - usar ABRASF não Goiânia
      cert.pfxBuffer,
      cert.password
    );

    console.log('✅ Resposta recebida (' + response.body.length + ' chars)');

    // 7. Processar resposta
    const protocolo = extractProtocol(response.body);
    const erros = extractErrors(response.body);

    // Debug: salvar resposta
    const fs = await import('fs');
    fs.writeFileSync('/tmp/nfse-response.xml', response.body);
    console.log('\n📋 Resposta salva em /tmp/nfse-response.xml');

    if (protocolo) {
      console.log('\n✅ SUCESSO NA EMISSÃO!');
      console.log('   Protocolo:', protocolo);

      // Atualizar DB
      await supabase.from('nfse').update({
        status: 'processing',
        protocolo,
      }).eq('id', nfse.id);

      console.log('\n   ✅ DB atualizado');
      console.log('   📊 Aguardando processamento da prefeitura...');
      console.log('\n💡 Próximo passo:');
      console.log('   npm run nfse:polling');
      console.log('   (para monitorar o status)');

      return {
        sucesso: true,
        nfse_id: nfse.id,
        protocolo,
        numero_rps: nfse.numero_rps,
      };

    } else {
      console.log('\n❌ FALHA NA EMISSÃO');
      if (erros.length > 0) {
        console.log('\n   Erros retornados:');
        erros.forEach((e, i) => {
          console.log(`   ${i + 1}. [${e.codigo}] ${e.mensagem}`);
        });
      }

      await supabase.from('nfse').update({
        status: 'error',
        mensagem_erro: erros?.[0]?.mensagem || 'Erro desconhecido',
      }).eq('id', nfse.id);

      return {
        sucesso: false,
        nfse_id: nfse.id,
        erros,
      };
    }

  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

function buildLoteRpsXml(nfse, config) {
  const rpsId = 'rps1';
  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <LoteRps Id="L${nfse.numero_rps}" versao="2.04">
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
              <Serie>${nfse.serie_rps}</Serie>
              <Tipo>${nfse.tipo_rps}</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${nfse.data_emissao}T00:00:00</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${nfse.competencia}T00:00:00</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${nfse.valor_servicos.toFixed(2)}</ValorServicos>
              <ValorDeducoes>0.00</ValorDeducoes>
              <ValorIss>0.00</ValorIss>
              <Aliquota>${nfse.aliquota.toFixed(4)}</Aliquota>
            </Valores>
            <IssRetido>false</IssRetido>
            <ItemListaServico>${nfse.item_lista_servico}</ItemListaServico>
            <CodigoCnae>${nfse.codigo_cnae}</CodigoCnae>
            <Discriminacao>${escapeXml(nfse.discriminacao)}</Discriminacao>
            <CodigoMunicipio>5208707</CodigoMunicipio>
            <MunicipioIncidencia>5208707</MunicipioIncidencia>
            <ExigibilidadeIss>1</ExigibilidadeIss>
          </Servico>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <Cnpj>${nfse.tomador_cnpj}</Cnpj>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(nfse.tomador_razao_social)}</RazaoSocial>
            <Endereco>
              <Endereco>Endereço</Endereco>
              <Numero>0</Numero>
              <Cidade>5208707</Cidade>
              <Uf>GO</Uf>
              <Cep>${nfse.tomador_cep}</Cep>
            </Endereco>
            <Contato>
              <Email>${escapeXml(nfse.tomador_email)}</Email>
            </Contato>
          </Tomador>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
}

async function sendSoap(url, xmlPayload, operation, soapNamespace, pfxBuffer, password, maxRetries = 3) {
  const soapEnvelope = wrapSoapEnvelope(xmlPayload, operation, soapNamespace);

  const urlObj = new URL(url);

  const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'POST',
    pfx: pfxBuffer,
    passphrase: password,
    rejectUnauthorized: false, // Homologação - em produção usar true
    timeout: 60000,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
      'SOAPAction': `${soapNamespace}${operation}`,
    },
  };

  const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'];
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, body: data });
          });
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('ETIMEDOUT'));
        });
        req.on('error', reject);
        req.write(soapEnvelope);
        req.end();
      });
    } catch (error) {
      lastError = error;
      const errorCode = error.code || error.message;
      const shouldRetry = retryableErrors.some(code => errorCode.includes(code));

      if (shouldRetry && attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`⚠️ Tentativa ${attempt}/${maxRetries} falhou (${errorCode}). Retry em ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw new Error(`Falha após ${maxRetries} tentativas: ${lastError?.message}`);
}

emitir().then(result => {
  console.log('\n📊 RESULTADO FINAL:');
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.sucesso ? 0 : 1);
});
