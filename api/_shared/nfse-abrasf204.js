import https from 'https';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

const ABRASF_XML_NAMESPACE = 'http://www.abrasf.org.br/nfse.xsd';

export function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function extractProtocol(responseXml) {
  const match = String(responseXml).match(/<Protocolo>([^<]+)<\/Protocolo>/i);
  return match ? match[1] : null;
}

export function extractNFSeData(responseXml) {
  const numeroMatch = String(responseXml).match(/<Numero>([^<]+)<\/Numero>/i);
  const codigoMatch = String(responseXml).match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/i);
  const dataMatch = String(responseXml).match(/<DataEmissao>([^<]+)<\/DataEmissao>/i);

  if (!numeroMatch) return null;
  return {
    numero_nfse: numeroMatch[1],
    codigo_verificacao: codigoMatch ? codigoMatch[1] : '',
    data_emissao: dataMatch ? dataMatch[1] : undefined,
  };
}

export function extractNFSeXml(responseXml) {
  const match = String(responseXml).match(/<CompNfse>([\s\S]*?)<\/CompNfse>/i);
  return match ? match[0] : null;
}

export function extractErrors(responseXml) {
  const errors = [];
  const errorRegex = /<MensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>[\s\S]*?<\/MensagemRetorno>/gi;
  let match;
  while ((match = errorRegex.exec(String(responseXml))) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] });
  }

  const listaRegex = /<ListaMensagemRetorno>[\s\S]*?<Codigo>([^<]+)<\/Codigo>[\s\S]*?<Mensagem>([^<]+)<\/Mensagem>/gi;
  while ((match = listaRegex.exec(String(responseXml))) !== null) {
    errors.push({ codigo: match[1], mensagem: match[2] });
  }

  return errors;
}

export function wrapSoapEnvelope(xmlPayload, operation, soapNamespace) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:nfse="${soapNamespace}">
  <soap:Body>
    <nfse:${operation}>
      <nfse:xmlEnvio><![CDATA[${xmlPayload}]]></nfse:xmlEnvio>
    </nfse:${operation}>
  </soap:Body>
</soap:Envelope>`;
}

export function loadCertificateFromEnv() {
  const pfxB64 = process.env.NFSE_CERT_PFX_B64;
  const password = process.env.NFSE_CERT_PASSWORD;

  if (!pfxB64) {
    throw new Error('NFSE_CERT_PFX_B64 não configurado (base64 do .pfx)');
  }
  if (!password) {
    throw new Error('NFSE_CERT_PASSWORD não configurado');
  }

  const pfxBuffer = Buffer.from(pfxB64, 'base64');

  const pfxAsn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  if (!keyBag || keyBag.length === 0) {
    throw new Error('Chave privada não encontrada no certificado (PFX)');
  }
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag[0].key);

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  if (!certBag || certBag.length === 0) {
    throw new Error('Certificado não encontrado no PFX');
  }

  const cert = certBag[0].cert;
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certBase64 = forge.util.encode64(certDer);

  return { pfxBuffer, password, privateKeyPem, certBase64 };
}

class X509KeyInfoProvider {
  constructor(certificateBase64) {
    this.certificate = certificateBase64;
  }

  getKeyInfo() {
    return `<X509Data><X509Certificate>${this.certificate}</X509Certificate></X509Data>`;
  }

  getKey() {
    return this.certificate;
  }
}

export function signXml(xml, referenceId, privateKeyPem, certificateBase64, insertAfter = false) {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificateBase64,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  });

  sig.addReference({
    xpath: `//*[@Id='${referenceId}']`,
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    ],
  });

  sig.keyInfoProvider = new X509KeyInfoProvider(certificateBase64);

  sig.computeSignature(xml, {
    location: {
      reference: `//*[@Id='${referenceId}']`,
      action: insertAfter ? 'after' : 'append',
    },
  });

  return sig.getSignedXml();
}

