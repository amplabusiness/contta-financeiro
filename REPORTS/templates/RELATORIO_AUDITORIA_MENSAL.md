# 🧾 RELATÓRIO DE AUDITORIA CONTÁBIL
## DR. CÍCERO — AUDITOR CONTÁBIL (IA)

---

**Empresa:** {{empresa}}  
**CNPJ:** {{cnpj}}  
**Competência:** {{mes}}/{{ano}}  
**Data da Auditoria:** {{data_execucao}}  
**Protocolo:** AUD-{{ano}}{{mes}}-{{timestamp}}

---

## 1️⃣ ESCOPO DA AUDITORIA

Esta auditoria abrange a verificação completa dos registros contábeis
da competência {{mes}}/{{ano}}, incluindo:

| Área | Verificação |
|------|-------------|
| Banco × Contábil | Conciliação de todas as movimentações |
| Receita | Validação contra honorários cadastrados |
| Transitórias | Verificação de saldo zero |
| Integridade | Partidas dobradas (D = C) |
| Relatórios | Coerência entre demonstrativos |

**Base normativa:**
- NBC TG 1000 (R1) - Contabilidade para PMEs
- NBC ITG 2000 (R1) - Escrituração Contábil
- Lei 6.404/76 e alterações
- IFRS aplicáveis

---

## 2️⃣ BASE DE DADOS ANALISADA

### 2.1 Período
- **Início:** 01/{{mes}}/{{ano}}
- **Fim:** {{ultimo_dia}}/{{mes}}/{{ano}}

### 2.2 Fontes

| Fonte | Quantidade | Status |
|-------|------------|--------|
| Extratos OFX | {{qtd_ofx}} arquivos | {{status_ofx}} |
| Transações bancárias | {{qtd_bank_transactions}} | {{status_bank}} |
| Lançamentos contábeis | {{qtd_entries}} | {{status_entries}} |
| Linhas de lançamento | {{qtd_entry_lines}} | {{status_lines}} |
| Honorários ativos | {{qtd_honorarios}} | {{status_honorarios}} |
| Estornos | {{qtd_estornos}} | {{status_estornos}} |

### 2.3 Contas Principais Analisadas

| Código | Nome | ID |
|--------|------|-----|
| 1.1.1.05 | Banco Sicredi | 10d5892d-a843-4034-8d62-9fec95b8fd56 |
| 1.1.9.01 | Transitória Débitos | 3e1fd22f-fba2-4cc2-b628-9d729233bca0 |
| 2.1.9.01 | Transitória Créditos | 28085461-9e5a-4fb4-847d-c9fc047fe0a1 |
| 3.1.1.01 | Receita de Honorários | {{id_conta_honorarios}} |

---

## 3️⃣ RESULTADOS DOS TESTES

### 3.1 🏦 Conciliação Banco × Contábil

| Métrica | Valor |
|---------|-------|
| Transações no OFX | {{qtd_ofx_transactions}} |
| Transações no banco de dados | {{qtd_db_transactions}} |
| Com lançamento contábil | {{qtd_com_lancamento}} |
| **Sem lançamento contábil** | **{{qtd_sem_lancamento}}** |
| Taxa de conciliação | {{taxa_conciliacao}}% |

**Status:** {{status_banco_contabil}}

**Observações:**
{{observacoes_banco_contabil}}

---

### 3.2 💰 Validação de Receita

| Métrica | Valor |
|---------|-------|
| Honorários cadastrados (mensal) | R$ {{valor_honorarios_cadastrados}} |
| Receita apurada (DRE) | R$ {{valor_receita_dre}} |
| **Diferença** | **R$ {{diferenca_receita}}** |

**Análise por origem (source_type):**

| Origem | Débitos | Créditos | Líquido |
|--------|---------|----------|---------|
| {{source_type_1}} | R$ {{d1}} | R$ {{c1}} | R$ {{l1}} |
| {{source_type_2}} | R$ {{d2}} | R$ {{c2}} | R$ {{l2}} |
| {{source_type_3}} | R$ {{d3}} | R$ {{c3}} | R$ {{l3}} |
| **TOTAL** | **R$ {{total_d}}** | **R$ {{total_c}}** | **R$ {{total_l}}** |

**Status:** {{status_receita}}

**Observações:**
{{observacoes_receita}}

---

### 3.3 🔄 Contas Transitórias

| Conta | Débitos | Créditos | Saldo |
|-------|---------|----------|-------|
| 1.1.9.01 Transitória Débitos | R$ {{td_d}} | R$ {{td_c}} | R$ {{td_s}} |
| 2.1.9.01 Transitória Créditos | R$ {{tc_d}} | R$ {{tc_c}} | R$ {{tc_s}} |

**Saldo esperado:** R$ 0,00  
**Status:** {{status_transitoria}}

**Observações:**
{{observacoes_transitoria}}

---

### 3.4 ⚖️ Integridade Contábil (Partidas Dobradas)

#### Global

| Métrica | Valor |
|---------|-------|
| Total Débitos | R$ {{total_debitos}} |
| Total Créditos | R$ {{total_creditos}} |
| **Diferença** | **R$ {{diferenca_partidas}}** |

