/**
 * Funções utilitárias para formatação de valores monetários e percentuais.
 *
 * IMPORTANTE: Este arquivo contém APENAS funções utilitárias.
 * Todos os dados financeiros devem ser obtidos do Supabase.
 *
 * @see src/integrations/supabase/client.ts - Cliente Supabase
 * @see src/pages/Dashboard.tsx - Exemplo de consumo de dados reais
 */

export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const formatCurrencyCompact = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'R$ 0';
  if (Math.abs(value) >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return formatCurrency(value);
};

export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0,00%';
  return `${value.toFixed(2)}%`;
};

export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat("pt-BR").format(value);
};
