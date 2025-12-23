# 📋 Guia de Integração NFS-e - Prefeitura de Goiânia
## Manual Técnico para Desenvolvimento com Claude AI no VSCode

---

## 📌 INFORMAÇÕES IMPORTANTES

### Dados da Empresa AMPLA Contabilidade Ltda
- **Razão Social**: AMPLA Contabilidade Ltda
- **Município**: Goiânia/GO
- **Código IBGE**: 5208707
- **Contato Prefeitura**: suporte.nfse@goiania.go.gov.br

### ⚠️ MODELO DO WEBSERVICE
O município de Goiânia utiliza **dois modelos distintos**:

1. **Modelo Legado (ABRASF 2.0)** - ATUALMENTE EM PRODUÇÃO
2. **Modelo Nacional (NFS-e Nacional)** - EM IMPLEMENTAÇÃO (Provedor Nota Control)

---

## 🔧 MODELO 1: WEBSERVICE GOIÂNIA LEGADO (ABRASF 2.0)

### Endpoints do WebService

| Ambiente | URL |
|----------|-----|
| **Produção** | `https://nfse.goiania.go.gov.br/ws/nfse.asmx` |
| **WSDL** | `https://nfse.goiania.go.gov.br/ws/nfse.asmx?wsdl` |
| **Schema XSD** | `https://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd` |
| **Namespace** | `http://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd` |

### Serviços Disponíveis

| Serviço | Método | Tipo |
|---------|--------|------|
| Gerar NFS-e (Síncrono) | `GerarNfse` | Síncrono |
| Consulta NFS-e por RPS | `ConsultarNfsePorRps` | Síncrono |
| Visualização NFS-e (HTML) | Via URL | HTTP GET |

> ⚠️ **IMPORTANTE**: Cancelamento e Substituição NÃO estão disponíveis via webservice. Devem ser realizados através de Processo Administrativo junto à Secretaria de Finanças.

### Modo TESTE vs PRODUÇÃO

- **Inicialmente**: Todos os prestadores começam em modo TESTE
- **Modo TESTE**: Use série = "TESTE" - Validações são reais, mas nenhuma nota é gerada
- **Retorno TESTE**: Sempre retorna nota fictícia de número 370
- **Solicitar PRODUÇÃO**: Enviar e-mail para `suporte.nfse@goiania.go.gov.br`

### URL de Impressão/Visualização
```
http://www2.goiania.go.gov.br/sistemas/snfse/asp/snfse00200w0.asp?inscricao={IM}&nota={NUM}&verificador={COD}
```

---

## 📁 ESTRUTURA DO PROJETO TypeScript/Node.js

```
nfse-goiania/
├── src/
│   ├── config/
│   │   ├── endpoints.ts        # URLs e configurações
│   │   └── certificate.ts      # Gerenciamento de certificado
│   ├── services/
│   │   ├── nfse-client.ts      # Cliente SOAP
│   │   ├── xml-builder.ts      # Construtor de XML
│   │   ├── xml-signer.ts       # Assinatura digital
│   │   └── xml-validator.ts    # Validação XSD
│   ├── models/
│   │   ├── rps.ts              # Modelo do RPS
│   │   ├── nfse.ts             # Modelo da NFS-e
│   │   └── prestador.ts        # Dados do prestador
│   ├── utils/
│   │   ├── date-formatter.ts   # Formatação de datas
│   │   └── number-formatter.ts # Formatação de valores
│   └── index.ts
├── certificates/
│   └── certificado.pfx         # Certificado A1
├── schemas/
│   └── nfse_gyn_v02.xsd        # Schema XSD
├── package.json
├── tsconfig.json
└── .env
```

---

## 🔐 CERTIFICADO DIGITAL

### Requisitos
- **Tipo**: ICP-Brasil (e-CNPJ ou e-CPF)
- **Formato**: A1 ou A3 (recomendado A1 para integração)
- **CNPJ**: Deve ser **IDÊNTICO** ao CNPJ do prestador