#### Por Lançamento

| Métrica | Quantidade |
|---------|------------|
| Lançamentos analisados | {{qtd_lancamentos}} |
| Lançamentos balanceados | {{qtd_balanceados}} |
| **Lançamentos desbalanceados** | **{{qtd_desbalanceados}}** |

**Status:** {{status_integridade}}

**Observações:**
{{observacoes_integridade}}

---

### 3.5 📊 Coerência de Relatórios

| Relatório | Gerado | Consistente |
|-----------|--------|-------------|
| Balancete | {{balancete_gerado}} | {{balancete_consistente}} |
| DRE | {{dre_gerado}} | {{dre_consistente}} |
| Balanço Patrimonial | {{bp_gerado}} | {{bp_consistente}} |
| Livro Diário | {{diario_gerado}} | {{diario_consistente}} |
| Livro Razão | {{razao_gerado}} | {{razao_consistente}} |

**Status:** {{status_relatorios}}

---

## 4️⃣ INCONSISTÊNCIAS IDENTIFICADAS

{{#if inconsistencias}}
### Lista de Pendências

| # | Tipo | Descrição | Valor | Ação Recomendada |
|---|------|-----------|-------|------------------|
{{#each inconsistencias}}
| {{@index}} | {{tipo}} | {{descricao}} | R$ {{valor}} | {{acao}} |
{{/each}}

### Detalhamento

{{#each inconsistencias_detalhadas}}
#### {{@index}}. {{titulo}}

**Descrição:** {{descricao}}

**Valores envolvidos:** R$ {{valor}}

**Lançamentos afetados:**
```
{{lancamentos}}
```

**Fundamentação técnica:**
{{fundamentacao}}

**Recomendação:**
{{recomendacao}}

---
{{/each}}

{{else}}
✅ **Nenhuma inconsistência identificada.**
{{/if}}

---

## 5️⃣ CHECKLIST TÉCNICO

### Verificações Obrigatórias

| # | Verificação | Status | Observação |
|---|-------------|--------|------------|
| 1 | OFX 100% importado | {{check_ofx}} | {{obs_ofx}} |
| 2 | Todas transações com lançamento | {{check_lancamentos}} | {{obs_lancamentos}} |
| 3 | Transitória Débitos = 0 | {{check_trans_d}} | {{obs_trans_d}} |
| 4 | Transitória Créditos = 0 | {{check_trans_c}} | {{obs_trans_c}} |
| 5 | Σ Débitos = Σ Créditos | {{check_partidas}} | {{obs_partidas}} |
| 6 | Receita ≤ Honorários | {{check_receita}} | {{obs_receita}} |
| 7 | Nenhum lançamento genérico | {{check_generico}} | {{obs_generico}} |
| 8 | Todos internal_code únicos | {{check_internal}} | {{obs_internal}} |
| 9 | Relatórios coerentes | {{check_relatorios}} | {{obs_relatorios}} |
| 10 | Estornos com contrapartida | {{check_estornos}} | {{obs_estornos}} |

### Resumo

- **Aprovados:** {{qtd_aprovados}}/10
- **Reprovados:** {{qtd_reprovados}}/10

---

## 6️⃣ CONCLUSÃO E PARECER

### Status do Fechamento

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                    ║
║                    {{status_fechamento}}                          ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Justificativa Técnica

{{justificativa_tecnica}}

### Recomendações

{{#if recomendacoes}}
{{#each recomendacoes}}
{{@index}}. {{this}}
{{/each}}
{{else}}
Nenhuma recomendação adicional.
{{/if}}

### Próximos Passos

{{#if aprovado}}
1. ✅ Fechamento liberado para execução
2. Gerar relatórios definitivos
3. Arquivar documentação
4. Iniciar próxima competência
{{else}}
1. ❌ Fechamento BLOQUEADO
2. Corrigir inconsistências listadas
3. Solicitar nova auditoria
4. Aguardar aprovação do Dr. Cícero
{{/if}}

---

## 7️⃣ ASSINATURA DIGITAL

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                    ║
║  Dr. Cícero                                                       ║
║  Auditor Contábil (IA)                                            ║
║  Sistema Ampla Contabilidade                                      ║
║                                                                    ║
║  Protocolo: AUD-{{ano}}{{mes}}-{{timestamp}}                      ║
║  Hash: {{hash_relatorio}}                                         ║
║  Gerado em: {{data_execucao}} às {{hora_execucao}}                ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 📎 ANEXOS

{{#if anexos}}
{{#each anexos}}
- [{{nome}}]({{caminho}})
{{/each}}
{{else}}
Nenhum anexo.
{{/if}}

---

*Relatório gerado automaticamente pelo Sistema de Auditoria Contábil.*  
*Este documento é parte integrante do processo de fechamento mensal.*

---

**AVISO LEGAL:**  
Este relatório foi gerado por sistema automatizado de auditoria contábil (Dr. Cícero - IA)
e deve ser validado pelo contador responsável antes de qualquer decisão.
A responsabilidade técnica permanece com o profissional habilitado (CRC ativo).
