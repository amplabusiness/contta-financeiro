/**
 * 🔄 Sincronizar Cadastro de Funcionários com Fichas de Empregado
 * Dr. Cícero - Contador Responsável
 * 
 * Este script:
 * 1. Remove duplicatas (mantém apenas registros com CPF)
 * 2. Atualiza dados com base nas fichas de empregado PDF
 * 3. Corrige salários e status
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// Dados das fichas de empregado
const fichas = JSON.parse(readFileSync('funcionarios_fichas_empregado.json', 'utf-8'));

// Mapear departamento baseado no cargo
function inferDepartment(role) {
  const r = (role || '').toLowerCase();
  if (r.includes('contab')) return 'Contabil';
  if (r.includes('fiscal')) return 'Fiscal';
  if (r.includes('pessoal') || r.includes('dp')) return 'DP';
  if (r.includes('financeiro')) return 'Financeiro';
  if (r.includes('administrativo')) return 'Administrativo';
  if (r.includes('coordenador')) return 'Contabil';
  if (r.includes('baba')) return 'Administrativo';
  return 'Operacional';
}

// Limpar nome (remover beneficiários concatenados)
function cleanName(name) {
  // Remover sufixos de beneficiários comuns
  const parts = name.split(/\s+(?:THEO|IGOR|ANA|ENZO)\s+/i);
  return parts[0].trim();
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔄 SINCRONIZANDO CADASTRO COM FICHAS DE EMPREGADO');
  console.log('═'.repeat(80));
  
  // 1. Buscar todos os funcionários atuais
  const { data: current, error } = await supabase
    .from('employees')
    .select('*')
    .eq('tenant_id', TENANT_ID);
  
  if (error) {
    console.error('Erro:', error.message);
    return;
  }
  
  console.log(`\n📋 Funcionários atuais no banco: ${current.length}`);
  
  // 2. Identificar duplicatas (mesmo CPF ou nome similar)
  const duplicatas = [];
  const principais = [];
  
  for (const emp of current) {
    // Se tem CPF, é principal
    if (emp.cpf) {
      principais.push(emp);
    } else {
      // Verificar se existe outro com mesmo nome (principal)
      const similar = current.find(e => 
        e.cpf && 
        e.name.toUpperCase().includes(emp.name.split(' ')[0].toUpperCase())
      );
      if (similar) {
        duplicatas.push(emp);
      } else {
        // PJ/MEI sem duplicata
        principais.push(emp);
      }
    }
  }
  
  console.log(`   Principais (manter): ${principais.length}`);
  console.log(`   Duplicatas (remover): ${duplicatas.length}`);
  
  // 3. Remover duplicatas
  if (duplicatas.length > 0) {
    console.log('\n🗑️  Removendo duplicatas...');
    for (const dup of duplicatas) {
      console.log(`   - ${dup.name} (ID: ${dup.id.substring(0,8)}...)`);
      await supabase
        .from('employees')
        .delete()
        .eq('id', dup.id);
    }
  }
  
  // 4. Atualizar com dados das fichas
  console.log('\n📝 Atualizando com dados das fichas...');
  
  for (const ficha of fichas) {
    const cpf = ficha.cpf;
    const nome = cleanName(ficha.name);
    const isAtivo = ficha.status === 'ativo';
    
    // Buscar funcionário pelo CPF
    const existing = principais.find(e => e.cpf === cpf);
    
    const updateData = {
      name: nome,
      cpf: cpf,
      role: ficha.role,
      department: inferDepartment(ficha.role),
      hire_date: ficha.hire_date,
      termination_date: ficha.termination_date || null,
      official_salary: ficha.official_salary,
      is_active: isAtivo,
      contract_type: 'clt'
    };
    
    if (existing) {
      // Atualizar existente
      console.log(`   ✏️  Atualizando: ${nome}`);
      await supabase
        .from('employees')
        .update(updateData)
        .eq('id', existing.id);
    } else {
      // Inserir novo
      console.log(`   ➕ Inserindo: ${nome}`);
      await supabase
        .from('employees')
        .insert({
          ...updateData,
          tenant_id: TENANT_ID
        });
    }
  }
  
  // 5. Verificar resultado final
  const { data: final } = await supabase
    .from('employees')
    .select('name, cpf, contract_type, hire_date, termination_date, official_salary, is_active')
    .eq('tenant_id', TENANT_ID)
    .order('name');
  
  console.log('\n' + '═'.repeat(100));
  console.log('📊 RESULTADO FINAL');
  console.log('═'.repeat(100));
  console.log(`${'Nome'.padEnd(35)} ${'CPF'.padEnd(16)} ${'Tipo'.padEnd(5)} ${'Admissão'.padEnd(12)} ${'Salário'.padEnd(12)} Ativo`);
  console.log('─'.repeat(100));
  
  let cltCount = 0, pjCount = 0, ativosCount = 0;
  
  for (const e of final) {
    const tipo = (e.contract_type || '-').toUpperCase();
    const sal = e.official_salary || 0;
    const ativo = e.is_active ? '✅' : '❌';
    
    console.log(
      `${(e.name || '-').substring(0,34).padEnd(35)} ` +
      `${(e.cpf || '-').padEnd(16)} ` +
      `${tipo.padEnd(5)} ` +
      `${(e.hire_date || '-').padEnd(12)} ` +
      `R$ ${sal.toLocaleString('pt-BR').padStart(9)} ` +
      `${ativo}`
    );
    
    if (tipo === 'CLT') cltCount++;
    else pjCount++;
    if (e.is_active) ativosCount++;
  }
  
  console.log('─'.repeat(100));
  console.log(`Total: ${final.length} funcionários (${cltCount} CLT, ${pjCount} PJ/MEI) | ${ativosCount} ativos`);
  console.log('═'.repeat(100));
}

main().catch(console.error);