### Configuração do Certificado (certificate.ts)

```typescript
import * as fs from 'fs';
import * as forge from 'node-forge';

export interface CertificateConfig {
  pfxPath: string;
  password: string;
}

export class CertificateManager {
  private cert: forge.pki.Certificate;
  private key: forge.pki.PrivateKey;
  
  constructor(config: CertificateConfig) {
    const pfxBuffer = fs.readFileSync(config.pfxPath);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, config.password);
    
    // Extrair certificado e chave privada
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    
    this.cert = certBags[forge.pki.oids.certBag]![0].cert!;
    this.key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]![0].key!;
  }
  
  getCertificatePem(): string {
    return forge.pki.certificateToPem(this.cert);
  }
  
  getPrivateKeyPem(): string {
    return forge.pki.privateKeyToPem(this.key);
  }
  
  getCNPJ(): string {
    // Extrair CNPJ do certificado
    const subject = this.cert.subject.getField('CN');
    const cnMatch = subject?.value?.match(/\d{14}/);
    return cnMatch ? cnMatch[0] : '';
  }
}
```

---

## 📝 ESTRUTURA XML - GERAÇÃO DE NFS-e (Modelo Goiânia)

### XML de Envio - GerarNfse

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseEnvio xmlns="http://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd">
  <Rps>
    <InfRps Id="rps_{CNPJ}_{SERIE}_{NUMERO}">
      <IdentificacaoRps>
        <Numero>{NUMERO_RPS}</Numero>
        <Serie>{SERIE}</Serie>
        <Tipo>1</Tipo>
      </IdentificacaoRps>
      <DataEmissao>{DATA_EMISSAO}</DataEmissao>
      <NaturezaOperacao>{NATUREZA}</NaturezaOperacao>
      <RegimeEspecialTributacao>{REGIME}</RegimeEspecialTributacao>
      <OptanteSimplesNacional>{SIMPLES}</OptanteSimplesNacional>
      <IncentivadorCultural>{INCENTIVO}</IncentivadorCultural>
      <Status>1</Status>
      
      <Servico>
        <Valores>
          <ValorServicos>{VALOR_SERVICOS}</ValorServicos>
          <ValorDeducoes>{VALOR_DEDUCOES}</ValorDeducoes>
          <ValorPis>{VALOR_PIS}</ValorPis>
          <ValorCofins>{VALOR_COFINS}</ValorCofins>
          <ValorInss>{VALOR_INSS}</ValorInss>
          <ValorIr>{VALOR_IR}</ValorIr>
          <ValorCsll>{VALOR_CSLL}</ValorCsll>
          <IssRetido>{ISS_RETIDO}</IssRetido>
          <ValorIss>{VALOR_ISS}</ValorIss>
          <ValorIssRetido>{VALOR_ISS_RETIDO}</ValorIssRetido>
          <OutrasRetencoes>{OUTRAS_RETENCOES}</OutrasRetencoes>
          <BaseCalculo>{BASE_CALCULO}</BaseCalculo>
          <Aliquota>{ALIQUOTA}</Aliquota>
          <ValorLiquidoNfse>{VALOR_LIQUIDO}</ValorLiquidoNfse>
          <DescontoIncondicionado>{DESCONTO}</DescontoIncondicionado>
          <DescontoCondicionado>{DESCONTO_COND}</DescontoCondicionado>
        </Valores>
        <ItemListaServico>{ITEM_LISTA}</ItemListaServico>
        <CodigoTributacaoMunicipio>{COD_TRIBUTACAO}</CodigoTributacaoMunicipio>
        <Discriminacao>{DISCRIMINACAO}</Discriminacao>
        <CodigoMunicipio>{COD_MUNICIPIO}</CodigoMunicipio>
      </Servico>
      
      <Prestador>
        <Cnpj>{CNPJ_PRESTADOR}</Cnpj>
        <InscricaoMunicipal>{IM_PRESTADOR}</InscricaoMunicipal>
      </Prestador>
      
      <Tomador>
        <IdentificacaoTomador>
          <CpfCnpj>
            <Cnpj>{CNPJ_TOMADOR}</Cnpj>
            <!-- OU -->
            <Cpf>{CPF_TOMADOR}</Cpf>
          </CpfCnpj>
          <InscricaoMunicipal>{IM_TOMADOR}</InscricaoMunicipal>
        </IdentificacaoTomador>
        <RazaoSocial>{RAZAO_TOMADOR}</RazaoSocial>
        <Endereco>
          <Endereco>{LOGRADOURO}</Endereco>
          <Numero>{NUMERO}</Numero>
          <Complemento>{COMPLEMENTO}</Complemento>
          <Bairro>{BAIRRO}</Bairro>
          <CodigoMunicipio>{COD_MUN_TOMADOR}</CodigoMunicipio>
          <Uf>{UF}</Uf>
          <Cep>{CEP}</Cep>
        </Endereco>
        <Contato>
          <Telefone>{TELEFONE}</Telefone>
          <Email>{EMAIL}</Email>
        </Contato>
      </Tomador>
      
    </InfRps>
  </Rps>
