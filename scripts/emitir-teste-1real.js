#!/usr/bin/env node
/**
 * Emissão de NFS-e de TESTE - R$ 1,00 para PETSHOP
 * Para validar a integração com a prefeitura de Goiânia
 */

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { SignedXml } from 'xml-crypto';
import {
  escapeXml,
  extractErrors,
  extractProtocol,
  extractNFSeData,
  loadCertificateFromEnv,
  wrapSoapEnvelope,
} from '../api/_shared/nfse-abrasf204.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

class X509KeyInfoProvider {
  constructor(cert) {
    this.cert = cert;
  }
  getKeyInfo() {
    return `<X509Data><X509Certificate>${this.cert}</X509Certificate></X509Data>`;
  }
}

function signXml(xml, referenceId, privateKeyPem, certBase64) {
  const sig = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certBase64,
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

  sig.keyInfoProvider = new X509KeyInfoProvider(certBase64);

  sig.computeSignature(xml, {
    location: {
      reference: `//*[@Id='${referenceId}']`,
      action: 'after',
    },
  });

  return sig.getSignedXml();
}

async function emitirTeste() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   📝 EMISSÃO NFS-e TESTE - R$ 1,00 - PETSHOP');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Buscar configuração
    console.log('1️⃣  Buscando configuração...');
    const { data: configs } = await supabase.from('nfse_config').select('*');
    if (!configs?.length) throw new Error('Configuração NFS-e não encontrada');
    const config = configs[0];
    console.log('   ✅ Config encontrada');
    console.log(`   📍 Ambiente: ${config.ambiente}`);
    console.log(`   🏢 CNPJ: ${config.prestador_cnpj}`);

    // 2. Buscar a PETSHOP nos clientes
    console.log('\n2️⃣  Buscando PETSHOP...');
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%petshop%,razao_social.ilike.%petshop%,name.ilike.%pet%')
      .limit(5);

    let cliente;
    if (clients?.length) {
      cliente = clients[0];
      console.log(`   ✅ Encontrado: ${cliente.name || cliente.razao_social}`);
      console.log(`   📋 CNPJ/CPF: ${cliente.cnpj || cliente.cpf || 'Não informado'}`);
    } else {
      // Buscar qualquer cliente com CNPJ
      console.log('   ⚠️  Petshop não encontrada, buscando outro cliente...');
      const { data: anyClients } = await supabase
        .from('clients')
        .select('*')
        .not('cnpj', 'is', null)
        .limit(1);

      if (anyClients?.length) {
        cliente = anyClients[0];
        console.log(`   ✅ Usando: ${cliente.name || cliente.razao_social}`);
      } else {
        // Dados fictícios se não houver cliente
        cliente = {
          name: 'PETSHOP TESTE LTDA',
          cnpj: '11111111000111',
          email: 'petshop@teste.com',
          cep: '74000000',
          logradouro: 'Rua dos Animais',
          numero: '100',
          bairro: 'Centro',
          uf: 'GO',
        };
        console.log('   ⚠️  Usando dados fictícios');
      }
    }

    // 3. Carregar certificado
    console.log('\n3️⃣  Carregando certificado digital...');
    const cert = loadCertificateFromEnv();
    console.log('   ✅ Certificado carregado');

    // 4. Gerar número do RPS
    const { data: lastRps } = await supabase
      .from('nfse')
      .select('numero_rps')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const numeroRps = lastRps ? parseInt(lastRps.numero_rps) + 1 : 1;
    console.log(`\n4️⃣  Número RPS: ${numeroRps}`);

    // 5. Criar registro no banco
    console.log('\n5️⃣  Criando registro NFS-e...');
    const dataEmissao = new Date().toISOString().split('T')[0];
    const tomadorCnpj = String(cliente.cnpj || cliente.cpf || '').replace(/\D/g, '');

    const { data: nfse, error: insertError } = await supabase.from('nfse').insert({
      numero_rps: String(numeroRps),
      serie_rps: config.serie_rps_padrao || 'A',
      tipo_rps: 1,
      prestador_cnpj: config.prestador_cnpj,
      prestador_inscricao_municipal: config.prestador_inscricao_municipal || '6241034',
      prestador_razao_social: config.prestador_razao_social,
      tomador_razao_social: cliente.razao_social || cliente.name || 'TOMADOR TESTE',
      tomador_cnpj: tomadorCnpj.length === 14 ? tomadorCnpj : null,
      tomador_cpf: tomadorCnpj.length === 11 ? tomadorCnpj : null,
      tomador_email: cliente.email || 'teste@teste.com',
      tomador_cep: String(cliente.cep || '74000000').replace(/\D/g, ''),
      tomador_endereco: cliente.logradouro || 'Rua Teste',
      tomador_numero: cliente.numero || '100',
      tomador_bairro: cliente.bairro || 'Centro',
      tomador_uf: cliente.uf || 'GO',
      discriminacao: 'TESTE DE EMISSÃO VIA API - SERVIÇOS CONTÁBEIS - R$ 1,00',
      item_lista_servico: config.item_lista_servico_padrao || '17.18',
      codigo_cnae: config.codigo_cnae_padrao || '6920602',
      valor_servicos: 1.00,
      aliquota: config.aliquota_padrao || 0.05,
      valor_iss: 0.05,
      exigibilidade_iss: config.usar_iss_fixo ? 4 : 1,
      optante_simples_nacional: !!config.optante_simples_nacional,
      data_emissao: dataEmissao,
      competencia: dataEmissao,
      status: 'pending'
    }).select().single();

    if (insertError) throw new Error(`Erro ao inserir: ${insertError.message}`);
    console.log(`   ✅ NFS-e ID: ${nfse.id.substring(0, 8)}...`);

    // 6. Construir XML
    console.log('\n6️⃣  Construindo XML...');
    const rpsId = `RPS${numeroRps}`;
    const loteId = `L${numeroRps}`;

    const isHomologacao = config.ambiente !== 'producao';
    const serieRps = isHomologacao ? '8' : (config.serie_rps_padrao || 'A');
    const codigoMunicipio = isHomologacao ? '5002704' : '5208707';
    const uf = isHomologacao ? 'MS' : (cliente.uf || 'GO');
    const cep = isHomologacao ? '79000000' : String(cliente.cep || '74000000').replace(/\D/g, '');

    let itemListaServico = String(config.item_lista_servico_padrao || '17.18');
    if (!itemListaServico.includes('.') && itemListaServico.length >= 3) {
      itemListaServico = itemListaServico.slice(0, -2) + '.' + itemListaServico.slice(-2);
    }

    const tomadorTag = tomadorCnpj.length === 14
      ? `<Cnpj>${tomadorCnpj}</Cnpj>`
      : tomadorCnpj.length === 11
        ? `<Cpf>${tomadorCnpj}</Cpf>`
        : `<Cnpj>11111111000111</Cnpj>`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <LoteRps Id="${loteId}" versao="2.04">
    <NumeroLote>${numeroRps}</NumeroLote>
    <Prestador>
      <CpfCnpj>
        <Cnpj>${config.prestador_cnpj}</Cnpj>
      </CpfCnpj>
      <InscricaoMunicipal>${config.prestador_inscricao_municipal || '6241034'}</InscricaoMunicipal>
    </Prestador>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfDeclaracaoPrestacaoServico Id="${rpsId}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${numeroRps}</Numero>
              <Serie>${serieRps}</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${dataEmissao}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${dataEmissao}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>1.00</ValorServicos>
              <Aliquota>0.0500</Aliquota>
            </Valores>
            <IssRetido>2</IssRetido>
            <ItemListaServico>${itemListaServico}</ItemListaServico>
            <CodigoCnae>${config.codigo_cnae_padrao || '6920602'}</CodigoCnae>
            <Discriminacao>${escapeXml('TESTE DE EMISSÃO VIA API - SERVIÇOS CONTÁBEIS - R$ 1,00')}</Discriminacao>
            <CodigoMunicipio>${codigoMunicipio}</CodigoMunicipio>
            <ExigibilidadeISS>1</ExigibilidadeISS>
            <MunicipioIncidencia>${codigoMunicipio}</MunicipioIncidencia>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${config.prestador_cnpj}</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>${config.prestador_inscricao_municipal || '6241034'}</InscricaoMunicipal>
          </Prestador>
          <TomadorServico>
            <IdentificacaoTomador>
              <CpfCnpj>
                ${tomadorTag}
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(cliente.razao_social || cliente.name || 'TOMADOR TESTE')}</RazaoSocial>
            <Endereco>
              <Endereco>${escapeXml(cliente.logradouro || 'Rua Teste')}</Endereco>
              <Numero>${escapeXml(String(cliente.numero || '100'))}</Numero>
              <Bairro>${escapeXml(cliente.bairro || 'Centro')}</Bairro>
              <CodigoMunicipio>${codigoMunicipio}</CodigoMunicipio>
              <Uf>${uf}</Uf>
              <Cep>${cep}</Cep>
            </Endereco>
            <Contato>
              <Email>${escapeXml(cliente.email || 'teste@teste.com')}</Email>
            </Contato>
          </TomadorServico>
          <RegimeEspecialTributacao>3</RegimeEspecialTributacao>
          <OptanteSimplesNacional>${config.optante_simples_nacional ? '1' : '2'}</OptanteSimplesNacional>
          <IncentivoFiscal>2</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;

    console.log(`   ✅ XML gerado (${xml.length} bytes)`);

    // 7. Assinar XML
    console.log('\n7️⃣  Assinando XML...');
    let xmlAssinado = signXml(xml, rpsId, cert.privateKeyPem, cert.certBase64);
    xmlAssinado = signXml(xmlAssinado, loteId, cert.privateKeyPem, cert.certBase64);
    console.log('   ✅ XML assinado');

    // 8. Determinar URL
    const wsUrl = isHomologacao
      ? `${config.base_url_homologacao}/${config.endpoint || 'nfse.asmx'}`
      : `${config.base_url_producao}/${config.endpoint || 'nfse.asmx'}`;

    const soapNamespace = isHomologacao
      ? 'http://nfse.abrasf.org.br'
      : 'http://nfse.goiania.go.gov.br/ws/';

    console.log(`\n8️⃣  Enviando para WebService...`);
    console.log(`   🌐 URL: ${wsUrl}`);

    // 9. Enviar SOAP
    const soapEnvelope = wrapSoapEnvelope(xmlAssinado, 'RecepcionarLoteRps', soapNamespace);
    const urlObj = new URL(wsUrl);

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        pfx: cert.pfxBuffer,
        passphrase: cert.password,
        rejectUnauthorized: false,
        timeout: 60000,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
          'SOAPAction': `${soapNamespace}/RecepcionarLoteRps`,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.on('error', reject);
      req.write(soapEnvelope);
      req.end();
    });

    console.log(`   ✅ HTTP ${response.statusCode}`);

    // 10. Processar resposta
    console.log('\n9️⃣  Processando resposta...');

    const protocolo = extractProtocol(response.body);
    const nfseData = extractNFSeData(response.body);
    const erros = extractErrors(response.body);

    const updateData = {
      xml_rps: xmlAssinado,
      updated_at: new Date().toISOString(),
    };

    if (protocolo) {
      updateData.protocolo = protocolo;
      updateData.status = 'processing';
      console.log(`   📋 Protocolo: ${protocolo}`);
    }

    if (nfseData) {
      updateData.numero_nfse = nfseData.numero_nfse;
      updateData.codigo_verificacao = nfseData.codigo_verificacao;
      updateData.status = 'authorized';
      updateData.data_autorizacao = new Date().toISOString();
      console.log(`   🎫 NFS-e: ${nfseData.numero_nfse}`);
      console.log(`   🔑 Código: ${nfseData.codigo_verificacao}`);
    }

    if (erros.length && !protocolo && !nfseData) {
      updateData.status = 'error';
      updateData.codigo_erro = erros[0].codigo;
      updateData.mensagem_erro = erros.map(e => `${e.codigo}: ${e.mensagem}`).join('; ');
      console.log(`   ❌ Erro: [${erros[0].codigo}] ${erros[0].mensagem}`);
    }

    await supabase.from('nfse').update(updateData).eq('id', nfse.id);

    // Log
    await supabase.from('nfse_log').insert({
      nfse_id: nfse.id,
      operacao: 'emitir_teste_petshop_1real',
      request_xml: soapEnvelope,
      response_xml: response.body,
      response_timestamp: new Date().toISOString(),
      sucesso: !!protocolo || !!nfseData,
      codigo_retorno: erros[0]?.codigo || null,
      mensagem_retorno: erros[0]?.mensagem || (protocolo ? `Protocolo: ${protocolo}` : 'OK'),
      protocolo: protocolo || null,
    });

    // Resultado
    console.log('\n═══════════════════════════════════════════════════════════');
    if (protocolo || nfseData) {
      console.log('   ✅ EMISSÃO REALIZADA COM SUCESSO!');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`   📌 NFS-e ID: ${nfse.id}`);
      console.log(`   📋 RPS: ${numeroRps}/${serieRps}`);
      console.log(`   💰 Valor: R$ 1,00`);
      console.log(`   🏪 Tomador: ${cliente.razao_social || cliente.name}`);
      if (protocolo) console.log(`   🎫 Protocolo: ${protocolo}`);
      if (nfseData?.numero_nfse) console.log(`   📄 NFS-e: ${nfseData.numero_nfse}`);
      console.log('\n   💡 Execute: node scripts/consultar-status.js');
    } else {
      console.log('   ❌ FALHA NA EMISSÃO');
      console.log('═══════════════════════════════════════════════════════════');
      erros.forEach(e => console.log(`   [${e.codigo}] ${e.mensagem}`));
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    return { sucesso: !!protocolo || !!nfseData, nfse_id: nfse.id, protocolo };

  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    process.exit(1);
  }
}

emitirTeste().then(r => process.exit(r.sucesso ? 0 : 1));
