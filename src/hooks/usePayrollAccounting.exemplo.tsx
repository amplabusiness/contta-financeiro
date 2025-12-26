/**
 * Exemplo de Uso - Hook usePayrollAccounting
 * 
 * Este exemplo mostra como usar o novo hook para registrar folha de pagamento
 * com a contabilidade correta.
 */

import { usePayrollAccounting, FolhaPagamento } from '@/hooks/usePayrollAccounting';
import { toast } from 'sonner';

// Exemplo em um componente React:
export function ExemploRegistroFolha() {
  const { 
    registrarFolhaProvisao,
    registrarPagamentoSalarios,
    registrarRecolhimentoINSS,
    registrarRecolhimentoIRRF
  } = usePayrollAccounting();

  // Dados de exemplo
  const folhaExemplo: FolhaPagamento = {
    mes: 12,
    ano: 2025,
    dataFolha: '2025-12-31',
    funcionarios: [
      {
        employeeId: 'emp_001',
        employeeName: 'João Silva',
        salarioBruto: 3000.00,
        inssRetido: 300.00,      // 10%
        irrfRetido: 150.00,       // 5%
        salarioLiquido: 2550.00   // 3000 - 300 - 150
      },
      {
        employeeId: 'emp_002',
        employeeName: 'Maria Santos',
        salarioBruto: 2500.00,
        inssRetido: 250.00,       // 10%
        irrfRetido: 125.00,       // 5%
        salarioLiquido: 2125.00   // 2500 - 250 - 125
      }
    ]
  };

  // 1️⃣ STEP 1: Registrar provisão da folha (na competência)
  async function handleRegistrarFolha() {
    console.log('📝 Registrando provisão de folha...');
    
    const result = await registrarFolhaProvisao(folhaExemplo);
    
    if (result.success) {
      console.log('✅ Provisão registrada. Entry ID:', result.entryId);
      
      // Lançamento contábil criado:
      // D - Despesa com Salários e Encargos ................... R$ 5.500,00
      // C - Salários a Pagar ................................... R$ 4.675,00
      // C - INSS a Recolher .................................... R$ 550,00
      // C - IRRF a Recolher .................................... R$ 275,00
      
      toast.success('Folha provisionada com sucesso!');
    } else {
      console.error('❌ Erro:', result.error);
      toast.error('Erro ao registrar folha: ' + result.error);
    }
  }

  // 2️⃣ STEP 2: Registrar pagamento dos salários (quando pagar)
  async function handlePagarSalarios() {
    console.log('💰 Registrando pagamento de salários...');
    
    const totalLiquido = folhaExemplo.funcionarios.reduce((sum, f) => sum + f.salarioLiquido, 0);
    
    const result = await registrarPagamentoSalarios({
      folhaReferenceId: `payroll_202512`,
      dataPagamento: '2026-01-10',  // Pago no próximo mês
      totalPago: totalLiquido,      // R$ 4.675,00
      bankAccountId: 'bank_main'     // ID da conta bancária
    });
    
    if (result.success) {
      console.log('✅ Salários pagos. Entry ID:', result.entryId);
      
      // Lançamento contábil:
      // D - Salários a Pagar ......... R$ 4.675,00
      // C - Banco .................... R$ 4.675,00
      
      toast.success('Pagamento de salários registrado!');
    } else {
      console.error('❌ Erro:', result.error);
      toast.error('Erro ao registrar pagamento: ' + result.error);
    }
  }

  // 3️⃣ STEP 3: Registrar recolhimento de INSS (pode ser depois)
  async function handleRecolherINSS() {
    console.log('🏛️ Registrando recolhimento de INSS...');
    
    const totalINSS = folhaExemplo.funcionarios.reduce((sum, f) => sum + f.inssRetido, 0);
    
    const result = await registrarRecolhimentoINSS({
      folhaReferenceId: `payroll_202512`,
      dataRecolhimento: '2026-01-15',  // Pode ser em outro dia
      totalINSS: totalINSS,              // R$ 550,00
      bankAccountId: 'bank_main'
    });
    
    if (result.success) {
      console.log('✅ INSS recolhido. Entry ID:', result.entryId);
      
      // Lançamento contábil:
      // D - INSS a Recolher .......... R$ 550,00
      // C - Banco .................... R$ 550,00
      
      toast.success('Recolhimento de INSS registrado!');
    } else {
      console.error('❌ Erro:', result.error);
      toast.error('Erro ao registrar recolhimento: ' + result.error);
    }
  }

  // 4️⃣ STEP 4: Registrar recolhimento de IRRF
  async function handleRecolherIRRF() {
    console.log('🏛️ Registrando recolhimento de IRRF...');
    
    const totalIRRF = folhaExemplo.funcionarios.reduce((sum, f) => sum + f.irrfRetido, 0);
    
    const result = await registrarRecolhimentoIRRF({
      folhaReferenceId: `payroll_202512`,
      dataRecolhimento: '2026-01-20',  // Pode ser em outro dia
      totalIRRF: totalIRRF,              // R$ 275,00
      bankAccountId: 'bank_main'
    });
    
    if (result.success) {
      console.log('✅ IRRF recolhido. Entry ID:', result.entryId);
      
      // Lançamento contábil:
      // D - IRRF a Recolher ......... R$ 275,00
      // C - Banco ................... R$ 275,00
      
      toast.success('Recolhimento de IRRF registrado!');
    } else {
      console.error('❌ Erro:', result.error);
      toast.error('Erro ao registrar recolhimento: ' + result.error);
    }
  }

  return (
    <div className="p-4">
      <h2>Exemplo: Registro de Folha de Pagamento</h2>
      
      <div className="mt-4 space-y-2">
        <button onClick={handleRegistrarFolha}>
          1️⃣ Registrar Provisão de Folha
        </button>
        
        <button onClick={handlePagarSalarios} disabled>
          2️⃣ Pagar Salários (após pagar aos funcionários)
        </button>
        
        <button onClick={handleRecolherINSS} disabled>
          3️⃣ Recolher INSS (pode ser depois)
        </button>
        
        <button onClick={handleRecolherIRRF} disabled>
          4️⃣ Recolher IRRF (pode ser depois)
        </button>
      </div>
    </div>
  );
}

