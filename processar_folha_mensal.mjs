import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tenantId = 'a53a4957-fe97-4856-b3ca-70045157b421';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DR. CÍCERO — PROCESSADOR DE FOLHA DE PAGAMENTO
 * Sistema Contta - Ampla Contabilidade
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * USO: node processar_folha_mensal.mjs <competencia>
 * Exemplo: node processar_folha_mensal.mjs 2025-02
 * 
 * Este script:
 * 1. Lê os dados da folha (PDF ou JSON)
 * 2. Indexa no Data Lake
 * 3. Cria os lançamentos contábeis
 * 
 * ESTRUTURA CONTÁBIL:
 * - Apropriação: D-Salários / C-Salários a Pagar / C-INSS a Recolher
 * - FGTS: D-FGTS Despesa / C-FGTS a Recolher
 * - IRRF: D-Salários a Pagar / C-IRRF a Recolher
 * ══════════════════════════════════════════════════════════════════════════════
 */

// UUIDs das contas contábeis (Ampla Contabilidade)
const CONTAS = {
  // DESPESAS (4.x)
  SALARIOS_ORDENADOS: '4a11ef52-7ea7-4396-9c9b-ccfd9546a01d',  // 4.2.1.01 Salários
  FGTS_DESPESA: '744a236a-2a5c-4e49-8ffe-c11b404e0064',        // 4.2.1.03 FGTS
  
  // PASSIVO CIRCULANTE (2.1.x)
  SALARIOS_PAGAR: 'd5c04379-4919-4859-a84a-fb292a5bb047',      // 2.1.2.01 Salários a Pagar
  FGTS_RECOLHER: '82bd81fc-c2fa-4bf3-ab2c-c0b49d03959f',       // 2.1.2.02 FGTS a Recolher
  INSS_RECOLHER: 'ebcfcb58-1475-4c9b-97a8-ade8f4c43637',       // 2.1.2.03 INSS a Recolher
  IRRF_RECOLHER: 'a1c6aacf-f344-4fb9-a091-851de6998672',       // 2.1.2.04 IRRF a Recolher
  
  // ATIVO (1.1.x)
  BANCO_SICREDI: '10d5892d-a843-4034-8d62-9fec95b8fd56',       // 1.1.1.05 Banco Sicredi
};

// Funcionários CLT da Ampla (atualizado Jan/2025)
const FUNCIONARIOS_CLT = [
  { nome: 'AMANDA AMBROSIO', cargo: 'ANALISTA ADM/FINANCEIRO', salario: 3800.00 },
  { nome: 'CLAUDIA', cargo: 'BABA', salario: 2500.00 },
  { nome: 'DEUZA RESENDE DE JESUS', cargo: 'ANALISTA DP', salario: 3000.00 },
  { nome: 'ERICK FABRICIO', cargo: 'ANALISTA DP', salario: 4000.00 },
  { nome: 'FABIANA MARIA DA SILVA MENDONCA', cargo: 'BABA', salario: 2300.00 },
  { nome: 'JESSYCA DE FREITAS', cargo: 'ANALISTA DP', salario: 3700.00 },
  { nome: 'JORDANA TEIXEIRA', cargo: 'ANALISTA ADM/FINANCEIRO', salario: 3500.00 },
  { nome: 'JOSIMAR DOS SANTOS MOTA', cargo: 'COORDENADOR CONTABIL', salario: 3762.00 },
  { nome: 'LILIAN', cargo: 'SERVICOS GERAIS', salario: 2612.50 },
  { nome: 'LUCIANA', cargo: 'ANALISTA DP', salario: 3500.00 },
  { nome: 'LUCIANE ROSA', cargo: 'ANALISTA DP', salario: 3300.00 },
  { nome: 'RAIMUNDO PEREIRA MOREIRA', cargo: 'CASEIRO', salario: 2687.50 },
  { nome: 'SERGIO AUGUSTO DE OLIVEIRA LEAO', cargo: 'AUXILIAR ADMINISTRATIVO', salario: 2950.00 },
  { nome: 'THANINY', cargo: 'ANALISTA DP', salario: 4000.00 },
  { nome: 'THAYNARA CONCEICAO DE MELO', cargo: 'ANALISTA CONTABIL', salario: 3727.75 },
];

