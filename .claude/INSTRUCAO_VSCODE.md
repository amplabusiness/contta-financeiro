# INSTRUÇÕES PARA CLAUDE CODE (VSCode)

## AUTORIDADE: TOTAL
O usuário autorizou alterações conforme necessário. Você tem autonomia para:
- Resolver conflitos usando a melhor versão
- Fazer ajustes de código se necessário
- Fazer deploy de Edge Functions
- Fazer commits e push para main

---

## STATUS ATUAL (29/11/2025)

### Concluído Hoje:
1. **Sistema Contábil Completo** - Plano de contas conforme NBC/CFC
2. **Conta Bancária Sicredi** - Cadastrada com saldo de abertura R$ 90.725,10
3. **Lançamento de Abertura** - Registrado em 31/12/2024
4. **Importação OFX com IA** - Classificação automática implementada
5. **Nova Edge Function** - `ai-bank-transaction-processor` para classificação

### Estrutura Contábil Implementada:
| Grupo | Descrição | Contas Especiais |
|-------|-----------|------------------|
| 1 | ATIVO | 1.1.1.02 Banco Sicredi |
| 2 | PASSIVO | 2.1.1.01 Fornecedores |
| 3 | RECEITAS | 3.1.1.01 Honorários |
| 4 | DESPESAS | 4.1.x a 4.9.x |
| 5 | PATRIMÔNIO LÍQUIDO | 5.3.02.01 Saldo de Abertura, 5.3.03.01 Ajustes de Exercícios Anteriores |

### Tratamento de Recebimentos:
- **Recebimentos do período atual**: D-Banco C-Receita
- **Recebimentos de períodos anteriores (ex: dezembro em janeiro)**: D-Banco C-5.3.03.01 (Ajustes Positivos de Exercícios Anteriores)

---

## IMPORTAÇÃO DE EXTRATO OFX

### Fluxo Implementado:
1. Upload do arquivo OFX
2. Parsing com `ofxParser.ts`
3. **Com IA habilitada**:
   - Chama `ai-bank-transaction-processor`
   - Contador IA e Agente Financeiro classificam cada transação
   - Gera lançamentos contábeis automaticamente
   - Define contas de débito e crédito

### Página: `/bank-import`
- Switch para habilitar/desabilitar IA
- Barra de progresso durante processamento
- Exibe classificações com confiança da IA

---

## EDGE FUNCTIONS DE IA

| Função | Descrição | Status |
|--------|-----------|--------|
| `ai-bank-transaction-processor` | Processa transações bancárias e gera lançamentos | ✅ Deployado |
| `ai-business-manager` | Gestor empresarial | ✅ Migrado Gemini |
| `ai-accountant-background` | Validador contábil | ✅ Migrado Gemini |
| `ai-accounting-engine` | Motor contábil (balancete, encerramento) | ✅ Ativo |
| `ai-expense-classifier` | Classificador de despesas | ✅ Ativo |
| Outras 20+ funções | Diversos agentes | ✅ Parcialmente migrados |

---

## CREDENCIAIS

### Supabase
- **Project ID**: `xdtlhzysrpoinqtsglmr`
- **URL**: `https://xdtlhzysrpoinqtsglmr.supabase.co`

### Secrets configurados no Supabase:
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
npx supabase functions deploy ai-business-manager ai-accountant-background ai-chatbot --project-ref xdtlhzysrpoinqtsglmr

# Listar funções deployadas
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
# Push para main
git add . && git commit -m "mensagem" && git push origin main
```

---

## HELPER GEMINI

Criado o arquivo `supabase/functions/_shared/gemini.ts` com funções helper:

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

## MIGRATIONS APLICADAS HOJE

| Arquivo | Descrição |
|---------|-----------|
| `20251129250000_complete_chart_of_accounts.sql` | Plano de contas completo (5 grupos) |
| `20251129260000_register_sicredi_account.sql` | Conta Sicredi + saldo inicial |
| `20251129270000_opening_balance_entry.sql` | Lançamento de abertura 31/12/2024 |

---

## PRÓXIMAS TAREFAS

1. ~~Testar importação do extrato janeiro/2025~~ (Pronto para usar)
2. Ajustar regras de classificação baseado no uso real
3. Implementar conciliação bancária automática
4. Dashboard de acompanhamento contábil