</GerarNfseEnvio>
```

### Campos Importantes

| Campo | Descrição | Obrigatório |
|-------|-----------|-------------|
| `CodigoTributacaoMunicipio` | Código de Atividade Econômica (9 dígitos) | Sim |
| `Aliquota` | Obrigatório apenas para Simples Nacional | Condicional |
| `Serie` | Use "TESTE" para modo teste | Sim |
| `Numero` | Número sequencial do RPS | Sim |
| `NaturezaOperacao` | 1=Normal, 2=Fora município, etc. | Sim |

---

## 🔏 ASSINATURA DIGITAL XML

### Implementação com xml-crypto

```typescript
import { SignedXml } from 'xml-crypto';
import * as crypto from 'crypto';

export class XmlSigner {
  private privateKey: string;
  private certificate: string;
  
  constructor(privateKey: string, certificate: string) {
    this.privateKey = privateKey;
    this.certificate = certificate;
  }
  
  signXml(xml: string, referenceId: string): string {
    const sig = new SignedXml();
    
    // Configurar algoritmos
    sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
    
    // Adicionar referência
    sig.addReference(
      `//*[@Id='${referenceId}']`,
      [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
      ],
      'http://www.w3.org/2000/09/xmldsig#sha1'
    );
    
    // Configurar chave e certificado
    sig.signingKey = this.privateKey;
    sig.keyInfoProvider = {
      getKeyInfo: () => {
        const certBase64 = this.certificate
          .replace(/-----BEGIN CERTIFICATE-----/g, '')
          .replace(/-----END CERTIFICATE-----/g, '')
          .replace(/\s/g, '');
        return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
      }
    };
    
    // Assinar
    sig.computeSignature(xml);
    
    return sig.getSignedXml();
  }
}
```

---

## 📡 CLIENTE SOAP

### Implementação do Cliente (nfse-client.ts)

```typescript
import * as soap from 'soap';
import * as https from 'https';
import * as fs from 'fs';

export interface NfseClientConfig {
  wsdlUrl: string;
  pfxPath: string;
  pfxPassword: string;
}

export class NfseClient {
  private config: NfseClientConfig;
  private client: soap.Client | null = null;
  
  constructor(config: NfseClientConfig) {
    this.config = config;
  }
  
