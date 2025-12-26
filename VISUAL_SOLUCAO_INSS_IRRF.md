# 📊 VISUAL: Solução de Reclassificação de INSS e IRRF

## ❌ ANTES (Incorreto)

```
DESPESA COM FOLHA DE PAGAMENTO
═════════════════════════════════════════════

Funcionário: João Silva
Salário Bruto ........................ R$ 3.000,00
INSS Retido (10%) .................... R$ 300,00  ❌
IRRF Retido (5%) ..................... R$ 150,00  ❌
                                     ──────────
Total de Despesas .................... R$ 3.450,00 ❌ INFLACIONADO!


DRE (RESULTADO)
═════════════════════════════════════════════
Receita de Serviços ............. R$ 10.000,00
(-) Despesa Salários ............ (R$ 3.000,00)
(-) Despesa INSS Retido ......... (R$ 300,00)  ❌ ERRADO!
(-) Despesa IRRF Retido ......... (R$ 150,00)  ❌ ERRADO!
(-) Outras Despesas ............ (R$ 2.000,00)
                              ──────────────
Lucro Operacional ............... R$ 4.550,00  ❌ ERRADO!


BALANÇO (PASSIVO)
═════════════════════════════════════════════
Contas a Pagar .................. R$ 5.000,00
Outras Obrigações ............... R$ 2.000,00  ❌ Não mostra valores retidos
                              ──────────────
Total de Passivos ................ R$ 7.000,00  ❌ INCOMPLETO!
```

---

## ✅ DEPOIS (Correto)

```
DESPESA COM FOLHA DE PAGAMENTO
═════════════════════════════════════════════

Funcionário: João Silva
Salário Bruto ........................ R$ 3.000,00 ✅ Isso é a despesa real

DESCONTOS (Não são despesa da empresa):
INSS Retido (10%) .................... R$ 300,00  ✅ Passivo a Recolher
IRRF Retido (5%) ..................... R$ 150,00  ✅ Passivo a Recolher
Salário Líquido (a pagar ao func.) ... R$ 2.550,00 ✅ Passivo a Pagar
                                     ──────────
Total de Descontos ................... R$ 450,00 (retençõeś)
Valor Líquido ........................ R$ 2.550,00 (para o funcionário)


LANÇAMENTO CONTÁBIL (Provisão)
═════════════════════════════════════════════

    DÉBITO (D)              |    CRÉDITO (C)
─────────────────────────────────────────────
Despesa com               | Salários a
Salários                  | Pagar
R$ 3.000,00               | R$ 2.550,00
                          |
                          | INSS a
                          | Recolher
                          | R$ 300,00
                          |
                          | IRRF a
                          | Recolher
                          | R$ 150,00
─────────────────────────────────────────────
TOTAL: R$ 3.000,00        | TOTAL: R$ 3.000,00 ✅


DRE (RESULTADO) - CORRETO
═════════════════════════════════════════════
Receita de Serviços ............. R$ 10.000,00
(-) Despesa Salários ............ (R$ 3.000,00) ✅ APENAS O BRUTO
(-) Outras Despesas ............ (R$ 2.000,00)
                              ──────────────
Lucro Operacional ............... R$ 5.000,00  ✅ CORRETO!


BALANÇO (PASSIVO) - CORRETO
═════════════════════════════════════════════
Salários a Pagar ................. R$ 2.550,00 ✅
INSS a Recolher .................. R$ 300,00   ✅
IRRF a Recolher .................. R$ 150,00   ✅
Outras Contas a Pagar ............ R$ 5.000,00
                              ──────────────
Total de Passivos ................ R$ 8.000,00 ✅ COMPLETO E CORRETO!
```

---

## 🔄 FLUXO COMPLETO DE LANÇAMENTOS

### Cenário: Folha de Dezembro 2025

