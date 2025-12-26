# 🚨 PLANO DE SEGURANÇA URGENTE - Projeto "honorario"

**Data:** 26 de Dezembro de 2025  
**Projeto:** amplabusiness/honorario (PRODUÇÃO)  
**Status:** 441 Issues de Segurança Detectadas  
**Prioridade:** 🔴 CRÍTICA

---

## 📊 SITUAÇÃO ATUAL

### Banco de Dados
```
Projeto: honorario
Status: Pro - Production
Tabelas: 200+
Functions: 60+
Dados: ATIVOS (23,712 requisições em 24h)
Espessura: Muito Complexo
```

### Problemas de Segurança Encontrados
```
🔴 TOTAL: 441 Issues
  ├─ 247 Issues de SEGURANÇA
  └─ 194 Issues de PERFORMANCE
```

---

## 🔐 PROBLEMAS CRÍTICOS

### 1️⃣ RLS (Row Level Security) Desabilitado - 24 TABELAS

```
⚠️ RISCO CRÍTICO: Qualquer pessoa pode acessar
   (se tiver acesso ao projeto)

Tabelas Afetadas:
  • codigos_servico_lc116      ❌
  • nfse                         ❌
  • nfse_config                  ❌
  • nfse_log                     ❌
  • recurring_expense_templates   ❌
  • empresas                      ❌
  • client_variable_fees          ❌
  • discount_approval_rules       ❌
  • holidays                      ❌
  • minimum_wage_history          ❌
  • fee_adjustment_history        ❌
  • enrichment_logs               ❌ (+ com policies)
  • irpf_declarations             ❌
  • referral_commission_payments   ❌
  • materialized_view_refresh_log ❌
  • referral_partners             ❌
  • client_referrals              ❌
  • company_service_costs         ❌
  • company_services              ❌
  • domain_events                 ❌
  • tenant_features               ❌
  • tenant_users                  ❌
  • tenants                       ❌

AÇÃO: Habilitar RLS em TODAS
```

### 2️⃣ SECURITY DEFINER em 60+ Views

```
⚠️ RISCO ALTO: Views executam com privilégios elevados

Exemplos Críticos:
  • vw_livro_razao                (Contabilidade)
  • vw_livro_diario               (Contabilidade)
  • vw_balancete                  (Contabilidade)
  • vw_dre_monthly                (Financeiro)
  • account_ledger_detail         (Contabilidade)
  • vw_nfse_tomadas_detalhada     (NFS-e)
  • vw_payroll_summary            (Folha)
  • vw_irpf_summary               (Fiscal)
  • ... (40+ mais)

AÇÃO: Revisar e remover SECURITY DEFINER
      Usar RLS em vez disso
```

### 3️⃣ Role Mutable Search Path em 100+ Functions

```
⚠️ RISCO ALTO: Functions podem executar com privilégios errados

Exemplos Críticos:
  • calculate_variable_fee        ❌
  • generate_annual_invoices      ❌
  • create_journal_entry          ❌
  • gerar_folha_mensal            ❌
  • gerar_folha_funcionario       ❌
  • calcular_inss                 ❌
  • calcular_irrf                 ❌
  • ... (100+ mais)

AÇÃO: Remover role mutable search_path
      Adicionar validações de permissão
```

### 4️⃣ Materialized Views Acessíveis por Anon

```
⚠️ RISCO MÉDIO-ALTO: Dados sensíveis expostos

Views Afetadas:
  • mv_dashboard_kpis             (KPIs da empresa)
  • mv_default_summary            (Resumo geral)
  • mv_client_balances            (Saldos de clientes)
  • mv_dre_monthly                (DRE)
  • mv_cash_flow                  (Fluxo de caixa)
  • mv_trial_balance              (Balancete)
  • account_ledger                (Razão)

AÇÃO: REVOKE SELECT FROM anon
      Deixar apenas authenticated com RLS
```

### 5️⃣ Slow Queries (23-26 segundos)

```
⚠️ RISCO DE PERFORMANCE: Schema introspection lento

Query:
  pg_get_tabledef + schema introspection
  Executada: 5 vezes
  Tempo: 23-26 segundos CADA

AÇÃO: Otimizar queries de schema
      Colocar em background job
      Não executar em crítico
```

---

## 🎯 PLANO DE AÇÃO (URGENTE)

### FASE 1: Segurança Crítica (HOJE/AMANHÃ)

```
1. Habilitar RLS nas 24 tabelas
   Tempo estimado: 1-2 horas
   
   Para cada tabela:
   ```sql
   ALTER TABLE public.TABLE_NAME ENABLE ROW LEVEL SECURITY;
   ```

2. Revogar acesso anon para Materialized Views
   Tempo estimado: 30 minutos
   
   ```sql
   REVOKE SELECT ON mv_dashboard_kpis FROM anon;
   REVOKE SELECT ON mv_default_summary FROM anon;
   -- ... etc
   ```

3. Audit de SECURITY DEFINER Views
   Tempo estimado: 2-3 horas
   Responsável: DBA/Arquiteto
```

