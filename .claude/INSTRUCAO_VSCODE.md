# INSTRUÇÕES PARA CLAUDE CODE (VSCode)

## AUTORIDADE: TOTAL
O usuário autorizou alterações conforme necessário. Você tem autonomia para:
- Resolver conflitos usando a melhor versão
- Fazer ajustes de código se necessário
- Fazer deploy de Edge Functions
- Fazer commits e push para main

---

## STATUS ATUAL (30/11/2025)

### Concluído Hoje:
1. **Reorganização do Menu** - Estrutura por fluxo financeiro
2. **Sistema de Diálogo IA-Humano** - Classificação interativa de transações
3. **Componente AIClassificationDialog** - Modal para treinar a IA
4. **Tabelas de Aprendizado** - Entidades, padrões e histórico
5. **Unificação de Importação** - BankImport como único ponto de entrada
6. **Limpeza de Conta Duplicada** - Desativada conta Sicredi com saldo zero
7. **Sistema de Adiantamentos a Sócios** - Contas e categorias para controle
8. **Centros de Custo** - AMPLA (escritório) e SERGIO (sócio)

### Concluído Anteriormente (29/11):
1. **Sistema Contábil Completo** - Plano de contas conforme NBC/CFC
2. **Conta Bancária Sicredi** - Cadastrada com saldo de abertura R$ 90.725,10
3. **Lançamento de Abertura** - Registrado em 31/12/2024
4. **Importação OFX com IA** - Classificação automática implementada

---

## ESTRUTURA DO MENU (AppSidebar.tsx)

Menu reorganizado por fluxo de trabalho financeiro:

### Principal
- Dashboard, Executivo, Fluxo de Caixa

### Banco
- **Contas Bancárias** (`/bank-accounts`) - Cadastro de contas
- **Importar Extrato** (`/bank-import`) - ÚNICO ponto de importação OFX
- **Conciliação** (`/bank-reconciliation`)
- **Super Conciliador** (`/super-conciliador`)

### Contas a Receber
- Honorários, Gerar Honorários, Análise
- Reajuste por SM, Inadimplência, Cobrança, Negociação

### Contas a Pagar
- **Despesas** (`/expenses`) - Gastos operacionais do escritório
- **Fornecedores** (`/accounts-payable`) - Obrigações com terceiros
- **Despesas Recorrentes** (`/recurring-expenses`)

### Clientes
- Clientes, Pro-Bono, Grupos Financeiros, Análise por Sócios, Contratos

### Contabilidade
- Plano de Contas, Saldo de Abertura, Balancete, DRE, Balanço, Livros

### Importações
- Clientes, Honorários, Despesas, Upload Automático

### Ferramentas IA
- Contador IA, Gestor IA, Rede Neural, Enriquecimento, Configurações

---

## SISTEMA DE DIÁLOGO IA-HUMANO

### Conceito:
A IA aprende com o humano nos primeiros momentos. Exemplo:
- Transação: "PAGAMENTO PIX - SERGIO CARNEIRO LEAO"
- IA pergunta: "Quem é Sérgio Carneiro Leão?"
- Humano responde: "É um sócio da empresa"
- IA salva o padrão e usa nas próximas classificações

### Componentes:

#### 1. AIClassificationDialog (`src/components/AIClassificationDialog.tsx`)
- Modal interativo para classificar transações
- Tabs: Classificação | Quem é?
- Mostra sugestão da IA com nível de confiança
- Permite salvar entidade e padrão para uso futuro

#### 2. Tabelas de Aprendizado (Migration `20251129280000`)

| Tabela | Descrição |
|--------|-----------|
| `ai_known_entities` | Entidades conhecidas (pessoas, empresas) |
| `ai_classification_patterns` | Padrões de classificação aprendidos |
| `ai_classification_history` | Histórico para treinamento |
| `ai_pending_questions` | Perguntas da IA aguardando resposta |

#### 3. Funções SQL

```sql
-- Normaliza texto para matching
normalize_for_matching(input_text TEXT) RETURNS TEXT

-- Busca padrão conhecido
find_known_pattern(description TEXT, txn_type TEXT, amount DECIMAL)
RETURNS TABLE (pattern_id, category, debit_account, credit_account, entity_name, confidence)
```

### Fluxo na BankImport:

1. **Preview do OFX** → Botão "Classificar Manualmente"
2. **Após importar com IA** → Botão "Revisar Classificações (X pendentes)"
3. **Aprendizado salvo** → Entidades, padrões e histórico

---

## ESTRUTURA CONTÁBIL

| Grupo | Descrição | Contas Especiais |
|-------|-----------|------------------|
| 1 | ATIVO | 1.1.1.02 Banco Sicredi, 1.1.3.04.01 Adiantamentos - Sergio |
| 2 | PASSIVO | 2.1.1.01 Fornecedores, 2.1.4.01 AFAC - Sergio |
| 3 | RECEITAS | 3.1.1.01 Honorários |
| 4 | DESPESAS | 4.1.x a 4.9.x |
| 5 | PATRIMÔNIO LÍQUIDO | 5.3.02.01 Saldo de Abertura, 5.3.03.01 Ajustes |

### Tratamento de Recebimentos:
- **Período atual**: D-Banco C-Receita
- **Períodos anteriores**: D-Banco C-5.3.03.01 (Ajustes Positivos)

### Tratamento de Despesas de Sócios:

