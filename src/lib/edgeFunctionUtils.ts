/**
 * Utilitários para lidar com Edge Functions do Supabase
 */

/**
 * Verifica se um erro é relacionado a Edge Function indisponível
 */
export function isEdgeFunctionError(error: any): boolean {
  if (!error) return false;

  return (
    error.name === 'FunctionsHttpError' ||
    error.message?.includes('Edge Function') ||
    error.message?.includes('non-2xx status code') ||
    error.message?.includes('Failed to fetch')
  );
}

/**
 * Retorna uma mensagem amigável para erros de Edge Function
 */
export function getEdgeFunctionErrorMessage(fallbackAction?: string): string {
  return fallbackAction
    ? `Funcionalidade temporariamente indisponível. ${fallbackAction}`
    : 'Funcionalidade temporariamente indisponível. Tente novamente mais tarde.';
}

/**
 * Wrapper para chamadas de Edge Function com fallback
 * @param fn Função que chama a Edge Function
 * @param onError Callback para erro (recebe o erro)
 * @param silentOnEdgeFunctionError Se true, não mostra erro para Edge Function indisponível
 */
export async function safeEdgeFunctionCall<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (error: any) => void;
    silentOnEdgeFunctionError?: boolean;
    fallbackValue?: T;
  }
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error: any) {
    if (isEdgeFunctionError(error)) {
      if (!options?.silentOnEdgeFunctionError) {
        console.log('[EdgeFunction] Função indisponível:', error.message);
      }
      if (options?.fallbackValue !== undefined) {
        return options.fallbackValue;
      }
    } else {
      options?.onError?.(error);
    }
    return undefined;
  }
}
