# AMPLA FINANCEIRO — Plano de Correção Completa (AI First) + Prompt Mestre para o VSCode/Claude
Data: 28/01/2026 (America/Sao_Paulo)

> Objetivo: transformar o “Ampla Financeiro” em **SaaS multi-tenant** (vários escritórios), com **contas a pagar/receber robusto**, **inadimplência**, **conciliação bancária**, e **contabilidade por partidas dobradas** (padrão ECD/SPED como *referência de qualidade e versionamento*), integrado ao **Supabase** e pronto para integrar **Banco Cora (API + webhooks)**.  
> Regra de ouro: **não inventar**. Se faltar dado, criar estrutura, logs e validações para capturar o dado real.

---

## 0) O que eu já identifiquei no material enviado (ponto de partida)
### 0.1 Frontend / App
- Existe build em `dist/` e HTMLs (ex.: `financeiro3.html`), indicando app rodando em **modo estático**.
- O JS do build chama **Supabase RPC** `get_account_balances(...)` (isso é bom: saldos calculados no banco).
- Existem pastas como `mcp-financeiro/` (com `dist/` e `node_modules/`), mas **aparentemente sem o código-fonte TS** (somente artefatos compilados).

**Implicação prática:** para evoluir rápido e com segurança, precisamos trabalhar com o **código-fonte** (TS/React/Node) — não só “dist”.

### 0.2 Supabase (migrations)
- Há migrations SQL bem completas e uma função `get_account_balances(p_period_start, p_period_end)` que:
  - considera `SALDO_ABERTURA` (case insensitive),
  - soma lançamentos de duas tabelas (`accounting_entry_lines` e `accounting_entry_items`),
  - usa `competence_date` ou fallback para `entry_date`,
  - totaliza contas sintéticas por prefixo (hierarquia do plano).
- Isso conversa diretamente com sua dor: “saldo de abertura some”, “saldo de cliente a receber não aparece”.

**Implicação prática:** o problema geralmente não é o conceito e sim:
- **onde** o saldo está sendo gravado (lines vs items),
- **como** o entry_type está sendo salvo (variações),
- se há **tenant_id/filtro** indevido,
- e se o plano de contas/contas do cliente estão sendo usadas no lançamento certo.

---

## 1) Checklist do que falta para ficar “produto SaaS premium”
### Prioridade CRÍTICA (sem isso o sistema nunca fica confiável)
1. **Fonte do projeto (sem dist apenas)**  
   - Garantir repositório com `package.json`, `src/`, `tsconfig`, etc.
   - Remover `node_modules/` do repositório/zip (substituir por lockfile).
2. **Persistência completa no Supabase** (nada em memória)
   - Clientes, contratos, honorários, títulos, despesas, transações bancárias, lançamentos, plano de contas, centros de custo.
3. **Multi-tenancy real (SaaS)**  
   - `tenant_id` em 100% das tabelas + RLS (Row Level Security).
   - `tenant_users` + papéis/permissões.
4. **Contas a receber “de verdade” (títulos + baixa + renegociação)**
   - Recorrência, 13º, % faturamento, legalização, holding, avulsos, permuta, descontos.
5. **Conciliação bancária com trilha contábil**
   - Transação bancária -> conciliação -> lançamento (partida dobrada).
6. **Relatórios gerenciais** (fluxo de caixa, aging, inadimplência, DRE/razão/balancete)
   - Tudo explicado com rastreabilidade: “de onde veio cada número”.
7. **Integração Banco Cora**
   - Webhook + sincronização + idempotência + conciliação automática.

### Prioridade ALTA (produto vendável e escalável)
8. **Motor de regras + “aprendizado supervisionado”** para classificar transações
   - Regras determinísticas primeiro, ML depois.
9. **Pipeline de cobrança (D+1, D+7, D+15...)** com scripts e histórico
10. **Auditoria e versionamento**
   - Quem alterou, quando, antes/depois, justificativa.

---

## 2) Modelo de dados mínimo (Supabase) — sem achismo e sem “buracos”
> Abaixo está o “mínimo que não pode faltar” para suportar sua operação (AMPLA) e virar SaaS.

