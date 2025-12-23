#!/usr/bin/env node
/**
 * Script para baixar NFS-e recebidas (onde Ampla é TOMADOR)
 * Consulta no portal de Goiânia as notas emitidas por fornecedores
 */

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { loadCertificateFromEnv, wrapSoapEnvelope } from '../api/_shared/nfse-abrasf204.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// CNPJ da Ampla (tomador)
const CNPJ_AMPLA = '23893032000169';
const IM_AMPLA = '6241034';

// Fornecedores que emitiram notas para Ampla
const FORNECEDORES = [
  { cnpj: '43961100000197', nome: 'NB - TECHNOLOGY LTDA' },
  { cnpj: '14153062000148', nome: 'CR - SISTEMA E ANALISE EM ARQUIVOS MAGNETICOS LTDA' },
];

async function consultarNfseRecebidas() {
  console.log('🔍 Consultando NFS-e recebidas pela Ampla...\n');

  try {
    // Buscar config
    const { data: configs } = await supabase.from('nfse_config').select('*');
    const config = configs[0];

    console.log(`📌 Ambiente: ${config.ambiente}`);
    console.log(`📌 CNPJ Tomador (Ampla): ${CNPJ_AMPLA}`);
    console.log(`📌 Inscrição Municipal: ${IM_AMPLA}\n`);

    // Carregar certificado
    const cert = loadCertificateFromEnv();
    console.log('✅ Certificado carregado\n');

    // Para cada fornecedor, consultar notas emitidas para a Ampla
    for (const fornecedor of FORNECEDORES) {
      console.log(`\n📋 Consultando notas de: ${fornecedor.nome}`);
      console.log(`   CNPJ Prestador: ${fornecedor.cnpj}`);

      // XML para consultar NFS-e por período (últimos 6 meses)
      const dataFim = new Date();
      const dataInicio = new Date();
      dataInicio.setMonth(dataInicio.getMonth() - 6);

      const xmlConsulta = `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseFaixaEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Prestador>
    <CpfCnpj>
      <Cnpj>${fornecedor.cnpj}</Cnpj>
    </CpfCnpj>
  </Prestador>
  <Faixa>
    <NumeroNfseInicial>1</NumeroNfseInicial>
  </Faixa>
  <Pagina>1</Pagina>
</ConsultarNfseFaixaEnvio>`;

      try {
        const url = config.ambiente === 'producao'
          ? `${config.base_url_producao}/${config.endpoint}`
          : `${config.base_url_homologacao}/${config.endpoint}`;

        // Goiânia usa namespace diferente
        const soapNamespace = config.ambiente === 'producao'
          ? 'http://nfse.goiania.go.gov.br/xsd/nfse_gyn_v02.xsd'
          : 'http://nfse.abrasf.org.br';

        console.log(`   🌐 URL: ${url}`);

        const response = await sendSoapRequest(
          url,
          xmlConsulta,
          'ConsultarNfseFaixa',
          soapNamespace,
          cert.pfxBuffer,
          cert.password
        );

        console.log(`   📡 Status HTTP: ${response.statusCode}`);

        // Verificar erros
        if (response.body.includes('Fault') || response.body.includes('Erro')) {
          const erroMatch = response.body.match(/<(?:Mensagem|faultstring)>([^<]+)/i);
          console.log(`   ⚠️ Resposta: ${erroMatch ? erroMatch[1] : 'Erro desconhecido'}`);
        }

        // Extrair notas da resposta
        const nfseMatches = response.body.matchAll(/<CompNfse>([\s\S]*?)<\/CompNfse>/gi);
        let count = 0;
        for (const match of nfseMatches) {
          count++;
          const nfseXml = match[1];
          const numero = nfseXml.match(/<Numero>([^<]+)/)?.[1] || '?';
          const valor = nfseXml.match(/<ValorServicos>([^<]+)/)?.[1] || '?';
          const competencia = nfseXml.match(/<Competencia>([^<]+)/)?.[1] || '?';
          console.log(`   📄 NFS-e ${numero} - Competência: ${competencia} - Valor: R$ ${valor}`);
        }

        if (count === 0) {
          console.log(`   ℹ️ Nenhuma nota encontrada ou sem permissão para consulta`);
        }

      } catch (err) {
        console.log(`   ❌ Erro: ${err.message || err}`);
        if (err.code) console.log(`   🔍 Código: ${err.code}`);
      }
    }

    console.log('\n✅ Consulta concluída');

  } catch (err) {
    console.error('❌ ERRO:', err.message);
    process.exit(1);
  }
}

async function sendSoapRequest(url, xmlPayload, operation, soapNamespace, pfxBuffer, password) {
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
      'SOAPAction': `${soapNamespace}${operation}`,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Timeout de 60s excedido'));
    });

    req.on('error', reject);
    req.write(soapEnvelope);
    req.end();
  });
}

consultarNfseRecebidas();
