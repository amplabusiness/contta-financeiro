# 🎯 INSTRUÇÕES FASE 3 - Limpeza Profunda de Anomalias

**Data:** 11/01/2026  
**Contexto:** Após Fase 2, ainda há diferença de R$ 609.358,41 na equação contábil e saldo negativo no banco

---

## 🔴 PROBLEMA IDENTIFICADO

O saldo **negativo** do banco (R$ -158.893,73) indica que há:
1. **Linhas órfãs** - linhas de lançamento cujo entry foi deletado
2. **Entries desbalanceados** - entries com débito ≠ crédito (incompletos)
3. **Entries vazios** - entries sem nenhuma linha

Quando deletamos os 991 `boleto_sicredi`, provavelmente:
- Deletamos as linhas de débito no banco
- Mas ficaram linhas de crédito órfãs em outras contas (clientes)

---

## 🚀 EXECUTE NA ORDEM

### Passo 1: Diagnóstico Profundo

```bash
cd "c:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1"
node "scripts/scrip1/files/correcao_contabil/scripts/08_diagnostico_profundo.mjs"
```

**O que esperar:**
- Quantidade de linhas órfãs e seu impacto
- Quantity de entries desbalanceados
- Análise detalhada do banco Sicredi
- Plano de ação específico

---

### Passo 2: Simular Limpeza

```bash
node "scripts/scrip1/files/correcao_contabil/scripts/09_limpar_anomalias.mjs"
```

**O que esperar:**
- Resumo do que será deletado
- Impacto esperado na equação contábil

---

### Passo 3: Executar Limpeza

```bash
node "scripts/scrip1/files/correcao_contabil/scripts/09_limpar_anomalias.mjs" --executar
```

**O que esperar:**
- Deleção de linhas órfãs
- Deleção de entries desbalanceados e suas linhas
- Deleção de entries vazios
- Verificação final da equação

---

### Passo 4: Validação Final

```bash
node "scripts/scrip1/files/correcao_contabil/scripts/04_validar_equacao_contabil.mjs"
```

**Critérios de sucesso:**
- ✅ Equação contábil: Diferença = R$ 0,00
- ✅ Saldo banco: Positivo e razoável
- ✅ Sem linhas órfãs
- ✅ Sem entries desbalanceados

---

## ⚠️ IMPORTANTE

1. O **script 08** faz diagnóstico completo - execute primeiro para entender o problema

2. O **script 09** é agressivo - deleta tudo que está inconsistente

3. Se após executar ainda houver diferença, pode ser necessário:
   - Revisar dados originais
   - Verificar saldos de abertura
   - Recontar manualmente

---

## 📊 CHECKLIST

- [ ] Script 08 executado - diagnóstico feito
- [ ] Script 09 simulado - verificado o que será deletado
- [ ] Script 09 executado - anomalias removidas
- [ ] Script 04 executado - validação final OK
- [ ] Equação contábil balanceada (Débitos = Créditos)
- [ ] Saldo do banco positivo

---

**Reporte os resultados do diagnóstico (Script 08) para análise.**