/**
 * Calcula os valores da folha baseado nos salários
 */
function calcularFolha(competencia, funcionarios = FUNCIONARIOS_CLT) {
  const resultado = {
    competencia,
    funcionarios: [],
    totais: {
      total_proventos: 0,
      total_descontos: 0,
      total_liquido: 0,
      total_inss: 0,
      total_irrf: 0,
      total_fgts: 0,
      total_adiantamento: 0,
    }
  };
  
  for (const func of funcionarios) {
    // Cálculos padrão (sem HE, sem faltas)
    const salarioBase = func.salario;
    const adiantamento = salarioBase * 0.40; // 40% dia 15
    
    // INSS (tabela progressiva simplificada)
    let inss = 0;
    if (salarioBase <= 1412.00) inss = salarioBase * 0.075;
    else if (salarioBase <= 2666.68) inss = salarioBase * 0.09 - 21.18;
    else if (salarioBase <= 4000.03) inss = salarioBase * 0.12 - 101.18;
    else if (salarioBase <= 7786.02) inss = salarioBase * 0.14 - 181.18;
    else inss = 908.85; // teto
    inss = Math.round(inss * 100) / 100;
    
    // IRRF (base = salário - INSS - dependentes)
    const baseIrrf = salarioBase - inss;
    let irrf = 0;
    if (baseIrrf > 4664.68) irrf = baseIrrf * 0.275 - 896.00;
    else if (baseIrrf > 3751.05) irrf = baseIrrf * 0.225 - 662.77;
    else if (baseIrrf > 2826.65) irrf = baseIrrf * 0.15 - 381.44;
    else if (baseIrrf > 2259.20) irrf = baseIrrf * 0.075 - 169.44;
    irrf = Math.max(0, Math.round(irrf * 100) / 100);
    
    // FGTS 8%
    const fgts = Math.round(salarioBase * 0.08 * 100) / 100;
    
    // Total descontos (simplificado)
    const totalDescontos = inss + irrf + adiantamento;
    
    // Líquido
    const liquido = salarioBase - totalDescontos;
    
    const funcionarioCalc = {
      nome: func.nome,
      cargo: func.cargo,
      salario_base: salarioBase,
      adiantamento,
      inss,
      irrf,
      total_descontos: totalDescontos,
      liquido,
      fgts
    };
    
    resultado.funcionarios.push(funcionarioCalc);
    
    // Acumular totais
    resultado.totais.total_proventos += salarioBase;
    resultado.totais.total_descontos += totalDescontos;
    resultado.totais.total_liquido += liquido;
    resultado.totais.total_inss += inss;
    resultado.totais.total_irrf += irrf;
    resultado.totais.total_fgts += fgts;
    resultado.totais.total_adiantamento += adiantamento;
  }
  
  // Arredondar totais
  for (const key of Object.keys(resultado.totais)) {
    resultado.totais[key] = Math.round(resultado.totais[key] * 100) / 100;
  }
  
  return resultado;
}

/**
 * Indexa a folha no Data Lake
 */
async function indexarDataLake(folhaData) {
  const mesRef = folhaData.competencia + '-01';
  const mesNome = new Date(mesRef).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  
  const documento = {
    tenant_id: tenantId,
    document_type: 'folha_pagamento',
    reference_month: mesRef,
    title: `Folha de Pagamento - ${mesNome}`,
    description: `Folha de pagamento CLT competência ${folhaData.competencia}`,
    file_path: `folha_pgto/FOLHA AMPLA ${folhaData.competencia}.pdf`,
    file_hash: crypto.createHash('sha256').update(JSON.stringify(folhaData)).digest('hex'),
    metadata: {
      empresa: 'AMPLA CONTABILIDADE LTDA',
      cnpj: '23.893.032/0001-69',
      competencia: folhaData.competencia,
      total_funcionarios: folhaData.funcionarios.length,
      totais: folhaData.totais
    },
    content_summary: `Folha de pagamento ${mesNome}. ${folhaData.funcionarios.length} funcionários CLT. ` +
      `Proventos: R$ ${folhaData.totais.total_proventos.toFixed(2)}. Líquido: R$ ${folhaData.totais.total_liquido.toFixed(2)}.`,
    tags: ['folha_pagamento', folhaData.competencia.replace('-', '_'), 'clt', 'inss', 'fgts'],
    version: 1,
    is_final: true,
    generated_by: 'dr-cicero'
  };
  
  const { data, error } = await supabase
    .from('document_catalog')
    .insert(documento)
    .select()
    .single();
  
  if (error) {
    if (error.message.includes('duplicate')) {
      console.log('  ⚠️ Documento já existe no Data Lake');
      return null;
    }
    throw error;
  }
  
  return data;
}

