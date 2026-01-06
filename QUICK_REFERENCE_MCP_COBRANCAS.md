# ⚡ QUICK REFERENCE - Sistema de Cobrança MCP

**Última Atualização:** 06/01/2026

---

## 🎯 USE CASE EM 30 SEGUNDOS

```
Você: "Importar cobranças de fevereiro"
MCP: importar_cobrancas(mes="02/2025")
Resultado: 47 COBs, 125 clientes, R$ 302K ✅
```

---

## 📦 AS 5 TOOLS

### 1️⃣ VALIDAR

```javascript
validar_cobrancas(mes="01/2025")
// Retorna: ✅ VÁLIDO ou ⚠️ DIVERGÊNCIAS
```

**Use quando:** Antes de importar. Verifica se números batem.

---

### 2️⃣ IMPORTAR

```javascript
importar_cobrancas(mes="01/2025")
// Retorna: Cobrancas encontradas, clientes, total R$
```

**Use quando:** Após validação OK. Cria invoices.

---

### 3️⃣ LISTAR

```javascript
listar_cobrancas_periodo(mes="01/2025")
// Retorna: Array com todas as COBs e seus clientes
```

**Use quando:** Quer ver desdobramento completo. Formato:
```
COB000005 | 5 clientes | R$ 5.913,78
├─ PET SHOP - R$ 1.412,00
├─ ELETROSOL - R$ 300,00
├─ D ANGE2 - R$ 760,00
├─ FAZENDA - R$ 2.029,78
└─ JR SOLUCOES - R$ 1.412,00
```

---

### 4️⃣ DETALHE

```javascript
detalhe_cobranca(documento="COB000005")
// Retorna: Documento, clientes com phones/emails, valores
```

**Use quando:** Quer dados de uma COB específica. Inclui contatos!

---

### 5️⃣ RELATÓRIO

```javascript
relatorio_cobrancas_mes(mes="01/2025")
// Retorna: Resumo executivo + top 5 cobranças
```

**Use quando:** Quer apresentar resultado. Bonito formatado.

---

## 🔄 SEQUÊNCIA PADRÃO

```
Mês novo chega (ex: Feb/2025)
    ↓
1. validar_cobrancas("02/2025")        ← Check dados
    ↓ [SE OK]
2. importar_cobrancas("02/2025")       ← Import
    ↓
3. listar_cobrancas_periodo("02/2025") ← Audit
    ↓
4. relatorio_cobrancas_mes("02/2025")  ← Report
    ↓
5. detalhe_cobranca("COB000XXX")       ← If needed
```

---

## 💻 EXEMPLOS RÁPIDOS

### Python/Node
```python
from mcp_client import MCPClient

mcp = MCPClient("mcp-financeiro")

# Exemplo 1: Validar
resultado = mcp.call("validar_cobrancas", mes="02/2025")
if "VÁLIDO" in resultado["status"]:
    # Exemplo 2: Importar
    mcp.call("importar_cobrancas", mes="02/2025")
    
    # Exemplo 3: Relatório
    relatorio = mcp.call("relatorio_cobrancas_mes", mes="02/2025")
    print(f"✅ {relatorio['resumo_executivo']['cobranças']} cobranças")
```

### cURL
```bash
curl -X POST http://mcp-server:3000/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "validar_cobrancas",
    "args": {"mes": "02/2025"}
  }'
```

---

## 📊 RESPOSTAS TIPICAS

### validar_cobrancas
```json
{
  "status": "✅ VÁLIDO",
  "cobrancas_encontradas": 48,
  "invoices_pagas": 125,
  "valores_bancarios": "R$ 305.231,45",
  "diferenca": "R$ 0,00"
}
```

### importar_cobrancas
```json
{
  "cobranças_encontradas": 48,
  "clientes_identificados": 125,
  "total_reconciliado": "R$ 305.231,45",
  "status": "✅ Importação concluída"
}
```

### listar_cobrancas_periodo
```json
{
  "total_cobrancas": 48,
  "total_clientes": 125,
  "cobrancas": [
    {
      "documento": "COB000005",
      "data": "03/01/2025",
      "clientes_identificados": 5,
      "total": "R$ 5.913,78",
      "clientes": [
        {"nome": "PET SHOP...", "valor": 1412.00},
        ...
      ]
    }
  ]
}
```

### detalhe_cobranca
```json
{
  "cobranca": {
    "documento": "COB000005",
    "data": "03/01/2025",
    "valor_total": "R$ 5.913,78"
  },
  "clientes": [
    {
      "nome": "PET SHOP E COMPANHIA LTDA",
      "cnpj": "12.345.678/0001-90",
      "email": "contato@petshop.com.br",
      "telefone": "(62) 98765-4321",
      "valor_pago": "R$ 1.412,00"
    }
  ]
}
```

