/**
 * 📅 TESTE: Filtro de Funcionários por Competência
 * Dr. Cícero - Contador Responsável
 * 
 * Demonstra a lógica de filtro por competência.
 * 
 * Uso: node test_competencia.mjs 2025-02
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// ============================================================================
// FUNÇÕES DE COMPETÊNCIA (CÓPIA DO SERVICE PARA USO STANDALONE)
// ============================================================================

function getCompetenciaDates(ano, mes) {
  const competencia = `${ano}-${String(mes).padStart(2, '0')}`;
  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  
  return { competencia, inicioMes, fimMes };
}

function parseCompetencia(competencia) {
  const clean = competencia.replace('-', '');
  if (clean.length === 6) {
    return {
      ano: parseInt(clean.substring(0, 4)),
      mes: parseInt(clean.substring(4, 6))
    };
  }
  throw new Error(`Formato inválido: ${competencia}`);
}

function formatCompetencia(ano, mes) {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${meses[mes - 1]}/${ano}`;
}

function getEmployeeStatusInCompetencia(employee, competencia) {
  const { inicioMes, fimMes } = getCompetenciaDates(competencia.ano, competencia.mes);
  
  const admissao = employee.hire_date;
  const demissao = employee.termination_date;
  
  if (!admissao) return 'nao_admitido';
  if (admissao > fimMes) return 'nao_admitido';
  if (demissao && demissao < inicioMes) return 'demitido';
  
  return 'ativo';
}

function filterEmployeesByCompetencia(employees, competencia) {
  const ativos = [];
  const naoAdmitidos = [];
  const demitidos = [];
  
  for (const emp of employees) {
    const status = getEmployeeStatusInCompetencia(emp, competencia);
    
    switch (status) {
      case 'ativo': ativos.push(emp); break;
      case 'nao_admitido': naoAdmitidos.push(emp); break;
      case 'demitido': demitidos.push(emp); break;
    }
  }
  
  const cltAtivos = ativos.filter(e => e.contract_type === 'clt');
  const pjAtivos = ativos.filter(e => e.contract_type === 'pj' || e.contract_type === 'mei');
  
  const valorCLT = cltAtivos.reduce((sum, e) => sum + (e.official_salary || 0), 0);
  const valorPJ = pjAtivos.reduce((sum, e) => sum + (e.unofficial_salary || 0), 0);
  
  return {
    ativos: ativos.sort((a, b) => a.name.localeCompare(b.name)),
    naoAdmitidos: naoAdmitidos.sort((a, b) => a.name.localeCompare(b.name)),
    demitidos: demitidos.sort((a, b) => a.name.localeCompare(b.name)),
    resumo: {
      totalAtivos: ativos.length,
      totalNaoAdmitidos: naoAdmitidos.length,
      totalDemitidos: demitidos.length,
      totalCLT: cltAtivos.length,
      totalPJ: pjAtivos.length,
      valorCLT,
      valorPJ,
      valorTotal: valorCLT + valorPJ
    }
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Pegar competência do argumento ou usar padrão
  const arg = process.argv[2] || '2025-02';
  const competencia = parseCompetencia(arg);
  const { fimMes, inicioMes } = getCompetenciaDates(competencia.ano, competencia.mes);
  
  console.log('═'.repeat(100));
  console.log(`📅 FILTRO POR COMPETÊNCIA: ${formatCompetencia(competencia.ano, competencia.mes)}`);
  console.log('═'.repeat(100));
  console.log(`   Início do mês: ${inicioMes}`);
  console.log(`   Fim do mês: ${fimMes}`);
  console.log('');
  
  // Buscar todos os funcionários
  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .order('name');
  
  if (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
  
  // Filtrar por competência
  const result = filterEmployeesByCompetencia(employees, competencia);
  
  // Exibir resultados
  console.log(`✅ FUNCIONÁRIOS ATIVOS (${result.resumo.totalAtivos}):`);
  console.log('─'.repeat(100));
  console.log('Nome'.padEnd(30) + 'Tipo'.padEnd(6) + 'Admissão'.padEnd(14) + 'Depto'.padEnd(20) + 'Valor');
  console.log('─'.repeat(100));
  
  for (const emp of result.ativos) {
    const tipo = emp.contract_type?.toUpperCase() || '-';
    const valor = tipo === 'CLT' ? (emp.official_salary || 0) : (emp.unofficial_salary || 0);
    console.log(
      emp.name.substring(0, 29).padEnd(30) +
      tipo.padEnd(6) +
      (emp.hire_date || '-').padEnd(14) +
      (emp.department || '-').substring(0, 19).padEnd(20) +
      'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    );
  }
  
  if (result.naoAdmitidos.length > 0) {
    console.log('');
    console.log(`⚠️  NÃO ADMITIDOS ATÉ ${fimMes} (${result.resumo.totalNaoAdmitidos}):`);
    console.log('─'.repeat(100));
    for (const emp of result.naoAdmitidos) {
      console.log(`   ${emp.name.padEnd(30)} Admissão: ${emp.hire_date || 'N/A'}`);
    }
  }
  
  if (result.demitidos.length > 0) {
    console.log('');
    console.log(`❌ DEMITIDOS ANTES DE ${inicioMes} (${result.resumo.totalDemitidos}):`);
    console.log('─'.repeat(100));
    for (const emp of result.demitidos) {
      console.log(`   ${emp.name.padEnd(30)} Demissão: ${emp.termination_date || 'N/A'}`);
    }
  }
  
  // Resumo
  console.log('');
  console.log('═'.repeat(100));
  console.log('📊 RESUMO DA FOLHA');
  console.log('═'.repeat(100));
  console.log(`   CLT:  ${result.resumo.totalCLT} funcionários × R$ ${result.resumo.valorCLT.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   PJ:   ${result.resumo.totalPJ} funcionários × R$ ${result.resumo.valorPJ.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log('─'.repeat(100));
  console.log(`   TOTAL: ${result.resumo.totalAtivos} funcionários × R$ ${result.resumo.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log('═'.repeat(100));
  
  console.log('');
  console.log('✅ Use: node test_competencia.mjs YYYY-MM para testar outras competências');
  console.log('   Exemplos: node test_competencia.mjs 2025-01');
  console.log('             node test_competencia.mjs 2025-06');
  console.log('             node test_competencia.mjs 2025-12');
}

main().catch(console.error);
