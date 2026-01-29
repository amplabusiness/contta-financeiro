# 🎯 INSTRUÇÕES FASE 2 - Correção da Equação Contábil

**Data:** 11/01/2026  
**Contexto:** Após executar a Fase 1, foram removidas 991 duplicatas boleto_sicredi, mas a equação contábil ficou desbalanceada em R$ 1.023.460,95

---

## 📋 PROBLEMA A RESOLVER

Ao deletar os entries `boleto_sicredi`, foram removidas apenas as **linhas de débito no banco**, mas as **linhas de crédito nos clientes** permaneceram nos mesmos entries - deixando-os desbalanceados (débito ≠ crédito).

**Sintomas atuais:**
- Equação contábil: Diferença de R$ 1.023.460,95
- Saldo banco: R$ 161.661,49 (deveria ser ~R$ 18.553,54 para Jan/2025)
- Conta sintética: 189 lançamentos genéricos

---

## 🚀 EXECUTE NA ORDEM

### Passo 1: Diagnosticar

```bash
cd "c:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1"
node "scripts/scrip1/files/correcao_contabil/scripts/05_diagnosticar_equacao_contabil.mjs"
```

**Espere ver:** Relatório mostrando quantos entries estão desbalanceados e por qual source_type.

---

### Passo 2: Simular limpeza de entries desbalanceados

```bash
node "scripts/scrip1/files/correcao_contabil/scripts/06_limpar_entries_desbalanceados.mjs"
```

**Espere ver:** Lista de entries que serão removidos (provavelmente centenas/milhares).

---

### Passo 3: Executar limpeza de entries desbalanceados

```bash
node "scripts/scrip1/files/correcao_contabil/scripts/06_limpar_entries_desbalanceados.mjs" --executar
```

**Espere ver:** Confirmação de deleção e nova verificação da equação contábil.

---

### Passo 4: Simular tratamento da conta sintética

```bash
node "scripts/scrip1/files/correcao_contabil/scripts/07_tratar_sintetica_genericos.mjs"
```

**Espere ver:** Análise das 189 linhas genéricas e quantas podem ser identificadas.

---

### Passo 5: Executar tratamento da conta sintética

```bash
node "scripts/scrip1/files/correcao_contabil/scripts/07_tratar_sintetica_genericos.mjs" --executar
```

**Espere ver:** Linhas movidas para contas analíticas ou para "Pendente de Identificação".

---

### Passo 6: Validação final

```bash
node "scripts/scrip1/files/correcao_contabil/scripts/04_validar_equacao_contabil.mjs"
```

**Critérios de sucesso:**
- ✅ Equação contábil: Diferença = R$ 0,00
- ✅ Duplicatas boleto_sicredi: 0
- ✅ Conta sintética 1.1.2.01: 0 lançamentos diretos
- ✅ Conta transitória 1.1.9.01: Saldo R$ 0,00

---

## ⚠️ NOTAS IMPORTANTES

1. **Sempre simule antes de executar** - Scripts sem `--executar` apenas mostram o que será feito

2. **Os scripts usam parent_id** - A tabela chart_of_accounts usa `parent_id` (UUID), não `parent_code`

3. **Saldo do banco** - O valor de referência (R$ 18.553,54) é apenas de Janeiro/2025. O saldo atual pode ser diferente se houver dados de outros meses.

4. **Backup** - Se possível, faça backup antes de executar com `--executar`

---

## 📊 CHECKLIST DE ACOMPANHAMENTO

- [ ] Script 05 executado - diagnóstico feito
- [ ] Script 06 simulado - verificado o que será deletado
- [ ] Script 06 executado - entries desbalanceados removidos
- [ ] Script 07 simulado - verificado tratamento da sintética
- [ ] Script 07 executado - linhas movidas para analíticas
- [ ] Script 04 executado - validação final OK

---

**Ao terminar, reporte os resultados da validação final (Script 04).**
