#!/usr/bin/env node
/**
 * Importa XMLs de NFS-e tomadas de uma pasta
 *
 * Uso: node scripts/importar-xmls-pasta.js <pasta> [--criar-contas-pagar] [--dias-vencimento=30]
 *
 * Exemplo:
 *   node scripts/importar-xmls-pasta.js ./xmls-recebidos
 *   node scripts/importar-xmls-pasta.js ./xmls-recebidos --criar-contas-pagar --dias-vencimento=15
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Parsear argumentos
const args = process.argv.slice(2);
const pasta = args.find(a => !a.startsWith('--'));
const criarContasPagar = args.includes('--criar-contas-pagar');
const diasArg = args.find(a => a.startsWith('--dias-vencimento='));
const diasVencimento = diasArg ? parseInt(diasArg.split('=')[1]) : 30;

if (!pasta) {
  console.log(`
📁 Importador de XMLs de NFS-e Tomadas

Uso: node scripts/importar-xmls-pasta.js <pasta> [opções]

Opções:
  --criar-contas-pagar     Criar contas a pagar automaticamente
  --dias-vencimento=N      Dias para vencimento (padrão: 30)

Exemplos:
  node scripts/importar-xmls-pasta.js ./xmls-recebidos
  node scripts/importar-xmls-pasta.js C:\\Notas\\Recebidas --criar-contas-pagar
  node scripts/importar-xmls-pasta.js ./xmls --criar-contas-pagar --dias-vencimento=15
`);
  process.exit(0);
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
 * Extrai tag aninhada
 */
function extractNestedTag(xml, container, tagName) {
  const containerRegex = new RegExp(`<${container}[^>]*>([\\s\\S]*?)</${container}>`, 'i');
  const containerMatch = String(xml).match(containerRegex);
  if (!containerMatch) return null;
  return extractTag(containerMatch[1], tagName);
}

/**
 * Parseia XML de NFS-e
 */
function parseNFSeXml(xml) {
  const nfseMatch = xml.match(/<(?:CompNfse|Nfse)[^>]*>([\s\S]*?)<\/(?:CompNfse|Nfse)>/i);
  const nfseBlock = nfseMatch ? nfseMatch[0] : xml;

  const numero = extractTag(nfseBlock, 'Numero');
  const codigoVerificacao = extractTag(nfseBlock, 'CodigoVerificacao');
  const dataEmissao = extractTag(nfseBlock, 'DataEmissao');
  const competencia = extractTag(nfseBlock, 'Competencia');

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

  const prestadorCnpj = extractNestedTag(nfseBlock, 'Prestador', 'Cnpj') ||
                        extractNestedTag(nfseBlock, 'PrestadorServico', 'Cnpj') ||
                        extractNestedTag(nfseBlock, 'IdentificacaoPrestador', 'Cnpj');
  const prestadorCpf = extractNestedTag(nfseBlock, 'Prestador', 'Cpf');
  const prestadorRazaoSocial = extractNestedTag(nfseBlock, 'PrestadorServico', 'RazaoSocial') ||
                               extractNestedTag(nfseBlock, 'Prestador', 'RazaoSocial');
  const prestadorIM = extractNestedTag(nfseBlock, 'Prestador', 'InscricaoMunicipal');

  const prestadorEndereco = [
    extractNestedTag(nfseBlock, 'Endereco', 'Endereco'),
    extractNestedTag(nfseBlock, 'Endereco', 'Numero'),
    extractNestedTag(nfseBlock, 'Endereco', 'Bairro'),
  ].filter(Boolean).join(', ');
  const prestadorMunicipio = extractNestedTag(nfseBlock, 'Endereco', 'CodigoMunicipio');
  const prestadorUf = extractNestedTag(nfseBlock, 'Endereco', 'Uf');

  const tomadorCnpj = extractNestedTag(nfseBlock, 'Tomador', 'Cnpj') ||
                      extractNestedTag(nfseBlock, 'TomadorServico', 'Cnpj');
  const tomadorCpf = extractNestedTag(nfseBlock, 'Tomador', 'Cpf');
  const tomadorRazaoSocial = extractNestedTag(nfseBlock, 'TomadorServico', 'RazaoSocial') ||
                             extractNestedTag(nfseBlock, 'Tomador', 'RazaoSocial');

  const discriminacao = extractTag(nfseBlock, 'Discriminacao');
  const itemListaServico = extractTag(nfseBlock, 'ItemListaServico');
  const codigoCnae = extractTag(nfseBlock, 'CodigoCnae');
  const codigoMunicipio = extractTag(nfseBlock, 'CodigoMunicipio');

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
  };
}