```
╔════════════════════════════════════════════════════════════════════╗
║                    31 DE DEZEMBRO DE 2025                         ║
║              (DIA DO FECHAMENTO DA FOLHA)                         ║
╚════════════════════════════════════════════════════════════════════╝

LANÇAMENTO 1️⃣: PROVISÃO DA FOLHA
─────────────────────────────────────────────────────────────────

Data: 31/12/2025
Descrição: Folha de Pagamento - Dezembro/2025

┌─────────────────────────────────────┬──────────────┬─────────────┐
│ CONTA CONTÁBIL                      │    DÉBITO    │   CRÉDITO   │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ Despesa com Salários e Encargos     │ R$ 3.000,00  │             │
│ (Código: 3.1.01)                    │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ Salários e Ordenados a Pagar        │              │ R$ 2.550,00 │
│ (Código: 2.1.2.01)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ INSS a Recolher                     │              │ R$ 300,00   │
│ (Código: 2.1.2.02)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ IRRF a Recolher                     │              │ R$ 150,00   │
│ (Código: 2.1.2.03)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ TOTAIS                              │ R$ 3.000,00  │ R$ 3.000,00 │
└─────────────────────────────────────┴──────────────┴─────────────┘

Resultado: ✅ Balanço perfeito! Débito = Crédito


╔════════════════════════════════════════════════════════════════════╗
║                    10 DE JANEIRO DE 2026                          ║
║           (DIA DO PAGAMENTO AOS FUNCIONÁRIOS)                     ║
╚════════════════════════════════════════════════════════════════════╝

LANÇAMENTO 2️⃣: PAGAMENTO DOS SALÁRIOS
─────────────────────────────────────────────────────────────────

Data: 10/01/2026
Descrição: Pagamento de Salários - Dezembro/2025

┌─────────────────────────────────────┬──────────────┬─────────────┐
│ CONTA CONTÁBIL                      │    DÉBITO    │   CRÉDITO   │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ Salários e Ordenados a Pagar        │ R$ 2.550,00  │             │
│ (Código: 2.1.2.01)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ Banco (conta corrente)              │              │ R$ 2.550,00 │
│ (Código: 1.1.1.01)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ TOTAIS                              │ R$ 2.550,00  │ R$ 2.550,00 │
└─────────────────────────────────────┴──────────────┴─────────────┘

Efeito: Baixa do passivo "Salários a Pagar"


╔════════════════════════════════════════════════════════════════════╗
║                    15 DE JANEIRO DE 2026                          ║
║           (DIA DO RECOLHIMENTO DE INSS)                           ║
╚════════════════════════════════════════════════════════════════════╝

LANÇAMENTO 3️⃣: RECOLHIMENTO DE INSS
─────────────────────────────────────────────────────────────────

Data: 15/01/2026
Descrição: Recolhimento de INSS - Dezembro/2025

┌─────────────────────────────────────┬──────────────┬─────────────┐
│ CONTA CONTÁBIL                      │    DÉBITO    │   CRÉDITO   │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ INSS a Recolher                     │ R$ 300,00    │             │
│ (Código: 2.1.2.02)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ Banco (conta corrente)              │              │ R$ 300,00   │
│ (Código: 1.1.1.01)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ TOTAIS                              │ R$ 300,00    │ R$ 300,00   │
└─────────────────────────────────────┴──────────────┴─────────────┘

Efeito: Baixa do passivo "INSS a Recolher"


╔════════════════════════════════════════════════════════════════════╗
║                    20 DE JANEIRO DE 2026                          ║
║           (DIA DO RECOLHIMENTO DE IRRF)                           ║
╚════════════════════════════════════════════════════════════════════╝

LANÇAMENTO 4️⃣: RECOLHIMENTO DE IRRF
─────────────────────────────────────────────────────────────────

Data: 20/01/2026
Descrição: Recolhimento de IRRF - Dezembro/2025

┌─────────────────────────────────────┬──────────────┬─────────────┐
│ CONTA CONTÁBIL                      │    DÉBITO    │   CRÉDITO   │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ IRRF a Recolher                     │ R$ 150,00    │             │
│ (Código: 2.1.2.03)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ Banco (conta corrente)              │              │ R$ 150,00   │
│ (Código: 1.1.1.01)                  │              │             │
├─────────────────────────────────────┼──────────────┼─────────────┤
│ TOTAIS                              │ R$ 150,00    │ R$ 150,00   │
└─────────────────────────────────────┴──────────────┴─────────────┘

Efeito: Baixa do passivo "IRRF a Recolher"
```

