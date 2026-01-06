# ⚡ QUICK START - Sistema de Cobrança

## 🎯 Em 3 Minutos

### 1️⃣ Abrir Super Conciliação
```
Menu Principal → Sistema → Super Conciliação
```

### 2️⃣ Clicar "Importar Cobrança"
Botão no topo direito, após o seletor de mês
```
┌─────────────────────────────────────┐
│ [Calendário] [Importar Cobrança] ← │
└─────────────────────────────────────┘
```

### 3️⃣ Selecionar Arquivo
```
Arquivo: banco/clientes boletos jan.csv
✅ Formato: CSV
✅ Separador: Ponto-vírgula (;)
✅ Encontrado: Sim
```

### 4️⃣ Processar
Clique e aguarde ~10 segundos
```
⏳ Processando...
├─ Parse CSV
├─ Agrupa por Documento
├─ Busca Clientes
├─ Cria/Atualiza Invoices
├─ Valida bank_transactions
└─ Vincula Relacionamentos
```

### 5️⃣ Ver Resultado
```
✅ RESULTADO FINAL
├─ Cobranças: 47
├─ Clientes: 123
├─ Total: R$ 298.527,29
├─ Conciliadas: 45 ✅
└─ Não encontradas: 2 ⚠️
```

---

## 📌 O Problema Resolvido

### Antes ❌
```
Transação no Banco:
"LIQ.COBRANCA SIMPLES-COB000005"
R$ 5.913,78
Cliente: ??? (desconhecido)
```

### Depois ✅
```
Transação no Banco:
"LIQ.COBRANCA SIMPLES-COB000005"
R$ 5.913,78 ← 5 Clientes Identificados:
├─ PET SHOP E CIA - R$ 1.412,00
├─ ELETROSOL - R$ 300,00
├─ D ANGE2 - R$ 760,00
├─ FAZENDA DA TOCA - R$ 2.029,78
└─ JR SOLUCOES - R$ 1.412,00
```

---

## 🔍 Onde Encontro...

### O Arquivo CSV?
```
📁 banco/
   └─ clientes boletos jan.csv ← Aqui!
```

### O Botão de Importação?
```
Super Conciliação
├─ Header
│  ├─ [Pendentes] [Análise/Auditoria]
│  └─ [Saldos]
│     └─ [📅 Calendário] [📥 Importar Cobrança] ← Aqui!
└─ Listas de Transações
```

### Os Resultados?
```
Modal de Importação
├─ Estatísticas
│  ├─ Cobranças Processadas
│  ├─ Taxa de Conciliação
│  └─ Total Recebido
│
├─ Detalhe por Cobrança
│  ├─ COB000005 ✅
│  │  ├─ Data: 03/01/2025
│  │  ├─ Total: R$ 5.913,78
│  │  └─ Clientes: [5 listados]
│  │     ├─ ✅ PET SHOP
│  │     ├─ ✅ ELETROSOL
│  │     └─ ...
│  └─ COB000007 ✅
└─ [Fechar Dialog]
```

---

## ✅ Verificação Pós-Importação

### No UI (Rápido)
```
1. Super Conciliação → Aba "Análise/Auditoria"
2. Filtrar por "COB000005"
3. Deve aparecer como ✅ Conciliada
4. Clicar para ver detalhes dos 5 clientes
```

### No Banco (Verificação)
```sql
-- Rápido (30 segundos)
SELECT COUNT(*) 
FROM invoices 
WHERE status = 'paid' 
  AND paid_date >= '2025-01-01'
  AND paid_date < '2025-02-01';
-- Deve retornar: ~123
```

---

## 🎓 Passo a Passo com Screenshots

```
PASSO 1: Menu
┌─────────────────────────────────┐
│ 🏠 AMPLA                        │
├─────────────────────────────────┤
│ • Painel                        │
│ • Clientes                      │
│ • Notas Fiscais                 │
│ • Receitas                      │
│ • 📊 Sistema                    │
│     └─ Super Conciliação ← ⭐ │
│ • Configurações                 │
└─────────────────────────────────┘

PASSO 2: Selecione Janeiro
┌─────────────────────────────────┐
│ Super Conciliação               │
├─────────────────────────────────┤
│ [Pendentes] [Análise/Auditoria]│
│                                 │
│ Saldos:                         │
│ Anterior: R$ 90.725,06          │
│ Início: R$ 90.725,06            │
│ Final: R$ 18.553,54             │
│                                 │
│ 📅 Janeiro 2025 ← Já selecionado│
│ [📥 Importar Cobrança] ← Clique │
└─────────────────────────────────┘

PASSO 3: Upload
┌───────────────────────────────────┐
│ Importar Arquivo de Cobrança      │
├───────────────────────────────────┤
│                                   │
│    ┌─────────────────────────┐   │
│    │  📁 Selecione Arquivo   │   │
│    │                         │   │
│    │ banco/clientes...jan.csv│   │
│    └─────────────────────────┘   │
│                                   │
└───────────────────────────────────┘

PASSO 4: Resultado
┌───────────────────────────────────┐
│ Importar Arquivo de Cobrança      │
├───────────────────────────────────┤
│                                   │
│ Cobranças: 47  Conciliadas: 45   │
│ Total: R$ 298.527,29              │
│                                   │
│ COB000005 ✅ | 5 clientes | R$ 5913,78
│   • PET SHOP - R$ 1.412,00 ✅
│   • ELETROSOL - R$ 300,00 ✅
│   • D ANGE2 - R$ 760,00 ✅
│   • FAZENDA - R$ 2.029,78 ✅
│   • JR SOLUCOES - R$ 1.412,00 ✅
│                                   │
│ [Fechar]                          │
└───────────────────────────────────┘
```

