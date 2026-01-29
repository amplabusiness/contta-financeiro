# 📊 ENCERRAMENTO DO EXERCÍCIO - Explicação do Dr. Cícero

## O que é o Encerramento do Exercício?

No dia **31/12 de cada ano**, as contas de **RESULTADO** (Receitas e Despesas) precisam ser **zeradas** e o resultado (Lucro ou Prejuízo) transferido para o **Patrimônio Líquido**.

Isso acontece porque:
- Contas de Receitas (grupo 3) e Despesas (grupo 4) são **temporárias**
- Elas acumulam valores apenas durante o exercício social
- No encerramento, seu saldo é transferido para conta **permanente** no PL

---

## Estrutura das Contas

### Contas TEMPORÁRIAS (zeradas no encerramento):
```
GRUPO 3 - RECEITAS (natureza CREDORA)
├── 3.1.1.01 - Receita de Honorários Contábeis
├── 3.1.1.02 - Receita de Honorários Fiscais
└── 3.1.1.03 - Receita de Honorários DP

GRUPO 4 - DESPESAS (natureza DEVEDORA)
├── 4.1.1.01 - Salários
├── 4.1.2.01 - Aluguel
├── 4.1.2.02 - Energia Elétrica
└── ... (todas as despesas)
```

### Contas PERMANENTES (recebem o resultado):
```
GRUPO 5 - PATRIMÔNIO LÍQUIDO
├── 5.1.1.01 - Capital Social
├── 5.2.1.01 - Lucros Acumulados        ← RECEBE O LUCRO
└── 5.2.1.02 - Prejuízos Acumulados     ← RECEBE O PREJUÍZO (se houver)
```

---

## Mecânica do Encerramento (em 31/12)

### Passo 1: Calcular o Resultado do Exercício

```
RESULTADO = Total RECEITAS (grupo 3) - Total DESPESAS (grupo 4)

Se RESULTADO > 0 → LUCRO
Se RESULTADO < 0 → PREJUÍZO
```

### Passo 2: Zerar as Contas de RECEITA

Para cada conta de receita com saldo CREDOR:

```
Lançamento de Encerramento - RECEITAS
Data: 31/12/2024

D - 3.1.1.01 (Receita de Honorários)     R$ 136.821,59
C - 5.2.1.01 (Lucros Acumulados)         R$ 136.821,59

Histórico: "Encerramento do exercício 2024 - Transferência de receitas para PL"
```

**Explicação:**
- Receitas têm natureza CREDORA (saldo positivo = créditos)
- Para zerar, fazemos um DÉBITO na conta de receita
- A contrapartida é CRÉDITO no PL (aumenta o lucro)

### Passo 3: Zerar as Contas de DESPESA

Para cada conta de despesa com saldo DEVEDOR:

```
Lançamento de Encerramento - DESPESAS
Data: 31/12/2024

D - 5.2.1.01 (Lucros Acumulados)         R$ 134.347,31
C - 4.1.x.xx (Cada conta de despesa)     R$ 134.347,31

Histórico: "Encerramento do exercício 2024 - Transferência de despesas para PL"
```

**Explicação:**
- Despesas têm natureza DEVEDORA (saldo positivo = débitos)
- Para zerar, fazemos um CRÉDITO na conta de despesa
- A contrapartida é DÉBITO no PL (reduz o lucro)

---

## Exemplo Completo - Ampla Contabilidade 2024

### Situação em 31/12/2024:
```
RECEITAS (grupo 3):
├── 3.1.1.01 Honorários Contábeis    R$ 136.821,59 (Credor)

DESPESAS (grupo 4):
├── 4.1.1.01 Salários                R$  80.000,00 (Devedor)
├── 4.1.2.01 Aluguel                 R$  24.000,00 (Devedor)
├── 4.1.2.02 Energia                 R$   6.000,00 (Devedor)
├── 4.1.x.xx Outras Despesas         R$  24.347,31 (Devedor)
                                     ─────────────
TOTAL DESPESAS                       R$ 134.347,31

RESULTADO = 136.821,59 - 134.347,31 = R$ 2.474,28 (LUCRO)
```

### Lançamento de Encerramento:
```
╔══════════════════════════════════════════════════════════════════╗
║  LANÇAMENTO DE ENCERRAMENTO DO EXERCÍCIO 2024                    ║
║  Data: 31/12/2024                                                ║
╠══════════════════════════════════════════════════════════════════╣
║  1. ZERAR RECEITAS                                               ║
║     D - 3.1.1.01 (Honorários Contábeis)      R$ 136.821,59       ║
║     C - 5.2.1.01 (Lucros Acumulados)         R$ 136.821,59       ║
╠══════════════════════════════════════════════════════════════════╣
║  2. ZERAR DESPESAS                                               ║
║     D - 5.2.1.01 (Lucros Acumulados)         R$ 134.347,31       ║
║     C - 4.1.1.01 (Salários)                  R$  80.000,00       ║
║     C - 4.1.2.01 (Aluguel)                   R$  24.000,00       ║
║     C - 4.1.2.02 (Energia)                   R$   6.000,00       ║
║     C - 4.1.x.xx (Outras)                    R$  24.347,31       ║
╠══════════════════════════════════════════════════════════════════╣
║  RESULTADO LÍQUIDO                                               ║
║  Lucros Acumulados recebeu:                                      ║
║    Crédito (Receitas)   R$ 136.821,59                            ║
║    Débito (Despesas)    R$ 134.347,31                            ║
║    ─────────────────────────────────                             ║
║    SALDO FINAL          R$   2.474,28 (LUCRO)                    ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Conta Correta para Receber o Resultado

### ✅ CORRETO: 5.2.1.01 - Lucros Acumulados
Esta é a conta do Patrimônio Líquido que recebe o resultado do exercício.

### ❌ ERRADO: Usar contas de resultado (3.x ou 4.x) para saldos permanentes
Receitas e Despesas são zeradas todo ano.

### ❌ ERRADO: 5.3.02.02 ou similar
Não usar contas auxiliares como contrapartida permanente.

---

## Diferença: Saldo de Abertura vs Encerramento

| Operação | Conta | Quando | Lançamento |
|----------|-------|--------|------------|
| **Saldo de Abertura** | 5.2.1.01 | 01/01 | D-Ativo C-5.2.1.01 |
| **Encerramento** | 5.2.1.01 | 31/12 | D-Receitas C-5.2.1.01 + D-5.2.1.01 C-Despesas |

**Ambos usam a mesma conta (5.2.1.01)** porque:
- Saldo de Abertura = lucros de exercícios anteriores
- Encerramento = lucro do exercício atual
- Tudo fica em "Lucros Acumulados" no PL

---

## Resumo da Conta 5.2.1.01 (Lucros Acumulados)

```
CONTA: 5.2.1.01 - Lucros Acumulados
GRUPO: 5 - Patrimônio Líquido
NATUREZA: CREDORA

USADA PARA:
1. Contrapartida de SALDO DE ABERTURA de ativos
2. Receber LUCRO do encerramento do exercício
3. Distribuição de DIVIDENDOS (débito na conta)

MOVIMENTO:
- CRÉDITO = aumenta (recebe lucro, saldo abertura)
- DÉBITO = diminui (distribui dividendos, absorve prejuízo)
```

---

## Referências Normativas

- **NBC TG 26** - Apresentação das Demonstrações Contábeis
- **ITG 2000** - Escrituração Contábil
- **CPC 26** - Apresentação das Demonstrações Contábeis

---

*"O encerramento do exercício é o momento em que transferimos o resultado das contas temporárias para o patrimônio permanente da empresa."* - Dr. Cícero