### 2.1 Tabelas essenciais
**Tenancy**
- `tenants` (id, nome, cnpj, plano, status, settings)
- `tenant_users` (tenant_id, user_id, role, permissions, ativo)

**Cadastro**
- `clients` (tenant_id, id, nome, cpf_cnpj, contatos, status, segmento, tags)
- `services_catalog` (tenant_id, id, nome_servico, tipo, precificacao_default)

**Contrato e precificação**
- `service_contracts` (tenant_id, id, client_id, status, inicio, reajuste_indexador, regra_salario_minimo)
- `contract_items` (tenant_id, id, contract_id, service_id, pricing_type, valor_fixo, percentual, regra_13, regra_evento)
  - `pricing_type`: FIXO | SM | PERCENTUAL | AVULSO | PACOTE
  - `regra_13`: true/false e competência
  - `regra_evento`: legalização, alteração, alvará, holding etc.

**Faturamento / Cobrança**
- `invoices` (tenant_id, id, client_id, competencia, emissao, vencimento, status, total, origem)
- `invoice_items` (tenant_id, invoice_id, service_id, descricao, quantidade, valor, total)
- `payments` (tenant_id, id, invoice_id, bank_transaction_id, data, valor, meio, obs)

**A pagar**
- `vendors` (tenant_id, id, nome, doc, categoria_default)
- `expenses` (tenant_id, id, vendor_id, competencia, vencimento, valor, status, centro_custo, doc_ref)
- `expense_payments` (tenant_id, expense_id, bank_transaction_id, data, valor)

**Bancos**
- `bank_accounts` (tenant_id, id, banco, agencia, conta, pix_key, cora_account_id)
- `bank_transactions` (tenant_id, id, bank_account_id, posted_at, amount, direction, description, external_id, raw_json, reconciled_at)

**Contabilidade**
- `chart_of_accounts` (tenant_id, id, code, name, nature, is_analytical, parent_code, ref_sped, is_active)
- `accounting_entries` (tenant_id, id, entry_date, competence_date, entry_type, history, doc_ref, created_by)
- `accounting_entry_lines` (tenant_id, entry_id, account_id, cost_center_id, debit, credit, memo)
- `cost_centers` (tenant_id, id, code, name, mapping_rules)

**Auditoria**
- `audit_log` (tenant_id, id, entity, entity_id, action, before, after, user_id, created_at)

### 2.2 Views / RPC indispensáveis
- `get_account_balances(p_start, p_end)` ✅ (já existe; manter e testar)
- `get_ar_aging(competencia_end)` → “aging” por cliente (0-30/31-60/61-90/90+)
- `get_cash_flow(p_start, p_end)` → entradas/saídas por dia
- `get_client_ledger(client_id, p_start, p_end)` → razão do cliente (recebíveis + baixas + renegociações)

---

## 3) Regras de negócio da AMPLA (o que a IA precisa respeitar)
### 3.1 Honorários
Você citou que existe:
1. **Mensal fixo** (valor direto)
2. **Mensal por Salário Mínimo (SM)**: `honorario = qtd_sm * salario_minimo_vigente`
3. **Honorário “13º”** (competência específica, normalmente 12/ano ou quando definido)
4. **Honorário % sobre faturamento bruto** (ex.: 0,5% da receita do cliente)
5. **Legalização** (abertura/baixa/alteração/alvará) — avulso
6. **Holding** (projeto/avulso + possivelmente manutenção)
7. **Permuta** (pagamento não financeiro: precisa registrar como quitação por permuta, com documento/justificativa)

**Regras obrigatórias**
- Cliente cadastrado **não pode ficar sem contrato/honorários**.
- Todo serviço adicional detectado (mais funcionários, mais notas, mudança regime, etc.) deve gerar:
  1) **alerta** (“oportunidade de reajuste”), e
  2) **proposta automática** (rascunho), e
  3) sugestão de **aditivo contratual**.

### 3.2 Inadimplência (cobrança)
- Status do cliente e dos títulos precisa ser coerente:
  - `invoice.status`: aberto | pago | vencido | renegociado | cancelado
  - `client.status`: ativo | inadimplente | suspenso | inativo
