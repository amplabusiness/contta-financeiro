# ROADMAP Ampla Financeiro 2026

**Projeto**: Ampla Financeiro (data-bling-sheets)
**Versão Atual**: ~1.25.0+
**Última Sessão**: 34 (07/01/2026)
**Gerado em**: 28/01/2026

---

## Resumo do Sistema

### Stack Tecnológico
| Componente | Tecnologia |
|------------|------------|
| Frontend | React 18 + TypeScript 5 + Vite + TailwindCSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Edge Functions + Auth + Realtime) |
| IA | Google Gemini 2.0 (21 agentes especializados) |
| Deploy | Vercel (ampla.vercel.app) |
| Scripts | Python 3.14 (pandas, openpyxl, supabase-py) |

### Módulos Implementados

| Módulo | Status | Observação |
|--------|--------|------------|
| Gestão de Clientes | ✅ Completo | CNPJ/CPF, enriquecimento ReceitaWS, grupos econômicos |
| Honorários (Invoices) | ✅ Completo | Geração recorrente, importação em lote |
| Conciliação Bancária | ✅ Completo | Super Conciliador com split, OFX/CNAB |
| Contabilidade | ✅ Completo | Plano de Contas, Diário, Razão, Balancete, DRE, Balanço |
| Dashboard | ✅ Completo | Executivo, inadimplência, fluxo de caixa |
| IA Contábil | ✅ Completo | 21 Edge Functions (Gemini 2.0) |
| NFS-e | ✅ Completo | Portal Nacional + Goiânia (ABRASF 2.04) |
| Contratos | ✅ Completo | Sistema profissional com cláusulas |
| Folha de Pagamento | ✅ Completo | Eventos manuais, rescisão |
| Multi-tenancy | ✅ Completo | RLS com tenant_id |

---

## Ecossistema de IA (21 Agentes)

### Agentes Contábeis
- `ai-accountant-agent` - Contador IA interativo
- `ai-accountant-background` - Validação automática em background
- `ai-accounting-validator` - Validação de conformidade
- `ai-expense-classifier` - Classificação de despesas
- `ai-invoice-classifier` - Classificação de faturas

### Agentes Financeiros
- `ai-financial-analyst` - Análise financeira
- `ai-cash-flow-analyst` - Projeção de fluxo de caixa
- `ai-revenue-predictor` - Previsão de receitas
- `ai-pricing-optimizer` - Otimização de preços

### Agentes de Cobrança
- `ai-collection-agent` - Automação de cobrança
- `ai-churn-predictor` - Previsão de cancelamento
- `ai-client-segmenter` - Segmentação de clientes

### Agentes de Conciliação
- `ai-reconciliation-agent` - Conciliação automática
- `ai-pix-reconciliation` - Conciliação PIX

### Agentes de Segurança
- `ai-fraud-detector` - Detecção de fraudes
- `ai-fraud-analyzer` - Análise de fraudes

### Gestão Empresarial
- `ai-business-manager` - Gestor Empresarial (MBA-trained)

---

## O que FALTA Implementar

### CRÍTICO (ECD/SPED 2026)

| Item | Status | Prioridade |
|------|--------|------------|
| Geração arquivo ECD (.txt) | ❌ Ausente | CRÍTICA |
| Bloco 0 - Abertura/Identificação | ❌ Ausente | CRÍTICA |
| Bloco I - Lançamentos (I200/I250) | ❌ Ausente | CRÍTICA |
| Bloco J - Demonstrações (Balanço, DRE) | ❌ Ausente | CRÍTICA |
| Bloco 9 - Encerramento | ❌ Ausente | CRÍTICA |
| Assinatura Digital (A1/A3) | ❌ Ausente | CRÍTICA |
| Transmissão ReceitaNet | ❌ Ausente | CRÍTICA |
| Registro I050 - Plano de Contas | ⚠️ Parcial | ALTA |
| Registro I051 - Plano Referencial SPED | ⚠️ Parcial | ALTA |

### ALTA PRIORIDADE

| Item | Status | Descrição |
|------|--------|-----------|
| ECF (Escrituração Contábil Fiscal) | ❌ Ausente | Obrigatório para Lucro Real/Presumido |
| DMPL | ❌ Ausente | Demonstração das Mutações do PL |
| DFC | ❌ Ausente | Demonstração de Fluxo de Caixa |
| Notas Explicativas (J800) | ❌ Ausente | RTF anexo ao SPED |
| Validação PVA | ❌ Ausente | Validador da Receita Federal |

### MÉDIA PRIORIDADE

| Item | Status | Descrição |
|------|--------|-----------|
| EFD Contribuições | ❌ Ausente | PIS/COFINS |
| DCTF | ❌ Ausente | Declaração de Débitos e Créditos |
| Integração Bling | ⚠️ Parcial | Importação de notas fiscais |
| App Mobile | ❌ Ausente | React Native ou PWA |
| Painel Cliente | ❌ Ausente | Portal self-service para clientes |

---

