/**
 * Assinador XML Digital para NFS-e
 * Implementa assinatura XMLDSig conforme padrão ICP-Brasil
 */

import { SignedXml, FileKeyInfo } from 'xml-crypto';
import * as crypto from 'crypto';

export interface SignerConfig {
  privateKey: string;
  certificate: string;
}

export class XmlSigner {
  private privateKey: string;
  private certificate: string;

  constructor(config: SignerConfig) {
    this.privateKey = config.privateKey;
    this.certificate = config.certificate;
  }

  /**
   * Assina o XML usando XMLDSig enveloped signature
   */
  signXml(xml: string, referenceId: string): string {
    const sig = new SignedXml();

    // Configurar algoritmos conforme padrão ICP-Brasil / ABRASF
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

    // Adicionar referência ao elemento a ser assinado
    sig.addReference(
      `//*[@Id='${referenceId}']`,
      [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
      ],
      'http://www.w3.org/2000/09/xmldsig#sha1'
    );

    // Configurar chave privada
    sig.signingKey = this.privateKey;

    // Configurar provedor de informações da chave (X509Certificate)
    sig.keyInfoProvider = {
      getKeyInfo: () => {
        const certBase64 = this.getCertificateBase64();
        return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
      },
      getKey: () => {
        return this.privateKey;
      }
    };

    // Computar assinatura
    sig.computeSignature(xml, {
      location: {
        reference: `//*[@Id='${referenceId}']`,
        action: 'append'
      }
    });

    return sig.getSignedXml();
  }

  /**
   * Assina múltiplos elementos no XML (ex: cada RPS + o lote)
   */
  signMultiple(xml: string, referenceIds: string[]): string {
    let signedXml = xml;

    for (const refId of referenceIds) {
      signedXml = this.signXml(signedXml, refId);
    }

    return signedXml;
  }

  /**
   * Valida a assinatura de um XML
   */
  validateSignature(xml: string): boolean {
    try {
      const doc = xml;
      const signature = this.extractSignature(doc);
      
      if (!signature) {
        return false;
      }

      const sig = new SignedXml();
      sig.keyInfoProvider = {
        getKeyInfo: () => '',
        getKey: () => this.extractPublicKey()
      };

      sig.loadSignature(signature);
      return sig.checkSignature(doc);
    } catch (error) {
      console.error('Erro ao validar assinatura:', error);
      return false;
    }
  }

  /**
   * Extrai o certificado em Base64 (sem headers PEM)
   */
  private getCertificateBase64(): string {
    return this.certificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\r?\n/g, '')
      .trim();
  }

  /**
   * Extrai a assinatura do XML
   */
  private extractSignature(xml: string): string | null {
    const match = xml.match(/<Signature[^>]*>[\s\S]*?<\/Signature>/);
    return match ? match[0] : null;
  }

  /**
   * Extrai a chave pública do certificado
   */
  private extractPublicKey(): string {
    const cert = crypto.createPublicKey(this.certificate);
    return cert.export({ type: 'spki', format: 'pem' }).toString();
  }
}

/**
 * Classe auxiliar para assinatura de DPS (Padrão Nacional)
 */
export class DpsSigner extends XmlSigner {
  /**
   * Assina um lote de DPS conforme padrão nacional:
   * 1. Assinar cada DPS individualmente
   * 2. Assinar o lote completo
   */
  signLoteDps(xml: string, dpsIds: string[], loteId: string): string {
    // Adicionar namespace em cada DPS antes de assinar
    let xmlProcessado = xml;

    // 1. Assinar cada DPS individualmente
    for (const dpsId of dpsIds) {
      xmlProcessado = this.signXml(xmlProcessado, dpsId);
    }

    // 2. Assinar o lote
    xmlProcessado = this.signXml(xmlProcessado, loteId);

    return xmlProcessado;
  }
}

/**
 * Factory para criar instâncias do assinador
 */
export function createSigner(privateKey: string, certificate: string): XmlSigner {
  return new XmlSigner({ privateKey, certificate });
}

export function createDpsSigner(privateKey: string, certificate: string): DpsSigner {
  return new DpsSigner({ privateKey, certificate });
}
