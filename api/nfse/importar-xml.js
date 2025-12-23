/**
 * API: Importar XML de NFS-e Tomada
 * Recebe XMLs de notas fiscais recebidas e salva no banco
 */

import { createClient } from '@supabase/supabase-js';

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

/**
 * Extrai valor de uma tag XML
 */
function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
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
  return extractTag(containerMatch[1], tagName);
}

/**
 * Detecta o formato do XML (ABRASF ou Portal Nacional)
 */
function detectXmlFormat(xml) {
  if (xml.includes('xmlns="http://www.sped.fazenda.gov.br/nfse"') || xml.includes('<infNFSe')) {
    return 'portal_nacional';
  }
  if (xml.includes('xmlns="http://www.abrasf.org.br/nfse.xsd"') || xml.includes('<CompNfse') || xml.includes('<InfNfse')) {
    return 'abrasf';
  }
  return 'unknown';
}

/**
 * Parse XML do Portal Nacional da NFS-e
 */
function parsePortalNacional(xml) {
  // Extrair bloco infNFSe
  const infNfseMatch = xml.match(/<infNFSe[^>]*>([\s\S]*?)<\/infNFSe>/i);
  const nfseBlock = infNfseMatch ? infNfseMatch[0] : xml;

  // Dados básicos
  const numero = extractTag(nfseBlock, 'nNFSe') || extractTag(nfseBlock, 'nDFSe');
  const dataEmissaoRaw = extractTag(nfseBlock, 'dhProc') || extractTag(nfseBlock, 'dhEmi');
  const dataEmissao = dataEmissaoRaw ? dataEmissaoRaw.split('T')[0] : null;
  const competencia = extractTag(nfseBlock, 'dCompet');

  // Emitente (prestador - fornecedor)
  const emitMatch = nfseBlock.match(/<emit>([\s\S]*?)<\/emit>/i);
  const emitBlock = emitMatch ? emitMatch[1] : '';
  const prestadorCnpj = extractTag(emitBlock, 'CNPJ');
  const prestadorIM = extractTag(emitBlock, 'IM');
  const prestadorRazaoSocial = extractTag(emitBlock, 'xNome');

  // Endereço do emitente
  const enderEmitMatch = emitBlock.match(/<enderNac>([\s\S]*?)<\/enderNac>/i);
  const enderEmitBlock = enderEmitMatch ? enderEmitMatch[1] : '';
  const prestadorEndereco = [
    extractTag(enderEmitBlock, 'xLgr'),
    extractTag(enderEmitBlock, 'nro'),
    extractTag(enderEmitBlock, 'xBairro'),
  ].filter(Boolean).join(', ');
  const prestadorMunicipio = extractTag(enderEmitBlock, 'cMun');
  const prestadorUf = extractTag(enderEmitBlock, 'UF');

  // Tomador
  const tomaMatch = nfseBlock.match(/<toma>([\s\S]*?)<\/toma>/i);
  const tomaBlock = tomaMatch ? tomaMatch[1] : '';
  const tomadorCnpj = extractTag(tomaBlock, 'CNPJ');
  const tomadorCpf = extractTag(tomaBlock, 'CPF');
  const tomadorRazaoSocial = extractTag(tomaBlock, 'xNome');

  // Valores
  const valoresMatch = nfseBlock.match(/<valores>([\s\S]*?)<\/valores>/i);
  const valoresBlock = valoresMatch ? valoresMatch[1] : '';
  const valorServicos = parseFloat(extractTag(valoresBlock, 'vServ') || extractTag(valoresBlock, 'vLiq') || '0');
  const valorIss = parseFloat(extractTag(valoresBlock, 'vISSQN') || '0');
  const aliquota = parseFloat(extractTag(valoresBlock, 'pAliqAplic') || extractTag(valoresBlock, 'pAliq') || '0');
  const valorLiquido = parseFloat(extractTag(valoresBlock, 'vLiq') || '0');

  // Serviço
  const servMatch = nfseBlock.match(/<serv>([\s\S]*?)<\/serv>/i);
  const servBlock = servMatch ? servMatch[1] : '';
  const discriminacao = extractTag(servBlock, 'xDescServ') || extractTag(nfseBlock, 'xTribNac');
  const codigoMunicipio = extractTag(servBlock, 'cLocPrestacao') || extractTag(nfseBlock, 'cLocIncid');

  return {
    numero_nfse: numero,
    codigo_verificacao: null, // Portal Nacional não usa código de verificação da mesma forma
    data_emissao: dataEmissao,
    competencia,
    prestador_cnpj: prestadorCnpj?.replace(/\D/g, ''),
    prestador_cpf: null,
    prestador_razao_social: prestadorRazaoSocial,
    prestador_inscricao_municipal: prestadorIM,
    prestador_endereco: prestadorEndereco || null,
    prestador_municipio: prestadorMunicipio,
    prestador_uf: prestadorUf,
    tomador_cnpj: tomadorCnpj?.replace(/\D/g, ''),
    tomador_cpf: tomadorCpf?.replace(/\D/g, ''),
    tomador_razao_social: tomadorRazaoSocial,
    valor_servicos: valorServicos,
    valor_deducoes: 0,
    valor_pis: 0,
    valor_cofins: 0,
    valor_inss: 0,
    valor_ir: 0,
    valor_csll: 0,
    valor_iss: valorIss,
    outras_retencoes: 0,
    aliquota,
    valor_liquido: valorLiquido || valorServicos,
    discriminacao,
    item_lista_servico: null,
    codigo_cnae: null,
    codigo_municipio: codigoMunicipio,
    xml_nfse: xml,
  };
}

