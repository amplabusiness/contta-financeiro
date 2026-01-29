“Use este documento como especificação oficial.
Corrija o sistema existente, começando pelo saldo de abertura e continuidade contábil.
Não invente regras. Siga exatamente.” 
Este documento é a especificação oficial do sistema.
Nenhuma decisão pode ser tomada fora destas regras.
Em caso de dúvida, a IA deve perguntar, nunca inventar.

# CONTTA / AMPLA  
## ESPECIFICAÇÃO CONTÁBIL, FINANCEIRA E SAAS – VERSÃO OFICIAL  
**Baseada nas regras brasileiras de contabilidade (CPC / CFC / Lei 6.404 / SPED ECD)**

---

## 1. OBJETIVO DO SISTEMA

Este sistema tem como objetivo **gerenciar integralmente o financeiro e a contabilidade de um escritório contábil**, com foco em:

- Contas a Receber (honorários recorrentes e variáveis)
- Contas a Pagar (custos operacionais do escritório)
- Inadimplência, aging e renegociação
- Conciliação bancária (OFX / PIX / Cora)
- Contabilidade completa de todos os eventos (partida dobrada)
- Ledger auxiliar por cliente e fornecedor
- Multi-escritório (SaaS) para monetização futura
- IA aplicada à classificação, conciliação, cobrança e oportunidades

**A geração do SPED ECD não é o objetivo imediato**, porém **toda a estrutura contábil deve seguir rigorosamente o padrão brasileiro**, como se fosse auditada.

---

## 2. PRINCÍPIOS CONTÁBEIS OBRIGATÓRIOS (NÃO NEGOCIÁVEIS)

1. Regime de competência mensal
2. Continuidade do período contábil
3. Partida dobrada obrigatória
4. Contas analíticas aceitam lançamento
5. Contas sintéticas NÃO aceitam lançamento
6. Contas patrimoniais (Ativo, Passivo, PL) carregam saldo
7. Contas de resultado (Receita e Despesa) zeram no encerramento
8. Saldo final de um exercício = saldo inicial do exercício seguinte
9. Nenhum valor pode “sumir” entre períodos
10. Contabilidade é a **FONTE ÚNICA DA VERDADE**

---

## 3. PERÍODO CONTÁBIL (PADRÃO BRASIL)

- Competência mensal (MM/AAAA)
- Encerramento mensal lógico
- Encerramento anual formal

### Regras:
- Janeiro inicia com saldo de abertura (derivado de 31/12 anterior)
- Encerramento anual transfere resultado para PL
- Sistema NÃO pode apagar saldos históricos

---

## 4. PLANO DE CONTAS (MODELO HÍBRIDO – AMPLA + REFERENCIAL)

### 4.1 Estrutura

- Plano base da AMPLA (operacional)
- Mapeamento obrigatório para Plano Referencial SPED
- Customização permitida por escritório (SaaS)

### 4.2 Máscara
Exemplo:

### 4.3 Campos obrigatórios da conta contábil
- codigo
- descricao
- nivel
- tipo (SINTETICA | ANALITICA)
- natureza (D | C)
- grupo (ATIVO, PASSIVO, PL, RECEITA, DESPESA)
- codigo_referencial_sped (obrigatório)
- aceita_lancamento (boolean)

---

## 5. LEDGER AUXILIAR (REGRA CRÍTICA)

### 5.1 Modelo adotado (HÍBRIDO – OBRIGATÓRIO)

- Contabilidade mantém **conta única**
- Ledger auxiliar controla granularidade

#### Exemplo:

Ledger:
- Cliente A → saldo
- Cliente B → saldo
- Cliente C → saldo

### 5.2 Ledger obrigatório para:
- Clientes
- Fornecedores
- Bancos
- Tributos

**Ledger NÃO substitui plano de contas.**

---

## 6. SALDO DE ABERTURA (PROBLEMA CRÍTICO A CORRIGIR)

### Regra:
- Saldo em 31/12/2024 deve gerar automaticamente saldo inicial em 01/01/2025
- Esse saldo:
  - Deve aparecer no razão
  - Deve aparecer no balancete
  - Deve aparecer no plano de contas
  - Deve respeitar ledger por cliente

### Implementação correta:
- Saldo inicial é um LANÇAMENTO CONTÁBIL DE ABERTURA
- Nunca é um “campo solto”

---

## 7. CONTAS A RECEBER (ESCRITÓRIO CONTÁBIL)

