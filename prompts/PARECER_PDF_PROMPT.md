# 📄 PARECER PDF GENERATOR — PROMPT DE GERAÇÃO

**Gerador Oficial de Parecer • Documento Probatório • Audit Trail**

---

| Campo | Valor |
|-------|-------|
| Sistema | Contta – Governança Financeira e Contábil |
| Versão | 2.0 (Definitiva) |
| Data | 31/01/2026 |
| Aplicação | Geração de PDFs de parecer contábil |

---

## 🎯 OBJETIVO

Gerar documento **probatório**, **auditável**, **versionado** e **indexado** no Data Lake.

---

## 📋 ESTRUTURA FIXA DO PDF

### 1. CAPA

```
╔═══════════════════════════════════════════════════════════════════╗
║                         PARECER TÉCNICO                            ║
║                    ANÁLISE DE DIVERGÊNCIA CONTÁBIL                 ║
║                                                                    ║
║                    [LOGO CONTTA]                                   ║
║                                                                    ║
║                    Empresa / CNPJ                                  ║
║                    Período: [MÊS/ANO]                              ║
║                    Protocolo: [CÓDIGO]                             ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

### 2. RESUMO EXECUTIVO

```
RESUMO EXECUTIVO
────────────────────────────────────────────────────────────────────

Divergência:
[Descrição em 1-2 linhas]

Impacto:
[R$ XX.XXX,XX | Alto / Médio / Baixo]

Status:
[Resolvido / Pendente / Em análise]
```

---

### 3. ANÁLISE TÉCNICA

```
ANÁLISE TÉCNICA
────────────────────────────────────────────────────────────────────

Fontes:
- Contábil: [Conta / Saldo]
- Operacional: [Faturas / Valor]
- RAG: [X documentos encontrados]

Histórico:
[Encontrado / Não encontrado]

Decisão:
[Autorizado / Bloqueado / Ajuste]
```

---

### 4. GOVERNANÇA

```
GOVERNANÇA
────────────────────────────────────────────────────────────────────

Fonte oficial:
Contabilidade (1.1.2.01)

Regra aplicada:
[Nome da regra]

Lançamento:
D - [Conta] R$ XX.XXX,XX
C - [Conta] R$ XX.XXX,XX
```

---

### 5. CONCLUSÃO

```
CONCLUSÃO
────────────────────────────────────────────────────────────────────

Situação final:
[Descrição]

Próximos passos:
[Se houver]
```

---

### 6. ASSINATURA

```
════════════════════════════════════════════════════════════════════
                      CERTIFICAÇÃO DO DOCUMENTO
════════════════════════════════════════════════════════════════════

                         Dr. Cícero
            Contador Responsável — Sistema Contta

────────────────────────────────────────────────────────────────────

Hash SHA-256:    [64 caracteres]
Timestamp:       [YYYY-MM-DDTHH:MM:SS.sssZ]
Versão:          [X]

────────────────────────────────────────────────────────────────────

"Este parecer foi gerado automaticamente pelo Sistema Contta,
sob a governança contábil do Dr. Cícero."

════════════════════════════════════════════════════════════════════
```

---

## 🔒 REGRAS DE GERAÇÃO

### Obrigatório:
- ✅ Todas as 6 seções presentes
- ✅ Hash SHA-256 calculado
- ✅ Timestamp ISO 8601
- ✅ Versão do documento
- ✅ Frase final obrigatória

### Proibido:
- ❌ Omitir seção de governança
- ❌ Documento sem hash
- ❌ Lançamento sem contrapartida

---

## 📊 TIPOS DE PARECER

| Tipo | Código | Uso |
|------|--------|-----|
| Divergência | `DIV` | Análise operacional × contábil |
| Reclassificação | `REC` | Mudança de classificação |
| Ajuste | `AJU` | Correção de erro |
| Conciliação | `CON` | Relatório bancário |

---

## 🎨 FORMATAÇÃO

| Elemento | Especificação |
|----------|---------------|
| Fonte | Courier 10pt |
| Margens | 2cm |
| Cores | Preto (#000), Cinza (#666) |

---

*Documento canônico — Template de geração de pareceres PDF*

*Última atualização: 31/01/2026*
