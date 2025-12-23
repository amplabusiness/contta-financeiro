import { createClient } from '@supabase/supabase-js';
import {
  buildLoteRpsXmlFromDb,
  extractErrors,
  extractNFSeData,
  extractNFSeXml,
  extractProtocol,
  loadCertificateFromEnv,
  sendSoapRequest,
  signXml,
} from '../_shared/nfse-abrasf204.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header) return null;
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
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

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados no servidor');
    }

    // Em desenvolvimento, usar service role key direto
    // Em produção, validar Bearer token
    const isDev = process.env.NODE_ENV !== 'production';
    
    if (!isDev) {
      const token = getBearerToken(req);
      if (!token) {
        res.statusCode = 401;
        res.json({ error: 'Authorization Bearer token obrigatório' });
        return;
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) {
        res.statusCode = 401;
        res.json({ error: 'Token inválido' });
        return;
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await readJson(req);
    let nfse_id = body.nfse_id;
    const invoice_id = body.invoice_id;
    if (!nfse_id && !invoice_id) throw new Error('nfse_id ou invoice_id é obrigatório');

    // 0) Se veio invoice_id, garantir que existe uma NFS-e vinculada (idempotente)
    if (!nfse_id && invoice_id) {
      const { data: existingNfse } = await supabase
        .from('nfse')
        .select('id,status')
        .eq('invoice_id', invoice_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingNfse?.id) {
        nfse_id = existingNfse.id;
      } else {
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select(`*, client:clients(id, name, cnpj, cpf, email, phone, razao_social, logradouro, numero, complemento, bairro, municipio, uf, cep)`)
          .eq('id', invoice_id)
          .single();

        if (invoiceError || !invoice) throw new Error(`Honorário não encontrado: ${invoiceError?.message}`);
        if (invoice.created_by && invoice.created_by !== userData.user.id) {
          res.statusCode = 403;
          res.json({ error: 'Sem permissão para emitir NFS-e deste honorário' });
          return;
        }

        const { data: config, error: configError } = await supabase
          .from('nfse_config')
          .select('*')
          .single();
        if (configError || !config) throw new Error(`Configuração não encontrada: ${configError?.message}`);

        const rpsResult = await supabase.rpc('proximo_numero_rps', { p_prestador_cnpj: config.prestador_cnpj });
        if (rpsResult.error) throw rpsResult.error;
        const numeroRps = String(rpsResult.data || 1);

        const comp = String(invoice.competence || '').trim(); // MM/YYYY
        const compMatch = comp.match(/^(\d{2})\/(\d{4})$/);
        const competencia = compMatch ? `${compMatch[2]}-${compMatch[1]}-01` : new Date().toISOString().split('T')[0];

        const client = invoice.client;
        const doc = String(client?.cnpj || client?.cpf || '').replace(/\D/g, '');
        const tomadorCnpj = doc.length === 14 ? doc : null;
        const tomadorCpf = doc.length === 11 ? doc : null;

        const valorServicos = Number(invoice.amount || 0);
        if (!valorServicos || valorServicos <= 0) throw new Error('Honorário com valor inválido para emissão');

        const usarIssFixo = !!config.usar_iss_fixo;
        const aliquota = usarIssFixo ? 0 : Number(config.aliquota_padrao || 0);
        const valorIss = usarIssFixo ? 0 : Number((valorServicos * aliquota).toFixed(2));
        const exigibilidadeIss = usarIssFixo ? 4 : 1;

        const discriminacaoBase = config.descricao_servico_padrao || 'Serviços contábeis mensais conforme contrato';
        const discriminacao = compMatch ? `${discriminacaoBase}\nCompetência ${comp}` : discriminacaoBase;

        const insert = await supabase
          .from('nfse')
          .insert({
            numero_rps: numeroRps,
            serie_rps: config.serie_rps_padrao || 'A',
            status: 'pending',
            data_emissao: new Date().toISOString().split('T')[0],
            competencia,
            prestador_cnpj: config.prestador_cnpj,
            prestador_inscricao_municipal: config.prestador_inscricao_municipal,
            prestador_razao_social: config.prestador_razao_social,
            tomador_cnpj: tomadorCnpj,
            tomador_cpf: tomadorCpf,
            tomador_razao_social: client?.razao_social || client?.name || 'Tomador',
            tomador_email: client?.email || null,
            tomador_telefone: client?.phone || null,
            tomador_endereco: client?.logradouro || null,
            tomador_numero: client?.numero || null,
            tomador_complemento: client?.complemento || null,
            tomador_bairro: client?.bairro || null,
            tomador_cidade: client?.municipio || null,
            tomador_uf: client?.uf || null,
            tomador_cep: String(client?.cep || '').replace(/\D/g, '') || null,
            discriminacao,
            valor_servicos: valorServicos,
            valor_deducoes: 0,
            valor_pis: 0,
            valor_cofins: 0,
            valor_inss: 0,
            valor_ir: 0,
            valor_csll: 0,
            outras_retencoes: 0,
            valor_iss: valorIss,
            aliquota,
            desconto_incondicionado: 0,
            desconto_condicionado: 0,
            valor_liquido: valorServicos,
            iss_retido: false,
            item_lista_servico: config.item_lista_servico_padrao || '17.18',
            codigo_cnae: config.codigo_cnae_padrao || '6920602',
            codigo_municipio: '5208707',
            exigibilidade_iss: exigibilidadeIss,
            optante_simples_nacional: !!config.optante_simples_nacional,
            client_id: invoice.client_id,
            invoice_id,
            created_by: userData.user.id,
          })
          .select('id')
          .single();

        if (insert.error || !insert.data) throw new Error(`Falha ao criar NFS-e: ${insert.error?.message}`);
        nfse_id = insert.data.id;
      }
    }

    const { data: nfse, error: nfseError } = await supabase
      .from('nfse')
      .select(`*, client:clients(id, name, cnpj, cpf, email, phone, razao_social, logradouro, numero, complemento, bairro, municipio, uf, cep)`)
      .eq('id', nfse_id)
      .single();

    if (nfseError || !nfse) throw new Error(`NFS-e não encontrada: ${nfseError?.message}`);

    if (nfse.created_by && nfse.created_by !== userData.user.id) {
      res.statusCode = 403;
      res.json({ error: 'Sem permissão para emitir esta NFS-e' });
      return;
    }

    const { data: config, error: configError } = await supabase
      .from('nfse_config')
      .select('*')
      .eq('prestador_cnpj', nfse.prestador_cnpj)
      .single();

    if (configError || !config) throw new Error(`Configuração não encontrada: ${configError?.message}`);

    // Completar dados do tomador com dados do cliente
    const client = nfse.client;
    if (client) {
      nfse.tomador_email = nfse.tomador_email || client.email;
      nfse.tomador_telefone = nfse.tomador_telefone || client.phone;
      nfse.tomador_endereco = nfse.tomador_endereco || client.logradouro;
      nfse.tomador_numero = nfse.tomador_numero || client.numero;
      nfse.tomador_complemento = nfse.tomador_complemento || client.complemento;
      nfse.tomador_bairro = nfse.tomador_bairro || client.bairro;
      nfse.tomador_uf = nfse.tomador_uf || client.uf;
      nfse.tomador_cep = nfse.tomador_cep || client.cep;
      nfse.tomador_razao_social = nfse.tomador_razao_social || client.razao_social || client.name;

      if (!nfse.tomador_cnpj && !nfse.tomador_cpf) {
        const doc = (client.cnpj || client.cpf || '').replace(/\D/g, '');
        if (doc.length === 14) nfse.tomador_cnpj = doc;
        if (doc.length === 11) nfse.tomador_cpf = doc;
      }
    }

    const ws = getWebserviceConfig(config);

    // 1) Gerar XML ABRASF 2.04
    const { xml: rpsXmlUnsigned, rpsId, loteId } = buildLoteRpsXmlFromDb(nfse, config, ws.ambiente);

    // 2) Assinar XML (RPS como irmão; Lote como filho)
    const { pfxBuffer, password, privateKeyPem, certBase64 } = loadCertificateFromEnv();
    let rpsXmlSigned = rpsXmlUnsigned;
    rpsXmlSigned = signXml(rpsXmlSigned, rpsId, privateKeyPem, certBase64, true);
    rpsXmlSigned = signXml(rpsXmlSigned, loteId, privateKeyPem, certBase64, false);

    // 3) Enviar via mTLS
    const { body: responseXml, statusCode, soapEnvelope } = await sendSoapRequest({
      url: ws.url,
      operation: 'RecepcionarLoteRps',
      soapActionBase: ws.soapActionBase,
      soapNamespace: ws.soapNamespace,
      xmlPayload: rpsXmlSigned,
      pfxBuffer,
      passphrase: password,
    });

    const protocolo = extractProtocol(responseXml);
    const nfseData = extractNFSeData(responseXml);
    const errors = extractErrors(responseXml);

    const updateData = {
      xml_rps: rpsXmlSigned,
      updated_at: new Date().toISOString(),
    };

    if (protocolo) {
      updateData.protocolo = protocolo;
      updateData.status = 'processing';
    }

    if (nfseData) {
      updateData.numero_nfse = nfseData.numero_nfse;
      updateData.codigo_verificacao = nfseData.codigo_verificacao;
      updateData.status = 'authorized';
      updateData.data_autorizacao = new Date().toISOString();

      const nfseXml = extractNFSeXml(responseXml);
      if (nfseXml) updateData.xml_nfse = nfseXml;
    }

    if (errors.length > 0) {
      updateData.status = 'error';
      updateData.codigo_erro = errors[0].codigo;
      updateData.mensagem_erro = errors.map((e) => `${e.codigo}: ${e.mensagem}`).join('; ');
    }

    await supabase.from('nfse').update(updateData).eq('id', nfse_id);

    await supabase.from('nfse_log').insert({
      nfse_id,
      operacao: 'enviar_lote_assinado',
      request_xml: soapEnvelope,
      response_xml: responseXml,
      response_timestamp: new Date().toISOString(),
      sucesso: errors.length === 0,
      codigo_retorno: errors[0]?.codigo || null,
      mensagem_retorno: errors[0]?.mensagem || (protocolo ? `Protocolo: ${protocolo}` : 'OK'),
      protocolo: protocolo || null,
    });

    res.statusCode = errors.length === 0 ? 200 : 400;
    res.json({
      success: errors.length === 0,
      nfse_id,
      invoice_id: nfse.invoice_id || invoice_id || null,
      http_status: statusCode,
      ambiente: ws.ambiente,
      endpoint: ws.url,
      protocolo,
      numero_nfse: nfseData?.numero_nfse,
      codigo_verificacao: nfseData?.codigo_verificacao,
      errors,
    });
  } catch (err) {
    res.statusCode = 500;
    res.json({ error: err?.message || String(err) });
  }
}