### FASE 2: Segurança Média (ESTA SEMANA)

```
1. Remover role mutable search_path de Functions
   Tempo: 4-6 horas
   
2. Revisar cada SECURITY DEFINER View
   Tempo: 8-12 horas
   
3. Criar RLS policies apropriadas
   Tempo: 4-8 horas
```

### FASE 3: Performance (PRÓXIMAS 2 SEMANAS)

```
1. Otimizar slow queries
   Tempo: 4-8 horas
   
2. Adicionar índices se necessário
   Tempo: 2-4 horas
```

---

## 📋 CHECKLIST DE SEGURANÇA

### RLS - 24 Tabelas
- [ ] codigos_servico_lc116
- [ ] nfse
- [ ] nfse_config
- [ ] nfse_log
- [ ] recurring_expense_templates
- [ ] empresas
- [ ] client_variable_fees
- [ ] discount_approval_rules
- [ ] holidays
- [ ] minimum_wage_history
- [ ] fee_adjustment_history
- [ ] enrichment_logs (+ criar policies)
- [ ] irpf_declarations
- [ ] referral_commission_payments
- [ ] materialized_view_refresh_log
- [ ] referral_partners
- [ ] client_referrals
- [ ] company_service_costs
- [ ] company_services
- [ ] domain_events
- [ ] tenant_features
- [ ] tenant_users
- [ ] tenants

### Materialized Views - Revogar Acesso Anon
- [ ] mv_dashboard_kpis
- [ ] mv_default_summary
- [ ] mv_client_balances
- [ ] mv_dre_monthly
- [ ] mv_cash_flow
- [ ] mv_trial_balance
- [ ] account_ledger

### SECURITY DEFINER Views - 60+ (Auditar)
- [ ] Revisar cada uma
- [ ] Decidir: manter com SECURITY DEFINER ou mudar para RLS
- [ ] Implementar políticas

---

## 🔑 CREDENCIAIS NECESSÁRIAS

Para aplicar estas mudanças, você precisa:

```
1. Acesso ao Supabase como:
   • Owner da organização amplabusiness
   • Ou administrador do projeto honorario

2. Permissões no PostgreSQL:
   • superuser ou owner das tabelas
   • Criar policies RLS

3. Conhecimento de RLS do Supabase:
   • Como criar policies
   • Como testar policies
   • Como validar segurança
```

---

## ⚠️ RECOMENDAÇÕES IMEDIATAS

### 1. Não Publique Dados Sensíveis
```
❌ Não fazer isso com dados públicos:
   • Razão (vw_livro_razao)
   • Diário (vw_livro_diario)
   • DRE (vw_dre_monthly)
   • Balancete (vw_balancete)
   • Saldos de cliente (mv_client_balances)
```

### 2. Validar Acesso Atual
```
Verificar quem tem acesso:
• Colaboradores do projeto
• API keys expostas
• Clientes acessando dados
```

### 3. Backup Antes de Mudanças
```
Fazer backup COMPLETO antes de:
• Habilitar RLS
• Revogar acessos
• Alterar policies
```

---

## 🚀 PRÓXIMOS PASSOS

### Imediato (Hoje)
```
1. [ ] Notificar time de segurança
2. [ ] Fazer backup do banco
3. [ ] Planejar janela de manutenção
4. [ ] Preparar scripts SQL
```

### Curto Prazo (Esta Semana)
```
1. [ ] Aplicar mudanças de RLS
2. [ ] Revogar acesso anon
3. [ ] Testar funcionamento
4. [ ] Documentar policies
```

### Médio Prazo (2 Semanas)
```
1. [ ] Remover SECURITY DEFINER
2. [ ] Remover role mutable search_path
3. [ ] Otimizar queries
4. [ ] Validação final
```

---

## 📊 IMPACTO ESPERADO

```
Antes:
  ❌ Qualquer pessoa pode acessar (se tiver acesso ao projeto)
  ❌ Dados sensíveis expostos
  ❌ Functions executam com privilégios altos
  ❌ Performance lenta em schema queries

Depois:
  ✅ Acesso restrito por RLS
  ✅ Dados protegidos
  ✅ Functions usam privilégios mínimos
  ✅ Performance melhorada
```

---

## 📞 RESPONSABILIDADES

```
Segurança RLS:     DBA / DevOps
SECURITY DEFINER:  Arquiteto SQL / DBA
Performance:       DBA / DevOps
Testes:            QA / Desenvolvedores
Coordenação:       Tech Lead / PM
```

---

## ✅ CONCLUSÃO

Este banco está em **PRODUÇÃO** com dados sensíveis.

**AÇÃO URGENTE NECESSÁRIA:**
1. Habilitar RLS (24 tabelas)
2. Revogar acesso anon (7 views)
3. Revisar SECURITY DEFINER (60+ views)
4. Remover role mutable search_path (100+ functions)

Sem essas mudanças, dados financeiros e contábeis estão expostos!

---

**Prioridade:** 🔴 CRÍTICA  
**Tempo Estimado:** 1-2 semanas para resolver  
**Impacto:** Alto (segurança da empresa)