  async connect(): Promise<void> {
    const pfxBuffer = fs.readFileSync(this.config.pfxPath);
    
    const httpsAgent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: this.config.pfxPassword,
      rejectUnauthorized: true
    });
    
    this.client = await soap.createClientAsync(this.config.wsdlUrl, {
      wsdl_options: { httpsAgent },
      request: { httpsAgent }
    });
  }
  
  async gerarNfse(xmlEnvio: string): Promise<string> {
    if (!this.client) {
      throw new Error('Cliente não conectado. Execute connect() primeiro.');
    }
    
    const args = { ArquivoXML: xmlEnvio };
    const [result] = await this.client.GerarNfseAsync(args);
    
    return result.GerarNfseResult;
  }
  
  async consultarNfsePorRps(xmlConsulta: string): Promise<string> {
    if (!this.client) {
      throw new Error('Cliente não conectado. Execute connect() primeiro.');
    }
    
    const args = { ArquivoXML: xmlConsulta };
    const [result] = await this.client.ConsultarNfsePorRpsAsync(args);
    
    return result.ConsultarNfsePorRpsResult;
  }
}
```

---

## 📊 MODELOS DE DADOS

### Interface RPS (rps.ts)

```typescript
export interface Rps {
  identificacao: {
    numero: number;
    serie: string;
    tipo: 1 | 2 | 3; // 1=RPS, 2=NFSC, 3=Cupom
  };
  dataEmissao: Date;
  naturezaOperacao: NaturezaOperacao;
  regimeEspecialTributacao?: RegimeEspecialTributacao;
  optanteSimplesNacional: boolean;
  incentivadorCultural: boolean;
  status: 1 | 2; // 1=Normal, 2=Cancelado
  servico: Servico;
  prestador: Prestador;
  tomador: Tomador;
  intermediario?: Intermediario;
  construcaoCivil?: ConstrucaoCivil;
}

export enum NaturezaOperacao {
  TRIBUTACAO_MUNICIPIO = 1,
  TRIBUTACAO_FORA_MUNICIPIO = 2,
  ISENCAO = 3,
  IMUNE = 4,
  EXIGIBILIDADE_SUSPENSA_DECISAO_JUDICIAL = 5,
  EXIGIBILIDADE_SUSPENSA_PROCEDIMENTO_ADM = 6
}

export enum RegimeEspecialTributacao {
  MICROEMPRESA_MUNICIPAL = 1,
  ESTIMATIVA = 2,
  SOCIEDADE_PROFISSIONAIS = 3,
  COOPERATIVA = 4,
  MICROEMPRESARIO_INDIVIDUAL = 5,
  MICROEMPRESA_EPP_SIMPLES = 6
}
```

### Interface Serviço

```typescript
export interface Servico {
  valores: ValoresServico;
  itemListaServico: string;
  codigoTributacaoMunicipio: string; // 9 dígitos
  discriminacao: string;
  codigoMunicipio: string; // Código IBGE
  codigoPais?: string;
  exigibilidadeIss?: ExigibilidadeISS;
  municipioIncidencia?: string;
}

export interface ValoresServico {
  valorServicos: number;
  valorDeducoes?: number;
  valorPis?: number;
  valorCofins?: number;
  valorInss?: number;
  valorIr?: number;
  valorCsll?: number;
  issRetido: boolean;
  valorIss?: number;
  valorIssRetido?: number;
  outrasRetencoes?: number;
  baseCalculo?: number;
  aliquota?: number; // Obrigatório para Simples Nacional
  valorLiquidoNfse?: number;
  descontoIncondicionado?: number;
  descontoCondicionado?: number;
}
```

---

## 🔧 MODELO 2: NFS-e PADRÃO NACIONAL (Provedor Nota Control)

### Endpoints do WebService (Homologação)

| Ambiente | URL |
|----------|-----|
| **Homologação** | `https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx` |
| **Validador XML** | `https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/validarxml` |
| **Schema XSD** | `https://www.notacontrol.com.br/download/nfse/schema_v101.xsd` |

### Serviços Disponíveis (Padrão Nacional)

