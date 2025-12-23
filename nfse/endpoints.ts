/**
 * Configuração dos endpoints do WebService NFS-e Goiânia
 */

export const ENDPOINTS = {
  // Modelo Legado - Goiânia (ABRASF 2.0) - ATUALMENTE EM PRODUÇÃO
  GOIANIA_LEGADO: {
    PRODUCAO: {
      WEBSERVICE: 'https://nfse.goiania.go.gov.br/ws/nfse.asmx',
      WSDL: 'https://nfse.goiania.go.gov.br/ws/nfse.asmx?wsdl',
      XSD: 'https://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd',
      NAMESPACE: 'http://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd',
      IMPRESSAO: 'http://www2.goiania.go.gov.br/sistemas/snfse/asp/snfse00200w0.asp'
    }
  },
  
  // Modelo Nacional (Nota Control) - EM IMPLEMENTAÇÃO
  NACIONAL: {
    HOMOLOGACAO: {
      WEBSERVICE: 'https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx',
      VALIDADOR: 'https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/validarxml',
      XSD: 'https://www.notacontrol.com.br/download/nfse/schema_v101.xsd',
      NAMESPACE: 'http://www.sped.fazenda.gov.br/nfse'
    },
    PRODUCAO: {
      // URLs de produção serão disponibilizadas pela prefeitura
      WEBSERVICE: '',
      XSD: 'https://www.notacontrol.com.br/download/nfse/schema_v101.xsd',
      NAMESPACE: 'http://www.sped.fazenda.gov.br/nfse'
    }
  }
};

export const MUNICIPIO = {
  CODIGO_IBGE: '5208707',
  NOME: 'Goiânia',
  UF: 'GO'
};

export const CONTATOS = {
  SUPORTE_EMAIL: 'suporte.nfse@goiania.go.gov.br',
  GIOF_TELEFONE: '(62) 3524-4040'
};

export type AmbienteType = 'TESTE' | 'PRODUCAO';
export type ModeloType = 'LEGADO' | 'NACIONAL';
