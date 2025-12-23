#!/usr/bin/env node
/**
 * Consulta NFS-e de Serviços Tomados (notas recebidas - despesas)
 * Baixa notas onde a Ampla é TOMADORA (cliente/contratante)
 */

import { createClient } from '@supabase/supabase-js';
import {
  buildConsultarNfseServicoTomadoXml,
  extractNFSeList,
  extractErrors,
  extractPaginacao,
  loadCertificateFromEnv,
  sendSoapRequest,
} from '../api/_shared/nfse-abrasf204.js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getWebserviceConfig(config) {
  const ambiente = config.ambiente === 'producao' ? 'producao' : 'homologacao';

  if (ambiente === 'producao') {
    const base = config.base_url_producao || 'https://nfse.goiania.go.gov.br/ws';
    return {
      ambiente,
      url: `${base}/${config.endpoint || 'nfse.asmx'}`,
      soapNamespace: 'http://nfse.goiania.go.gov.br/ws/',
      soapActionBase: 'http://nfse.goiania.go.gov.br',
    };
  }

  const base = config.base_url_homologacao || 'https://www.issnetonline.com.br/homologaabrasf/webservicenfse204';
  return {
    ambiente,
    url: `${base}/${config.endpoint || 'nfse.asmx'}`,
    soapNamespace: 'http://nfse.abrasf.org.br',
    soapActionBase: 'http://nfse.abrasf.org.br',
  };
}

async function consultarServicosTomados() {
  console.log('\n📥 Consultando NFS-e de Serviços Tomados (despesas)...\n');

  // Parâmetros - últimos 12 meses
  const hoje = new Date();
  const dataFinal = hoje.toISOString().split('T')[0];
  const anoPassado = new Date(hoje);
  anoPassado.setFullYear(anoPassado.getFullYear() - 1);
  const dataInicial = anoPassado.toISOString().split('T')[0];

  console.log(`📅 Período: ${dataInicial} a ${dataFinal}`);

  // Buscar configuração
  const { data: config, error: configError } = await supabase
    .from('nfse_config')
    .select('*')
    .single();

  if (configError || !config) {
    console.error('❌ Configuração não encontrada:', configError?.message);
    process.exit(1);
  }

  console.log(`🏢 Tomador: ${config.prestador_cnpj} (IM: ${config.prestador_inscricao_municipal})`);

  const ws = getWebserviceConfig(config);
  console.log(`🌐 Ambiente: ${ws.ambiente.toUpperCase()}`);
  console.log(`📡 URL: ${ws.url}`);

  // Carregar certificado
  const { pfxBuffer, password } = loadCertificateFromEnv();
  console.log('🔐 Certificado carregado');

  let pagina = 1;
  let totalNotas = 0;
  let todasNotas = [];

  do {
    console.log(`\n📄 Consultando página ${pagina}...`);

    // Construir XML
    const xmlConsulta = buildConsultarNfseServicoTomadoXml(
      config.prestador_cnpj,
      config.prestador_inscricao_municipal,
      {
        dataInicial,
        dataFinal,
        pagina,
      }
    );

    // Enviar requisição
    const { body: responseXml, soapEnvelope } = await sendSoapRequest({
      url: ws.url,
      operation: 'ConsultarNfseServicoTomado',
      soapActionBase: ws.soapActionBase,
      soapNamespace: ws.soapNamespace,
      xmlPayload: xmlConsulta,
      pfxBuffer,
      passphrase: password,
    });

    // Extrair dados
    const nfseList = extractNFSeList(responseXml);
    const errors = extractErrors(responseXml);
    const paginacao = extractPaginacao(responseXml);

    if (errors.length > 0) {
      console.log('\n⚠️  Erros/Avisos:');
      errors.forEach(e => console.log(`   ${e.codigo}: ${e.mensagem}`));

      // Se for erro E4 (não encontrado), não é erro fatal
      if (errors.some(e => e.codigo === 'E4')) {
        console.log('\n📭 Nenhuma NFS-e tomada encontrada no período.');
        break;
      }
    }

    if (nfseList.length > 0) {
      console.log(`✅ Encontradas ${nfseList.length} notas na página ${pagina}`);
      todasNotas = todasNotas.concat(nfseList);
      totalNotas += nfseList.length;

      // Mostrar resumo das notas
      nfseList.forEach(nf => {
        console.log(`   📋 NFS-e ${nf.numero_nfse} - ${nf.prestador_razao_social || nf.prestador_cnpj}`);
        console.log(`      Valor: R$ ${nf.valor_servicos.toFixed(2)} | Data: ${nf.data_emissao}`);
      });
    }

    // Próxima página
    if (paginacao.proxima_pagina) {
      pagina = paginacao.proxima_pagina;
    } else {
      break;
    }

  } while (pagina <= 50); // Limite de segurança

  console.log(`\n📊 Total de NFS-e tomadas encontradas: ${totalNotas}`);

  if (todasNotas.length > 0) {
    console.log('\n💾 Salvando no banco de dados...');

    let inseridas = 0;
    let duplicadas = 0;

    for (const nfse of todasNotas) {
      // Verificar se já existe
      const { data: existe } = await supabase
        .from('nfse_tomadas')
        .select('id')
        .eq('numero_nfse', nfse.numero_nfse)
        .eq('prestador_cnpj', nfse.prestador_cnpj)
        .maybeSingle();

      if (existe) {
        duplicadas++;
        continue;
      }

      // Inserir nova
      const { error: insertError } = await supabase
        .from('nfse_tomadas')
        .insert({
          numero_nfse: nfse.numero_nfse,
          codigo_verificacao: nfse.codigo_verificacao,
          data_emissao: nfse.data_emissao,
          competencia: nfse.competencia,
          prestador_cnpj: nfse.prestador_cnpj,
          prestador_razao_social: nfse.prestador_razao_social,
          prestador_inscricao_municipal: nfse.prestador_inscricao_municipal,
          tomador_cnpj: config.prestador_cnpj,
          tomador_razao_social: 'AMPLA CONTABILIDADE',
          valor_servicos: nfse.valor_servicos,
          valor_deducoes: nfse.valor_deducoes,
          valor_pis: nfse.valor_pis,
          valor_cofins: nfse.valor_cofins,
          valor_inss: nfse.valor_inss,
          valor_ir: nfse.valor_ir,
          valor_csll: nfse.valor_csll,
          valor_iss: nfse.valor_iss,
          aliquota: nfse.aliquota,
          valor_liquido: nfse.valor_liquido || nfse.valor_servicos,
          discriminacao: nfse.discriminacao,
          item_lista_servico: nfse.item_lista_servico,
          codigo_cnae: nfse.codigo_cnae,
          codigo_municipio: nfse.codigo_municipio,
          xml_nfse: nfse.xml_completo,
          status: 'pendente',
        });

      if (insertError) {
        console.error(`   ❌ Erro ao inserir NFS-e ${nfse.numero_nfse}:`, insertError.message);
      } else {
        inseridas++;
      }
    }

    console.log(`\n✅ Resultado:`);
    console.log(`   Novas inseridas: ${inseridas}`);
    console.log(`   Já existentes: ${duplicadas}`);
  }

  console.log('\n✅ Consulta finalizada!');
  console.log('\n💡 Para criar contas a pagar automaticamente, use:');
  console.log('   SELECT fn_processar_nfse_tomada(id, true, 30) FROM nfse_tomadas WHERE status = \'pendente\';');
}

consultarServicosTomados().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
