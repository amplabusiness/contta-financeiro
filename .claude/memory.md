# Registro de Atividades Recentes

## Correções de Autenticação Supabase
- Ajustei `src/integrations/supabase/client.ts` para detectar automaticamente mudanças de projeto (assinatura ambiente), limpar sessões antigas e expor `clearSupabaseAuthState`.
- Atualizei `src/components/Layout.tsx` para:
  - Reagir a erros de sessão/refresh (`TOKEN_REFRESH_FAILED`).
  - Recarregar clientes com `useCallback`.
  - Limpar sessão e redirecionar ao `/auth` em falhas ou logout manual.
- Atualizei `src/pages/Auth.tsx` para limpar sessões inválidas ao entrar e tratar erros de refresh.
- Validei com `npm run build` após as mudanças.

## Ajuste de Importações Duplicadas
- Removi o segundo import de `React` em `src/components/Layout.tsx` que causava `Identifier 'useEffect' has already been declared`.
- Build verificado com `npm run build`.

## Correção no Razão Geral (`GeneralLedgerAll`)
- `chart_of_accounts.type` podia vir nulo, causando `toUpperCase` em `null`.
- Tipagem `tipo` agora aceita `string | null`, normaliza textos, define rótulo padrão “Não classificado” e cores seguras.
- Build validado com `npm run build`.
