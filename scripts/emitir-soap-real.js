#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import https from 'https';
import {
  buildLoteRpsXmlFromDb,
  extractErrors,
  extractNFSeData,
  extractProtocol,
  loadCertificateFromEnv,
  sendSoapRequest,
  signXml,
  wrapSoapEnvelope,
} from '../api/_shared/nfse-abrasf204.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function emitirComSOAP() {
  console.log('📤 Emissão NFS-e com SOAP + Certificado\n');

  try {
    // 1. Buscar config
    const { data: configs } = await supabase.from('nfse_config').select('*');
    if (!configs?.length) throw new Error('Sem config NFS-e');
    const config = configs[0];
    console.log('✅ Config:', config.ambiente, '| CNPJ:', config.prestador_cnpj);

    // 2. Carregar certificado
    console.log('🔐 Carregando certificado A1...');
    const cert = loadCertificateFromEnv();
    console.log('✅ Certificado carregado');

    // 3. Criar registro NFS-e
    const numero_rps = Math.floor(Math.random() * 10000);
    console.log('\n📄 Criando RPS:', numero_rps);

    const { data: nfse, error: nfseErr } = await supabase.from('nfse').insert({
      numero_rps: String(numero_rps).padStart(5, '0'),
      serie_rps: 'A',
      tipo_rps: 1,
      prestador_cnpj: config.prestador_cnpj,
      tomador_razao_social: 'AVIZ ALIMENTOS LTDA',
      tomador_cnpj: '24544420000105',
      tomador_email: 'contato@aviz.com.br',
      tomador_cep: '74000000',
      discriminacao: 'Serviço de Consultoria em Sistemas',
      item_lista_servico: '1701', // Código ABRASF
      codigo_cnae: '6920601',
      valor_servicos: 2500.00,
      aliquota: 0.02,
      data_emissao: new Date().toISOString().split('T')[0],
      competencia: new Date().toISOString().split('T')[0],
      status: 'pending'
    }).select().single();

    if (nfseErr) {
      console.error('❌ Erro ao criar NFS-e:', nfseErr.message);
      throw nfseErr;
    }

    const nfse_id = nfse.id;
    console.log('✅ NFS-e criada: ID =', nfse_id);

    // 4. Construir XML RPS
    console.log('\n📝 Construindo XML RPS...');
    const xmlRps = await buildLoteRpsXmlFromDb(supabase, nfse_id, config, config.ambiente);
    console.log('✅ XML RPS construído');

    // 5. Assinar XML
    console.log('✍️  Assinando XML com certificado...');
    const xmlAssinado = signXml(xmlRps, cert);
    console.log('✅ XML assinado');

    // 6. Enviar SOAP
    console.log('\n📡 Enviando para webservice da prefeitura...');
    const webserviceConfig = {
      ambiente: config.ambiente,
      url: config.ambiente === 'producao'
        ? `${config.base_url_producao}/${config.endpoint}`
        : `${config.base_url_homologacao}/${config.endpoint}`,
      soapNamespace: 'http://nfse.goiania.go.gov.br/ws/',
      soapActionBase: 'http://nfse.goiania.go.gov.br'
    };

    console.log('  URL:', webserviceConfig.url);

    const response = await sendSoapRequest('RecepcionarLoteRps', xmlAssinado, webserviceConfig, cert);

    // 7. Processar resposta
    console.log('✅ Resposta recebida da prefeitura');

    const protocolo = extractProtocol(response);
    const erros = extractErrors(response);

    if (protocolo) {
      console.log('\n✅ EMISSÃO COM SUCESSO!');
      console.log('   Protocolo:', protocolo);
      console.log('   Status: Aguardando processamento da prefeitura');

      // Atualizar banco
      const { error: updateErr } = await supabase.from('nfse').update({
        status: 'processing',
        protocolo: protocolo,
        numero_lote: String(numero_rps)
      }).eq('id', nfse_id);

      if (updateErr) throw updateErr;

      console.log('\n✅ DB atualizado: status=processing');

      // Salvar XML
      await supabase.from('nfse').update({
        xml_rps: xmlRps
      }).eq('id', nfse_id);

      return {
        sucesso: true,
        nfse_id,
        numero_rps: nfse.numero_rps,
        protocolo,
        mensagem: 'Emissão enviada para a prefeitura. Aguarde processamento.'
      };

    } else {
      console.log('\n❌ FALHA NA EMISSÃO');
      if (erros.length > 0) {
        console.log('   Erros:');
        erros.forEach(e => {
          console.log(`     [${e.codigo}] ${e.mensagem}`);
        });
      }

      // Atualizar como erro
      await supabase.from('nfse').update({
        status: 'error',
        mensagem_erro: erros?.[0]?.mensagem || 'Erro desconhecido'
      }).eq('id', nfse_id);

      return {
        sucesso: false,
        nfse_id,
        erros,
        mensagem: 'Falha ao emitir NFS-e'
      };
    }

  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}


function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

emitirComSOAP().then(result => {
  console.log('\n' + JSON.stringify(result, null, 2));
});
