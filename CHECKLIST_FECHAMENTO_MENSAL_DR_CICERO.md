# ✅ CHECKLIST DE FECHAMENTO CONTÁBIL–FINANCEIRO MENSAL

**Padrão Dr. Cícero / Ampla Contabilidade**  
**Versão:** 1.0  
**Data:** 29/01/2026  
**Aplicável a:** Empresas do Simples, Presumido e Real

---

## 🎯 OBJETIVO

Garantir que o mês esteja **íntegro, conciliado, classificado e pronto para apuração fiscal**, sem riscos futuros.

---

## 🟦 ETAPA 1 – INTEGRIDADE DO SISTEMA (OBRIGATÓRIA)

- [ ] Executar rotina de integridade geral

```sql
SELECT rpc_check_accounting_integrity('a53a4957-fe97-4856-b3ca-70045157b421');
```

**Validar:**

- [ ] Não existem lançamentos órfãos
- [ ] Todas as contas usadas existem no plano de contas
- [ ] Não há linhas contábeis sem débito/crédito
- [ ] Não há lançamentos sem data ou fora da competência

> 📌 **Se falhar aqui → NÃO PROSSEGUIR**

---

## 🟦 ETAPA 2 – CONCILIAÇÃO BANCÁRIA

- [ ] Conferir se todas as transações bancárias do mês estão importadas
- [ ] Verificar se há transações com:
  - `is_reconciled = false`
  - `status = 'pending'`
  - `journal_entry_id IS NULL`

```sql
SELECT COUNT(*) AS pendentes
FROM bank_transactions
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND transaction_date BETWEEN '2025-01-01' AND '2025-01-31'
  AND is_reconciled = false;
```

✔️ **Resultado esperado:** `0 pendentes`

---

## 🟦 ETAPA 3 – CONTA TRANSITÓRIA (PONTO CRÍTICO)

### 3.1 Conferência de saldo global

- [ ] Conferir saldo da transitória (1.1.9.01 e 2.1.9.01)

```sql
SELECT * FROM vw_transitory_balances;
```

✔️ **Resultado esperado:**
- Saldo zerado OU compensado logicamente
- Nenhuma diferença inexplicável

### 3.2 Validação lógica (não apenas visual)

- [ ] Confirmar que toda entrada na transitória possui:
  - [ ] Classificação correspondente
  - [ ] Mesma origem econômica
  - [ ] Mesmo valor

> 📌 **Atenção:**
> - Débito ≠ erro
> - Crédito ≠ erro
> - **Erro é saldo econômico sem correspondência**

---

## 🟦 ETAPA 4 – CLASSIFICAÇÃO CONTÁBIL

- [ ] Todas as receitas estão em contas finais (3.x / 4.x / 5.x)
- [ ] Todas as despesas estão corretamente classificadas
- [ ] Não existe lançamento relevante em "OUTROS" sem justificativa

**Checklist mínimo:**

- [ ] Receitas operacionais
- [ ] Receitas financeiras
- [ ] Despesas operacionais
- [ ] Tributos
- [ ] Pró-labore / retiradas
- [ ] Tarifas bancárias

---

## 🟦 ETAPA 5 – ANÁLISE DE COERÊNCIA

- [ ] Receita contábil ≈ movimentação bancária
- [ ] Despesas compatíveis com porte da empresa
- [ ] Não há duplicidade de receita
- [ ] Não há despesas sem lastro bancário ou documental

> 📌 **Aqui entra olho de contador, não só SQL.**

---

## 🟦 ETAPA 6 – BLOQUEIOS E CONTROLE

- [ ] Marcar mês como **FECHADO** no sistema
- [ ] Bloquear:
  - Exclusão de lançamentos
  - Alteração de valores
  - Reclassificações retroativas
- [ ] Liberar somente mediante:
  - Autorização do responsável técnico
  - Log de auditoria

```sql
-- Exemplo de bloqueio de período
INSERT INTO period_closings (tenant_id, period_year, period_month, closed_at, closed_by, notes)
VALUES (
  'a53a4957-fe97-4856-b3ca-70045157b421',
  2025,
  1,
  NOW(),
  'Dr. Cícero',
  'Fechamento mensal conforme checklist padrão'
);
```

---

## 🟦 ETAPA 7 – PREPARAÇÃO FISCAL

- [ ] Base pronta para:
  - DAS (Simples)
  - IRPJ/CSLL (Presumido/Real)
  - PIS/COFINS
  - ICMS/ISS (se aplicável)
- [ ] Receita do mês validada
- [ ] Competência correta

---

## 🟦 ETAPA 8 – DOCUMENTAÇÃO (ESSENCIAL)

- [ ] Gerar relatório de fechamento contendo:
  - Saldo bancário
  - Saldo contábil
  - Situação da transitória
  - Declaração de inexistência de pendências
- [ ] Salvar:
  - SQLs de conferência
  - Logs de integridade
  - Evidências bancárias

---

## 🟦 ETAPA 9 – DECLARAÇÃO TÉCNICA

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         DECLARAÇÃO DE FECHAMENTO                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  "Declaro que os registros contábeis e financeiros referentes à competência    ║
║  ____/____ foram analisados, conciliados e classificados, encontrando-se       ║
║  íntegros e aptos para apuração fiscal e demonstrações contábeis, conforme     ║
║  as normas contábeis vigentes."                                                ║
║                                                                                ║
║  Responsável: _________________________________________                        ║
║                                                                                ║
║  CRC: _________________________________________________                        ║
║                                                                                ║
║  Data: ________________________________________________                        ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 🎯 RESULTADO FINAL ESPERADO

| Item | Status |
|------|--------|
| Mês fechado com segurança | ✔️ |
| Zero retrabalho futuro | ✔️ |
| Tranquilidade em fiscalização | ✔️ |
| ERP confiável | ✔️ |
| Processo escalável | ✔️ |

---

## 📋 HISTÓRICO DE FECHAMENTOS

| Competência | Data Fechamento | Responsável | Status |
|-------------|-----------------|-------------|--------|
| Janeiro/2025 | 29/01/2026 | Dr. Cícero | ✅ FECHADO |
| Fevereiro/2025 | - | - | ⏳ Pendente |
| ... | ... | ... | ... |

---

**Documento elaborado por:**  
**Dr. Cícero** - Contador Responsável  
Ampla Contabilidade

*Este checklist deve ser aplicado mensalmente para garantir a integridade contábil-financeira.*
