# ORDEM PARA VSCODE/CLAUDE

## AUTORIDADE: TOTAL
O usuário autorizou alterações conforme necessário. Você tem autonomia para:
- Resolver conflitos usando a melhor versão
- Fazer ajustes de código se necessário
- Fazer deploy de Edge Functions

---

## TAREFA URGENTE: Deploy Edge Function ai-business-manager

### O Problema:
A página `/business-manager` (Gestor Empresarial IA) está dando erro:
```
"Failed to send a request to the Edge Function"
```

A função existe no código mas NÃO foi deployada no Supabase.

### Executar AGORA:

```bash
# Deploy da função
supabase functions deploy ai-business-manager

# Se der erro de autenticação:
supabase login
supabase link --project-ref xdtlhzysrpoinqtsglmr
supabase functions deploy ai-business-manager
```

### Verificar outras funções não deployadas:
```bash
# Listar funções deployadas
supabase functions list

# Deploy de todas as funções de IA se necessário
supabase functions deploy ai-accountant-background
supabase functions deploy ai-business-manager
```

---

## PRIORIDADE: MÁXIMA
Usuário não consegue usar o Gestor IA - precisa do deploy urgente.
