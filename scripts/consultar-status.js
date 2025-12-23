#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { loadCertificateFromEnv, wrapSoapEnvelope, extractProtocol, escapeXml } from '../api/_shared/nfse-abrasf204.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function consultarStatus() {
  console.log('🔍 Consultando status de NFS-e em processamento...\n');

  try {
    // 1. Buscar NFS-e em processamento
    const { data: nfses } = await supabase
      .from('nfse')
      .select('*')
      .eq('status', 'processing')
      .limit(5);

    if (!nfses?.length) {
      console.log('✅ Nenhuma NFS-e em processamento');
      return;
    }

    console.log(`📋 Encontradas ${nfses.length} NFS-e em processamento`);

    // 2. Buscar config
    const { data: configs } = await supabase.from('nfse_config').select('*');
    const config = configs[0];

    // 3. Carregar certificado
    const cert = loadCertificateFromEnv();
    console.log('✅ Certificado carregado\n');

    let atualizadas = 0;

    for (const nfse of nfses) {
      console.log(`📝 Consultando RPS ${nfse.numero_rps}/${nfse.serie_rps}...`);

      // Construir XML de consulta
      const xmlConsulta = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfsePorRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${nfse.prestador_cnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${nfse.prestador_inscricao_municipal || '6241034'}</InscricaoMunicipal>
  </Prestador>
  <NumeroRps>${nfse.numero_rps}</NumeroRps>
  <SerieRps>${nfse.serie_rps}</SerieRps>
  <TipoRps>${nfse.tipo_rps || 1}</TipoRps>
</ConsultarNfsePorRpsEnvio>`;

      try {
        const url = config.ambiente === 'producao'
          ? `${config.base_url_producao}/${config.endpoint}`
          : `${config.base_url_homologacao}/${config.endpoint}`;

        // Goiânia usa namespace diferente do ABRASF padrão
        const soapNamespace = config.ambiente === 'producao'
          ? 'http://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd'
          : 'http://nfse.abrasf.org.br';

        console.log(`   🌐 URL: ${url}`);

        const response = await sendSoapRequest(
          url,
          xmlConsulta,
          'ConsultarNfseRps', // Goiânia usa ConsultarNfseRps (sem "Por")
          soapNamespace,
          cert.pfxBuffer,
          cert.password
        );

        // Debug: mostrar resposta
        console.log(`   📡 Status HTTP: ${response.statusCode}`);

        // Verificar erros na resposta
        const erroMatch = response.body.match(/<(?:Codigo|faultcode)>([^<]+)<\/(?:Codigo|faultcode)>/i);
        const msgErroMatch = response.body.match(/<(?:Mensagem|faultstring)>([^<]+)<\/(?:Mensagem|faultstring)>/i);

        if (erroMatch && msgErroMatch) {
          console.log(`   ⚠️ Resposta: [${erroMatch[1]}] ${msgErroMatch[1]}`);
        }

        // Extrair dados da resposta
        const numeroNfseMatch = response.body.match(/<Numero>([^<]+)<\/Numero>/i);
        const codigoVerifMatch = response.body.match(/<CodigoVerificacao>([^<]+)<\/CodigoVerificacao>/i);

        if (numeroNfseMatch) {
          const numero_nfse = numeroNfseMatch[1];
          const codigo_verificacao = codigoVerifMatch ? codigoVerifMatch[1] : '';

          console.log(`   ✅ Aprovada! NFS-e: ${numero_nfse}`);

          // Atualizar no banco
          await supabase.from('nfse').update({
            status: 'authorized',
            numero_nfse,
            codigo_verificacao,
            data_autorizacao: new Date().toISOString(),
          }).eq('id', nfse.id);

          atualizadas++;
        } else {
          console.log(`   ⏳ Ainda em processamento...`);
          // Se tem erro, mostrar trecho da resposta
          if (response.body.includes('Fault') || response.body.includes('Erro')) {
            console.log(`   📄 Resposta (trecho): ${response.body.substring(0, 500)}...`);
          }
        }

      } catch (err) {
        console.log(`   ❌ Erro:`, err.message || err);
        if (err.code) console.log(`   🔍 Código:`, err.code);
        if (err.cause) console.log(`   🔍 Causa:`, err.cause);
      }
    }

    console.log(`\n✅ Consulta concluída. ${atualizadas} NFS-e(s) aprovada(s)`);

  } catch (err) {
    console.error('❌ ERRO:', err.message);
    process.exit(1);
  }
}

async function sendSoapRequest(url, xmlPayload, operation, soapNamespace, pfxBuffer, password, maxRetries = 3) {
  const soapEnvelope = wrapSoapEnvelope(xmlPayload, operation, soapNamespace);

  const urlObj = new URL(url);

  const options = {
    hostname: urlObj.hostname,
    port: 443,
    path: urlObj.pathname,
    method: 'POST',
    pfx: pfxBuffer,
    passphrase: password,
    rejectUnauthorized: false,
    timeout: 60000,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
      'SOAPAction': `${soapNamespace}/${operation}`,
    },
  };

  const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'];
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, body: data });
          });
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('ETIMEDOUT'));
        });
        req.on('error', reject);
        req.write(soapEnvelope);
        req.end();
      });
    } catch (error) {
      lastError = error;
      const errorCode = error.code || error.message;
      const shouldRetry = retryableErrors.some(code => errorCode.includes(code));

      if (shouldRetry && attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`   ⚠️ Tentativa ${attempt}/${maxRetries} falhou (${errorCode}). Retry em ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw new Error(`Falha após ${maxRetries} tentativas: ${lastError?.message}`);
}

consultarStatus();