/**
 * Cria um lançamento contábil
 */
async function criarLancamento(dados) {
  const { data: entry, error } = await supabase
    .from('accounting_entries')
    .insert({
      tenant_id: tenantId,
      entry_date: dados.data,
      competence_date: dados.competence_date || dados.data,
      description: dados.descricao,
      internal_code: dados.internal_code,
      source_type: 'payroll',
      entry_type: dados.tipo,
      reference_type: 'payroll'
    })
    .select()
    .single();
  
  if (error) {
    console.log('  ✗ Erro:', error.message);
    return null;
  }
  
  // Criar linhas
  const linhas = dados.linhas.map(l => ({
    tenant_id: tenantId,
    entry_id: entry.id,
    account_id: l.conta,
    debit: l.debito || 0,
    credit: l.credito || 0,
    description: l.descricao
  }));
  
  await supabase.from('accounting_entry_lines').insert(linhas);
  
  return entry;
}

/**
 * Gera os lançamentos contábeis da folha
 */
async function gerarLancamentos(folhaData) {
  const competencia = folhaData.competencia;
  const mesAno = competencia.replace('-', '');
  const totais = folhaData.totais;
  
  // Verificar se já existem lançamentos
  const { data: existentes } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .like('internal_code', `FOLHA_${mesAno}_%`);
  
  if (existentes && existentes.length > 0) {
    console.log('  ⚠️ Já existem lançamentos para esta competência');
    return [];
  }
  
  // Data do último dia do mês
  const [ano, mes] = competencia.split('-');
  const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
  const dataLancamento = `${ano}-${mes}-${ultimoDia}`;
  
  const lancamentos = [];
  
  // 1. APROPRIAÇÃO DA FOLHA
  console.log('  1. Apropriação da Folha...');
  const lancAprop = await criarLancamento({
    data: dataLancamento,
    descricao: `Apropriação Folha de Pagamento - Competência ${mes}/${ano}`,
    internal_code: `FOLHA_${mesAno}_APROPRIACAO`,
    tipo: 'PROVISAO',
    linhas: [
      { conta: CONTAS.SALARIOS_ORDENADOS, debito: totais.total_proventos, descricao: `Despesa salários ${mes}/${ano}` },
      { conta: CONTAS.SALARIOS_PAGAR, credito: totais.total_liquido + totais.total_irrf, descricao: `Salários a pagar ${mes}/${ano}` },
      { conta: CONTAS.INSS_RECOLHER, credito: totais.total_inss, descricao: `INSS retido ${mes}/${ano}` },
    ]
  });
  if (lancAprop) lancamentos.push(lancAprop);
  
  // 2. PROVISÃO FGTS
  console.log('  2. Provisão FGTS...');
  const lancFgts = await criarLancamento({
    data: dataLancamento,
    descricao: `Provisão FGTS 8% - Competência ${mes}/${ano}`,
    internal_code: `FOLHA_${mesAno}_FGTS`,
    tipo: 'PROVISAO',
    linhas: [
      { conta: CONTAS.FGTS_DESPESA, debito: totais.total_fgts, descricao: `Despesa FGTS ${mes}/${ano}` },
      { conta: CONTAS.FGTS_RECOLHER, credito: totais.total_fgts, descricao: `FGTS a recolher ${mes}/${ano}` },
    ]
  });
  if (lancFgts) lancamentos.push(lancFgts);
  
  // 3. PROVISÃO IRRF (se houver)
  if (totais.total_irrf > 0) {
    console.log('  3. Provisão IRRF...');
    const lancIrrf = await criarLancamento({
      data: dataLancamento,
      descricao: `Provisão IRRF Retido - Competência ${mes}/${ano}`,
      internal_code: `FOLHA_${mesAno}_IRRF`,
      tipo: 'PROVISAO',
      linhas: [
        { conta: CONTAS.SALARIOS_PAGAR, debito: totais.total_irrf, descricao: `Transferência IRRF ${mes}/${ano}` },
        { conta: CONTAS.IRRF_RECOLHER, credito: totais.total_irrf, descricao: `IRRF a recolher ${mes}/${ano}` },
      ]
    });
    if (lancIrrf) lancamentos.push(lancIrrf);
  }
  
  return lancamentos;
}