## Arquitetura Atual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AMPLA FINANCEIRO                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │   React     │  │  Supabase   │  │   Gemini    │  │   Vercel    │   │
│   │  Frontend   │◄─┤  Backend    │◄─┤   21 IAs    │  │   Deploy    │   │
│   │             │  │             │  │             │  │             │   │
│   │ • shadcn/ui │  │ • PostgreSQL│  │ • Contador  │  │ • CI/CD     │   │
│   │ • Tailwind  │  │ • Edge Func │  │ • Financeiro│  │ • HTTPS     │   │
│   │ • TypeScript│  │ • Auth      │  │ • Cobrança  │  │ • CDN       │   │
│   │ • Vite      │  │ • Realtime  │  │ • Fraudes   │  │             │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                           MÓDULOS                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│   │Clientes │ │Honorár. │ │Concilia.│ │Contabil.│ │ NFS-e   │          │
│   │         │ │         │ │Bancária │ │         │ │         │          │
│   ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤          │
│   │•Cadastro│ │•Recorrên│ │•Super   │ │•Diário  │ │•Portal  │          │
│   │•Grupos  │ │•Import. │ │ Concil. │ │•Razão   │ │ Nacional│          │
│   │•Pro-Bono│ │•Split   │ │•OFX/CNAB│ │•Balanc. │ │•Goiânia │          │
│   │•Enrique.│ │•Cobran. │ │•IA Match│ │•DRE     │ │•ABRASF  │          │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                                          │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│   │Contratos│ │ Folha   │ │Dashboard│ │Despesas │                       │
│   │         │ │Pagamento│ │         │ │         │                       │
│   ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤                       │
│   │•Cláusula│ │•Eventos │ │•Execut. │ │•Catego. │                       │
│   │•Modelos │ │•Rescisão│ │•KPIs    │ │•Aprovaç.│                       │
│   │•Vigência│ │•13º/Fér.│ │•Gráficos│ │•Import. │                       │
│   └─────────┘ └─────────┘ └─────────┘ └─────────┘                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Próximos Passos (Ordem de Prioridade)

### Fase 1: ECD SPED 2026 (URGENTE)
Prazo: Maio/2026 (entrega até último dia útil de maio)

1. [ ] **Criar módulo `sped-ecd-generator.ts`**
   - Formatação arquivo texto conforme leiaute ECD
   - Separador pipe (|)
   - Encoding ISO-8859-1
   - Quebra linha CR+LF

2. [ ] **Implementar Bloco 0**
   - Registro 0000 (Abertura)
   - Registro 0007 (Inscrições cadastrais)
   - Registro 0150 (Participantes)
   - Registro 0990 (Encerramento)

3. [ ] **Implementar Bloco I**
   - Registro I001 (Abertura)
   - Registro I030 (Termo de abertura)
   - Registro I050 (Plano de contas)
   - Registro I051 (Plano referencial)
   - Registro I200 (Lançamentos)
   - Registro I250 (Partidas)
   - Registro I990 (Encerramento)

4. [ ] **Implementar Bloco J**
   - Registro J001 (Abertura)
   - Registro J100 (Balanço Patrimonial)
   - Registro J150 (DRE)
   - Registro J900 (Termo de encerramento)
   - Registro J930 (Signatários)
   - Registro J990 (Encerramento)

5. [ ] **Implementar Bloco 9**
   - Registro 9001 (Abertura)
   - Registro 9900 (Registros do arquivo)
   - Registro 9999 (Encerramento)

6. [ ] **Assinatura Digital**
   - Suporte certificados A1/A3
   - Integração com leitora cartão

### Fase 2: Melhorias Contábeis
1. [ ] DMPL - Demonstração das Mutações do PL
2. [ ] DFC - Demonstração de Fluxo de Caixa (método direto/indireto)
3. [ ] Notas Explicativas (editor RTF)
4. [ ] Validação contra PVA

### Fase 3: Integrações Fiscais
1. [ ] ECF - Escrituração Contábil Fiscal
2. [ ] EFD Contribuições (PIS/COFINS)
3. [ ] DCTF

### Fase 4: Expansão SaaS
1. [ ] App Mobile (React Native / PWA)
2. [ ] Painel Self-service para Clientes
3. [ ] Marketplace de Integrações
4. [ ] White-label para outros escritórios

---

## Histórico de Sessões (34 sessões)

| Sessão | Data | Descrição Principal |
|--------|------|---------------------|
| 1-13 | Jun-Dez/2025 | Estrutura inicial, honorários, conciliação |
| 14-15 | 06/12/2025 | Correções de bugs |
| 16-17 | 10/12/2025 | Dr. Cícero Contador IA |
| 18 | 10/12/2025 | Identificação de sócios |
| 19 | 10/12/2025 | Versionamento e saldo abertura |
| 20 | 10/12/2025 | Honorários especiais v1.21.0 |
| 21 | 10/12/2025 | Sistema de contratos v1.22.0 |
| 22 | 10/12/2025 | Configurações escritório v1.23/24.0 |
| 23 | 10/12/2025 | Boletos liquidados v1.25.0 |
| 24 | 10/12/2025 | Contabilidade fonte única |
| 25 | 11/12/2025 | Correção saldo bancário |
| 26 | 11/12/2025 | Correção adiantamentos DRE |
| 27 | 11-12/12/2025 | Sistema rescisão + DRE |
| 28 | 15/12/2025 | NFS-e completo |
| 28.2 | 15/12/2025 | Portal Nacional NFS-e |
| 29 | 15/12/2025 | Eventos manuais folha |
| 30 | 15/12/2025 | Testes NFS-e produção |
| 31 | 15/12/2025 | Goiânia ABRASF 2.04 SOAP |
| 32 | 22/12/2025 | Correções saldo e folha |
| 33 | 26/12/2025 | Despesas deletadas DRE |
| 34 | 07/01/2026 | Reclassificação pessoal PJ/CLT |

---

## Referências

- [Manual ECD 2026](http://sped.rfb.gov.br/pasta/show/1569)
- [Portal SPED](http://sped.rfb.gov.br/projeto/show/273)
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)

---

*Documento gerado em: 28/01/2026*
*Versão: 1.0*
*Sistema em produção: ampla.vercel.app*
