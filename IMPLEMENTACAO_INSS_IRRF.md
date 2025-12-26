# 🎯 GUIA DE IMPLEMENTAÇÃO: Reclassificação de INSS e IRRF como Passivos

**Data:** 26 de Dezembro de 2025  
**Status:** ✅ Pronto para Implementação  
**Arquivos Criados:** 3 novos arquivos de suporte

---

## 📋 Resumo Executivo

Foi identificado um erro contábil crítico: **INSS e IRRF retidos do funcionário estão sendo classificados como Despesas**, quando na verdade devem ser **Obrigações a Recolher (Passivos)**.

### ✅ Solução Implementada:
1. **novo hook**: `usePayrollAccounting.ts` - registra folha corretamente
2. **novo exemplo**: `usePayrollAccounting.exemplo.tsx` - demonstra uso prático
3. **novo guia**: `SOLUCAO_INSS_IRRF_PASSIVOS.md` - documentação completa

---

## 🔍 O Problema Contábil

### ❌ ANTES (Incorreto):
```
Despesa: Salários ........... R$ 3.000,00
Despesa: INSS Retido ....... R$ 300,00  ← ERRO! Não é despesa da empresa
Despesa: IRRF Retido ....... R$ 150,00  ← ERRO! Não é despesa da empresa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total de Despesas .......... R$ 3.450,00  ← INFLACIONADO!
```

### ✅ DEPOIS (Correto):
```
Despesa: Salários Bruto ..... R$ 3.000,00  ← Custo real da mão de obra
Passivo: Salários a Pagar ... R$ 2.550,00  ← Valor a pagar ao funcionário
Passivo: INSS a Recolher .... R$ 300,00   ← Repasse ao INSS
Passivo: IRRF a Recolher .... R$ 150,00   ← Repasse ao Fisco
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DRE: Despesa Real ........... R$ 3.000,00  ← Correto!
Balanço: Passivos ........... R$ 5.500,00  ← Obrigações a honrar
```

---

## 🏗️ Arquitetura da Solução

### 1. Hook: `usePayrollAccounting.ts`

**Arquivo:** `src/hooks/usePayrollAccounting.ts` (CRIADO)

**Funções Implementadas:**

#### `registrarFolhaProvisao(folha: FolhaPagamento)`
Registra a provisão de folha (lançamento na competência):
```typescript
const result = await registrarFolhaProvisao({
  mes: 12,
  ano: 2025,
  dataFolha: '2025-12-31',
  funcionarios: [
    {
      employeeId: 'emp_001',
      employeeName: 'João Silva',
      salarioBruto: 3000.00,
      inssRetido: 300.00,
      irrfRetido: 150.00,
      salarioLiquido: 2550.00
    }
  ]
});
```

**Lançamento Gerado:**
```
D - Despesa com Salários e Encargos ... R$ 3.000,00
C - Salários a Pagar ................... R$ 2.550,00
C - INSS a Recolher .................... R$ 300,00
C - IRRF a Recolher .................... R$ 150,00
```

#### `registrarPagamentoSalarios(params)`
Registra o pagamento aos funcionários:
```typescript
await registrarPagamentoSalarios({
  folhaReferenceId: 'payroll_202512',
  dataPagamento: '2026-01-10',
  totalPago: 2550.00,
  bankAccountId: 'bank_main'
});
```

**Lançamento Gerado:**
```
D - Salários a Pagar .... R$ 2.550,00
C - Banco ............... R$ 2.550,00
```

#### `registrarRecolhimentoINSS(params)`
Registra recolhimento de INSS ao fisco:
```typescript
await registrarRecolhimentoINSS({
  folhaReferenceId: 'payroll_202512',
  dataRecolhimento: '2026-01-15',
  totalINSS: 300.00,
  bankAccountId: 'bank_main'
});
```

**Lançamento Gerado:**
```
D - INSS a Recolher .... R$ 300,00
C - Banco .............. R$ 300,00
```

#### `registrarRecolhimentoIRRF(params)`
Registra recolhimento de IRRF à Receita Federal:
```typescript
await registrarRecolhimentoIRRF({
  folhaReferenceId: 'payroll_202512',
  dataRecolhimento: '2026-01-20',
  totalIRRF: 150.00,
  bankAccountId: 'bank_main'
});
```

**Lançamento Gerado:**
```
D - IRRF a Recolher .... R$ 150,00
C - Banco .............. R$ 150,00
```

---

### 2. Exemplo Prático: `usePayrollAccounting.exemplo.tsx`

**Arquivo:** `src/hooks/usePayrollAccounting.exemplo.tsx` (CRIADO)

Demonstra o fluxo completo com dados de exemplo:
- 2 funcionários
- Cálculos automáticos de INSS (10%) e IRRF (5%)
- 4 etapas de registro (provisão → pagamento → recolhimentos)

---

### 3. Documentação: `SOLUCAO_INSS_IRRF_PASSIVOS.md`

**Arquivo:** `SOLUCAO_INSS_IRRF_PASSIVOS.md` (CRIADO)

Contém:
- ✅ Fundação contábil completa
- ✅ Estrutura de lançamentos detalhada
- ✅ Impacto nos relatórios (DRE e Balanço)
- ✅ Checklist de implementação

---

