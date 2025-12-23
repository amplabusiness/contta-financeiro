import { supabase } from './src/integrations/supabase/client';
import employeeData from './funcionarios_para_inserir.json';

interface Employee {
  name: string;
  role: string;
  department: string;
  contract_type: string;
  official_salary: number;
  unofficial_salary: number;
  hire_date: string;
  work_area: string;
  is_active: boolean;
}

async function importEmployees() {
  console.log('🔄 Iniciando importação de funcionários...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const emp of employeeData as Employee[]) {
    try {
      console.log(`➤ Cadastrando: ${emp.name}`);
      
      const { data, error } = await supabase
        .from('employees')
        .insert([
          {
            name: emp.name,
            role: emp.role,
            department: emp.department,
            contract_type: emp.contract_type,
            official_salary: emp.official_salary,
            unofficial_salary: emp.unofficial_salary,
            hire_date: emp.hire_date,
            work_area: emp.work_area,
            is_active: emp.is_active,
          }
        ])
        .select();
      
      if (error) {
        console.error(`  ✗ Erro ao cadastrar ${emp.name}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`  ✓ ${emp.name} cadastrado com sucesso!`);
        successCount++;
      }
    } catch (error) {
      console.error(`  ✗ Erro inesperado ao cadastrar ${emp.name}:`, error);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`\n✓ Importação concluída!`);
  console.log(`  Sucessos: ${successCount}`);
  console.log(`  Erros: ${errorCount}`);
  console.log(`  Total: ${successCount + errorCount}\n`);
  
  process.exit(errorCount > 0 ? 1 : 0);
}

importEmployees().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
