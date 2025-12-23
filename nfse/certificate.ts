/**
 * Gerenciador de Certificado Digital ICP-Brasil
 * Suporta certificados A1 (arquivo .pfx/.p12)
 */

import * as fs from 'fs';
import * as forge from 'node-forge';

export interface CertificateConfig {
  pfxPath: string;
  password: string;
}

export interface CertificateInfo {
  cnpj: string;
  razaoSocial: string;
  validadeInicio: Date;
  validadeFim: Date;
  emissor: string;
}

export class CertificateManager {
  private cert: forge.pki.Certificate;
  private key: forge.pki.PrivateKey;
  private pfxBuffer: Buffer;
  private password: string;
  
  constructor(config: CertificateConfig) {
    if (!fs.existsSync(config.pfxPath)) {
      throw new Error(`Arquivo de certificado não encontrado: ${config.pfxPath}`);
    }
    
    this.pfxBuffer = fs.readFileSync(config.pfxPath);
    this.password = config.password;
    
    try {
      const p12Asn1 = forge.asn1.fromDer(this.pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, config.password);
      
      // Extrair certificado
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];
      
      if (!certBag || certBag.length === 0 || !certBag[0].cert) {
        throw new Error('Certificado não encontrado no arquivo PFX');
      }
      
      this.cert = certBag[0].cert;
      
      // Extrair chave privada
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
      
      if (!keyBag || keyBag.length === 0 || !keyBag[0].key) {
        throw new Error('Chave privada não encontrada no arquivo PFX');
      }
      
      this.key = keyBag[0].key;
      
    } catch (error: any) {
      if (error.message.includes('Invalid password')) {
        throw new Error('Senha do certificado incorreta');
      }
      throw new Error(`Erro ao carregar certificado: ${error.message}`);
    }
  }
  
  /**
   * Retorna o certificado em formato PEM
   */
  getCertificatePem(): string {
    return forge.pki.certificateToPem(this.cert);
  }
  
  /**
   * Retorna a chave privada em formato PEM
   */
  getPrivateKeyPem(): string {
    return forge.pki.privateKeyToPem(this.key);
  }
  
  /**
   * Retorna o certificado em Base64 (sem headers PEM)
   */
  getCertificateBase64(): string {
    return forge.pki.certificateToPem(this.cert)
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\r?\n/g, '');
  }
  
  /**
   * Retorna o buffer PFX para uso com HTTPS Agent
   */
  getPfxBuffer(): Buffer {
    return this.pfxBuffer;
  }
  
  /**
   * Retorna a senha do certificado
   */
  getPassword(): string {
    return this.password;
  }
  
  /**
   * Extrai o CNPJ do certificado
   */
  getCNPJ(): string {
    const subject = this.cert.subject;
    
    // Tentar extrair do CN (Common Name)
    const cnField = subject.getField('CN');
    if (cnField && cnField.value) {
      const cnMatch = cnField.value.match(/\d{14}/);
      if (cnMatch) {
        return cnMatch[0];
      }
    }
    
    // Tentar extrair de outras extensões
    for (const attr of subject.attributes) {
      if (typeof attr.value === 'string') {
        const match = attr.value.match(/\d{14}/);
        if (match) {
          return match[0];
        }
      }
    }
    
    throw new Error('CNPJ não encontrado no certificado');
  }
  
  /**
   * Retorna informações do certificado
   */
  getInfo(): CertificateInfo {
    const subject = this.cert.subject;
    const issuer = this.cert.issuer;
    
    let razaoSocial = '';
    const cnField = subject.getField('CN');
    if (cnField && cnField.value) {
      // Remover o CNPJ do nome se presente
      razaoSocial = cnField.value.replace(/:\d{14}$/, '').trim();
    }
    
    let emissorNome = '';
    const issuerCN = issuer.getField('CN');
    if (issuerCN && issuerCN.value) {
      emissorNome = issuerCN.value;
    }
    
    return {
      cnpj: this.getCNPJ(),
      razaoSocial,
      validadeInicio: this.cert.validity.notBefore,
      validadeFim: this.cert.validity.notAfter,
      emissor: emissorNome
    };
  }
  
  /**
   * Verifica se o certificado está válido
   */
  isValid(): boolean {
    const now = new Date();
    return now >= this.cert.validity.notBefore && now <= this.cert.validity.notAfter;
  }
  
  /**
   * Retorna os dias restantes de validade
   */
  getDaysRemaining(): number {
    const now = new Date();
    const diff = this.cert.validity.notAfter.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Valida se o CNPJ do certificado corresponde ao esperado
   */
  validateCNPJ(expectedCNPJ: string): boolean {
    const certCNPJ = this.getCNPJ().replace(/\D/g, '');
    const expected = expectedCNPJ.replace(/\D/g, '');
    return certCNPJ === expected;
  }
}