/**
 * Parse XML ABRASF (Goiânia e outros)
 */
function parseAbrasf(xml) {
  // Tentar encontrar o bloco CompNfse ou Nfse
  const nfseMatch = xml.match(/<(?:CompNfse|Nfse)[^>]*>([\s\S]*?)<\/(?:CompNfse|Nfse)>/i);
  const nfseBlock = nfseMatch ? nfseMatch[0] : xml;

  // Dados da NFS-e
  const numero = extractTag(nfseBlock, 'Numero');
  const codigoVerificacao = extractTag(nfseBlock, 'CodigoVerificacao');
  const dataEmissao = extractTag(nfseBlock, 'DataEmissao');
  const competencia = extractTag(nfseBlock, 'Competencia');

  // Valores
  const valorServicos = parseFloat(extractTag(nfseBlock, 'ValorServicos') || '0');
  const valorDeducoes = parseFloat(extractTag(nfseBlock, 'ValorDeducoes') || '0');
  const valorPis = parseFloat(extractTag(nfseBlock, 'ValorPis') || '0');
  const valorCofins = parseFloat(extractTag(nfseBlock, 'ValorCofins') || '0');
  const valorInss = parseFloat(extractTag(nfseBlock, 'ValorInss') || '0');
  const valorIr = parseFloat(extractTag(nfseBlock, 'ValorIr') || '0');
  const valorCsll = parseFloat(extractTag(nfseBlock, 'ValorCsll') || '0');
  const valorIss = parseFloat(extractTag(nfseBlock, 'ValorIss') || '0');
  const outrasRetencoes = parseFloat(extractTag(nfseBlock, 'OutrasRetencoes') || '0');
  const aliquota = parseFloat(extractTag(nfseBlock, 'Aliquota') || '0');
  const valorLiquido = parseFloat(extractTag(nfseBlock, 'ValorLiquidoNfse') || '0');

  // Prestador (quem emitiu - fornecedor)
  const prestadorCnpj = extractNestedTag(nfseBlock, 'Prestador', 'Cnpj') ||
                        extractNestedTag(nfseBlock, 'PrestadorServico', 'Cnpj') ||
                        extractNestedTag(nfseBlock, 'IdentificacaoPrestador', 'Cnpj');
  const prestadorCpf = extractNestedTag(nfseBlock, 'Prestador', 'Cpf') ||
                       extractNestedTag(nfseBlock, 'PrestadorServico', 'Cpf');
  const prestadorRazaoSocial = extractNestedTag(nfseBlock, 'PrestadorServico', 'RazaoSocial') ||
                               extractNestedTag(nfseBlock, 'Prestador', 'RazaoSocial') ||
                               extractTag(nfseBlock, 'RazaoSocialPrestador');
  const prestadorIM = extractNestedTag(nfseBlock, 'Prestador', 'InscricaoMunicipal') ||
                      extractNestedTag(nfseBlock, 'PrestadorServico', 'InscricaoMunicipal');

  // Endereço do prestador
  const prestadorEndereco = [
    extractNestedTag(nfseBlock, 'Endereco', 'Endereco') || extractTag(nfseBlock, 'Endereco'),
    extractNestedTag(nfseBlock, 'Endereco', 'Numero'),
    extractNestedTag(nfseBlock, 'Endereco', 'Bairro'),
  ].filter(Boolean).join(', ');
  const prestadorMunicipio = extractNestedTag(nfseBlock, 'Endereco', 'CodigoMunicipio') ||
                             extractTag(nfseBlock, 'MunicipioPrestador');
  const prestadorUf = extractNestedTag(nfseBlock, 'Endereco', 'Uf') ||
                      extractTag(nfseBlock, 'UfPrestador');

  // Tomador (nós - quem recebeu o serviço)
  const tomadorCnpj = extractNestedTag(nfseBlock, 'Tomador', 'Cnpj') ||
                      extractNestedTag(nfseBlock, 'TomadorServico', 'Cnpj') ||
                      extractNestedTag(nfseBlock, 'IdentificacaoTomador', 'Cnpj');
  const tomadorCpf = extractNestedTag(nfseBlock, 'Tomador', 'Cpf') ||
                     extractNestedTag(nfseBlock, 'TomadorServico', 'Cpf');
  const tomadorRazaoSocial = extractNestedTag(nfseBlock, 'TomadorServico', 'RazaoSocial') ||
                             extractNestedTag(nfseBlock, 'Tomador', 'RazaoSocial');

  // Serviço
  const discriminacao = extractTag(nfseBlock, 'Discriminacao');
  const itemListaServico = extractTag(nfseBlock, 'ItemListaServico');
  const codigoCnae = extractTag(nfseBlock, 'CodigoCnae');
  const codigoMunicipio = extractTag(nfseBlock, 'CodigoMunicipio') ||
                          extractTag(nfseBlock, 'MunicipioIncidencia');

  return {
    numero_nfse: numero,
    codigo_verificacao: codigoVerificacao,
    data_emissao: dataEmissao ? dataEmissao.split('T')[0] : null,
    competencia,
    prestador_cnpj: prestadorCnpj?.replace(/\D/g, ''),
    prestador_cpf: prestadorCpf?.replace(/\D/g, ''),
    prestador_razao_social: prestadorRazaoSocial,
    prestador_inscricao_municipal: prestadorIM,
    prestador_endereco: prestadorEndereco || null,
    prestador_municipio: prestadorMunicipio,
    prestador_uf: prestadorUf,
    tomador_cnpj: tomadorCnpj?.replace(/\D/g, ''),
    tomador_cpf: tomadorCpf?.replace(/\D/g, ''),
    tomador_razao_social: tomadorRazaoSocial,
    valor_servicos: valorServicos,
    valor_deducoes: valorDeducoes,
    valor_pis: valorPis,
    valor_cofins: valorCofins,
    valor_inss: valorInss,
    valor_ir: valorIr,
    valor_csll: valorCsll,
    valor_iss: valorIss,
    outras_retencoes: outrasRetencoes,
    aliquota,
    valor_liquido: valorLiquido || (valorServicos - valorDeducoes - valorPis - valorCofins - valorInss - valorIr - valorCsll - valorIss - outrasRetencoes),
    discriminacao,
    item_lista_servico: itemListaServico,
    codigo_cnae: codigoCnae,
    codigo_municipio: codigoMunicipio,
    xml_nfse: xml,
  };
}

