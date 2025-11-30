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
1. **Sistema de Diálogo IA-Humano** - Classificação interativa de transações
2. **Componente AIClassificationDialog** - Modal para treinar a IA
3. **Tabelas de Aprendizado** - Entidades, padrões e histórico
4. **Integração BankImport** - Botões de classificação manual e revisão

### Concluído Anteriormente (29/11):
1. **Sistema Contábil Completo** - Plano de contas conforme NBC/CFC
2. **Conta Bancária Sicredi** - Cadastrada com saldo de abertura R$ 90.725,10
3. **Lançamento de Abertura** - Registrado em 31/12/2024
4. **Importação OFX com IA** - Classificação automática implementada
5. **Edge Function** - `ai-bank-transaction-processor` para classificação

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
- Progresso visual (X de Y transações)

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
   - Abre diálogo para treinar IA antes de importar

2. **Após importar com IA** → Botão "Revisar Classificações (X pendentes)"
   - Aparece se houver transações com confiança < 70%
   - Permite corrigir classificações da IA

3. **O aprendizado é salvo**:
   - Entidade nova → `ai_known_entities`
   - Padrão de classificação → `ai_classification_patterns`
   - Histórico → `ai_classification_history`

---

## ESTRUTURA CONTÁBIL

| Grupo | Descrição | Contas Especiais |
|-------|-----------|------------------|
| 1 | ATIVO | 1.1.1.02 Banco Sicredi |
| 2 | PASSIVO | 2.1.1.01 Fornecedores |
| 3 | RECEITAS | 3.1.1.01 Honorários |
| 4 | DESPESAS | 4.1.x a 4.9.x |
| 5 | PATRIMÔNIO LÍQUIDO | 5.3.02.01 Saldo de Abertura, 5.3.03.01 Ajustes |

### Tratamento de Recebimentos:
- **Período atual**: D-Banco C-Receita
- **Períodos anteriores**: D-Banco C-5.3.03.01 (Ajustes Positivos)

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
# Uma função
npx supabase functions deploy ai-bank-transaction-processor --project-ref xdtlhzysrpoinqtsglmr

# Múltiplas funções
npx supabase functions deploy ai-business-manager ai-accountant-background --project-ref xdtlhzysrpoinqtsglmr

# Listar funções
npx supabase functions list --project-ref xdtlhzysrpoinqtsglmr
```

### Migrações
```bash
# Aplicar migrações
npx supabase db push --linked

# Reparar migração com erro
npx supabase migration repair <timestamp> --status reverted --linked
```

### Git
```bash
git add . && git commit -m "mensagem" && git push origin main
```

---

## HELPER GEMINI

Arquivo `supabase/functions/_shared/gemini.ts`:

```typescript
import { callGemini, askGemini, askGeminiJSON } from '../_shared/gemini.ts'

// Uso simples
const response = await askGemini("Pergunta aqui", "System prompt");

// Com mensagens
const result = await callGemini([
  { role: 'system', content: 'Você é...' },
  { role: 'user', content: 'Pergunta' }
], { temperature: 0.7, maxOutputTokens: 1000 });

// Para resposta JSON estruturada
const data = await askGeminiJSON<MeuTipo>("Pergunta", "System prompt");
```

---

## MIGRATIONS APLICADAS

| Arquivo | Descrição |
|---------|-----------|
| `20251129250000_complete_chart_of_accounts.sql` | Plano de contas completo |
| `20251129260000_register_sicredi_account.sql` | Conta Sicredi + saldo inicial |
| `20251129270000_opening_balance_entry.sql` | Lançamento de abertura 31/12/2024 |
| `20251129280000_ai_transaction_learning.sql` | Sistema de aprendizado IA |

---

## ARQUIVOS PRINCIPAIS

### Componentes de IA:
- `src/components/AIClassificationDialog.tsx` - Diálogo de classificação
- `src/pages/BankImport.tsx` - Importação com IA integrada

### Edge Functions:
- `supabase/functions/ai-bank-transaction-processor/index.ts`
- `supabase/functions/_shared/gemini.ts`

---

## PRÓXIMAS TAREFAS

1. ~~Sistema de diálogo IA-Humano~~ ✅
2. Aplicar migração `20251129280000` no banco remoto
3. Testar fluxo completo com extrato real
4. Implementar conciliação bancária automática
5. Dashboard de acompanhamento contábil
