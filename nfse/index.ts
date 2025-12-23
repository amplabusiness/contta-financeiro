/**
 * NFS-e Goiânia - Integração WebService
 * 
 * Exemplo de uso para emissão de Nota Fiscal de Serviços Eletrônica
 * 
 * @author AMPLA Contabilidade Ltda
 * @version 1.0.0
 */

import * as dotenv from 'dotenv';
import { CertificateManager } from './config/certificate';
import { ENDPOINTS, MUNICIPIO } from './config/endpoints';
import { XmlBuilder } from './services/xml-builder';
import { XmlSigner } from './services/xml-signer';
import { NfseClient, createNfseClientGoiania } from './services/nfse-client';
import {
  Rps,
  NaturezaOperacao,
  StatusRps,
  TipoRps,
  RegimeEspecialTributacao
} from './models/nfse';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Exemplo de emissão de NFS-e
 */
async function emitirNfseExemplo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('NFS-e Goiânia - Exemplo de Emissão');
  console.log('='.repeat(60));

  // 1. Carregar e validar certificado
  console.log('\n[1] Carregando certificado digital...');
  
  const certManager = new CertificateManager({
    pfxPath: process.env.CERT_PATH || './certificates/certificado.pfx',
    password: process.env.CERT_PASSWORD || ''
  });

  const certInfo = certManager.getInfo();
  console.log(`    Razão Social: ${certInfo.razaoSocial}`);
  console.log(`    CNPJ: ${certInfo.cnpj}`);
  console.log(`    Válido até: ${certInfo.validadeFim.toLocaleDateString('pt-BR')}`);
  console.log(`    Dias restantes: ${certManager.getDaysRemaining()}`);

  if (!certManager.isValid()) {
    throw new Error('Certificado digital expirado!');
  }

  // Validar CNPJ
  const cnpjPrestador = process.env.CNPJ_PRESTADOR || '';
  if (!certManager.validateCNPJ(cnpjPrestador)) {
    throw new Error(`CNPJ do certificado (${certInfo.cnpj}) diferente do prestador (${cnpjPrestador})`);
  }

  // 2. Construir dados do RPS
  console.log('\n[2] Construindo RPS...');
  
  const ambiente = process.env.AMBIENTE || 'TESTE';
  const serie = ambiente === 'TESTE' ? 'TESTE' : '1';
  
  const rps: Rps = {
    identificacaoRps: {
      numero: 1, // Sequencial
      serie: serie,
      tipo: TipoRps.RPS
    },
    dataEmissao: new Date(),
    naturezaOperacao: NaturezaOperacao.TRIBUTACAO_MUNICIPIO,
    regimeEspecialTributacao: RegimeEspecialTributacao.NENHUM,
    optanteSimplesNacional: false, // Ajustar conforme empresa
    incentivadorCultural: false,
    status: StatusRps.NORMAL,
    servico: {
      valores: {
        valorServicos: 1000.00,
        issRetido: false,
        aliquota: 5.00 // 5% - ajustar conforme atividade
      },
      itemListaServico: '17.19', // Contabilidade
      codigoTributacaoMunicipio: '691230100', // Consultar na prefeitura
      discriminacao: 'Serviços contábeis - competência DEZ/2025',
      codigoMunicipio: MUNICIPIO.CODIGO_IBGE
    },
    prestador: {
      cnpj: cnpjPrestador,
      inscricaoMunicipal: process.env.IM_PRESTADOR || ''
    },
    tomador: {
      identificacaoTomador: {
        cpfCnpj: '11111111111111' // CNPJ do tomador
      },
      razaoSocial: 'EMPRESA TOMADORA EXEMPLO LTDA',
      endereco: {
        endereco: 'Rua Exemplo',
        numero: '100',
        complemento: 'Sala 1',
        bairro: 'Centro',
        codigoMunicipio: MUNICIPIO.CODIGO_IBGE,
        uf: MUNICIPIO.UF,
        cep: '74000000'
      },
      contato: {
        email: 'contato@empresa.com.br',
        telefone: '6232001234'
      }
    }
  };

  console.log(`    Série: ${rps.identificacaoRps.serie}`);
  console.log(`    Número: ${rps.identificacaoRps.numero}`);
  console.log(`    Valor: R$ ${rps.servico.valores.valorServicos.toFixed(2)}`);

  // 3. Gerar XML
  console.log('\n[3] Gerando XML...');
  
  const xmlBuilder = new XmlBuilder('LEGADO');
  const xmlEnvio = xmlBuilder.buildGerarNfseEnvio(rps);
  
  console.log(`    Tamanho do XML: ${xmlEnvio.length} bytes`);

  // 4. Assinar XML
  console.log('\n[4] Assinando XML digitalmente...');
  
  const signer = new XmlSigner({
    privateKey: certManager.getPrivateKeyPem(),
    certificate: certManager.getCertificatePem()
  });

  const referenceId = `rps_${cnpjPrestador.replace(/\D/g, '')}_${serie}_${rps.identificacaoRps.numero}`;
  const xmlAssinado = signer.signXml(xmlEnvio, referenceId);
  
  console.log(`    XML assinado com sucesso`);
  console.log(`    Tamanho após assinatura: ${xmlAssinado.length} bytes`);

  // 5. Enviar para o WebService
  console.log('\n[5] Enviando para o WebService...');
  console.log(`    Endpoint: ${ENDPOINTS.GOIANIA_LEGADO.PRODUCAO.WEBSERVICE}`);
  console.log(`    Ambiente: ${ambiente}`);

  const client = createNfseClientGoiania(
    process.env.CERT_PATH || '',
    process.env.CERT_PASSWORD || ''
  );

  await client.connect();
  console.log('    Conectado ao WebService');

  const resposta = await client.gerarNfse(xmlAssinado);
  
  client.disconnect();

  // 6. Processar resposta
  console.log('\n[6] Processando resposta...');
  
  if (resposta.sucesso) {
    console.log('    ✅ NFS-e gerada com sucesso!');
    console.log(`    Número: ${resposta.nfse?.numero}`);
    console.log(`    Código Verificação: ${resposta.nfse?.codigoVerificacao}`);
    console.log(`    Data Emissão: ${resposta.nfse?.dataEmissao?.toLocaleDateString('pt-BR')}`);
    
    if (ambiente === 'TESTE') {
      console.log('\n    ⚠️  NOTA EMITIDA EM MODO TESTE');
      console.log('    A nota não tem validade fiscal.');
      console.log('    Solicite a mudança para PRODUÇÃO via email para:');
      console.log(`    ${ENDPOINTS.GOIANIA_LEGADO.PRODUCAO.WEBSERVICE.replace('/ws/nfse.asmx', '')}`);
    }
  } else {
    console.log('    ❌ Erro ao gerar NFS-e');
    for (const msg of resposta.mensagens) {
      console.log(`    [${msg.codigo}] ${msg.mensagem}`);
      if (msg.correcao) {
        console.log(`    Correção: ${msg.correcao}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Exemplo de consulta de NFS-e por RPS
 */
async function consultarNfsePorRpsExemplo(): Promise<void> {
  console.log('='.repeat(60));
  console.log('NFS-e Goiânia - Exemplo de Consulta por RPS');
  console.log('='.repeat(60));

  const certManager = new CertificateManager({
    pfxPath: process.env.CERT_PATH || './certificates/certificado.pfx',
    password: process.env.CERT_PASSWORD || ''
  });

  const xmlBuilder = new XmlBuilder('LEGADO');
  const xmlConsulta = xmlBuilder.buildConsultarNfsePorRpsEnvio(
    1, // Número do RPS
    'TESTE', // Série
    TipoRps.RPS,
    process.env.CNPJ_PRESTADOR || '',
    process.env.IM_PRESTADOR || ''
  );

  const signer = new XmlSigner({
    privateKey: certManager.getPrivateKeyPem(),
    certificate: certManager.getCertificatePem()
  });

  // Consulta não precisa de assinatura no modelo Goiânia
  const client = createNfseClientGoiania(
    process.env.CERT_PATH || '',
    process.env.CERT_PASSWORD || ''
  );

  await client.connect();
  const resposta = await client.consultarNfsePorRps(xmlConsulta);
  client.disconnect();

  if (resposta.sucesso) {
    console.log('NFS-e encontrada:');
    console.log(`  Número: ${resposta.nfse?.numero}`);
    console.log(`  Código: ${resposta.nfse?.codigoVerificacao}`);
  } else {
    console.log('Erro na consulta:');
    resposta.mensagens.forEach(m => console.log(`  [${m.codigo}] ${m.mensagem}`));
  }
}

// Exportar funções e classes
export {
  CertificateManager,
  XmlBuilder,
  XmlSigner,
  NfseClient,
  createNfseClientGoiania,
  emitirNfseExemplo,
  consultarNfsePorRpsExemplo
};

// Exportar modelos
export * from './models/nfse';

// Exportar configurações
export { ENDPOINTS, MUNICIPIO } from './config/endpoints';

// Executar exemplo se for o arquivo principal
if (require.main === module) {
  emitirNfseExemplo()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Erro:', error.message);
      process.exit(1);
    });
}
