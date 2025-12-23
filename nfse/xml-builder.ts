/**
 * Construtor de XML para NFS-e Goiânia
 * Suporta modelo legado (ABRASF 2.0) e modelo nacional
 */

import {
  Rps,
  LoteRps,
  DPS,
  NaturezaOperacao,
  StatusRps,
  TipoRps
} from '../models/nfse';
import { ENDPOINTS, MUNICIPIO } from '../config/endpoints';

export class XmlBuilder {
  private namespace: string;
  private versao: string;

  constructor(modelo: 'LEGADO' | 'NACIONAL' = 'LEGADO') {
    if (modelo === 'LEGADO') {
      this.namespace = ENDPOINTS.GOIANIA_LEGADO.PRODUCAO.NAMESPACE;
      this.versao = '2.00';
    } else {
      this.namespace = ENDPOINTS.NACIONAL.HOMOLOGACAO.NAMESPACE;
      this.versao = '1.01';
    }
  }

  /**
   * Formata data no padrão AAAA-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Formata data/hora no padrão UTC
   */
  private formatDateTime(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, '-03:00');
  }

  /**
   * Formata valor numérico (sem separador de milhar, ponto decimal)
   */
  private formatValue(value: number | undefined): string {
    if (value === undefined || value === null) return '';
    return value.toFixed(2);
  }

  /**
   * Remove caracteres especiais e formatação
   */
  private cleanText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Gera o ID do RPS (modelo legado)
   */
  private generateRpsId(rps: Rps): string {
    const cnpj = rps.prestador.cnpj.replace(/\D/g, '');
    const serie = rps.identificacaoRps.serie.padStart(5, '0');
    const numero = rps.identificacaoRps.numero.toString().padStart(15, '0');
    return `rps_${cnpj}_${serie}_${numero}`;
  }

  /**
   * Gera o ID da DPS (modelo nacional)
   */
  private generateDpsId(cnpj: string, serie: string, numero: number): string {
    const tipoInscricao = '1'; // 1=CNPJ, 2=CPF
    const inscricao = cnpj.replace(/\D/g, '').padStart(14, '0');
    const serieFormatada = serie.replace(/\D/g, '').padStart(5, '0');
    const numeroFormatado = numero.toString().padStart(15, '0');
    return `DPS${MUNICIPIO.CODIGO_IBGE}${tipoInscricao}${inscricao}${serieFormatada}${numeroFormatado}`;
  }

  /**
   * Constrói XML de envio para gerar NFS-e (modelo legado Goiânia)
   */
  buildGerarNfseEnvio(rps: Rps): string {
    const id = this.generateRpsId(rps);
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `<GerarNfseEnvio xmlns="${this.namespace}">`;
    xml += `<Rps>`;
    xml += `<InfRps Id="${id}">`;
    
    // Identificação do RPS
    xml += `<IdentificacaoRps>`;
    xml += `<Numero>${rps.identificacaoRps.numero}</Numero>`;
    xml += `<Serie>${rps.identificacaoRps.serie}</Serie>`;
    xml += `<Tipo>${rps.identificacaoRps.tipo}</Tipo>`;
    xml += `</IdentificacaoRps>`;
    
    // Data de Emissão
    xml += `<DataEmissao>${this.formatDate(rps.dataEmissao)}</DataEmissao>`;
    
    // Natureza da Operação
    xml += `<NaturezaOperacao>${rps.naturezaOperacao}</NaturezaOperacao>`;
    
    // Regime Especial (opcional)
    if (rps.regimeEspecialTributacao !== undefined) {
      xml += `<RegimeEspecialTributacao>${rps.regimeEspecialTributacao}</RegimeEspecialTributacao>`;
    }
    
    // Optante Simples Nacional
    xml += `<OptanteSimplesNacional>${rps.optanteSimplesNacional ? 1 : 2}</OptanteSimplesNacional>`;
    
    // Incentivador Cultural
    xml += `<IncentivadorCultural>${rps.incentivadorCultural ? 1 : 2}</IncentivadorCultural>`;
    
    // Status
    xml += `<Status>${rps.status}</Status>`;
    
    // Serviço
    xml += this.buildServico(rps);
    
    // Prestador
    xml += `<Prestador>`;
    xml += `<Cnpj>${rps.prestador.cnpj.replace(/\D/g, '')}</Cnpj>`;
    xml += `<InscricaoMunicipal>${rps.prestador.inscricaoMunicipal}</InscricaoMunicipal>`;
    xml += `</Prestador>`;
    
    // Tomador (opcional)
    if (rps.tomador) {
      xml += this.buildTomador(rps.tomador);
    }
    
    // Intermediário (opcional)
    if (rps.intermediarioServico) {
      xml += this.buildIntermediario(rps.intermediarioServico);
    }
    
    // Construção Civil (opcional)
    if (rps.construcaoCivil) {
      xml += `<ConstrucaoCivil>`;
      if (rps.construcaoCivil.codigoObra) {
        xml += `<CodigoObra>${rps.construcaoCivil.codigoObra}</CodigoObra>`;
      }
      if (rps.construcaoCivil.art) {
        xml += `<Art>${rps.construcaoCivil.art}</Art>`;
      }
      xml += `</ConstrucaoCivil>`;
    }
    
    xml += `</InfRps>`;
    xml += `</Rps>`;
    xml += `</GerarNfseEnvio>`;
    
    return xml;
  }

  /**
   * Constrói seção de Serviço
   */
  private buildServico(rps: Rps): string {
    const s = rps.servico;
    const v = s.valores;
    
    let xml = `<Servico>`;
    xml += `<Valores>`;
    xml += `<ValorServicos>${this.formatValue(v.valorServicos)}</ValorServicos>`;
    
    if (v.valorDeducoes) xml += `<ValorDeducoes>${this.formatValue(v.valorDeducoes)}</ValorDeducoes>`;
    if (v.valorPis) xml += `<ValorPis>${this.formatValue(v.valorPis)}</ValorPis>`;
    if (v.valorCofins) xml += `<ValorCofins>${this.formatValue(v.valorCofins)}</ValorCofins>`;
    if (v.valorInss) xml += `<ValorInss>${this.formatValue(v.valorInss)}</ValorInss>`;
    if (v.valorIr) xml += `<ValorIr>${this.formatValue(v.valorIr)}</ValorIr>`;
    if (v.valorCsll) xml += `<ValorCsll>${this.formatValue(v.valorCsll)}</ValorCsll>`;
    
    xml += `<IssRetido>${v.issRetido ? 1 : 2}</IssRetido>`;
    
    if (v.valorIss) xml += `<ValorIss>${this.formatValue(v.valorIss)}</ValorIss>`;
    if (v.valorIssRetido) xml += `<ValorIssRetido>${this.formatValue(v.valorIssRetido)}</ValorIssRetido>`;
    if (v.outrasRetencoes) xml += `<OutrasRetencoes>${this.formatValue(v.outrasRetencoes)}</OutrasRetencoes>`;
    if (v.baseCalculo) xml += `<BaseCalculo>${this.formatValue(v.baseCalculo)}</BaseCalculo>`;
    if (v.aliquota !== undefined) xml += `<Aliquota>${v.aliquota}</Aliquota>`;
    if (v.valorLiquidoNfse) xml += `<ValorLiquidoNfse>${this.formatValue(v.valorLiquidoNfse)}</ValorLiquidoNfse>`;
    if (v.descontoIncondicionado) xml += `<DescontoIncondicionado>${this.formatValue(v.descontoIncondicionado)}</DescontoIncondicionado>`;
    if (v.descontoCondicionado) xml += `<DescontoCondicionado>${this.formatValue(v.descontoCondicionado)}</DescontoCondicionado>`;
    
    xml += `</Valores>`;
    
    xml += `<ItemListaServico>${s.itemListaServico}</ItemListaServico>`;
    if (s.codigoCnae) xml += `<CodigoCnae>${s.codigoCnae}</CodigoCnae>`;
    xml += `<CodigoTributacaoMunicipio>${s.codigoTributacaoMunicipio}</CodigoTributacaoMunicipio>`;
    xml += `<Discriminacao>${this.cleanText(s.discriminacao)}</Discriminacao>`;
    xml += `<CodigoMunicipio>${s.codigoMunicipio}</CodigoMunicipio>`;
    
    if (s.codigoPais) xml += `<CodigoPais>${s.codigoPais}</CodigoPais>`;
    if (s.exigibilidadeIss) xml += `<ExigibilidadeISS>${s.exigibilidadeIss}</ExigibilidadeISS>`;
    if (s.municipioIncidencia) xml += `<MunicipioIncidencia>${s.municipioIncidencia}</MunicipioIncidencia>`;
    if (s.numeroProcesso) xml += `<NumeroProcesso>${s.numeroProcesso}</NumeroProcesso>`;
    
    xml += `</Servico>`;
    
    return xml;
  }

  /**
   * Constrói seção do Tomador
   */
  private buildTomador(tomador: any): string {
    let xml = `<Tomador>`;
    
    if (tomador.identificacaoTomador) {
      xml += `<IdentificacaoTomador>`;
      xml += `<CpfCnpj>`;
      const doc = tomador.identificacaoTomador.cpfCnpj.replace(/\D/g, '');
      if (doc.length === 11) {
        xml += `<Cpf>${doc}</Cpf>`;
      } else {
        xml += `<Cnpj>${doc}</Cnpj>`;
      }
      xml += `</CpfCnpj>`;
      if (tomador.identificacaoTomador.inscricaoMunicipal) {
        xml += `<InscricaoMunicipal>${tomador.identificacaoTomador.inscricaoMunicipal}</InscricaoMunicipal>`;
      }
      xml += `</IdentificacaoTomador>`;
    }
    
    if (tomador.razaoSocial) {
      xml += `<RazaoSocial>${this.cleanText(tomador.razaoSocial)}</RazaoSocial>`;
    }
    
    if (tomador.endereco) {
      const e = tomador.endereco;
      xml += `<Endereco>`;
      xml += `<Endereco>${this.cleanText(e.endereco)}</Endereco>`;
      xml += `<Numero>${e.numero}</Numero>`;
      if (e.complemento) xml += `<Complemento>${this.cleanText(e.complemento)}</Complemento>`;
      xml += `<Bairro>${this.cleanText(e.bairro)}</Bairro>`;
      xml += `<CodigoMunicipio>${e.codigoMunicipio}</CodigoMunicipio>`;
      xml += `<Uf>${e.uf}</Uf>`;
      xml += `<Cep>${e.cep.replace(/\D/g, '')}</Cep>`;
      xml += `</Endereco>`;
    }
    
    if (tomador.contato) {
      xml += `<Contato>`;
      if (tomador.contato.telefone) xml += `<Telefone>${tomador.contato.telefone.replace(/\D/g, '')}</Telefone>`;
      if (tomador.contato.email) xml += `<Email>${tomador.contato.email}</Email>`;
      xml += `</Contato>`;
    }
    
    xml += `</Tomador>`;
    return xml;
  }

  /**
   * Constrói seção do Intermediário
   */
  private buildIntermediario(intermediario: any): string {
    let xml = `<IntermediarioServico>`;
    
    xml += `<IdentificacaoIntermediario>`;
    xml += `<CpfCnpj>`;
    const doc = intermediario.identificacaoIntermediario.cpfCnpj.replace(/\D/g, '');
    if (doc.length === 11) {
      xml += `<Cpf>${doc}</Cpf>`;
    } else {
      xml += `<Cnpj>${doc}</Cnpj>`;
    }
    xml += `</CpfCnpj>`;
    if (intermediario.identificacaoIntermediario.inscricaoMunicipal) {
      xml += `<InscricaoMunicipal>${intermediario.identificacaoIntermediario.inscricaoMunicipal}</InscricaoMunicipal>`;
    }
    xml += `</IdentificacaoIntermediario>`;
    
    xml += `<RazaoSocial>${this.cleanText(intermediario.razaoSocial)}</RazaoSocial>`;
    
    xml += `</IntermediarioServico>`;
    return xml;
  }

  /**
   * Constrói XML de consulta por RPS
   */
  buildConsultarNfsePorRpsEnvio(
    numeroRps: number,
    serieRps: string,
    tipoRps: TipoRps,
    cnpjPrestador: string,
    inscricaoMunicipal: string
  ): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `<ConsultarNfseRpsEnvio xmlns="${this.namespace}">`;
    xml += `<IdentificacaoRps>`;
    xml += `<Numero>${numeroRps}</Numero>`;
    xml += `<Serie>${serieRps}</Serie>`;
    xml += `<Tipo>${tipoRps}</Tipo>`;
    xml += `</IdentificacaoRps>`;
    xml += `<Prestador>`;
    xml += `<Cnpj>${cnpjPrestador.replace(/\D/g, '')}</Cnpj>`;
    xml += `<InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>`;
    xml += `</Prestador>`;
    xml += `</ConsultarNfseRpsEnvio>`;
    
    return xml;
  }

  /**
   * Constrói XML para envio de lote de RPS
   */
  buildEnviarLoteRpsEnvio(lote: LoteRps): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `<EnviarLoteRpsEnvio xmlns="${this.namespace}">`;
    xml += `<LoteRps Id="lote_${lote.numeroLote}" versao="${this.versao}">`;
    xml += `<NumeroLote>${lote.numeroLote}</NumeroLote>`;
    xml += `<Cnpj>${lote.cnpj.replace(/\D/g, '')}</Cnpj>`;
    xml += `<InscricaoMunicipal>${lote.inscricaoMunicipal}</InscricaoMunicipal>`;
    xml += `<QuantidadeRps>${lote.quantidadeRps}</QuantidadeRps>`;
    xml += `<ListaRps>`;
    
    for (const rps of lote.listaRps) {
      const id = this.generateRpsId(rps);
      xml += `<Rps>`;
      xml += `<InfRps Id="${id}">`;
      // ... (mesmo conteúdo de buildGerarNfseEnvio)
      xml += `</InfRps>`;
      xml += `</Rps>`;
    }
    
    xml += `</ListaRps>`;
    xml += `</LoteRps>`;
    xml += `</EnviarLoteRpsEnvio>`;
    
    return xml;
  }

  /**
   * Constrói XML de consulta de lote
   */
  buildConsultarLoteRpsEnvio(
    protocolo: string,
    cnpjPrestador: string,
    inscricaoMunicipal: string
  ): string {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `<ConsultarLoteRpsEnvio xmlns="${this.namespace}">`;
    xml += `<Prestador>`;
    xml += `<Cnpj>${cnpjPrestador.replace(/\D/g, '')}</Cnpj>`;
    xml += `<InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>`;
    xml += `</Prestador>`;
    xml += `<Protocolo>${protocolo}</Protocolo>`;
    xml += `</ConsultarLoteRpsEnvio>`;
    
    return xml;
  }
}