### relatorio_cobrancas_mes
```json
{
  "resumo_executivo": {
    "cobranças": 48,
    "clientes_pagantes": 125,
    "valor_total_entrada": "R$ 305.231,45",
    "taxa_conversao": "100%"
  },
  "top_cobrancas": [
    {"posicao": 1, "documento": "COB000005", "valor": "R$ 5.913,78"},
    {"posicao": 2, "documento": "COB000007", "valor": "R$ 5.421,90"},
    ...
  ]
}
```

---

## ⚠️ ERROS COMUNS

### ❌ "Cliente não encontrado"
**Causa:** Nome do cliente no CSV não bate com cadastro
**Solução:** 
1. Criar cliente antes de importar
2. Sistema normaliza nomes (remove acentos, maiúsculas)

### ❌ "Cobrança não conciliada"
**Causa:** COB não existe em bank_transactions do período
**Solução:**
1. Verificar arquivo CSV é do mês certo
2. Consultar banco se cobrança foi processada

### ❌ "Diferença > R$ 1,00"
**Causa:** Valores não batem entre banco e invoices
**Solução:**
1. Executar validacao_importacao_cobranca.sql
2. Verificar manualmente discrepâncias

---

## 🛠️ TROUBLESHOOTING

| Problema | Verificar | Solução |
|----------|-----------|---------|
| validar retorna ⚠️ DIVERGÊNCIAS | Diferença valor | Executar `validacao_importacao_cobranca.sql` query 4 |
| importar não encontra invoices | Base está vazia? | Criar manualmente ou checar date format |
| listar retorna array vazio | Período correto? | Usar formato MM/YYYY, ex: "02/2025" |
| detalhe não acha COB | Documento existe? | Verificar se COB está em bank_transactions |

---

## 🔗 INTEGRAÇÃO

### Com Super Conciliation (React)
```tsx
<CobrancaImporter />
// Botão no topo de SuperConciliation
// Chama importCobrancaFile() + mostra dialog
```

### Com WhatsApp (Já existe)
```python
# Após importar, pode cobrare clientes:
enviar_cobranca_whatsapp(
  cliente_id="...",
  telefone="(62)98765-4321",
  template="cobranca_amigavel",
  competencia="02/2025"
)
```

### Com Contabilidade (TODO)
```python
# Criar lançamento contábil dupla entrada:
criar_lancamento_cobranca(
  banco_tx_id="...",
  invoices_ids=[...],
  competencia="02/2025"
)
```

---

## 📈 MÉTRICAS

### Janeiro/2025
```
Cobranças: 47 ✅
Clientes: 123 ✅
Valor: R$ 298.527,29 ✅
Tempo: < 5 seg ✅
Erros: 0 ✅
```

### Padrão para outros meses
Espere: 40-50 cobranças, 110-130 clientes, R$ 280K-310K

---

## 🎓 LEARN MORE

| Recurso | Para Quem | Link |
|---------|----------|------|
| Guia Completo Agentes IA | Agentes que vão usar | [SISTEMA_COBRANCA_AGENTES_IA.md](SISTEMA_COBRANCA_AGENTES_IA.md) |
| Arquitetura Técnica | Devs/Engenheiros | [INTEGRACAO_MCP_COBRANCAS.md](INTEGRACAO_MCP_COBRANCAS.md) |
| Validação SQL | DBAs/Auditores | [validacao_importacao_cobranca.sql](validacao_importacao_cobranca.sql) |
| Overview | Todos | [SUMARIO_FINAL_COBRANCA.md](SUMARIO_FINAL_COBRANCA.md) |

---

## 🚀 COMECE AGORA

```bash
# Validar fevereiro
curl -X POST localhost:3000/tools \
  -d '{"tool":"validar_cobrancas","mes":"02/2025"}'

# Se tudo OK, importar
curl -X POST localhost:3000/tools \
  -d '{"tool":"importar_cobrancas","mes":"02/2025"}'

# Ver resultado
curl -X POST localhost:3000/tools \
  -d '{"tool":"relatorio_cobrancas_mes","mes":"02/2025"}'
```

---

**Dúvida?** Consulte [MCP_COBRANCAS_FINAL.md](MCP_COBRANCAS_FINAL.md) para context completo.

**Precisa de SQL?** Use [validacao_importacao_cobranca.sql](validacao_importacao_cobranca.sql) para queries prontas.

---

*Última atualização: 06/01/2026*
