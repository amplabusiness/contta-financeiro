# 📋 SOLUÇÃO: Reclassificação de INSS e IRRF como Passivos

**Data:** 26 de Dezembro de 2025  
**Status:** ✅ Implementado  
**Consultado com:** Agente Contador

## 🎯 Problema Identificado

INSS e IRRF descontados do funcionário estavam sendo classificados como **Despesas**, quando na verdade deveriam ser **Obrigações a Recolher (Passivos)**.

### ❌ Forma Incorreta (Anterior):
```
Despesa: INSS Retido - R$ 300,00
Despesa: IRRF Retido - R$ 150,00
```

### ✅ Forma Correta (Novo):
```
Passivo: INSS a Recolher - R$ 300,00
Passivo: IRRF a Recolher - R$ 150,00
```

## 📚 Fundamentação Contábil

A empresa **não é donona dos valores retidos**, apenas atua como **intermediária**:

- **Despesa Real:** Salário Bruto (R$ 3.000,00) - é o custo da mão de obra para a empresa
- **Repasse:** INSS (R$ 300,00) - valor que será repassado ao INSS
- **Repasse:** IRRF (R$ 150,00) - valor que será repassado à Receita Federal
- **Líquido para o funcionário:** Salário Bruto - Descontos = R$ 2.550,00

## 📊 Estrutura Correta de Lançamentos

### 1️⃣ Lançamento de Provisão (Competência)

Quando a folha de pagamento é fechada:

```
Débito  (D) - Despesa com Salários e Encargos (Resultado)
             Código: 3.x.xx | Valor: R$ 3.000,00 (BRUTO)

Crédito (C) - Salários e Ordenados a Pagar (Passivo)
             Código: 2.1.2.01 | Valor: R$ 2.550,00 (LÍQUIDO)

Crédito (C) - INSS a Recolher (Passivo)
             Código: 2.1.2.02 | Valor: R$ 300,00

Crédito (C) - IRRF a Recolher (Passivo)
             Código: 2.1.2.03 | Valor: R$ 150,00
```

**Totalização:** D: R$ 3.000,00 = C: R$ 3.000,00 ✅

### 2️⃣ Lançamento do Pagamento ao Funcionário

Quando a empresa paga o salário líquido:

```
Débito  (D) - Salários e Ordenados a Pagar (Passivo)
             Código: 2.1.2.01 | Valor: R$ 2.550,00

Crédito (C) - Banco/Caixa (Ativo)
             Código: 1.1.1.01 | Valor: R$ 2.550,00
```

### 3️⃣ Lançamento do Recolhimento de INSS ao INSS

Quando a empresa recolhe o INSS:

```
Débito  (D) - INSS a Recolher (Passivo)
             Código: 2.1.2.02 | Valor: R$ 300,00

Crédito (C) - Banco/Caixa (Ativo)
             Código: 1.1.1.01 | Valor: R$ 300,00
```

### 4️⃣ Lançamento do Recolhimento de IRRF à Receita Federal

Quando a empresa recolhe o IRRF:

```
Débito  (D) - IRRF a Recolher (Passivo)
             Código: 2.1.2.03 | Valor: R$ 150,00

Crédito (C) - Banco/Caixa (Ativo)
             Código: 1.1.1.01 | Valor: R$ 150,00
```

## 📋 Contas Contábeis Configuradas

✅ **Já existem no sistema:**

| Código | Nome | Tipo | Finalidade |
|--------|------|------|-----------|
| 2.1.2.01 | Salários e Ordenados a Pagar | Passivo | Valor líquido a pagar aos funcionários |
| 2.1.2.02 | INSS a Recolher | Passivo | INSS retido na folha |
| 2.1.2.03 | IRRF a Recolher | Passivo | IRRF retido na folha |

## 🔄 Próximas Implementações

### 1. Atualizar Hook `useAccounting`

Adicionar método para registrar provisão de folha com estrutura correta:

```typescript
async function registrarFolhaPagamento(folha: FolhaPagamento) {
  // Agrupa por funcionário:
  // Total Bruto, Total INSS, Total IRRF, Total Líquido
  
  const entries = [];
  
  // Entrada contábil de provisão
  entries.push({
    description: `Folha de Pagamento - ${mes}/${ano}`,
    entry_date: dataFolha,
    reference_type: 'payroll',
    lines: [
      // Débito: Despesa
      { account_code: '3.x.xx', debit: totalBruto, account_name: '...' },
      // Crédito: Salários a Pagar
      { account_code: '2.1.2.01', credit: totalLíquido, account_name: '...' },
      // Crédito: INSS a Recolher
      { account_code: '2.1.2.02', credit: totalINSS, account_name: '...' },
      // Crédito: IRRF a Recolher
      { account_code: '2.1.2.03', credit: totalIRRF, account_name: '...' }
    ]
  });
  
  return entries;
}
```

### 2. Interface de Folha de Pagamento

Criar página/modal específica para:
- Entrada de dados de folha
- Cálculo automático de INSS e IRRF
- Geração de lançamentos contábeis corretos
- Registro de pagamentos (baixa de passivos)

### 3. Relatórios Impactados

Atualizar DRE para:
- ✅ Mostrar apenas despesa de salários bruto
- ✅ Não incluir INSS/IRRF como despesas
- ✅ Balancete: mostrar passivos a pagar

## 📈 Impacto nos Relatórios

### ❌ ANTES (Incorreto):
```
DRE:
Despesa com Salários ............ R$ 3.000,00
Despesa com INSS ................ R$ 300,00
Despesa com IRRF ................ R$ 150,00
TOTAL DE DESPESAS ............... R$ 3.450,00
```

### ✅ DEPOIS (Correto):
```
DRE:
Despesa com Salários ............ R$ 3.000,00
TOTAL DE DESPESAS ............... R$ 3.000,00

Balanço:
PASSIVO:
  Salários a Pagar .............. R$ 2.550,00
  INSS a Recolher ............... R$ 300,00
  IRRF a Recolher ............... R$ 150,00
```

## ✅ Checklist de Implementação

- [x] Verificar estrutura de contas existentes
- [x] Confirmar contas 2.1.2.01, 2.1.2.02, 2.1.2.03 criadas
- [x] Documentar padrão de lançamento
- [ ] Atualizar hook useAccounting
- [ ] Criar interface de folha de pagamento
- [ ] Testar lançamentos com dados de exemplo
- [ ] Atualizar formulário de entrada de folha
- [ ] Migrar folhas existentes (se houver)
- [ ] Validar DRE e Balanço
- [ ] Deploy em produção

## 🔗 Relacionadas

- [src/hooks/useAccounting.ts](src/hooks/useAccounting.ts) - Hook a ser atualizado
- [src/pages/Expenses.tsx](src/pages/Expenses.tsx) - Controle de despesas
- [Employees.tsx](Employees.tsx) - Gestão de funcionários

---

**Consultado com:** Princípios de Contabilidade ABNT/CPC  
**Próxima revisão:** Após implementação da interface de folha