/**
 * Extrai todos os dados de uma NFS-e do XML (detecta formato automaticamente)
 */
function parseNFSeXml(xml) {
  const format = detectXmlFormat(xml);

  if (format === 'portal_nacional') {
    return parsePortalNacional(xml);
  }

  return parseAbrasf(xml);
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
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await readJson(req);
    const { xmls, criarContasPagar = false, diasVencimento = 30 } = body;

    if (!xmls || !Array.isArray(xmls) || xmls.length === 0) {
      throw new Error('xmls é obrigatório e deve ser um array de strings XML');
    }

    const resultados = [];
    let inseridas = 0;
    let duplicadas = 0;
    let erros = 0;

    for (const xml of xmls) {
      try {
        // Parsear XML
        const dados = parseNFSeXml(xml);

        if (!dados.numero_nfse || !dados.prestador_cnpj) {
          resultados.push({
            sucesso: false,
            erro: 'XML inválido: número da NFS-e ou CNPJ do prestador não encontrado',
          });
          erros++;
          continue;
        }

        // Verificar duplicata
        const { data: existe } = await supabase
          .from('nfse_tomadas')
          .select('id')
          .eq('numero_nfse', dados.numero_nfse)
          .eq('prestador_cnpj', dados.prestador_cnpj)
          .maybeSingle();

        if (existe) {
          resultados.push({
            sucesso: false,
            numero_nfse: dados.numero_nfse,
            prestador_cnpj: dados.prestador_cnpj,
            erro: 'NFS-e já existe no banco',
          });
          duplicadas++;
          continue;
        }

        // Inserir NFS-e tomada
        const { data: nfseTomada, error: insertError } = await supabase
          .from('nfse_tomadas')
          .insert({
            ...dados,
            status: 'pendente',
          })
          .select()
          .single();

        if (insertError) {
          resultados.push({
            sucesso: false,
            numero_nfse: dados.numero_nfse,
            erro: insertError.message,
          });
          erros++;
          continue;
        }

        inseridas++;

        // Criar conta a pagar se solicitado
        let contaPagarId = null;
        let supplierId = null;

        if (criarContasPagar) {
          // Buscar ou criar fornecedor
          const { data: fornecedor } = await supabase
            .from('suppliers')
            .select('id')
            .eq('cnpj', dados.prestador_cnpj)
            .maybeSingle();

          if (fornecedor) {
            supplierId = fornecedor.id;
          } else {
            const { data: novoFornecedor } = await supabase
              .from('suppliers')
              .insert({
                name: dados.prestador_razao_social || `Fornecedor ${dados.prestador_cnpj}`,
                cnpj: dados.prestador_cnpj,
                status: 'active',
              })
              .select()
              .single();

            if (novoFornecedor) {
              supplierId = novoFornecedor.id;
            }
          }

          // Calcular vencimento
          const dataEmissao = dados.data_emissao ? new Date(dados.data_emissao) : new Date();
          const vencimento = new Date(dataEmissao);
          vencimento.setDate(vencimento.getDate() + diasVencimento);

          // Criar conta a pagar
          const { data: contaPagar } = await supabase
            .from('accounts_payable')
            .insert({
              supplier_id: supplierId,
              description: `NFS-e ${dados.numero_nfse} - ${(dados.discriminacao || 'Serviço').substring(0, 100)}`,
              amount: dados.valor_liquido || dados.valor_servicos,
              due_date: vencimento.toISOString().split('T')[0],
              status: 'pending',
              document_number: `NFSE-${dados.numero_nfse}`,
              nfse_tomada_id: nfseTomada.id,
            })
            .select()
            .single();

          if (contaPagar) {
            contaPagarId = contaPagar.id;

            // Atualizar NFS-e com referências
            await supabase
              .from('nfse_tomadas')
              .update({
                conta_pagar_id: contaPagarId,
                supplier_id: supplierId,
                status: 'lancada',
              })
              .eq('id', nfseTomada.id);
          }
        }

        resultados.push({
          sucesso: true,
          numero_nfse: dados.numero_nfse,
          prestador: dados.prestador_razao_social || dados.prestador_cnpj,
          valor: dados.valor_liquido || dados.valor_servicos,
          nfse_tomada_id: nfseTomada.id,
          conta_pagar_id: contaPagarId,
          supplier_id: supplierId,
        });

      } catch (err) {
        resultados.push({
          sucesso: false,
          erro: err.message,
        });
        erros++;
      }
    }

    res.statusCode = 200;
    res.json({
      success: true,
      resumo: {
        total: xmls.length,
        inseridas,
        duplicadas,
        erros,
      },
      resultados,
    });

  } catch (err) {
    console.error('Erro:', err);
    res.statusCode = 500;
    res.json({ error: err?.message || String(err) });
  }
}