export function buildLoteRpsXmlFromDb(nfse, config, ambiente) {
  const rpsId = `RPS${nfse.numero_rps}`;
  const loteId = `L${nfse.numero_rps}`;

  const dataEmissao = nfse.data_emissao || new Date().toISOString().split('T')[0];
  const competencia = nfse.competencia || `${dataEmissao.substring(0, 7)}-01`;

  const isHomologacao = ambiente === 'homologacao';

  const codigoMunicipioServico = isHomologacao ? '5002704' : (nfse.codigo_municipio || '5208707');
  const municipioIncidencia = isHomologacao ? '5002704' : (nfse.municipio_incidencia || nfse.codigo_municipio || '5208707');
  const serieRps = isHomologacao ? '8' : (nfse.serie_rps || config.serie_rps_padrao || 'A');

  const tomadorDoc = String(nfse.tomador_cnpj || nfse.tomador_cpf || '').replace(/\D/g, '');
  const isCpf = tomadorDoc.length === 11;
  const tomadorTag = isCpf ? `<Cpf>${tomadorDoc}</Cpf>` : `<Cnpj>${tomadorDoc}</Cnpj>`;

  const codigoMunicipioTomador = isHomologacao ? '5002704' : (nfse.tomador_codigo_municipio || '5208707');
  const uf = isHomologacao ? 'MS' : (nfse.tomador_uf || 'GO');
  const cep = String(nfse.tomador_cep || (isHomologacao ? '79000000' : '74000000')).replace(/\D/g, '');

  let discriminacao = nfse.discriminacao || config.descricao_servico_padrao || 'Serviços contábeis mensais conforme contrato';
  discriminacao = String(discriminacao).substring(0, 2000);

  // Manter formato XX.XX conforme XSD ABRASF 2.04 (tsItemListaServico)
  let itemListaServico = String(nfse.item_lista_servico || config.item_lista_servico_padrao || '17.18');
  // Garantir formato com ponto se vier sem (ex: "1718" -> "17.18")
  if (!itemListaServico.includes('.') && itemListaServico.length >= 3) {
    itemListaServico = itemListaServico.slice(0, -2) + '.' + itemListaServico.slice(-2);
  }
  const codigoCnae = String(nfse.codigo_cnae || config.codigo_cnae_padrao || '6920602');

  const valorServicos = Number(nfse.valor_servicos || 0);
  const valorDeducoes = Number(nfse.valor_deducoes || 0);
  const valorPis = Number(nfse.valor_pis || 0);
  const valorCofins = Number(nfse.valor_cofins || 0);
  const valorInss = Number(nfse.valor_inss || 0);
  const valorIr = Number(nfse.valor_ir || 0);
  const valorCsll = Number(nfse.valor_csll || 0);
  const outrasRetencoes = Number(nfse.outras_retencoes || 0);
  const valorIss = Number(nfse.valor_iss || 0);
  const aliquota = Number(nfse.aliquota || config.aliquota_padrao || 0);

  const issRetido = nfse.iss_retido ? '1' : '2';
  const exigibilidadeIss = Number(nfse.exigibilidade_iss || 1);

  const regimeEspecial = Number(config.regime_especial_tributacao || 3);
  const optanteSN = config.optante_simples_nacional ? '1' : '2';
  const incentivoFiscal = config.incentivo_fiscal ? '1' : '2';

  const enderecoTomadorXml = nfse.tomador_endereco ? `
            <Endereco>
              <Endereco>${escapeXml(nfse.tomador_endereco)}</Endereco>
              ${nfse.tomador_numero ? `<Numero>${escapeXml(nfse.tomador_numero)}</Numero>` : '<Numero>S/N</Numero>'}
              ${nfse.tomador_complemento ? `<Complemento>${escapeXml(nfse.tomador_complemento)}</Complemento>` : ''}
              ${nfse.tomador_bairro ? `<Bairro>${escapeXml(nfse.tomador_bairro)}</Bairro>` : '<Bairro>Centro</Bairro>'}
              <CodigoMunicipio>${codigoMunicipioTomador}</CodigoMunicipio>
              <Uf>${uf}</Uf>
              <Cep>${cep}</Cep>
            </Endereco>` : '';

  const contatoTomadorXml = (nfse.tomador_telefone || nfse.tomador_email) ? `
            <Contato>
              ${nfse.tomador_telefone ? `<Telefone>${String(nfse.tomador_telefone).replace(/\D/g, '')}</Telefone>` : ''}
              ${nfse.tomador_email ? `<Email>${escapeXml(nfse.tomador_email)}</Email>` : ''}
            </Contato>` : '';

  return {
    loteId,
    rpsId,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="${ABRASF_XML_NAMESPACE}">
  <LoteRps Id="${loteId}" versao="2.04">
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
              <Serie>${serieRps}</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${dataEmissao}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${competencia}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${valorServicos.toFixed(2)}</ValorServicos>
              ${valorDeducoes > 0 ? `<ValorDeducoes>${valorDeducoes.toFixed(2)}</ValorDeducoes>` : ''}
              ${valorPis > 0 ? `<ValorPis>${valorPis.toFixed(2)}</ValorPis>` : ''}
              ${valorCofins > 0 ? `<ValorCofins>${valorCofins.toFixed(2)}</ValorCofins>` : ''}
              ${valorInss > 0 ? `<ValorInss>${valorInss.toFixed(2)}</ValorInss>` : ''}
              ${valorIr > 0 ? `<ValorIr>${valorIr.toFixed(2)}</ValorIr>` : ''}
              ${valorCsll > 0 ? `<ValorCsll>${valorCsll.toFixed(2)}</ValorCsll>` : ''}
              ${outrasRetencoes > 0 ? `<OutrasRetencoes>${outrasRetencoes.toFixed(2)}</OutrasRetencoes>` : ''}
              ${valorIss > 0 ? `<ValorIss>${valorIss.toFixed(2)}</ValorIss>` : ''}
              ${aliquota > 0 ? `<Aliquota>${aliquota.toFixed(4)}</Aliquota>` : ''}
            </Valores>
            <IssRetido>${issRetido}</IssRetido>
            <ItemListaServico>${itemListaServico}</ItemListaServico>
            ${codigoCnae ? `<CodigoCnae>${codigoCnae}</CodigoCnae>` : ''}
            ${nfse.codigo_tributacao_municipio ? `<CodigoTributacaoMunicipio>${escapeXml(nfse.codigo_tributacao_municipio)}</CodigoTributacaoMunicipio>` : ''}
            <Discriminacao>${escapeXml(discriminacao)}</Discriminacao>
            <CodigoMunicipio>${codigoMunicipioServico}</CodigoMunicipio>
            <ExigibilidadeISS>${exigibilidadeIss}</ExigibilidadeISS>
            <MunicipioIncidencia>${municipioIncidencia}</MunicipioIncidencia>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${nfse.prestador_cnpj}</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>${nfse.prestador_inscricao_municipal}</InscricaoMunicipal>
          </Prestador>
          <TomadorServico>
            <IdentificacaoTomador>
              <CpfCnpj>
                ${tomadorTag}
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(nfse.tomador_razao_social)}</RazaoSocial>${enderecoTomadorXml}${contatoTomadorXml}
          </TomadorServico>
          <RegimeEspecialTributacao>${regimeEspecial}</RegimeEspecialTributacao>
          <OptanteSimplesNacional>${optanteSN}</OptanteSimplesNacional>
          <IncentivoFiscal>${incentivoFiscal}</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`,
  };
}

/**
 * Envia requisição SOAP com retry automático para falhas de conexão
 * @param {Object} options - Opções da requisição
 * @param {number} maxRetries - Número máximo de tentativas (padrão: 3)
 * @param {number} baseDelay - Delay base em ms para backoff exponencial (padrão: 1000)
 */
export async function sendSoapRequest({ url, operation, soapActionBase, soapNamespace, xmlPayload, pfxBuffer, passphrase }, maxRetries = 3, baseDelay = 1000) {
  const soapEnvelope = wrapSoapEnvelope(xmlPayload, operation, soapNamespace);

  const urlObj = new URL(url);

  const headers = {
    'Content-Type': 'text/xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
    'SOAPAction': `${soapActionBase}/${operation}`,
  };

  const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'POST',
    pfx: pfxBuffer,
    passphrase,
    headers,
    rejectUnauthorized: true,
    timeout: 60000, // 60 segundos de timeout
  };

  // Erros que justificam retry (falhas de rede temporárias)
  const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EHOSTUNREACH'];

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('ETIMEDOUT'));
        });

        req.on('error', reject);
        req.write(soapEnvelope);
        req.end();
      });

      return { ...response, soapEnvelope, attempts: attempt };

    } catch (error) {
      lastError = error;
      const errorCode = error.code || error.message;

      // Verificar se é erro que justifica retry
      const shouldRetry = retryableErrors.some(code => errorCode.includes(code));

      if (shouldRetry && attempt < maxRetries) {
        // Backoff exponencial: 1s, 2s, 4s...
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⚠️ Tentativa ${attempt}/${maxRetries} falhou (${errorCode}). Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise(r => setTimeout(r, delay));
      } else if (!shouldRetry) {
        // Erro não recuperável, lançar imediatamente
        throw error;
      }
    }
  }

  // Todas as tentativas falharam
  throw new Error(`Falha após ${maxRetries} tentativas: ${lastError?.message || 'Erro desconhecido'}`);
}

// ============================================================================
// BUILDERS XML PARA TODOS OS SERVIÇOS ABRASF 2.04
// ============================================================================

/**
 * Constrói XML para ConsultarLoteRps
 */
export function buildConsultarLoteRpsXml(protocolo, prestadorCnpj, inscricaoMunicipal) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarLoteRpsEnvio xmlns="${ABRASF_XML_NAMESPACE}">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${prestadorCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Prestador>
  <Protocolo>${protocolo}</Protocolo>
</ConsultarLoteRpsEnvio>`;
}