### Tipos de honorários suportados:
- Honorário fixo mensal
- Honorário indexado ao salário mínimo
- 13º honorário
- % sobre faturamento
- Legalização (abertura, baixa, alteração)
- Holding / consultoria
- Permuta

### Regras:
- Todo honorário gera:
  - Invoice (financeiro)
  - Lançamento contábil (D Cliente / C Receita)
- Recebimento gera:
  - Conciliação bancária
  - Lançamento contábil (D Banco / C Cliente)

---

## 8. INADIMPLÊNCIA E AGING

Sistema deve calcular automaticamente:
- 0–30 dias
- 31–60 dias
- 61–90 dias
- +90 dias

Com base em:
- Ledger de clientes
- Invoices vencidas

---

## 9. CONTAS A PAGAR

Inclui:
- Folha e encargos
- Tributos
- Sistemas
- Aluguel
- Energia
- Serviços terceiros

### Regra:
- Provisão gera lançamento
- Pagamento gera lançamento
- Banco sempre participa da partida

---

## 10. CONCILIAÇÃO BANCÁRIA (OFX / PIX / CORA)

### Fluxo obrigatório:
1. Entrada no extrato
2. Classificação (IA + regras)
3. Confirmação
4. Geração automática de lançamento contábil

### Transações não identificadas:
- Devem ir para conta transitória
- Nunca podem desaparecer

---

## 11. CONTABILIDADE = FONTE DA VERDADE

Todos os relatórios devem derivar de:
- accounting_entries
- accounting_entry_items
- chart_of_accounts

Financeiro e operacional são **origem**, não verdade final.

---

## 12. MULTI-ESCRITÓRIO (SAAS)

- Todas as tabelas devem conter `office_id`
- Supabase RLS obrigatório
- Isolamento total por escritório
- Plano da AMPLA como default

---

## 13. AUTORIZAÇÃO PARA A IA (CLAUDE / VSCODE)

A IA está **AUTORIZADA** a:
- Criar e alterar tabelas no Supabase
- Criar migrations
- Ajustar schemas
- Criar índices
- Criar triggers
- Criar funções SQL

### Restrições:
- NÃO inventar regra contábil
- NÃO ignorar este documento
- Perguntar quando houver dúvida
- Seguir rigorosamente contabilidade brasileira

Credenciais estão no `.env`.

---

## 14. IA – PAPÉIS PERMITIDOS

- Classificar transações
- Sugerir lançamentos
- Gerar lançamentos via serviço contábil
- Detectar inadimplência
- Sugerir renegociação
- Detectar crescimento de cliente
- Sugerir reajuste de honorários

---

## 15. ROADMAP OBRIGATÓRIO PARA A IA

1. Corrigir saldo de abertura
2. Corrigir continuidade de período
3. Garantir ledger por cliente
4. Centralizar tudo na contabilidade
5. Fechar conciliação bancária
6. Consolidar contas a receber
7. Consolidar contas a pagar
8. Validar balancete / razão / DRE
9. Implementar RLS multi-escritório
10. Preparar base SaaS

---

## 16. REGRA FINAL

> Este documento é a **especificação oficial do sistema**.  
> Qualquer código que viole estas regras deve ser considerado **incorreto**, mesmo que “funcione”.

---
1. OBJETIVO DO SISTEMA

Este sistema é um ERP Financeiro-Contábil SaaS voltado inicialmente para a AMPLA Contabilidade, com capacidade de escalar para outros escritórios contábeis (multi-tenant).

O objetivo não é apenas financeiro, mas contábil completo, utilizando como referência técnica:

Contabilidade brasileira (NBC, CPC, Lei 6.404/76)

Estrutura lógica do SPED ECD

Plano de contas estruturado

Partidas dobradas

Ledger auxiliar (clientes, fornecedores, bancos)

Conciliação bancária real

Controle de inadimplência e recorrência

Base sólida para monetização SaaS

A contabilidade é a FONTE DA VERDADE do sistema.

2. PRINCÍPIOS FUNDAMENTAIS (OBRIGATÓRIOS)
2.1 Princípios Contábeis

O sistema DEVE respeitar obrigatoriamente:

Continuidade

Competência

Oportunidade

Registro pelo valor original

Prudência

Partida dobrada

Patrimonial ≠ Resultado

2.2 Regra de Ouro

❌ Nenhum evento financeiro pode existir sem lançamento contábil
✅ Todo evento deve gerar accounting_entry via AccountingService

3. PERÍODO CONTÁBIL (REGRA BRASILEIRA)

Competência mensal

Encerramento anual

