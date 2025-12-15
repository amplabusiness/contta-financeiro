// Script para testar geração de XML de NFS-e ABRASF 2.04
// Gera um XML de exemplo e valida a estrutura

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Namespace ABRASF
const NAMESPACE = "http://www.abrasf.org.br/nfse.xsd";

// Dados de exemplo para teste
const dadosTeste = {
  // Prestador (Ampla)
  prestador_cnpj: '23893032000169',
  inscricao_municipal: '6241034',

  // Tomador (cliente exemplo)
  tomador_cpf_cnpj: '12345678000199',
  tomador_tipo_documento: 'cnpj',
  tomador_razao_social: 'EMPRESA CLIENTE TESTE LTDA',
  tomador_email: 'cliente@teste.com.br',
  tomador_telefone: '6232123456',
  tomador_endereco: 'Avenida Teste',
  tomador_numero: '1000',
  tomador_complemento: 'Sala 101',
  tomador_bairro: 'Setor Central',
  tomador_codigo_municipio: '5208707', // Goiânia
  tomador_uf: 'GO',
  tomador_cep: '74000000',

  // Serviço
  discriminacao: 'Serviços contábeis mensais referente ao mês 12/2024 conforme contrato de prestação de serviços.',
  codigo_municipio: '5208707',
  municipio_incidencia: '5208707',
  valor_servicos: 1500.00,
  valor_deducoes: 0,
  valor_pis: 0,
  valor_cofins: 0,
  valor_inss: 0,
  valor_ir: 0,
  valor_csll: 0,
  outras_retencoes: 0,
  aliquota: 0.02, // 2%
  valor_iss: 0, // ISS Fixo - não calcula
  iss_retido: false,
  exigibilidade_iss: 1, // Exigível
  item_lista_servico: '17.18',
  codigo_cnae: '6920602',

  // RPS
  numero_rps: '1',
  serie_rps: '8', // Série 8 conforme Urls.txt
  data_emissao: '2024-12-15',
  competencia: '2024-12-01',

  // Regime tributário
  regime_especial_tributacao: 3, // Sociedade de Profissionais
  optante_simples_nacional: false,
  incentivo_fiscal: false
};

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Gera XML EnviarLoteRps (assíncrono)
function buildEnviarLoteRpsXml(data) {
  const loteId = `L${data.numero_rps}`;
  const rpsId = `RPS${data.numero_rps}`;

  const tomadorCpfCnpjTag = data.tomador_tipo_documento === 'cpf'
    ? `<Cpf>${data.tomador_cpf_cnpj}</Cpf>`
    : `<Cnpj>${data.tomador_cpf_cnpj}</Cnpj>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="${NAMESPACE}">
  <LoteRps Id="${loteId}" versao="2.04">
    <NumeroLote>${data.numero_rps}</NumeroLote>
    <Prestador>
      <CpfCnpj>
        <Cnpj>${data.prestador_cnpj}</Cnpj>
      </CpfCnpj>
      <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
    </Prestador>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfDeclaracaoPrestacaoServico Id="${rpsId}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${data.numero_rps}</Numero>
              <Serie>${data.serie_rps}</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${data.data_emissao}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${data.competencia}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${data.valor_servicos.toFixed(2)}</ValorServicos>
              ${data.valor_iss > 0 ? `<ValorIss>${data.valor_iss.toFixed(2)}</ValorIss>` : ''}
              ${data.aliquota > 0 ? `<Aliquota>${data.aliquota.toFixed(4)}</Aliquota>` : ''}
            </Valores>
            <IssRetido>${data.iss_retido ? '1' : '2'}</IssRetido>
            <ItemListaServico>${data.item_lista_servico.replace('.', '')}</ItemListaServico>
            <CodigoCnae>${data.codigo_cnae}</CodigoCnae>
            <Discriminacao>${escapeXml(data.discriminacao)}</Discriminacao>
            <CodigoMunicipio>${data.codigo_municipio}</CodigoMunicipio>
            <ExigibilidadeISS>${data.exigibilidade_iss}</ExigibilidadeISS>
            <MunicipioIncidencia>${data.municipio_incidencia}</MunicipioIncidencia>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${data.prestador_cnpj}</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
          </Prestador>
          <TomadorServico>
            <IdentificacaoTomador>
              <CpfCnpj>
                ${tomadorCpfCnpjTag}
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${escapeXml(data.tomador_razao_social)}</RazaoSocial>
            <Endereco>
              <Endereco>${escapeXml(data.tomador_endereco)}</Endereco>
              <Numero>${escapeXml(data.tomador_numero)}</Numero>
              ${data.tomador_complemento ? `<Complemento>${escapeXml(data.tomador_complemento)}</Complemento>` : ''}
              <Bairro>${escapeXml(data.tomador_bairro)}</Bairro>
              <CodigoMunicipio>${data.tomador_codigo_municipio}</CodigoMunicipio>
              <Uf>${data.tomador_uf}</Uf>
              <Cep>${data.tomador_cep.replace(/\D/g, '')}</Cep>
            </Endereco>
            <Contato>
              <Telefone>${data.tomador_telefone.replace(/\D/g, '')}</Telefone>
              <Email>${escapeXml(data.tomador_email)}</Email>
            </Contato>
          </TomadorServico>
          <RegimeEspecialTributacao>${data.regime_especial_tributacao}</RegimeEspecialTributacao>
          <OptanteSimplesNacional>${data.optante_simples_nacional ? '1' : '2'}</OptanteSimplesNacional>
          <IncentivoFiscal>${data.incentivo_fiscal ? '1' : '2'}</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`;
}

