# 🎓 BASE DE CONHECIMENTO EXPANDIDA - Dr. Cícero

## Resumo da Atualização (31/01/2026)

Este documento descreve as novas capacidades de conhecimento adicionadas ao sistema Contta Financeiro.

---

## 📊 Estatísticas da Expansão

| Categoria | Itens | Status |
|-----------|-------|--------|
| Eventos eSocial | 27 eventos (S-1000 a S-2400) | ✅ Ativo |
| Incidências Tributárias | 94 códigos | ✅ Ativo |
| Categorias Trabalhador | 40+ códigos | ✅ Ativo |
| Motivos Afastamento | 38 códigos | ✅ Ativo |
| Motivos Desligamento | 44 códigos | ✅ Ativo |
| CFOP | 50+ códigos principais | ✅ Ativo |
| CST ICMS | 11 códigos | ✅ Ativo |
| CSOSN (Simples) | 10 códigos | ✅ Ativo |
| CST PIS/COFINS | 15 códigos | ✅ Ativo |
| Serviços LC 116 | 40 grupos | ✅ Ativo |
| Indicadores MBA | 25+ indicadores | ✅ Ativo |
| Modelos Lançamentos | 70+ modelos | ✅ Ativo |

---

## 🛠 Novas Ferramentas MCP

### eSocial
- `consultar_evento_esocial` - Consulta eventos por código
- `consultar_incidencia_tributaria` - Consulta incidências (FGTS, INSS, IRRF)
- `consultar_categoria_trabalhador` - Categorias 101-905
- `consultar_motivo_afastamento` - Motivos 01-38
- `consultar_motivo_desligamento` - Motivos 01-44
- `listar_eventos_esocial` - Lista por tipo (TABELA/PERIODICO/NAO_PERIODICO)

### Nota Fiscal
- `consultar_cfop` - Busca CFOP por código
- `consultar_cst_icms` - CST para regime normal
- `consultar_csosn` - CSOSN para Simples Nacional
- `consultar_cst_pis_cofins` - CST PIS/COFINS
- `consultar_servico_lc116` - Serviços de ISS
- `listar_cfops` - Lista por tipo e UF

### Lançamentos Contábeis
- `buscar_modelo_lancamento` - Busca por keywords
- `listar_modelos_lancamento` - Lista por categoria

### Análise MBA
- `consultar_indicador_mba` - Indicadores financeiros
- `analise_financeira_completa` - Análise com todos os indicadores
- `calcular_ncg` - Necessidade de Capital de Giro
- `analise_dupont` - Decomposição do ROE

---

## 📁 Arquivos de Conhecimento

### MCP (mcp-financeiro/src/knowledge/)
```
esocial-knowledge.json        - Eventos e códigos eSocial
nota-fiscal-knowledge.json    - CFOP, CST, LC 116
mba-indicadores-knowledge.json - Indicadores financeiros
lancamentos-contabeis-completo.json - Modelos de lançamento
knowledge-expandido.ts        - Módulo TypeScript unificado
```

### Frontend (src/lib/)
```
knowledgeBase.ts   - Base de conhecimento completa (frontend)
agenteMBA.ts       - Agente de análise financeira
drCiceroKnowledge.ts - Base original + re-exports
```

---

## 🔧 Uso Programático

### eSocial
```typescript
import { buscarEventoESocial, buscarCategoriaTrabalhador } from '@/lib/knowledgeBase';

// Buscar evento
const evento = buscarEventoESocial('S-1200');
// { nome: 'Remuneração do Trabalhador', tipo: 'PERIODICO', periodicidade: 'Mensal' }

// Buscar categoria
const categoria = buscarCategoriaTrabalhador('101');
// { descricao: 'Empregado - Geral' }
```

### Nota Fiscal
```typescript
import { buscarCFOP, buscarCSTIcms } from '@/lib/knowledgeBase';

// Buscar CFOP
const cfop = buscarCFOP('5.102');
// { descricao: 'Venda de mercadoria', tipo: 'SAIDA', uf: 'INTERNA' }

// Buscar CST
const cst = buscarCSTIcms('00');
// { descricao: 'Tributada integralmente', regime: 'NORMAL' }
```

### Análise MBA
```typescript
import { gerarAnaliseCompleta, calcularNCG, analiseDuPont } from '@/lib/agenteMBA';

// Análise completa
const analise = gerarAnaliseCompleta(
  'Ampla Contabilidade',
  '2025-01',
  { ativoCirculante: 500000, passivoCirculante: 200000, ... },
  { receita: 1000000, lucroLiquido: 150000 }
);

// NCG
const ncg = calcularNCG(150000, 30000, 80000);
// { ncg: 100000, status: 'POSITIVO', interpretacao: '...' }
```

### Lançamentos
```typescript
import { buscarLancamento, buscarLancamentosPorCategoria } from '@/lib/knowledgeBase';

// Buscar por texto
const lancamento = buscarLancamento('folha pagamento');
// { nome: 'Folha de Pagamento', debito: '4.1.2.01', credito: '2.1.1.01', ... }

// Por categoria
const trabalhistas = buscarLancamentosPorCategoria('trabalhista');
```

---

## 📋 Categorias de Lançamentos

1. **Administrativo** (15 modelos)
   - Material de expediente
   - Manutenção e reparos
   - Serviços de terceiros PJ
   - Viagens e hospedagem
   - Software e licenças

2. **Fiscal** (11 modelos)
   - ICMS a recolher
   - ISS retido
   - PIS/COFINS
   - Simples Nacional

3. **Trabalhista** (16 modelos)
   - Folha de pagamento
   - FGTS
   - INSS patronal
   - 13º salário
   - Férias
   - Rescisão

4. **Jurídico** (9 modelos)
   - Provisão contingências
   - Honorários advocatícios
   - Acordos judiciais

5. **Financeiro** (19 modelos)
   - Empréstimos bancários
   - Juros e encargos
   - Aplicações financeiras
   - Rendimentos

---

## 📈 Indicadores MBA Disponíveis

### Liquidez
- Liquidez Corrente (AC/PC)
- Liquidez Seca ((AC-Est)/PC)
- Liquidez Imediata (Disp/PC)
- Liquidez Geral ((AC+RLP)/(PC+PNC))
- Capital Circulante Líquido

### Rentabilidade
- ROE (Return on Equity)
- ROA (Return on Assets)
- ROI (Return on Investment)
- Margem Bruta
- Margem Operacional
- Margem Líquida
- EBITDA

### Endividamento
- Endividamento Geral
- Composição do Endividamento
- GAF (Grau de Alavancagem Financeira)
- Cobertura de Juros

### Atividade
- PMR (Prazo Médio Recebimento)
- PMP (Prazo Médio Pagamento)
- PME (Prazo Médio Estocagem)
- Ciclo Operacional
- Ciclo Financeiro
- Giro do Ativo

### Valuation
- EV/EBITDA
- P/L (Preço/Lucro)
- P/VPA (Preço/Valor Patrimonial)
- WACC

---

## ✅ Status da Implementação

- [x] Scripts de treinamento executados (181 queries)
- [x] JSONs de conhecimento gerados
- [x] Módulo knowledge-expandido.ts (MCP)
- [x] Módulo knowledgeBase.ts (Frontend)
- [x] Módulo agenteMBA.ts (Frontend)
- [x] Ferramentas MCP adicionadas (17 novas tools)
- [x] Handlers MCP implementados
- [x] Compilação sem erros
- [x] Integração com drCiceroKnowledge.ts

---

**Autor:** Dr. Cícero / Sistema Contta  
**Data:** 31/01/2026  
**Versão:** 2.0.0
