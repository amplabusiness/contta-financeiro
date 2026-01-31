# ⚖️ REGRAS DE OURO DO SISTEMA

## Princípios Invioláveis - Contta Financeiro
**Versão:** 1.0  
**Data:** 31/01/2026  
**Autoridade:** Dr. Cícero (Contador Responsável)

---

# PREFÁCIO

Este documento contém as **REGRAS INVIOLÁVEIS** do sistema Contta Financeiro.

Estas regras foram definidas pelo Dr. Cícero, contador responsável com 35 anos de experiência, e representam os princípios fundamentais que garantem a integridade contábil, fiscal e financeira do sistema.

**NENHUMA** dessas regras pode ser quebrada, contornada ou ignorada, sob nenhuma circunstância.

---

# 📜 AS 10 REGRAS DE OURO

---

## REGRA #1: PARTIDAS DOBRADAS

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         TODO DÉBITO TEM UM CRÉDITO DE IGUAL VALOR                         ║
║                                                                            ║
║                      ∑ Débitos = ∑ Créditos                               ║
║                           SEMPRE                                           ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Base Legal:** NBC TG Estrutura Conceitual, Art. 4.3

**Implicação:**
- NENHUM lançamento pode ter apenas débito ou apenas crédito
- O sistema BLOQUEIA qualquer tentativa de violar esta regra
- Não existe "ajuste" que possa contornar

**Exemplo:**
```
✅ CORRETO:
D - Banco         R$ 1.000,00
C - Clientes      R$ 1.000,00

❌ PROIBIDO:
D - Banco         R$ 1.000,00
(sem contrapartida)
```

---

## REGRA #2: RECEITA NASCE DA COMPETÊNCIA

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         RECEITA É RECONHECIDA QUANDO O SERVIÇO É PRESTADO                 ║
║              NÃO QUANDO O DINHEIRO ENTRA NO BANCO                         ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Base Legal:** NBC TG 47 - Receita de Contrato com Cliente

**Implicação:**
- PIX de cliente **NÃO GERA** receita automaticamente
- PIX **BAIXA** a duplicata (Contas a Receber)
- Receita foi reconhecida quando o serviço foi prestado

**Fluxo Correto:**
```
1. Serviço prestado:
   D - Clientes a Receber    R$ 5.000,00
   C - Receita de Serviços   R$ 5.000,00  ← AQUI NASCE A RECEITA

2. PIX recebido:
   D - Banco                 R$ 5.000,00
   C - Clientes a Receber    R$ 5.000,00  ← AQUI APENAS BAIXA
```

---

## REGRA #3: AS TRANSITÓRIAS DEVEM ZERAR

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║    CONTA 1.1.9.01 (Transitória Débitos)  = R$ 0,00                        ║
║    CONTA 2.1.9.01 (Transitória Créditos) = R$ 0,00                        ║
║                                                                            ║
║              AO FINAL DE CADA DIA E AO FECHAR O MÊS                       ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Implicação:**
- Se há saldo nas transitórias, existem transações NÃO CLASSIFICADAS
- O fechamento do mês é BLOQUEADO até zerar
- Indica trabalho incompleto

**Checagem:**
```sql
SELECT 
  CASE 
    WHEN saldo_119 = 0 AND saldo_219 = 0 THEN '✅ OK'
    ELSE '❌ PENDÊNCIA'
  END as status
FROM (
  SELECT 
    SUM(CASE WHEN code = '1.1.9.01' THEN debit - credit END) as saldo_119,
    SUM(CASE WHEN code = '2.1.9.01' THEN debit - credit END) as saldo_219
  FROM balancete
);
```

---

## REGRA #4: BANCO CONTÁBIL = BANCO REAL

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         SALDO DA CONTA BANCÁRIA NA CONTABILIDADE                          ║
║                        DEVE SER IGUAL AO                                   ║
║         SALDO DO EXTRATO BANCÁRIO (ÚLTIMO DIA DO MÊS)                     ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Implicação:**
- Se divergir, há erro de lançamento ou importação faltante
- A conciliação bancária é OBRIGATÓRIA
- Não se fecha o mês com divergência

**Tolerância:** R$ 0,00 (zero centavos)

---

## REGRA #5: NENHUM LANÇAMENTO SEM RASTREIO

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         TODO LANÇAMENTO DEVE TER:                                          ║
║                                                                            ║
║         • internal_code (código único)                                     ║
║         • source_type (origem do lançamento)                              ║
║         • entry_date (data do fato)                                       ║
║         • description (descrição clara)                                    ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Formatos de internal_code:**
| Origem | Formato | Exemplo |
|--------|---------|---------|
| Importação OFX | `OFX_IMP_{timestamp}_{fitid}` | `OFX_IMP_1736272800_16492847` |
| Classificação | `CLASS_{timestamp}_{fitid}` | `CLASS_1736272800_16492847` |
| Manual | `MANUAL_{timestamp}_{uuid8}` | `MANUAL_1736272800_a1b2c3d4` |
| Estorno | `ESTORNO_{codigo_original}` | `ESTORNO_OFX_IMP_1736272800` |

---

## REGRA #6: NUNCA DELETAR, SEMPRE ESTORNAR

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║              LANÇAMENTOS CONTÁBEIS SÃO IMUTÁVEIS                          ║
║                                                                            ║
║         Para corrigir um erro:                                             ║
║         1. Criar lançamento de ESTORNO (valores invertidos)               ║
║         2. Criar novo lançamento CORRETO                                   ║
║                                                                            ║
║                    NUNCA usar DELETE ou UPDATE                            ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Base Legal:** Código Civil Art. 1.183 - Escrituração Mercantil