/**
 * Constrói XML para ConsultarNfsePorRps
 */
export function buildConsultarNfsePorRpsXml(numeroRps, serieRps, tipoRps, prestadorCnpj, inscricaoMunicipal) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseRpsEnvio xmlns="${ABRASF_XML_NAMESPACE}">
  <IdentificacaoRps>
    <Numero>${numeroRps}</Numero>
    <Serie>${serieRps}</Serie>
    <Tipo>${tipoRps || 1}</Tipo>
  </IdentificacaoRps>
  <Prestador>
    <CpfCnpj>
      <Cnpj>${prestadorCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Prestador>
</ConsultarNfseRpsEnvio>`;
}

/**
 * Constrói XML para ConsultarNfseServicoPrestado (notas emitidas)
 */
export function buildConsultarNfseServicoPrestadoXml(prestadorCnpj, inscricaoMunicipal, options = {}) {
  const { dataInicial, dataFinal, tomadorCnpj, tomadorCpf, numeroNfse, pagina = 1 } = options;

  let periodoXml = '';
  if (dataInicial && dataFinal) {
    periodoXml = `
  <PeriodoEmissao>
    <DataInicial>${dataInicial}</DataInicial>
    <DataFinal>${dataFinal}</DataFinal>
  </PeriodoEmissao>`;
  }

  let tomadorXml = '';
  if (tomadorCnpj || tomadorCpf) {
    const docTag = tomadorCnpj ? `<Cnpj>${tomadorCnpj}</Cnpj>` : `<Cpf>${tomadorCpf}</Cpf>`;
    tomadorXml = `
  <Tomador>
    <CpfCnpj>
      ${docTag}
    </CpfCnpj>
  </Tomador>`;
  }

  let numeroXml = numeroNfse ? `<NumeroNfse>${numeroNfse}</NumeroNfse>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseServicoPrestadoEnvio xmlns="${ABRASF_XML_NAMESPACE}">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${prestadorCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Prestador>${numeroXml}${periodoXml}${tomadorXml}
  <Pagina>${pagina}</Pagina>
</ConsultarNfseServicoPrestadoEnvio>`;
}

/**
 * Constrói XML para ConsultarNfseServicoTomado (notas recebidas - despesas)
 */
export function buildConsultarNfseServicoTomadoXml(tomadorCnpj, inscricaoMunicipal, options = {}) {
  const { dataInicial, dataFinal, prestadorCnpj, prestadorCpf, numeroNfse, pagina = 1 } = options;

  let periodoXml = '';
  if (dataInicial && dataFinal) {
    periodoXml = `
  <PeriodoEmissao>
    <DataInicial>${dataInicial}</DataInicial>
    <DataFinal>${dataFinal}</DataFinal>
  </PeriodoEmissao>`;
  }

  let prestadorXml = '';
  if (prestadorCnpj || prestadorCpf) {
    const docTag = prestadorCnpj ? `<Cnpj>${prestadorCnpj}</Cnpj>` : `<Cpf>${prestadorCpf}</Cpf>`;
    prestadorXml = `
  <Prestador>
    <CpfCnpj>
      ${docTag}
    </CpfCnpj>
  </Prestador>`;
  }

  let numeroXml = numeroNfse ? `<NumeroNfse>${numeroNfse}</NumeroNfse>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseServicoTomadoEnvio xmlns="${ABRASF_XML_NAMESPACE}">
  <Consulente>
    <CpfCnpj>
      <Cnpj>${tomadorCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Consulente>${numeroXml}${periodoXml}${prestadorXml}
  <Pagina>${pagina}</Pagina>
</ConsultarNfseServicoTomadoEnvio>`;
}

/**
 * Constrói XML para ConsultarNfseFaixa
 */
export function buildConsultarNfseFaixaXml(prestadorCnpj, inscricaoMunicipal, numeroInicial, numeroFinal, pagina = 1) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseFaixaEnvio xmlns="${ABRASF_XML_NAMESPACE}">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${prestadorCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
  </Prestador>
  <Faixa>
    <NumeroNfseInicial>${numeroInicial}</NumeroNfseInicial>
    <NumeroNfseFinal>${numeroFinal}</NumeroNfseFinal>
  </Faixa>
  <Pagina>${pagina}</Pagina>
</ConsultarNfseFaixaEnvio>`;
}

/**
 * Constrói XML para CancelarNfse
 */
export function buildCancelarNfseXml(numeroNfse, prestadorCnpj, inscricaoMunicipal, codigoMunicipio, codigoCancelamento = '1') {
  const pedidoId = `C${numeroNfse}`;
  return {
    pedidoId,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<CancelarNfseEnvio xmlns="${ABRASF_XML_NAMESPACE}">
  <Pedido>
    <InfPedidoCancelamento Id="${pedidoId}">
      <IdentificacaoNfse>
        <Numero>${numeroNfse}</Numero>
        <CpfCnpj>
          <Cnpj>${prestadorCnpj}</Cnpj>
        </CpfCnpj>
        <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
        <CodigoMunicipio>${codigoMunicipio}</CodigoMunicipio>
      </IdentificacaoNfse>
      <CodigoCancelamento>${codigoCancelamento}</CodigoCancelamento>
    </InfPedidoCancelamento>
  </Pedido>
</CancelarNfseEnvio>`
  };
}

/**
 * Constrói XML para SubstituirNfse
 */
export function buildSubstituirNfseXml(numeroNfseSubstituida, prestadorCnpj, inscricaoMunicipal, codigoMunicipio, rpsXml) {
  const pedidoId = `S${numeroNfseSubstituida}`;
  return {
    pedidoId,
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<SubstituirNfseEnvio xmlns="${ABRASF_XML_NAMESPACE}">
  <SubstituicaoNfse Id="${pedidoId}">
    <Pedido>
      <InfPedidoCancelamento>
        <IdentificacaoNfse>
          <Numero>${numeroNfseSubstituida}</Numero>
          <CpfCnpj>
            <Cnpj>${prestadorCnpj}</Cnpj>
          </CpfCnpj>
          <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
          <CodigoMunicipio>${codigoMunicipio}</CodigoMunicipio>
        </IdentificacaoNfse>
        <CodigoCancelamento>1</CodigoCancelamento>
      </InfPedidoCancelamento>
    </Pedido>
    ${rpsXml}
  </SubstituicaoNfse>
</SubstituirNfseEnvio>`
  };
}

// ============================================================================
// PARSERS DE RESPOSTA
// ============================================================================

/**
 * Extrai lista de NFS-e da resposta
 */
export function extractNFSeList(responseXml) {
  const nfseList = [];
  const compNfseRegex = /<CompNfse>([\s\S]*?)<\/CompNfse>/gi;
  let match;

  while ((match = compNfseRegex.exec(String(responseXml))) !== null) {
    const compNfse = match[1];

    const numero = extractTagValue(compNfse, 'Numero');
    const codigoVerificacao = extractTagValue(compNfse, 'CodigoVerificacao');
    const dataEmissao = extractTagValue(compNfse, 'DataEmissao');
    const competencia = extractTagValue(compNfse, 'Competencia');

    // Valores
    const valorServicos = parseFloat(extractTagValue(compNfse, 'ValorServicos') || '0');
    const valorDeducoes = parseFloat(extractTagValue(compNfse, 'ValorDeducoes') || '0');
    const valorPis = parseFloat(extractTagValue(compNfse, 'ValorPis') || '0');
    const valorCofins = parseFloat(extractTagValue(compNfse, 'ValorCofins') || '0');
    const valorInss = parseFloat(extractTagValue(compNfse, 'ValorInss') || '0');
    const valorIr = parseFloat(extractTagValue(compNfse, 'ValorIr') || '0');
    const valorCsll = parseFloat(extractTagValue(compNfse, 'ValorCsll') || '0');
    const valorIss = parseFloat(extractTagValue(compNfse, 'ValorIss') || '0');
    const aliquota = parseFloat(extractTagValue(compNfse, 'Aliquota') || '0');
    const valorLiquido = parseFloat(extractTagValue(compNfse, 'ValorLiquidoNfse') || '0');

    // Prestador
    const prestadorCnpj = extractTagValue(compNfse, 'IdentificacaoPrestador>.*?<CpfCnpj>.*?<Cnpj') ||
                          extractNestedTag(compNfse, 'Prestador', 'Cnpj');
    const prestadorIM = extractNestedTag(compNfse, 'Prestador', 'InscricaoMunicipal');
    const prestadorRazao = extractNestedTag(compNfse, 'PrestadorServico', 'RazaoSocial') ||
                           extractNestedTag(compNfse, 'Prestador', 'RazaoSocial');

    // Tomador
    const tomadorCnpj = extractNestedTag(compNfse, 'TomadorServico', 'Cnpj') ||
                        extractNestedTag(compNfse, 'Tomador', 'Cnpj');
    const tomadorCpf = extractNestedTag(compNfse, 'TomadorServico', 'Cpf') ||
                       extractNestedTag(compNfse, 'Tomador', 'Cpf');
    const tomadorRazao = extractNestedTag(compNfse, 'TomadorServico', 'RazaoSocial') ||
                         extractNestedTag(compNfse, 'Tomador', 'RazaoSocial');
    const tomadorEmail = extractNestedTag(compNfse, 'TomadorServico', 'Email') ||
                         extractNestedTag(compNfse, 'Tomador', 'Email');

    // Serviço
    const discriminacao = extractTagValue(compNfse, 'Discriminacao');
    const itemListaServico = extractTagValue(compNfse, 'ItemListaServico');
    const codigoCnae = extractTagValue(compNfse, 'CodigoCnae');
    const codigoMunicipio = extractTagValue(compNfse, 'CodigoMunicipio');

    // RPS origem
    const rpsNumero = extractNestedTag(compNfse, 'IdentificacaoRps', 'Numero');
    const rpsSerie = extractNestedTag(compNfse, 'IdentificacaoRps', 'Serie');

    nfseList.push({
      numero_nfse: numero,
      codigo_verificacao: codigoVerificacao,
      data_emissao: dataEmissao,
      competencia,
      valor_servicos: valorServicos,
      valor_deducoes: valorDeducoes,
      valor_pis: valorPis,
      valor_cofins: valorCofins,
      valor_inss: valorInss,
      valor_ir: valorIr,
      valor_csll: valorCsll,
      valor_iss: valorIss,
      aliquota,
      valor_liquido: valorLiquido,
      prestador_cnpj: prestadorCnpj,
      prestador_inscricao_municipal: prestadorIM,
      prestador_razao_social: prestadorRazao,
      tomador_cnpj: tomadorCnpj,
      tomador_cpf: tomadorCpf,
      tomador_razao_social: tomadorRazao,
      tomador_email: tomadorEmail,
      discriminacao,
      item_lista_servico: itemListaServico,
      codigo_cnae: codigoCnae,
      codigo_municipio: codigoMunicipio,
      numero_rps: rpsNumero,
      serie_rps: rpsSerie,
      xml_completo: match[0]
    });
  }

  return nfseList;
}

/**
 * Extrai informações de cancelamento
 */
export function extractCancelamentoInfo(responseXml) {
  const sucesso = responseXml.includes('<Cancelamento>') || responseXml.includes('cancelada');
  const dataCancelamento = extractTagValue(responseXml, 'DataHora') || extractTagValue(responseXml, 'DataHoraCancelamento');

  return {
    sucesso,
    data_cancelamento: dataCancelamento,
    errors: extractErrors(responseXml)
  };
}

/**
 * Extrai valor de uma tag XML simples
 */
function extractTagValue(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i');
  const match = String(xml).match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extrai tag aninhada dentro de um container
 */
function extractNestedTag(xml, container, tagName) {
  const containerRegex = new RegExp(`<${container}[^>]*>([\\s\\S]*?)</${container}>`, 'i');
  const containerMatch = String(xml).match(containerRegex);
  if (!containerMatch) return null;
  return extractTagValue(containerMatch[1], tagName);
}

/**
 * Extrai número da página e total de páginas
 */
export function extractPaginacao(responseXml) {
  const proxPagina = extractTagValue(responseXml, 'ProximaPagina');
  const totalPaginas = extractTagValue(responseXml, 'TotalPaginas');

  return {
    proxima_pagina: proxPagina ? parseInt(proxPagina) : null,
    total_paginas: totalPaginas ? parseInt(totalPaginas) : null
  };
}