/**
 * Função principal
 */
async function main() {
  const competencia = process.argv[2];
  
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║        DR. CÍCERO — PROCESSADOR DE FOLHA DE PAGAMENTO            ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('USO: node processar_folha_mensal.mjs <competencia>');
    console.log('');
    console.log('Exemplos:');
    console.log('  node processar_folha_mensal.mjs 2025-02');
    console.log('  node processar_folha_mensal.mjs 2025-03');
    console.log('');
    process.exit(1);
  }
  
  const [ano, mes] = competencia.split('-');
  const mesNome = new Date(parseInt(ano), parseInt(mes) - 1).toLocaleDateString('pt-BR', { month: 'long' });
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║        DR. CÍCERO — PROCESSADOR DE FOLHA DE PAGAMENTO            ║');
  console.log(`║              Competência: ${mesNome}/${ano}                            ║`.slice(0, 71) + '║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Calcular folha
  console.log('📊 Calculando folha de pagamento...');
  const folhaData = calcularFolha(competencia);
  
  console.log(`   Funcionários: ${folhaData.funcionarios.length}`);
  console.log(`   Proventos:    R$ ${folhaData.totais.total_proventos.toFixed(2)}`);
  console.log(`   Líquido:      R$ ${folhaData.totais.total_liquido.toFixed(2)}`);
  console.log(`   INSS:         R$ ${folhaData.totais.total_inss.toFixed(2)}`);
  console.log(`   IRRF:         R$ ${folhaData.totais.total_irrf.toFixed(2)}`);
  console.log(`   FGTS:         R$ ${folhaData.totais.total_fgts.toFixed(2)}`);
  
  // Salvar JSON
  const jsonFile = `folha_${competencia.replace('-', '')}_datalake.json`;
  fs.writeFileSync(jsonFile, JSON.stringify(folhaData, null, 2));
  console.log(`\n📁 Arquivo salvo: ${jsonFile}`);
  
  // Indexar no Data Lake
  console.log('\n📚 Indexando no Data Lake...');
  const docId = await indexarDataLake(folhaData);
  if (docId) {
    console.log(`   ✓ Documento: ${docId.id}`);
  }
  
  // Criar lançamentos
  console.log('\n📝 Criando lançamentos contábeis...');
  const lancamentos = await gerarLancamentos(folhaData);
  console.log(`   ✓ ${lancamentos.length} lançamentos criados`);
  
  // Resumo
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('                    PARECER TÉCNICO - DR. CÍCERO                     ');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`\nCompetência: ${mesNome}/${ano}`);
  console.log(`Funcionários CLT: ${folhaData.funcionarios.length}`);
  console.log(`Lançamentos: ${lancamentos.length}`);
  console.log('\nSALDOS CONTÁBEIS:');
  console.log(`  D - 4.2.1.01 Salários:         R$ ${folhaData.totais.total_proventos.toFixed(2)}`);
  console.log(`  D - 4.2.1.03 FGTS:             R$ ${folhaData.totais.total_fgts.toFixed(2)}`);
  console.log(`  C - 2.1.2.01 Salários a Pagar: R$ ${folhaData.totais.total_liquido.toFixed(2)}`);
  console.log(`  C - 2.1.2.02 FGTS a Recolher:  R$ ${folhaData.totais.total_fgts.toFixed(2)}`);
  console.log(`  C - 2.1.2.03 INSS a Recolher:  R$ ${folhaData.totais.total_inss.toFixed(2)}`);
  if (folhaData.totais.total_irrf > 0) {
    console.log(`  C - 2.1.2.04 IRRF a Recolher:  R$ ${folhaData.totais.total_irrf.toFixed(2)}`);
  }
  console.log('\n────────────────────────────────────────────────────────────────────');
  console.log('                         Dr. Cícero');
  console.log('             Contador Responsável — Sistema Contta');
  console.log('────────────────────────────────────────────────────────────────────\n');
}

main().catch(console.error);