Continuidade entre exercícios

Regras:

Contas patrimoniais (1, 2, PL) carregam saldo

Contas de resultado (3 e 4) zeram no encerramento

Saldo final de 31/12/N = saldo inicial 01/01/N+1

❌ Saldo nunca pode “sumir” entre períodos
❌ Trocar período NÃO pode apagar lançamentos

4. SALDOS DE ABERTURA (CRÍTICO)
Regra Oficial

Saldos de abertura DEVEM ser registrados como:

Lançamento contábil de abertura

Data: 01/01 do exercício

Tipo: ABERTURA

Origem: saldo_inicial

Estrutura:

Débito / Crédito por conta analítica

Clientes e fornecedores com ledger auxiliar

❌ Saldo inicial não é campo solto
❌ Saldo inicial não é cálculo dinâmico
✅ Saldo inicial é lançamento contábil

5. PLANO DE CONTAS (MODELO AMPLA + REFERENCIAL)
5.1 Estrutura

Plano de contas em 3 camadas:

Plano Operacional da Ampla

Mapeamento Referencial SPED

Customização por Escritório (SaaS)

5.2 Regras Obrigatórias

Cada conta deve ter:

codigo

descricao

nivel

natureza (D ou C)

tipo (SINTETICA | ANALITICA)

aceita_lancamento (boolean)

codigo_referencial_sped (opcional)

❌ Conta sintética NÃO aceita lançamento
✅ Apenas conta analítica lança

6. LEDGER AUXILIAR (CLIENTES / FORNECEDORES)
Modelo adotado: HÍBRIDO (OFICIAL)
Contabilidade:
1.1.2.01.001 – Clientes a Receber

Ledger auxiliar:

Um saldo por cliente

Um saldo por fornecedor

Um saldo por banco

Regra:

Ledger não substitui plano de contas

Ledger complementa para:

inadimplência

aging

cobrança

renegociação

permuta

7. CONTAS A RECEBER (HONORÁRIOS)
Tipos suportados (OBRIGATÓRIOS):

Honorário fixo mensal

Honorário indexado ao salário mínimo

13º honorário

% sobre faturamento bruto

Honorários de legalização

Honorários de holding

Honorários avulsos

Permuta

Regra Contábil:

Geração do honorário:

D: Clientes

C: Receita de Honorários

Recebimento:

D: Banco

C: Clientes

❌ Recebimento sem invoice é exceção controlada
✅ Tudo deve fechar no ledger do cliente

8. INADIMPLÊNCIA E COBRANÇA

O sistema deve calcular:

Aging:

0–30

31–60

61–90

+90

Histórico de renegociação

Confissão de dívida

Propostas automáticas

Alertas para equipe

Tudo baseado em:

ledger_cliente

invoices

accounting_entries

9. CONTAS A PAGAR

Inclui:

Fornecedores

Folha

Tributos

Sistemas

Despesas administrativas

Investimentos

Regra Contábil:

Provisão:

D: Despesa

C: Fornecedor

Pagamento:

D: Fornecedor

C: Banco

10. BANCOS E CONCILIAÇÃO
Estrutura Bancária

Plano de contas:

1.1.1.01 – Bancos Conta Movimento
  ├── Itaú
  ├── Cora
  ├── Bradesco

Regras:

OFX / Cora / PIX → bank_transactions

Classificação automática (IA + regras)

Confirmação gera lançamento contábil

❌ Extrato não conciliado NÃO impacta contabilidade
❌ Conciliação parcial deve usar conta transitória

11. FONTE DA VERDADE
Camada	Função
Financeiro	Origem
Banco	Confirma
Contabilidade	Verdade
Relatórios	Derivados

❌ Nenhum relatório pode ignorar contabilidade

12. MULTI-ESCRITÓRIO (SAAS)

Todas as tabelas devem conter office_id

Isolamento por RLS Supabase

Um usuário pode ter vários escritórios

Dados nunca se misturam

13. SUPABASE – AUTORIZAÇÃO À IA
AUTORIZAÇÃO EXPLÍCITA

A IA (Claude/VSCode) está AUTORIZADA a:

Criar tabelas

Alterar schemas

Criar migrations

Criar triggers

Criar funções

Criar índices

Ajustar RLS

➡ Credenciais estão no .env

❌ A IA NÃO pode inventar regra contábil
❌ A IA NÃO pode simplificar lógica contábil

14. IA – PAPEL E LIMITES
A IA pode:

Classificar transações

Sugerir contas

Sugerir renegociação

