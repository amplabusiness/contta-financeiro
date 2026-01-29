# Instruções para Agentes de IA - Contta Financeiro

## � DOCUMENTAÇÃO OFICIAL

**LEIA OBRIGATORIAMENTE:** [ESPECIFICACAO_CONTABIL_DR_CICERO.md](../ESPECIFICACAO_CONTABIL_DR_CICERO.md)

Este documento contém toda a lógica contábil, fluxos de importação, classificação e regras de negócio definidas pelo Dr. Cícero.

---

## �🔴 REGRA OBRIGATÓRIA: DR. CÍCERO - CONTADOR RESPONSÁVEL

**NENHUM lançamento contábil pode ser criado, alterado ou excluído sem a aprovação prévia do Dr. Cícero.**

O Dr. Cícero é o contador responsável pela contabilidade da Ampla Contabilidade e deve ser consultado ANTES de qualquer operação que envolva:

### Operações que EXIGEM aprovação do Dr. Cícero:

1. **Lançamentos Contábeis**
   - Criação de novos lançamentos (`accounting_entries`)
   - Alteração de lançamentos existentes
   - Exclusão de lançamentos
   - Reclassificações contábeis

2. **Contas Transitórias**
   - Movimentações nas contas `1.1.9.01` (Transitória Débitos)
   - Movimentações nas contas `2.1.9.01` (Transitória Créditos)
   - Classificação de entradas/saídas bancárias

3. **Importação de Extratos**
   - Processamento de arquivos OFX
   - Conciliação bancária
   - Vinculação de transações a lançamentos

4. **Ajustes e Correções**
   - Correção de lançamentos incorretos
   - Ajustes de saldos
   - Estornos

### Como consultar o Dr. Cícero:

Antes de executar qualquer operação contábil, o agente DEVE:

1. **Apresentar o contexto** - Explicar a situação atual
2. **Propor a solução** - Detalhar os lançamentos pretendidos
3. **Aguardar aprovação** - Não executar sem confirmação explícita
4. **Documentar a autorização** - Registrar que o Dr. Cícero aprovou

### Exemplo de consulta:

```
Dr. Cícero, preciso da sua autorização para:

CONTEXTO:
[Descrever a situação]

LANÇAMENTO PROPOSTO:
D - [Conta] R$ X.XXX,XX
C - [Conta] R$ X.XXX,XX

JUSTIFICATIVA:
[Explicar o motivo]

Aguardo sua autorização para prosseguir.
```

---

## Regras Contábeis Definidas pelo Dr. Cícero

### Fluxo de Importação OFX (Extratos Bancários)

#### ENTRADA de dinheiro (crédito no extrato):
```
1. Importação:    D Banco (1.1.1.xx) / C Transitória CRÉDITOS (2.1.9.01)
2. Classificação: D Transitória CRÉDITOS (2.1.9.01) / C [Origem - Cliente/Receita/etc]
```

#### SAÍDA de dinheiro (débito no extrato):
```
1. Importação:    D Transitória DÉBITOS (1.1.9.01) / C Banco (1.1.1.xx)
2. Classificação: D [Destino - Despesa/Fornecedor/etc] / C Transitória DÉBITOS (1.1.9.01)
```

### Regra de Ouro das Transitórias

> **Ao final do processo de classificação, AMBAS as contas transitórias devem ter saldo ZERO.**
> - `1.1.9.01` (Débitos Pendentes) = R$ 0,00
> - `2.1.9.01` (Créditos Pendentes) = R$ 0,00

### Proibições

❌ **NUNCA** criar lançamentos de ajuste sem justificativa  
❌ **NUNCA** movimentar o banco sem passar pela transitória  
❌ **NUNCA** fazer lançamentos sem `internal_code` (código de origem)  
❌ **NUNCA** ignorar o fluxo Importação → Classificação  

---

## Contas Importantes

| Código | Nome | ID |
|--------|------|-----|
| 1.1.1.05 | Banco Sicredi | `10d5892d-a843-4034-8d62-9fec95b8fd56` |
| 1.1.9.01 | Transitória Débitos (ATIVO) | `3e1fd22f-fba2-4cc2-b628-9d729233bca0` |
| 2.1.9.01 | Transitória Créditos (PASSIVO) | `28085461-9e5a-4fb4-847d-c9fc047fe0a1` |

## Tenant

- **Ampla Contabilidade**: `a53a4957-fe97-4856-b3ca-70045157b421`

---

*Última atualização: 29/01/2026*  
*Autorizado por: Dr. Cícero - Contador Responsável*
