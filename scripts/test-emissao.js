#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import {
  buildLoteRpsXmlFromDb,
  extractErrors,
  extractProtocol,
  loadCertificateFromEnv,
  sendSoapRequest,
  signXml,
} from '../api/_shared/nfse-abrasf204.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function emitirNFSe() {
  try {
    console.log('🔍 Buscando config NFS-e...');
    
    const { data: configs, error: configError } = await supabase
      .from('nfse_config')
      .select('*');

    if (configError || !configs || configs.length === 0) {
      throw new Error('Config NFS-e não encontrada');
    }

    const config = configs[0];
    console.log('✅ Config encontrada');
    console.log('  Ambiente:', config.ambiente);
    console.log('  CNPJ:', config.prestador_cnpj);

    // Carregar certificado
    console.log('🔐 Carregando certificado...');
    const cert = loadCertificateFromEnv();
    if (!cert) {
      throw new Error('Certificado não carregado');
    }
    console.log('✅ Certificado carregado');

    // Criar um RPS simples para testar
    const rpsData = {
      numero_rps: 102,
      serie_rps: 'A',
      tipo_rps: 1, // RPS
      descricao_servico: 'Consultoria em Sistemas',
      valor_servico: 1500.00,
      tomador_cnpj: '24544420000105', // AVIZ ALIMENTOS
      tomador_razao_social: 'AVIZ ALIMENTOS LTDA',
      tomador_email: 'contato@aviz.com.br',
      tomador_cep: '74000000'
    };

    console.log('\n📄 Criando RPS:');
    console.log('  Número:', rpsData.numero_rps);
    console.log('  Série:', rpsData.serie_rps);
    console.log('  Serviço:', rpsData.descricao_servico);
    console.log('  Valor:', 'R$', rpsData.valor_servico);
    console.log('  Cliente:', rpsData.tomador_cnpj);

    // Salvar no banco primeiro
    console.log('\n💾 Salvando no banco de dados...');
    const { data: nfseRecord, error: insertError } = await supabase
      .from('nfse')
      .insert({
        numero_rps: rpsData.numero_rps,
        serie_rps: rpsData.serie_rps,
        tipo_rps: rpsData.tipo_rps,
        prestador_cnpj: config.cnpj_prestador,
        tomador_cnpj: rpsData.tomador_cnpj,
        tomador_razao_social: rpsData.tomador_razao_social,
        tomador_email: rpsData.tomador_email,
        tomador_cep: rpsData.tomador_cep,
        discriminacao: rpsData.descricao_servico,
        valor_servicos: rpsData.valor_servico,
        data_emissao: new Date().toISOString().split('T')[0],
        competencia: new Date().toISOString().split('T')[0],
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      throw new Error('Erro ao salvar NFS-e: ' + insertError.message);
    }

    const nfse_id = nfseRecord.id;
    console.log('✅ NFS-e criada com ID:', nfse_id);

    // Construir XML do lote
    console.log('\n🔨 Construindo XML do lote...');
    const xmlLote = await buildLoteRpsXmlFromDb(supabase, nfse_id, config, cert);
    console.log('✅ XML construído');

    // Assinar XML
    console.log('\n✍️  Assinando XML...');
    const assinado = signXml(xmlLote, cert);
    console.log('✅ XML assinado');

    // Enviar SOAP
    console.log('\n📤 Enviando para webservice...');
    const webserviceConfig = {
      ambiente: config.environment,
      url: config.environment === 'producao'
        ? `${config.base_url_producao}/${config.endpoint}`
        : `${config.base_url_homologacao}/${config.endpoint}`,
      soapNamespace: 'http://nfse.goiania.go.gov.br/ws/',
      soapActionBase: 'http://nfse.goiania.go.gov.br'
    };

    const response = await sendSoapRequest('RecepcionarLoteRps', assinado, webserviceConfig, cert);
    console.log('✅ Resposta recebida');

    // Extrair protocolo
    const protocolo = extractProtocol(response);
    const erros = extractErrors(response);

    if (protocolo) {
      console.log('\n✅ EMISSÃO SUCESSO');
      console.log('  Protocolo:', protocolo);
      
      // Atualizar banco
      const { error: updateError } = await supabase
        .from('nfse')
        .update({
          status: 'processing',
          protocolo: protocolo,
          updated_at: new Date().toISOString()
        })
        .eq('id', nfse_id);

      if (updateError) {
        console.error('⚠️  Erro ao atualizar:', updateError.message);
      } else {
        console.log('  Banco atualizado: status=processing');
      }
    } else {
      console.log('\n❌ EMISSÃO FALHOU');
      if (erros && erros.length > 0) {
        console.log('  Erros:');
        erros.forEach(e => {
          console.log('    -', e.codigo, ':', e.mensagem);
        });
      }
      
      // Atualizar banco com erro
      const { error: updateError } = await supabase
        .from('nfse')
        .update({
          status: 'error',
          mensagem_erro: erros?.[0]?.mensagem || 'Erro desconhecido',
          updated_at: new Date().toISOString()
        })
        .eq('id', nfse_id);
    }

    // Salvar log
    await supabase.from('nfse_log').insert({
      nfse_id,
      acao: 'emissao',
      status: protocolo ? 'sucesso' : 'erro',
      resposta: response.substring(0, 500),
      criado_em: new Date().toISOString()
    });

    console.log('\n✅ Log salvo');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

emitirNFSe();