## 🚀 Como Implementar

### Etapa 1: Adicionar Hook ao Employees.tsx

```tsx
import { usePayrollAccounting } from '@/hooks/usePayrollAccounting';

export function Employees() {
  const { registrarFolhaProvisao } = usePayrollAccounting();
  
  async function handleSavePayroll(folha) {
    // Salvar folha em nova tabela 'payrolls' ou 'folhas_pagamento'
    const { data: newPayroll } = await supabase
      .from('payrolls')
      .insert(folha)
      .select()
      .single();
    
    // Registrar lançamento contábil
    const result = await registrarFolhaProvisao({
      mes: folha.month,
      ano: folha.year,
      dataFolha: folha.due_date,
      funcionarios: folha.employees.map(emp => ({
        employeeId: emp.id,
        employeeName: emp.name,
        salarioBruto: emp.salary,
        inssRetido: emp.salary * 0.10,    // 10% padrão
        irrfRetido: emp.salary * 0.05,    // 5% padrão
        salarioLiquido: emp.salary * 0.85  // 85% líquido
      }))
    });
    
    if (result.success) {
      toast.success('Folha provisionada e lançamento contábil criado!');
    }
  }
}
```

### Etapa 2: Atualizar Interface de Pagamentos

Quando registrar pagamento de folha:

```tsx
async function handlePayPayroll(payrollId) {
  const payroll = await getPayroll(payrollId);
  
  const { registrarPagamentoSalarios } = usePayrollAccounting();
  
  const result = await registrarPagamentoSalarios({
    folhaReferenceId: payroll.reference_id,
    dataPagamento: new Date().toISOString().split('T')[0],
    totalPago: payroll.total_liquido,
    bankAccountId: selectedBankAccount
  });
  
  if (result.success) {
    await updatePayrollStatus(payrollId, 'paid');
    toast.success('Pagamento registrado!');
  }
}
```

### Etapa 3: Criar Tabela de Folhas (Se não existir)

```sql
CREATE TABLE payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  due_date DATE NOT NULL,
  competence_date DATE NOT NULL,
  reference_id VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- draft, provisioned, paid
  total_bruto DECIMAL(12,2) NOT NULL,
  total_inss DECIMAL(12,2) NOT NULL,
  total_irrf DECIMAL(12,2) NOT NULL,
  total_liquido DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payroll_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID REFERENCES payrolls(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  employee_name VARCHAR(255) NOT NULL,
  salary_bruto DECIMAL(12,2) NOT NULL,
  inss_retido DECIMAL(12,2) NOT NULL,
  irrf_retido DECIMAL(12,2) NOT NULL,
  salary_liquido DECIMAL(12,2) NOT NULL
);
```

---

## ✅ Checklist de Implementação

- [x] ✅ Identificar problema contábil
- [x] ✅ Confirmar contas 2.1.2.01, 2.1.2.02, 2.1.2.03 existem
- [x] ✅ Criar hook `usePayrollAccounting.ts`
- [x] ✅ Criar exemplo prático `usePayrollAccounting.exemplo.tsx`
- [x] ✅ Documentar solução completa
- [ ] ⏳ Atualizar `Employees.tsx` para usar o novo hook
- [ ] ⏳ Criar tabelas de folha de pagamento (se necessário)
- [ ] ⏳ Implementar interface de folha de pagamento
- [ ] ⏳ Testar com dados reais
- [ ] ⏳ Validar DRE e Balanço
- [ ] ⏳ Deploy em produção

---

## 📊 Validação: DRE e Balanço

### ✅ DRE (Dezembro 2025)
```
Receita de Serviços ................. R$ 50.000,00
(-) Despesa com Salários ............ (R$ 5.500,00)
(-) Outros Custos ................... (R$ 2.000,00)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lucro Líquido ....................... R$ 42.500,00 ✅
```

### ✅ Balanço (31 Dez 2025)
```
ATIVO
  Caixa/Banco ...................... R$ 100.000,00

PASSIVO
  Salários a Pagar ................. R$ 4.675,00
  INSS a Recolher .................. R$ 550,00
  IRRF a Recolher .................. R$ 275,00
  ────────────────────────────
  Total Passivo .................... R$ 5.500,00

PATRIMÔNIO
  Capital Social ................... R$ 94.500,00 ✅
  ────────────────────────────
  Total Patrimônio ................. R$ 94.500,00

Total Passivo + Patrimônio ......... R$ 100.000,00 ✅
```

---

## 🔗 Referências

- **Arquivo de Lógica:** `src/hooks/usePayrollAccounting.ts`
- **Exemplo de Uso:** `src/hooks/usePayrollAccounting.exemplo.tsx`
- **Documentação:** `SOLUCAO_INSS_IRRF_PASSIVOS.md`
- **Contabilidade:** Princípios CPC/ABNT para Folha de Pagamento

---

## 📞 Próximas Ações

1. **Revisar** a solução com contador/contador
2. **Implementar** interface de folha de pagamento em `Employees.tsx`
3. **Testar** com dados de exemplo
4. **Validar** nos relatórios (DRE, Balanço, Fluxo de Caixa)
5. **Deploy** em produção

---

**Status:** ✅ Pronto para Implementação
**Último Update:** 26 de Dezembro de 2025