- Regras D+1, D+7, D+15, D+30, D+60 (como no seu MCP).
- Cada ação gera histórico auditável.

### 3.3 Contabilidade (partida dobrada)
- Todo recebimento/pagamento conciliado deve gerar lançamento:
  - Recebimento honorários: **D Banco / C Receita**
  - Pagamento despesas: **D Despesa / C Banco**
- **Saldo de abertura**
  - Deve ser lançado como `entry_type = 'SALDO_ABERTURA'`
  - Deve existir no período de 01/01/AAAA, baseado no fechamento 31/12/AAAA-1.
- Contas sintéticas **não** recebem lançamento (apenas totalizam).

---

## 4) Por que “sumiu” saldo e como blindar isso (solução técnica)
### 4.1 Causa mais comum (do que você descreveu)
- O lançamento de saldo de abertura foi gravado:
  - com `entry_type` diferente (ex.: “saldo_abertura”, “SALDO ABERTURA”, etc.),
  - ou na tabela “errada” (items vs lines),
  - ou com data fora do período,
  - ou sem vínculo correto com `account_id` do plano.
- Em algumas telas, o frontend pode estar filtrando só `is_analytical=true`, escondendo o saldo se estiver numa conta sintética.

### 4.2 Como resolver de forma definitiva
- Padronizar enum/validação no banco:
  - `entry_type` como ENUM (ex.: `NORMAL`, `SALDO_ABERTURA`, `ENCERRAMENTO`, `AJUSTE`)
- Criar constraints/triggers:
  - **entry lines** devem ter `debit XOR credit` (não ambos)
  - `sum(debit) == sum(credit)` por `entry_id`
- Testes automatizados (SQL):
  - “balancete bate”, “saldo de abertura aparece”, “hierarquia soma”.

---

## 5) Integração Cora (API) — arquitetura que não dá dor de cabeça
### 5.1 Princípios
- **Idempotência**: cada transação vinda do Cora deve ter `external_id` único.
- **Webhook-first** + sync incremental (por segurança).
- Guardar o `raw_json` completo.
- Conciliar por:
  - match de valor + data + descrição + nosso número / referência,
  - e depois por regra aprendida.

### 5.2 Fluxo
1) Webhook recebe evento do Cora (crédito/débito)
2) Grava em `bank_transactions` (se não existir)
3) Motor de conciliação:
   - tenta vincular a `invoice` ou `expense`
   - se confiança alta, baixa automática
   - se média/baixa, cria tarefa para revisão
4) Ao confirmar conciliação:
   - gera `payments` ou `expense_payments`
   - cria `accounting_entries` + `accounting_entry_lines`
   - marca `reconciled_at`

---

## 6) AI First na prática (onde compensa e onde NÃO compensa)
### 6.1 Onde compensa MUITO (ROI alto)
1. **Classificação de transações** (regras + IA)
2. **Detecção de anomalias** (duplicidade, lançamento invertido, despesas fora do padrão)
3. **Cobrança** (texto, canal, timing, negociação sugerida)
4. **Precificação** (sugerir reajuste por complexidade e mercado)
5. **Suporte** (chatbot interno para equipe + portal do cliente)

### 6.2 Onde NÃO compensa (ou é perigoso)
1. “IA criando contabilidade” sem trilha e validação  
   → Contabilidade é **determinística**. IA só sugere; o motor contábil valida.
2. RAG para “calcular” valores  
   → RAG é para **buscar informação**, não para fazer conta.
3. IA alterando migrations automaticamente sem revisão  
   → deve gerar PR/patch e você aprova.

### 6.3 Onde o Data Lake entra
- Data Lake vale quando você for integrar:
  - bancos (Cora + outros),
  - NF-e/NFS-e,
  - folha,
  - Domínio/ERP legado,
  - CRM e atendimento,
  - e quiser análises históricas profundas.
- Para o “core” do financeiro/contabilidade, o **Postgres/Supabase** já resolve muito bem.
- Data Lake pode ser fase 2/3, sem travar o produto.

---