| Serviço | Método | Tipo |
|---------|--------|------|
| Recepção de Lote DPS | `RecepcionarLoteDps` | Assíncrono |
| Enviar Lote DPS Síncrono | `RecepcionarLoteDpsSincrono` | Síncrono |
| Gerar NFS-e | `GerarNfse` | Síncrono |
| Cancelar NFS-e | `CancelarNfse` | Síncrono |
| Consultar Lote DPS | `ConsultarLoteDps` | Síncrono |
| Consultar NFS-e por DPS | `ConsultarNfsePorDps` | Síncrono |
| Consultar Serviços Prestados | `ConsultarNfseServicoPrestado` | Síncrono |
| Consultar Serviços Tomados | `ConsultarNfseServicoTomado` | Síncrono |
| Consultar por Faixa | `ConsultarNfseFaixa` | Síncrono |
| Consultar Dados Cadastrais | `ConsultarDadosCadastrais` | Síncrono |
| Consultar DPS Disponível | `ConsultarDpsDisponivel` | Síncrono |
| Consultar URL NFS-e | `ConsultarUrlNfse` | Síncrono |

### Estrutura XML - DPS (Declaração de Prestação de Serviços)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseEnvio xmlns="http://www.sped.fazenda.gov.br/nfse">
  <Dps versao="1.01">
    <infDPS Id="DPS{COD_MUN}{TIPO_INSCRICAO}{INSCRICAO_FEDERAL}{SERIE}{NUMERO}">
      <tpAmb>2</tpAmb> <!-- 1=Produção, 2=Homologação -->
      <dhEmi>{DATA_HORA_UTC}</dhEmi>
      <verAplic>{VERSAO_APLICATIVO}</verAplic>
      <serie>{SERIE}</serie>
      <nDPS>{NUMERO_DPS}</nDPS>
      <dCompet>{DATA_COMPETENCIA}</dCompet>
      <tpEmit>1</tpEmit> <!-- 1=Prestador, 2=Tomador, 3=Intermediário -->
      <cLocEmi>{COD_MUNICIPIO_IBGE}</cLocEmi>
      
      <prest>
        <CNPJ>{CNPJ_PRESTADOR}</CNPJ>
        <IM>{IM_PRESTADOR}</IM>
        <xNome>{RAZAO_SOCIAL}</xNome>
        <regTrib>
          <opSimpNac>{OPCAO_SIMPLES}</opSimpNac>
          <regEspTrib>{REGIME_ESPECIAL}</regEspTrib>
        </regTrib>
      </prest>
      
      <toma>
        <CNPJ>{CNPJ_TOMADOR}</CNPJ>
        <xNome>{NOME_TOMADOR}</xNome>
        <End>
          <endNac>
            <cMun>{COD_MUNICIPIO}</cMun>
            <CEP>{CEP}</CEP>
          </endNac>
          <xLgr>{LOGRADOURO}</xLgr>
          <nro>{NUMERO}</nro>
          <xBairro>{BAIRRO}</xBairro>
        </End>
      </toma>
      
      <serv>
        <locPrest>
          <cLocPrestacao>{COD_MUN_PRESTACAO}</cLocPrestacao>
        </locPrest>
        <cServ>
          <cTribNac>{COD_TRIB_NACIONAL}</cTribNac>
          <cTribMun>{COD_TRIB_MUNICIPAL}</cTribMun>
          <xDescServ>{DESCRICAO_SERVICO}</xDescServ>
          <cNBS>{COD_NBS}</cNBS>
        </cServ>
      </serv>
      
      <valores>
        <vServPrest>
          <vServ>{VALOR_SERVICO}</vServ>
        </vServPrest>
        <trib>
          <tribMun>
            <tribISSQN>{TIPO_TRIBUTACAO}</tribISSQN>
            <tpRetISSQN>{TIPO_RETENCAO}</tpRetISSQN>
            <pAliq>{ALIQUOTA}</pAliq>
          </tribMun>
          <totTrib>
            <vTotTribFed>{VALOR_TRIB_FEDERAL}</vTotTribFed>
            <vTotTribEst>{VALOR_TRIB_ESTADUAL}</vTotTribEst>
            <vTotTribMun>{VALOR_TRIB_MUNICIPAL}</vTotTribMun>
          </totTrib>
        </trib>
      </valores>
      
    </infDPS>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <!-- Assinatura Digital -->
    </Signature>
  </Dps>