**Quando a AMPLA paga despesas pessoais do sócio:**
```
D - 1.1.3.04.01 Adiantamentos - Sergio Carneiro Leão (Ativo)
C - 1.1.1.02 Banco Sicredi
```
→ A empresa tem a RECEBER do sócio (crédito)

**Quando o sócio devolve o dinheiro:**
```
D - 1.1.1.02 Banco Sicredi
C - 1.1.3.04.01 Adiantamentos - Sergio (baixa o crédito)
```

**Se preferir transformar em AFAC (aumento de capital):**
```
D - 1.1.3.04.01 Adiantamentos - Sergio (baixa)
C - 5.1.03 Capital Social Integralizado
```

**AFAC - Adiantamento para Futuro Aumento de Capital:**
- Usado quando o sócio EMPRESTA dinheiro para a empresa
- Fica no PASSIVO (empresa deve ao sócio)
- Só usar quando o sócio não quer receber de volta
```
D - 1.1.1.02 Banco (entra dinheiro)
C - 2.1.4.01 AFAC - Sergio (obrigação)
```

---

## CENTROS DE CUSTO

| Código | Nome | Descrição |
|--------|------|-----------|
| AMPLA | Ampla Contabilidade | Despesas operacionais do escritório |
| SERGIO | Sergio Carneiro Leão | Despesas pessoais do sócio |
| SERGIO.IMOVEIS | Imóveis | IPTU, condomínios, água, energia |
| SERGIO.VEICULOS | Veículos | IPVA, combustível, manutenção |
| SERGIO.PESSOAL | Despesas Pessoais | Saúde, personal, anuidades CRC |
| SERGIO.TELEFONE | Telefone | Linhas telefônicas pessoais |
| SERGIO.OUTROS | Outros | Outras despesas |

### Categorias de Despesas do Sócio (expense_categories):

**Imóveis:**
- Água, Energia, Gás
- Condomínio Galeria Nacional, Lago, Mundi
- IPTU Apartamento, Salas 301/302/303, Vila Abajá
- Obras Lago

**Veículos:**
- IPVA BMW, Biz, CG, Carretinha

**Pessoal:**
- Plano de Saúde
- Personal (Antonio Leandro)
- Anuidade CRC Sergio/Carla
- Tharson Diego

**Telefone/Internet:**
- Telefone, Internet

---

## EDGE FUNCTIONS DE IA

| Função | Descrição | Status |
|--------|-----------|--------|
| `ai-bank-transaction-processor` | Processa transações e gera lançamentos | ✅ Deployado |
| `ai-business-manager` | Gestor empresarial | ✅ Migrado Gemini |
| `ai-accountant-background` | Validador contábil | ✅ Migrado Gemini |
| `ai-accounting-engine` | Motor contábil | ✅ Ativo |
| `ai-expense-classifier` | Classificador de despesas | ✅ Ativo |

---

## CREDENCIAIS

### Supabase
- **Project ID**: `xdtlhzysrpoinqtsglmr`
- **URL**: `https://xdtlhzysrpoinqtsglmr.supabase.co`

### Secrets configurados:
- `GEMINI_API_KEY` - API do Google Gemini
- `CNPJA_API_KEY` - API CNPJA
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço
- `SUPABASE_URL` - URL do projeto

---

## COMANDOS ÚTEIS

### Deploy de Edge Functions
```bash
npx supabase functions deploy ai-bank-transaction-processor --project-ref xdtlhzysrpoinqtsglmr
```

### Migrações
```bash
npx supabase db push --linked
```

### Git
```bash
git add . && git commit -m "mensagem" && git push origin main
```

---

## ARQUIVOS PRINCIPAIS

### Menu e Navegação:
- `src/components/AppSidebar.tsx` - Menu lateral reorganizado

### Componentes de IA:
- `src/components/AIClassificationDialog.tsx` - Diálogo de classificação
- `src/pages/BankImport.tsx` - Importação com IA integrada

### Edge Functions:
- `supabase/functions/ai-bank-transaction-processor/index.ts`
- `supabase/functions/_shared/gemini.ts`

---

## MIGRATIONS APLICADAS

| Arquivo | Descrição |
|---------|-----------|
| `20251129250000_complete_chart_of_accounts.sql` | Plano de contas completo |
| `20251129260000_register_sicredi_account.sql` | Conta Sicredi + saldo inicial |
| `20251129270000_opening_balance_entry.sql` | Lançamento de abertura 31/12/2024 |
| `20251129280000_ai_transaction_learning.sql` | Sistema de aprendizado IA |
| `20251130000000_cleanup_duplicate_bank_accounts.sql` | Desativa conta Sicredi duplicada |
| `20251130010000_reset_january_transactions.sql` | Limpa transações para reimportação |
| `20251130020000_partner_expense_accounts.sql` | Contas e centros de custo para sócios |
| `20251130030000_sergio_expense_categories.sql` | Categorias de despesas do sócio Sergio |

---

## PRÓXIMAS TAREFAS

1. ~~Sistema de diálogo IA-Humano~~ ✅
2. ~~Reorganização do menu~~ ✅
3. ~~Sistema de Adiantamentos a Sócios~~ ✅
4. Reimportar extrato Janeiro/2025 com 183 transações
5. Importar despesas do sócio Sergio
6. Testar fluxo completo de classificação IA
7. Implementar conciliação bancária automática