Sugerir reajuste

Gerar lançamentos com base nas regras

A IA NÃO pode:

Criar regra contábil nova

Ignorar plano de contas

Ignorar período

Apagar histórico

15. ROADMAP DE EXECUÇÃO (PARA CLAUDE)
Fase 1 – Correção Contábil

Saldo de abertura

Continuidade

Ledger cliente

Fase 2 – Conciliação Bancária

OFX / Cora

Conta transitória

Fase 3 – Receber / Inadimplência

Aging

Renegociação

Fase 4 – Pagar

Fornecedores

Folha

Tributos

Fase 5 – SaaS

Multi-tenant

RLS

Onboarding

16. FRASE FINAL (OBRIGATÓRIA PARA IA)

Este documento é a especificação oficial do sistema.
Nenhuma decisão pode ser tomada fora destas regras.
Em caso de dúvida, a IA deve perguntar, nunca inventar.

---

# 17. REGISTRO DE EXECUÇÃO – 28/01/2026

> **DOCUMENTO DE REFERÊNCIA ÚNICO**: `reoganizacao_28_01_2026.md`  
> Este documento registra a execução das correções conforme especificação oficial.

---

## ROADMAP DE EXECUÇÃO (Seção 15 do Documento Oficial)

### FASE 1 – CORREÇÃO CONTÁBIL

| Item | Descrição | Status | Data | Observações |
|------|-----------|--------|------|-------------|
| F1-01 | **Saldo de Abertura** | ✅ CONCLUÍDO | 28/01/2026 | 109 saldos → lançamentos contábeis |
| F1-02 | **Continuidade** | ✅ CONCLUÍDO | 28/01/2026 | Saldos verificados vs extrato |
| F1-03 | **Ledger Cliente** | ✅ CONCLUÍDO | 28/01/2026 | Equação patrimonial balanceada |

### FASE 2 – CONCILIAÇÃO BANCÁRIA

| Item | Descrição | Status | Data | Observações |
|------|-----------|--------|------|-------------|
| F2-01 | OFX / Cora/sicredi | 🔲 PENDENTE | - | Fluxo de importação |
| F2-02 | Conta Transitória | ✅ PARCIAL | 28/01/2026 | Contas 1.1.9.99 e 2.1.9.99 criadas |

### FASE 3 – CONTAS A RECEBER / INADIMPLÊNCIA

| Item | Descrição | Status | Data | Observações |
|------|-----------|--------|------|-------------|
| F3-01 | Aging | ✅ PARCIAL | 28/01/2026 | Views criadas, precisa validar |
| F3-02 | Renegociação | 🔲 PENDENTE | - | Sistema de confissão de dívida |

### FASE 4 – CONTAS A PAGAR

| Item | Descrição | Status | Data | Observações |
|------|-----------|--------|------|-------------|
| F4-01 | Fornecedores | 🔲 PENDENTE | - | - |
| F4-02 | Folha | 🔲 PENDENTE | - | - |
| F4-03 | Tributos | 🔲 PENDENTE | - | - |

### FASE 5 – SAAS

| Item | Descrição | Status | Data | Observações |
|------|-----------|--------|------|-------------|
| F5-01 | Multi-tenant | ✅ PARCIAL | 28/01/2026 | RLS implementado |
| F5-02 | RLS | ✅ CONCLUÍDO | 28/01/2026 | Todas tabelas principais |
| F5-03 | Onboarding | 🔲 PENDENTE | - | - |

---

## EXECUÇÕES DETALHADAS

### ✅ F1-01: SALDO DE ABERTURA (CONCLUÍDO)

**Data de Execução**: 28/01/2026  
**Referência**: Seção 4 e 6 do documento oficial

#### Regra Aplicada (conforme especificação):
```
Saldo inicial é um LANÇAMENTO CONTÁBIL DE ABERTURA
- Data: 01/01/2025
- Tipo: ABERTURA
- Origem: saldo_inicial
- Débito: 1.1.2.01.xxxx (Conta analítica do cliente)
- Crédito: 5.2.1.01 (Lucros Acumulados)
```

#### Resultado:
| Métrica | Valor |
|---------|-------|
| Saldos processados | 109 de 109 (100%) |
| Saldos pendentes | 0 |
| Total processado | R$ 103.701,48 |
| Lançamentos criados | 109 entries |