</GerarNfseEnvio>
```

### Formação do ID da DPS

```
DPS + Cód.Mun (7) + Tipo Inscrição (1) + Inscrição Federal (14) + Série (5) + Número (15)

Exemplo:
DPS5208707100012345678900100001000000000001
    |      ||              |    |              |
    |      ||              |    |              +-- Número DPS (15 dígitos)
    |      ||              |    +----------------- Série (5 dígitos)
    |      ||              +---------------------- CNPJ (14 dígitos)
    |      |+------------------------------------- Tipo Inscrição (1=CNPJ, 2=CPF)
    |      +-------------------------------------- Código Município IBGE (7 dígitos)
    +--------------------------------------------- Literal "DPS"
```

---

## 🗂️ TABELAS DE CÓDIGOS

### Códigos de Tributação Nacional
Download: https://www.notacontrol.com.br/download/nfse/TributacaoNacional.xlsx

### Códigos NBS (Nomenclatura Brasileira de Serviços)
Download: https://www.notacontrol.com.br/download/nfse/NBSv2.xlsx

### Tabela de Municípios (Goiânia)
Download: http://www2.goiania.go.gov.br/sistemas/sress/Docs/Municipio.zip

> ⚠️ A tabela de municípios de Goiânia possui diferenças em relação à tabela do IBGE.

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Pré-requisitos
- [ ] Certificado Digital A1 (e-CNPJ) válido
- [ ] CNPJ do certificado = CNPJ do prestador
- [ ] Inscrição Municipal ativa
- [ ] Código de Atividade Econômica cadastrado na prefeitura

### Configuração Inicial
- [ ] Solicitar liberação do webservice: `suporte.nfse@goiania.go.gov.br`
- [ ] Informar: Razão Social, CNPJ, Inscrição Municipal
- [ ] Aguardar confirmação (prazo médio: 1 dia útil)

### Desenvolvimento
- [ ] Configurar certificado digital
- [ ] Implementar cliente SOAP
- [ ] Implementar assinatura XML
- [ ] Validar XML contra XSD
- [ ] Testar em modo TESTE (série="TESTE")

### Produção
- [ ] Concluir testes com nota fictícia (número 370)
- [ ] Solicitar mudança para modo PRODUÇÃO
- [ ] Validar primeira emissão real

---

## 🐛 CÓDIGOS DE ERRO COMUNS

| Código | Descrição | Solução |
|--------|-----------|---------|
| `GW129` | Empresa não habilitada para produção | Solicitar liberação via e-mail |
| `L002` | CNPJ da assinatura não confere | Usar certificado com mesmo CNPJ |
| `L003` | Código tributação não pertence ao contribuinte | Verificar cadastro na prefeitura |
| `L016` | Certificado cliente não encontrado | Verificar configuração do certificado |
| `L999` | Cadastro inexistente | Verificar inscrição municipal |

---

## 📚 RECURSOS ADICIONAIS

### Downloads Importantes
- **Schema XSD Goiânia**: https://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd
- **Schema XSD Nacional**: https://www.notacontrol.com.br/download/nfse/schema_v101.xsd
- **XMLs de Exemplo**: https://www.notacontrol.com.br/download/nfse/xml/

### Documentação Oficial
- **Manual ABRASF**: http://www.abrasf.org.br (Temas Técnicos > NFS-e)
- **Portal NFS-e Nacional**: https://www.gov.br/nfse/pt-br
- **Nota Control**: https://www.notacontrol.com.br

### Contatos
- **Suporte Técnico Goiânia**: suporte.nfse@goiania.go.gov.br
- **Informações Tributárias**: GIOF - (62) 3524-4040

---

## 💻 EXEMPLO COMPLETO DE IMPLEMENTAÇÃO

### package.json

```json
{
  "name": "nfse-goiania",
  "version": "1.0.0",
  "description": "Integração NFS-e Prefeitura de Goiânia",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "soap": "^1.0.0",
    "xml-crypto": "^3.0.0",
    "node-forge": "^1.3.1",
    "xml2js": "^0.6.0",
    "dotenv": "^16.0.0",
    "libxmljs2": "^0.33.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/node-forge": "^1.3.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0"
  }
}
```

### .env

```env
# Certificado Digital
CERT_PATH=./certificates/certificado.pfx
CERT_PASSWORD=sua_senha_aqui

