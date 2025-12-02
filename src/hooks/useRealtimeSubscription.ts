import { useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface SubscriptionConfig {
  table: string;
  schema?: string;
  event?: PostgresChangeEvent;
  filter?: string;
}

interface RealtimePayload {
  eventType: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  schema: string;
  table: string;
}

interface UseRealtimeOptions {
  /** Configurações das tabelas para monitorar */
  subscriptions: SubscriptionConfig[];
  /** Callback quando houver mudanças */
  onDataChange: (payload: RealtimePayload, table: string) => void;
  /** Se deve ativar a subscription (default: true) */
  enabled?: boolean;
}

/**
 * Hook para subscription em tempo real no Supabase
 * 
 * @example
 * useRealtimeSubscription({
 *   subscriptions: [
 *     { table: 'accounts_payable', event: '*' },
 *     { table: 'recurring_expenses', event: '*' }
 *   ],
 *   onDataChange: (payload, table) => {
 *     console.log(`Mudança em ${table}:`, payload);
 *     refetch(); // Recarregar dados
 *   }
 * });
 */
export function useRealtimeSubscription({
  subscriptions,
  onDataChange,
  enabled = true
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onDataChangeRef = useRef(onDataChange);
  
  // Manter referência atualizada do callback
  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // Serializar subscriptions para dependência estável
  const subscriptionsKey = useMemo(
    () => JSON.stringify(subscriptions),
    [subscriptions]
  );

  useEffect(() => {
    if (!enabled || subscriptions.length === 0) return;

    // Criar nome único para o canal
    const channelName = `realtime-${subscriptions.map(s => s.table).join('-')}-${Date.now()}`;
    
    // Criar canal
    let channel = supabase.channel(channelName);

    // Adicionar listeners para cada tabela
    subscriptions.forEach(({ table, schema = 'public', event = '*', filter }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel = (channel as any).on(
        "postgres_changes",
        {
          event,
          schema,
          table,
          ...(filter && { filter }),
        },
        (payload: RealtimePayload) => {
          console.log(`[Realtime] ${event} em ${table}:`, payload);
          onDataChangeRef.current(payload, table);
        }
      );
    });

    // Subscrever
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Conectado: ${channelName}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[Realtime] Erro no canal: ${channelName}`);
      }
    });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        console.log(`[Realtime] Desconectando: ${channelName}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, subscriptionsKey]);

  return {
    channel: channelRef.current,
    isConnected: channelRef.current !== null
  };
}

/**
 * Hook simplificado para uma única tabela
 */
export function useTableRealtime(
  table: string,
  onDataChange: () => void,
  options?: { event?: PostgresChangeEvent; filter?: string; enabled?: boolean }
) {
  return useRealtimeSubscription({
    subscriptions: [{ 
      table, 
      event: options?.event || '*',
      filter: options?.filter 
    }],
    onDataChange: () => onDataChange(),
    enabled: options?.enabled ?? true
  });
}
