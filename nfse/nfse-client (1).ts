/**
 * Cliente SOAP para WebService NFS-e Goiânia
 * Suporta modelo legado (ABRASF 2.0) com autenticação via certificado digital
 */

import * as soap from 'soap';
import * as https from 'https';
import * as fs from 'fs';
import { ENDPOINTS } from '../config/endpoints';
import {
  RespostaGerarNfse,
  RespostaConsultarNfse,
  RespostaEnviarLote,
  RespostaConsultarLote,
  MensagemRetorno
} from '../models/nfse';

export interface NfseClientConfig {
  wsdlUrl: string;
  pfxPath: string;
  pfxPassword: string;
  timeout?: number;
}

export class NfseClient {
  private config: NfseClientConfig;
  private client: soap.Client | null = null;
  private httpsAgent: https.Agent | null = null;

  constructor(config: NfseClientConfig) {
    this.config = {
      timeout: 60000, // 60 segundos padrão
      ...config
    };
  }

  /**
   * Conecta ao WebService
   */
  async connect(): Promise<void> {
    if (!fs.existsSync(this.config.pfxPath)) {
      throw new Error(`Arquivo de certificado não encontrado: ${this.config.pfxPath}`);
    }

    const pfxBuffer = fs.readFileSync(this.config.pfxPath);

    // Criar agent HTTPS com certificado
    this.httpsAgent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: this.config.pfxPassword,
      rejectUnauthorized: true,
      timeout: this.config.timeout
    });

    try {
      this.client = await soap.createClientAsync(this.config.wsdlUrl, {
        wsdl_options: { httpsAgent: this.httpsAgent },
        request: { httpsAgent: this.httpsAgent } as any
      });

      // Configurar timeout
      this.client.setEndpoint(this.config.wsdlUrl.replace('?wsdl', ''));
      
    } catch (error: any) {
      throw new Error(`Erro ao conectar ao WebService: ${error.message}`);
    }
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Desconecta do WebService
   */
  disconnect(): void {
    if (this.httpsAgent) {
      this.httpsAgent.destroy();
      this.httpsAgent = null;
    }
    this.client = null;
  }

  /**
   * Gerar NFS-e (síncrono)
   */
  async gerarNfse(xmlEnvio: string): Promise<RespostaGerarNfse> {
    this.ensureConnected();

    try {
      const args = { ArquivoXML: xmlEnvio };
      const [result] = await this.client!.GerarNfseAsync(args);
      
      return this.parseRespostaGerarNfse(result.GerarNfseResult);
    } catch (error: any) {
      return {
        sucesso: false,
        mensagens: [{
          codigo: 'ERRO_COMUNICACAO',
          mensagem: error.message
        }]
      };
    }
  }

  /**
   * Consultar NFS-e por RPS
   */
  async consultarNfsePorRps(xmlConsulta: string): Promise<RespostaConsultarNfse> {
    this.ensureConnected();

    try {
      const args = { ArquivoXML: xmlConsulta };
      const [result] = await this.client!.ConsultarNfseRpsAsync(args);
      
      return this.parseRespostaConsultarNfse(result.ConsultarNfseRpsResult);
    } catch (error: any) {
      return {
        sucesso: false,
        mensagens: [{
          codigo: 'ERRO_COMUNICACAO',
          mensagem: error.message
        }]
      };
    }
  }

  /**
   * Enviar Lote de RPS (assíncrono)
   */
  async enviarLoteRps(xmlEnvio: string): Promise<RespostaEnviarLote> {
    this.ensureConnected();

    try {
      const args = { ArquivoXML: xmlEnvio };
      const [result] = await this.client!.RecepcionarLoteRpsAsync(args);
      
      return this.parseRespostaEnviarLote(result.RecepcionarLoteRpsResult);
    } catch (error: any) {
      return {
        sucesso: false,
        mensagens: [{
          codigo: 'ERRO_COMUNICACAO',
          mensagem: error.message
        }]
      };
    }
  }

  /**
   * Consultar Lote de RPS
   */
  async consultarLoteRps(xmlConsulta: string): Promise<RespostaConsultarLote> {
    this.ensureConnected();

    try {
      const args = { ArquivoXML: xmlConsulta };
      const [result] = await this.client!.ConsultarLoteRpsAsync(args);
      
      return this.parseRespostaConsultarLote(result.ConsultarLoteRpsResult);
    } catch (error: any) {
      return {
        sucesso: false,
        mensagens: [{
          codigo: 'ERRO_COMUNICACAO',
          mensagem: error.message
        }]
      };
    }
  }

  /**
   * Executa método genérico do WebService
   */
  async execute(method: string, xml: string): Promise<string> {
    this.ensureConnected();

    const args = { ArquivoXML: xml };
    const methodAsync = `${method}Async`;
    
    if (typeof (this.client as any)[methodAsync] !== 'function') {
      throw new Error(`Método ${method} não encontrado no WebService`);
    }

    const [result] = await (this.client as any)[methodAsync](args);
    return result[`${method}Result`];
  }

  /**
   * Garante que está conectado
   */
  private ensureConnected(): void {
    if (!this.client) {
      throw new Error('Cliente não conectado. Execute connect() primeiro.');
    }
  }

  /**
   * Parseia resposta de GerarNfse
   */
  private parseRespostaGerarNfse(xmlResposta: string): RespostaGerarNfse {
    const mensagens = this.extractMensagens(xmlResposta);
    const hasError = mensagens.some(m => !m.codigo.startsWith('A')); // Alertas começam com A

    if (hasError || mensagens.length > 0) {
      // Verificar se é erro ou sucesso com alertas
      const erros = mensagens.filter(m => !m.codigo.startsWith('A'));
      if (erros.length > 0) {
        return {
          sucesso: false,
          mensagens,
          xmlResposta
        };
      }
    }

    // Extrair dados da NFS-e gerada
    const numeroMatch = xmlResposta.match(/<Numero>(\d+)<\/Numero>/);
    const codigoMatch = xmlResposta.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/);
    const dataMatch = xmlResposta.match(/<DataEmissao>([^<]+)<\/DataEmissao>/);
    const valorMatch = xmlResposta.match(/<ValorServicos>([^<]+)<\/ValorServicos>/);

    return {
      sucesso: true,
      nfse: {
        numero: numeroMatch ? parseInt(numeroMatch[1]) : 0,
        codigoVerificacao: codigoMatch ? codigoMatch[1] : '',
        dataEmissao: dataMatch ? new Date(dataMatch[1]) : new Date(),
        competencia: '',
        valorServicos: valorMatch ? parseFloat(valorMatch[1]) : 0
      },
      mensagens,
      xmlResposta
    };
  }

  /**
   * Parseia resposta de ConsultarNfse
   */
  private parseRespostaConsultarNfse(xmlResposta: string): RespostaConsultarNfse {
    const mensagens = this.extractMensagens(xmlResposta);

    if (mensagens.length > 0 && !mensagens[0].codigo.startsWith('A')) {
      return {
        sucesso: false,
        mensagens,
        xmlResposta
      };
    }

    const numeroMatch = xmlResposta.match(/<Numero>(\d+)<\/Numero>/);
    const codigoMatch = xmlResposta.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/);

    return {
      sucesso: true,
      nfse: {
        numero: numeroMatch ? parseInt(numeroMatch[1]) : 0,
        codigoVerificacao: codigoMatch ? codigoMatch[1] : '',
        dataEmissao: new Date(),
        competencia: '',
        valorServicos: 0
      },
      mensagens,
      xmlResposta
    };
  }

  /**
   * Parseia resposta de EnviarLote
   */
  private parseRespostaEnviarLote(xmlResposta: string): RespostaEnviarLote {
    const mensagens = this.extractMensagens(xmlResposta);

    const protocoloMatch = xmlResposta.match(/<Protocolo>([^<]+)<\/Protocolo>/);
    const dataMatch = xmlResposta.match(/<DataRecebimento>([^<]+)<\/DataRecebimento>/);
    const numeroLoteMatch = xmlResposta.match(/<NumeroLote>(\d+)<\/NumeroLote>/);

    const sucesso = protocoloMatch !== null;

    return {
      sucesso,
      protocolo: protocoloMatch ? protocoloMatch[1] : undefined,
      dataRecebimento: dataMatch ? new Date(dataMatch[1]) : undefined,
      numeroLote: numeroLoteMatch ? parseInt(numeroLoteMatch[1]) : undefined,
      mensagens,
      xmlResposta
    };
  }

  /**
   * Parseia resposta de ConsultarLote
   */
  private parseRespostaConsultarLote(xmlResposta: string): RespostaConsultarLote {
    const mensagens = this.extractMensagens(xmlResposta);

    const situacaoMatch = xmlResposta.match(/<Situacao>(\d+)<\/Situacao>/);
    
    return {
      sucesso: situacaoMatch !== null,
      situacao: situacaoMatch ? this.getSituacaoLote(parseInt(situacaoMatch[1])) : undefined,
      mensagens,
      xmlResposta
    };
  }

  /**
   * Extrai mensagens de retorno do XML
   */
  private extractMensagens(xml: string): MensagemRetorno[] {
    const mensagens: MensagemRetorno[] = [];
    const regex = /<MensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>[\s\S]*?(?:<Correcao>([^<]*)<\/Correcao>)?[\s\S]*?<\/MensagemRetorno>/g;

    let match;
    while ((match = regex.exec(xml)) !== null) {
      mensagens.push({
        codigo: match[1],
        mensagem: match[2],
        correcao: match[3] || undefined
      });
    }

    return mensagens;
  }

  /**
   * Retorna descrição da situação do lote
   */
  private getSituacaoLote(codigo: number): string {
    switch (codigo) {
      case 1: return 'Não Recebido';
      case 2: return 'Não Processado';
      case 3: return 'Processado com Erro';
      case 4: return 'Processado com Sucesso';
      default: return 'Desconhecido';
    }
  }
}

/**
 * Factory para criar cliente configurado para Goiânia
 */
export function createNfseClientGoiania(
  pfxPath: string,
  pfxPassword: string,
  ambiente: 'TESTE' | 'PRODUCAO' = 'PRODUCAO'
): NfseClient {
  return new NfseClient({
    wsdlUrl: ENDPOINTS.GOIANIA_LEGADO.PRODUCAO.WSDL,
    pfxPath,
    pfxPassword
  });
}
