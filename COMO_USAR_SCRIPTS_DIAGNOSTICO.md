# 🔧 COMO EXECUTAR OS SCRIPTS DE DIAGNÓSTICO

Três ferramentas foram criadas para monitorar duplicatas:

---

## 1️⃣ Verificação do Dia (RECOMENDADO DIÁRIO)

```bash
node conferencia_duplicatas_hoje.mjs
```

**O que faz:**
- Verifica lançamentos de **exatamente hoje** (26/12 = 2025-12-26)
- Detecta duplicatas óbvias (mesma descrição + valor)
- Mostra resumo por usuário
- Verifica integridade com lançamentos contábeis
- Busca lançamentos órfãos

**Quando usar:**
- Ao final de cada dia
- Se suspeitar de duplicação
- Para conferência rápida

**Exemplo de output:**
```
✅ Encontrados 0 lançamentos de despesas hoje
✅ Encontrados 0 lançamentos contábeis para despesas hoje
✅ Nenhum lançamento órfão encontrado
✅ Todas as despesas têm lançamento contábil
```

---

## 2️⃣ Análise Histórica (SEMANAL/MENSAL)

```bash
node relatorio_completo_duplicatas.mjs
```

**O que faz:**
- Analisa **últimos 30 dias** completos
- Busca padrões suspeitos (múltiplas despesas iguais)
- Agrupa por usuário, categoria, data
- Detecta duplicatas exatas
- Gera estatísticas detalhadas

**Quando usar:**
- Semanalmente para auditoria
- Mensalmente para reconciliação
- Antes de gerar relatório ao contador

**Exemplo de output:**
```
✅ Encontrados 0 lançamentos nos últimos 30 dias
✅ Nenhum padrão suspeito de duplicação encontrado
✅ Integridade perfeita
✅ Nenhuma duplicata exata encontrada
```

---

## 3️⃣ Diagnóstico Geral (PRIMEIRA VEZ / TROUBLESHOOTING)

```bash
node diagnostico_banco.mjs
```

**O que faz:**
- Verifica conexão com Supabase
- Conta registros em cada tabela
- Mostra últimos 10 lançamentos
- Verifica se tabelas existem
- Busca problemas na estrutura
- Mostra períodos com dados

**Quando usar:**
- Primeira vez (verificar setup)
- Se suspeitar de problema
- Para diagnóstico geral

**Exemplo de output:**
```
📊 CONTAGEM DE REGISTROS:
  • expenses: 0 registros
  • accounting_entries: 0 registros
  • accounting_entry_tracking: 0 registros ✅

🎯 STATUS:
  • Tabela de Despesas: ✅ OK
  • Lançamentos Contábeis: ✅ OK
  • Sistema de Rastreamento: ✅ OK
  ⚠️ Banco está funcional mas SEM DADOS
```

---

## 📋 FLUXO DE USO RECOMENDADO

### Dia a Dia
```
Ao final do expediente:
  → node conferencia_duplicatas_hoje.mjs
  → Verificar resultado ✅
  → Informar se houver problema
```

### Semanalmente
```
Segunda-feira:
  → node relatorio_completo_duplicatas.mjs
  → Revisar padrões suspeitos
  → Confirmar integridade
```

### Mensalmente
```
Último dia do mês:
  → node diagnostico_banco.mjs (status geral)
  → node relatorio_completo_duplicatas.mjs (análise completa)
  → Preparar relatório para contador
```

### Se Houver Problema
```
1. node diagnostico_banco.mjs (identificar problema)
2. node conferencia_duplicatas_hoje.mjs (ver situação)
3. node relatorio_completo_duplicatas.mjs (análise detalhada)
4. Verificar logs de erro
5. Contatar contador se necessário
```

---

## 🎯 INTERPRETANDO OS RESULTADOS

### ✅ Tudo OK (Esperado)
```
✅ SISTEMA ÍNTEGRO - Nenhuma inconsistência detectada
✅ Nenhuma duplicata óbvia (mesma descrição + valor)
✅ Todos os códigos de rastreamento são únicos
✅ Nenhum lançamento órfão encontrado
```

### ⚠️ Aviso (Investigar)
```
⚠️ Tabela de rastreamento não existe
  → Migração SQL ainda não foi aplicada

⚠️ Nenhuma despesa encontrada
  → Banco vazio (normal em setup)

⚠️ Lançamentos órfãos: X
  → Existe entry sem expense
  → Usar: node deletar_lancamentos_orfaos.mjs
```

### ❌ Erro (Ação Necessária)
```
❌ Erro ao buscar despesas
  → Problema de conexão com Supabase
  → Verificar .env.local
  → Verificar internet
  
❌ Duplicatas detectadas
  → Problema potencial
  → Validar com usuários
  → Considerar limpeza
```

---

## 🔍 INTERPRETANDO RESULTADOS DE DUPLICATA

### Padrão Suspeito = NÃO É NECESSARIAMENTE DUPLICATA

Exemplo:
```
⚠️ 3x DUPLICADA:
   Descrição: "Café da reunião"
   Valor: R$ 50.00
```

**O que significa:**
- Mesma despesa 3 vezes? Ou 3 consumos diferentes do mesmo café?
- Não é automaticamente um erro
- Pode ser legítimo (reunião com 3 grupos)

**O que fazer:**
- Verificar com os usuários
- Confirmar se eram intencionais
- Se forem duplicatas reais, usar deletar_lancamentos_orfaos.mjs

---

## 🚨 SITUAÇÃO ATUAL (26/12/2025)

```
Resultado da conferência de hoje:

✅ Zero duplicatas
✅ Integridade verificada
✅ Banco vazio (normal - migração em progresso)
✅ Sistema pronto para receber dados

Próximo passo:
→ Importar dados básicos
→ Fazer primeiro teste com funcionário
→ Usar scripts diariamente após isso
```

---

## 📞 REFERÊNCIA RÁPIDA

| Situação | Comando | Frequência |
|----------|---------|-----------|
| Verificação rápida hoje | `node conferencia_duplicatas_hoje.mjs` | Diária |
| Análise detalhada | `node relatorio_completo_duplicatas.mjs` | Semanal |
| Diagnóstico geral | `node diagnostico_banco.mjs` | Mensal |
| Problema? | `node diagnostico_banco.mjs` | Conforme necessário |

---

## 💡 DICA

Se receber aviso de duplicata:

```bash
# 1. Primeiro, executar verificação
node conferencia_duplicatas_hoje.mjs

# 2. Se houver problema, executar análise completa
node relatorio_completo_duplicatas.mjs

# 3. Revisar com contador
# 4. Se precisar limpar órfãos:
# node deletar_lancamentos_orfaos.mjs
```

---

**Última Atualização:** 26/12/2025
**Status:** ✅ Sistema Operacional
**Próxima Verificação:** Quando começarem os lançamentos
