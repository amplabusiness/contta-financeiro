// Script para testar assinatura digital de XML NFS-e
// Usa certificado A1 (PFX) da pasta certificado

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SignedXml } from 'xml-crypto';
import forge from 'node-forge';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configurações
const CERT_PATH = join(__dirname, '..', 'certificado', 'ampla contabilidade.pfx');
const CERT_PASSWORD = '123456'; // Senha do certificado

console.log('═══════════════════════════════════════════════════════════════');
console.log('    TESTE DE ASSINATURA DIGITAL XML NFS-e                      ');
console.log('═══════════════════════════════════════════════════════════════\n');

/**
 * Carrega certificado PFX
 */
function loadCertificate(pfxPath, password) {
  console.log(`📂 Carregando certificado: ${pfxPath}`);

  const pfxBuffer = readFileSync(pfxPath);
  const pfxAsn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  // Extrair chave privada
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

  if (!keyBag || keyBag.length === 0) {
    throw new Error('Chave privada não encontrada no certificado');
  }

  const privateKey = forge.pki.privateKeyToPem(keyBag[0].key);

  // Extrair certificado
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];

  if (!certBag || certBag.length === 0) {
    throw new Error('Certificado não encontrado no arquivo PFX');
  }

  const cert = certBag[0].cert;
  const certPem = forge.pki.certificateToPem(cert);

  // Certificado em formato DER base64
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  // Informações do certificado
  const subject = cert.subject.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', ');
  const issuer = cert.issuer.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', ');
  const validFrom = cert.validity.notBefore;
  const validTo = cert.validity.notAfter;
  const serialNumber = cert.serialNumber;

  console.log(`\n📜 Informações do Certificado:`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Issuer: ${issuer}`);
  console.log(`   Serial: ${serialNumber}`);
  console.log(`   Válido de: ${validFrom.toISOString().split('T')[0]}`);
  console.log(`   Válido até: ${validTo.toISOString().split('T')[0]}`);

  // Verificar validade
  const now = new Date();
  if (now < validFrom || now > validTo) {
    console.log(`\n⚠️  ATENÇÃO: Certificado EXPIRADO ou ainda não válido!`);
  } else {
    const diasRestantes = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));
    console.log(`   ✅ Certificado válido (${diasRestantes} dias restantes)`);
  }

  return {
    privateKey,
    certificate: certBase64,
    certPem,
    subject,
    validFrom,
    validTo
  };
}

/**
 * Assina XML usando xml-crypto
 */
function signXml(xml, referenceId, privateKey, certificate) {
  // Criar assinador
  const sig = new SignedXml({
    privateKey: privateKey,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
  });

  // Adicionar referência ao elemento com Id
  sig.addReference({
    xpath: `//*[@Id='${referenceId}']`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ]
  });

  // KeyInfo com certificado X509
  sig.keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${certificate}</X509Certificate></X509Data>`,
    getKey: () => certificate
  };

  // Computar assinatura - inserir dentro do elemento referenciado
  sig.computeSignature(xml, {
    location: {
      reference: `//*[@Id='${referenceId}']`,
      action: 'append'
    }
  });

  return sig.getSignedXml();
}

/**
 * Assina lote RPS completo (cada RPS + lote)
 */
function signLoteRps(xml, privateKey, certificate) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  let signedXml = xml;

  // 1. Assinar cada InfDeclaracaoPrestacaoServico
  const infDecls = doc.getElementsByTagName('InfDeclaracaoPrestacaoServico');
  for (let i = 0; i < infDecls.length; i++) {
    const rpsId = infDecls[i].getAttribute('Id');
    if (rpsId) {
      console.log(`\n🔐 Assinando RPS: ${rpsId}`);
      signedXml = signXml(signedXml, rpsId, privateKey, certificate);
    }
  }

  // 2. Assinar o LoteRps
  const loteRps = doc.getElementsByTagName('LoteRps')[0];
  if (loteRps) {
    const loteId = loteRps.getAttribute('Id');
    if (loteId) {
      console.log(`\n🔐 Assinando Lote: ${loteId}`);
      signedXml = signXml(signedXml, loteId, privateKey, certificate);
    }
  }

  return signedXml;
}

// Main
async function main() {
  try {
    // 1. Carregar certificado
    const { privateKey, certificate } = loadCertificate(CERT_PATH, CERT_PASSWORD);

    // 2. Ler XML de teste
    const xmlPath = join(__dirname, '..', 'output', 'teste_EnviarLoteRps.xml');
    console.log(`\n📄 Lendo XML: ${xmlPath}`);

    const xml = readFileSync(xmlPath, 'utf8');

    // 3. Assinar
    console.log('\n🔏 Iniciando assinatura digital...');
    const signedXml = signLoteRps(xml, privateKey, certificate);

    // 4. Salvar XML assinado
    const outputPath = join(__dirname, '..', 'output', 'teste_EnviarLoteRps_ASSINADO.xml');
    writeFileSync(outputPath, signedXml, 'utf8');

    console.log(`\n✅ XML assinado salvo em: ${outputPath}`);

    // 5. Mostrar trecho da assinatura
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📋 Trecho do XML assinado (Signature):');
    console.log('═══════════════════════════════════════════════════════════════');

    const sigMatch = signedXml.match(/<Signature[\s\S]*?<\/Signature>/);
    if (sigMatch) {
      // Mostrar só o início
      const sigTrecho = sigMatch[0].substring(0, 500) + '...';
      console.log(sigTrecho);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ ASSINATURA DIGITAL CONCLUÍDA COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