async function importarXmls() {
  console.log('\n📁 Importador de XMLs de NFS-e Tomadas\n');

  // Verificar pasta
  const pastaAbsoluta = path.resolve(pasta);
  if (!fs.existsSync(pastaAbsoluta)) {
    console.error(`❌ Pasta não encontrada: ${pastaAbsoluta}`);
    process.exit(1);
  }

  console.log(`📂 Pasta: ${pastaAbsoluta}`);
  console.log(`💳 Criar contas a pagar: ${criarContasPagar ? 'SIM' : 'NÃO'}`);
  if (criarContasPagar) {
    console.log(`📅 Dias para vencimento: ${diasVencimento}`);
  }

  // Listar arquivos XML
  const arquivos = fs.readdirSync(pastaAbsoluta)
    .filter(f => f.toLowerCase().endsWith('.xml'));

  if (arquivos.length === 0) {
    console.log('\n📭 Nenhum arquivo XML encontrado na pasta.');
    process.exit(0);
  }

  console.log(`\n📄 Encontrados ${arquivos.length} arquivos XML\n`);

  let inseridas = 0;
  let duplicadas = 0;
  let erros = 0;

  for (const arquivo of arquivos) {
    const caminhoArquivo = path.join(pastaAbsoluta, arquivo);
    console.log(`📝 Processando: ${arquivo}`);

    try {
      const xml = fs.readFileSync(caminhoArquivo, 'utf-8');
      const dados = parseNFSeXml(xml);

      if (!dados.numero_nfse || !dados.prestador_cnpj) {
        console.log(`   ⚠️  XML inválido: número ou CNPJ não encontrado`);
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
        console.log(`   ⏭️  Já existe: NFS-e ${dados.numero_nfse}`);
        duplicadas++;
        continue;
      }

      // Inserir
      const { data: nfseTomada, error: insertError } = await supabase
        .from('nfse_tomadas')
        .insert({
          ...dados,
          xml_nfse: xml,
          status: 'pendente',
        })
        .select()
        .single();

      if (insertError) {
        console.log(`   ❌ Erro: ${insertError.message}`);
        erros++;
        continue;
      }

      console.log(`   ✅ NFS-e ${dados.numero_nfse} - R$ ${dados.valor_servicos.toFixed(2)}`);
      console.log(`      Prestador: ${dados.prestador_razao_social || dados.prestador_cnpj}`);
      inseridas++;

      // Criar conta a pagar se solicitado
      if (criarContasPagar) {
        // Buscar ou criar fornecedor
        let supplierId = null;
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
            console.log(`      📋 Novo fornecedor criado`);
          }
        }

        // Calcular vencimento
        const dataEmissao = dados.data_emissao ? new Date(dados.data_emissao) : new Date();
        const vencimento = new Date(dataEmissao);
        vencimento.setDate(vencimento.getDate() + diasVencimento);

        // Criar conta a pagar
        const { data: contaPagar, error: cpError } = await supabase
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
          await supabase
            .from('nfse_tomadas')
            .update({
              conta_pagar_id: contaPagar.id,
              supplier_id: supplierId,
              status: 'lancada',
            })
            .eq('id', nfseTomada.id);

          console.log(`      💰 Conta a pagar criada - Venc: ${vencimento.toISOString().split('T')[0]}`);
        } else if (cpError) {
          console.log(`      ⚠️  Erro ao criar conta a pagar: ${cpError.message}`);
        }
      }

    } catch (err) {
      console.log(`   ❌ Erro ao processar: ${err.message}`);
      erros++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMO DA IMPORTAÇÃO');
  console.log('='.repeat(50));
  console.log(`   Total de arquivos: ${arquivos.length}`);
  console.log(`   ✅ Inseridas: ${inseridas}`);
  console.log(`   ⏭️  Duplicadas: ${duplicadas}`);
  console.log(`   ❌ Erros: ${erros}`);
  console.log('='.repeat(50));
}

importarXmls().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