---

## 🚨 Se der Erro...

### "Arquivo não encontrado"
```
✅ Verificar: banco/clientes boletos jan.csv existe?
✅ Renomear se necessário
✅ Salvar como CSV (não XLSX)
```

### "Cliente não encontrado"
```
✅ Alguns nomes podem ser diferentes
✅ Continuar mesmo assim (importa o que consegue)
✅ Criar clientes manualmente depois se necessário
```

### "Nenhum banco_transaction encontrado"
```
✅ Significa: COB000005 não existe no extrato
✅ Pode estar em outro mês
✅ Verificar data de extrato
```

---

## 📊 Exemplo Real

### Arquivo Original (5 clientes):
```
Documento;Pagador;Data Liquidação;Valor Recebido;Data Extrato
COB000005;PET SHOP E COMPANHIA LTDA;02/01/2025;1.412,00;03/01/2025
COB000005;ELETROSOL ENERGIA SOLAR LTDA;02/01/2025;300;03/01/2025
COB000005;D ANGE2 COMERCIO;02/01/2025;760;03/01/2025
COB000005;FAZENDA DA TOCA PARTICIPACOES;02/01/2025;2.029,78;03/01/2025
COB000005;JR SOLUCOES INDUSTRIAIS;02/01/2025;1.412,00;03/01/2025
TOTAL                              ═════ 5.913,78 ═════
```

### Resultado no Sistema:
```
bank_transactions:
├─ ID: abc-123
├─ Description: "LIQ.COBRANCA SIMPLES-COB000005"
├─ Amount: 5.913,78
├─ Date: 03/01/2025
└─ Status: ✅ Conciliada

invoices: (5 criadas/atualizadas)
├─ ID: inv-1 | Cliente: PET SHOP | Amount: 1.412,00 | Status: paid ✅
├─ ID: inv-2 | Cliente: ELETROSOL | Amount: 300,00 | Status: paid ✅
├─ ID: inv-3 | Cliente: D ANGE2 | Amount: 760,00 | Status: paid ✅
├─ ID: inv-4 | Cliente: FAZENDA | Amount: 2.029,78 | Status: paid ✅
└─ ID: inv-5 | Cliente: JR SOLUCOES | Amount: 1.412,00 | Status: paid ✅

Relacionamentos:
inv-1 → bank_transactions.id = abc-123 ✅
inv-2 → bank_transactions.id = abc-123 ✅
inv-3 → bank_transactions.id = abc-123 ✅
inv-4 → bank_transactions.id = abc-123 ✅
inv-5 → bank_transactions.id = abc-123 ✅
```

---

## 💾 Arquivos Principais

| Arquivo | Localização | Função |
|---------|-------------|--------|
| **Entrada CSV** | `banco/clientes boletos jan.csv` | Dados de cobrança |
| **Parser** | `src/utils/parseCobrancaFile.ts` | Parse do arquivo |
| **Lógica** | `src/services/cobrancaImportService.ts` | Processamento |
| **UI** | `src/components/CobrancaImporter.tsx` | Interface |
| **Integração** | `src/pages/SuperConciliation.tsx` | Botão |
| **Guia** | `IMPORTACAO_COBRANCA_GUIA.md` | Instruções |
| **Validação** | `validacao_importacao_cobranca.sql` | Queries de teste |

---

## 🎯 Próximos Passos

1. **Hoje:** Importar arquivo de janeiro ✅
2. **Amanhã:** Validar com `validacao_importacao_cobranca.sql`
3. **Semana:** Importar arquivos dos outros meses
4. **Mês:** Integrar com Bling (quando tiver API)

---

## 📞 Dúvidas?

- **"Como desfazer?"** → Clique "Editar" em qualquer transação e reclassifique
- **"E se importar 2x?"** → Sistema detecta duplicatas
- **"Pode fazer por Excel?"** → Por enquanto só CSV (futura: XLSX)
- **"Automático?"** → Não (importação é manual, mas pode virar automática)

---

**🚀 Pronto para começar! Boa sorte! 🍀**
