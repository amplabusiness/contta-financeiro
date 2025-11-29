# INSTRUÇÕES PARA CLAUDE CODE (VSCode)

## AUTORIDADE: TOTAL
O usuário autorizou alterações conforme necessário. Você tem autonomia para:
- Resolver conflitos usando a melhor versão
- Fazer ajustes de código se necessário
- Fazer deploy de Edge Functions
- Fazer commits e push para main

---

## STATUS ATUAL (29/11/2025)

### Concluído:
- Merge do branch `claude/analyze-claude-config-01DwBx8AxYbXpiRF9R4aamLo` para main
- Migração de Edge Functions de Lovable para Gemini API
- Deploy das funções principais: `ai-business-manager`, `ai-accountant-background`, `ai-chatbot`

### Mudança Importante - Lovable Descontinuado:
O projeto não usa mais o Lovable. Todas as Edge Functions foram migradas para usar **Gemini API diretamente**.

**Antes (Lovable)**:
```typescript
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: { Authorization: `Bearer ${lovableApiKey}` },
  body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [...] })
});
```

**Agora (Gemini direto)**:
```typescript
const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2000 }
    })
  }
);
const data = await response.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
```

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
npx supabase functions deploy ai-business-manager --project-ref xdtlhzysrpoinqtsglmr

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

## FUNÇÕES JÁ MIGRADAS PARA GEMINI

| Função | Status |
|--------|--------|
| `ai-business-manager` | Totalmente migrado |
| `ai-accountant-background` | Totalmente migrado |
| `ai-chatbot` | Totalmente migrado |
| Outras 22 funções | Parcialmente migradas (variáveis OK, URL precisa ajuste fino) |

---

## PRÓXIMAS TAREFAS

1. Testar `/business-manager` no navegador
2. Ajustar funções restantes que usam function calling (tools)
3. Verificar se todas as funções de IA estão funcionando
