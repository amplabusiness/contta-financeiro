/**
 * API: Consultar NFS-e de Serviços Tomados
 * Busca notas fiscais de serviços que a empresa TOMOU (despesas)
 * Para lançamento automático em contas a pagar
 */

import { createClient } from '@supabase/supabase-js';
import {
  buildConsultarNfseServicoTomadoXml,
  extractErrors,
  extractNFSeList,
  extractPaginacao,
  loadCertificateFromEnv,
  sendSoapRequest,
} from '../_shared/nfse-abrasf204.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

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

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.statusCode = 405;
    res.json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Parâmetros da requisição
    const body = req.method === 'POST' ? await readJson(req) : {};
    const query = req.query || {};

    const dataInicial = body.data_inicial || query.data_inicial;
    const dataFinal = body.data_final || query.data_final;
    const prestadorCnpj = body.prestador_cnpj || query.prestador_cnpj;
    const numeroNfse = body.numero_nfse || query.numero_nfse;
    const pagina = parseInt(body.pagina || query.pagina || '1');
    const salvarNoBanco = body.salvar !== false; // default true
    const criarContasPagar = body.criar_contas_pagar !== false; // default true

    // Buscar configuração
    const { data: config, error: configError } = await supabase
      .from('nfse_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error(`Configuração não encontrada: ${configError?.message}`);
    }

    const ws = getWebserviceConfig(config);

    // Carregar certificado
    const { pfxBuffer, password } = loadCertificateFromEnv();

    // Construir XML de consulta
    const xmlConsulta = buildConsultarNfseServicoTomadoXml(
      config.prestador_cnpj,
      config.prestador_inscricao_municipal,
      {
        dataInicial,
        dataFinal,
        prestadorCnpj,
        numeroNfse,
        pagina,
      }
    );

    // Enviar requisição SOAP
    const { body: responseXml, statusCode, soapEnvelope } = await sendSoapRequest({
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

    // Log da operação
    await supabase.from('nfse_log').insert({
      operacao: 'consultar_servico_tomado',
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: errors.length === 0,
      codigo_retorno: errors[0]?.codigo || null,
      mensagem_retorno: errors[0]?.mensagem || `${nfseList.length} NFS-e encontradas`,
    });

    // Salvar no banco e criar contas a pagar
    const notasSalvas = [];
    const contasCriadas = [];

    if (salvarNoBanco && nfseList.length > 0) {
      for (const nfse of nfseList) {
        // Verificar se já existe
        const { data: existing } = await supabase
          .from('nfse_tomadas')
          .select('id')
          .eq('numero_nfse', nfse.numero_nfse)
          .eq('prestador_cnpj', nfse.prestador_cnpj)
          .maybeSingle();

        if (!existing) {
          // Inserir nova NFS-e tomada
          const { data: inserted, error: insertError } = await supabase
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
              tomador_razao_social: config.prestador_razao_social,
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
              status: 'pendente', // pendente de lançamento
            })
            .select()
            .single();

          if (!insertError && inserted) {
            notasSalvas.push(inserted);

            // Criar conta a pagar automaticamente
            if (criarContasPagar) {
              // Buscar ou criar fornecedor
              let fornecedorId = null;
              const { data: fornecedor } = await supabase
                .from('suppliers')
                .select('id')
                .eq('cnpj', nfse.prestador_cnpj)
                .maybeSingle();

              if (fornecedor) {
                fornecedorId = fornecedor.id;
              } else {
                // Criar fornecedor
                const { data: novoFornecedor } = await supabase
                  .from('suppliers')
                  .insert({
                    name: nfse.prestador_razao_social || `Fornecedor ${nfse.prestador_cnpj}`,
                    cnpj: nfse.prestador_cnpj,
                    status: 'active',
                  })
                  .select()
                  .single();

                if (novoFornecedor) {
                  fornecedorId = novoFornecedor.id;
                }
              }

              // Criar conta a pagar
              const vencimento = nfse.data_emissao
                ? new Date(new Date(nfse.data_emissao).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

              const { data: contaPagar, error: contaError } = await supabase
                .from('accounts_payable')
                .insert({
                  supplier_id: fornecedorId,
                  description: `NFS-e ${nfse.numero_nfse} - ${nfse.discriminacao?.substring(0, 100) || 'Serviço tomado'}`,
                  amount: nfse.valor_liquido || nfse.valor_servicos,
                  due_date: vencimento,
                  competence: nfse.competencia ? nfse.competencia.substring(0, 7).replace('-', '/').split('/').reverse().join('/') : null,
                  status: 'pending',
                  document_number: `NFSE-${nfse.numero_nfse}`,
                  nfse_tomada_id: inserted.id,
                })
                .select()
                .single();

              if (!contaError && contaPagar) {
                contasCriadas.push(contaPagar);

                // Atualizar NFS-e tomada com referência
                await supabase
                  .from('nfse_tomadas')
                  .update({
                    conta_pagar_id: contaPagar.id,
                    status: 'lancada',
                  })
                  .eq('id', inserted.id);
              }
            }
          }
        }
      }
    }

    res.statusCode = errors.length === 0 ? 200 : 400;
    res.json({
      success: errors.length === 0,
      ambiente: ws.ambiente,
      total_encontradas: nfseList.length,
      notas_salvas: notasSalvas.length,
      contas_criadas: contasCriadas.length,
      paginacao,
      nfse_list: nfseList,
      notas_salvas_ids: notasSalvas.map(n => n.id),
      contas_criadas_ids: contasCriadas.map(c => c.id),
      errors,
    });

  } catch (err) {
    console.error('Erro:', err);
    res.statusCode = 500;
    res.json({ error: err?.message || String(err) });
  }
}