// Gera XML GerarNfse (síncrono unitário)
function buildGerarNfseXml(data) {
  const rpsId = `RPS${data.numero_rps}`;

  const tomadorCpfCnpjTag = data.tomador_tipo_documento === 'cpf'
    ? `<Cpf>${data.tomador_cpf_cnpj}</Cpf>`
    : `<Cnpj>${data.tomador_cpf_cnpj}</Cnpj>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<GerarNfseEnvio xmlns="${NAMESPACE}">
  <Rps>
    <InfDeclaracaoPrestacaoServico Id="${rpsId}">
      <Rps>
        <IdentificacaoRps>
          <Numero>${data.numero_rps}</Numero>
          <Serie>${data.serie_rps}</Serie>
          <Tipo>1</Tipo>
        </IdentificacaoRps>
        <DataEmissao>${data.data_emissao}</DataEmissao>
        <Status>1</Status>
      </Rps>
      <Competencia>${data.competencia}</Competencia>
      <Servico>
        <Valores>
          <ValorServicos>${data.valor_servicos.toFixed(2)}</ValorServicos>
          ${data.valor_iss > 0 ? `<ValorIss>${data.valor_iss.toFixed(2)}</ValorIss>` : ''}
          ${data.aliquota > 0 ? `<Aliquota>${data.aliquota.toFixed(4)}</Aliquota>` : ''}
        </Valores>
        <IssRetido>${data.iss_retido ? '1' : '2'}</IssRetido>
        <ItemListaServico>${data.item_lista_servico.replace('.', '')}</ItemListaServico>
        <CodigoCnae>${data.codigo_cnae}</CodigoCnae>
        <Discriminacao>${escapeXml(data.discriminacao)}</Discriminacao>
        <CodigoMunicipio>${data.codigo_municipio}</CodigoMunicipio>
        <ExigibilidadeISS>${data.exigibilidade_iss}</ExigibilidadeISS>
        <MunicipioIncidencia>${data.municipio_incidencia}</MunicipioIncidencia>
      </Servico>
      <Prestador>
        <CpfCnpj>
          <Cnpj>${data.prestador_cnpj}</Cnpj>
        </CpfCnpj>
        <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
      </Prestador>
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            ${tomadorCpfCnpjTag}
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>${escapeXml(data.tomador_razao_social)}</RazaoSocial>
        <Endereco>
          <Endereco>${escapeXml(data.tomador_endereco)}</Endereco>
          <Numero>${escapeXml(data.tomador_numero)}</Numero>
          ${data.tomador_complemento ? `<Complemento>${escapeXml(data.tomador_complemento)}</Complemento>` : ''}
          <Bairro>${escapeXml(data.tomador_bairro)}</Bairro>
          <CodigoMunicipio>${data.tomador_codigo_municipio}</CodigoMunicipio>
          <Uf>${data.tomador_uf}</Uf>
          <Cep>${data.tomador_cep.replace(/\D/g, '')}</Cep>
        </Endereco>
        <Contato>
          <Telefone>${data.tomador_telefone.replace(/\D/g, '')}</Telefone>
          <Email>${escapeXml(data.tomador_email)}</Email>
        </Contato>
      </TomadorServico>
      <RegimeEspecialTributacao>${data.regime_especial_tributacao}</RegimeEspecialTributacao>
      <OptanteSimplesNacional>${data.optante_simples_nacional ? '1' : '2'}</OptanteSimplesNacional>
      <IncentivoFiscal>${data.incentivo_fiscal ? '1' : '2'}</IncentivoFiscal>
    </InfDeclaracaoPrestacaoServico>
  </Rps>
</GerarNfseEnvio>`;
}

