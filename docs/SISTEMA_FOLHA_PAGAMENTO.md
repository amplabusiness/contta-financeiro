# 📋 SISTEMA DE FOLHA DE PAGAMENTO - CONTTA

## Documentação Técnica
**Autor:** Dr. Cícero - Contador Responsável  
**Data:** 01/02/2026  
**Versão:** 1.0

---

## 1. VISÃO GERAL

O sistema de folha de pagamento do Contta processa automaticamente:

1. **Cálculo de INSS** - Tabela progressiva 2025
2. **Cálculo de IRRF** - Com dedução por dependentes
3. **Outros descontos** - VT, VA, adiantamentos, consignados
4. **Lançamentos contábeis** - Sempre balanceados

### Princípio Fundamental

> **BRUTO = LÍQUIDO + INSS + IRRF + OUTROS DESCONTOS**
> 
> Se essa equação não fechar, o sistema bloqueia o processamento.

---

## 2. ESTRUTURA CONTÁBIL

### 2.1 Contas Utilizadas

| Código | Nome | UUID | Natureza |
|--------|------|------|----------|
| 4.2.1.01 | Salários | `4a11ef52-7ea7-4396-9c9b-ccfd9546a01d` | Despesa |
| 4.2.1.03 | FGTS | `744a236a-2a5c-4e49-8ffe-c11b404e0064` | Despesa |
| 2.1.2.01 | Salários a Pagar | `d5c04379-4919-4859-a84a-fb292a5bb047` | Passivo |
| 2.1.2.02 | FGTS a Recolher | `82bd81fc-c2fa-4bf3-ab2c-c0b49d03959f` | Passivo |
| 2.1.2.03 | INSS a Recolher | `ebcfcb58-1475-4c9b-97a8-ade8f4c43637` | Passivo |
| 2.1.2.04 | IRRF a Recolher | `a1c6aacf-f344-4fb9-a091-851de6998672` | Passivo |
| 2.1.2.09 | Outros Descontos a Recolher | `c1316b5e-1b69-4e79-960e-2ad26fb27f62` | Passivo |

### 2.2 Lançamento de Apropriação

```
FOLHA_{YYYYMM}_APROPRIACAO

D - 4.2.1.01 Salários .................. R$ BRUTO
  C - 2.1.2.01 Salários a Pagar ........ R$ LÍQUIDO
  C - 2.1.2.03 INSS a Recolher ......... R$ INSS
  C - 2.1.2.04 IRRF a Recolher ......... R$ IRRF
  C - 2.1.2.09 Outros Descontos ........ R$ OUTROS
```

### 2.3 Lançamento de FGTS

```
FOLHA_{YYYYMM}_FGTS

D - 4.2.1.03 FGTS ...................... R$ 8% do BRUTO
  C - 2.1.2.02 FGTS a Recolher ......... R$ 8% do BRUTO
```

---

## 3. TABELAS DE CÁLCULO 2025

### 3.1 INSS - Alíquotas Progressivas

| Faixa | Alíquota | Limite |
|-------|----------|--------|
| 1ª | 7,5% | Até R$ 1.518,00 |
| 2ª | 9,0% | De R$ 1.518,01 a R$ 2.793,88 |
| 3ª | 12,0% | De R$ 2.793,89 a R$ 4.190,83 |
| 4ª | 14,0% | De R$ 4.190,84 a R$ 8.157,41 |

**Teto de contribuição:** R$ 8.157,41

### 3.2 IRRF - Mensal

| Base de Cálculo | Alíquota | Dedução |
|-----------------|----------|---------|
| Até R$ 2.259,20 | Isento | - |
| R$ 2.259,21 a R$ 2.826,65 | 7,5% | R$ 169,44 |
| R$ 2.826,66 a R$ 3.751,05 | 15% | R$ 381,44 |
| R$ 3.751,06 a R$ 4.664,68 | 22,5% | R$ 662,77 |
| Acima de R$ 4.664,68 | 27,5% | R$ 896,00 |

**Dedução por dependente:** R$ 189,59

**Fórmula:**
```
Base IRRF = Salário Bruto - INSS - (Dependentes × 189,59)
IRRF = (Base IRRF × Alíquota) - Dedução
```

### 3.3 FGTS

- **Alíquota:** 8% sobre o salário bruto
- **Depósito:** Até dia 7 do mês seguinte

---

## 4. USO DO SISTEMA

### 4.1 Arquivos Principais

```
src/services/FolhaPagamentoService.ts  # Lógica de cálculo
src/hooks/useFolhaPagamento.ts          # Hook React
src/pages/Payroll.tsx                   # Página UI
```

### 4.2 Exemplo de Uso no React

```typescript
import { useFolhaPagamento } from '@/hooks/useFolhaPagamento';

function MinhaFolha() {
  const {
    processarESalvarFolha,
    loading,
    resultado
  } = useFolhaPagamento();

  async function processarFevereiro() {
    const result = await processarESalvarFolha({
      competencia: '202502',
      funcionarios: [
        {
          nome: 'João Silva',
          salarioBase: 5000,
          dependentes: 2,
          valeTransporte: 300,
          valeAlimentacao: 500,
          adiantamento: 1000
        }
      ]
    });

    if (result.success) {
      console.log('Folha processada!', result.entryIds);
    } else {
      console.error('Erro:', result.error);
    }
  }

  return (
    <button onClick={processarFevereiro} disabled={loading}>
      Processar Folha
    </button>
  );
}
```

