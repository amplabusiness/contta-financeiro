/**
 * useAuditLog.ts
 * 
 * Hook para trilha de auditoria imutável (WORM).
 * Implementa hash encadeado estilo blockchain para garantir integridade.
 * 
 * @author Sistema Contta
 * @approved Dr. Cícero - 01/02/2026
 * 
 * RECOMENDAÇÃO SÊNIOR #1: Trilha de auditoria verdadeiramente imutável
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantConfig } from './useTenantConfig';

// ============================================================================
// TYPES
// ============================================================================

export type AuditEventType = 
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'classify'
  | 'reclassify'
  | 'reconcile'
  | 'import'
  | 'export'
  | 'dr_cicero_decision'
  | 'education_acknowledged'
  | 'period_close'
  | 'period_open'
  | 'error'
  | 'warning'
  | 'system';

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  previous_hash: string;
  record_hash: string;
  event_type: AuditEventType;
  entity_type?: string;
  entity_id?: string;
  payload: Record<string, unknown>;
  user_id?: string;
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  context?: Record<string, unknown>;
  created_at: string;
  sequence_number: number;
  block_index: number;
}

export interface ChainIntegrityResult {
  is_valid: boolean;
  total_records: number;
  broken_links: number;
  first_broken_at?: string;
  verification_time_ms: number;
}

export interface AuditLogFilters {
  event_type?: AuditEventType;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================================
// HOOK: useAuditLog
// ============================================================================

export function useAuditLog() {
  const { tenant } = useTenantConfig();
  const tenantId = tenant?.id;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Registra evento no audit log imutável
   */
  const logEvent = useCallback(async (
    eventType: AuditEventType,
    payload: Record<string, unknown>,
    options?: {
      entityType?: string;
      entityId?: string;
      context?: Record<string, unknown>;
    }
  ): Promise<string | null> => {
    if (!tenantId) {
      setError('Tenant não configurado');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Coletar metadados do navegador
      const userAgent = navigator.userAgent;
      const sessionId = sessionStorage.getItem('session_id') || 
        `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Salvar session_id se não existir
      if (!sessionStorage.getItem('session_id')) {
        sessionStorage.setItem('session_id', sessionId);
      }

      // Buscar usuário atual
      const { data: { user } } = await supabase.auth.getUser();

      // Chamar função do banco
      const { data, error: rpcError } = await supabase.rpc('insert_audit_log', {
        p_tenant_id: tenantId,
        p_event_type: eventType,
        p_entity_type: options?.entityType || null,
        p_entity_id: options?.entityId || null,
        p_payload: payload,
        p_user_id: user?.id || null,
        p_user_email: user?.email || null,
        p_ip_address: null, // IP é coletado server-side
        p_user_agent: userAgent,
        p_session_id: sessionId,
        p_context: options?.context || null
      });

      if (rpcError) {
        throw rpcError;
      }

      return data as string;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar audit log';
      setError(errorMessage);
      console.error('[AuditLog] Erro:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  /**
   * Busca logs de auditoria com filtros
   */
  const getLogs = useCallback(async (
    filters?: AuditLogFilters
  ): Promise<AuditLogEntry[]> => {
    if (!tenantId) {
      setError('Tenant não configurado');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('audit_log_immutable')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sequence_number', { ascending: false });

      // Aplicar filtros
      if (filters?.event_type) {
        query = query.eq('event_type', filters.event_type);
      }
      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }
      if (filters?.entity_id) {
        query = query.eq('entity_id', filters.entity_id);
      }
      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters?.start_date) {
        query = query.gte('created_at', filters.start_date.toISOString());
      }
      if (filters?.end_date) {
        query = query.lte('created_at', filters.end_date.toISOString());
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      return (data || []) as AuditLogEntry[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar audit logs';
      setError(errorMessage);
      console.error('[AuditLog] Erro:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  /**
   * Verifica integridade da cadeia de auditoria
   */
  const verifyChainIntegrity = useCallback(async (
    startDate?: Date,
    endDate?: Date
  ): Promise<ChainIntegrityResult | null> => {
    if (!tenantId) {
      setError('Tenant não configurado');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('verify_audit_chain_integrity', {
        p_tenant_id: tenantId,
        p_start_date: startDate?.toISOString() || null,
        p_end_date: endDate?.toISOString() || null
      });

      if (rpcError) {
        throw rpcError;
      }

      // A função retorna um array com um único resultado
      const result = Array.isArray(data) ? data[0] : data;
      
      return result as ChainIntegrityResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao verificar integridade';
      setError(errorMessage);
      console.error('[AuditLog] Erro:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  /**
   * Busca logs recentes (últimos 7 dias com indicador de integridade)
   */
  const getRecentLogs = useCallback(async (
    limit: number = 100
  ): Promise<(AuditLogEntry & { chain_valid: boolean })[]> => {
    if (!tenantId) {
      setError('Tenant não configurado');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('v_recent_audit_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(limit);

      if (queryError) {
        throw queryError;
      }

      return (data || []) as (AuditLogEntry & { chain_valid: boolean })[];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar logs recentes';
      setError(errorMessage);
      console.error('[AuditLog] Erro:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  /**
   * Busca estatísticas do audit log
   */
  const getStatistics = useCallback(async (): Promise<{
    total_records: number;
    total_blocks: number;
    events_by_type: Record<string, number>;
    recent_activity: number;
  } | null> => {
    if (!tenantId) {
      return null;
    }

    try {
      // Total de registros
      const { count: totalRecords } = await supabase
        .from('audit_log_immutable')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      // Máximo block_index
      const { data: blockData } = await supabase
        .from('audit_log_immutable')
        .select('block_index')
        .eq('tenant_id', tenantId)
        .order('block_index', { ascending: false })
        .limit(1);

      // Eventos por tipo (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: eventData } = await supabase
        .from('audit_log_immutable')
        .select('event_type')
        .eq('tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      const eventsByType: Record<string, number> = {};
      eventData?.forEach(e => {
        eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1;
      });

      // Atividade recente (últimas 24h)
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const { count: recentActivity } = await supabase
        .from('audit_log_immutable')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('created_at', oneDayAgo.toISOString());

      return {
        total_records: totalRecords || 0,
        total_blocks: (blockData?.[0]?.block_index || 0) + 1,
        events_by_type: eventsByType,
        recent_activity: recentActivity || 0
      };
    } catch (err) {
      console.error('[AuditLog] Erro ao buscar estatísticas:', err);
      return null;
    }
  }, [tenantId]);

  return {
    // State
    isLoading,
    error,
    
    // Actions
    logEvent,
    getLogs,
    getRecentLogs,
    verifyChainIntegrity,
    getStatistics,
    
    // Helpers
    clearError: () => setError(null)
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formata evento de audit para exibição
 */
export function formatAuditEvent(entry: AuditLogEntry): {
  icon: string;
  color: string;
  label: string;
  description: string;
} {
  const eventConfig: Record<AuditEventType, { icon: string; color: string; label: string }> = {
    login: { icon: '🔐', color: 'green', label: 'Login' },
    logout: { icon: '🚪', color: 'gray', label: 'Logout' },
    create: { icon: '➕', color: 'blue', label: 'Criação' },
    update: { icon: '✏️', color: 'yellow', label: 'Alteração' },
    delete: { icon: '🗑️', color: 'red', label: 'Exclusão' },
    approve: { icon: '✅', color: 'green', label: 'Aprovação' },
    reject: { icon: '❌', color: 'red', label: 'Rejeição' },
    classify: { icon: '🏷️', color: 'purple', label: 'Classificação' },
    reclassify: { icon: '🔄', color: 'orange', label: 'Reclassificação' },
    reconcile: { icon: '🔗', color: 'blue', label: 'Conciliação' },
    import: { icon: '📥', color: 'cyan', label: 'Importação' },
    export: { icon: '📤', color: 'cyan', label: 'Exportação' },
    dr_cicero_decision: { icon: '👨‍⚖️', color: 'indigo', label: 'Decisão Dr. Cícero' },
    education_acknowledged: { icon: '📚', color: 'teal', label: 'Educação Reconhecida' },
    period_close: { icon: '🔒', color: 'amber', label: 'Fechamento Período' },
    period_open: { icon: '🔓', color: 'lime', label: 'Abertura Período' },
    error: { icon: '⚠️', color: 'red', label: 'Erro' },
    warning: { icon: '⚡', color: 'yellow', label: 'Aviso' },
    system: { icon: '⚙️', color: 'gray', label: 'Sistema' }
  };

  const config = eventConfig[entry.event_type] || eventConfig.system;
  
  // Construir descrição baseada no payload
  let description = entry.entity_type ? `${entry.entity_type}` : '';
  if (entry.payload?.description) {
    description = String(entry.payload.description);
  } else if (entry.payload?.action) {
    description = String(entry.payload.action);
  }

  return {
    ...config,
    description
  };
}

/**
 * Gera hash local para comparação (DEBUG apenas)
 */
export function generateLocalHash(
  tenantId: string,
  previousHash: string,
  payload: Record<string, unknown>,
  createdAt: string
): string {
  const dataToHash = `${tenantId}|${previousHash}|${JSON.stringify(payload)}|${createdAt}`;
  
  // Usar SubtleCrypto para SHA-256
  // Nota: Esta é uma versão simplificada, o hash real é gerado no servidor
  return btoa(dataToHash).slice(0, 64);
}