# Configurações da Empresa
CNPJ_PRESTADOR=00000000000000
IM_PRESTADOR=000000000
RAZAO_SOCIAL=AMPLA CONTABILIDADE LTDA

# Ambiente (TESTE ou PRODUCAO)
AMBIENTE=TESTE

# WebService
WSDL_URL=https://nfse.goiania.go.gov.br/ws/nfse.asmx?wsdl
```

### index.ts (Exemplo de Uso)

```typescript
import { NfseClient } from './services/nfse-client';
import { XmlBuilder } from './services/xml-builder';
import { XmlSigner } from './services/xml-signer';
import { CertificateManager } from './config/certificate';
import * as dotenv from 'dotenv';

dotenv.config();

async function emitirNfse() {
  // 1. Carregar certificado
  const certManager = new CertificateManager({
    pfxPath: process.env.CERT_PATH!,
    password: process.env.CERT_PASSWORD!
  });
  
  // 2. Construir XML do RPS
  const xmlBuilder = new XmlBuilder();
  const xmlRps = xmlBuilder.buildRps({
    numero: 1,
    serie: process.env.AMBIENTE === 'TESTE' ? 'TESTE' : '1',
    dataEmissao: new Date(),
    naturezaOperacao: 1,
    optanteSimplesNacional: false,
    incentivadorCultural: false,
    servico: {
      valorServicos: 1000.00,
      itemListaServico: '17.19',
      codigoTributacaoMunicipio: '691230100',
      discriminacao: 'Serviços contábeis',
      codigoMunicipio: '5208707'
    },
    prestador: {
      cnpj: process.env.CNPJ_PRESTADOR!,
      inscricaoMunicipal: process.env.IM_PRESTADOR!
    },
    tomador: {
      cnpj: '11111111111111',
      razaoSocial: 'EMPRESA TOMADORA LTDA',
      endereco: {
        logradouro: 'Rua Exemplo',
        numero: '123',
        bairro: 'Centro',
        codigoMunicipio: '5208707',
        uf: 'GO',
        cep: '74000000'
      }
    }
  });
  
  // 3. Assinar XML
  const signer = new XmlSigner(
    certManager.getPrivateKeyPem(),
    certManager.getCertificatePem()
  );
  const xmlAssinado = signer.signXml(xmlRps, `rps_${process.env.CNPJ_PRESTADOR}_TESTE_1`);
  
  // 4. Enviar para o WebService
  const client = new NfseClient({
    wsdlUrl: process.env.WSDL_URL!,
    pfxPath: process.env.CERT_PATH!,
    pfxPassword: process.env.CERT_PASSWORD!
  });
  
  await client.connect();
  const resposta = await client.gerarNfse(xmlAssinado);
  
  console.log('Resposta:', resposta);
}

emitirNfse().catch(console.error);
```

---

## 📌 INSTRUÇÕES PARA CLAUDE NO VSCODE

Ao desenvolver a integração NFS-e para Goiânia:

1. **Sempre verificar** qual modelo está sendo usado (Legado ou Nacional)
2. **Validar o XML** contra o XSD antes de enviar
3. **Usar modo TESTE** antes de ir para produção
4. **Manter logs detalhados** das requisições e respostas
5. **Tratar todos os códigos de erro** retornados
6. **Nunca armazenar** senhas do certificado em código-fonte
7. **Implementar retry** para falhas de conexão temporárias

---

*Documento gerado em: Dezembro/2025*
*Versão do Manual Base: 1.01*