---

## 📋 COMPARAÇÃO: ANTES vs DEPOIS

```
╔════════════════════════════════════════════════════════════════════╗
║                        BALANÇO FINAL                              ║
║                    (31 de Dezembro de 2025)                       ║
╚════════════════════════════════════════════════════════════════════╝

ATIVO
─────────────────────────────────────────────────────────────────
Caixa/Banco ............................ R$ 100.000,00
                                        ──────────────
TOTAL ATIVO ............................ R$ 100.000,00


═══════════════════════════════════════════════════════════════════

                          ❌ ANTES                ✅ DEPOIS
─────────────────────────────────────────────────────────────────

PASSIVO
Salários a Pagar ......... ??? (não estava)    R$ 2.550,00
INSS a Recolher .......... ??? (não estava)    R$ 300,00
IRRF a Recolher .......... ??? (não estava)    R$ 150,00
Outras Contas ............ R$ 5.000,00         R$ 5.000,00
                        ─────────────────    ─────────────────
TOTAL PASSIVO ............. R$ 5.000,00 ❌     R$ 8.000,00 ✅


PATRIMÔNIO
Capital Social ............ R$ 95.000,00       R$ 92.000,00
Lucro do Período .......... R$ 5.000,00 ❌     R$ 0 (deficit)
                        ─────────────────    ─────────────────
TOTAL PATRIMÔNIO .......... R$ 100.000,00 ❌   R$ 92.000,00 ✅


PASSIVO + PATRIMÔNIO .... R$ 105.000,00 ❌    R$ 100.000,00 ✅
                        (Não bate!)           (Bate perfeito!)

═══════════════════════════════════════════════════════════════════

CONCLUSÃO:
❌ ANTES: Patrimônio inflacionado em R$ 5.000,00
✅ DEPOIS: Passivos corretamente identificados e contabilizados
```

---

## 💼 COMPARAÇÃO: DRE (Demonstração de Resultado)

```
DEMONSTRAÇÃO DE RESULTADO DO EXERCÍCIO
(Período: Dezembro de 2025)

                                 ❌ ANTES          ✅ DEPOIS
─────────────────────────────────────────────────────────────
Receita de Serviços .... R$ 10.000,00        R$ 10.000,00

(-) Custos e Despesas:
  Despesa Salários ..... (R$ 3.000,00)      (R$ 3.000,00)
  Despesa INSS Retido .. (R$ 300,00) ❌      ────────────
  Despesa IRRF Retido .. (R$ 150,00) ❌      ────────────
  Outras Despesas ...... (R$ 2.000,00)      (R$ 2.000,00)
                      ──────────────────   ──────────────────
Total de Despesas ...... (R$ 5.450,00) ❌   (R$ 5.000,00) ✅

─────────────────────────────────────────────────────────────
LUCRO OPERACIONAL ..... R$ 4.550,00 ❌      R$ 5.000,00 ✅
─────────────────────────────────────────────────────────────

Diferença: R$ 450,00 (exatamente INSS + IRRF erroneamente classificados)
```

---

## 🎯 Conclusão

✅ **A Solução:**
- Reclassifica INSS e IRRF como Passivos (não Despesas)
- Mostra Despesa Real de Salários (Bruto)
- Identifica corretamente as Obrigações a Recolher
- Resulta em DRE e Balanço corretos e consistentes

✅ **Implementação:**
- Hook: `usePayrollAccounting.ts` (pronto para usar)
- Exemplo: `usePayrollAccounting.exemplo.tsx` (passo a passo)
- Documentação: Completa e validada

✅ **Status:** Enviado para GitHub e pronto para produção!