/**
 * FLUXO CONTÁBIL COMPLETO:
 * 
 * DIA 31 DE DEZEMBRO (Competência):
 * ════════════════════════════════════════════════════════════
 * D - Despesa com Salários ..................... R$ 5.500,00
 * C - Salários a Pagar ......................... R$ 4.675,00
 * C - INSS a Recolher .......................... R$ 550,00
 * C - IRRF a Recolher .......................... R$ 275,00
 * 
 * DIA 10 DE JANEIRO (Pagamento):
 * ════════════════════════════════════════════════════════════
 * D - Salários a Pagar ......................... R$ 4.675,00
 * C - Banco ................................... R$ 4.675,00
 * 
 * DIA 15 DE JANEIRO (Recolhimento INSS):
 * ════════════════════════════════════════════════════════════
 * D - INSS a Recolher .......................... R$ 550,00
 * C - Banco ................................... R$ 550,00
 * 
 * DIA 20 DE JANEIRO (Recolhimento IRRF):
 * ════════════════════════════════════════════════════════════
 * D - IRRF a Recolher .......................... R$ 275,00
 * C - Banco ................................... R$ 275,00
 * 
 * RESULTADO NA DRE (Dezembro):
 * ════════════════════════════════════════════════════════════
 * Despesa com Salários ......................... (R$ 5.500,00)
 * 
 * SALDO NO BALANÇO (31 Dez):
 * ════════════════════════════════════════════════════════════
 * Ativo:
 *   Banco (após janeiro) ............. R$ XXX,XX
 * 
 * Passivo:
 *   Salários a Pagar ................. R$ 4.675,00
 *   INSS a Recolher .................. R$ 550,00
 *   IRRF a Recolher .................. R$ 275,00
 * 
 * Total Passivo ...................... R$ 5.500,00 ✅ (= Despesa do período)
 */

export default ExemploRegistroFolha;