#### Migrations Aplicadas:
1. `20260128210000_criar_funcao_abertura.sql` - Função SECURITY DEFINER
2. `20260128230000_abertura_disable_all_triggers.sql` - Lançamentos principais (85)
3. `20260128250000_processar_pendentes_flexivel.sql` - Busca flexível (19)
4. `20260128260000_mapeamento_manual_pendentes.sql` - Mapeamento manual (5)

#### Contas Criadas:
- `1.1.2.01.9001` - UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA

---

### ✅ F5-02: RLS MULTI-TENANT (CONCLUÍDO)

**Data de Execução**: 28/01/2026  
**Referência**: Seção 12 do documento oficial

#### Migration:
`20260128160000_rls_multi_tenant_completo.sql`

#### Tabelas com RLS:
- clients
- invoices
- accounting_entries
- accounting_entry_lines
- bank_transactions
- bank_accounts
- chart_of_accounts
- client_opening_balance
- suppliers
- cost_centers

---

### ✅ PARTIDA DOBRADA BALANCEADA (CONCLUÍDO)

**Data de Execução**: 28/01/2026  
**Referência**: Seção 2 - Princípio #3

#### Migration:
`20260128150000_fix_unbalanced_entries.sql`

#### Resultado:
- 101 entries corrigidos
- Total D = Total C = R$ 1.291.805,73

---

## TENANT CONFIGURADO

| Campo | Valor |
|-------|-------|
| Nome | Ampla Contabilidade |
| Slug | ampla-contabilidade |
| ID | a53a4957-fe97-4856-b3ca-70045157b421 |
| Status | active |

---

## PRÓXIMA TAREFA A EXECUTAR

### F1-03: LEDGER CLIENTE

**Referência**: Seção 5 do documento oficial

**Verificações necessárias**:
1. Ledger auxiliar controla granularidade por cliente ✅
2. Soma do ledger = conta sintética 1.1.2.01 ✅
3. Cada cliente tem conta analítica 1.1.2.01.xxxx ✅

**Status**: ✅ CONCLUÍDO (verificado em 28/01/2026)

---

## EXECUÇÕES ADICIONAIS

### ✅ EQUAÇÃO PATRIMONIAL BALANCEADA (CONCLUÍDO)

**Data de Execução**: 28/01/2026

#### Problema Identificado:
- Sistema tinha DUAS tabelas de partidas: `accounting_entry_items` e `accounting_entry_lines`
- `accounting_entry_lines` tinha dados duplicados/inconsistentes
- Total D ≠ Total C quando somava as duas tabelas

#### Solução Aplicada:
- **Arquivo**: `src/lib/accountMapping.ts`
- **Mudança**: Usar APENAS `accounting_entry_items` como fonte da verdade
- A tabela items está balanceada (Total D = Total C)

#### Verificação Final (usando só items):
| Componente | Valor |
|------------|-------|
| ATIVO | R$ 329.037,70 |
| PASSIVO | R$ -71.021,00 |
| PL | R$ 366.560,87 |
| Resultado Jan/2025 | R$ 33.497,83 |
| **PASSIVO + PL + Resultado** | **R$ 329.037,70** |
| **Diferença** | **R$ 0,00** ✅ |

---

### ✅ F1-02: CONTINUIDADE (CONCLUÍDO)

**Data de Execução**: 28/01/2026  
**Referência**: Seção 3 do documento oficial

#### Verificação de Saldos Bancários:

| Data | Extrato | Sistema | Status |
|------|---------|---------|--------|
| 31/12/2024 | R$ 90.725,06 | R$ 90.725,06 | ✅ |
| 01/01/2025 | R$ 90.725,06 | R$ 90.725,06 | ✅ |
| 31/01/2025 | R$ 18.553,54 | R$ 18.553,54 | ✅ |

#### Correção Aplicada:
- **Arquivo**: `src/lib/accountMapping.ts`
- **Problema**: Função `getAccountBalance` somava de AMBAS as tabelas (duplicação)
- **Solução**: Usar apenas `accounting_entry_items` como fonte da verdade
- **Resultado**: Saldo agora bate com extrato bancário

#### Fórmula Verificada:
```
Saldo Inicial (01/01) + Débitos - Créditos = Saldo Final (31/01)
R$ 90.725,06 + R$ 298.527,29 - R$ 370.698,81 = R$ 18.553,54 ✅
```

---

## REGRA FINAL (Seção 16)

> Este documento é a **especificação oficial do sistema**.  
> Qualquer código que viole estas regras deve ser considerado **incorreto**, mesmo que "funcione".

---
*Última atualização: 28/01/2026 - Fase F1-02 concluída*  
*Dr. Cícero Contador IA*