### 4.3 Cálculos Individuais

```typescript
const { calcularINSS, calcularIRRF, calcularFGTS } = useFolhaPagamento();

const salario = 5000;
const dependentes = 2;

const inss = calcularINSS(salario);
const irrf = calcularIRRF(salario, inss, dependentes);
const fgts = calcularFGTS(salario);

console.log({ inss, irrf, fgts });
// { inss: 447.42, irrf: 73.26, fgts: 400 }
```

---

## 5. FLUXO DE PROCESSAMENTO

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DA FOLHA                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. ENTRADA DOS DADOS                                       │
│     - Lista de funcionários                                 │
│     - Variáveis do mês (HE, faltas, etc.)                  │
│     - Descontos extras                                      │
│                                                             │
│  2. PROCESSAMENTO (FolhaPagamentoService)                   │
│     - Calcula INSS progressivo                              │
│     - Calcula IRRF com dependentes                          │
│     - Soma outros descontos                                 │
│     - Calcula líquido                                       │
│     - Calcula FGTS                                          │
│                                                             │
│  3. VALIDAÇÃO                                               │
│     - Bruto = Líquido + INSS + IRRF + Outros?              │
│     - Se NÃO: BLOQUEIA                                      │
│     - Se SIM: continua                                      │
│                                                             │
│  4. GERAÇÃO DOS LANÇAMENTOS                                 │
│     - Monta estrutura contábil                              │
│     - Cria internal_code único                              │
│                                                             │
│  5. SALVAMENTO                                              │
│     - Verifica se já existe                                 │
│     - Insere cabeçalho                                      │
│     - Insere linhas                                         │
│                                                             │
│  6. CONFIRMAÇÃO                                             │
│     - Retorna IDs criados                                   │
│     - Toast de sucesso                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. OUTROS DESCONTOS

A conta **2.1.2.09 - Outros Descontos a Recolher** agrupa:

| Tipo | Descrição |
|------|-----------|
| VT | Vale Transporte (até 6% do salário) |
| VA | Vale Alimentação descontado |
| VR | Vale Refeição descontado |
| Adiantamento | 40-50% antecipado no dia 15 |
| Consignado | Empréstimos descontados em folha |
| Contribuição Sindical | Se houver autorização |
| Outros | Demais descontos autorizados |

### Importância

Sem essa conta, a equação não fecha:

```
❌ ERRADO (sem Outros Descontos):
Bruto (50.000) = Líquido (24.000) + INSS (4.500) + IRRF (1.500)
50.000 ≠ 30.000  → Diferença de R$ 20.000!

✅ CORRETO (com Outros Descontos):
Bruto (50.000) = Líquido (24.000) + INSS (4.500) + IRRF (1.500) + Outros (20.000)
50.000 = 50.000  → Balanceado!
```

---

## 7. CÓDIGOS DE RASTREAMENTO

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Apropriação | `FOLHA_{YYYYMM}_APROPRIACAO` | `FOLHA_202502_APROPRIACAO` |
| FGTS | `FOLHA_{YYYYMM}_FGTS` | `FOLHA_202502_FGTS` |
| Pagamento | `FOLHA_{YYYYMM}_PGTO` | `FOLHA_202502_PGTO` |
| INSS | `FOLHA_{YYYYMM}_INSS_PGTO` | `FOLHA_202502_INSS_PGTO` |
| IRRF | `FOLHA_{YYYYMM}_IRRF_PGTO` | `FOLHA_202502_IRRF_PGTO` |

---

## 8. CHECKLIST MENSAL

```
┌─────────────────────────────────────────────────────────────┐
│           CHECKLIST PROCESSAMENTO MENSAL                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ □ 1. Confirmar dados de todos os funcionários              │
│ □ 2. Lançar variáveis do mês (HE, faltas, comissões)       │
│ □ 3. Conferir descontos (VT, VA, consignados)              │
│ □ 4. Processar folha no sistema                            │
│ □ 5. Validar: BRUTO = LÍQUIDO + DESCONTOS?                 │
│ □ 6. Aprovar lançamentos contábeis                         │
│ □ 7. Gerar relatório para pagamento                        │
│ □ 8. Efetuar pagamento no dia 5                            │
│ □ 9. Recolher FGTS até dia 7                               │
│ □ 10. Enviar eSocial                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. TRATAMENTO DE ERROS

### Erro: "Folha não balanceada"

**Causa:** Soma dos créditos ≠ débito (bruto)

**Solução:** Verificar se todos os descontos estão sendo computados

### Erro: "Lançamento já existe"

**Causa:** Folha já processada para esta competência

**Solução:** Verificar se precisa estornar e reprocessar

### Erro: "Período fechado"

**Causa:** Mês já foi encerrado contabilmente

**Solução:** Solicitar reabertura ao Dr. Cícero

---

## 10. CONSIDERAÇÕES FINAIS

O sistema de folha de pagamento foi desenvolvido para:

1. **Automatizar cálculos** - Evitar erros manuais
2. **Garantir consistência** - Partidas dobradas sempre
3. **Facilitar auditoria** - Rastreamento completo
4. **Integrar contabilidade** - Lançamentos automáticos

### Contato

Para dúvidas ou problemas, consultar o **Dr. Cícero** (Contador Responsável).

---

*Documento oficial do Sistema Contta*  
*Última atualização: 01/02/2026*
