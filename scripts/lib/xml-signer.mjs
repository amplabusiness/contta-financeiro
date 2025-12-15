// Módulo para assinatura digital de XML NFS-e usando certificado A1 (PFX)
// Padrão: XML-DSig (enveloped signature) conforme ABRASF

import { SignedXml } from 'xml-crypto';
import forge from 'node-forge';
import { readFileSync } from 'fs';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

/**
 * Carrega certificado PFX e extrai chave privada e certificado X509
 * @param {string} pfxPath - Caminho do arquivo PFX
 * @param {string} password - Senha do certificado
 * @returns {{ privateKey: string, certificate: string, certPem: string }}
 */
export function loadCertificate(pfxPath, password) {
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

  // Certificado em formato DER base64 (para incluir no XML)
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  // Informações do certificado
  const subject = cert.subject.attributes.map(attr => `${attr.shortName}=${attr.value}`).join(', ');
  const validFrom = cert.validity.notBefore;
  const validTo = cert.validity.notAfter;

  console.log(`📜 Certificado carregado:`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Válido de: ${validFrom.toISOString().split('T')[0]} até ${validTo.toISOString().split('T')[0]}`);

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
 * Classe para gerar assinatura compatível com xml-crypto
 */
class PemKeyInfo {
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
 * Assina um elemento XML específico (enveloped signature)
 * @param {string} xml - XML a ser assinado
 * @param {string} referenceId - ID do elemento a assinar (ex: "RPS1")
 * @param {string} privateKey - Chave privada em PEM
 * @param {string} certificate - Certificado em base64
 * @returns {string} XML assinado
 */
export function signXml(xml, referenceId, privateKey, certificate) {
  const sig = new SignedXml({
    privateKey: privateKey,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
  });

  // Configurar referência
  sig.addReference({
    xpath: referenceId ? `//*[@Id='${referenceId}']` : '/*',
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ]
  });

  // Adicionar informação do certificado
  sig.keyInfoProvider = new PemKeyInfo(certificate);

  // Computar assinatura
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  // Encontrar elemento a assinar
  let nodeToSign;
  if (referenceId) {
    nodeToSign = findElementById(doc, referenceId);
    if (!nodeToSign) {
      throw new Error(`Elemento com Id="${referenceId}" não encontrado no XML`);
    }
  } else {
    nodeToSign = doc.documentElement;
  }

  sig.computeSignature(xml, {
    location: { reference: referenceId ? `//*[@Id='${referenceId}']` : '/*', action: 'append' }
  });

  return sig.getSignedXml();
}

/**
 * Encontra elemento por ID no documento XML
 */
function findElementById(doc, id) {
  const elements = doc.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].getAttribute('Id') === id) {
      return elements[i];
    }
  }
  return null;
}

/**
 * Assina RPS para NFS-e (ABRASF 2.04)
 * Assina o elemento InfDeclaracaoPrestacaoServico
 * @param {string} xml - XML do RPS
 * @param {string} pfxPath - Caminho do certificado PFX
 * @param {string} password - Senha do certificado
 * @returns {string} XML assinado
 */
export function signRps(xml, pfxPath, password) {
  const { privateKey, certificate } = loadCertificate(pfxPath, password);

  // Encontrar o ID do InfDeclaracaoPrestacaoServico
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const infDecl = doc.getElementsByTagName('InfDeclaracaoPrestacaoServico')[0];

  if (!infDecl) {
    throw new Error('Elemento InfDeclaracaoPrestacaoServico não encontrado no XML');
  }

  const referenceId = infDecl.getAttribute('Id');

  if (!referenceId) {
    throw new Error('Atributo Id não encontrado em InfDeclaracaoPrestacaoServico');
  }

  console.log(`🔐 Assinando elemento Id="${referenceId}"...`);

  return signXml(xml, referenceId, privateKey, certificate);
}

/**
 * Assina lote de RPS (assina cada RPS individualmente + o lote)
 * @param {string} xml - XML do lote
 * @param {string} pfxPath - Caminho do certificado PFX
 * @param {string} password - Senha do certificado
 * @returns {string} XML assinado
 */
export function signLoteRps(xml, pfxPath, password) {
  const { privateKey, certificate } = loadCertificate(pfxPath, password);
  const doc = new DOMParser().parseFromString(xml, 'text/xml');

  // 1. Assinar cada RPS (InfDeclaracaoPrestacaoServico)
  const infDecls = doc.getElementsByTagName('InfDeclaracaoPrestacaoServico');
  let signedXml = xml;

  for (let i = 0; i < infDecls.length; i++) {
    const infDecl = infDecls[i];
    const rpsId = infDecl.getAttribute('Id');

    if (rpsId) {
      console.log(`🔐 Assinando RPS Id="${rpsId}"...`);
      signedXml = signXml(signedXml, rpsId, privateKey, certificate);
    }
  }

  // 2. Assinar o lote (LoteRps)
  const loteRps = doc.getElementsByTagName('LoteRps')[0];
  if (loteRps) {
    const loteId = loteRps.getAttribute('Id');
    if (loteId) {
      console.log(`🔐 Assinando Lote Id="${loteId}"...`);
      signedXml = signXml(signedXml, loteId, privateKey, certificate);
    }
  }

  return signedXml;
}

export default {
  loadCertificate,
  signXml,
  signRps,
  signLoteRps
};