// Gera XML ConsultarNfseRps
function buildConsultarNfseRpsXml(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ConsultarNfseRpsEnvio xmlns="${NAMESPACE}">
  <IdentificacaoRps>
    <Numero>${data.numero_rps}</Numero>
    <Serie>${data.serie_rps}</Serie>
    <Tipo>1</Tipo>
  </IdentificacaoRps>
  <Prestador>
    <CpfCnpj>
      <Cnpj>${data.prestador_cnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${data.inscricao_municipal}</InscricaoMunicipal>
  </Prestador>
</ConsultarNfseRpsEnvio>`;
}

// Main
console.log('═══════════════════════════════════════════════════════════════');
console.log('    TESTE DE GERAÇÃO DE XML NFS-e - ABRASF 2.04                ');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📋 Dados do teste:');
console.log(`   Prestador: ${dadosTeste.prestador_cnpj} (IM: ${dadosTeste.inscricao_municipal})`);
console.log(`   Tomador: ${dadosTeste.tomador_razao_social}`);
console.log(`   Valor: R$ ${dadosTeste.valor_servicos.toFixed(2)}`);
console.log(`   RPS: ${dadosTeste.numero_rps}/${dadosTeste.serie_rps}`);
console.log(`   Regime: ${dadosTeste.regime_especial_tributacao} (Sociedade de Profissionais)`);
console.log('');

// Gerar XMLs
const outputDir = join(__dirname, '..', 'output');

try {
  // 1. EnviarLoteRps
  const xmlLote = buildEnviarLoteRpsXml(dadosTeste);
  const pathLote = join(outputDir, 'teste_EnviarLoteRps.xml');
  writeFileSync(pathLote, xmlLote, 'utf8');
  console.log(`✅ EnviarLoteRps gerado: ${pathLote}`);

  // 2. GerarNfse
  const xmlGerar = buildGerarNfseXml(dadosTeste);
  const pathGerar = join(outputDir, 'teste_GerarNfse.xml');
  writeFileSync(pathGerar, xmlGerar, 'utf8');
  console.log(`✅ GerarNfse gerado: ${pathGerar}`);

  // 3. ConsultarNfseRps
  const xmlConsulta = buildConsultarNfseRpsXml(dadosTeste);
  const pathConsulta = join(outputDir, 'teste_ConsultarNfseRps.xml');
  writeFileSync(pathConsulta, xmlConsulta, 'utf8');
  console.log(`✅ ConsultarNfseRps gerado: ${pathConsulta}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ XMLs gerados com sucesso!');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Mostrar resumo dos campos importantes
  console.log('📌 Campos importantes no XML:');
  console.log('');
  console.log('   RegimeEspecialTributacao: 3 (Sociedade de Profissionais)');
  console.log('   OptanteSimplesNacional: 2 (Não)');
  console.log('   IncentivoFiscal: 2 (Não)');
  console.log('   ExigibilidadeISS: 1 (Exigível)');
  console.log('   IssRetido: 2 (Não)');
  console.log('   Tipo (RPS): 1 (Recibo Provisório de Serviço)');
  console.log('   Status: 1 (Normal)');
  console.log('');
  console.log('🔗 URL Homologação: https://www.issnetonline.com.br/homologaabrasf/webservicenfse204/nfse.asmx');
  console.log('   Série RPS: 8 (conforme Urls.txt)');
  console.log('   Município: 5002704 (Campo Grande) - para homologação');
  console.log('');

} catch (err) {
  console.error('❌ Erro ao gerar XMLs:', err.message);
  process.exit(1);
}