**Exemplo de Estorno:**
```
ORIGINAL (erro):
D - Despesas Pessoal    R$ 1.000,00
C - Banco               R$ 1.000,00

ESTORNO:
D - Banco               R$ 1.000,00
C - Despesas Pessoal    R$ 1.000,00

NOVO (correto):
D - Adiantamento Sócios R$ 1.000,00
C - Banco               R$ 1.000,00
```

---

## REGRA #7: SEPARAR EMPRESA E FAMÍLIA

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         GASTOS PESSOAIS DOS SÓCIOS ≠ DESPESAS DA EMPRESA                  ║
║                                                                            ║
║         Família Leão (Sérgio, Carla, Victor Hugo, Nayara, Sérgio Augusto) ║
║                                                                            ║
║         • Gasto PESSOAL  → Adiantamento a Sócios (1.1.3.xx)              ║
║         • Gasto da EMPRESA → Despesa Operacional (4.x.x.xx)              ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Implicação Fiscal:**
- Despesa pessoal lançada como empresa = FRAUDE
- Pode gerar autuação fiscal
- Pode caracterizar retirada disfarçada de lucros

---

## REGRA #8: DR. CÍCERO É A AUTORIDADE FINAL

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         NENHUMA OPERAÇÃO CRÍTICA SEM APROVAÇÃO DO DR. CÍCERO              ║
║                                                                            ║
║         Operações que EXIGEM aprovação:                                    ║
║         • Fechamento de período                                            ║
║         • Estorno de lançamentos                                           ║
║         • Reclassificações acima de R$ 10.000                             ║
║         • Ajustes de abertura                                              ║
║         • Reabertura de período fechado                                    ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Hierarquia de Decisão:**
```
Dr. Cícero (autoridade máxima)
     │
     ├── Pode: Aprovar, Rejeitar, Estornar, Fechar
     │
     └── Agentes subordinados:
         ├── Agente Financeiro (sugere)
         ├── Agente Contábil (valida)
         └── Agente Auditoria (verifica)
```

---

## REGRA #9: IA SUGERE, NUNCA EXECUTA

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         A INTELIGÊNCIA ARTIFICIAL DO SISTEMA:                              ║
║                                                                            ║
║         ✅ PODE:                                                           ║
║         • Sugerir classificações                                           ║
║         • Identificar padrões                                              ║
║         • Alertar sobre anomalias                                          ║
║         • Aprender com correções                                           ║
║         • Justificar decisões                                              ║
║                                                                            ║
║         ❌ NÃO PODE:                                                       ║
║         • Executar lançamentos sem confirmação                             ║
║         • Deletar dados                                                    ║
║         • Modificar lançamentos aprovados                                  ║
║         • Fechar períodos automaticamente                                  ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## REGRA #10: TODA MOVIMENTAÇÃO BANCÁRIA PASSA PELA SUPER CONCILIAÇÃO

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                            ║
║         NÃO EXISTE ATALHO PARA O BANCO                                     ║
║                                                                            ║
║         Fluxo OBRIGATÓRIO:                                                 ║
║                                                                            ║
║         Extrato Bancário (OFX)                                             ║
║              │                                                             ║
║              ▼                                                             ║
║         Super Conciliação                                                  ║
║              │                                                             ║
║              ▼                                                             ║
║         Classificação                                                      ║
║              │                                                             ║
║              ▼                                                             ║
║         Lançamento Contábil                                                ║
║                                                                            ║
║         NUNCA: Banco ← Lançamento Manual direto                           ║
║                                                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

# 📋 RESUMO DAS REGRAS

| # | Regra | Consequência da Violação |
|---|-------|--------------------------|
| 1 | Partidas Dobradas | Sistema BLOQUEIA |
| 2 | Receita na Competência | Erro fiscal grave |
| 3 | Transitórias Zeram | Fechamento BLOQUEADO |
| 4 | Banco = Extrato | Conciliação obrigatória |
| 5 | Rastreio Obrigatório | Auditoria impossível |
| 6 | Estornar, não deletar | Perda de histórico |
| 7 | Empresa ≠ Família | Fraude fiscal |
| 8 | Dr. Cícero Aprova | Governança quebrada |
| 9 | IA Apenas Sugere | Risco de automação cega |
| 10 | Super Conciliação | Descontrole bancário |

---

# ⚠️ PENALIDADES

A violação de qualquer Regra de Ouro resultará em:

1. **Bloqueio imediato** da operação pelo sistema
2. **Alerta** para o Dr. Cícero
3. **Registro** no log de auditoria
4. **Revisão** obrigatória do processo

Em casos de tentativa intencional de burlar as regras:

1. **Bloqueio** do usuário
2. **Auditoria** completa das ações anteriores
3. **Relatório** para a administração

---

# 📜 TERMO DE ACEITE

Ao utilizar o sistema Contta Financeiro, o usuário declara:

- Que leu e compreendeu as Regras de Ouro
- Que se compromete a segui-las integralmente
- Que reconhece o Dr. Cícero como autoridade contábil
- Que entende as consequências da violação

---

**Documento elaborado e aprovado por:**

**Dr. Cícero**  
Contador Responsável  
Ampla Contabilidade LTDA  
CRC-GO 000000/O-0

**Data:** 31/01/2026  
**Versão:** 1.0

---

*"A contabilidade é a linguagem dos negócios. Quem não a respeita, não pode prosperar."*  
— Dr. Cícero