## 7) Prompt Mestre para o VSCode/Claude (execução sem invenção)
> Copie e cole este bloco no Claude Code (VSCode).  
> Objetivo: **corrigir e evoluir** a aplicação, preservando o que já funciona.

### 7.1 Regras de execução (obrigatórias)
1. Nunca invente dados. Se faltar, criar tabela/campo e registrar logs para capturar o dado real.
2. Todas alterações em banco devem ser via **migrations versionadas**.
3. Nunca quebrar compatibilidade: criar `v1` e migrar por etapas.
4. Toda regra crítica deve ter teste (SQL ou unit).
5. Multi-tenant obrigatório (tenant_id + RLS).
6. Separar “motor contábil determinístico” de “IA sugestiva”.

### 7.2 Tarefas (ordem de execução)
**Tarefa A — Diagnóstico de Código**
- Mapear estrutura do projeto (frontend, backend, MCP, supabase).
- Identificar onde estão:
  - criação de clientes
  - geração de títulos
  - conciliação
  - criação de lançamentos contábeis
  - leitura de saldos (RPC)
- Gerar relatório `DIAGNOSTICO_TECNICO.md` com:
  - árvore de pastas
  - rotas/handlers
  - principais módulos
  - pontos de bug prováveis do “saldo sumindo”.

**Tarefa B — Padronizar Contabilidade**
- Garantir enums/constraints para `entry_type`.
- Garantir que saldo de abertura seja gravado corretamente.
- Garantir que o plano de contas suporte:
  - hierarquia
  - conta analítica vs sintética
  - natureza (devedora/credora)
  - ref SPED (opcional)
- Corrigir telas para mostrar saldo em:
  - conta analítica (saldo direto)
  - conta sintética (saldo totalizado)

**Tarefa C — AR/AP completo**
- Implementar contratos + itens + regras de precificação (FIXO/SM/%/AVULSO).
- Rotina de geração automática de faturas (invoices) por competência.
- Baixa por pagamento manual e por conciliação bancária.
- Renegociação:
  - parcelamento
  - desconto
  - permuta
  - registro auditável.

**Tarefa D — Integração Cora**
- Criar módulo `cora/` com:
  - client API
  - webhook receiver
  - sync job incremental
  - idempotência
- Vincular com conciliação e baixa.

**Tarefa E — AI First (agentes)**
- Criar “camada de agentes” como serviços chamáveis:
  - `agent_classify_transaction`
  - `agent_suggest_fee_adjustment`
  - `agent_collection_next_action`
- IA só retorna: sugestão + confiança + justificativa + evidências.
- A aplicação executa **somente** após validação/regra/usuário.

### 7.3 Entregáveis (arquivos)
- `DIAGNOSTICO_TECNICO.md`
- `MODELO_DADOS_SUPABASE.md` (ERD + tabelas + RLS)
- `CHECKLIST_RELEASE.md` (o que testar antes de publicar)
- `PROMPTS_AGENTES.md` (prompts e contratos de função)
- `RUNBOOK_OPERACIONAL.md` (rotina do escritório)

---

## 8) Arquivos adicionais que ajudam muito (se você quiser melhorar ainda mais a precisão)
Você já enviou bastante e dá para avançar.  
Mas para ser 100% assertivo no código, os itens abaixo são os que mais aceleram:

1. **Código-fonte do frontend** (pasta `src/` do Vite/React, se existir)
2. **Código-fonte do backend/API** (rotas, handlers, middlewares)
3. `.env.example` (sem segredos) apenas com nomes de variáveis esperadas
4. Se houver: `supabase/functions/` (Edge Functions) e `supabase/seed.sql`
5. Fluxos reais de “honorário por SM” e “% faturamento” (1 exemplo de cada, com números)

---

## 9) Próximo passo imediato (o que eu faria agora)
1) Consolidar tudo num repositório limpo (fonte + migrations)  
2) Rodar local com Supabase (ou projeto remoto) e validar:
   - criação de saldo abertura
   - geração de títulos
   - conciliação -> lançamento
   - balancete/razão  
3) Fechar o “core SaaS multi-tenant” e só depois expandir Data Lake/RAG.

---

**Fim do documento.**
